-- Applicant Communication Activation Package.
--
-- This migration supplies versioned, explicitly approved copy; an atomic,
-- retry-safe outbox claim; and provider-idempotent delivery bookkeeping.
-- It deliberately seeds no templates and releases no notifications.

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
      'applicant_portal_delivery_requested',
      'applicant_portal_delivery_sent',
      'applicant_portal_delivery_failed',
      'applicant_portal_recovery_requested',
      'applicant_portal_recovery_sent',
      'applicant_portal_access_recovered',
      'applicant_notification_requested',
      'applicant_notification_released',
      'applicant_notification_sent',
      'applicant_notification_failed'
    )
  );

create table public.affiliate_application_notification_templates (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null check (
    notification_type in (
      'more_information_required',
      'information_received',
      'approved',
      'rejected',
      'affiliate_activated',
      'manual_applicant_update'
    )
  ),
  locale text not null default 'en' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  version integer not null check (version > 0),
  approval_status text not null default 'draft' check (
    approval_status in ('draft', 'approved', 'retired')
  ),
  subject_template text not null check (length(subject_template) between 1 and 160),
  headline_template text not null check (length(headline_template) between 1 and 220),
  body_paragraphs jsonb not null check (
    jsonb_typeof(body_paragraphs) = 'array'
    and jsonb_array_length(body_paragraphs) between 1 and 12
  ),
  cta_label text not null check (length(cta_label) between 1 and 80),
  footer_text text not null check (length(footer_text) between 1 and 500),
  approved_at timestamptz,
  approved_by_user_id uuid,
  approved_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_type, locale, version),
  check (
    approval_status = 'draft'
    or (
      approved_at is not null
      and approved_by_email is not null
      and length(trim(approved_by_email)) > 3
    )
  )
);

create unique index affiliate_notification_templates_one_approved_idx
  on public.affiliate_application_notification_templates (notification_type, locale)
  where approval_status = 'approved';

create or replace function public.prevent_affiliate_notification_template_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.approval_status <> 'draft' then
    raise exception 'Approved notification templates are immutable' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and old.approval_status <> 'draft' and (
    new.notification_type is distinct from old.notification_type
    or new.locale is distinct from old.locale
    or new.version is distinct from old.version
    or new.subject_template is distinct from old.subject_template
    or new.headline_template is distinct from old.headline_template
    or new.body_paragraphs is distinct from old.body_paragraphs
    or new.cta_label is distinct from old.cta_label
    or new.footer_text is distinct from old.footer_text
    or new.approval_status not in (old.approval_status, 'retired')
  ) then
    raise exception 'Approved notification templates are immutable' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger prevent_affiliate_notification_template_mutation
before update or delete on public.affiliate_application_notification_templates
for each row execute function public.prevent_affiliate_notification_template_mutation();

create table public.affiliate_application_notification_template_events (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references
    public.affiliate_application_notification_templates(id) on delete restrict,
  event_type text not null check (event_type in ('approved', 'retired')),
  actor_user_id uuid,
  actor_email text,
  created_at timestamptz not null default now()
);

alter table public.affiliate_application_notification_outbox
  add column if not exists template_id uuid references
    public.affiliate_application_notification_templates(id) on delete restrict,
  add column if not exists locale text not null default 'en',
  add column if not exists portal_access_id uuid references
    public.affiliate_application_portal_access(id) on delete restrict,
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists last_attempt_at timestamptz;

create index affiliate_notification_outbox_worker_idx
  on public.affiliate_application_notification_outbox
    (delivery_status, next_attempt_at, created_at)
  where delivery_status in ('pending', 'failed', 'sending');

alter table public.affiliate_application_notification_templates enable row level security;
alter table public.affiliate_application_notification_template_events enable row level security;
revoke all on table public.affiliate_application_notification_templates
  from public, anon, authenticated;
revoke all on table public.affiliate_application_notification_template_events
  from public, anon, authenticated;

create or replace function public.admin_approve_affiliate_notification_template(
  p_template_id uuid,
  p_actor_user_id uuid,
  p_actor_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.affiliate_application_notification_templates%rowtype;
  v_retired_id uuid;
begin
  if nullif(trim(p_actor_email), '') is null then
    raise exception 'Approving admin email is required' using errcode = '22023';
  end if;

  select * into v_template
  from public.affiliate_application_notification_templates
  where id = p_template_id
  for update;
  if not found then
    raise exception 'Notification template not found' using errcode = 'P0002';
  end if;
  if v_template.approval_status <> 'draft' then
    raise exception 'Only draft notification templates can be approved' using errcode = '55000';
  end if;

  for v_retired_id in
    update public.affiliate_application_notification_templates
    set approval_status = 'retired', updated_at = now()
    where notification_type = v_template.notification_type
      and locale = v_template.locale
      and approval_status = 'approved'
      and id <> v_template.id
    returning id
  loop
    insert into public.affiliate_application_notification_template_events (
      template_id, event_type, actor_user_id, actor_email
    ) values (
      v_retired_id, 'retired', p_actor_user_id, lower(trim(p_actor_email))
    );
  end loop;

  update public.affiliate_application_notification_templates
  set approval_status = 'approved',
      approved_at = now(),
      approved_by_user_id = p_actor_user_id,
      approved_by_email = lower(trim(p_actor_email)),
      updated_at = now()
  where id = v_template.id;

  insert into public.affiliate_application_notification_template_events (
    template_id, event_type, actor_user_id, actor_email
  ) values (
    v_template.id, 'approved', p_actor_user_id, lower(trim(p_actor_email))
  );

  return v_template.id;
end;
$$;

create or replace function public.admin_release_affiliate_notifications(
  p_template_id uuid,
  p_application_id uuid,
  p_actor_user_id uuid,
  p_actor_email text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.affiliate_application_notification_templates%rowtype;
  v_outbox record;
  v_released integer := 0;
begin
  if p_application_id is null or nullif(trim(p_actor_email), '') is null then
    raise exception 'Application and admin identity are required' using errcode = '22023';
  end if;

  select * into v_template
  from public.affiliate_application_notification_templates
  where id = p_template_id and approval_status = 'approved'
  for update;
  if not found then
    raise exception 'Approved notification template not found' using errcode = 'P0002';
  end if;

  for v_outbox in
    update public.affiliate_application_notification_outbox
    set template_id = v_template.id,
        locale = v_template.locale,
        delivery_status = 'pending',
        last_error_code = null,
        next_attempt_at = now(),
        updated_at = now()
    where application_id = p_application_id
      and notification_type = v_template.notification_type
      and delivery_status = 'blocked_copy_pending'
    returning id
  loop
    v_released := v_released + 1;
    insert into public.affiliate_application_audit_events (
      application_id, event_type, actor_user_id, actor_email, details
    ) values (
      p_application_id,
      'applicant_notification_released',
      p_actor_user_id,
      lower(trim(p_actor_email)),
      jsonb_build_object(
        'notification_outbox_id', v_outbox.id,
        'notification_type', v_template.notification_type,
        'template_id', v_template.id,
        'template_version', v_template.version,
        'locale', v_template.locale
      )
    );
  end loop;

  return v_released;
end;
$$;

create or replace function public.inspect_affiliate_notification_queue()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.affiliate_application_notification_outbox outbox
  join public.affiliate_application_notification_templates template
    on template.id = outbox.template_id
   and template.approval_status in ('approved', 'retired')
  where outbox.attempt_count < 3
    and (
      outbox.delivery_status = 'pending'
      or (
        outbox.delivery_status = 'failed'
        and coalesce(outbox.next_attempt_at, now()) <= now()
      )
      or (
        outbox.delivery_status = 'sending'
        and outbox.claimed_at < now() - interval '15 minutes'
      )
    );
$$;

create or replace function public.claim_affiliate_notifications(
  p_claim_token uuid,
  p_batch_size integer
) returns table (outbox_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_claim_token is null or p_batch_size not between 1 and 25 then
    raise exception 'Invalid notification claim' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select outbox.id
    from public.affiliate_application_notification_outbox outbox
    join public.affiliate_application_notification_templates template
      on template.id = outbox.template_id
     and template.approval_status in ('approved', 'retired')
    where outbox.attempt_count < 3
      and (
        outbox.delivery_status = 'pending'
        or (
          outbox.delivery_status = 'failed'
          and coalesce(outbox.next_attempt_at, now()) <= now()
        )
        or (
          outbox.delivery_status = 'sending'
          and outbox.claimed_at < now() - interval '15 minutes'
        )
      )
    order by outbox.created_at
    for update of outbox skip locked
    limit p_batch_size
  )
  update public.affiliate_application_notification_outbox outbox
  set delivery_status = 'sending',
      claim_token = p_claim_token,
      claimed_at = now(),
      last_attempt_at = now(),
      attempt_count = outbox.attempt_count + 1,
      updated_at = now()
  from candidates
  where outbox.id = candidates.id
  returning outbox.id;
end;
$$;

create or replace function public.prepare_affiliate_notification_portal_delivery(
  p_outbox_id uuid,
  p_claim_token uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_delivery_reason text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outbox public.affiliate_application_notification_outbox%rowtype;
  v_access_id uuid;
begin
  select * into v_outbox
  from public.affiliate_application_notification_outbox
  where id = p_outbox_id
    and delivery_status = 'sending'
    and claim_token = p_claim_token
  for update;
  if not found then
    raise exception 'Notification claim unavailable' using errcode = 'P0002';
  end if;

  if v_outbox.portal_access_id is not null then
    return v_outbox.portal_access_id;
  end if;

  v_access_id := public.prepare_affiliate_application_portal_delivery(
    v_outbox.application_id,
    p_token_hash,
    p_expires_at,
    null,
    null,
    p_delivery_reason
  );

  update public.affiliate_application_notification_outbox
  set portal_access_id = v_access_id, updated_at = now()
  where id = v_outbox.id;

  return v_access_id;
end;
$$;

create or replace function public.complete_affiliate_notification_delivery(
  p_outbox_id uuid,
  p_claim_token uuid,
  p_succeeded boolean,
  p_provider_message_id text,
  p_error_code text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outbox public.affiliate_application_notification_outbox%rowtype;
  v_template public.affiliate_application_notification_templates%rowtype;
  v_exhausted boolean;
begin
  select * into v_outbox
  from public.affiliate_application_notification_outbox
  where id = p_outbox_id
    and delivery_status = 'sending'
    and claim_token = p_claim_token
  for update;
  if not found then
    raise exception 'Notification claim unavailable' using errcode = 'P0002';
  end if;

  select * into v_template
  from public.affiliate_application_notification_templates
  where id = v_outbox.template_id and approval_status in ('approved', 'retired');
  if not found then
    raise exception 'Approved template unavailable' using errcode = 'P0002';
  end if;

  v_exhausted := v_outbox.attempt_count >= 3;

  if p_succeeded then
    if v_outbox.portal_access_id is null then
      raise exception 'Portal delivery is missing' using errcode = '55000';
    end if;
    perform public.complete_affiliate_application_portal_delivery(
      v_outbox.portal_access_id,
      true,
      nullif(trim(p_provider_message_id), ''),
      null,
      null,
      null
    );
    update public.affiliate_application_notification_outbox
    set delivery_status = 'sent',
        provider_message_id = nullif(trim(p_provider_message_id), ''),
        last_error_code = null,
        next_attempt_at = null,
        sent_at = now(),
        claim_token = null,
        claimed_at = null,
        updated_at = now()
    where id = v_outbox.id;

    insert into public.affiliate_application_audit_events (
      application_id, event_type, details
    ) values (
      v_outbox.application_id,
      'applicant_notification_sent',
      jsonb_build_object(
        'notification_outbox_id', v_outbox.id,
        'notification_type', v_outbox.notification_type,
        'template_id', v_template.id,
        'template_version', v_template.version,
        'provider_message_id_recorded', p_provider_message_id is not null
      )
    );
  else
    if v_exhausted and v_outbox.portal_access_id is not null then
      perform public.complete_affiliate_application_portal_delivery(
        v_outbox.portal_access_id,
        false,
        null,
        coalesce(nullif(trim(p_error_code), ''), 'DELIVERY_FAILED'),
        null,
        null
      );
    end if;
    update public.affiliate_application_notification_outbox
    set delivery_status = 'failed',
        last_error_code = coalesce(nullif(trim(p_error_code), ''), 'DELIVERY_FAILED'),
        next_attempt_at = case
          when v_exhausted then null
          when v_outbox.attempt_count = 1 then now() + interval '5 minutes'
          else now() + interval '30 minutes'
        end,
        claim_token = null,
        claimed_at = null,
        updated_at = now()
    where id = v_outbox.id;

    insert into public.affiliate_application_audit_events (
      application_id, event_type, details
    ) values (
      v_outbox.application_id,
      'applicant_notification_failed',
      jsonb_build_object(
        'notification_outbox_id', v_outbox.id,
        'notification_type', v_outbox.notification_type,
        'template_id', v_template.id,
        'template_version', v_template.version,
        'attempt_count', v_outbox.attempt_count,
        'retry_scheduled', not v_exhausted,
        'error_code', coalesce(nullif(trim(p_error_code), ''), 'DELIVERY_FAILED')
      )
    );
  end if;

  return true;
end;
$$;

revoke all on function public.admin_approve_affiliate_notification_template(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.prevent_affiliate_notification_template_mutation()
  from public, anon, authenticated;
revoke all on function public.admin_release_affiliate_notifications(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.inspect_affiliate_notification_queue()
  from public, anon, authenticated;
revoke all on function public.claim_affiliate_notifications(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.prepare_affiliate_notification_portal_delivery(
  uuid, uuid, text, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.complete_affiliate_notification_delivery(
  uuid, uuid, boolean, text, text
) from public, anon, authenticated;

grant execute on function public.admin_approve_affiliate_notification_template(uuid, uuid, text)
  to service_role;
grant execute on function public.admin_release_affiliate_notifications(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.inspect_affiliate_notification_queue()
  to service_role;
grant execute on function public.claim_affiliate_notifications(uuid, integer)
  to service_role;
grant execute on function public.prepare_affiliate_notification_portal_delivery(
  uuid, uuid, text, timestamptz, text
) to service_role;
grant execute on function public.complete_affiliate_notification_delivery(
  uuid, uuid, boolean, text, text
) to service_role;
