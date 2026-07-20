# Batch 1A operations

## Controlled email mode

Applicant delivery remains disabled unless `APPLICANT_EMAIL_DELIVERY_ENABLED` is explicitly set to `true`. In disabled mode, the applicant template is marked `[TEST MODE]` and sent only to the explicitly configured `APPLICANT_EMAIL_TEST_RECIPIENT`. The submitted applicant address is never used as that message's recipient. Internal notification is sent separately only to the explicitly configured `INTERNAL_NOTIFICATION_RECIPIENT`. There are no hardcoded or legacy recipient/sender fallbacks. Missing notification configuration skips the affected email capability, logs only a stable code, and never rolls back a stored application.

Set these variables now without documenting their values:

```text
APPLICANT_EMAIL_DELIVERY_ENABLED=false
APPLICANT_EMAIL_TEST_RECIPIENT=<approved controlled test recipient>
APPLICANT_EMAIL_FROM=<currently approved test sender identity>
INTERNAL_NOTIFICATION_RECIPIENT=<approved internal recipient>
RATE_LIMIT_HASH_SECRET=<at least 32 random bytes, stored as a secret>
RESEND_API_KEY=<active server-only provider credential>
```

On Vercel, origin hashing accepts `x-forwarded-for` only when the platform-provided `VERCEL_ENV` is present. For a Cloudflare deployment, set `TRUSTED_PROXY_PROVIDER=cloudflare` only when requests cannot bypass Cloudflare; the server will then accept `cf-connecting-ip`. Other deployments intentionally use a shared `unknown` origin until their trusted proxy contract is implemented, rather than trusting arbitrary forwarding headers.

The database limiter allows a small test burst (up to five accepted attempts per origin in ten minutes), a longer origin window (twenty per day), and tighter email/idempotency windows. Rejections return only `RATE_LIMITED`, never thresholds or identifier data. Only HMAC hashes are persisted, and entries are pruned after the operational window.

HQ production activation later requires all of the following approved values:

```text
APPLICANT_EMAIL_DELIVERY_ENABLED=true
APPLICANT_EMAIL_FROM=<HQ-approved verified sender identity>
APPLICANT_EMAIL_REPLY_TO=<HQ-approved reply-to address>
INTERNAL_NOTIFICATION_RECIPIENT=<HQ-approved internal recipient>
```

Keep `RESEND_API_KEY` configured through the existing secret store. Verify the sender domain in the existing email provider, send a test application, confirm the internal and applicant destinations, confirm reply-to, inspect the subject/body, and only then enable production delivery. Enabled delivery fails closed when the provider key, sender, or reply-to is absent; the stored application is preserved.

## Release order

1. Back up the `affiliate_applications` table, inventory current bucket policies, and use a maintenance window (or briefly pause intake) so the schema/storage change and matching code release are contiguous.
2. Review and apply `supabase/migrations/20260720000000_batch_1a_application_integrity.sql` immediately before the matching code release. It is additive and leaves legacy URL columns intact; do not leave the old public-URL code serving submissions after the bucket becomes private.
3. In Supabase Storage, open `affiliate-applications`, confirm **Public bucket** is off, and remove any `SELECT` policy that grants `anon`, `public`, or all authenticated users unrestricted object access. Do not add an anonymous read policy. The server service role performs uploads, cleanup, and signed-URL creation; it must remain server-only.
4. Confirm a direct unsigned object URL fails for an anonymous browser.
5. Configure the variables above with applicant delivery disabled.
6. Deploy the matching code only after review (deployment is outside this batch).
7. Submit a controlled test and confirm the authenticated admin detail view loads ten-minute signed assets.

If the bucket does not already exist, create a private bucket named `affiliate-applications` in the dashboard before deploying. Do not set a public bucket URL. Suggested bucket-level limits are 10 MB per object and the combined MIME allow-list used by the application: PNG, JPEG, WebP, PDF, Word, and Excel types. Application code enforces the more specific per-field limits.

## Existing records

Legacy `logo_url`, `gym_photo_urls`, and `fighter_list_url` values are neither removed nor rewritten. For legacy URLs belonging to the configured Supabase bucket, the admin server extracts the existing object key and signs it after the bucket becomes private. Other external legacy URLs remain a direct fallback. A later, separately reviewed backfill can populate path columns to remove that parsing fallback; it is not required for same-bucket historical records to remain reviewable.

## Manual verification

- Confirm a new database row has path columns but no new permanent public URLs.
- Confirm all object keys begin with that row's UUID and contain generated UUID filenames.
- Confirm anonymous direct access fails and authenticated admin signed access succeeds.
- Retry the same request/token and confirm one row; change its data and confirm an idempotency conflict.
- Simulate upload and database errors and confirm the request folder is cleaned.
- Simulate email-provider failure and confirm the row remains.
- Confirm test-mode applicant template goes only to the controlled test recipient.
- Confirm success UI displays the localized application reference without an email-delivery promise.
