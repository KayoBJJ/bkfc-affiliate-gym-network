# BKFC EU v1.1 local implementation — September 14, 2026

Target: joint staging readiness September 18, 2026, end of day Europe/Sofia. This is not production approval.

## Scope and isolation

Implemented in an isolated local clone, branch `feat/bkfc-eu-v1-1`, based on `f59892f9e2982a70e78efb744ee3d89c475659ea`. The original checkout's six modified UI files and five untracked screenshots were preserved. No environment files or credentials were copied. No callbacks, payment delivery, live migrations, deployment, or outbound messages were enabled or performed.

## Implemented

- Forward subscription migration; accepts the three additive events with contractVersion 1. Keeps the original paymentRequestId throughout a lifecycle and excludes superseded lifecycle events from current state.
- Initial paid evidence, latest renewal, overdue observation and subscription termination stored separately. Renewals cannot create first-payment evidence or reopen an ended subscription. Review/activation and public visibility are not changed by billing callbacks.
- Existing cancellation, reissue and worker routines protect `past_due` as financially completed. Existing approved-and-paid activation guards and v1 late financial evidence behavior remain.
- All callbacks commit their event and reservation outcome atomically before acknowledgement. Ignored events remain in the immutable event ledger. Exact replays retain the original response; conflicting hashes fail.
- Authenticated C1–C7 transport; stable UUID idempotency key for every command including PUT/PATCH, If-Match for listing/logo edits, bounded response parsing, explicit expected response codes/outcomes, no redirects and capped retries.
- Durable, immutable control queue with per-attempt outcomes, exclusive unresolved command per gym, fenced claims, uncertain outcomes and same-identity operator retries. Older completions cannot overwrite newer visibility. Billing/visibility mutations stop if the payment lifecycle changes; publication is rechecked against current approval/payment before transmission.
- C1 snapshots, C4-confirmed visibility and C5-requested cancellation mode are separate from callback billing state. A successful C5 does not fabricate a subscription-ended callback. C6 marks terminal delisting; C1 remains available afterward.
- Admin panel controls: refresh, changed-field edits, logo replacement, explicit visibility, both cancellation modes, confirmed delisting, parked-delivery recovery, retry reconciliation and recent command outcomes.
- Separate `BKFC_GYM_CONTROL_DELIVERY_ENABLED=false` default and protected cron route. Payment callback and payment delivery switches retain their existing disabled defaults.

## Verification

- 184 Node tests pass (174 existing plus 10 v1.1 tests).
- Type checking and production build pass.
- `npm run test:db` passes using PostgreSQL 17.6 in an offline, disposable Docker container. It applies all prior migrations to a synthetic bootstrap, creates v1 regression fixtures, upgrades the populated database through both forward migrations, then exercises lifecycle and control persistence assertions. The container is removed afterward.
- Database assertions cover first-payment activation, repeated renewals, overdue/recovery, manual review preservation, terminal cancellation, replay/conflict, old timestamps, all three superseded-cycle events, refunds, permissions, stale edits, competing claims, old claim tokens, uncertain command ordering, cancellation mode separation, delisting, immutable identities and replacement-lifecycle transmission guards.
- The bootstrap models pre-migration application/Auth/Storage tables. It is not a staging schema dump and does not test Supabase Auth or Storage services. No authenticated browser session or joint BKFC/Stripe flow has been exercised in this implementation task.

## Decisions still requiring reconciliation

- AJ: confirm delivery gating/queued inventory; whether parked events block successors; C7 ordering; inconsistent idempotency requirements; C1 delisted exception and endpoint parity.
- EU/AJ: refund versus continuing subscription, cancellation while past due, and invoice behavior on delisting. No grace period or automatic visibility restoration was added.
- Until refund behavior is agreed, a renewal following a refund is durably recorded without applying it; subscription-ended evidence can still be recorded without erasing refund evidence. Inspect/reconcile these records before release.
- With no sequence number, lifecycle events at or before the applied event watermark are recorded as stale. Equal timestamps need contract confirmation or a reconciliation procedure; no arbitrary tie-break is invented. Frozen v1 late financial evidence remains a separate exception.
- If approval or lifecycle changes while a remote outcome is unknown, retries are stopped for reconciliation rather than sending an obsolete decision. The UI exposes the unresolved command; it does not offer an unsafe force-success/skip action.

## Required staging work

1. Review both forward migrations and rehearse against a sanitized copy of the actual staging schema/data. Inspect existing payment evidence and the deployed role grants.
2. Combine/review the integration branch with the preserved admin UI work; perform authenticated desktop/mobile operator testing. Confirm disabled controls, admin-only actions, stale field re-review, slow/failed requests, logo replacement and uncertain command messaging.
3. Verify deployed upload/body limits before claiming 10 MiB logo support end to end. The transport and local server-action limit support C3's 10 MiB image; the hosting path may require direct upload to support the full size. O1 remains limited to its frozen formats and 3 MiB.
4. Obtain AJ's contract cleanup, queued-event inventory and ordered recovery evidence. Capture C1–C7 fixtures including request IDs, versions, response codes, lost-response replays and delisted reads.
5. Only with coordinated staging authorization: apply the reviewed staging migrations, deploy the application, and enable the explicitly agreed switches/window. C7 must not be used to guess around an unresolved ordering issue.
6. Prove O1 → I1 → payment_paid callback → guarded activation → C4 confirmed visibility, plus reversal, cancellation, overdue/recovery, subscription termination, stale edits, timeout replay and C7 order. Record sanitized evidence and remaining owners.

Production deployment, live migration and live payments remain separate approvals.

## 🧾 Agent Session Log

Completed: isolated implementation, forward migrations, C1–C7 queue/transport/panel, local behavioral verification and reviewable patch preparation.

Pending: actual staging-schema rehearsal, authenticated panel verification, AJ clarifications, upload-limit verification and joint staging evidence.

Next: review the patch with the existing admin work and resolve the listed staging dependencies before any enablement.
