import { authenticateBearer, type BearerAuthentication } from "./auth.ts";
import {
  IntegrationError, parseRequiredContentLength, UUID_V4_PATTERN,
} from "./contracts.ts";
import { BKFC_SUBMISSION_MAX_BYTES } from "./submission.ts";

export type SubmissionPreparseQuotaDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try { void reader.cancel().catch(() => {}); } catch { /* cancellation is best-effort after a terminal rejection */ }
}

export async function readBoundedRequestBody(request: Request, maximumBytes: number) {
  if (!request.body) throw new IntegrationError("VALIDATION_FAILED", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > maximumBytes - totalBytes) {
        cancelReader(reader);
        throw new IntegrationError("REQUEST_TOO_LARGE", 413);
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function parseBoundedMultipart(request: Request, contentType: string) {
  const body = await readBoundedRequestBody(request, BKFC_SUBMISSION_MAX_BYTES);
  try {
    return await new Response(body, { headers: { "content-type": contentType } }).formData();
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError("VALIDATION_FAILED", 400);
  }
}

export async function parseBkfcSubmissionIngress(
  request: Request,
  input: {
    requestId: string;
    bearerSecrets: readonly string[];
    consumePreparseQuota: (
      credentialFingerprint: string,
    ) => Promise<SubmissionPreparseQuotaDecision>;
  },
): Promise<{
  authentication: BearerAuthentication & { authorized: true };
  idempotencyKey: string;
  bkfcApplicationId: string;
  form: FormData;
}> {
  const authentication = authenticateBearer(request.headers.get("authorization"), input.bearerSecrets);
  if (!authentication.authorized) throw new IntegrationError("UNAUTHORIZED", 401);
  if (!UUID_V4_PATTERN.test(input.requestId)) throw new IntegrationError("VALIDATION_FAILED", 400, "X-Request-ID");
  if (request.headers.get("accept") !== "application/json") {
    throw new IntegrationError("UNSUPPORTED_MEDIA_TYPE", 415, "Accept");
  }
  parseRequiredContentLength(request.headers, BKFC_SUBMISSION_MAX_BYTES);
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;[^\r\n]*boundary=[^;\r\n]+$/i.test(contentType)) {
    throw new IntegrationError("UNSUPPORTED_MEDIA_TYPE", 415, "Content-Type");
  }
  const rateLimit = await input.consumePreparseQuota(authentication.credentialFingerprint);
  if (!rateLimit.allowed) {
    throw new IntegrationError("RATE_LIMITED", 429, undefined, true, rateLimit.retryAfterSeconds);
  }
  return {
    authentication,
    idempotencyKey: request.headers.get("idempotency-key") ?? "",
    bkfcApplicationId: request.headers.get("x-bkfc-application-id") ?? "",
    form: await parseBoundedMultipart(request, contentType),
  };
}
