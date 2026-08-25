import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getBkfcIntegrationConfig, getPrivilegedSupabaseConfig } from "@/lib/config/server";
import { authenticateBearer } from "@/lib/integrations/bkfc/auth";
import {
  IntegrationError, integrationErrorResponse, parseRequiredContentLength,
  requireJsonAccept, safeIntegrationLog, UUID_V4_PATTERN,
} from "@/lib/integrations/bkfc/http";
import {
  PAYMENT_STATUS_BODY_MAX_BYTES, validatePaymentStatusEvent,
} from "@/lib/integrations/bkfc/payment-status";
import {
  finalizeIngressReservation, requireAcquiredReservation, reserveIngress,
} from "@/lib/integrations/bkfc/ingress-reservation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: { euApplicationId: string } };

export async function POST(request: Request, { params }: Context) {
  const suppliedRequestId = request.headers.get("x-request-id") ?? "";
  const requestId = UUID_V4_PATTERN.test(suppliedRequestId) ? suppliedRequestId : randomUUID();
  let activeReservation: { reservationId: string; claimToken: string; payloadHash: string } | null = null;
  let reservationClient: any = null;
  let caughtError: unknown;
  try {
    const integration = getBkfcIntegrationConfig();
    if (!integration.paymentCallbackEnabled) throw new IntegrationError("INTEGRATION_DISABLED", 403);
    const authentication = authenticateBearer(request.headers.get("authorization"), integration.bkfcToEuSecrets);
    if (!authentication.authorized) {
      throw new IntegrationError("UNAUTHORIZED", 401);
    }
    if (!UUID_V4_PATTERN.test(suppliedRequestId)) throw new IntegrationError("VALIDATION_FAILED", 400, "X-Request-ID");
    requireJsonAccept(request.headers);
    parseRequiredContentLength(request.headers, PAYMENT_STATUS_BODY_MAX_BYTES);
    if (request.headers.get("content-type")?.toLocaleLowerCase("en-US") !== "application/json") {
      throw new IntegrationError("UNSUPPORTED_MEDIA_TYPE", 415, "Content-Type");
    }
    let raw: unknown;
    try { raw = await request.json(); } catch { throw new IntegrationError("VALIDATION_FAILED", 400); }
    const event = validatePaymentStatusEvent(raw, params.euApplicationId);
    if (request.headers.get("idempotency-key") !== event.eventId) {
      throw new IntegrationError("VALIDATION_FAILED", 400, "Idempotency-Key");
    }
    const config = getPrivilegedSupabaseConfig();
    const supabase = createClient<any>(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    reservationClient = supabase;
    const { data: existing, error: replayError } = await supabase
      .from("affiliate_application_payment_status_events")
      .select("external_event_id,application_id,payment_request_id,bkfc_application_id,payload_hash,resulting_status,applied,not_applied_reason")
      .eq("external_event_id", event.eventId)
      .maybeSingle();
    if (replayError) throw new IntegrationError("PERSISTENCE_UNAVAILABLE", 503, undefined, true);
    if (existing) {
      if (existing.payload_hash !== event.payloadHash) throw new IntegrationError("IDEMPOTENCY_CONFLICT", 409);
      if (existing.application_id !== event.euApplicationId || existing.payment_request_id !== event.paymentRequestId ||
        existing.bkfc_application_id !== event.bkfcApplicationId) {
        throw new IntegrationError("CORRELATION_CONFLICT", 409);
      }
      return NextResponse.json({
        success: true, code: "PAYMENT_STATUS_EVENT_ALREADY_ACCEPTED", requestId, reused: true,
        data: {
          eventId: event.eventId,
          euApplicationId: event.euApplicationId,
          paymentRequestId: event.paymentRequestId,
          paymentStatus: existing.resulting_status,
          applied: existing.applied,
          ...(existing.not_applied_reason ? { notAppliedReason: existing.not_applied_reason } : {}),
        },
      }, { status: 200, headers: { "cache-control": "no-store", "x-request-id": requestId } });
    }
    const reservation = await reserveIngress(supabase, {
      direction: "callback",
      logicalRequestId: event.eventId,
      sourceApplicationId: event.bkfcApplicationId,
      payloadHash: event.payloadHash,
      credentialFingerprint: authentication.credentialFingerprint,
      euApplicationId: event.euApplicationId,
      paymentRequestId: event.paymentRequestId,
    });
    if (reservation.disposition === "completed") {
      const { data: replay, error: replayError } = await supabase
        .from("affiliate_application_payment_status_events")
        .select("external_event_id,application_id,payment_request_id,bkfc_application_id,payload_hash,resulting_status,applied,not_applied_reason")
        .eq("external_event_id", event.eventId)
        .maybeSingle();
      if (replayError || !replay || replay.payload_hash !== event.payloadHash ||
        replay.application_id !== event.euApplicationId ||
        replay.payment_request_id !== event.paymentRequestId ||
        replay.bkfc_application_id !== event.bkfcApplicationId) {
        throw new IntegrationError("PERSISTENCE_UNAVAILABLE", 503, undefined, true);
      }
      return NextResponse.json({
        success: true, code: "PAYMENT_STATUS_EVENT_ALREADY_ACCEPTED", requestId, reused: true,
        data: {
          eventId: event.eventId,
          euApplicationId: event.euApplicationId,
          paymentRequestId: event.paymentRequestId,
          paymentStatus: replay.resulting_status,
          applied: replay.applied,
          ...(replay.not_applied_reason ? { notAppliedReason: replay.not_applied_reason } : {}),
        },
      }, { status: 200, headers: { "cache-control": "no-store", "x-request-id": requestId } });
    }
    const acquired = requireAcquiredReservation(reservation);
    activeReservation = { ...acquired, payloadHash: event.payloadHash };
    const { data, error } = await supabase.rpc("record_bkfc_payment_status_event_v1", {
      p_external_event_id: event.eventId,
      p_application_id: event.euApplicationId,
      p_payment_request_id: event.paymentRequestId,
      p_bkfc_application_id: event.bkfcApplicationId,
      p_event_type: event.eventType,
      p_occurred_at: event.occurredAt,
      p_reason_code: event.reasonCode,
      p_payload_hash: event.payloadHash,
      p_request_id: requestId,
      p_reservation_id: activeReservation.reservationId,
      p_claim_token: activeReservation.claimToken,
    });
    if (error) {
      const mapping: Record<string, [string, number]> = {
        IDEMPOTENCY_CONFLICT: ["IDEMPOTENCY_CONFLICT", 409],
        APPLICATION_NOT_FOUND: ["APPLICATION_NOT_FOUND", 404],
        PAYMENT_REQUEST_NOT_FOUND: ["PAYMENT_REQUEST_NOT_FOUND", 404],
        CORRELATION_CONFLICT: ["CORRELATION_CONFLICT", 409],
        PAYMENT_REQUEST_MISMATCH: ["PAYMENT_REQUEST_MISMATCH", 409],
      };
      const mapped = mapping[error.message];
      if (mapped) {
        await finalizeIngressReservation(supabase, {
          ...activeReservation, outcomeCode: mapped[0], terminal: true,
        });
        activeReservation = null;
        throw new IntegrationError(mapped[0], mapped[1]);
      }
      throw new IntegrationError("PERSISTENCE_UNAVAILABLE", 503, undefined, true);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new IntegrationError("PERSISTENCE_UNAVAILABLE", 503, undefined, true);
    activeReservation = null;
    const reused = Boolean(result.reused);
    const applied = Boolean(result.applied);
    const code = reused
      ? "PAYMENT_STATUS_EVENT_ALREADY_ACCEPTED"
      : applied ? "PAYMENT_STATUS_EVENT_ACCEPTED" : "PAYMENT_STATUS_EVENT_RECORDED";
    safeIntegrationLog({ stage: "payment_callback", code, requestId, applicationId: event.euApplicationId, eventId: event.eventId });
    return NextResponse.json({
      success: true, code, requestId, reused,
      data: {
        eventId: event.eventId,
        euApplicationId: event.euApplicationId,
        paymentRequestId: event.paymentRequestId,
        paymentStatus: result.payment_status,
        applied,
        ...(result.not_applied_reason ? { notAppliedReason: result.not_applied_reason } : {}),
      },
    }, { status: 200, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    caughtError = error;
    if (activeReservation && reservationClient) {
      try {
        await finalizeIngressReservation(reservationClient, {
          ...activeReservation,
          outcomeCode: error instanceof IntegrationError ? error.code : "PERSISTENCE_UNAVAILABLE",
          terminal: false,
        });
      } catch (reservationError) {
        caughtError = reservationError;
      }
    }
    if (caughtError instanceof IntegrationError) return integrationErrorResponse(caughtError, requestId);
    safeIntegrationLog({ stage: "payment_callback", code: "INTERNAL_ERROR", requestId });
    return integrationErrorResponse(new IntegrationError("INTERNAL_ERROR", 500, undefined, true), requestId);
  }
}
