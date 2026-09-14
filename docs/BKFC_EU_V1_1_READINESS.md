# BKFC EU v1.1 local implementation — September 14, 2026

Target: joint staging readiness September 18, 2026, end of day Europe/Sofia. This is not production approval.


## Current verification — successful user-run rehearsal

Verified from the saved logs after the launcher fix at `ac4614b`:

- Full application suite: **190 passed, 0 failed, 0 skipped**.
- Disposable offline PostgreSQL rehearsal: **passed**, including the third forward migration for private logo-upload intents and its database assertions.
- Both v1.1 lifecycle and C1–C7 control persistence assertions passed.
- The combined application previously passed type checking and production build; the launcher fix changes no application runtime code.
- This clears the local networking-test and database-rehearsal verification gaps. It does not establish authenticated browser, actual Storage service, staging-schema parity or joint BKFC/Stripe verification.

Next: authenticated desktop/mobile operator checks and actual signed Storage uploads, followed by coordinated staging checks once AJ's contract/order clarifications are settled. Callback enablement, staging migration/deployment and production remain outside the actions performed here.

The sections below retain earlier session history; this current verification supersedes their pending local database/test status.

## Verification follow-up: database launcher startup race

The user-run full suite passed all 189 tests. The database rehearsal stopped after bootstrap with “the database system is shutting down”, before migration verification completed. The launcher previously checked the local socket, which can accept connections on the image's temporary initialization server. It now waits for TCP readiness inside the same offline container and captures container logs on failure. A mocked startup-sequence regression test passed; this is launcher evidence, not a real database rehearsal. The suite now contains 190 tests. Rerun the saved verification launcher to finish database verification.

## Continuation: UI integration and large logo uploads

The six existing UI files were copied exactly into the isolated integration checkout and committed as `4decf3f`. They still match the original source byte for byte; all five original screenshots remain in the original checkout.

The Vercel dashboard showed the existing v1 preview. Read-only Supabase inspection confirmed that `wvhkcauubklyzbhmfkrh` is “BKFC Affiliate Gym Program - Staging”, is healthy, and reports `bkfc_payment_cycle_isolation` as its latest migration. The user's originally open project `qspxmkanopohzsvrnktv` is production and was left untouched.

Vercel documents a 4.5 MB function request limit: https://vercel.com/docs/functions/limitations. The logo implementation now uses a dedicated private Storage bucket and upload-only signed tokens. The browser sends image bytes directly to Storage, then sends a small finalization request. The server verifies operator/application ownership, expiry, listing version, size, SHA-256 and image signature before putting immutable bytes into the existing durable command queue. No BKFC bearer is exposed to the browser. The server-action limit is back to 1 MB; frozen O1 behavior is unchanged.

New forward migration: `20260914020000_bkfc_control_logo_uploads.sql`. It creates the private bucket and rate-limited, operator-bound upload intents. No remote migration or upload was performed. Temporary objects remain private; a reviewed retention/cleanup policy is still needed before sustained use. Existing cleanup remains unchanged.

Current verification: combined type check and production build passed. 188 offline tests passed, including five new metadata and actual upload-preparation action tests with mocked authentication/Storage dependencies. The suite now contains 189 tests; the pre-existing local-network redirect test was excluded after its listener was denied by the current sandbox. It passed in the previous session, but that is not a fresh combined-suite result.

The first two migrations passed PostgreSQL rehearsals in the earlier session. The NEW upload migration and its added database assertions have NOT been executed: Docker socket access is denied in this session. Authenticated desktop/mobile browser testing also remains pending. Opening a static local layout fixture was rejected by the browser URL security policy; no alternate browser route was used to circumvent it. The fixture is not browser QA evidence.

Next executable checks: rerun `npm run test:db` with Docker access; run the complete `npm test` with local networking available; exercise actual authenticated desktop/mobile controls and direct uploads (including 10 MiB, interrupted upload, mismatched hash, version change and non-admin requests). Then proceed to the existing AJ/staging checklist below. No deployment or enablement is authorized by this continuation.

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

## Verification from the first implementation session

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
3. Rehearse the new private Storage upload migration, then verify direct 10 MiB logo uploads on the actual hosting path. O1 remains limited to its frozen formats and 3 MiB.
4. Obtain AJ's contract cleanup, queued-event inventory and ordered recovery evidence. Capture C1–C7 fixtures including request IDs, versions, response codes, lost-response replays and delisted reads.
5. Only with coordinated staging authorization: apply the reviewed staging migrations, deploy the application, and enable the explicitly agreed switches/window. C7 must not be used to guess around an unresolved ordering issue.
6. Prove O1 → I1 → payment_paid callback → guarded activation → C4 confirmed visibility, plus reversal, cancellation, overdue/recovery, subscription termination, stale edits, timeout replay and C7 order. Record sanitized evidence and remaining owners.

Production deployment, live migration and live payments remain separate approvals.

## 🧾 Agent Session Log

Completed: isolated lifecycle/control implementation; preserved admin UI integrated; direct-to-Storage logo code implemented; type check/build, all 190 tests and the complete offline database rehearsal passed.

Pending: authenticated panel/direct-upload verification, actual staging-schema rehearsal, AJ clarifications and joint staging evidence. Local database rehearsal and all 190 tests now pass.

Next: review the patch with the existing admin work and resolve the listed staging dependencies before any enablement.
