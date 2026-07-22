# Turnstile and anonymous-data cleanup operations

## Release order

1. Back up Postgres and export the current `storage.objects` policies.
2. Apply existing migrations through `20260721000000_batch_1a2_resumable_upload_sessions.sql`.
3. Apply `20260722000000_turnstile_and_cleanup_policy.sql` and verify the helper and cleanup index.
4. Complete the Cloudflare, Supabase, and Vercel configuration below.
5. Deploy with `APPLICATION_CLEANUP_DRY_RUN=true`.
6. Complete controlled CAPTCHA, upload, finalize, replay, expiry, and cleanup checks.
7. Review at least one scheduled dry-run log and the candidate counts.
8. Set `APPLICATION_CLEANUP_DRY_RUN=false`, redeploy, and monitor the next run before promotional traffic.

Do not deploy the new form before Turnstile variables are present: configuration fails closed and applicants will see a clear unavailable state.

## Dashboard configuration

### Cloudflare Turnstile

Create a Managed widget and configure every exact hostname that may submit applications. Use separate widgets for Production and non-production environments when possible. Keep pre-clearance disabled unless a separate Cloudflare design requires it. Copy:

- site key to `NEXT_PUBLIC_TURNSTILE_SITE_KEY`;
- secret key to `TURNSTILE_SECRET_KEY`;
- a separate random signing key to `TURNSTILE_PROOF_SECRET`;
- comma-separated exact widget hostnames to `TURNSTILE_EXPECTED_HOSTNAMES`.

The server requires action `affiliate_registration`, an allowlisted hostname that also matches the request hostname, and a challenge timestamp no older than five minutes. Cloudflare Siteverify enforces token signature, single use, and expiry. After verification, the server issues a five-minute HMAC proof bound to the application idempotency key and hostname. The browser creates its anonymous Auth session only after receiving that proof, so Supabase sees the applicant's network path rather than concentrating Auth rate limits on Vercel. The upload endpoint validates the proof before any session is issued, and database idempotency independently prevents duplicate applications.

### Supabase

- Keep anonymous sign-ins enabled.
- Apply both upload-session migrations and confirm the `affiliate-applications` bucket is private.
- Confirm the exact-path INSERT policy is the only applicant Storage write policy and there is no applicant Storage SELECT policy.
- Do not separately enable Supabase Auth CAPTCHA for this flow. The Next.js challenge endpoint already verifies Turnstile before the browser creates its anonymous Auth session; enabling a second Auth-layer challenge would require a second token and break this sequence.
- Keep the service-role key only in Vercel server-side environment variables.

The cleanup helper is executable only by `service_role` and checks `logo_path`, `fighter_list_path`, and every element of `gym_photo_paths` before Storage deletion.

### Vercel

Add all variables from `.env.example` to the correct Production/Preview scopes. Generate independent random values for `TURNSTILE_PROOF_SECRET`, `RATE_LIMIT_HASH_SECRET`, and `CRON_SECRET`; do not reuse Supabase, Turnstile, or email credentials. Vercel Cron automatically sends the configured `CRON_SECRET` as a bearer token. Confirm the plan supports the daily schedule in `vercel.json`.

Recommended initial retention values:

- abandoned pending/finalizing sessions: 24 hours after their one-hour upload expiry;
- failed/expired sessions: 24 hours after their last update;
- finalized upload-session metadata: 30 days;
- session-free anonymous users: 7 days;
- maximum work per category per run: 50 records.

## Controlled verification

1. Submit once with a valid Turnstile challenge and confirm the `CAPTCHA_VERIFIED`, `UPLOAD_SESSION_CREATED`, and `APPLICATION_RECEIVED` structured events.
2. Use Cloudflare's failure/expired test paths and confirm no anonymous user or upload session is created.
3. Attempt to reuse a consumed token and confirm `CAPTCHA_INVALID`; verify no duplicate application is created.
4. Complete a large resumable upload and confirm private attachments and admin signed access still work.
5. Create an expired test session with unlinked test objects. Invoke the endpoint manually:

```bash
curl --fail-with-body \
  --header "Authorization: Bearer $CRON_SECRET" \
  https://your-production-hostname.example/api/cron/application-cleanup
```

6. In dry-run, verify candidate counts increase but Storage, sessions, and users do not change.
7. Link one candidate object path to a valid test application and confirm `LINKED_ASSET_PROTECTED` is logged and nothing in that session is deleted.
8. Enable destructive mode, rerun, and verify only unlinked expired test data is removed.
9. Confirm an unauthenticated or incorrectly authenticated cleanup request returns `401`.

Logs use event name `affiliate_application_cleanup` and stable codes/counts. Alert on `failures > 0`, `CLEANUP_CONFIGURATION_FAILED`, repeated `LINKED_ASSET_PROTECTED`, or scheduled-run absence.

## SQL verification

```sql
select
  to_regprocedure('public.affiliate_application_asset_is_linked(text)') is not null as asset_guard_present,
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'affiliate_upload_sessions_cleanup_idx'
  ) as cleanup_index_present;
```

Both values must be `true`.

## Rollback

1. Set `APPLICATION_CLEANUP_DRY_RUN=true` immediately.
2. Roll back the application deployment and remove or disable the cron schedule.
3. If the helper must be removed after the old deployment is active:

```sql
drop function if exists public.affiliate_application_asset_is_linked(text);
drop index if exists public.affiliate_upload_sessions_cleanup_idx;
```

Rollback does not require deleting any application, upload session, anonymous user, or Storage object.
