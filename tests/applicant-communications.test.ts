import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  deriveApplicantCommunicationPortalToken,
  renderApplicantCommunication,
  type ApplicantCommunicationTemplate,
} from "../lib/application/applicant-communication.ts";
import {
  ConfigurationError,
  resolveApplicantCommunicationConfig,
} from "../lib/config/policy.ts";

const migrationPath =
  "supabase/migrations/20260818000000_applicant_communication_activation.sql";

const template: ApplicantCommunicationTemplate = {
  id: "template-1",
  notification_type: "approved",
  locale: "en",
  version: 1,
  approval_status: "approved",
  subject_template: "Update for {{gym_name}}",
  headline_template: "Hello {{contact_person}}",
  body_paragraphs: ["Reference: {{application_reference}}"],
  cta_label: "Open secure portal",
  footer_text: "Keep this link private.",
};

test("communications configuration is disabled and dry-run by default", () => {
  const config = resolveApplicantCommunicationConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.dryRun, true);
  assert.equal(config.batchSize, 10);
});

test("enabled communications still default to dry-run", () => {
  const config = resolveApplicantCommunicationConfig({
    APPLICANT_COMMUNICATIONS_ENABLED: "true",
    APPLICANT_COMMUNICATION_TOKEN_SECRET: "correct-horse-battery-staple-communications-secret",
  });
  assert.equal(config.enabled, true);
  assert.equal(config.dryRun, true);
});

test("communications fail closed when enabled without an independent secret", () => {
  assert.throws(
    () => resolveApplicantCommunicationConfig({ APPLICANT_COMMUNICATIONS_ENABLED: "true" }),
    (error) => error instanceof ConfigurationError && error.code === "CONFIG_COMMUNICATION_INVALID",
  );
  assert.throws(() => resolveApplicantCommunicationConfig({
    APPLICANT_COMMUNICATIONS_ENABLED: "true",
    APPLICANT_COMMUNICATION_TOKEN_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  }));
});

test("outbox portal tokens are deterministic, isolated, and URL-safe", () => {
  const secret = "correct-horse-battery-staple-communications-secret";
  const first = deriveApplicantCommunicationPortalToken("outbox-1", secret);
  assert.equal(first, deriveApplicantCommunicationPortalToken("outbox-1", secret));
  assert.notEqual(first, deriveApplicantCommunicationPortalToken("outbox-2", secret));
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
});

test("approved structured copy renders escaped values and rejects unsafe variables", () => {
  const rendered = renderApplicantCommunication({
    template,
    variables: {
      contact_person: "Ana <Admin>", gym_name: "A&B Gym",
      application_reference: "BKFC-GYM-ABC123", request_summary: "N/A", request_deadline: "N/A",
    },
    portalUrl: "https://example.test/application-progress/token?x=1&y=2",
    bkfcPaymentManaged: true,
  });
  assert.equal(rendered.subject, "Update for A&B Gym");
  assert.match(rendered.html, /Ana &lt;Admin&gt;/);
  assert.match(rendered.html, /A&amp;B Gym|BKFC-GYM-ABC123/);
  assert.match(rendered.html, /x=1&amp;y=2/);
  assert.match(rendered.html, /Official payment instructions will be sent separately by BKFC/);
  const legacyRendered = renderApplicantCommunication({
    template,
    variables: {
      contact_person: "Ana", gym_name: "Legacy Gym", application_reference: "LEGACY-1",
      request_summary: "N/A", request_deadline: "N/A",
    },
    portalUrl: "https://example.test/portal",
  });
  assert.doesNotMatch(legacyRendered.html, /Official payment instructions/);
  assert.throws(() => renderApplicantCommunication({
    template: { ...template, subject_template: "{{unknown_value}}" },
    variables: {
      contact_person: "Ana", gym_name: "Gym", application_reference: "Ref",
      request_summary: "N/A", request_deadline: "N/A",
    },
    portalUrl: "https://example.test/portal",
  }), /TEMPLATE_VARIABLE_UNSUPPORTED/);
  assert.throws(() => renderApplicantCommunication({
    template: { ...template, subject_template: "Unsafe\nsubject" },
    variables: {
      contact_person: "Ana", gym_name: "Gym", application_reference: "Ref",
      request_summary: "N/A", request_deadline: "N/A",
    },
    portalUrl: "https://example.test/portal",
  }), /TEMPLATE_SUBJECT_INVALID/);
});

test("migration requires explicit approved copy and atomic bounded claims", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /approval_status text not null default 'draft'/i);
  assert.doesNotMatch(migration, /insert into public\.affiliate_application_notification_templates/i);
  assert.match(migration, /p_application_id uuid/i);
  assert.match(migration, /delivery_status = 'blocked_copy_pending'/i);
  assert.match(migration, /for update of outbox skip locked/i);
  assert.match(migration, /outbox\.attempt_count < 3/i);
  assert.match(migration, /claimed_at < now\(\) - interval '15 minutes'/i);
  assert.match(migration, /Approved notification templates are immutable/i);
  assert.match(migration, /approval_status in \('approved', 'retired'\)/i);
  assert.match(migration, /prepare_affiliate_notification_portal_delivery/i);
  assert.match(migration, /complete_affiliate_notification_delivery/i);
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/i);
});

test("worker is provider-idempotent, master-gated, and not scheduled", async () => {
  const [worker, route, vercel, email, recovery] = await Promise.all([
    readFile("lib/application/applicant-communication-worker.ts", "utf8"),
    readFile("app/api/cron/applicant-communications/route.ts", "utf8"),
    readFile("vercel.json", "utf8"),
    readFile("lib/application/email.ts", "utf8"),
    readFile("app/api/application-progress/recovery/route.ts", "utf8"),
  ]);
  assert.match(worker, /idempotencyKey: `bkfc-outbox-\$\{outbox\.id\}`/);
  assert.match(worker, /getApplicantCommunicationConfig\(\)/);
  assert.match(route, /timingSafeEqual/);
  assert.doesNotMatch(vercel, /applicant-communications/);
  assert.match(email, /applicantCommunicationsEnabled/);
  assert.match(recovery, /isApplicantCommunicationsEnabled\(\)/);
});
