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
