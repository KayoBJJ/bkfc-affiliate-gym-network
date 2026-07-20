-- Batch 1A: review and apply before deploying the matching application code.
-- Backward compatible: legacy public URL columns remain unchanged.

alter table public.affiliate_applications
  add column if not exists application_reference text,
  add column if not exists idempotency_key uuid,
  add column if not exists payload_hash text,
  add column if not exists normalized_gym_name text,
  add column if not exists normalized_email text,
  add column if not exists logo_path text,
  add column if not exists gym_photo_paths text[],
  add column if not exists fighter_list_path text;

create unique index if not exists affiliate_applications_idempotency_key_uidx
  on public.affiliate_applications (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists affiliate_applications_reference_uidx
  on public.affiliate_applications (application_reference)
  where application_reference is not null;

create index if not exists affiliate_applications_duplicate_window_idx
  on public.affiliate_applications (normalized_gym_name, normalized_email, created_at desc)
  where normalized_gym_name is not null and normalized_email is not null;

create table if not exists public.affiliate_application_rate_limits (
  id bigint generated always as identity primary key,
  identifier_kind text not null check (identifier_kind in ('origin', 'idempotency', 'email')),
  identifier_hash text not null check (length(identifier_hash) = 64),
  created_at timestamptz not null default now()
);

create index if not exists affiliate_application_rate_limits_lookup_idx
  on public.affiliate_application_rate_limits (identifier_kind, identifier_hash, created_at desc);

alter table public.affiliate_application_rate_limits enable row level security;

create or replace function public.check_affiliate_application_rate_limit(
  p_origin_hash text,
  p_idempotency_hash text,
  p_email_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if length(p_origin_hash) <> 64 or length(p_idempotency_hash) <> 64 or length(p_email_hash) <> 64 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_origin_hash));
  delete from public.affiliate_application_rate_limits where created_at < v_now - interval '25 hours';

  if (select count(*) from public.affiliate_application_rate_limits where identifier_kind = 'origin' and identifier_hash = p_origin_hash and created_at >= v_now - interval '10 minutes') >= 5
    or (select count(*) from public.affiliate_application_rate_limits where identifier_kind = 'origin' and identifier_hash = p_origin_hash and created_at >= v_now - interval '24 hours') >= 20
    or (select count(*) from public.affiliate_application_rate_limits where identifier_kind = 'email' and identifier_hash = p_email_hash and created_at >= v_now - interval '24 hours') >= 5
    or (select count(*) from public.affiliate_application_rate_limits where identifier_kind = 'idempotency' and identifier_hash = p_idempotency_hash and created_at >= v_now - interval '10 minutes') >= 3
  then
    return false;
  end if;

  insert into public.affiliate_application_rate_limits (identifier_kind, identifier_hash)
  values ('origin', p_origin_hash), ('idempotency', p_idempotency_hash), ('email', p_email_hash);
  return true;
end;
$$;

revoke all on function public.check_affiliate_application_rate_limit(text, text, text) from public;
grant execute on function public.check_affiliate_application_rate_limit(text, text, text) to service_role;

-- Making the bucket private does not delete objects or change object keys.
update storage.buckets
set public = false
where id = 'affiliate-applications';
