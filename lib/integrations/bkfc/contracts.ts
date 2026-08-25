export const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const BKFC_APPLICATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export class IntegrationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field?: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;

  constructor(code: string, status: number, field?: string, retryable = false, retryAfterSeconds?: number) {
    super(code);
    this.name = "IntegrationError";
    this.code = code;
    this.status = status;
    this.field = field;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function integrationErrorPayload(error: IntegrationError, requestId: string) {
  return {
    success: false as const,
    code: error.code,
    requestId,
    retryable: error.retryable,
    ...(error.field ? { field: error.field } : {}),
  };
}

export function integrationErrorHeaders(error: IntegrationError, requestId: string) {
  return {
    "cache-control": "no-store",
    "x-request-id": requestId,
    ...(error.retryAfterSeconds === undefined ? {} : { "retry-after": String(error.retryAfterSeconds) }),
  };
}

export function parseRequiredContentLength(headers: Headers, maximum: number) {
  const raw = headers.get("content-length");
  if (raw === null) throw new IntegrationError("LENGTH_REQUIRED", 411, "Content-Length");
  if (!/^[1-9][0-9]*$/.test(raw)) throw new IntegrationError("VALIDATION_FAILED", 400, "Content-Length");
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new IntegrationError("REQUEST_TOO_LARGE", 413);
  if (value > maximum) throw new IntegrationError("REQUEST_TOO_LARGE", 413);
  return value;
}
