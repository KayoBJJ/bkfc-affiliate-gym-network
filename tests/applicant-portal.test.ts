import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APPLICANT_PROGRESS_MILESTONES,
  generateApplicantPortalToken,
  getApplicantProgressSummary,
  hashApplicantPortalToken,
} from "../lib/application/applicant-portal.ts";

const migrationPath =
  "supabase/migrations/20260726000000_batch_1b_applicant_progress_portal.sql";

test("portal tokens are high-entropy URL-safe values stored only as hashes", () => {
  const first = generateApplicantPortalToken();
  const second = generateApplicantPortalToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.match(hashApplicantPortalToken(first) ?? "", /^[0-9a-f]{64}$/);
  assert.equal(hashApplicantPortalToken("invalid"), null);
});

test("every internal review stage maps to applicant-safe progress", () => {
  const stages = [
    "submitted",
    "under_review",
    "follow_up_required",
    "interview",
    "trial_candidate",
    "approved",
    "rejected",
    "activated_affiliate",
  ];
  for (const stage of stages) {
    const summary = getApplicantProgressSummary(stage);
    assert.ok(summary.headline);
    assert.ok(summary.description);
    assert.ok(summary.progress >= 0 && summary.progress <= 100);
    assert.ok(summary.activeMilestone >= 0);
    assert.ok(summary.activeMilestone < APPLICANT_PROGRESS_MILESTONES.length);
  }
  assert.equal(getApplicantProgressSummary("follow_up_required").tone, "action");
  assert.equal(getApplicantProgressSummary("activated_affiliate").progress, 100);
  assert.equal(
    getApplicantProgressSummary("unknown").label,
    "Application received",
  );
});

test("portal access is private, revocable, expiring, and audit recorded", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /token_hash text not null unique/i);
  assert.doesNotMatch(migration, /\btoken\s+text\b/i);
  assert.match(
    migration,
    /affiliate_application_portal_access enable row level security/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.affiliate_application_portal_access from anon, authenticated/i,
  );
  assert.match(
    migration,
    /update public\.affiliate_application_portal_access[\s\S]*set revoked_at = now\(\)[\s\S]*revoked_at is null/i,
  );
  assert.match(migration, /'applicant_portal_access_issued'/i);
  assert.match(
    migration,
    /revoke all on function public\.admin_issue_affiliate_application_portal_access[\s\S]*from public, anon, authenticated/i,
  );
});

test("public portal data source excludes private application and reviewer fields", async () => {
  const source = await readFile(
    "lib/application/applicant-portal-server.ts",
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /internal_notes|actor_email|created_by_email|contact_person|phone|website_instagram|storage_path|access_url/,
  );
  assert.match(source, /application_reference, gym_name, created_at, review_stage/);
  assert.match(source, /request_summary, request_details, status, expires_at, responded_at/);
});

test("portal page is non-indexable and uses the explicit feature gate", async () => {
  const page = await readFile("app/application-progress/[token]/page.tsx", "utf8");
  assert.match(page, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(page, /referrer: "no-referrer"/);
  assert.match(page, /isApplicantPortalEnabled\(\)/);
  assert.doesNotMatch(page, /internal_notes|actor_email|created_by_email/);
});

