begin;

-- Abort rather than rewriting historical payment evidence. Each exception names
-- the affected application or request identities for staging reconciliation.
do $$
declare
  v_rows text;
begin
  select pg_catalog.string_agg(coordination.application_id::text, ', ' order by coordination.application_id::text)
  into v_rows
  from public.affiliate_application_payment_coordination as coordination
  where coordination.payment_status <> 'not_requested'
    and coordination.current_payment_request_id is null;
  if v_rows is not null then
    raise exception 'PAYMENT_RECONCILIATION_MISSING_CURRENT_POINTER: %', v_rows using errcode = '55000';
  end if;

  select pg_catalog.string_agg(coordination.application_id::text, ', ' order by coordination.application_id::text)
  into v_rows
  from public.affiliate_application_payment_coordination as coordination
  left join public.affiliate_application_payment_command_outbox as initiation
    on initiation.command_id = coordination.current_payment_request_id
  where coordination.current_payment_request_id is not null
    and (initiation.command_id is null or initiation.command_type <> 'payment_initiation');
  if v_rows is not null then
    raise exception 'PAYMENT_RECONCILIATION_NON_INITIATION_CURRENT_POINTER: %', v_rows using errcode = '55000';
  end if;

  select pg_catalog.string_agg(coordination.application_id::text, ', ' order by coordination.application_id::text)
  into v_rows
  from public.affiliate_application_payment_coordination as coordination
  join public.affiliate_application_payment_command_outbox as initiation
    on initiation.command_id = coordination.current_payment_request_id
  where initiation.application_id <> coordination.application_id;
  if v_rows is not null then
    raise exception 'PAYMENT_RECONCILIATION_CROSS_APPLICATION_CURRENT_POINTER: %', v_rows using errcode = '55000';
  end if;

  select pg_catalog.string_agg(command.command_id::text, ', ' order by command.command_id::text)
  into v_rows
  from public.affiliate_application_payment_command_outbox as command
  join public.affiliate_application_payment_command_outbox as initiation
    on initiation.command_id = command.payment_request_id
  where command.application_id <> initiation.application_id
    or initiation.command_type <> 'payment_initiation';
  if v_rows is not null then
    raise exception 'PAYMENT_RECONCILIATION_INVALID_COMMAND_REQUEST_LINK: %', v_rows using errcode = '55000';
  end if;

  select pg_catalog.string_agg(event.external_event_id::text, ', ' order by event.external_event_id::text)
  into v_rows
  from public.affiliate_application_payment_status_events as event
  join public.affiliate_application_payment_command_outbox as initiation
    on initiation.command_id = event.payment_request_id
  where event.application_id <> initiation.application_id
    or initiation.command_type <> 'payment_initiation';
  if v_rows is not null then
    raise exception 'PAYMENT_RECONCILIATION_INVALID_EVENT_REQUEST_LINK: %', v_rows using errcode = '55000';
  end if;

  select pg_catalog.string_agg(duplicates.payment_request_id::text, ', ' order by duplicates.payment_request_id::text)
  into v_rows
  from (
    select command.payment_request_id
    from public.affiliate_application_payment_command_outbox as command
    where command.command_type = 'payment_cancellation'
    group by command.payment_request_id
    having pg_catalog.count(*) > 1
  ) as duplicates;
  if v_rows is not null then
    raise exception 'PAYMENT_RECONCILIATION_DUPLICATE_CANCELLATIONS: %', v_rows using errcode = '55000';
  end if;

  select pg_catalog.string_agg(coordination.application_id::text, ', ' order by coordination.application_id::text)
  into v_rows
  from public.affiliate_application_payment_coordination as coordination
  join public.affiliate_applications as application on application.id = coordination.application_id
  where coordination.payment_status = 'pending'
    and (application.review_stage, application.status) <> ('approved', 'approved')
    and coordination.payment_operation_state not in (
      'cancellation_queued', 'cancellation_retrying', 'cancellation_accepted',
      'cancellation_intervention_required'
    )
    and not exists (
      select 1
      from public.affiliate_application_payment_command_outbox as cancellation
      where cancellation.payment_request_id = coordination.current_payment_request_id
        and cancellation.command_type = 'payment_cancellation'
    );
  if v_rows is not null then
    raise exception 'PAYMENT_RECONCILIATION_AMBIGUOUS_PENDING_NONAPPROVED: %', v_rows using errcode = '55000';
  end if;

  select pg_catalog.string_agg(coordination.application_id::text, ', ' order by coordination.application_id::text)
  into v_rows
  from public.affiliate_application_payment_coordination as coordination
  join public.affiliate_application_payment_status_events as event
    on event.external_event_id = coordination.last_status_event_id
  where event.application_id <> coordination.application_id
    or event.payment_request_id <> coordination.current_payment_request_id;
  if v_rows is not null then
    raise exception 'PAYMENT_RECONCILIATION_INVALID_CURRENT_EVENT_LINK: %', v_rows using errcode = '55000';
  end if;
end;
$$;

alter table public.affiliate_application_payment_command_outbox
  add constraint affiliate_application_payment_command_outbox_command_application_key
  unique (command_id, application_id);

alter table public.affiliate_application_payment_status_events
  add constraint affiliate_application_payment_status_events_event_application_request_key
  unique (external_event_id, application_id, payment_request_id);

alter table public.affiliate_application_payment_command_outbox
  add constraint affiliate_application_payment_command_outbox_payment_request_application_fkey_v2
  foreign key (payment_request_id, application_id)
  references public.affiliate_application_payment_command_outbox(command_id, application_id)
  on delete restrict deferrable initially deferred not valid;
alter table public.affiliate_application_payment_command_outbox
  validate constraint affiliate_application_payment_command_outbox_payment_request_application_fkey_v2;
alter table public.affiliate_application_payment_command_outbox
  drop constraint affiliate_application_payment_command_outbox_payment_request_fkey;
alter table public.affiliate_application_payment_command_outbox
  rename constraint affiliate_application_payment_command_outbox_payment_request_application_fkey_v2
  to affiliate_application_payment_command_outbox_payment_request_fkey;

alter table public.affiliate_application_payment_status_events
  add constraint affiliate_application_payment_status_events_request_application_fkey_v2
  foreign key (payment_request_id, application_id)
  references public.affiliate_application_payment_command_outbox(command_id, application_id)
  on delete restrict not valid;
alter table public.affiliate_application_payment_status_events
  validate constraint affiliate_application_payment_status_events_request_application_fkey_v2;
alter table public.affiliate_application_payment_status_events
  drop constraint affiliate_application_payment_status_events_request_fkey;
alter table public.affiliate_application_payment_status_events
  rename constraint affiliate_application_payment_status_events_request_application_fkey_v2
  to affiliate_application_payment_status_events_request_fkey;

alter table public.affiliate_application_payment_coordination
  add constraint affiliate_application_payment_coordination_current_request_application_fkey_v2
  foreign key (current_payment_request_id, application_id)
  references public.affiliate_application_payment_command_outbox(command_id, application_id)
  on delete restrict not valid;
alter table public.affiliate_application_payment_coordination
  validate constraint affiliate_application_payment_coordination_current_request_application_fkey_v2;
alter table public.affiliate_application_payment_coordination
  drop constraint affiliate_application_payment_coordination_current_request_fkey;
alter table public.affiliate_application_payment_coordination
  rename constraint affiliate_application_payment_coordination_current_request_application_fkey_v2
  to affiliate_application_payment_coordination_current_request_fkey;

alter table public.affiliate_application_payment_coordination
  add constraint affiliate_application_payment_coordination_last_event_cycle_fkey_v2
  foreign key (last_status_event_id, application_id, current_payment_request_id)
  references public.affiliate_application_payment_status_events(
    external_event_id, application_id, payment_request_id
  ) on delete restrict not valid;
alter table public.affiliate_application_payment_coordination
  validate constraint affiliate_application_payment_coordination_last_event_cycle_fkey_v2;
alter table public.affiliate_application_payment_coordination
  drop constraint affiliate_application_payment_coordination_last_event_fkey;
alter table public.affiliate_application_payment_coordination
  rename constraint affiliate_application_payment_coordination_last_event_cycle_fkey_v2
  to affiliate_application_payment_coordination_last_event_fkey;

alter table public.affiliate_application_payment_status_events
  add constraint affiliate_payment_status_events_reason_v2_check
  check (
    (applied = true and not_applied_reason is null)
    or (applied = false and not_applied_reason in (
      'superseded_attempt', 'superseded_payment_request',
      'transition_not_permitted', 'stale_event', 'duplicate_business_state'
    ))
  ) not valid;
alter table public.affiliate_application_payment_status_events
  validate constraint affiliate_payment_status_events_reason_v2_check;
alter table public.affiliate_application_payment_status_events
  drop constraint affiliate_application_payment_status_events_applied_reason_check;
alter table public.affiliate_application_payment_status_events
  rename constraint affiliate_payment_status_events_reason_v2_check
  to affiliate_application_payment_status_events_applied_reason_check;

create or replace function public.enforce_affiliate_payment_cycle_reference_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_exists boolean;
begin
  if tg_table_name = 'affiliate_application_payment_command_outbox' then
    if new.command_type = 'payment_initiation'
      and new.command_id = new.payment_request_id
    then
      return new;
    end if;
    select true into v_exists
    from public.affiliate_application_payment_command_outbox as initiation
    where initiation.command_id = new.payment_request_id
      and initiation.application_id = new.application_id
      and initiation.command_type = 'payment_initiation';
  elsif tg_table_name = 'affiliate_application_payment_status_events' then
    select true into v_exists
    from public.affiliate_application_payment_command_outbox as initiation
    where initiation.command_id = new.payment_request_id
      and initiation.application_id = new.application_id
      and initiation.command_type = 'payment_initiation';
  elsif tg_table_name = 'affiliate_application_payment_coordination' then
    if new.current_payment_request_id is null then return new; end if;
    select true into v_exists
    from public.affiliate_application_payment_command_outbox as initiation
    where initiation.command_id = new.current_payment_request_id
      and initiation.application_id = new.application_id
      and initiation.command_type = 'payment_initiation';
  else
    raise exception 'Unsupported payment-cycle trigger target' using errcode = '55000';
  end if;
  if not coalesce(v_exists, false) then
    raise exception 'Payment request must reference a same-application initiation' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger affiliate_payment_command_cycle_reference_trigger
before insert or update on public.affiliate_application_payment_command_outbox
for each row execute function public.enforce_affiliate_payment_cycle_reference_v2();
create trigger affiliate_payment_event_cycle_reference_trigger
before insert or update on public.affiliate_application_payment_status_events
for each row execute function public.enforce_affiliate_payment_cycle_reference_v2();
create trigger affiliate_payment_coordination_cycle_reference_trigger
before insert or update on public.affiliate_application_payment_coordination
for each row execute function public.enforce_affiliate_payment_cycle_reference_v2();

create or replace function public.create_bkfc_payment_initiation_cycle_v2(
  p_application_id uuid,
  p_plan_code text,
  p_request_reason text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_now timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_application public.affiliate_applications%rowtype;
  v_payment_request_id uuid := pg_catalog.gen_random_uuid();
  v_idempotency_key uuid := pg_catalog.gen_random_uuid();
  v_payload jsonb;
begin
  if p_plan_code not in ('monthly', 'quarterly')
    or p_request_reason not in ('approval', 'legacy_initialization', 'staff_reissue')
    or p_now is null
  then raise exception 'Invalid payment initiation cycle' using errcode = '22023'; end if;
  select application.* into v_application
  from public.affiliate_applications as application
  where application.id = p_application_id;
  if not found or v_application.source_system is distinct from 'bkfc'
    or v_application.source_application_id is null
  then raise exception 'BKFC application identity is required' using errcode = '55000'; end if;

  v_payload := pg_catalog.jsonb_build_object(
    'contractVersion', 1,
    'paymentRequestId', v_payment_request_id::text,
    'euApplicationId', v_application.id::text,
    'euApplicationReference', v_application.application_reference,
    'bkfcApplicationId', v_application.source_application_id,
    'planCode', p_plan_code,
    'gymName', v_application.gym_name,
    'recipient', pg_catalog.jsonb_build_object(
      'name', v_application.contact_person,
      'email', pg_catalog.lower(v_application.email)
    ),
    'approvedAt', pg_catalog.to_char(p_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
  insert into public.affiliate_application_payment_command_outbox (
    command_id, application_id, bkfc_application_id, command_type,
    payment_request_id, idempotency_key, payload, payload_hash,
    delivery_status, request_reason, created_by_user_id, created_by_email
  ) values (
    v_payment_request_id, p_application_id, v_application.source_application_id,
    'payment_initiation', v_payment_request_id, v_idempotency_key,
    v_payload, public.bkfc_json_sha256_v1(v_payload), 'queued', p_request_reason,
    p_actor_user_id, pg_catalog.lower(nullif(pg_catalog.btrim(p_actor_email), ''))
  );
  update public.affiliate_application_payment_coordination
  set plan_code = p_plan_code,
    payment_status = 'pending',
    current_payment_request_id = v_payment_request_id,
    payment_requested_at = p_now,
    payment_link_sent_at = null,
    paid_at = null,
    cancelled_at = null,
    refunded_at = null,
    last_status_event_id = null,
    last_status_event_occurred_at = null,
    payment_operation_state = 'initiation_queued',
    last_operational_error_code = null,
    last_operational_error_at = null
  where application_id = p_application_id;
  if not found then raise exception 'PAYMENT_COORDINATION_REQUIRED' using errcode = '55000'; end if;
  return v_payment_request_id;
end;
$$;

create or replace function public.admin_transition_affiliate_application(
  p_application_id uuid,
  p_review_stage text,
  p_status text,
  p_actor_user_id uuid,
  p_actor_email text
)
returns table(changed boolean, audit_event_id uuid, notification_outbox_id uuid)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_application public.affiliate_applications%rowtype;
  v_coordination public.affiliate_application_payment_coordination%rowtype;
  v_initiation public.affiliate_application_payment_command_outbox%rowtype;
  v_event_id uuid;
  v_notification_id uuid;
  v_notification_type text;
  v_payment_request_id uuid;
  v_cancellation_id uuid;
  v_idempotency_key uuid;
  v_payload jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_is_bkfc boolean;
  v_cancellation_activity boolean;
begin
  if p_review_stage not in (
    'submitted', 'under_review', 'follow_up_required', 'interview',
    'trial_candidate', 'approved', 'rejected', 'activated_affiliate'
  ) then raise exception 'Invalid review stage' using errcode = '22023'; end if;
  if p_status not in ('new', 'in_review', 'pending_info', 'candidate', 'approved', 'rejected', 'active')
  then raise exception 'Invalid application status' using errcode = '22023'; end if;
  if (p_review_stage, p_status) not in (
    ('submitted', 'new'), ('under_review', 'in_review'),
    ('follow_up_required', 'pending_info'), ('interview', 'in_review'),
    ('trial_candidate', 'candidate'), ('approved', 'approved'),
    ('rejected', 'rejected'), ('activated_affiliate', 'active')
  ) then raise exception 'Review stage and application status do not match' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(1112233445);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bkfc-payment:' || p_application_id::text));
  select application.* into v_application
  from public.affiliate_applications as application
  where application.id = p_application_id
  for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  v_is_bkfc := v_application.source_system = 'bkfc'
    and v_application.source_application_id is not null
    and v_application.source_application_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$';

  if v_application.review_stage is not distinct from p_review_stage
    and v_application.status is not distinct from p_status
  then return query select false, null::uuid, null::uuid; return; end if;
  if p_review_stage = 'approved' and p_status = 'approved'
    and v_application.review_stage = 'rejected' and v_application.status = 'rejected'
  then raise exception 'Direct rejected application approval is not permitted' using errcode = '55000'; end if;

  if v_is_bkfc then
    select coordination.* into v_coordination
    from public.affiliate_application_payment_coordination as coordination
    where coordination.application_id = p_application_id
    for update;
  end if;

  if v_is_bkfc and p_review_stage = 'activated_affiliate' and p_status = 'active' then
    if v_application.review_stage is distinct from 'approved'
      or v_application.status is distinct from 'approved'
      or not found
      or v_coordination.payment_status is distinct from 'paid'
    then raise exception 'ACTIVATION_REQUIRES_APPROVED_AND_PAID' using errcode = '55000'; end if;
  end if;

  if v_is_bkfc and p_review_stage = 'approved' and p_status = 'approved' then
    if not found then raise exception 'PAYMENT_COORDINATION_REQUIRED' using errcode = '55000'; end if;
    if v_coordination.payment_status = 'refunded' then
      raise exception 'Refunded applications cannot initiate payment' using errcode = '55000';
    end if;
    select exists (
      select 1 from public.affiliate_application_payment_command_outbox as cancellation
      where cancellation.payment_request_id = v_coordination.current_payment_request_id
        and cancellation.command_type = 'payment_cancellation'
    ) into v_cancellation_activity;
    v_cancellation_activity := v_cancellation_activity
      or v_coordination.payment_operation_state in (
        'cancellation_queued', 'cancellation_retrying', 'cancellation_accepted',
        'cancellation_intervention_required'
      );
    if v_coordination.payment_status in ('not_requested', 'cancelled')
      or (v_coordination.payment_status = 'pending' and v_cancellation_activity)
    then
      v_payment_request_id := public.create_bkfc_payment_initiation_cycle_v2(
        p_application_id, v_coordination.plan_code, 'approval',
        p_actor_user_id, p_actor_email, v_now
      );
    end if;
  end if;

  if v_is_bkfc
    and v_application.review_stage = 'approved' and v_application.status = 'approved'
    and (p_review_stage, p_status) not in (
      ('approved', 'approved'), ('activated_affiliate', 'active')
    )
    and v_coordination.current_payment_request_id is not null
  then
    select command.* into v_initiation
    from public.affiliate_application_payment_command_outbox as command
    where command.command_id = v_coordination.current_payment_request_id
      and command.application_id = p_application_id
      and command.command_type = 'payment_initiation'
    for update;
    if found and v_initiation.delivery_status in ('queued', 'retry_wait')
      and v_initiation.claim_token is null
    then
      update public.affiliate_application_payment_command_outbox
      set delivery_status = 'suppressed', next_attempt_at = null,
        last_error_code = 'APPROVAL_REVERSED', claim_token = null, claimed_at = null
      where command_id = v_initiation.command_id;
      update public.affiliate_application_payment_coordination
      set payment_status = case when payment_status in ('paid', 'refunded') then payment_status else 'cancelled' end,
        cancelled_at = case when payment_status in ('paid', 'refunded') then cancelled_at else v_now end,
        payment_operation_state = case when payment_status in ('paid', 'refunded')
          then 'cancellation_intervention_required' else 'none' end,
        last_operational_error_code = case when payment_status in ('paid', 'refunded')
          then 'APPROVAL_REVERSED_AFTER_PAYMENT' else null end,
        last_operational_error_at = case when payment_status in ('paid', 'refunded') then v_now else null end
      where application_id = p_application_id
        and current_payment_request_id = v_initiation.payment_request_id;
    elsif found then
      select cancellation.command_id into v_cancellation_id
      from public.affiliate_application_payment_command_outbox as cancellation
      where cancellation.command_type = 'payment_cancellation'
        and cancellation.payment_request_id = v_initiation.payment_request_id
        and cancellation.application_id = p_application_id
      for update;
      if v_cancellation_id is null then
        v_cancellation_id := pg_catalog.gen_random_uuid();
        v_idempotency_key := pg_catalog.gen_random_uuid();
        v_payload := pg_catalog.jsonb_build_object(
          'contractVersion', 1,
          'cancellationId', v_cancellation_id::text,
          'euApplicationId', v_application.id::text,
          'bkfcApplicationId', v_application.source_application_id,
          'paymentRequestId', v_initiation.payment_request_id::text,
          'reasonCode', 'approval_reversed',
          'approvalReversedAt', pg_catalog.to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
        insert into public.affiliate_application_payment_command_outbox (
          command_id, application_id, bkfc_application_id, command_type,
          payment_request_id, idempotency_key, payload, payload_hash,
          delivery_status, request_reason, created_by_user_id, created_by_email
        ) values (
          v_cancellation_id, p_application_id, v_application.source_application_id,
          'payment_cancellation', v_initiation.payment_request_id, v_idempotency_key,
          v_payload, public.bkfc_json_sha256_v1(v_payload), 'queued', 'approval_reversal',
          p_actor_user_id, pg_catalog.lower(nullif(pg_catalog.btrim(p_actor_email), ''))
        );
      end if;
      update public.affiliate_application_payment_coordination
      set payment_operation_state = 'cancellation_queued',
        last_operational_error_code = case when payment_status in ('paid', 'refunded')
          then 'APPROVAL_REVERSED_AFTER_PAYMENT' else null end,
        last_operational_error_at = case when payment_status in ('paid', 'refunded') then v_now else null end
      where application_id = p_application_id
        and current_payment_request_id = v_initiation.payment_request_id;
    end if;
  end if;

  update public.affiliate_applications
  set review_stage = p_review_stage, status = p_status
  where id = p_application_id;
  insert into public.application_stage_history (application_id, review_stage, status, changed_at)
  values (p_application_id, p_review_stage, p_status, v_now);
  insert into public.affiliate_application_audit_events (
    application_id, event_type, actor_user_id, actor_email,
    from_review_stage, to_review_stage, from_status, to_status, details
  ) values (
    p_application_id, 'stage_changed', p_actor_user_id,
    pg_catalog.lower(nullif(pg_catalog.btrim(p_actor_email), '')),
    v_application.review_stage, p_review_stage, v_application.status, p_status,
    case when v_is_bkfc and p_review_stage = 'approved' and p_status = 'approved'
      then pg_catalog.jsonb_build_object('bkfc_payment_managed', true)
      else '{}'::jsonb end
  ) returning id into v_event_id;

  v_notification_type := case p_review_stage
    when 'follow_up_required' then 'more_information_required'
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    when 'activated_affiliate' then 'affiliate_activated'
    else null
  end;
  if v_notification_type is not null then
    insert into public.affiliate_application_notification_outbox (
      application_id, audit_event_id, notification_type, dedupe_key, delivery_status
    ) values (
      p_application_id, v_event_id, v_notification_type,
      p_application_id::text || ':' || v_event_id::text || ':' || v_notification_type,
      'blocked_copy_pending'
    ) returning id into v_notification_id;
    insert into public.affiliate_application_audit_events (
      application_id, event_type, actor_user_id, actor_email, details
    ) values (
      p_application_id, 'applicant_notification_requested', p_actor_user_id,
      pg_catalog.lower(nullif(pg_catalog.btrim(p_actor_email), '')),
      pg_catalog.jsonb_build_object(
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

create or replace function public.admin_create_affiliate_payment_request(
  p_application_id uuid,
  p_plan_code text,
  p_request_reason text,
  p_actor_user_id uuid,
  p_actor_email text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_application public.affiliate_applications%rowtype;
  v_coordination public.affiliate_application_payment_coordination%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_cancellation_activity boolean;
begin
  if p_plan_code not in ('monthly', 'quarterly')
    or p_request_reason not in ('legacy_initialization', 'staff_reissue')
    or nullif(pg_catalog.btrim(p_actor_email), '') is null
  then raise exception 'Invalid payment request' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(1112233445);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bkfc-payment:' || p_application_id::text));
  select application.* into v_application
  from public.affiliate_applications as application
  where application.id = p_application_id for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  if v_application.review_stage <> 'approved' or v_application.status <> 'approved'
  then raise exception 'Application must be approved' using errcode = '55000'; end if;
  if v_application.source_system is distinct from 'bkfc' or v_application.source_application_id is null
  then raise exception 'BKFC application identity is required' using errcode = '55000'; end if;
  select coordination.* into v_coordination
  from public.affiliate_application_payment_coordination as coordination
  where coordination.application_id = p_application_id for update;
  if not found then
    if p_request_reason <> 'legacy_initialization'
    then raise exception 'Legacy initialization is required' using errcode = '55000'; end if;
    insert into public.affiliate_application_payment_coordination (
      application_id, plan_code, payment_status, payment_operation_state
    ) values (p_application_id, p_plan_code, 'not_requested', 'none')
    returning * into v_coordination;
  end if;
  if v_coordination.payment_status in ('paid', 'refunded')
  then raise exception 'Paid or refunded payment cannot be reissued' using errcode = '55000'; end if;
  if p_request_reason = 'legacy_initialization' and v_coordination.current_payment_request_id is not null
  then raise exception 'Legacy payment already initialized' using errcode = '55000'; end if;
  if p_request_reason = 'staff_reissue' and v_coordination.payment_status = 'pending' then
    select exists (
      select 1 from public.affiliate_application_payment_command_outbox as cancellation
      where cancellation.payment_request_id = v_coordination.current_payment_request_id
        and cancellation.command_type = 'payment_cancellation'
    ) into v_cancellation_activity;
    v_cancellation_activity := v_cancellation_activity
      or v_coordination.payment_operation_state in (
        'cancellation_queued', 'cancellation_retrying', 'cancellation_accepted',
        'cancellation_intervention_required'
      );
    if not v_cancellation_activity
    then raise exception 'PAYMENT_CYCLE_STILL_ACTIVE' using errcode = '55000'; end if;
  end if;
  return public.create_bkfc_payment_initiation_cycle_v2(
    p_application_id, p_plan_code, p_request_reason,
    p_actor_user_id, p_actor_email, v_now
  );
end;
$$;

create or replace function public.claim_affiliate_payment_command_delivery(
  p_claim_token uuid,
  p_batch_size integer,
  p_lease_seconds integer
)
returns table (
  command_id uuid,
  application_id uuid,
  command_type text,
  payment_request_id uuid,
  idempotency_key uuid,
  payload jsonb,
  payload_hash text,
  attempt_count integer,
  claim_token uuid
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_tokens numeric;
  v_last_refill_at timestamptz;
  v_active integer;
  v_eligible integer;
  v_claim_limit integer;
begin
  if p_claim_token is null or p_batch_size not between 1 and 25
    or p_lease_seconds not between 60 and 3600
  then raise exception 'Invalid payment command claim' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(1112233445);

  with suppressed as (
    update public.affiliate_application_payment_command_outbox as command
    set delivery_status = 'suppressed', next_attempt_at = null,
      claim_token = null, claimed_at = null, last_error_code = 'APPROVAL_NOT_CURRENT'
    where command.command_type = 'payment_initiation'
      and command.delivery_status in ('queued', 'retry_wait')
      and not exists (
        select 1
        from public.affiliate_applications as application
        join public.affiliate_application_payment_coordination as coordination
          on coordination.application_id = application.id
        where application.id = command.application_id
          and application.review_stage = 'approved'
          and application.status = 'approved'
          and coordination.current_payment_request_id = command.payment_request_id
      )
    returning command.application_id, command.payment_request_id
  )
  update public.affiliate_application_payment_coordination as coordination
  set payment_status = case when coordination.payment_status in ('paid', 'refunded')
      then coordination.payment_status else 'cancelled' end,
    cancelled_at = case when coordination.payment_status in ('paid', 'refunded')
      then coordination.cancelled_at else v_now end,
    payment_operation_state = case when coordination.payment_status in ('paid', 'refunded')
      then 'cancellation_intervention_required' else 'none' end
  from suppressed
  where coordination.application_id = suppressed.application_id
    and coordination.current_payment_request_id = suppressed.payment_request_id;

  select throttle.tokens, throttle.last_refill_at
  into v_tokens, v_last_refill_at
  from public.affiliate_application_payment_delivery_throttle as throttle
  where throttle.singleton = true for update;
  if not found then raise exception 'Payment delivery throttle unavailable' using errcode = '55000'; end if;
  v_now := pg_catalog.clock_timestamp();
  v_tokens := least(5, v_tokens + greatest(
    0, pg_catalog.date_part('epoch', v_now - v_last_refill_at)
  ) * 5);
  select pg_catalog.count(*)::integer into v_active
  from public.affiliate_application_payment_command_outbox as command
  where command.delivery_status = 'sending'
    and command.claimed_at >= v_now - pg_catalog.make_interval(secs => p_lease_seconds);
  select pg_catalog.count(*)::integer into v_eligible
  from public.affiliate_application_payment_command_outbox as command
  where command.attempt_count < 6 and (
    command.delivery_status = 'queued'
    or (command.delivery_status = 'retry_wait' and command.next_attempt_at <= v_now)
    or (command.delivery_status = 'sending'
      and command.claimed_at < v_now - pg_catalog.make_interval(secs => p_lease_seconds))
  );
  v_claim_limit := least(
    p_batch_size, greatest(0, 5 - v_active),
    pg_catalog.floor(v_tokens)::integer, v_eligible
  );
  update public.affiliate_application_payment_delivery_throttle
  set tokens = v_tokens - v_claim_limit, last_refill_at = v_now
  where singleton = true;
  if v_claim_limit <= 0 then return; end if;

  return query
  with candidates as (
    select command.command_id
    from public.affiliate_application_payment_command_outbox as command
    where command.attempt_count < 6 and (
      command.delivery_status = 'queued'
      or (command.delivery_status = 'retry_wait' and command.next_attempt_at <= pg_catalog.now())
      or (command.delivery_status = 'sending'
        and command.claimed_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_lease_seconds))
    )
    order by command.application_id, command.created_at, command.command_id
    for update skip locked
    limit v_claim_limit
  )
  update public.affiliate_application_payment_command_outbox as command
  set delivery_status = 'sending', claim_token = p_claim_token,
    claimed_at = pg_catalog.now(), last_attempt_at = pg_catalog.now(),
    attempt_count = command.attempt_count + 1, next_attempt_at = null
  from candidates
  where command.command_id = candidates.command_id
  returning command.command_id, command.application_id, command.command_type,
    command.payment_request_id, command.idempotency_key, command.payload,
    command.payload_hash, command.attempt_count, command.claim_token;
end;
$$;

create or replace function public.confirm_affiliate_payment_command_transmission(
  p_command_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_application_id uuid;
  v_command public.affiliate_application_payment_command_outbox%rowtype;
  v_application public.affiliate_applications%rowtype;
  v_coordination public.affiliate_application_payment_coordination%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(1112233445);
  select command.application_id into v_application_id
  from public.affiliate_application_payment_command_outbox as command
  where command.command_id = p_command_id;
  if not found then raise exception 'Payment command claim unavailable' using errcode = 'P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bkfc-payment:' || v_application_id::text));
  select application.* into v_application
  from public.affiliate_applications as application
  where application.id = v_application_id for update;
  select coordination.* into v_coordination
  from public.affiliate_application_payment_coordination as coordination
  where coordination.application_id = v_application_id for update;
  select command.* into v_command
  from public.affiliate_application_payment_command_outbox as command
  where command.command_id = p_command_id
    and command.delivery_status = 'sending'
    and command.claim_token = p_claim_token
  for update;
  if not found then raise exception 'Payment command claim unavailable' using errcode = 'P0002'; end if;
  if v_command.command_type = 'payment_cancellation' then return true; end if;
  if v_application.review_stage = 'approved' and v_application.status = 'approved'
    and v_coordination.current_payment_request_id = v_command.payment_request_id
  then return true; end if;
  update public.affiliate_application_payment_command_outbox
  set delivery_status = 'suppressed', claim_token = null, claimed_at = null,
    last_error_code = 'APPROVAL_NOT_CURRENT'
  where command_id = v_command.command_id;
  update public.affiliate_application_payment_coordination
  set payment_status = case when payment_status in ('paid', 'refunded') then payment_status else 'cancelled' end,
    cancelled_at = case when payment_status in ('paid', 'refunded') then cancelled_at else pg_catalog.now() end,
    payment_operation_state = case when payment_status in ('paid', 'refunded')
      then 'cancellation_intervention_required' else 'none' end
  where application_id = v_command.application_id
    and current_payment_request_id = v_command.payment_request_id;
  return false;
end;
$$;

create or replace function public.complete_affiliate_payment_command_delivery(
  p_command_id uuid,
  p_claim_token uuid,
  p_disposition text,
  p_request_id uuid,
  p_http_status integer,
  p_error_code text,
  p_next_attempt_at timestamptz,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_application_id uuid;
  v_command public.affiliate_application_payment_command_outbox%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_disposition not in ('accepted', 'retry', 'intervention')
    or p_request_id is null
    or (p_http_status is not null and p_http_status not between 100 and 599)
    or (p_error_code is not null and p_error_code !~ '^[A-Z][A-Z0-9_]{0,63}$')
  then raise exception 'Invalid payment command completion' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(1112233445);
  select command.application_id into v_application_id
  from public.affiliate_application_payment_command_outbox as command
  where command.command_id = p_command_id;
  if not found then raise exception 'Payment command claim unavailable' using errcode = 'P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bkfc-payment:' || v_application_id::text));
  perform 1 from public.affiliate_applications where id = v_application_id for update;
  perform 1 from public.affiliate_application_payment_coordination
    where application_id = v_application_id for update;
  select command.* into v_command
  from public.affiliate_application_payment_command_outbox as command
  where command.command_id = p_command_id and command.delivery_status = 'sending'
    and command.claim_token = p_claim_token
  for update;
  if not found then raise exception 'Payment command claim unavailable' using errcode = 'P0002'; end if;

  if p_disposition = 'accepted' then
    update public.affiliate_application_payment_command_outbox
    set delivery_status = 'accepted', accepted_at = v_now, next_attempt_at = null,
      claim_token = null, claimed_at = null, last_request_id = p_request_id,
      last_http_status = p_http_status, last_error_code = p_error_code
    where command_id = p_command_id;
    if v_command.command_type = 'payment_initiation' then
      update public.affiliate_application_payment_coordination
      set payment_status = case when p_outcome = 'cancelled' and payment_status not in ('paid', 'refunded')
          then 'cancelled' else payment_status end,
        cancelled_at = case when p_outcome = 'cancelled' and payment_status not in ('paid', 'refunded')
          then v_now else cancelled_at end,
        payment_operation_state = 'none',
        last_operational_error_code = p_error_code,
        last_operational_error_at = case when p_error_code is null then null else v_now end
      where application_id = v_command.application_id
        and current_payment_request_id = v_command.payment_request_id;
    elsif p_outcome in ('cancelled', 'not_created', 'already_inactive') then
      update public.affiliate_application_payment_coordination
      set payment_status = case when payment_status in ('paid', 'refunded') then payment_status else 'cancelled' end,
        cancelled_at = case when payment_status in ('paid', 'refunded') then cancelled_at else v_now end,
        payment_operation_state = case when payment_status in ('paid', 'refunded')
          then 'cancellation_intervention_required' else 'none' end,
        last_operational_error_code = case when payment_status in ('paid', 'refunded')
          then 'CANCELLATION_AFTER_FINANCIAL_COMPLETION' else null end,
        last_operational_error_at = case when payment_status in ('paid', 'refunded') then v_now else null end
      where application_id = v_command.application_id
        and current_payment_request_id = v_command.payment_request_id;
    elsif p_outcome = 'processing' then
      update public.affiliate_application_payment_coordination
      set payment_operation_state = 'cancellation_accepted'
      where application_id = v_command.application_id
        and current_payment_request_id = v_command.payment_request_id;
    else
      update public.affiliate_application_payment_coordination
      set payment_operation_state = 'cancellation_intervention_required',
        last_operational_error_code = coalesce(p_error_code, 'PAYMENT_ALREADY_COMPLETED'),
        last_operational_error_at = v_now
      where application_id = v_command.application_id
        and current_payment_request_id = v_command.payment_request_id;
    end if;
  elsif p_disposition = 'retry' then
    if p_next_attempt_at is null then raise exception 'Retry time is required' using errcode = '22023'; end if;
    update public.affiliate_application_payment_command_outbox
    set delivery_status = 'retry_wait', next_attempt_at = p_next_attempt_at,
      claim_token = null, claimed_at = null, last_request_id = p_request_id,
      last_http_status = p_http_status, last_error_code = p_error_code
    where command_id = p_command_id;
    update public.affiliate_application_payment_coordination
    set payment_operation_state = case when v_command.command_type = 'payment_initiation'
        then 'initiation_retrying' else 'cancellation_retrying' end,
      last_operational_error_code = p_error_code, last_operational_error_at = v_now
    where application_id = v_command.application_id
      and current_payment_request_id = v_command.payment_request_id;
  else
    update public.affiliate_application_payment_command_outbox
    set delivery_status = 'intervention_required', next_attempt_at = null,
      claim_token = null, claimed_at = null, last_request_id = p_request_id,
      last_http_status = p_http_status,
      last_error_code = coalesce(p_error_code, 'DELIVERY_INTERVENTION_REQUIRED')
    where command_id = p_command_id;
    update public.affiliate_application_payment_coordination
    set payment_operation_state = case when v_command.command_type = 'payment_initiation'
        then 'initiation_intervention_required' else 'cancellation_intervention_required' end,
      last_operational_error_code = coalesce(p_error_code, 'DELIVERY_INTERVENTION_REQUIRED'),
      last_operational_error_at = v_now
    where application_id = v_command.application_id
      and current_payment_request_id = v_command.payment_request_id;
  end if;
  return true;
end;
$$;

create or replace function public.record_bkfc_payment_status_event_v1(
  p_external_event_id uuid,
  p_application_id uuid,
  p_payment_request_id uuid,
  p_bkfc_application_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_reason_code text,
  p_payload_hash text,
  p_request_id uuid,
  p_reservation_id uuid,
  p_claim_token uuid
)
returns table (
  reused boolean,
  applied boolean,
  payment_status text,
  not_applied_reason text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_existing public.affiliate_application_payment_status_events%rowtype;
  v_application public.affiliate_applications%rowtype;
  v_coordination public.affiliate_application_payment_coordination%rowtype;
  v_command public.affiliate_application_payment_command_outbox%rowtype;
  v_reservation public.bkfc_integration_ingress_reservations%rowtype;
  v_previous text;
  v_result text;
  v_applied boolean := false;
  v_not_applied text;
  v_current boolean;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_external_event_id is null or p_application_id is null or p_payment_request_id is null
    or p_request_id is null or p_reservation_id is null or p_claim_token is null
    or p_event_type not in (
      'payment_link_sent', 'payment_paid', 'payment_cancelled',
      'payment_refunded', 'payment_initiation_failed'
    )
    or p_payload_hash !~ '^[a-f0-9]{64}$'
    or p_bkfc_application_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_occurred_at > v_now + interval '5 minutes'
    or (p_reason_code is not null and p_reason_code !~ '^[a-z][a-z0-9_]{0,63}$')
  then raise exception 'VALIDATION_FAILED' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bkfc-event:' || p_external_event_id::text));
  select event.* into v_existing
  from public.affiliate_application_payment_status_events as event
  where event.external_event_id = p_external_event_id;
  if found then
    if v_existing.payload_hash is distinct from p_payload_hash
    then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505'; end if;
    return query select true, v_existing.applied, v_existing.resulting_status, v_existing.not_applied_reason;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(1112233445);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bkfc-payment:' || p_application_id::text));
  select reservation.* into v_reservation
  from public.bkfc_integration_ingress_reservations as reservation
  where reservation.reservation_id = p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_reservation.direction is distinct from 'callback'
    or v_reservation.lifecycle_state is distinct from 'in_progress'
    or v_reservation.claim_token is distinct from p_claim_token
    or v_reservation.logical_request_id is distinct from p_external_event_id
    or v_reservation.source_application_id is distinct from p_bkfc_application_id
    or v_reservation.payload_hash is distinct from p_payload_hash
    or v_reservation.eu_application_id is distinct from p_application_id
    or v_reservation.payment_request_id is distinct from p_payment_request_id
  then raise exception 'RESERVATION_CLAIM_CONFLICT' using errcode = '55000'; end if;
  select application.* into v_application
  from public.affiliate_applications as application
  where application.id = p_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_application.source_system is distinct from 'bkfc'
    or v_application.source_application_id is distinct from p_bkfc_application_id
  then raise exception 'CORRELATION_CONFLICT' using errcode = '23505'; end if;
  select coordination.* into v_coordination
  from public.affiliate_application_payment_coordination as coordination
  where coordination.application_id = p_application_id for update;
  if not found then raise exception 'PAYMENT_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  select command.* into v_command
  from public.affiliate_application_payment_command_outbox as command
  where command.command_id = p_payment_request_id
    and command.application_id = p_application_id
    and command.command_type = 'payment_initiation';
  if not found then raise exception 'PAYMENT_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_command.bkfc_application_id is distinct from p_bkfc_application_id
  then raise exception 'PAYMENT_REQUEST_MISMATCH' using errcode = '23505'; end if;

  v_previous := v_coordination.payment_status;
  v_result := v_previous;
  v_current := v_coordination.current_payment_request_id = p_payment_request_id;
  if not v_current then
    v_not_applied := 'superseded_payment_request';
  elsif p_event_type in ('payment_link_sent', 'payment_cancelled', 'payment_initiation_failed')
    and v_coordination.last_status_event_occurred_at is not null
    and p_occurred_at < v_coordination.last_status_event_occurred_at
  then v_not_applied := 'stale_event';
  elsif p_event_type = 'payment_link_sent' then
    if v_previous <> 'pending' then v_not_applied := 'transition_not_permitted';
    elsif v_coordination.payment_link_sent_at is not null then v_not_applied := 'duplicate_business_state';
    else v_applied := true; end if;
  elsif p_event_type = 'payment_paid' then
    if v_previous = 'refunded' then v_not_applied := 'transition_not_permitted';
    elsif v_previous = 'paid' then v_not_applied := 'duplicate_business_state';
    else v_applied := true; v_result := 'paid'; end if;
  elsif p_event_type = 'payment_cancelled' then
    if v_previous in ('paid', 'refunded') then v_not_applied := 'transition_not_permitted';
    elsif v_previous = 'cancelled' then v_not_applied := 'duplicate_business_state';
    elsif v_previous <> 'pending' then v_not_applied := 'transition_not_permitted';
    else v_applied := true; v_result := 'cancelled'; end if;
  elsif p_event_type = 'payment_refunded' then
    if v_previous = 'refunded' then v_not_applied := 'duplicate_business_state';
    else v_applied := true; v_result := 'refunded'; end if;
  elsif p_event_type = 'payment_initiation_failed' then
    if v_previous <> 'pending' then v_not_applied := 'transition_not_permitted';
    else v_applied := true; end if;
  end if;

  insert into public.affiliate_application_payment_status_events (
    external_event_id, application_id, payment_request_id, bkfc_application_id,
    event_type, occurred_at, reason_code, payload_hash, request_id,
    previous_status, resulting_status, applied, not_applied_reason
  ) values (
    p_external_event_id, p_application_id, p_payment_request_id, p_bkfc_application_id,
    p_event_type, p_occurred_at, p_reason_code, p_payload_hash, p_request_id,
    v_previous, v_result, v_applied, v_not_applied
  );
  if v_applied then
    update public.affiliate_application_payment_coordination
    set payment_status = v_result,
      payment_link_sent_at = case when p_event_type = 'payment_link_sent'
        then coalesce(payment_link_sent_at, p_occurred_at) else payment_link_sent_at end,
      paid_at = case when p_event_type = 'payment_paid'
        then coalesce(paid_at, p_occurred_at) else paid_at end,
      cancelled_at = case when p_event_type = 'payment_cancelled'
        then coalesce(cancelled_at, p_occurred_at) else cancelled_at end,
      refunded_at = case when p_event_type = 'payment_refunded'
        then coalesce(refunded_at, p_occurred_at) else refunded_at end,
      last_status_event_id = p_external_event_id,
      last_status_event_occurred_at = p_occurred_at,
      payment_operation_state = case
        when p_event_type = 'payment_initiation_failed' then 'initiation_intervention_required'
        when p_event_type = 'payment_paid'
          and (v_application.review_stage <> 'approved' or v_application.status <> 'approved')
          then 'cancellation_intervention_required'
        when p_event_type in ('payment_cancelled', 'payment_refunded') then 'none'
        else payment_operation_state
      end,
      last_operational_error_code = case
        when p_event_type = 'payment_initiation_failed' then 'PAYMENT_INITIATION_FAILED'
        when p_event_type = 'payment_paid'
          and (v_application.review_stage <> 'approved' or v_application.status <> 'approved')
          then 'PAYMENT_AFTER_APPROVAL_REVERSAL'
        when p_event_type in ('payment_cancelled', 'payment_refunded') then null
        else last_operational_error_code
      end,
      last_operational_error_at = case
        when p_event_type = 'payment_initiation_failed'
          or (p_event_type = 'payment_paid'
            and (v_application.review_stage <> 'approved' or v_application.status <> 'approved'))
          then v_now
        when p_event_type in ('payment_cancelled', 'payment_refunded') then null
        else last_operational_error_at
      end
    where application_id = p_application_id
      and current_payment_request_id = p_payment_request_id;
  end if;
  update public.bkfc_integration_ingress_reservations
  set lifecycle_state = 'completed',
    outcome_code = case when v_applied
      then 'PAYMENT_STATUS_EVENT_ACCEPTED' else 'PAYMENT_STATUS_EVENT_RECORDED' end,
    completed_at = v_now, claim_token = null, lease_expires_at = null
  where reservation_id = p_reservation_id;
  return query select false, v_applied, v_result, v_not_applied;
end;
$$;

alter table public.affiliate_application_payment_coordination enable row level security;
alter table public.affiliate_application_payment_command_outbox enable row level security;
alter table public.affiliate_application_payment_status_events enable row level security;

revoke all on function public.enforce_affiliate_payment_cycle_reference_v2()
  from public, anon, authenticated, service_role;
revoke all on function public.create_bkfc_payment_initiation_cycle_v2(uuid, text, text, uuid, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_transition_affiliate_application(uuid, text, text, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_create_affiliate_payment_request(uuid, text, text, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_affiliate_payment_command_delivery(uuid, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.confirm_affiliate_payment_command_transmission(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_affiliate_payment_command_delivery(
  uuid, uuid, text, uuid, integer, text, timestamptz, text
) from public, anon, authenticated, service_role;
revoke all on function public.record_bkfc_payment_status_event_v1(
  uuid, uuid, uuid, text, text, timestamptz, text, text, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.admin_transition_affiliate_application(uuid, text, text, uuid, text)
  to service_role;
grant execute on function public.admin_create_affiliate_payment_request(uuid, text, text, uuid, text)
  to service_role;
grant execute on function public.claim_affiliate_payment_command_delivery(uuid, integer, integer)
  to service_role;
grant execute on function public.confirm_affiliate_payment_command_transmission(uuid, uuid)
  to service_role;
grant execute on function public.complete_affiliate_payment_command_delivery(
  uuid, uuid, text, uuid, integer, text, timestamptz, text
) to service_role;
grant execute on function public.record_bkfc_payment_status_event_v1(
  uuid, uuid, uuid, text, text, timestamptz, text, text, uuid, uuid, uuid
) to service_role;

comment on function public.create_bkfc_payment_initiation_cycle_v2(uuid, text, text, uuid, text, timestamptz) is
  'Internal, ungranted helper that creates one immutable initiation and atomically makes its payment_request_id the current cycle.';
comment on function public.confirm_affiliate_payment_command_transmission(uuid, uuid) is
  'Final transactional transmission gate for every claimed command; suppresses noncurrent initiations while retaining request-scoped cancellation tombstones.';
comment on function public.complete_affiliate_payment_command_delivery(uuid, uuid, text, uuid, integer, text, timestamptz, text) is
  'Finalizes immutable command history and mutates coordination only when the command payment_request_id remains current.';
comment on function public.record_bkfc_payment_status_event_v1(uuid, uuid, uuid, text, text, timestamptz, text, text, uuid, uuid, uuid) is
  'Append-only callback recorder; every noncurrent request is retained as superseded_payment_request and cannot mutate current coordination.';

commit;
