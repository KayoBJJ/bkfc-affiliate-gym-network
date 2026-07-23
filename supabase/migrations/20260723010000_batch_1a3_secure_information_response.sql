-- Batch 1A.3, slice 2: secure, token-scoped applicant information responses.
-- Text responses only. Private direct-upload attachments require a later migration.

alter table public.affiliate_application_audit_events
  drop constraint if exists affiliate_application_audit_events_event_type_check;
alter table public.affiliate_application_audit_events
  add constraint affiliate_application_audit_events_event_type_check check (
    event_type in (
      'stage_changed',
      'internal_notes_updated',
      'information_request_created',
      'information_request_revoked',
      'applicant_response_received',
      'applicant_notification_requested',
      'applicant_notification_sent',
      'applicant_notification_failed'
    )
  );

alter table public.affiliate_application_notification_outbox
  drop constraint if exists affiliate_application_notification_outbox_notification_type_check;
alter table public.affiliate_application_notification_outbox
  add constraint affiliate_application_notification_outbox_notification_type_check check (
    notification_type in (
      'more_information_required',
      'information_received',
      'approved',
      'rejected',
      'affiliate_activated',
      'manual_applicant_update'
    )
  );

create table if not exists public.affiliate_application_information_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.affiliate_applications(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  request_summary text not null check (length(request_summary) between 1 and 500),
  request_details text check (request_details is null or length(request_details) <= 4000),
  status text not null default 'open' check (status in ('open', 'responded', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_by_user_id uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check ((status = 'responded') = (responded_at is not null))
);

create unique index if not exists affiliate_information_requests_one_open_idx
  on public.affiliate_application_information_requests (application_id)
  where status = 'open';
create index if not exists affiliate_information_requests_lookup_idx
  on public.affiliate_application_information_requests (token_hash, status, expires_at);

create table if not exists public.affiliate_application_information_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique
    references public.affiliate_application_information_requests(id) on delete restrict,
  application_id uuid not null references public.affiliate_applications(id) on delete restrict,
  response_text text not null check (length(response_text) between 1 and 6000),
  submitted_at timestamptz not null default now()
);

create index if not exists affiliate_information_responses_application_idx
  on public.affiliate_application_information_responses (application_id, submitted_at desc);

create table if not exists public.affiliate_information_response_rate_limits (
  id bigint generated always as identity primary key,
  identifier_kind text not null check (identifier_kind in ('origin', 'token')),
  identifier_hash text not null check (identifier_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists affiliate_information_response_rate_limits_lookup_idx
  on public.affiliate_information_response_rate_limits
    (identifier_kind, identifier_hash, created_at desc);

alter table public.affiliate_application_information_requests enable row level security;
alter table public.affiliate_application_information_responses enable row level security;
alter table public.affiliate_information_response_rate_limits enable row level security;

revoke all on table public.affiliate_application_information_requests from anon, authenticated;
revoke all on table public.affiliate_application_information_responses from anon, authenticated;
revoke all on table public.affiliate_information_response_rate_limits from anon, authenticated;

create or replace function public.admin_create_affiliate_information_request(
  p_application_id uuid,
  p_request_summary text,
  p_request_details text,
  p_expires_at timestamptz,
  p_token_hash text,
  p_actor_user_id uuid,
  p_actor_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.affiliate_applications%rowtype;
  v_request_id uuid;
  v_event_id uuid;
  v_outbox_id uuid;
  v_revoked record;
  v_summary text := trim(p_request_summary);
  v_details text := nullif(trim(p_request_details), '');
begin
  if length(v_summary) not between 1 and 500
    or (v_details is not null and length(v_details) > 4000)
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= now()
    or p_expires_at > now() + interval '30 days'
  then
    raise exception 'Invalid information request' using errcode = '22023';
  end if;

  select * into v_application
  from public.affiliate_applications
  where id = p_application_id
  for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  for v_revoked in
    update public.affiliate_application_information_requests
    set status = 'revoked', revoked_at = now()
    where application_id = p_application_id and status = 'open'
    returning id
  loop
    insert into public.affiliate_application_audit_events (
      application_id, event_type, actor_user_id, actor_email, details
    ) values (
      p_application_id,
      'information_request_revoked',
      p_actor_user_id,
      lower(nullif(trim(p_actor_email), '')),
      jsonb_build_object('information_request_id', v_revoked.id)
    );
  end loop;

  update public.affiliate_application_notification_outbox
  set delivery_status = 'cancelled',
      updated_at = now()
  where application_id = p_application_id
    and notification_type = 'more_information_required'
    and delivery_status in ('blocked_copy_pending', 'pending', 'failed');

  insert into public.affiliate_application_information_requests (
    application_id,
    token_hash,
    request_summary,
    request_details,
    expires_at,
    created_by_user_id,
    created_by_email
  ) values (
    p_application_id,
    p_token_hash,
    v_summary,
    v_details,
    p_expires_at,
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), ''))
  )
  returning id into v_request_id;

  if v_application.review_stage is distinct from 'follow_up_required'
    or v_application.status is distinct from 'pending_info'
  then
    update public.affiliate_applications
    set review_stage = 'follow_up_required', status = 'pending_info'
    where id = p_application_id;

    insert into public.application_stage_history (
      application_id, review_stage, status, changed_at
    ) values (
      p_application_id, 'follow_up_required', 'pending_info', now()
    );

    insert into public.affiliate_application_audit_events (
      application_id,
      event_type,
      actor_user_id,
      actor_email,
      from_review_stage,
      to_review_stage,
      from_status,
      to_status
    ) values (
      p_application_id,
      'stage_changed',
      p_actor_user_id,
      lower(nullif(trim(p_actor_email), '')),
      v_application.review_stage,
      'follow_up_required',
      v_application.status,
      'pending_info'
    );
  end if;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, actor_user_id, actor_email, details
  ) values (
    p_application_id,
    'information_request_created',
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    jsonb_build_object(
      'information_request_id', v_request_id,
      'expires_at', p_expires_at
    )
  )
  returning id into v_event_id;

  insert into public.affiliate_application_notification_outbox (
    application_id,
    audit_event_id,
    notification_type,
    dedupe_key,
    delivery_status
  ) values (
    p_application_id,
    v_event_id,
    'more_information_required',
    p_application_id::text || ':' || v_request_id::text || ':more_information_required',
    'blocked_copy_pending'
  )
  returning id into v_outbox_id;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, actor_user_id, actor_email, details
  ) values (
    p_application_id,
    'applicant_notification_requested',
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    jsonb_build_object(
      'information_request_id', v_request_id,
      'notification_outbox_id', v_outbox_id,
      'notification_type', 'more_information_required',
      'delivery_status', 'blocked_copy_pending',
      'reason', 'official_copy_not_approved'
    )
  );

  return v_request_id;
end;
$$;

create or replace function public.check_affiliate_information_response_rate_limit(
  p_token_hash text,
  p_origin_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_origin_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_token_hash));
  delete from public.affiliate_information_response_rate_limits
  where created_at < v_now - interval '24 hours';

  if (select count(*) from public.affiliate_information_response_rate_limits
      where identifier_kind = 'token' and identifier_hash = p_token_hash
        and created_at >= v_now - interval '1 hour') >= 10
    or (select count(*) from public.affiliate_information_response_rate_limits
      where identifier_kind = 'origin' and identifier_hash = p_origin_hash
        and created_at >= v_now - interval '1 hour') >= 30
  then
    return false;
  end if;

  insert into public.affiliate_information_response_rate_limits (
    identifier_kind, identifier_hash
  ) values ('token', p_token_hash), ('origin', p_origin_hash);
  return true;
end;
$$;

create or replace function public.submit_affiliate_information_response(
  p_token_hash text,
  p_response_text text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.affiliate_application_information_requests%rowtype;
  v_application public.affiliate_applications%rowtype;
  v_response_id uuid;
  v_response_event_id uuid;
  v_outbox_id uuid;
  v_response_text text := trim(p_response_text);
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or length(v_response_text) not between 1 and 6000
  then
    raise exception 'Invalid information response' using errcode = '22023';
  end if;

  select * into v_request
  from public.affiliate_application_information_requests
  where token_hash = p_token_hash
  for update;

  if not found or v_request.status <> 'open' or v_request.expires_at <= now() then
    raise exception 'Information request unavailable' using errcode = 'P0002';
  end if;

  select * into v_application
  from public.affiliate_applications
  where id = v_request.application_id
  for update;

  insert into public.affiliate_application_information_responses (
    request_id, application_id, response_text
  ) values (
    v_request.id, v_request.application_id, v_response_text
  )
  returning id into v_response_id;

  update public.affiliate_application_information_requests
  set status = 'responded', responded_at = now()
  where id = v_request.id;

  update public.affiliate_application_notification_outbox
  set delivery_status = 'cancelled',
      updated_at = now()
  where application_id = v_request.application_id
    and notification_type = 'more_information_required'
    and delivery_status in ('blocked_copy_pending', 'pending', 'failed');

  update public.affiliate_applications
  set review_stage = 'under_review', status = 'in_review'
  where id = v_request.application_id;

  insert into public.application_stage_history (
    application_id, review_stage, status, changed_at
  ) values (
    v_request.application_id, 'under_review', 'in_review', now()
  );

  insert into public.affiliate_application_audit_events (
    application_id,
    event_type,
    from_review_stage,
    to_review_stage,
    from_status,
    to_status,
    details
  ) values (
    v_request.application_id,
    'stage_changed',
    v_application.review_stage,
    'under_review',
    v_application.status,
    'in_review',
    jsonb_build_object('source', 'applicant_information_response')
  );

  insert into public.affiliate_application_audit_events (
    application_id, event_type, details
  ) values (
    v_request.application_id,
    'applicant_response_received',
    jsonb_build_object(
      'information_request_id', v_request.id,
      'information_response_id', v_response_id
    )
  )
  returning id into v_response_event_id;

  insert into public.affiliate_application_notification_outbox (
    application_id,
    audit_event_id,
    notification_type,
    dedupe_key,
    delivery_status
  ) values (
    v_request.application_id,
    v_response_event_id,
    'information_received',
    v_request.application_id::text || ':' || v_request.id::text || ':information_received',
    'blocked_copy_pending'
  )
  returning id into v_outbox_id;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, details
  ) values (
    v_request.application_id,
    'applicant_notification_requested',
    jsonb_build_object(
      'information_request_id', v_request.id,
      'notification_outbox_id', v_outbox_id,
      'notification_type', 'information_received',
      'delivery_status', 'blocked_copy_pending',
      'reason', 'official_copy_not_approved'
    )
  );

  return v_response_id;
end;
$$;

revoke all on function public.admin_create_affiliate_information_request(
  uuid, text, text, timestamptz, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.check_affiliate_information_response_rate_limit(text, text)
  from public, anon, authenticated;
revoke all on function public.submit_affiliate_information_response(text, text)
  from public, anon, authenticated;
grant execute on function public.admin_create_affiliate_information_request(
  uuid, text, text, timestamptz, text, uuid, text
) to service_role;
grant execute on function public.check_affiliate_information_response_rate_limit(text, text)
  to service_role;
grant execute on function public.submit_affiliate_information_response(text, text)
  to service_role;
