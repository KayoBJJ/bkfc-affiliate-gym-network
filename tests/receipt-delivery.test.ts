import test from "node:test";
import assert from "node:assert/strict";
import { deliverReceiptBatch } from "../lib/application/receipt-delivery.ts";

test("receipt batch records provider IDs and continues after a rejected send", async () => {
  const completed: unknown[] = [];
  const result = await deliverReceiptBatch(["one", "two", "three"], async id => {
    if (id === "two") throw new Error("PROVIDER_REJECTED");
    return `provider-${id}`;
  }, async (id, outcome) => { completed.push({ id, ...outcome }); });
  assert.deepEqual(result, { sent: 2, failed: 1 });
  assert.deepEqual(completed, [
    { id: "one", providerMessageId: "provider-one", errorCode: null },
    { id: "two", providerMessageId: null, errorCode: "PROVIDER_REJECTED" },
    { id: "three", providerMessageId: "provider-three", errorCode: null },
  ]);
});
test("receipt errors do not persist sensitive provider text", async () => {
  await deliverReceiptBatch(["one"], async () => { throw new Error("Private recipient details"); },
    async (_, outcome) => { assert.equal(outcome.errorCode, "RECEIPT_DELIVERY_FAILED"); });
});
test("completion failure preserves an uncertain successful send for claim recovery", async () => {
  let completions = 0;
  await assert.rejects(deliverReceiptBatch(["one"], async () => "provider-one", async (_, outcome) => {
    completions++;
    assert.equal(outcome.providerMessageId, "provider-one");
    throw new Error("RECEIPT_COMPLETION_FAILED");
  }), /RECEIPT_COMPLETION_FAILED/);
  assert.equal(completions, 1);
});

import { resolveReceiptConfig, resolveReceiptRouting } from "../lib/application/receipt-policy.ts";
test("receipt rollout defaults off and rejects test mode without a scoped application", () => {
  assert.equal(resolveReceiptConfig({}).enabled, false);
  assert.throws(() => resolveReceiptConfig({ BKFC_APPLICATION_RECEIPTS_MODE: "typo" }), /RECEIPT_CONFIG_INVALID/);
  assert.throws(() => resolveReceiptConfig({ BKFC_APPLICATION_RECEIPTS_MODE: "test" }), /RECEIPT_TEST_REFERENCE_REQUIRED/);
  assert.equal(resolveReceiptConfig({ BKFC_APPLICATION_RECEIPTS_MODE: "dry-run" }).dryRun, true);
});
test("receipt mode chooses live versus test recipients independently of older email flags", () => {
  const env = {
    RESEND_API_KEY: "re_test_receipt_config_only",
    APPLICANT_EMAIL_FROM: "BKFC <notifications@bkfcgym.com>",
    APPLICANT_EMAIL_REPLY_TO: "bkfcgym@bkfc.com",
    APPLICANT_EMAIL_TEST_RECIPIENT: "Kayo@bkfc.com",
    APPLICANT_EMAIL_DELIVERY_ENABLED: "false",
    APPLICANT_COMMUNICATIONS_ENABLED: "false",
    BKFC_APPLICATION_RECEIPTS_MODE: "live",
  };
  const live = resolveReceiptRouting("applicant@example.test", env);
  assert.equal(live.applicant.recipient, "applicant@example.test");
  assert.equal(live.applicant.enabled, true);
  const test = resolveReceiptRouting("applicant@example.test", {
    ...env, APPLICANT_EMAIL_DELIVERY_ENABLED: "true",
    BKFC_APPLICATION_RECEIPTS_MODE: "test", BKFC_APPLICATION_RECEIPTS_TEST_REFERENCE: "TEST-1",
  });
  assert.equal(test.applicant.recipient, "Kayo@bkfc.com");
  assert.equal(test.subjectPrefix, "[TEST MODE] ");
  assert.equal(env.APPLICANT_EMAIL_DELIVERY_ENABLED, "false");
});
