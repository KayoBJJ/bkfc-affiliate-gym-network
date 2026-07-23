import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260723000000_batch_1a3_audit_and_notification_outbox.sql";
const actionsPath = "app/admin/applications/[id]/actions.ts";

test("Batch 1A.3 audit storage is private and append-only", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(
    migration,
    /alter table public\.affiliate_application_audit_events enable row level security/i
  );
  assert.match(
    migration,
    /revoke all on table public\.affiliate_application_audit_events from anon, authenticated/i
  );
  assert.match(
    migration,
    /before update or delete on public\.affiliate_application_audit_events/i
  );
  assert.match(migration, /raise exception 'Affiliate application audit events are append-only'/i);
});

test("workflow transition is one database operation and records the authenticated admin", async () => {
  const [migration, actions] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(actionsPath, "utf8"),
  ]);

  assert.match(migration, /for update/i);
  assert.match(migration, /insert into public\.application_stage_history/i);
  assert.match(migration, /insert into public\.affiliate_application_audit_events/i);
  assert.match(actions, /\.rpc\("admin_transition_affiliate_application"/);
  assert.match(actions, /p_actor_user_id: adminUser\.id/);
  assert.match(actions, /p_actor_email: adminUser\.email!/);
  assert.doesNotMatch(
    actions,
    /\.from\("affiliate_applications"\)[\s\S]*\.update\(\{\s*review_stage/
  );
});

test("notification intent is deduplicated and blocked until Lubo's copy is approved", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /dedupe_key text not null unique/i);
  assert.match(migration, /delivery_status text not null default 'blocked_copy_pending'/i);
  assert.match(migration, /'reason', 'official_copy_not_approved'/i);
  assert.doesNotMatch(migration, /resend|sendgrid|mailgun/i);
});

test("no-op workflow and note saves do not create duplicate audit activity", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(
    migration,
    /v_application\.review_stage is not distinct from p_review_stage[\s\S]*v_application\.status is not distinct from p_status/i
  );
  assert.match(
    migration,
    /v_previous_notes is not distinct from v_next_notes[\s\S]*return false/i
  );
});

test("the database rejects mismatched review-stage and status pairs", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /\('submitted', 'new'\)/);
  assert.match(migration, /\('follow_up_required', 'pending_info'\)/);
  assert.match(migration, /\('activated_affiliate', 'active'\)/);
  assert.match(
    migration,
    /raise exception 'Review stage and application status do not match'/i
  );
});

test("Batch 1A.3 database functions are service-role only", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(
    migration,
    /revoke all on function public\.admin_transition_affiliate_application[\s\S]*from public, anon, authenticated/i
  );
  assert.match(
    migration,
    /grant execute on function public\.admin_transition_affiliate_application[\s\S]*to service_role/i
  );
  assert.match(
    migration,
    /revoke all on function public\.admin_update_affiliate_application_notes[\s\S]*from public, anon, authenticated/i
  );
});
