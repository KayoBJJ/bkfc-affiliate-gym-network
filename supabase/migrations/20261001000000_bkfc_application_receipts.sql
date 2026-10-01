-- Official intake receipts reuse the outbox but never release workflow messages.
-- Enqueue is atomic with application creation. No historical applications are backfilled.
alter table public.affiliate_application_notification_outbox
  drop constraint affiliate_app_notification_outbox_type_check;
alter table public.affiliate_application_notification_outbox
  add constraint affiliate_app_notification_outbox_type_check check (
    notification_type in ('application_received', 'more_information_required',
      'information_received', 'approved', 'rejected', 'affiliate_activated', 'manual_applicant_update')
  );

create or replace function public.enqueue_bkfc_application_receipt()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_audit_id uuid;
begin
  if new.source_system is distinct from 'bkfc' then return new; end if;
  insert into public.affiliate_application_audit_events(application_id, event_type, details)
  values (new.id, 'applicant_notification_requested',
    jsonb_build_object('notification_type', 'application_received', 'receipt_design', 'gym-network-v1'))
  returning id into v_audit_id;
  insert into public.affiliate_application_notification_outbox
    (application_id, audit_event_id, notification_type, dedupe_key, delivery_status)
  values (new.id, v_audit_id, 'application_received', 'application-received:' || new.id::text, 'pending')
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
create trigger enqueue_bkfc_application_receipt
  after insert on public.affiliate_applications
  for each row execute function public.enqueue_bkfc_application_receipt();

-- Stop automatic retries before the provider's 24-hour idempotency window expires.
-- Older uncertain sends require reconciliation against the provider delivery log.
alter table public.affiliate_application_notification_outbox
  add column receipt_first_attempt_at timestamptz;

create or replace function public.inspect_affiliate_receipt_queue(p_application_reference text default null)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.affiliate_application_notification_outbox outbox
  where outbox.notification_type = 'application_received'
    and (outbox.receipt_first_attempt_at is null or outbox.receipt_first_attempt_at > now() - interval '23 hours')
    and (p_application_reference is null or exists (
      select 1 from public.affiliate_applications application
      where application.id = outbox.application_id
        and upper(application.application_reference) = upper(p_application_reference)
    ))
    and outbox.attempt_count < 3
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

create or replace function public.claim_affiliate_receipts(
  p_claim_token uuid,
  p_batch_size integer,
  p_application_reference text default null
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
    where outbox.notification_type = 'application_received'
    and (outbox.receipt_first_attempt_at is null or outbox.receipt_first_attempt_at > now() - interval '23 hours')
    and (p_application_reference is null or exists (
      select 1 from public.affiliate_applications application
      where application.id = outbox.application_id
        and upper(application.application_reference) = upper(p_application_reference)
    ))
    and outbox.attempt_count < 3
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
      receipt_first_attempt_at = coalesce(outbox.receipt_first_attempt_at, now()),
      attempt_count = outbox.attempt_count + 1,
      updated_at = now()
  from candidates
  where outbox.id = candidates.id
  returning outbox.id;
end;
$$;

create or replace function public.complete_affiliate_receipt_delivery(
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
  v_exhausted boolean;
begin
  select * into v_outbox
  from public.affiliate_application_notification_outbox
  where id = p_outbox_id
    and notification_type = 'application_received'
    and delivery_status = 'sending'
    and claim_token = p_claim_token
  for update;
  if not found then
    raise exception 'Notification claim unavailable' using errcode = 'P0002';
  end if;

  v_exhausted := v_outbox.attempt_count >= 3;

  if p_succeeded and nullif(trim(p_provider_message_id), '') is null then
    raise exception 'Provider message ID is required' using errcode = '22023';
  end if;

  if p_succeeded then
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
        'receipt_design', 'gym-network-v1',
        'provider_message_id_recorded', p_provider_message_id is not null
      )
    );
  else
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
        'receipt_design', 'gym-network-v1',
        'attempt_count', v_outbox.attempt_count,
        'retry_scheduled', not v_exhausted,
        'error_code', coalesce(nullif(trim(p_error_code), ''), 'DELIVERY_FAILED')
      )
    );
  end if;

  return true;
end;
$$;


revoke all on function public.enqueue_bkfc_application_receipt() from public, anon, authenticated;
revoke all on function public.inspect_affiliate_receipt_queue(text) from public, anon, authenticated;
revoke all on function public.claim_affiliate_receipts(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.complete_affiliate_receipt_delivery(uuid, uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.inspect_affiliate_receipt_queue(text) to service_role;
grant execute on function public.claim_affiliate_receipts(uuid, integer, text) to service_role;
grant execute on function public.complete_affiliate_receipt_delivery(uuid, uuid, boolean, text, text) to service_role;
