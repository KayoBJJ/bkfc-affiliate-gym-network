import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260803000000_batch_1b_portal_actions.sql";

test("portal actions require active matching portal and request ownership", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /portal_access\.token_hash = p_portal_token_hash/i);
  assert.match(migration, /portal_access\.activated_at is not null/i);
  assert.match(migration, /portal_access\.revoked_at is null/i);
  assert.match(migration, /portal_access\.expires_at > now\(\)/i);
  assert.match(migration, /information_request\.id = p_request_id/i);
  assert.match(
    migration,
    /information_request\.application_id = portal_access\.application_id/i,
  );
  assert.match(migration, /information_request\.status = 'open'/i);
  assert.match(migration, /application\.review_stage = 'follow_up_required'/i);
  assert.match(migration, /for update of portal_access, information_request/i);
});

test("portal wrappers reuse the original audited response and file operations", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(
    migration,
    /return public\.create_affiliate_information_attachment_upload\(/i,
  );
  assert.match(
    migration,
    /return public\.finalize_affiliate_information_attachment\(/i,
  );
  assert.match(
    migration,
    /return public\.submit_affiliate_information_response\(/i,
  );
  assert.doesNotMatch(
    migration,
    /update public\.affiliate_application_information_requests[\s\S]*set token_hash/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.require_active_affiliate_portal_request_token_hash[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.submit_affiliate_information_response_from_portal[\s\S]*to service_role/i,
  );
});

test("portal action rendering is gated, private, and covers lifecycle states", async () => {
  const [portalPage, responsePage, config, env] = await Promise.all([
    readFile("app/application-progress/[token]/page.tsx", "utf8"),
    readFile(
      "app/application-progress/[token]/respond/[requestId]/page.tsx",
      "utf8",
    ),
    readFile("lib/config/server.ts", "utf8"),
    readFile(".env.example", "utf8"),
  ]);
  assert.match(portalPage, /isApplicantPortalActionsEnabled\(\)/);
  assert.match(portalPage, /Respond securely/);
  assert.match(portalPage, /Portal link expired/);
  assert.match(portalPage, /Portal link replaced/);
  assert.match(portalPage, /Your gym has been approved/);
  assert.match(portalPage, /A decision has been made/);
  assert.match(responsePage, /unstable_noStore as noStore/);
  assert.match(responsePage, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(responsePage, /referrer: "no-referrer"/);
  assert.match(responsePage, /isApplicantPortalActionsEnabled\(\)/);
  assert.match(config, /APPLICANT_PORTAL_ACTIONS_ENABLED/);
  assert.match(env, /APPLICANT_PORTAL_ACTIONS_ENABLED=false/);
});

test("portal credentials flow through submission and verified file uploads", async () => {
  const [form, action, attachmentRoute] = await Promise.all([
    readFile("app/application-response/[token]/ResponseForm.tsx", "utf8"),
    readFile("app/application-response/[token]/actions.ts", "utf8"),
    readFile("app/api/application-response/attachment/route.ts", "utf8"),
  ]);
  assert.match(form, /credentialKind: "portal"/);
  assert.match(form, /portalToken: credential\.token/);
  assert.match(form, /requestId: credential\.requestId/);
  assert.match(action, /getPortalInformationRequest\(tokenValue, requestId as string\)/);
  assert.match(action, /submit_affiliate_information_response_from_portal/);
  assert.match(attachmentRoute, /getPortalInformationRequest\(token, requestId\)/);
  assert.match(
    attachmentRoute,
    /create_affiliate_information_attachment_upload_from_portal/,
  );
  assert.match(
    attachmentRoute,
    /finalize_affiliate_information_attachment_from_portal/,
  );
  assert.match(attachmentRoute, /validateFile\(/);
  assert.match(attachmentRoute, /\.download\(attachment\.storage_path\)/);
});

test("portal data lookup binds request to the active portal application", async () => {
  const source = await readFile(
    "lib/application/information-response-server.ts",
    "utf8",
  );
  assert.match(source, /hashApplicantPortalToken\(portalToken\)/);
  assert.match(source, /\.eq\("id", requestId\)/);
  assert.match(source, /\.eq\("application_id", access\.application_id\)/);
  assert.match(source, /!access\.activated_at/);
  assert.match(source, /access\.revoked_at/);
  assert.doesNotMatch(
    source,
    /internal_notes|created_by_email|contact_person|phone|storage_path|access_url/,
  );
});
