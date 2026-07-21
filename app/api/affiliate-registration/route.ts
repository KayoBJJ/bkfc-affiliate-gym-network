import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getPrivilegedSupabaseConfig,
  getProxyTrustConfig,
  getRateLimitConfig,
} from "@/lib/config/server";
import { ConfigurationError, type ProxyProvider } from "@/lib/config/policy";
import { clientErrorPayload, validationDiagnostic } from "@/lib/application/diagnostics";
import { sendApplicationNotifications } from "@/lib/application/email";
import { logApplicationEvent } from "@/lib/application/logging";
import { removeRequestObjects, resolveIdempotency } from "@/lib/application/integrity";
import { runNonCriticalNotification } from "@/lib/application/staged";
import { rateLimitIdentifier, trustedRequestOrigin } from "@/lib/application/rate-limit";
import { buildLegacyFallbackLogEvent, compensateFailedInsert, insertApplicationCompatibly } from "@/lib/application/persistence";
import {
  ApplicationError,
  MAX_REQUEST_BYTES,
  STORAGE_BUCKET,
  type ApiCode,
} from "@/lib/application/policy";
import {
  validateApplicationForm,
  type ValidatedApplication,
  type ValidatedFile,
} from "@/lib/application/validation";

export const runtime = "nodejs";

type StorageObject = { path: string };

function createApplicationSupabaseClient(config: ReturnType<typeof getPrivilegedSupabaseConfig>) {
  return createClient<any>(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type ApplicationSupabaseClient = ReturnType<typeof createApplicationSupabaseClient>;

function jsonError(code: ApiCode, status: number, field?: string) {
  return NextResponse.json(clientErrorPayload(code, field), { status });
}

function success(applicationReference: string, reused = false) {
  return NextResponse.json({
    success: true,
    code: reused ? "APPLICATION_ALREADY_RECEIVED" : "APPLICATION_RECEIVED",
    applicationReference,
  });
}

function extractCountry(cityCountry: string) {
  const parts = cityCountry.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || cityCountry;
}

function getRegionFromCountry(country: string) {
  const value = country.toLocaleLowerCase("en-US");
  const regions: Record<string, string[]> = {
    Europe: ["bulgaria", "spain", "italy", "serbia", "poland", "germany", "france", "netherlands", "belgium", "romania", "greece", "hungary", "croatia", "montenegro", "albania", "north macedonia", "austria", "switzerland", "united kingdom", "ireland", "portugal"],
    MENA: ["uae", "united arab emirates", "saudi arabia", "qatar", "kuwait", "bahrain", "oman", "egypt", "morocco", "tunisia", "jordan", "lebanon"],
    LATAM: ["mexico", "brazil", "argentina", "colombia", "chile", "peru", "uruguay", "paraguay", "ecuador", "venezuela"],
    "North America": ["usa", "united states", "united states of america", "canada"],
  };
  return Object.entries(regions).find(([, countries]) => countries.includes(value))?.[0] ?? "Other";
}

function applicationReference(id: string) {
  return `BKFC-GYM-${id.replaceAll("-", "").slice(0, 12).toLocaleUpperCase("en-US")}`;
}

function generatedPath(applicationId: string, kind: "logo" | "gym-photos" | "fighter-list", file: ValidatedFile) {
  return `${applicationId}/${kind}/${randomUUID()}.${file.extension}`;
}

function contentType(extension: string) {
  return ({
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  } as Record<string, string>)[extension] || "application/octet-stream";
}

async function checkRateLimit(
  supabase: ApplicationSupabaseClient,
  request: Request,
  application: ValidatedApplication,
  rateSecret: string,
  proxyProvider: ProxyProvider,
) {
  const { data, error } = await supabase.rpc("check_affiliate_application_rate_limit", {
    p_origin_hash: rateLimitIdentifier(trustedRequestOrigin(request, proxyProvider), rateSecret),
    p_idempotency_hash: rateLimitIdentifier(application.idempotencyKey, rateSecret),
    p_email_hash: rateLimitIdentifier(application.normalizedEmail, rateSecret),
  });
  if (error) throw new Error("rate_limit_unavailable");
  if (data !== true) throw new ApplicationError("RATE_LIMITED", 429);
}

async function upload(
  supabase: ApplicationSupabaseClient,
  applicationId: string,
  kind: "logo" | "gym-photos" | "fighter-list",
  validatedFile: ValidatedFile,
  uploaded: StorageObject[],
) {
  const path = generatedPath(applicationId, kind, validatedFile);
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, validatedFile.file, {
    cacheControl: "3600",
    contentType: contentType(validatedFile.extension),
    upsert: false,
  });
  if (error) throw new Error("storage_upload_failed");
  uploaded.push({ path });
  return path;
}

async function cleanup(supabase: ApplicationSupabaseClient, uploaded: StorageObject[], reference: string) {
  const result = await removeRequestObjects(
    uploaded.map(({ path }) => path),
    (paths) => supabase.storage.from(STORAGE_BUCKET).remove(paths),
  );
  if (result === "not_required") return result;
  logApplicationEvent(result === "failed" ? "error" : "info", { applicationReference: reference, stage: "cleanup", code: result === "failed" ? "CLEANUP_FAILED" : "CLEANUP_SUCCEEDED", cleanup: result });
  return result;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return jsonError("REQUEST_TOO_LARGE", 413);

  let privilegedConfig: ReturnType<typeof getPrivilegedSupabaseConfig>;
  let rateConfig: ReturnType<typeof getRateLimitConfig>;
  let proxyConfig: ReturnType<typeof getProxyTrustConfig>;
  try {
    privilegedConfig = getPrivilegedSupabaseConfig();
    rateConfig = getRateLimitConfig();
    proxyConfig = getProxyTrustConfig();
  } catch (error) {
    const code = error instanceof ConfigurationError ? error.code : "CONFIG_SUPABASE_INVALID";
    logApplicationEvent("error", { stage: "configuration", code, durationMs: Date.now() - startedAt });
    return jsonError("VALIDATION_FAILED", 503);
  }
  if (!proxyConfig.valid) {
    logApplicationEvent("warn", { stage: "configuration", code: "CONFIG_PROXY_INVALID", durationMs: Date.now() - startedAt });
  }

  let application: ValidatedApplication;
  try {
    application = await validateApplicationForm(await request.formData());
  } catch (error) {
    if (error instanceof ApplicationError) {
      logApplicationEvent("warn", {
        stage: "validation",
        code: error.code,
        ...validationDiagnostic(error.field),
        durationMs: Date.now() - startedAt,
      });
      return jsonError(error.code, error.status, error.field);
    }
    logApplicationEvent("error", { stage: "validation", code: "VALIDATION_FAILED", durationMs: Date.now() - startedAt });
    return jsonError("VALIDATION_FAILED", 400);
  }

  const supabase = createApplicationSupabaseClient(privilegedConfig);
  const uploaded: StorageObject[] = [];
  const applicationId = randomUUID();
  const reference = applicationReference(applicationId);
  let storedReference = reference;
  let compatibilityMode: "full_schema" | "legacy_schema" = "full_schema";
  let insertCleanupPerformed = false;

  try {
    const { data: prior, error: priorError } = await supabase
      .from("affiliate_applications")
      .select("application_reference,payload_hash")
      .eq("idempotency_key", application.idempotencyKey)
      .maybeSingle();
    if (priorError) throw new Error("idempotency_lookup_failed");
    const idempotency = resolveIdempotency(prior ? { applicationReference: prior.application_reference, payloadHash: prior.payload_hash } : null, application.payloadHash);
    if (idempotency.outcome === "conflict") throw new ApplicationError("IDEMPOTENCY_CONFLICT", 409);
    if (idempotency.outcome === "reuse") return success(idempotency.applicationReference, true);

    await checkRateLimit(supabase, request, application, rateConfig.secret, proxyConfig.provider);

    const duplicateWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: duplicate, error: duplicateError } = await supabase
      .from("affiliate_applications")
      .select("id")
      .eq("normalized_gym_name", application.normalizedGymName)
      .eq("normalized_email", application.normalizedEmail)
      .neq("status", "rejected")
      .gte("created_at", duplicateWindow)
      .limit(1);
    if (duplicateError) throw new Error("duplicate_lookup_failed");
    if (duplicate?.length) throw new ApplicationError("DUPLICATE_SUBMISSION", 409);

    const logoPath = await upload(supabase, applicationId, "logo", application.logo, uploaded);
    const gymPhotoPaths: string[] = [];
    for (const photo of application.gymPhotos) gymPhotoPaths.push(await upload(supabase, applicationId, "gym-photos", photo, uploaded));
    const fighterListPath = application.fighterList ? await upload(supabase, applicationId, "fighter-list", application.fighterList, uploaded) : null;
    const country = extractCountry(application.cityCountry);

    const insertResult = await compensateFailedInsert(await insertApplicationCompatibly({
      id: applicationId,
      applicationReference: reference,
      idempotencyKey: application.idempotencyKey,
      payloadHash: application.payloadHash,
      normalizedGymName: application.normalizedGymName,
      normalizedEmail: application.normalizedEmail,
      gymName: application.gymName,
      cityCountry: application.cityCountry,
      country,
      region: getRegionFromCountry(country),
      contactPerson: application.contactPerson,
      email: application.email,
      phone: application.phone,
      websiteInstagram: application.websiteInstagram,
      disciplinesOffered: application.disciplinesOffered,
      logoPath,
      gymPhotoPaths,
      fighterListPath,
      promoVideoLink: application.promoVideoLink,
      reviewConsent: application.reviewConsent,
      followUpConsent: application.followUpConsent,
      bkfcAppAccessInterest: application.bkfcAppAccessInterest,
    }, async (payload) => {
      const { error } = await supabase.from("affiliate_applications").insert(payload);
      return { error };
    }), async () => {
      insertCleanupPerformed = true;
      await cleanup(supabase, uploaded, reference);
    });
    compatibilityMode = insertResult.compatibilityMode;
    if (insertResult.fallbackTrigger) {
      logApplicationEvent("warn", buildLegacyFallbackLogEvent(
        insertResult.fallbackTrigger,
        Date.now() - startedAt,
      ));
    }
    const insertError = insertResult.error;
    if (insertError) {
      if (insertError.code === "23505" && compatibilityMode === "full_schema") {
        const { data: raced } = await supabase.from("affiliate_applications").select("application_reference,payload_hash").eq("idempotency_key", application.idempotencyKey).maybeSingle();
        if (raced?.payload_hash === application.payloadHash) return success(raced.application_reference, true);
        throw new ApplicationError("IDEMPOTENCY_CONFLICT", 409);
      }
      throw new Error("database_insert_failed");
    }
    storedReference = insertResult.storedReference ?? applicationId;
    logApplicationEvent("info", {
      applicationReference: storedReference,
      stage: "persistence",
      code: "APPLICATION_PERSISTED",
      compatibilityMode,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    if (!insertCleanupPerformed) await cleanup(supabase, uploaded, reference);
    if (error instanceof ApplicationError) {
      logApplicationEvent("warn", { applicationReference: reference, stage: "persistence", code: error.code, compatibilityMode, durationMs: Date.now() - startedAt });
      return jsonError(error.code, error.status, error.field);
    }
    logApplicationEvent("error", { applicationReference: reference, stage: "persistence", code: "PERSISTENCE_UNAVAILABLE", compatibilityMode, durationMs: Date.now() - startedAt });
    return jsonError("PERSISTENCE_UNAVAILABLE", 503);
  }

  const notificationResult = await runNonCriticalNotification(() =>
    sendApplicationNotifications({
      applicationReference: storedReference,
      gymName: application.gymName,
      cityCountry: application.cityCountry,
      contactPerson: application.contactPerson,
      email: application.email,
      phone: application.phone,
      websiteInstagram: application.websiteInstagram,
      disciplinesOffered: application.disciplinesOffered,
      promoVideoLink: application.promoVideoLink,
      bkfcAppAccessInterest: application.bkfcAppAccessInterest,
      reviewConsent: application.reviewConsent,
      followUpConsent: application.followUpConsent,
      facilityPhotoCount: application.gymPhotos.length,
      fighterListSupplied: Boolean(application.fighterList),
    }),
  );
  if (notificationResult === "failed") {
    logApplicationEvent("warn", { applicationReference: storedReference, stage: "notification", code: "EMAIL_NOTIFICATION_FAILED", notification: "failed" });
  }

  logApplicationEvent("info", { applicationReference: storedReference, stage: "complete", code: "APPLICATION_RECEIVED", compatibilityMode, durationMs: Date.now() - startedAt });
  return success(storedReference);
}
