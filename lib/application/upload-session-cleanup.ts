import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_BUCKET } from "./policy.ts";
import type { IssuedUpload } from "./direct-upload-contract.ts";

export type CleanupPolicy = {
  dryRun: boolean;
  abandonedSessionHours: number;
  failedSessionHours: number;
  finalizedSessionDays: number;
  anonymousUserDays: number;
  batchSize: number;
};

export type CleanupSession = {
  id: string;
  uploader_id: string;
  status: "pending" | "finalizing" | "failed" | "expired" | "finalized";
  upload_manifest: unknown;
  expires_at: string;
  finalized_at?: string | null;
  updated_at: string;
};

export type CleanupSummary = {
  dryRun: boolean;
  abandonedSessions: number;
  finalizedSessions: number;
  objects: number;
  anonymousUsers: number;
  protectedSessions: number;
  failures: number;
};

function before(value: string | null | undefined, cutoff: number) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) && parsed < cutoff;
}

export function isAbandonedSession(session: CleanupSession, policy: CleanupPolicy, now: number) {
  if (session.status === "pending" || session.status === "finalizing") {
    return before(session.expires_at, now - policy.abandonedSessionHours * 60 * 60 * 1000);
  }
  if (session.status === "failed" || session.status === "expired") {
    return before(session.updated_at, now - policy.failedSessionHours * 60 * 60 * 1000);
  }
  return false;
}

export function issuedPaths(manifest: unknown) {
  if (!Array.isArray(manifest)) return [];
  return [...new Set((manifest as Partial<IssuedUpload>[])
    .map((item) => item.path)
    .filter((path): path is string => typeof path === "string" && /^[0-9a-f-]{36}\//i.test(path)))];
}

function logCleanup(level: "info" | "warn" | "error", entry: Record<string, unknown>) {
  const line = JSON.stringify({ event: "affiliate_application_cleanup", ...entry });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export async function runApplicationCleanup(
  supabase: SupabaseClient<any>,
  policy: CleanupPolicy,
  now = Date.now(),
): Promise<CleanupSummary> {
  const summary: CleanupSummary = {
    dryRun: policy.dryRun,
    abandonedSessions: 0,
    finalizedSessions: 0,
    objects: 0,
    anonymousUsers: 0,
    protectedSessions: 0,
    failures: 0,
  };

  const { data: sessionRows, error: sessionError } = await supabase
    .from("affiliate_application_upload_sessions")
    .select("id,uploader_id,status,upload_manifest,expires_at,finalized_at,updated_at")
    .in("status", ["pending", "finalizing", "failed", "expired"])
    .order("updated_at", { ascending: true })
    .limit(policy.batchSize * 3);
  if (sessionError) {
    summary.failures += 1;
    logCleanup("error", { code: "SESSION_CANDIDATE_LOOKUP_FAILED" });
  }

  const abandoned = ((sessionRows ?? []) as CleanupSession[])
    .filter((session) => isAbandonedSession(session, policy, now))
    .slice(0, policy.batchSize);
  for (const session of abandoned) {
    const paths = issuedPaths(session.upload_manifest);
    let protectedAsset = false;
    for (const path of paths) {
      const { data: linked, error: linkError } = await supabase.rpc("affiliate_application_asset_is_linked", { p_path: path });
      if (linkError) {
        summary.failures += 1;
        protectedAsset = true;
        logCleanup("error", { code: "ASSET_LINK_CHECK_FAILED", sessionId: session.id });
        break;
      }
      if (linked === true) {
        protectedAsset = true;
        break;
      }
    }
    if (protectedAsset) {
      summary.protectedSessions += 1;
      logCleanup("warn", { code: "LINKED_ASSET_PROTECTED", sessionId: session.id });
      continue;
    }

    if (policy.dryRun) {
      summary.abandonedSessions += 1;
      summary.objects += paths.length;
      continue;
    }
    if (paths.length) {
      const removal = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
      if (removal.error) {
        summary.failures += 1;
        logCleanup("error", { code: "STORAGE_REMOVE_FAILED", sessionId: session.id, objectCount: paths.length });
        continue;
      }
    }
    const deletion = await supabase.from("affiliate_application_upload_sessions")
      .delete()
      .eq("id", session.id)
      .in("status", ["pending", "finalizing", "failed", "expired"]);
    if (deletion.error) {
      summary.failures += 1;
      logCleanup("error", { code: "SESSION_DELETE_FAILED", sessionId: session.id });
      continue;
    }
    summary.abandonedSessions += 1;
    summary.objects += paths.length;
  }

  const finalizedCutoff = new Date(now - policy.finalizedSessionDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: finalizedRows, error: finalizedError } = await supabase
    .from("affiliate_application_upload_sessions")
    .select("id")
    .eq("status", "finalized")
    .lt("finalized_at", finalizedCutoff)
    .limit(policy.batchSize);
  if (finalizedError) {
    summary.failures += 1;
    logCleanup("error", { code: "FINALIZED_SESSION_LOOKUP_FAILED" });
  } else if (finalizedRows?.length) {
    if (policy.dryRun) summary.finalizedSessions += finalizedRows.length;
    else {
      for (const row of finalizedRows) {
        const deletion = await supabase.from("affiliate_application_upload_sessions")
          .delete().eq("id", row.id).eq("status", "finalized");
        if (deletion.error) summary.failures += 1;
        else summary.finalizedSessions += 1;
      }
    }
  }

  const userCutoff = now - policy.anonymousUserDays * 24 * 60 * 60 * 1000;
  let candidates = 0;
  for (let page = 1; page <= 10 && candidates < policy.batchSize; page += 1) {
    const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (usersError) {
      summary.failures += 1;
      logCleanup("error", { code: "ANONYMOUS_USER_LOOKUP_FAILED", page });
      break;
    }
    const users = usersPage.users.filter((user) => user.is_anonymous === true && before(user.created_at, userCutoff));
    for (const user of users) {
      if (candidates >= policy.batchSize) break;
      candidates += 1;
      const { data: activeSessions, error: activeError } = await supabase
        .from("affiliate_application_upload_sessions")
        .select("id")
        .eq("uploader_id", user.id)
        .limit(1);
      if (activeError || activeSessions?.length) {
        if (activeError) summary.failures += 1;
        continue;
      }
      if (policy.dryRun) {
        summary.anonymousUsers += 1;
        continue;
      }
      const deleted = await supabase.auth.admin.deleteUser(user.id);
      if (deleted.error) summary.failures += 1;
      else summary.anonymousUsers += 1;
    }
    if (usersPage.users.length < 100) break;
  }

  logCleanup(summary.failures ? "warn" : "info", { code: "CLEANUP_COMPLETE", ...summary });
  return summary;
}
