import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getPrivilegedSupabaseConfig, getProxyTrustConfig, getRateLimitConfig } from "@/lib/config/server";
import { clientErrorPayload } from "@/lib/application/diagnostics";
import { directStorageEndpoint, formDataFromPayload, formPayloadFrom, issueUploadManifest, uploadSessionRequestHash, UPLOAD_SESSION_TTL_MS } from "@/lib/application/direct-upload";
import type { UploadSessionResponse } from "@/lib/application/direct-upload-contract";
import { logApplicationEvent } from "@/lib/application/logging";
import { ApplicationError, STORAGE_BUCKET, type ApiCode } from "@/lib/application/policy";
import { rateLimitIdentifier, trustedRequestOrigin } from "@/lib/application/rate-limit";
import { validateApplicationMetadata } from "@/lib/application/validation";
import { cleanupExpiredUploadSessions } from "@/lib/application/upload-session-cleanup";

export const runtime = "nodejs";

function error(code: ApiCode, status: number, field?: string) {
  return NextResponse.json(clientErrorPayload(code, field), { status });
}

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1];
}

function reference(id: string) {
  return `BKFC-GYM-${id.replaceAll("-", "").slice(0, 12).toLocaleUpperCase("en-US")}`;
}

async function withCompletedObjects(
  supabase: ReturnType<typeof createClient<any>>,
  manifest: UploadSessionResponse["uploads"],
) {
  return Promise.all(manifest.map(async (item) => {
    const separator = item.path.lastIndexOf("/");
    const folder = item.path.slice(0, separator);
    const filename = item.path.slice(separator + 1);
    const { data, error: listError } = await supabase.storage.from(STORAGE_BUCKET)
      .list(folder, { search: filename, limit: 2 });
    const object = listError ? undefined : data?.find((entry) => entry.name === filename);
    return { ...item, uploaded: Number(object?.metadata?.size) === item.size };
  }));
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 128 * 1024) return error("REQUEST_TOO_LARGE", 413);
  try {
    const config = getPrivilegedSupabaseConfig();
    const rateConfig = getRateLimitConfig();
    const proxyConfig = getProxyTrustConfig();
    const supabase = createClient<any>(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = bearerToken(request);
    if (!token) return error("VALIDATION_FAILED", 401);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return error("VALIDATION_FAILED", 401);

    const body = await request.json() as { form?: unknown; files?: unknown };
    const formData = formDataFromPayload(body.form);
    const application = validateApplicationMetadata(formData);
    const sessionId = crypto.randomUUID();
    const uploads = issueUploadManifest(sessionId, body.files);
    const storedFormPayload = formPayloadFrom(formData);
    const requestHash = uploadSessionRequestHash(storedFormPayload, uploads);

    const { data: priorApplication, error: priorApplicationError } = await supabase
      .from("affiliate_applications")
      .select("application_reference")
      .eq("idempotency_key", application.idempotencyKey)
      .maybeSingle();
    if (priorApplicationError) return error("PERSISTENCE_UNAVAILABLE", 503);
    if (priorApplication) return error("APPLICATION_ALREADY_RECEIVED", 409);

    const { data: priorSession, error: priorSessionError } = await supabase
      .from("affiliate_application_upload_sessions")
      .select("id,application_reference,upload_manifest,expires_at,status,uploader_id,request_hash")
      .eq("idempotency_key", application.idempotencyKey)
      .maybeSingle();
    if (priorSessionError) return error("PERSISTENCE_UNAVAILABLE", 503);
    if (priorSession) {
      if (priorSession.uploader_id !== authData.user.id || priorSession.request_hash !== requestHash ||
        priorSession.status !== "pending" ||
        new Date(priorSession.expires_at).getTime() <= Date.now()) {
        return error("IDEMPOTENCY_CONFLICT", 409);
      }
      const response: UploadSessionResponse = {
        success: true,
        sessionId: priorSession.id,
        applicationReference: priorSession.application_reference,
        storageEndpoint: directStorageEndpoint(config.url),
        bucket: STORAGE_BUCKET,
        uploads: await withCompletedObjects(supabase, priorSession.upload_manifest),
      };
      return NextResponse.json(response);
    }

    const { data: allowed, error: rateError } = await supabase.rpc("check_affiliate_application_rate_limit", {
      p_origin_hash: rateLimitIdentifier(trustedRequestOrigin(request, proxyConfig.provider), rateConfig.secret),
      p_idempotency_hash: rateLimitIdentifier(application.idempotencyKey, rateConfig.secret),
      p_email_hash: rateLimitIdentifier(application.normalizedEmail, rateConfig.secret),
    });
    if (rateError || allowed !== true) return error(rateError ? "PERSISTENCE_UNAVAILABLE" : "RATE_LIMITED", rateError ? 503 : 429);

    const duplicateWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: duplicate, error: duplicateError } = await supabase
      .from("affiliate_applications")
      .select("id")
      .eq("normalized_gym_name", application.normalizedGymName)
      .eq("normalized_email", application.normalizedEmail)
      .neq("status", "rejected")
      .gte("created_at", duplicateWindow)
      .limit(1);
    if (duplicateError) return error("PERSISTENCE_UNAVAILABLE", 503);
    if (duplicate?.length) return error("DUPLICATE_SUBMISSION", 409);

    const expiredCleanup = await cleanupExpiredUploadSessions(supabase);
    if (expiredCleanup.failed) {
      logApplicationEvent("warn", { stage: "cleanup", code: "EXPIRED_UPLOAD_CLEANUP_FAILED" });
    }

    const applicationReference = reference(sessionId);
    const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_MS).toISOString();
    const { error: insertError } = await supabase.from("affiliate_application_upload_sessions").insert({
      id: sessionId,
      uploader_id: authData.user.id,
      application_reference: applicationReference,
      idempotency_key: application.idempotencyKey,
      request_hash: requestHash,
      form_payload: storedFormPayload,
      upload_manifest: uploads,
      expires_at: expiresAt,
    });
    if (insertError) return error("PERSISTENCE_UNAVAILABLE", 503);

    logApplicationEvent("info", {
      applicationReference,
      stage: "upload_session",
      code: "UPLOAD_SESSION_CREATED",
      durationMs: Date.now() - startedAt,
    });
    const response: UploadSessionResponse = {
      success: true,
      sessionId,
      applicationReference,
      storageEndpoint: directStorageEndpoint(config.url),
      bucket: STORAGE_BUCKET,
      uploads,
    };
    return NextResponse.json(response);
  } catch (caught) {
    if (caught instanceof ApplicationError) return error(caught.code, caught.status, caught.field);
    logApplicationEvent("error", { stage: "upload_session", code: "PERSISTENCE_UNAVAILABLE", durationMs: Date.now() - startedAt });
    return error("PERSISTENCE_UNAVAILABLE", 503);
  }
}
