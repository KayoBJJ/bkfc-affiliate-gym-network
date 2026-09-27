import { randomUUID } from "node:crypto";
import { normalizeBkfcPaymentRequestBaseUrl } from "../../config/policy.ts";
import { canonicalJson, type CanonicalJson } from "./canonical-json.ts";
import { UUID_V4_PATTERN } from "./contracts.ts";

export const LISTING_FIELDS = ["gymName", "address", "city", "state", "postalCode", "country", "latitude", "longitude", "website", "instagram", "disciplinesOffered", "contactPerson", "email", "phone", "promoVideoLink"] as const;
const requiredFields = new Set(["gymName", "city", "country", "contactPerson", "email", "phone", "disciplinesOffered"]);
export type GymControlKind = "read" | "edit" | "logo" | "visibility" | "cancel_subscription" | "delist" | "retry_deliveries";
export type GymState = {
  status: string; version: string; euApplicationId: string; paymentRequestId: string | null;
  subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };
  listing: Record<string, string | boolean | null> & { displayOnSite: boolean };
  euDelivery: { acknowledged: boolean; attempts: number; failedAt: string | null; lastError: string | null };
};
export type GymControlCommand = {
  command_id: string; application_id: string; bkfc_application_id: string;
  command_type: GymControlKind; payload: Record<string, CanonicalJson>; expected_version: string | null;
  attempt_count: number; total_attempt_count: number; claim_token: string;
};
export type GymControlResult = {
  disposition: "accepted" | "retry" | "failed" | "uncertain";
  requestId: string; httpStatus: number | null; code: string;
  nextAttemptAt: string | null; state: GymState | null; validationIssues?: string[];
};
const endpoints: Record<GymControlKind, [string, string, number, string]> = {
  read: ["GET", "", 200, "GYM_STATE"], edit: ["PATCH", "", 200, "GYM_UPDATED"],
  logo: ["PUT", "/logo", 200, "GYM_LOGO_UPDATED"], visibility: ["PUT", "/visibility", 200, "GYM_VISIBILITY_UPDATED"],
  cancel_subscription: ["POST", "/subscription/cancellations", 202, "SUBSCRIPTION_CANCELLATION_ACCEPTED"],
  delist: ["DELETE", "", 200, "GYM_DELISTED"], retry_deliveries: ["POST", "/deliveries/retries", 202, "DELIVERY_RETRY_SCHEDULED"],
};
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
export function validateGymControlInput(kind: string, payload: unknown, version: string | null): asserts payload is Record<string, CanonicalJson> {
  if (!Object.hasOwn(endpoints, kind) || !object(payload)) throw new Error("INVALID_CONTROL_COMMAND");
  if (["edit", "logo"].includes(kind) && (!version || !/^[0-9]{1,20}$/.test(version))) throw new Error("REFRESH_LISTING_REQUIRED");
  const keys = Object.keys(payload);
  const only = (allowed: readonly string[]) => keys.every(key => allowed.includes(key));
  if (kind === "edit") {
    if (!keys.length || !only(LISTING_FIELDS)) throw new Error("INVALID_LISTING_FIELDS");
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value !== "string" || value.length > 1000 || (requiredFields.has(key) && !value.trim())) throw new Error("INVALID_LISTING_FIELD");
    }
  } else if (kind === "logo") {
    if (!only(["base64", "contentType"]) || typeof payload.base64 !== "string" || typeof payload.contentType !== "string") throw new Error("INVALID_FILE");
    const bytes = Buffer.from(payload.base64, "base64");
    if (bytes.toString("base64") !== payload.base64 || logoContentType(bytes) !== payload.contentType) throw new Error("INVALID_FILE");
  } else if (kind === "visibility") {
    if (!only(["visible", "reasonCode"]) || typeof payload.visible !== "boolean" || !(payload.reasonCode === null || (typeof payload.reasonCode === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(payload.reasonCode)))) throw new Error("INVALID_VISIBILITY");
  } else if (kind === "cancel_subscription") {
    if (!only(["cancellationId", "mode", "reasonCode"]) || typeof payload.cancellationId !== "string" || !UUID_V4_PATTERN.test(payload.cancellationId) || !["immediately", "at_period_end"].includes(String(payload.mode)) || payload.reasonCode !== "eu_requested") throw new Error("INVALID_CANCELLATION");
  } else if (kind === "delist") {
    if (!only(["reasonCode"]) || typeof payload.reasonCode !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(payload.reasonCode)) throw new Error("INVALID_REASON");
  } else if (keys.length) throw new Error("INVALID_CONTROL_COMMAND");
  if (kind !== "logo" && Buffer.byteLength(JSON.stringify(payload)) > 32768) throw new Error("BODY_TOO_LARGE");
}
export function logoContentType(bytes: Uint8Array): string {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error("INVALID_FILE");
  const b = Buffer.from(bytes);
  if (b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(b.toString("ascii", 0, 6))) return "image/gif";
  if (b.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(b.toString("ascii", 8, 12))) return "image/avif";
  throw new Error("INVALID_FILE");
}
export function parseGymState(value: unknown, applicationId: string): GymState | null {
  if (!object(value) || value.euApplicationId !== applicationId || typeof value.version !== "string" || !/^[0-9]{1,20}$/.test(value.version) ||
    !["submitted", "eu_received", "awaiting_payment", "initiation_failed", "paid", "past_due", "cancelled", "delisted"].includes(String(value.status)) ||
    !(value.paymentRequestId === null || (typeof value.paymentRequestId === "string" && UUID_V4_PATTERN.test(value.paymentRequestId))) ||
    !object(value.subscription) || !object(value.listing) || !object(value.euDelivery)) return null;
  const s = value.subscription, l = value.listing, d = value.euDelivery;
  const timestamp = (v: unknown) => v === null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)));
  const nullableText = (v: unknown) => v === null || (typeof v === "string" && v.length <= 1000);
  if (typeof s.status !== "string" || s.status.length > 64 || !timestamp(s.currentPeriodEnd) || typeof s.cancelAtPeriodEnd !== "boolean" || typeof l.displayOnSite !== "boolean" ||
    typeof d.acknowledged !== "boolean" || !Number.isInteger(d.attempts) || Number(d.attempts) < 0 || !timestamp(d.failedAt) || !nullableText(d.lastError)) return null;
  const listing: GymState["listing"] = { displayOnSite: l.displayOnSite };
  for (const key of [...LISTING_FIELDS, "logoUrl"]) {
    if (!nullableText(l[key])) return null;
    listing[key] = l[key] as string | null;
  }
  return { status: String(value.status), version: value.version, euApplicationId: applicationId, paymentRequestId: value.paymentRequestId as string | null,
    listing, subscription: { status: s.status, currentPeriodEnd: s.currentPeriodEnd as string | null, cancelAtPeriodEnd: s.cancelAtPeriodEnd },
    euDelivery: { acknowledged: d.acknowledged, attempts: Number(d.attempts), failedAt: d.failedAt as string | null, lastError: d.lastError as string | null } };
}
// Only fixed field names and expected types are returned; never include remote values.
export function diagnoseGymState(value: unknown, applicationId: string): string[] {
  if (!object(value)) return ["data: expected object"];
  const issues: string[] = [];
  const check = (ok: boolean, field: string, expectation: string) => { if (!ok) issues.push(`${field}: ${expectation}`); };
  const timestamp = (v: unknown) => v === null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)));
  const text = (v: unknown) => v === null || (typeof v === "string" && v.length <= 1000);
  check(value.euApplicationId === applicationId, "euApplicationId", "must match requested EU application");
  check(typeof value.version === "string" && /^[0-9]{1,20}$/.test(value.version), "version", "expected numeric string (1–20 digits)");
  check(["submitted", "eu_received", "awaiting_payment", "initiation_failed", "paid", "past_due", "cancelled", "delisted"].includes(String(value.status)), "status", "expected supported status");
  check(value.paymentRequestId === null || (typeof value.paymentRequestId === "string" && UUID_V4_PATTERN.test(value.paymentRequestId)), "paymentRequestId", "expected UUIDv4 or null");
  for (const field of ["subscription", "listing", "euDelivery"] as const) {
    check(object(value[field]), field, value[field] === null ? "received null; current validator requires object" : "expected object");
  }
  if (object(value.subscription)) {
    const s = value.subscription;
    check(typeof s.status === "string" && s.status.length <= 64, "subscription.status", "expected string up to 64 characters");
    check(timestamp(s.currentPeriodEnd), "subscription.currentPeriodEnd", "expected timestamp or null");
    check(typeof s.cancelAtPeriodEnd === "boolean", "subscription.cancelAtPeriodEnd", "expected boolean");
  }
  if (object(value.listing)) {
    check(typeof value.listing.displayOnSite === "boolean", "listing.displayOnSite", "expected boolean");
    for (const key of [...LISTING_FIELDS, "logoUrl"]) check(text(value.listing[key]), `listing.${key}`, "expected string up to 1000 characters or null");
  }
  if (object(value.euDelivery)) {
    const d = value.euDelivery;
    check(typeof d.acknowledged === "boolean", "euDelivery.acknowledged", "expected boolean");
    check(Number.isInteger(d.attempts) && Number(d.attempts) >= 0, "euDelivery.attempts", "expected nonnegative integer");
    check(timestamp(d.failedAt), "euDelivery.failedAt", "expected timestamp or null");
    check(text(d.lastError), "euDelivery.lastError", "expected string up to 1000 characters or null");
  }
  return issues;
}
async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("INVALID_RESPONSE");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 32768) { void reader.cancel().catch(() => {}); throw new Error("RESPONSE_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function deliverGymControl(command: GymControlCommand, config: { baseUrl: string; bearerSecret: string }, fetchImpl: typeof fetch = fetch, now = new Date()): Promise<GymControlResult> {
  const requestId = randomUUID();
  const result = (disposition: GymControlResult["disposition"], code: string, status: number | null = null, state: GymState | null = null): GymControlResult =>
    ({ disposition, requestId, httpStatus: status, code, nextAttemptAt: null, state });
  const retry = (code: string, response?: Response) => {
    if (command.attempt_count >= 6) return result("uncertain", code, response?.status ?? null);
    const raw = response?.headers.get("retry-after");
    let delay = raw && /^\d+$/.test(raw) ? Number(raw) : raw ? (Date.parse(raw)-now.getTime())/1000 : NaN;
    if (!Number.isFinite(delay)) delay = [60, 300, 1800, 7200, 21600][Math.min(Math.max(command.attempt_count-1,0),4)];
    return { ...result("retry", code, response?.status ?? null), nextAttemptAt: new Date(now.getTime()+Math.min(21600,Math.max(1,delay))*1000).toISOString() };
  };
  try { validateGymControlInput(command.command_type, command.payload, command.expected_version); } catch { return result("failed", "INVALID_CONTROL_COMMAND"); }
  const [method, suffix, expectedStatus, expectedCode] = endpoints[command.command_type];
  const origin = normalizeBkfcPaymentRequestBaseUrl(config.baseUrl);
  const url = `${origin}/api/v1/integrations/eu/gyms/${encodeURIComponent(command.bkfc_application_id)}${suffix}`;
  const headers: Record<string,string> = { authorization: `Bearer ${config.bearerSecret}`, "x-request-id": requestId, "idempotency-key": command.command_id, accept: "application/json" };
  if (command.expected_version) headers["if-match"] = command.expected_version;
  let body: BodyInit | undefined;
  if (command.command_type === "logo") {
    const form = new FormData();
    form.append("logoUpload", new Blob([Buffer.from(String(command.payload.base64), "base64")], { type: String(command.payload.contentType) }), "logo"); body = form;
  } else if (method !== "GET") { headers["content-type"] = "application/json"; body = canonicalJson(command.payload); }
  let response: Response;
  try { response = await fetchImpl(url, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(10000) }); }
  catch { return retry("NETWORK_OUTCOME_UNKNOWN"); }
  if (response.status >= 300 && response.status < 400) { void response.body?.cancel().catch(() => {}); return result("uncertain", "REDIRECT_REJECTED", response.status); }
  if ([408,425,429].includes(response.status) || response.status >= 500) { void response.body?.cancel().catch(() => {}); return retry(`HTTP_${response.status}`, response); }
  let envelope: unknown;
  try { envelope = await boundedJson(response); } catch { return retry("INVALID_RESPONSE", response); }
  if (!object(envelope) || typeof envelope.success !== "boolean" || typeof envelope.code !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(envelope.code) || typeof envelope.retryable !== "boolean" || typeof envelope.requestId !== "string" || !UUID_V4_PATTERN.test(envelope.requestId)) return retry("INVALID_RESPONSE", response);
  if (response.status !== expectedStatus || !envelope.success || envelope.retryable || envelope.code !== expectedCode) {
    // A recognized rejection applies nothing. All unexpected success shapes remain uncertain.
    if (response.status >= 400 && response.status < 500 && !envelope.success && !envelope.retryable) return result(command.total_attempt_count > 1 ? "uncertain" : "failed", envelope.code, response.status);
    return retry("UNEXPECTED_RESPONSE", response);
  }
  if (["read", "edit", "logo"].includes(command.command_type)) {
    const state = parseGymState(envelope.data, command.application_id);
    return state ? result("accepted", expectedCode, response.status, state) : { ...retry("INVALID_GYM_STATE", response), validationIssues: diagnoseGymState(envelope.data, command.application_id) };
  }
  if (command.command_type === "cancel_subscription" && (!object(envelope.data) || envelope.data.outcome !== command.payload.mode)) return retry("INVALID_CANCELLATION_OUTCOME", response);
  if (command.command_type === "delist" && (!object(envelope.data) || envelope.data.outcome !== "delisted")) return retry("INVALID_DELIST_OUTCOME", response);
  if (command.command_type === "retry_deliveries" && (!object(envelope.data) || envelope.data.outcome !== "scheduled" || !Number.isInteger(envelope.data.events) || Number(envelope.data.events) < 0)) return retry("INVALID_RECOVERY_OUTCOME", response);
  return result("accepted", expectedCode, response.status);
}
