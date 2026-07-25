-- Batch 1A.3, slice 3 hotfix: preserve one-time replacement links in the UI and
-- let an authenticated admin safely invalidate and regenerate a missed link.

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
      'applicant_notification_requested',
      'applicant_notification_sent',
      'applicant_notification_failed'
    )
  );

create or replace function public.admin_reissue_affiliate_information_response_link(
  p_request_id uuid,
  p_token_hash text,
  p_actor_user_id uuid,
  p_actor_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.affiliate_application_information_requests%rowtype;
  v_event_id uuid;
  v_outbox_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid response token' using errcode = '22023';
  end if;

  select * into v_request
  from public.affiliate_application_information_requests
  where id = p_request_id
  for update;

  if not found
    or v_request.status <> 'open'
    or not exists (
      select 1
      from public.affiliate_application_information_attachments
      where request_id = v_request.id
        and status = 'replacement_requested'
    )
  then
    raise exception 'Replacement request unavailable' using errcode = 'P0002';
  end if;

  update public.affiliate_application_information_requests
  set token_hash = p_token_hash,
      expires_at = greatest(expires_at, now() + interval '7 days')
  where id = v_request.id;

  update public.affiliate_application_notification_outbox
  set delivery_status = 'cancelled',
      updated_at = now()
  where application_id = v_request.application_id
    and notification_type = 'more_information_required'
    and delivery_status in ('blocked_copy_pending', 'pending', 'failed');

  insert into public.affiliate_application_audit_events (
    application_id, event_type, actor_user_id, actor_email, details
  ) values (
    v_request.application_id,
    'information_request_link_reissued',
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    jsonb_build_object('information_request_id', v_request.id)
  )
  returning id into v_event_id;

  insert into public.affiliate_application_notification_outbox (
    application_id,
    audit_event_id,
    notification_type,
    dedupe_key,
    delivery_status
  ) values (
    v_request.application_id,
    v_event_id,
    'more_information_required',
    v_request.application_id::text || ':' || v_request.id::text ||
      ':replacement_link_reissued:' || v_event_id::text,
    'blocked_copy_pending'
  )
  returning id into v_outbox_id;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, actor_user_id, actor_email, details
  ) values (
    v_request.application_id,
    'applicant_notification_requested',
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    jsonb_build_object(
      'information_request_id', v_request.id,
      'notification_outbox_id', v_outbox_id,
      'notification_type', 'more_information_required',
      'delivery_status', 'blocked_copy_pending',
      'reason', 'official_copy_not_approved',
      'source', 'replacement_link_reissued'
    )
  );

  return v_request.application_id;
end;
$$;

revoke all on function public.admin_reissue_affiliate_information_response_link(
  uuid, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.admin_reissue_affiliate_information_response_link(
  uuid, text, uuid, text
) to service_role;
