import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  generateInformationResponseToken,
  hashInformationResponseToken,
  validateInformationRequestInput,
  validateInformationResponseText,
} from "../lib/application/information-response.ts";

const migrationPath =
  "supabase/migrations/20260723010000_batch_1a3_secure_information_response.sql";

test("information-response tokens are random, URL-safe, and stored only as hashes", () => {
  const first = generateInformationResponseToken();
  const second = generateInformationResponseToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.match(hashInformationResponseToken(first) ?? "", /^[0-9a-f]{64}$/);
  assert.equal(hashInformationResponseToken("invalid"), null);
});

test("admin requests and applicant responses enforce bounded text", () => {
  assert.deepEqual(
    validateInformationRequestInput({
      summary: "  Updated fighter roster  ",
      details: "Provide the latest roster.",
      validDays: 7,
    }),
    {
      summary: "Updated fighter roster",
      details: "Provide the latest roster.",
      validDays: 7,
    }
  );
  assert.throws(
    () => validateInformationRequestInput({ summary: "", details: "", validDays: 7 }),
    /summary/i
  );
  assert.throws(
    () =>
      validateInformationRequestInput({
        summary: "Request",
        details: "",
        validDays: 365,
      }),
    /period/i
  );
  assert.equal(validateInformationResponseText("  Updated details  "), "Updated details");
  assert.throws(() => validateInformationResponseText("   "), /requested information/i);
});

test("information-response tables are private and raw bearer tokens are never persisted", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(
    migration,
    /affiliate_application_information_requests enable row level security/i
  );
  assert.match(
    migration,
    /revoke all on table public\.affiliate_application_information_requests from anon, authenticated/i
  );
  assert.match(migration, /token_hash text not null unique/i);
  assert.doesNotMatch(migration, /\btoken\s+text\b/i);
  assert.match(
    migration,
    /revoke all on function public\.submit_affiliate_information_response\(text, text\)[\s\S]*from public, anon, authenticated/i
  );
});

test("response completion is atomic, one-time, audited, and returns the application to review", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /where token_hash = p_token_hash[\s\S]*for update/i);
  assert.match(migration, /v_request\.status <> 'open'/i);
  assert.match(
    migration,
    /insert into public\.affiliate_application_information_responses/i
  );
  assert.match(
    migration,
    /set review_stage = 'under_review', status = 'in_review'/i
  );
  assert.match(migration, /'applicant_response_received'/i);
  assert.match(migration, /'information_received'/i);
  assert.match(migration, /'blocked_copy_pending'/i);
  assert.match(
    migration,
    /notification_type = 'more_information_required'[\s\S]*delivery_status in \('blocked_copy_pending', 'pending', 'failed'\)/i
  );
});

test("public response source excludes private application and admin fields", async () => {
  const source = await readFile(
    "lib/application/information-response-server.ts",
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /internal_notes|created_by_email|contact_person|phone|gym_photo|fighter_list|logo_path/
  );
  assert.match(source, /application_reference, gym_name/);
});

test("legacy one-click follow-up action is removed in favor of the structured request", async () => {
  const [pipeline, requestForm] = await Promise.all([
    readFile("components/admin/PipelineActionsPanel.tsx", "utf8"),
    readFile("components/admin/InformationRequestForm.tsx", "utf8"),
  ]);
  assert.doesNotMatch(pipeline, /Request Follow-Up/);
  assert.match(requestForm, /request_summary/);
  assert.match(requestForm, /valid_days/);
});
