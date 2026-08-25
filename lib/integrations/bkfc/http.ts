import { NextResponse } from "next/server";
import { IntegrationError, integrationErrorHeaders, integrationErrorPayload, UUID_V4_PATTERN } from "./contracts";
export { BKFC_APPLICATION_ID_PATTERN, IntegrationError, parseRequiredContentLength, UUID_V4_PATTERN } from "./contracts";

export function integrationErrorResponse(error: IntegrationError, requestId: string) {
  return NextResponse.json(integrationErrorPayload(error, requestId), {
    status: error.status,
    headers: integrationErrorHeaders(error, requestId),
  });
}

export function integrationInternalError(requestId: string, code = "INTERNAL_ERROR") {
  return integrationErrorResponse(new IntegrationError(code, 500, undefined, true), requestId);
}

export function requiredUuidHeader(headers: Headers, name: string) {
  const value = headers.get(name);
  if (!value || !UUID_V4_PATTERN.test(value)) {
    throw new IntegrationError("VALIDATION_FAILED", 400, name);
  }
  return value;
}

export function requireJsonAccept(headers: Headers) {
  const accept = headers.get("accept");
  if (accept !== "application/json") throw new IntegrationError("UNSUPPORTED_MEDIA_TYPE", 415, "Accept");
}

export function safeIntegrationLog(event: Record<string, string | number | boolean | undefined>) {
  console.info(JSON.stringify({ event: "bkfc_eu_integration", ...event }));
}
