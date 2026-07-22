# Batch 1A.2 — Direct Private Resumable Uploads

## Outcome

Application file bytes upload from the browser directly to the private Supabase Storage TUS endpoint. Vercel receives only small JSON requests for session creation and finalization. The server issues exact object paths, verifies the completed private objects, persists the application, and sends notifications.

## Required release order

1. Confirm the current database backup and export the active Storage policies.
2. In Supabase Authentication, enable anonymous sign-ins for the project.
3. Apply `supabase/migrations/20260721000000_batch_1a2_resumable_upload_sessions.sql`.
4. Verify the session table, helper function, index, and exact-path Storage INSERT policy. Inspect existing `storage.objects` policies and remove any pre-existing broad authenticated INSERT/UPDATE policy; the exact-path policy must be the only applicant write path.
5. Deploy the matching application commit.
6. Run one controlled submission with files whose combined size is greater than Vercel's 4.5 MB request limit.
7. Verify the application, private attachments, notifications, and cleanup behavior.

Do not deploy the new form before the migration and anonymous sign-ins are ready. The current legacy multipart endpoint remains available only as a transition path for already-cached clients.

## Security invariants

- The browser never receives the Supabase secret/service-role key.
- The anonymous applicant receives a normal short-lived Supabase access token.
- Storage RLS permits INSERT only when the object path exactly matches an unexpired pending session owned by `auth.uid()`.
- Applicants receive no Storage SELECT policy and cannot enumerate or download attachments.
- Object paths are generated server-side and contain no trusted raw filename.
- Finalization re-downloads each expected object with the service role and repeats size, extension, MIME-family, and signature validation.
- Finalization accepts only a session owned by the presented Supabase user.
- A reused idempotency key with changed form or file metadata is rejected.
- Signed admin access remains unchanged.

## Controlled verification

1. Select a 4–5 MB logo, at least one 6–8 MB facility photo, and optionally a 6–10 MB fighter-list document.
2. Submit from Production and confirm visible percentage progress.
3. Interrupt the connection during a file, restore it, and retry. Confirm the TUS client resumes the prior upload.
4. Confirm the final application response contains a `BKFC-GYM-*` reference.
5. Confirm the database row stores only private object paths.
6. Confirm admin signed links open while direct unsigned/public URLs fail.
7. Confirm internal and controlled test-mode emails arrive.
8. Confirm Vercel's registration requests contain JSON rather than multipart file bodies.
9. Let a test session expire, start another controlled session, and confirm opportunistic cleanup removes the expired objects and marks the session `expired`.

## Supabase checks

```sql
select
  to_regclass('public.affiliate_application_upload_sessions') is not null as session_table_present,
  to_regprocedure('public.can_upload_affiliate_application_object(text)') is not null as helper_present,
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'affiliate upload session insert'
  ) as upload_policy_present,
  (select public = false from storage.buckets where id = 'affiliate-applications') as bucket_is_private;
```

All four values must be `true`.

## Rollback

Roll back application code first so no active browser expects the session endpoints. Then:

```sql
drop policy if exists "affiliate upload session insert" on storage.objects;
drop function if exists public.can_upload_affiliate_application_object(text);
drop table if exists public.affiliate_application_upload_sessions;
```

Disabling anonymous sign-ins is safe after the old deployment is restored. Do not delete application objects or `affiliate_applications` rows during rollback.

## Broad-traffic follow-up

The Turnstile-before-anonymous-auth flow and scheduled retention policy are implemented by the next migration and application release. Complete [TURNSTILE_CLEANUP_OPERATIONS.md](TURNSTILE_CLEANUP_OPERATIONS.md) before broad promotional traffic.
