import assert from "node:assert/strict";
import test from "node:test";
import { partitionApplications } from "../lib/admin/test-applications.ts";
import { activationSummary, activationBlockedReason } from "../lib/admin/activation-presentation.ts";
import type { ApplicationPaymentStatus } from "../lib/admin/types.ts";

const paid = { payment_status: "paid" } as ApplicationPaymentStatus;
const active = { status: "active", review_stage: "activated_affiliate" };
const approved = { status: "approved", review_stage: "approved" };

test("confirmed test IDs are excluded without hiding real gyms with similar names or contacts", () => {
  const testRows = ["72a508c4-acad-4af1-a0f1-8615b03a79bd", "d58a32fb-c475-4996-aba0-5a198dca559f", "da826f5d-22f9-4395-beaf-e9a841f1def0"].map(id => ({ id, gym_name: "Renamed" }));
  const real = { id: "real-gym", gym_name: "Production Test Boxing Club" };
  const input = [...testRows, real];
  const result = partitionApplications(input);
  assert.deepEqual(result.live, [real]);
  assert.deepEqual(result.tests, testRows);
  assert.equal(input.length, 4);
  assert.equal(partitionApplications(testRows).live.length, 0);
  assert.deepEqual(partitionApplications([]), { live: [], tests: [] });
});

test("delisting takes priority over earlier activated and paid states", () => {
  const message = activationSummary(active, paid, true);
  assert.match(message, /^Closed/);
  assert.match(message, /history/);
  assert.doesNotMatch(message, /Activation eligible|Activation blocked/);
  assert.match(activationSummary(approved, paid, true), /^Closed/);
  assert.match(activationSummary(active, null, true), /^Closed/);
});

test("completed activation has clear presentation without relaxing eligibility guards", () => {
  assert.match(activationSummary(active, paid), /^Affiliate activation completed/);
  assert.match(activationSummary(active, null), /^Affiliate activation completed/);
  assert.equal(activationBlockedReason(active, paid), "Current review state is not approved.");
  assert.match(activationSummary({ status: "rejected", review_stage: "rejected" }, null), /^Application archived/);
});

test("unpaid and inconsistent review states stay blocked", () => {
  assert.match(activationSummary(approved, null), /Activation blocked/);
  assert.match(activationSummary(approved, { payment_status: "pending" } as ApplicationPaymentStatus), /Activation blocked/);
  assert.match(activationSummary({ status: "new", review_stage: "activated_affiliate" }, paid), /Activation blocked/);
  assert.match(activationSummary(approved, paid), /^Activation eligible/);
});
