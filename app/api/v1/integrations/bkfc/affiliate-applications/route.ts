import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getBkfcIntegrationConfig, getPrivilegedSupabaseConfig } from "@/lib/config/server";
import {
  IntegrationError, integrationErrorResponse, safeIntegrationLog, UUID_V4_PATTERN,
} from "@/lib/integrations/bkfc/http";
import {
  compatibilityLocation, compatibilityWebsite,
  normalizedDuplicateIdentity, validateBkfcSubmission,
} from "@/lib/integrations/bkfc/submission";
import { STORAGE_BUCKET } from "@/lib/application/policy";
import { getApplicationRegion } from "@/lib/application/region";
import { removeUploadedLogo } from "@/lib/integrations/bkfc/logo-compensation";
import {
  finalizeIngressReservation, requireAcquiredReservation, reserveIngress,
} from "@/lib/integrations/bkfc/ingress-reservation";
import { parseBkfcSubmissionIngress } from "@/lib/integrations/bkfc/submission-ingress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoredApplication = {
  id: string;
  application_reference: string;
  source_application_id: string;
  submitted_at: string;
  review_stage: string;
  status: string;
  payload_hash: string;
  payment_status?: string;
  affiliate_application_payment_coordination: { payment_status: string } | { payment_status: string }[] | null;
};

function client() {
  const config = getPrivilegedSupabaseConfig();
  return createClient<any>(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function responseData(row: StoredApplication) {
  const coordination = Array.isArray(row.affiliate_application_payment_coordination)
    ? row.affiliate_application_payment_coordination[0]
    : row.affiliate_application_payment_coordination;
  return {
    applicationId: row.id,
    applicationReference: row.application_reference,
    bkfcApplicationId: row.source_application_id,
    submittedAt: row.submitted_at,
    reviewStage: row.review_stage,
    status: row.status,
    paymentStatus: row.payment_status ?? coordination?.payment_status ?? "not_requested",
  };
}

function success(row: StoredApplication, requestId: string, reused: boolean) {
  return NextResponse.json({
    success: true,
    code: reused ? "APPLICATION_ALREADY_RECEIVED" : "APPLICATION_RECEIVED",
    requestId,
    reused,
    data: responseData(row),
  }, {
    status: reused ? 200 : 201,
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  });
}

function integrationFailure(error: unknown, requestId: string) {
  if (error instanceof IntegrationError) return integrationErrorResponse(error, requestId);
  safeIntegrationLog({ stage: "submission", code: "PERSISTENCE_UNAVAILABLE", requestId });
  return integrationErrorResponse(new IntegrationError("PERSISTENCE_UNAVAILABLE", 503, undefined, true), requestId);
}

export async function POST(request: Request) {
  const headerRequestId = request.headers.get("x-request-id") ?? "";
  const requestId = UUID_V4_PATTERN.test(headerRequestId) ? headerRequestId : randomUUID();
  let uploadedPath: string | null = null;
  let supabase: ReturnType<typeof client> | null = null;
  let activeReservation: { reservationId: string; claimToken: string; payloadHash: string } | null = null;
  let caughtError: unknown;
  try {
    const config = getBkfcIntegrationConfig();
    if (!config.submissionEnabled) throw new IntegrationError("INTEGRATION_DISABLED", 403);
    const { authentication, idempotencyKey, bkfcApplicationId, form } = await parseBkfcSubmissionIngress(request, {
      requestId: headerRequestId,
      bearerSecrets: config.bkfcToEuSecrets,
    });
    const submission = await validateBkfcSubmission({
      form, bkfcApplicationId, idempotencyKey, requestId,
      consentNoticeVersionAllowlist: config.consentNoticeVersionAllowlist,
    });
    supabase = client();
    const selection = "id,application_reference,source_application_id,submitted_at,review_stage,status,payload_hash,affiliate_application_payment_coordination(payment_status)";
    const reservation = await reserveIngress(supabase, {
      direction: "submission",
      logicalRequestId: submission.idempotencyKey,
      sourceApplicationId: submission.bkfcApplicationId,
      payloadHash: submission.payloadHash,
      credentialFingerprint: authentication.credentialFingerprint,
    });
    if (reservation.disposition === "completed") {
      if (!reservation.reserved_application_id) throw new Error("REPLAY_RESULT_MISSING");
      const { data: replay, error: replayError } = await supabase.from("affiliate_applications")
        .select(selection).eq("id", reservation.reserved_application_id).maybeSingle();
      if (replayError || !replay) throw new Error("REPLAY_RESULT_MISSING");
      return success(replay as StoredApplication, requestId, true);
    }
    const acquired = requireAcquiredReservation(reservation);
    activeReservation = { ...acquired, payloadHash: submission.payloadHash };

    const duplicateWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: duplicate, error: duplicateError } = await supabase
      .from("affiliate_applications").select("id")
      .eq("normalized_gym_name", normalizedDuplicateIdentity(submission.gymName))
      .eq("normalized_email", normalizedDuplicateIdentity(submission.email))
      .neq("status", "rejected").gte("created_at", duplicateWindow).limit(1);
    if (duplicateError) throw new Error("DUPLICATE_LOOKUP_FAILED");
    if (duplicate?.length) {
      await finalizeIngressReservation(supabase, {
        ...activeReservation, outcomeCode: "DUPLICATE_SUBMISSION", terminal: true,
      });
      activeReservation = null;
      throw new IntegrationError("DUPLICATE_SUBMISSION", 409);
    }

    const applicationId = reservation.reserved_application_id;
    if (!applicationId) throw new Error("RESERVED_APPLICATION_ID_MISSING");
    const objectPath = `${applicationId}/logo/${randomUUID()}.${submission.logo.extension}`;
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(
      objectPath, submission.logo.file,
      { cacheControl: "3600", contentType: submission.logo.mediaType, upsert: false },
    );
    if (uploadError) throw new IntegrationError("STORAGE_UNAVAILABLE", 503, undefined, true);
    uploadedPath = objectPath;

    const { data, error } = await supabase.rpc("create_bkfc_affiliate_application_v1", {
      p_reservation_id: activeReservation.reservationId,
      p_claim_token: activeReservation.claimToken,
      p_idempotency_key: reservation.logical_request_id,
      p_payload_hash: submission.payloadHash,
      p_source_application_id: submission.bkfcApplicationId,
      p_ingest_request_id: submission.requestId,
      p_gym_name: submission.gymName,
      p_contact_person: submission.contactPerson,
      p_street_address: submission.address,
      p_city: submission.city,
      p_administrative_region: submission.state,
      p_postal_code: submission.postalCode,
      p_country: submission.country,
      p_email: submission.email,
      p_phone: submission.phone,
      p_website: submission.website,
      p_instagram: submission.instagram,
      p_disciplines_offered: submission.disciplines.join(", "),
      p_promo_video_link: submission.promoVideoLink,
      p_plan_code: submission.plan,
      p_bkfc_app_access_interest: submission.bkfcAppAccessInterest,
      p_review_consent: true,
      p_follow_up_consent: submission.followUpConsent,
      p_consent_notice_version: submission.consentNoticeVersion,
      p_logo_path: objectPath,
      p_logo_content_type: submission.logo.mediaType,
      p_logo_size_bytes: submission.logo.sizeBytes,
      p_logo_sha256: submission.logo.sha256,
      p_city_country: compatibilityLocation(submission.city, submission.state, submission.country),
      p_website_instagram: compatibilityWebsite(submission.website, submission.instagram),
      p_region: getApplicationRegion(submission.country),
      p_normalized_gym_name: normalizedDuplicateIdentity(submission.gymName),
      p_normalized_email: normalizedDuplicateIdentity(submission.email),
    });
    if (error) {
      if (["IDEMPOTENCY_CONFLICT", "BKFC_APPLICATION_ID_CONFLICT", "DUPLICATE_SUBMISSION"]
        .includes(error.message)) {
        await finalizeIngressReservation(supabase, {
          ...activeReservation, outcomeCode: error.message, terminal: true,
        });
        activeReservation = null;
        throw new IntegrationError(error.message, 409);
      }
      throw new Error("CREATE_FAILED");
    }
    const created = (Array.isArray(data) ? data[0] : data) as StoredApplication & { reused?: boolean };
    if (!created) throw new Error("CREATE_RESULT_MISSING");
    activeReservation = null;
    uploadedPath = null;
    safeIntegrationLog({ stage: "submission", code: "APPLICATION_RECEIVED", requestId, applicationId: created.id });
    return success(created, requestId, false);
  } catch (error) {
    caughtError = error;
    if (activeReservation && supabase) {
      try {
        await finalizeIngressReservation(supabase, {
          ...activeReservation,
          outcomeCode: error instanceof IntegrationError ? error.code : "PERSISTENCE_UNAVAILABLE",
          terminal: false,
        });
      } catch (reservationError) {
        caughtError = reservationError;
      }
    }
    if (uploadedPath && supabase) {
      await removeUploadedLogo(
        () => supabase!.storage.from(STORAGE_BUCKET).remove([uploadedPath!]),
        safeIntegrationLog,
        requestId,
      );
    }
    return integrationFailure(caughtError, requestId);
  }
}
