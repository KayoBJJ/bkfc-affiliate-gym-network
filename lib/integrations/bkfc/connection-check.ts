import { randomUUID } from "node:crypto";
import { UUID_V4_PATTERN } from "./contracts.ts";
import { deliverGymControl } from "./gym-control.ts";

type Dependencies = {
  isAdmin: () => Promise<boolean>;
  findApplication: (id: string) => Promise<{ source_system: string | null; source_application_id: string | null } | null>;
  getConfig: () => { paymentRequestBaseUrl?: string | null; euToBkfcCurrentSecret?: string | null };
  fetchImpl?: typeof fetch;
};

// Deliberately does not enqueue, claim, retry, persist remote state, or run a worker.
// Admin authorization precedes both the database lookup and credential access.
export async function checkBkfcConnection(applicationId: string, deps: Dependencies) {
  if (!await deps.isAdmin()) return { status: 401, body: { code: "UNAUTHORIZED" } };
  if (!UUID_V4_PATTERN.test(applicationId)) return { status: 400, body: { code: "INVALID_APPLICATION_ID" } };
  const app = await deps.findApplication(applicationId);
  if (!app || app.source_system !== "bkfc" || !app.source_application_id || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(app.source_application_id)) {
    return { status: 404, body: { code: "BKFC_APPLICATION_NOT_FOUND" } };
  }
  const config = deps.getConfig();
  if (!config.paymentRequestBaseUrl || !config.euToBkfcCurrentSecret) return { status: 503, body: { code: "OUTGOING_CONFIG_MISSING" } };
  const result = await deliverGymControl({
    command_id: randomUUID(), application_id: applicationId, bkfc_application_id: app.source_application_id,
    command_type: "read", payload: {}, expected_version: null, attempt_count: 1, total_attempt_count: 1, claim_token: randomUUID(),
  }, { baseUrl: config.paymentRequestBaseUrl, bearerSecret: config.euToBkfcCurrentSecret },
  (url, init) => (deps.fetchImpl ?? fetch)(url, { ...init, cache: "no-store" }));
  return { status: 200, body: {
    checkedAt: new Date().toISOString(), pass: result.disposition === "accepted",
    httpStatus: result.httpStatus, code: result.code.replaceAll(config.euToBkfcCurrentSecret, "[REDACTED]"), requestId: result.requestId,
    applicationId, identityAndStateValidated: result.state !== null,
    scope: "One read-only request from the deployed server using its configured outbound credential; no commands queued or state changed.",
  } };
}
