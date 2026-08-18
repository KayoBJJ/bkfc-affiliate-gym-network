import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import {
  getApplicationPublicUrl,
  getProxyTrustConfig,
  getRateLimitConfig,
  getTurnstileConfig,
  isApplicantPortalEmailDeliveryEnabled,
  isApplicantCommunicationsEnabled,
  isApplicantPortalEnabled,
  isApplicantPortalRecoveryEnabled,
} from "@/lib/config/server";
import {
  APPLICATION_REFERENCE_PATTERN,
  APPLICANT_PORTAL_RECOVERY_VALID_MINUTES,
  generateApplicantPortalRecoveryToken,
  hashApplicantPortalRecoveryToken,
} from "@/lib/application/applicant-portal";
import { sendApplicantPortalRecoveryEmail } from "@/lib/application/applicant-portal-email";
import { logApplicationEvent } from "@/lib/application/logging";
import { ApplicationError, IDEMPOTENCY_KEY_PATTERN } from "@/lib/application/policy";
import { rateLimitIdentifier, trustedRequestOrigin } from "@/lib/application/rate-limit";
import { verifyTurnstileToken } from "@/lib/application/turnstile";
import { PORTAL_RECOVERY_TURNSTILE_ACTION } from "@/lib/application/turnstile-contract";

export const runtime = "nodejs";

const GENERIC_MESSAGE =
  "If the details match an application, a secure recovery email will arrive shortly.";
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]{2,}$/;

async function genericResponse(startedAt: number) {
  const minimumDurationMs = 900 + Math.floor(Math.random() * 150);
  const remainingMs = minimumDurationMs - (Date.now() - startedAt);
  if (remainingMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }
  return NextResponse.json(
    { success: true, message: GENERIC_MESSAGE },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  if (
    !isApplicantCommunicationsEnabled() ||
    !isApplicantPortalEnabled() ||
    !isApplicantPortalRecoveryEnabled() ||
    !isApplicantPortalEmailDeliveryEnabled()
  ) {
    return NextResponse.json({ success: false, code: "NOT_FOUND" }, { status: 404 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 16 * 1024) {
    return NextResponse.json({ success: false, code: "REQUEST_TOO_LARGE" }, { status: 413 });
  }

  try {
    const body = await request.json() as {
      applicationReference?: unknown;
      email?: unknown;
      idempotencyKey?: unknown;
      turnstileToken?: unknown;
    };
    if (
      typeof body.idempotencyKey !== "string" ||
      !IDEMPOTENCY_KEY_PATTERN.test(body.idempotencyKey)
    ) {
      return NextResponse.json(
        { success: false, code: "VALIDATION_FAILED" },
        { status: 400 },
      );
    }
    const proxy = getProxyTrustConfig();
    const origin = trustedRequestOrigin(request, proxy.provider);
    await verifyTurnstileToken(
      {
        token: body.turnstileToken,
        remoteIp: origin,
        idempotencyKey: body.idempotencyKey,
        requestHostname: new URL(request.url).hostname,
        expectedAction: PORTAL_RECOVERY_TURNSTILE_ACTION,
      },
      getTurnstileConfig(),
    );

    const applicationReference =
      typeof body.applicationReference === "string"
        ? body.applicationReference.trim().toLocaleUpperCase("en-US")
        : "";
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLocaleLowerCase("en-US")
        : "";
    if (
      !APPLICATION_REFERENCE_PATTERN.test(applicationReference) ||
      !EMAIL_PATTERN.test(email) ||
      email.length > 254
    ) {
      return await genericResponse(startedAt);
    }

    const token = generateApplicantPortalRecoveryToken();
    const tokenHash = hashApplicantPortalRecoveryToken(token);
    if (!tokenHash) return await genericResponse(startedAt);
    const expiresAt = new Date(
      Date.now() + APPLICANT_PORTAL_RECOVERY_VALID_MINUTES * 60 * 1000,
    ).toISOString();
    const rateConfig = getRateLimitConfig();
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.rpc(
      "request_affiliate_application_portal_recovery",
      {
        p_application_reference: applicationReference,
        p_email: email,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
        p_origin_hash: rateLimitIdentifier(origin, rateConfig.secret),
        p_identity_hash: rateLimitIdentifier(
          `${applicationReference}.${email}`,
          rateConfig.secret,
        ),
      },
    );
    if (error) {
      logApplicationEvent("warn", {
        stage: "portal_recovery",
        code: "PORTAL_RECOVERY_UNAVAILABLE",
        durationMs: Date.now() - startedAt,
      });
      return await genericResponse(startedAt);
    }
    const recovery = Array.isArray(data) ? data[0] : data;
    if (
      !recovery ||
      recovery.rate_limited ||
      !recovery.recovery_id ||
      !recovery.application_id
    ) {
      return await genericResponse(startedAt);
    }

    const outcome = await sendApplicantPortalRecoveryEmail({
      application: {
        applicationReference: recovery.application_reference,
        contactPerson: recovery.contact_person,
        email: recovery.email,
        gymName: recovery.gym_name,
      },
      recoveryUrl: new URL(
        `/application-progress/recover/${token}`,
        `${getApplicationPublicUrl()}/`,
      ).toString(),
    });
    const { error: completionError } = await supabase.rpc(
      "complete_affiliate_application_portal_recovery_delivery",
      {
        p_recovery_id: recovery.recovery_id,
        p_succeeded: outcome.status === "sent",
        p_provider_message_id:
          outcome.status === "sent" ? outcome.providerMessageId : null,
        p_error_code: outcome.status === "failed" ? outcome.errorCode : null,
      },
    );
    if (completionError) {
      logApplicationEvent("warn", {
        stage: "portal_recovery",
        code: "PORTAL_RECOVERY_FINALIZE_FAILED",
        durationMs: Date.now() - startedAt,
      });
      return await genericResponse(startedAt);
    }
    logApplicationEvent("info", {
      stage: "portal_recovery",
      code:
        outcome.status === "sent"
          ? "PORTAL_RECOVERY_EMAIL_SENT"
          : "PORTAL_RECOVERY_EMAIL_FAILED",
      durationMs: Date.now() - startedAt,
    });
    return await genericResponse(startedAt);
  } catch (caught) {
    if (caught instanceof ApplicationError) {
      logApplicationEvent("warn", {
        stage: "portal_recovery_turnstile",
        code: caught.code,
        field: caught.field,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { success: false, code: caught.code },
        { status: caught.status, headers: { "cache-control": "no-store" } },
      );
    }
    logApplicationEvent("warn", {
      stage: "portal_recovery",
      code: "PORTAL_RECOVERY_REQUEST_REJECTED",
      durationMs: Date.now() - startedAt,
    });
    return await genericResponse(startedAt);
  }
}
