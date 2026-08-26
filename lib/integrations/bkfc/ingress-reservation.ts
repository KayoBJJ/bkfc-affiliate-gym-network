import { IntegrationError } from "./contracts.ts";

export const INGRESS_RESERVATION_LEASE_SECONDS = 120;
export const SUBMISSION_PREPARSE_ENFORCEMENT_RETRY_SECONDS = 5;
const MAX_SUBMISSION_PREPARSE_RETRY_SECONDS = 60;

export type IngressReservationDisposition =
  | "acquired"
  | "in_progress"
  | "completed"
  | "terminal_rejected"
  | "idempotency_conflict"
  | "source_conflict"
  | "rate_limited";

export type IngressReservation = {
  disposition: IngressReservationDisposition;
  reservation_id: string | null;
  claim_token: string | null;
  logical_request_id: string;
  reserved_application_id: string | null;
  reserved_application_reference: string | null;
  outcome_code: string | null;
  retry_after_seconds: number;
};

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { message?: string; details?: string } | null;
  }>;
};

export async function consumeSubmissionPreparseQuota(
  supabase: RpcClient,
  credentialFingerprint: string,
) {
  const { data, error } = await supabase.rpc(
    "consume_bkfc_submission_preparse_rate_limit_v1",
    { p_credential_fingerprint: credentialFingerprint },
  );
  const rows = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
  const result = rows[0] as Record<string, unknown> | undefined;
  const validShape = rows.length === 1 && result !== undefined &&
    Object.keys(result).sort().join(",") === "allowed,retry_after_seconds" &&
    typeof result.allowed === "boolean" &&
    Number.isInteger(result.retry_after_seconds) &&
    (result.allowed === true
      ? result.retry_after_seconds === 0
      : typeof result.retry_after_seconds === "number" &&
        result.retry_after_seconds >= 1 &&
        result.retry_after_seconds <= MAX_SUBMISSION_PREPARSE_RETRY_SECONDS);
  if (error || !validShape) {
    throw new IntegrationError(
      "PERSISTENCE_UNAVAILABLE",
      503,
      undefined,
      true,
      SUBMISSION_PREPARSE_ENFORCEMENT_RETRY_SECONDS,
    );
  }
  return {
    allowed: result.allowed as boolean,
    retryAfterSeconds: result.retry_after_seconds as number,
  };
}

export async function reserveIngress(
  supabase: RpcClient,
  input: {
    direction: "submission" | "callback";
    logicalRequestId: string;
    sourceApplicationId: string;
    payloadHash: string;
    credentialFingerprint: string;
    euApplicationId?: string;
    paymentRequestId?: string;
  },
) {
  const { data, error } = await supabase.rpc("reserve_bkfc_integration_ingress_v1", {
    p_direction: input.direction,
    p_logical_request_id: input.logicalRequestId,
    p_source_application_id: input.sourceApplicationId,
    p_payload_hash: input.payloadHash,
    p_credential_fingerprint: input.credentialFingerprint,
    p_eu_application_id: input.euApplicationId ?? null,
    p_payment_request_id: input.paymentRequestId ?? null,
    p_lease_seconds: INGRESS_RESERVATION_LEASE_SECONDS,
  });
  if (error) throw new IntegrationError("PERSISTENCE_UNAVAILABLE", 503, undefined, true);
  const reservation = (Array.isArray(data) ? data[0] : data) as IngressReservation | null;
  if (!reservation || ![
    "acquired", "in_progress", "completed", "terminal_rejected",
    "idempotency_conflict", "source_conflict", "rate_limited",
  ].includes(reservation.disposition) || !Number.isInteger(reservation.retry_after_seconds)) {
    throw new IntegrationError("PERSISTENCE_UNAVAILABLE", 503, undefined, true);
  }
  return reservation;
}

export function requireAcquiredReservation(reservation: IngressReservation) {
  if (reservation.disposition === "rate_limited") {
    throw new IntegrationError("RATE_LIMITED", 429, undefined, true,
      Math.max(1, reservation.retry_after_seconds));
  }
  if (reservation.disposition === "in_progress") {
    throw new IntegrationError("REQUEST_IN_PROGRESS", 409, undefined, true,
      Math.max(1, reservation.retry_after_seconds));
  }
  if (reservation.disposition === "idempotency_conflict") {
    throw new IntegrationError("IDEMPOTENCY_CONFLICT", 409);
  }
  if (reservation.disposition === "source_conflict") {
    throw new IntegrationError("BKFC_APPLICATION_ID_CONFLICT", 409);
  }
  if (reservation.disposition === "terminal_rejected") {
    const statusByCode: Record<string, number> = {
      DUPLICATE_SUBMISSION: 409,
      APPLICATION_NOT_FOUND: 404,
      PAYMENT_REQUEST_NOT_FOUND: 404,
      CORRELATION_CONFLICT: 409,
      PAYMENT_REQUEST_MISMATCH: 409,
    };
    const code = reservation.outcome_code ?? "PERSISTENCE_UNAVAILABLE";
    throw new IntegrationError(code, statusByCode[code] ?? 409);
  }
  if (reservation.disposition !== "acquired" || !reservation.reservation_id || !reservation.claim_token) {
    throw new IntegrationError("PERSISTENCE_UNAVAILABLE", 503, undefined, true);
  }
  return { reservationId: reservation.reservation_id, claimToken: reservation.claim_token };
}

export async function finalizeIngressReservation(
  supabase: RpcClient,
  input: {
    reservationId: string;
    claimToken: string;
    payloadHash: string;
    outcomeCode: string;
    terminal: boolean;
  },
) {
  const { data, error } = await supabase.rpc("finalize_bkfc_integration_ingress_reservation_v1", {
    p_reservation_id: input.reservationId,
    p_claim_token: input.claimToken,
    p_payload_hash: input.payloadHash,
    p_outcome_code: input.outcomeCode,
    p_terminal: input.terminal,
  });
  if (error || data !== true) throw new IntegrationError("PERSISTENCE_UNAVAILABLE", 503, undefined, true);
}
