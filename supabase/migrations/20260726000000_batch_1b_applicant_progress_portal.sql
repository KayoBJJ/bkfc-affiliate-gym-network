-- Batch 1B, slice 1: secure applicant progress portal.
-- Portal bearer tokens are shown once and only SHA-256 hashes are persisted.

alter table public.affiliate_application_audit_events
  drop constraint if exists affiliate_application_audit_events_event_type_check;
alter table public.affiliate_application_audit_events
  add constraint affiliate_application_audit_events_event_type_check check (
    event_type in (
      'stage_changed',
      'internal_notes_updated',
      'information_request_created',
      'information_request_revoked',
      'information_request_link_reissued',
      'applicant_response_received',
      'information_attachment_uploaded',
      'information_attachment_accepted',
      'information_attachment_replacement_requested',
      'applicant_portal_access_issued',
      'applicant_notification_requested',
      'applicant_notification_sent',
      'applicant_notification_failed'
    )
  );

create table if not exists public.affiliate_application_portal_access (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.affiliate_applications(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_by_user_id uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (expires_at > created_at)
);

create unique index if not exists affiliate_application_portal_one_active_idx
  on public.affiliate_application_portal_access (application_id)
  where revoked_at is null;
create index if not exists affiliate_application_portal_lookup_idx
  on public.affiliate_application_portal_access (token_hash, expires_at)
  where revoked_at is null;

alter table public.affiliate_application_portal_access enable row level security;
revoke all on table public.affiliate_application_portal_access from anon, authenticated;

create or replace function public.admin_issue_affiliate_application_portal_access(
  p_application_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_actor_user_id uuid,
  p_actor_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_id uuid;
  v_replaced_access_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= now()
    or p_expires_at > now() + interval '370 days'
  then
    raise exception 'Invalid portal access request' using errcode = '22023';
  end if;

  perform 1
  from public.affiliate_applications
  where id = p_application_id
  for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  update public.affiliate_application_portal_access
  set revoked_at = now()
  where application_id = p_application_id
    and revoked_at is null
  returning id into v_replaced_access_id;

  insert into public.affiliate_application_portal_access (
    application_id,
    token_hash,
    expires_at,
    created_by_user_id,
    created_by_email
  ) values (
    p_application_id,
    p_token_hash,
    p_expires_at,
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), ''))
  )
  returning id into v_access_id;

  insert into public.affiliate_application_audit_events (
    application_id,
    event_type,
    actor_user_id,
    actor_email,
    details
  ) values (
    p_application_id,
    'applicant_portal_access_issued',
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    jsonb_strip_nulls(jsonb_build_object(
      'portal_access_id', v_access_id,
      'replaced_portal_access_id', v_replaced_access_id,
      'expires_at', p_expires_at
    ))
  );

  return v_access_id;
end;
$$;

revoke all on function public.admin_issue_affiliate_application_portal_access(
  uuid, text, timestamptz, uuid, text
) from public, anon, authenticated;
grant execute on function public.admin_issue_affiliate_application_portal_access(
  uuid, text, timestamptz, uuid, text
) to service_role;
