import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getBkfcIntegrationConfig, getCleanupConfig, getPrivilegedSupabaseConfig } from "@/lib/config/server";
import { runApplicationCleanup } from "@/lib/application/upload-session-cleanup";
import { STORAGE_BUCKET } from "@/lib/application/policy";
import { reconcileBkfcIntegrationOrphans } from "@/lib/integrations/bkfc/orphan-reconciler";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: Request, expected: string) {
  const supplied = request.headers.get("authorization") ?? "";
  const wanted = `Bearer ${expected}`;
  const suppliedBytes = Buffer.from(supplied);
  const wantedBytes = Buffer.from(wanted);
  return suppliedBytes.length === wantedBytes.length && timingSafeEqual(suppliedBytes, wantedBytes);
}

export async function GET(request: Request) {
  try {
    const cleanup = getCleanupConfig();
    if (!authorized(request, cleanup.cronSecret)) {
      return NextResponse.json({ success: false, code: "UNAUTHORIZED" }, { status: 401 });
    }
    const config = getPrivilegedSupabaseConfig();
    const supabase = createClient<any>(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const summary = await runApplicationCleanup(supabase, cleanup);
    const integration = getBkfcIntegrationConfig();
    const orphanSummary = integration.orphanCleanupEnabled
      ? await reconcileBkfcIntegrationOrphans({
        list: (prefix, options) => supabase.storage.from(STORAGE_BUCKET).list(prefix, options),
        isLinked: async (path) => {
          const result = await supabase.rpc("affiliate_application_asset_is_linked", { p_path: path });
          return { data: result.data as boolean | null, error: result.error };
        },
        remove: (paths) => supabase.storage.from(STORAGE_BUCKET).remove(paths),
        log: (event) => console.info(JSON.stringify({ event: "bkfc_integration_orphan_cleanup", ...event })),
      }, {
        dryRun: integration.orphanCleanupDryRun,
        batchSize: integration.orphanCleanupBatchSize,
        minimumAgeHours: 24,
        maximumPages: 10,
      })
      : null;
    const failures = summary.failures + (orphanSummary?.failures ?? 0);
    return NextResponse.json({ success: failures === 0, ...summary, orphanReconciliation: orphanSummary }, {
      status: failures === 0 ? 200 : 503,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    console.error(JSON.stringify({ event: "affiliate_application_cleanup", code: "CLEANUP_CONFIGURATION_FAILED" }));
    return NextResponse.json({ success: false, code: "CLEANUP_UNAVAILABLE" }, { status: 503 });
  }
}
