# Batch 1A.3 Operations

## Current implementation boundary

This slice adds the reliable foundation for the admin decision workflow:

- atomic application stage/status changes;
- authenticated-admin attribution;
- append-only audit events;
- audited internal-note changes without copying note text into the audit table;
- deduplicated applicant-notification intent.

It deliberately does **not** send status emails. Lubo's final subjects, bodies, calls to
action, and signature are the source of truth. Until those are approved, notification
outbox rows remain `blocked_copy_pending`.

## Safe rollout order

1. Back up the Supabase database or confirm point-in-time recovery is available.
2. Review and apply
   `supabase/migrations/20260723000000_batch_1a3_audit_and_notification_outbox.sql`.
3. Confirm both new tables have RLS enabled and no `anon` or `authenticated` grants.
4. Deploy the matching application code.
5. Sign in as an allowlisted admin and use the golden application
   `BKFC-GYM-D58A32FBC475`.
6. Save unchanged notes and confirm no audit event is created.
7. Change notes and confirm exactly one `internal_notes_updated` event records the
   admin identity but not the note body.
8. Move the application to `under_review` and confirm one stage-history row and one
   `stage_changed` audit event are created.
9. Repeat the same transition and confirm no duplicate rows are created.
10. Move to `follow_up_required` and confirm one notification outbox row is created
    with `blocked_copy_pending`; confirm no applicant email is delivered.

## Rollback boundary

Do not drop the audit or outbox tables after they contain production records. Application
code can be rolled back independently because the migration only adds tables and
functions. The existing application columns and protected storage paths are unchanged.

## Next controlled slice

After Lubo approves the copy:

1. add versioned templates;
2. add a secured, expiring more-information response link;
3. implement a retry-safe outbox worker;
4. activate only the approved notification types;
5. retain controlled test routing until HQ approves production sender and recipients.

## Secure information-response slice

The second migration adds a text-only, token-scoped applicant response flow. Raw bearer
tokens are shown once to the creating admin for controlled testing and are never stored
in the database. Only SHA-256 token hashes are persisted.

Safe rollout order:

1. Keep `INFORMATION_RESPONSE_ENABLED=false` in Vercel.
2. Apply
   `supabase/migrations/20260723010000_batch_1a3_secure_information_response.sql`
   inside an explicit transaction.
3. Verify RLS is enabled on all three new tables.
4. Verify only `service_role` can execute the three new functions.
5. Add `INFORMATION_RESPONSE_ENABLED=true` to local `.env.local` and restart development.
6. Create a request against the golden application and open the one-time test link.
7. Submit a text response and verify the request becomes `responded`, the application
   returns to `under_review`, and the audit/outbox records are created once.
8. Keep the production flag false until applicant-facing copy and the production
   delivery workflow are approved.

Attachments are intentionally excluded from this slice. They require generated private
paths and direct-to-storage signed uploads so files never transit Vercel's request body.
