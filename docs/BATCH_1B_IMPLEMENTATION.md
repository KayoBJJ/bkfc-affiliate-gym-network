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

## Next slices

### Slice 2 — portal delivery and recovery

- Insert the portal CTA into Lubo-approved confirmation and material-update emails
- Add applicant email-based link recovery with anti-enumeration responses,
  rate limits, and single-purpose recovery tokens
- Record delivery and recovery events without exposing applicant data

### Slice 3 — portal actions

- Allow an authenticated portal session to open the current secure request
  directly
- Preserve the one-request/one-version audit model from Batch 1A.3
- Add accessible empty, expired, replaced, approved, and rejected states

### Slice 4 — analytics and operational readiness

- Portal activation, repeat visit, action-completion, and time-to-response metrics
- Admin visibility for issued/expired portal access
- Expiry reminders using Lubo-approved copy
- Production runbook, monitoring, and rollback checks
