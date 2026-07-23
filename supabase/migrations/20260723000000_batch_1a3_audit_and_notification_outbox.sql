-- Batch 1A.3, slice 1: atomic admin workflow, append-only audit, and
-- deduplicated applicant-notification outbox.
--
-- This migration does not send email. Notification rows are operational
-- intent only until approved copy and a delivery worker are supplied.

create table if not exists public.affiliate_application_audit_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.affiliate_applications(id) on delete restrict,
  event_type text not null check (
    event_type in (
      'stage_changed',
      'internal_notes_updated',
      'applicant_notification_requested',
      'applicant_notification_sent',
      'applicant_notification_failed'
    )
  ),
  actor_user_id uuid,
  actor_email text,
  from_review_stage text,
  to_review_stage text,
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_application_audit_events_application_idx
  on public.affiliate_application_audit_events (application_id, created_at desc);

create table if not exists public.affiliate_application_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.affiliate_applications(id) on delete restrict,
  audit_event_id uuid not null references public.affiliate_application_audit_events(id) on delete restrict,
  notification_type text not null check (
    notification_type in (
      'more_information_required',
      'approved',
      'rejected',
      'affiliate_activated',
      'manual_applicant_update'
    )
  ),
  dedupe_key text not null unique,
  delivery_status text not null default 'blocked_copy_pending' check (
    delivery_status in (
      'blocked_copy_pending',
      'pending',
      'sending',
      'sent',
      'failed',
      'cancelled'
    )
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  last_error_code text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_application_notification_outbox_delivery_idx
  on public.affiliate_application_notification_outbox (delivery_status, next_attempt_at, created_at);

alter table public.affiliate_application_audit_events enable row level security;
alter table public.affiliate_application_notification_outbox enable row level security;

revoke all on table public.affiliate_application_audit_events from anon, authenticated;
revoke all on table public.affiliate_application_notification_outbox from anon, authenticated;

create or replace function public.prevent_affiliate_application_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Affiliate application audit events are append-only'
    using errcode = '55000';
end;
$$;

drop trigger if exists prevent_affiliate_application_audit_event_update
  on public.affiliate_application_audit_events;
create trigger prevent_affiliate_application_audit_event_update
before update or delete on public.affiliate_application_audit_events
for each row execute function public.prevent_affiliate_application_audit_mutation();

create or replace function public.admin_transition_affiliate_application(
  p_application_id uuid,
  p_review_stage text,
  p_status text,
  p_actor_user_id uuid,
  p_actor_email text
) returns table (
  changed boolean,
  audit_event_id uuid,
  notification_outbox_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.affiliate_applications%rowtype;
  v_event_id uuid;
  v_notification_id uuid;
  v_notification_type text;
begin
  if p_review_stage not in (
    'submitted',
    'under_review',
    'follow_up_required',
    'interview',
    'trial_candidate',
    'approved',
    'rejected',
    'activated_affiliate'
  ) then
    raise exception 'Invalid review stage' using errcode = '22023';
  end if;

  if p_status not in (
    'new',
    'in_review',
    'pending_info',
    'candidate',
    'approved',
    'rejected',
    'active'
  ) then
    raise exception 'Invalid application status' using errcode = '22023';
  end if;

  if (p_review_stage, p_status) not in (
    ('submitted', 'new'),
    ('under_review', 'in_review'),
    ('follow_up_required', 'pending_info'),
    ('interview', 'in_review'),
    ('trial_candidate', 'candidate'),
    ('approved', 'approved'),
    ('rejected', 'rejected'),
    ('activated_affiliate', 'active')
  ) then
    raise exception 'Review stage and application status do not match'
      using errcode = '22023';
  end if;

  select *
  into v_application
  from public.affiliate_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  if v_application.review_stage is not distinct from p_review_stage
    and v_application.status is not distinct from p_status
  then
    return query select false, null::uuid, null::uuid;
    return;
  end if;

  update public.affiliate_applications
  set review_stage = p_review_stage,
      status = p_status
  where id = p_application_id;

  insert into public.application_stage_history (
    application_id,
    review_stage,
    status,
    changed_at
  ) values (
    p_application_id,
    p_review_stage,
    p_status,
    now()
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
    p_review_stage,
    v_application.status,
    p_status
  )
  returning id into v_event_id;

  v_notification_type := case p_review_stage
    when 'follow_up_required' then 'more_information_required'
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    when 'activated_affiliate' then 'affiliate_activated'
    else null
  end;

  if v_notification_type is not null then
    insert into public.affiliate_application_notification_outbox (
      application_id,
      audit_event_id,
      notification_type,
      dedupe_key,
      delivery_status
    ) values (
      p_application_id,
      v_event_id,
      v_notification_type,
      p_application_id::text || ':' || v_event_id::text || ':' || v_notification_type,
      'blocked_copy_pending'
    )
    returning id into v_notification_id;

    insert into public.affiliate_application_audit_events (
      application_id,
      event_type,
      actor_user_id,
      actor_email,
      details
    ) values (
      p_application_id,
      'applicant_notification_requested',
      p_actor_user_id,
      lower(nullif(trim(p_actor_email), '')),
      jsonb_build_object(
        'notification_outbox_id', v_notification_id,
        'notification_type', v_notification_type,
        'delivery_status', 'blocked_copy_pending',
        'reason', 'official_copy_not_approved'
      )
    );
  end if;

  return query select true, v_event_id, v_notification_id;
end;
$$;

create or replace function public.admin_update_affiliate_application_notes(
  p_application_id uuid,
  p_internal_notes text,
  p_actor_user_id uuid,
  p_actor_email text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_notes text;
  v_next_notes text := nullif(trim(p_internal_notes), '');
begin
  select internal_notes
  into v_previous_notes
  from public.affiliate_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  if v_previous_notes is not distinct from v_next_notes then
    return false;
  end if;

  update public.affiliate_applications
  set internal_notes = v_next_notes
  where id = p_application_id;

  insert into public.affiliate_application_audit_events (
    application_id,
    event_type,
    actor_user_id,
    actor_email,
    details
  ) values (
    p_application_id,
    'internal_notes_updated',
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    jsonb_build_object(
      'previously_present', v_previous_notes is not null,
      'currently_present', v_next_notes is not null
    )
  );

  return true;
end;
$$;

revoke all on function public.admin_transition_affiliate_application(uuid, text, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.admin_update_affiliate_application_notes(uuid, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.prevent_affiliate_application_audit_mutation()
  from public, anon, authenticated;
grant execute on function public.admin_transition_affiliate_application(uuid, text, text, uuid, text)
  to service_role;
grant execute on function public.admin_update_affiliate_application_notes(uuid, text, uuid, text)
  to service_role;
