# BKFC Affiliate Gym Network

Production Next.js intake site for gym affiliate applications, backed by Supabase Postgres, private Supabase Storage, anonymous upload sessions, and controlled email delivery.

## Local development

1. Copy `.env.example` to `.env.local` and supply local/test credentials.
2. Install dependencies with `npm install`.
3. Run `npm run dev` and open `http://localhost:3000`.

Cloudflare publishes always-pass and always-fail Turnstile test keys for local automated testing. Never use production secrets in local files or commits.

## Production submission flow

1. The browser renders Cloudflare Turnstile explicitly in the existing registration form.
2. The challenge API verifies the single-use, five-minute Turnstile token with Cloudflare, including its action and exact hostname, then returns a short-lived signed proof bound to the form idempotency key and hostname.
3. Only after successful verification does the browser create or reuse its Supabase anonymous identity. The upload-session API validates the signed proof, form/file metadata, rate limits, and duplicates before issuing exact private Storage paths.
4. The browser uploads directly to Supabase Storage with resumable TUS uploads.
5. The finalize API re-downloads and validates each object, persists the application, marks the session finalized, and triggers controlled notifications.

## Abandoned-data cleanup

Vercel Cron calls `GET /api/cron/application-cleanup` daily with `Authorization: Bearer $CRON_SECRET`. Cleanup defaults to dry-run and uses configurable retention windows. Before deleting an abandoned session's objects, it calls a service-role-only database function that checks all permanent application asset columns. Linked assets are retained and logged. Finalized session metadata may age out, but its application assets are never removed by this job.

See [docs/TURNSTILE_CLEANUP_OPERATIONS.md](docs/TURNSTILE_CLEANUP_OPERATIONS.md) for migration order, dashboard configuration, dry-run verification, rollout, and rollback.

## Verification

```bash
npm test
npm run type-check
npm run build
```

## Security notes

- The browser receives only the public Supabase anon key and its own short-lived anonymous session.
- The Supabase service-role key, Turnstile secret/proof secret, rate-limit secret, and cron secret are server-only and independent.
- Private applicant files have no applicant SELECT policy.
- Structured application and cleanup logs omit applicant values, filenames, tokens, IPs, and provider responses.
- The legacy multipart endpoint remains available only for transition compatibility; the current UI uses resumable direct uploads.
