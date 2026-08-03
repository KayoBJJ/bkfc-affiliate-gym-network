# Batch 1B — Applicant Progress Portal

## Product outcome

Give every gym applicant one private place to understand where their application
stands, whether BKFC needs action, and whether a response or replacement file was
received. The portal reduces repetitive status emails while keeping the internal
review process private.

## Slice 1 — implemented

- Admin-generated private portal links
- 256-bit bearer tokens with SHA-256 hashes stored in the database
- One active link per application; regeneration revokes the previous link
- 180-day access period
- Applicant-safe progress mapping for all review stages
- Five-step application pathway and progress indicator
- Current action-required state
- Information-request and response history
- Latest uploaded-file review state and replacement instructions
- No indexing, referrer leakage, internal notes, reviewer identities, private
  file URLs, or raw tokens
- Explicit browser and CDN no-store headers so revoked links cannot display a
  previously rendered portal
- Feature flag: `APPLICANT_PORTAL_ENABLED`
- Append-only audit event when portal access is issued

## Deliberate boundaries

- Batch 1B does not introduce passwords or applicant accounts.
- The existing secure response link remains the only way to submit requested
  information in this slice.
- Batch 1C owns the full gym-focused Document Center.
- Batch 1D owns the authenticated dashboard for approved affiliate gyms.
- Applicant-facing emails remain disabled until Lubo approves official copy.

## Slice 2 — implemented behind disabled flags

- Portal CTA support in the initial application confirmation
- Material-update portal delivery for information requests, replacement requests,
  approvals, rejections, and affiliate activation
- Admin `Email secure portal access` control
- Two-phase email delivery: a candidate link is prepared, but the current link is
  revoked only after the email provider accepts the replacement email
- Provider failure preserves the applicant's existing portal access
- Applicant recovery using application reference, original email, Turnstile,
  generic anti-enumeration responses, and separate origin/identity rate limits
- 30-minute single-use recovery links
- Recovery requests do not revoke current access; successful recovery consumption
  performs the rotation atomically
- Raw portal and recovery tokens never enter database rows, audit details, or logs
- Append-only delivery and recovery audit events
- Feature flags:
  - `APPLICANT_PORTAL_EMAIL_DELIVERY_ENABLED`
  - `APPLICANT_PORTAL_RECOVERY_ENABLED`
- Canonical URL setting: `APPLICATION_PUBLIC_URL`
- Test-mode allowlist: `APPLICANT_PORTAL_TEST_APPLICATION_REFERENCE`

Applicant email copy remains approval-gated. Keep the master
`APPLICANT_EMAIL_DELIVERY_ENABLED` flag disabled until Lubo approves the sender,
reply-to address, and final wording.

## Slice 2 rollout order

1. Keep both Slice 2 flags disabled.
2. Apply
   `20260728000000_batch_1b_portal_delivery_recovery.sql`.
3. Deploy the matching application code.
4. Set `APPLICATION_PUBLIC_URL` to the canonical HTTPS production origin.
5. Keep `APPLICANT_EMAIL_DELIVERY_ENABLED=false` and configure the approved test
   recipient. Set `APPLICANT_PORTAL_TEST_APPLICATION_REFERENCE` to the golden
   application only; test-mode portal delivery fails closed for every other
   application.
6. Enable `APPLICANT_PORTAL_EMAIL_DELIVERY_ENABLED=true`, redeploy, and send portal
   access for the golden application.
7. Confirm the message reaches only the approved test recipient, the new link works,
   and the previous link is revoked only after provider acceptance.
8. Enable `APPLICANT_PORTAL_RECOVERY_ENABLED=true`, redeploy, and complete the
   recovery acceptance tests below.
9. Obtain Lubo's written email-copy and sender approval.
10. Only then set `APPLICANT_EMAIL_DELIVERY_ENABLED=true` and repeat the golden
    application test before enabling real applicant use.

## Slice 2 recovery acceptance test

1. Request recovery for `BKFC-GYM-D58A32FBC475` with the correct original email.
2. Confirm the page displays the generic response.
3. Repeat with incorrect details and confirm the response is identical.
4. Confirm the correct request reaches only the approved test recipient.
5. Confirm merely requesting recovery leaves the current portal link active.
6. Open the recovery email and confirm it redirects into the correct portal.
7. Confirm the previous portal link is now unavailable.
8. Confirm the recovery link cannot be reused.
9. Confirm an expired recovery link is unavailable.
10. Confirm the fourth identity request and sixth origin request in one hour do not
    generate another email.
11. Confirm the audit timeline contains recovery request, email acceptance, portal
    issuance, and completed recovery without applicant email or raw URL details.

## Rollout order

1. Apply `20260726000000_batch_1b_applicant_progress_portal.sql`.
2. Deploy with `APPLICANT_PORTAL_ENABLED=false`.
3. Set `APPLICANT_PORTAL_ENABLED=true` in the production environment and redeploy.
4. Open the golden application and generate its portal link.
5. Complete the acceptance test below before sharing any real applicant link.

## Golden application acceptance test

Use `BKFC-GYM-D58A32FBC475`.

1. Generate a progress portal link in the admin application view.
2. Confirm the link shows the correct gym, reference, submission date, and current
   applicant-safe stage.
3. Confirm internal notes, reviewer emails, audit details, and private downloads
   do not appear.
4. Move the application through review stages and confirm the portal reflects
   the mapped progress after refresh.
5. Create an information request and confirm the portal shows `Action required`.
6. Submit a response through the existing secure response link and confirm the
   portal shows `Response received`.
7. Request a replacement and confirm the instructions and latest file version
   appear.
8. Generate a new portal link and confirm the old link returns not found.
9. Confirm the audit trail records `Applicant progress portal link generated`.

## Slice 3 — implemented behind a disabled flag

- Active portal access can open the current information request directly
- Portal authorization is bound to the request and application in the database
- Portal submission wrappers reuse the existing audited text-response and
  versioned-file functions
- Existing emailed response links are not rotated, replaced, or exposed
- Text, file, and combined responses use the existing private upload and file
  verification path
- Revoked, expired, unactivated, cross-application, and non-current portal actions
  fail closed
- Portal and emailed-link response replays retain the same safe success behavior
- Accessible portal states cover empty history, expired access, replaced access,
  expired requests, replaced requests, approvals, rejections, and activation
- Feature flag: `APPLICANT_PORTAL_ACTIONS_ENABLED`

Keep `APPLICANT_PORTAL_ACTIONS_ENABLED=false` until the Slice 3 migration has been
applied and the golden-application acceptance test has passed. This flag does not
enable applicant email delivery.

## Slice 3 rollout order

1. Keep `APPLICANT_PORTAL_ACTIONS_ENABLED=false`.
2. Review and apply
   `20260803000000_batch_1b_portal_actions.sql`.
3. Deploy the matching application code with the flag still disabled.
4. Confirm the read-only Slice 2 portal and existing emailed response links still
   behave normally.
5. Enable `APPLICANT_PORTAL_ACTIONS_ENABLED=true` only in the controlled test
   environment.
6. Use `BKFC-GYM-D58A32FBC475` to complete the acceptance test below.
7. Return the production environment to the approved pre-launch flag state until
   Lubo authorizes applicant use.

## Slice 3 golden-application acceptance test

1. Create an information request and open the application's active portal.
2. Confirm the request shows `Respond securely` only while the application is in
   `follow_up_required` and the request is open.
3. Open the response from the portal and submit a text-only response.
4. Confirm the application returns to review and creates exactly one response,
   stage-history entry, response audit event, and blocked notification intent.
5. Repeat with a file response and confirm the existing private upload, download,
   file-signature validation, and review workflow remain intact.
6. Request a replacement, submit the next file version from the portal, and confirm
   the version sequence remains attached to the same information request.
7. Confirm the original emailed response link remains valid until the request is
   completed and is never rotated merely by opening the portal action.
8. Attempt to pair the portal token with another application's request id and
   confirm it returns unavailable without changing either application.
9. Confirm expired, revoked, replaced, unactivated, and pending-delivery portal
   access cannot upload or submit.
10. Race portal and emailed-link submissions and confirm one completion with a safe
    success response on replay.
11. Confirm expired portal, replaced portal, empty request history, expired request,
    replaced request, approved, rejected, and activated states render accessibly.
12. Confirm logs and audit details contain no raw tokens, response text, applicant
    values, filenames, or private URLs.

## Next slice

### Slice 4 — analytics and operational readiness

- Portal activation, repeat visit, action-completion, and time-to-response metrics
- Admin visibility for issued/expired portal access
- Expiry reminders using Lubo-approved copy
- Production runbook, monitoring, and rollback checks
