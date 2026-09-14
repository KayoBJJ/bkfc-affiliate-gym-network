import { canonicalSha256, utcMilliseconds, type CanonicalJson } from "./canonical-json.ts";
import { BKFC_APPLICATION_ID_PATTERN, IntegrationError, UUID_V4_PATTERN } from "./contracts.ts";

export const PAYMENT_STATUS_BODY_MAX_BYTES = 32_768;
export const PAYMENT_EVENT_TYPES = [
  "payment_link_sent", "payment_paid", "payment_cancelled", "payment_refunded",
  "payment_initiation_failed", "renewal_paid", "renewal_past_due", "subscription_cancelled",
] as const;
export type PaymentEventType = typeof PAYMENT_EVENT_TYPES[number];

export type ValidatedPaymentStatusEvent = {
  contractVersion: 1;
  eventId: string;
  paymentRequestId: string;
  bkfcApplicationId: string;
  euApplicationId: string;
  eventType: PaymentEventType;
  occurredAt: string;
  reasonCode: string | null;
  payloadHash: string;
  canonicalPayload: CanonicalJson;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePaymentStatusEvent(value: unknown, pathApplicationId: string, now = new Date()): ValidatedPaymentStatusEvent {
  if (!record(value)) throw new IntegrationError("VALIDATION_FAILED", 400);
  const allowed = new Set(["contractVersion", "eventId", "paymentRequestId", "bkfcApplicationId", "euApplicationId", "eventType", "occurredAt", "reasonCode"]);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) throw new IntegrationError("UNEXPECTED_FIELD", 400,
    /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(unknown) ? unknown : "unknownField");
  if (value.contractVersion !== 1) throw new IntegrationError("VALIDATION_FAILED", 400, "contractVersion");
  for (const key of ["eventId", "paymentRequestId", "euApplicationId"] as const) {
    if (typeof value[key] !== "string" || !UUID_V4_PATTERN.test(value[key])) {
      throw new IntegrationError("VALIDATION_FAILED", 400, key);
    }
  }
  if (!UUID_V4_PATTERN.test(pathApplicationId) || value.euApplicationId !== pathApplicationId) {
    throw new IntegrationError("CORRELATION_CONFLICT", 409, "euApplicationId");
  }
  if (typeof value.bkfcApplicationId !== "string" || !BKFC_APPLICATION_ID_PATTERN.test(value.bkfcApplicationId)) {
    throw new IntegrationError("VALIDATION_FAILED", 400, "bkfcApplicationId");
  }
  if (typeof value.eventType !== "string" || !PAYMENT_EVENT_TYPES.includes(value.eventType as PaymentEventType)) {
    throw new IntegrationError("VALIDATION_FAILED", 400, "eventType");
  }
  if (typeof value.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value.occurredAt)) {
    throw new IntegrationError("INVALID_TIMESTAMP", 400, "occurredAt");
  }
  let occurredAt: string;
  try { occurredAt = utcMilliseconds(value.occurredAt); } catch {
    throw new IntegrationError("INVALID_TIMESTAMP", 400, "occurredAt");
  }
  if (new Date(occurredAt).getTime() > now.getTime() + 5 * 60_000) {
    throw new IntegrationError("INVALID_TIMESTAMP", 400, "occurredAt");
  }
  if (value.reasonCode !== null && typeof value.reasonCode !== "undefined" &&
    (typeof value.reasonCode !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(value.reasonCode))) {
    throw new IntegrationError("VALIDATION_FAILED", 400, "reasonCode");
  }
  const canonicalPayload: CanonicalJson = {
    contractVersion: 1,
    eventId: value.eventId as string,
    paymentRequestId: value.paymentRequestId as string,
    bkfcApplicationId: value.bkfcApplicationId,
    euApplicationId: value.euApplicationId as string,
    eventType: value.eventType,
    occurredAt,
    reasonCode: (value.reasonCode as string | null | undefined) ?? null,
  };
  return {
    ...canonicalPayload as Omit<ValidatedPaymentStatusEvent, "payloadHash" | "canonicalPayload">,
    payloadHash: canonicalSha256(canonicalPayload), canonicalPayload,
  };
}
