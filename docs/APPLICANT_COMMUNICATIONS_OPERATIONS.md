# Applicant Communication Activation Package

This package prepares safe applicant email delivery without activating it. The migration seeds no copy, releases no queued rows, and the application defaults to a disabled master switch plus dry-run mode.

## Safety model

A queued message can be delivered only when all of these are true:

1. HQ-approved copy exists as an `approved` versioned template.
2. An admin explicitly releases matching blocked rows for one application.
3. `APPLICANT_COMMUNICATIONS_ENABLED=true` with a strong independent token secret.
4. The worker is invoked with the secured cron bearer secret.
5. Delivery routing permits the golden test application or production applicant delivery.

Internal new-application notifications remain independent. The master switch blocks all applicant-facing receipt, portal, recovery, and queued workflow emails. Dry-run mode also keeps every non-worker applicant delivery path blocked while the worker reports counts only.

## Rollout order

1. Keep every new communication flag at its `.env.example` default.
2. Review and manually apply `20260818000000_applicant_communication_activation.sql`.
3. Confirm the admin application page reports zero approved copy types and existing rows remain `blocked_copy_pending`.
4. After Lubo supplies final copy, insert it as `draft`, review the exact rendered output, then approve it using `admin_approve_affiliate_notification_template`.
5. Release only the golden test application using `admin_release_affiliate_notifications`.
6. Configure a new high-entropy `APPLICANT_COMMUNICATION_TOKEN_SECRET`; never reuse another credential.
7. Enable the master switch while keeping dry run on. Invoke the secured endpoint manually and verify counts only.
8. Turn dry run off for the golden application, invoke once, and verify provider delivery, portal access, outbox state, and audit history.
9. Production activation requires a separate explicit decision. The worker route is intentionally absent from `vercel.json`.

## Retry and privacy behavior

Claims are atomic, limited to 25, and stale after 15 minutes. Each row gets at most three attempts with delayed retries. The portal token is derived deterministically from the outbox ID and the independent secret, but only its hash is stored. Resend receives a stable `bkfc-outbox-<id>` idempotency key. Logs and worker responses expose counts and stable error codes, not applicant details or bearer links.

## Emergency stop

Set `APPLICANT_COMMUNICATIONS_ENABLED=false`. Do not delete queue, audit, portal-access, or template records. Investigate through the admin status card and database audit trail, then resume only after the cause is understood.

## Official intake receipt connection (2026-10-01)

The approved Gym Network receipt has a separate, receipt-only scheduled endpoint:
`/api/cron/application-receipts`. The workflow endpoint remains unscheduled.
Apply `20261001000000_bkfc_application_receipts.sql` before enabling this endpoint.
The migration queues one `application_received` message atomically with each new
`source_system='bkfc'` application. It does not backfill existing applications or
change the official intake API contract. Transaction rollback also removes the receipt.
Legacy registration routes retain their existing direct-send behavior.

The receipt uses the approved code template, inline brand attachments, and support
address bkfcgym@bkfc.com. It deliberately contains no portal link: receiving an
application does not enable portal access. It does not require a database copy
approval or release workflow because this exact receipt was already approved.
Other notifications continue to require approved database copy and explicit release.

Deployment sequence:

1. Apply and verify the migration; deploy code with `BKFC_APPLICATION_RECEIPTS_MODE=disabled`.
2. The user confirmed on 2026-10-01 that AJ's backend does not send emails. Our backend
   owns this receipt; no new API fields or endpoint are needed on AJ's side.
3. Set mode to `dry-run` to inspect the receipt queue without claiming or sending.
4. For a controlled test use mode `test`, set `BKFC_APPLICATION_RECEIPTS_TEST_REFERENCE`
   to one new official-intake test application, and set `BKFC_APPLICATION_RECEIPTS_TEST_RECIPIENT` to the authorized test inbox.
   Inspection and claiming filter to that application before taking attempts. Verify
   one receipt and a recorded provider ID, then replay the submission to check deduplication.
5. Set mode to `live` to deliver new queued receipts to their applicants. This setting
   is independent of the older communication, portal and applicant-delivery flags;
   do not change those flags to activate receipts. Reuses the existing Resend key,
   sender, reply-to and cron bearer secret.

The receipt cron runs every minute, requires the existing cron bearer secret, and
only processes receipt rows. At most three attempts are made, with 5-minute and
30-minute delays. Claims expire after 15 minutes. The provider idempotency key is
stable per outbox row. Automatic retries stop 23 hours after the first attempt to
avoid retrying outside [Resend's 24-hour retention window](https://resend.com/docs/dashboard/emails/idempotency-keys).
Reconcile older uncertain sends with the provider log before manually requeuing;
never clear the first-attempt timestamp without checking delivery. Exhausted failures
and outdated claims require operator attention.

Emergency stop: set `BKFC_APPLICATION_RECEIPTS_MODE=disabled` and redeploy. The older
communication master switch controls the older workflows, not this isolated receipt
sender. New official submissions still queue receipts while sending is disabled;
inspect pending inventory before re-enabling. No historical backfill is performed.
