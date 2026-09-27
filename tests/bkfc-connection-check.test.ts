import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { checkBkfcConnection } from "../lib/integrations/bkfc/connection-check.ts";
import { LISTING_FIELDS } from "../lib/integrations/bkfc/gym-control.ts";

const applicationId = randomUUID(), sourceId = randomUUID();
const secret = "private-test-credential";
const state = { status: "eu_received", version: "1", euApplicationId: applicationId, paymentRequestId: null,
  subscription: { status: "none", currentPeriodEnd: null, cancelAtPeriodEnd: false },
  listing: { ...Object.fromEntries([...LISTING_FIELDS, "logoUrl"].map(k => [k, "private-contact-fixture"])), displayOnSite: false },
  euDelivery: { acknowledged: true, attempts: 1, failedAt: null, lastError: null } };
const deps = {
  isAdmin: async () => true,
  findApplication: async () => ({ source_system: "bkfc", source_application_id: sourceId }),
  getConfig: () => ({ paymentRequestBaseUrl: "https://api.bkfc.com", euToBkfcCurrentSecret: secret }),
};
function response(data: unknown) { return Response.json({ success: true, code: "GYM_STATE", requestId: randomUUID(), retryable: false, data }); }
test("unauthorized checks never look up applications, access credentials, or call BKFC", async () => {
  const forbidden = () => { throw new Error("must not be called"); };
  const result = await checkBkfcConnection(applicationId, { isAdmin: async () => false, findApplication: forbidden, getConfig: forbidden, fetchImpl: forbidden });
  assert.equal(result.status, 401);
});
test("read-only probe uses one uncached GET with stored credentials, and exposes no contact data or key", async () => {
  let calls = 0;
  const result = await checkBkfcConnection(applicationId, { ...deps, fetchImpl: async (url, init) => {
    calls++;
    assert.equal(String(url), `https://api.bkfc.com/api/v1/integrations/eu/gyms/${sourceId}`);
    assert.equal(init?.method, "GET"); assert.equal(init?.body, undefined);
    assert.equal(init?.redirect, "manual"); assert.equal(init?.cache, "no-store");
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${secret}`);
    return response(state);
  } });
  assert.equal(calls, 1); assert.equal(result.body.pass, true);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes("private-contact-fixture"), false);
});
test("a successful response for the wrong EU identity does not pass and is not retried", async () => {
  let calls = 0;
  const result = await checkBkfcConnection(applicationId, { ...deps, fetchImpl: async () => { calls++; return response({ ...state, euApplicationId: randomUUID() }); } });
  assert.equal(calls, 1); assert.equal(result.body.pass, false);
  assert.equal(result.body.code, "INVALID_GYM_STATE");
});
test("a rejected credential is reported without retrying", async () => {
  let calls = 0;
  const result = await checkBkfcConnection(applicationId, { ...deps, fetchImpl: async () => {
    calls++; return Response.json({ success: false, code: "UNAUTHORIZED", retryable: false, requestId: randomUUID() }, { status: 401 });
  } });
  assert.equal(calls, 1); assert.equal(result.body.httpStatus, 401); assert.equal(result.body.pass, false);
});
