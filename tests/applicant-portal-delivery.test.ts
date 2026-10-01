import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  generateApplicantPortalRecoveryToken,
  hashApplicantPortalRecoveryToken,
} from "../lib/application/applicant-portal.ts";

const migrationPath =
  "supabase/migrations/20260728000000_batch_1b_portal_delivery_recovery.sql";
const recoveryHotfixPath =
  "supabase/migrations/20260728010000_batch_1b_recovery_ambiguity_hotfix.sql";

test("portal recovery tokens are high entropy and only hashable valid values", () => {
  const first = generateApplicantPortalRecoveryToken();
  const second = generateApplicantPortalRecoveryToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.match(hashApplicantPortalRecoveryToken(first) ?? "", /^[0-9a-f]{64}$/);
  assert.equal(hashApplicantPortalRecoveryToken("not-a-token"), null);
});

test("email delivery activates replacement access only after provider acceptance", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(
    migration,
    /prepare_affiliate_application_portal_delivery[\s\S]*'pending'/i,
  );
  assert.match(
    migration,
    /if p_succeeded then[\s\S]*set revoked_at = now\(\)[\s\S]*activated_at is not null[\s\S]*set activated_at = now\(\),[\s\S]*delivery_status = 'sent'/i,
  );
  assert.match(
    migration,
    /else[\s\S]*delivery_status = 'failed'[\s\S]*applicant_portal_delivery_failed/i,
  );
  assert.match(
    migration,
    /where revoked_at is null and activated_at is not null/i,
  );
});

test("portal and recovery tables remain private and never store raw tokens", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(
    migration,
    /affiliate_application_portal_recovery[\s\S]*token_hash text not null unique/i,
  );
  assert.doesNotMatch(migration, /\btoken\s+text\b|\bportal_url\b|\brecovery_url\b/i);
  assert.match(
    migration,
    /affiliate_application_portal_recovery enable row level security/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.affiliate_application_portal_recovery[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.consume_affiliate_application_portal_recovery[\s\S]*to service_role/i,
  );
});

test("recovery requests are rate limited without disclosing application matches", async () => {
  const [migration, route] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile("app/api/application-progress/recovery/route.ts", "utf8"),
  ]);
  assert.match(
    migration,
    /identifier_kind = 'origin'[\s\S]*interval '1 hour'[\s\S]*>= 5/i,
  );
  assert.match(
    migration,
    /identifier_kind = 'identity'[\s\S]*interval '1 hour'[\s\S]*>= 3/i,
  );
  assert.match(route, /PORTAL_RECOVERY_TURNSTILE_ACTION/);
  assert.match(route, /rateLimitIdentifier\(\s*`\$\{applicationReference\}\.\$\{email\}`/);
  assert.match(
    route,
    /If the details match an application, a secure recovery email will arrive shortly\./,
  );
  assert.doesNotMatch(
    route,
    /application (?:found|not found)|email (?:matched|did not match)/i,
  );
});

test("requesting recovery does not revoke active portal access", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const requestFunction = migration.match(
    /create or replace function public\.request_affiliate_application_portal_recovery[\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";
  assert.ok(requestFunction);
  assert.doesNotMatch(
    requestFunction,
    /update public\.affiliate_application_portal_access/i,
  );
  assert.match(
    migration,
    /consume_affiliate_application_portal_recovery[\s\S]*update public\.affiliate_application_portal_access[\s\S]*set revoked_at = now\(\)[\s\S]*update public\.affiliate_application_portal_recovery[\s\S]*set consumed_at = now\(\)/i,
  );
});

test("recovery request qualifies the table application id in fresh and upgraded databases", async () => {
  const [migration, hotfix] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(recoveryHotfixPath, "utf8"),
  ]);
  const qualifiedUpdate =
    /update public\.affiliate_application_portal_recovery as recovery[\s\S]*where recovery\.application_id = v_application\.id[\s\S]*recovery\.consumed_at is null[\s\S]*recovery\.revoked_at is null/i;
  assert.match(migration, qualifiedUpdate);
  assert.match(hotfix, qualifiedUpdate);
  assert.match(
    hotfix,
    /create or replace function public\.request_affiliate_application_portal_recovery/i,
  );
  assert.match(
    hotfix,
    /grant execute on function public\.request_affiliate_application_portal_recovery[\s\S]*to service_role/i,
  );
});

test("recovery routes are feature gated, non-indexable, and non-cacheable", async () => {
  const [page, consume, config, example] = await Promise.all([
    readFile("app/application-progress/recover/page.tsx", "utf8"),
    readFile("app/application-progress/recover/[token]/page.tsx", "utf8"),
    readFile("next.config.js", "utf8"),
    readFile(".env.example", "utf8"),
  ]);
  assert.match(page, /isApplicantPortalRecoveryEnabled\(\)/);
  assert.match(page, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(consume, /consume_affiliate_application_portal_recovery/);
  assert.match(consume, /redirect\(`\/application-progress\/\$\{portalToken\}`\)/);
  assert.match(config, /source: "\/application-progress\/:path\*"/);
  assert.match(example, /APPLICANT_PORTAL_EMAIL_DELIVERY_ENABLED=false/);
  assert.match(example, /APPLICANT_PORTAL_RECOVERY_ENABLED=false/);
  assert.match(example, /APPLICATION_PUBLIC_URL=http:\/\/localhost:3000/);
  assert.match(
    example,
    /APPLICANT_PORTAL_TEST_APPLICATION_REFERENCE=BKFC-GYM-REPLACE/,
  );
});

test("admin and material updates use the common safe delivery service", async () => {
  const [actions, card, delivery] = await Promise.all([
    readFile("app/admin/applications/[id]/actions.ts", "utf8"),
    readFile("components/admin/ApplicantPortalAccessCard.tsx", "utf8"),
    readFile("lib/application/applicant-portal-delivery.ts", "utf8"),
  ]);
  assert.match(actions, /emailApplicantPortalLinkAction/);
  assert.match(actions, /reason: "more_information_required"/);
  assert.match(actions, /reason: "replacement_required"/);
  assert.match(actions, /"approved", "rejected", "activated_affiliate"/);
  assert.match(card, /Email secure portal access/);
  assert.match(delivery, /prepareApplicantPortalDelivery/);
  assert.match(delivery, /completeApplicantPortalDelivery/);
  assert.match(delivery, /sendApplicantPortalAccessEmail/);
});

test("test-mode portal delivery is allowlisted to one application", async () => {
  const [email, serverConfig] = await Promise.all([
    readFile("lib/application/applicant-portal-email.ts", "utf8"),
    readFile("lib/config/server.ts", "utf8"),
  ]);
  assert.match(email, /!routing\.applicantDeliveryEnabled/);
  assert.match(email, /isApplicantPortalTestApplication/);
  assert.match(email, /PORTAL_TEST_APPLICATION_NOT_ALLOWED/);
  assert.match(serverConfig, /APPLICANT_PORTAL_TEST_APPLICATION_REFERENCE/);
});

test("initial application email can carry the prepared portal CTA", async () => {
  const [email, directRoute, finalizeRoute] = await Promise.all([
    readFile("lib/application/email.ts", "utf8"),
    readFile("app/api/affiliate-registration/route.ts", "utf8"),
    readFile("app/api/affiliate-registration/finalize/route.ts", "utf8"),
  ]);
  assert.match(email, /reason: "application_received"/);
  const { buildApplicantReceivedEmail } = await import("../lib/application/received-email.ts");
  const html = buildApplicantReceivedEmail({ contactPerson: "Alex", gymName: "Gym", cityCountry: "Sofia", submissionId: "GYM-1", portalUrl: "https://example.com/portal" });
  assert.match(html, /href="https:\/\/example.com\/portal"/);
  assert.match(html, /Open application portal/);
  assert.match(email, /completeApplicantPortalDelivery/);
  assert.match(directRoute, /applicationId,/);
  assert.match(finalizeRoute, /applicationId: sessionId!/);
});
