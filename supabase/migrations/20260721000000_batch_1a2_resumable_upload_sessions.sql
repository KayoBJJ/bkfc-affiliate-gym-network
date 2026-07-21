-- Batch 1A.2: authorize resumable browser uploads without exposing broad bucket writes.
-- Apply immediately before the matching application deployment.

create table if not exists public.affiliate_application_upload_sessions (
  id uuid primary key,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  application_reference text not null unique,
  idempotency_key uuid not null unique,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  form_payload jsonb not null,
  upload_manifest jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'finalizing', 'finalized', 'expired', 'failed')),
  application_id uuid references public.affiliate_applications(id) on delete set null,
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_upload_sessions_owner_status_idx
  on public.affiliate_application_upload_sessions (uploader_id, status, expires_at);

create index if not exists affiliate_upload_sessions_expiry_idx
  on public.affiliate_application_upload_sessions (expires_at)
  where status in ('pending', 'finalizing');

alter table public.affiliate_application_upload_sessions enable row level security;

-- Applicants never read or mutate session rows directly. The application server uses
-- service_role. Storage uses this helper to authorize only an exact issued object path.
create or replace function public.can_upload_affiliate_application_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.affiliate_application_upload_sessions session
    cross join lateral jsonb_array_elements(session.upload_manifest) item
    where session.uploader_id = auth.uid()
      and session.status = 'pending'
      and session.expires_at > now()
      and item ->> 'path' = object_name
  );
$$;

revoke all on function public.can_upload_affiliate_application_object(text) from public;
grant execute on function public.can_upload_affiliate_application_object(text) to authenticated;

drop policy if exists "affiliate upload session insert" on storage.objects;
create policy "affiliate upload session insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'affiliate-applications'
  and public.can_upload_affiliate_application_object(name)
);

-- No SELECT policy is intentionally added. Applicants can upload but cannot read or
-- enumerate private application files. Admin downloads continue through server-side
-- service-role signed URLs.
