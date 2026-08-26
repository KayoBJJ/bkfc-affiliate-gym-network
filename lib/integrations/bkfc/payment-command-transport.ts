import { randomUUID } from "node:crypto";
import { normalizeBkfcPaymentRequestBaseUrl } from "../../config/policy.ts";
import { canonicalJson, type CanonicalJson } from "./canonical-json.ts";

export type PaymentCommand = {
  command_id: string;
  application_id: string;
  command_type: "payment_initiation" | "payment_cancellation";
  payment_request_id: string;
  idempotency_key: string;
  payload: CanonicalJson;
  payload_hash: string;
  attempt_count: number;
  claim_token: string;
};

export type PaymentDeliveryResult = {
  disposition: "accepted" | "retry" | "intervention";
  requestId: string;
  httpStatus: number | null;
  errorCode: string | null;
  nextAttemptAt: string | null;
  outcome: string | null;
};

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const RETRY_DELAYS_SECONDS = [0, 60, 300, 1_800, 7_200, 21_600];
export const BKFC_PAYMENT_RESPONSE_MAX_BYTES = 16_384;

function machineCode(value: unknown) {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(value) ? value : null;
}

function responseCode(value: unknown) {
  return typeof value === "object" && value !== null && "code" in value
    ? machineCode((value as { code?: unknown }).code) : null;
}

function responseOutcome(value: unknown) {
  if (typeof value !== "object" || value === null || !("data" in value)) return null;
  const data = (value as { data?: unknown }).data;
  if (typeof data !== "object" || data === null || !("outcome" in data)) return null;
  const outcome = (data as { outcome?: unknown }).outcome;
  return typeof outcome === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(outcome) ? outcome : null;
}

function responseContractValid(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  if ("code" in value && responseCode(value) === null) return false;
  if ("data" in value) {
    const data = (value as { data?: unknown }).data;
    if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
    if ("outcome" in data && responseOutcome(value) === null) return false;
  }
  return true;
}

type BoundedResponseJson =
  | { kind: "empty" }
  | { kind: "valid"; value: object }
  | { kind: "invalid" | "oversized" };

function cancelResponseBody(body: ReadableStream<Uint8Array> | null) {
  if (!body) return;
  try { void body.cancel().catch(() => {}); } catch { /* rejection classification must not depend on cancellation */ }
}

async function boundedResponseJson(response: Response): Promise<BoundedResponseJson> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && /^[0-9]+$/.test(contentLength) && Number(contentLength) > BKFC_PAYMENT_RESPONSE_MAX_BYTES) {
    cancelResponseBody(response.body);
    return { kind: "oversized" };
  }
  if (!response.body) return { kind: "empty" };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > BKFC_PAYMENT_RESPONSE_MAX_BYTES - totalBytes) {
        try { void reader.cancel().catch(() => {}); } catch { /* preserve the bounded rejection */ }
        return { kind: "oversized" };
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } catch {
    return { kind: "invalid" };
  } finally {
    reader.releaseLock();
  }
  if (totalBytes === 0) return { kind: "empty" };
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return responseContractValid(value) ? { kind: "valid", value: value as object } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

function retryAfterSeconds(response: Response | undefined, now: Date) {
  const value = response?.headers.get("retry-after");
  if (!value) return null;
  if (/^[0-9]+$/.test(value)) return Math.min(Number(value), 21_600);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.min(Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 1000)), 21_600);
}

function retryResult(command: PaymentCommand, requestId: string, now: Date, response?: Response): PaymentDeliveryResult {
  if (command.attempt_count >= 6) {
    return { disposition: "intervention", requestId, httpStatus: response?.status ?? null,
      errorCode: response ? `HTTP_${response.status}` : "NETWORK_ERROR", nextAttemptAt: null, outcome: null };
  }
  const seconds = retryAfterSeconds(response, now) ??
    RETRY_DELAYS_SECONDS[Math.min(command.attempt_count, RETRY_DELAYS_SECONDS.length - 1)];
  return {
    disposition: "retry", requestId, httpStatus: response?.status ?? null,
    errorCode: response ? `HTTP_${response.status}` : "NETWORK_ERROR",
    nextAttemptAt: new Date(now.getTime() + seconds * 1000).toISOString(), outcome: null,
  };
}

export function paymentCommandUrl(baseUrl: string, command: PaymentCommand) {
  const approvedOrigin = normalizeBkfcPaymentRequestBaseUrl(baseUrl);
  const base = new URL(approvedOrigin);
  const application = encodeURIComponent(command.application_id);
  base.pathname = command.command_type === "payment_initiation"
    ? `/api/v1/integrations/eu/affiliate-applications/${application}/payment-requests`
    : `/api/v1/integrations/eu/affiliate-applications/${application}/payment-requests/${encodeURIComponent(command.payment_request_id)}/cancellations`;
  if (base.origin !== approvedOrigin) throw new Error("PAYMENT_COMMAND_DESTINATION_INVALID");
  return base.toString();
}

export async function deliverPaymentCommand(
  command: PaymentCommand,
  config: { baseUrl: string; bearerSecret: string },
  fetchImpl: typeof fetch,
  now = new Date(),
): Promise<PaymentDeliveryResult> {
  const requestId = randomUUID();
  let response: Response;
  try {
    response = await fetchImpl(paymentCommandUrl(config.baseUrl, command), {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.bearerSecret}`,
        "idempotency-key": command.idempotency_key,
        "x-request-id": requestId,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: canonicalJson(command.payload),
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
  } catch {
    return retryResult(command, requestId, now);
  }
  if (REDIRECT_STATUS.has(response.status)) {
    cancelResponseBody(response.body);
    return { disposition: "intervention", requestId, httpStatus: response.status,
      errorCode: `HTTP_${response.status}`, nextAttemptAt: null, outcome: null };
  }
  const parsed = await boundedResponseJson(response);
  const body: unknown = parsed.kind === "valid" ? parsed.value : null;
  const responseBodyError = parsed.kind === "oversized" ? "RESPONSE_TOO_LARGE" :
    parsed.kind === "invalid" ? "INVALID_RESPONSE" : null;
  const code = responseCode(body);
  const outcome = responseOutcome(body);
  const terminalRace = command.command_type === "payment_cancellation" &&
    response.status === 409 && code === "PAYMENT_ALREADY_COMPLETED";
  const cancellationWon = command.command_type === "payment_initiation" &&
    response.status === 409 && code === "PAYMENT_REQUEST_CANCELLED";
  if ((response.status === 200 || response.status === 202) && responseBodyError) {
    return { disposition: "intervention", requestId, httpStatus: response.status,
      errorCode: responseBodyError, nextAttemptAt: null, outcome: null };
  }
  if (response.status === 200 || response.status === 202 || terminalRace || cancellationWon) {
    return {
      disposition: "accepted", requestId, httpStatus: response.status,
      errorCode: terminalRace ? "PAYMENT_ALREADY_COMPLETED" : cancellationWon ? "PAYMENT_REQUEST_CANCELLED" : null,
      nextAttemptAt: null, outcome: cancellationWon ? "cancelled" : outcome,
    };
  }
  if (RETRYABLE_STATUS.has(response.status)) return retryResult(command, requestId, now, response);
  return { disposition: "intervention", requestId, httpStatus: response.status,
    errorCode: responseBodyError ?? code ?? `HTTP_${response.status}`, nextAttemptAt: null, outcome: null };
}
