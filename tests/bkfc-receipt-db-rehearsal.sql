\set ON_ERROR_STOP on
create temporary table receipt_submission_reservation on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '71000000-0000-4000-8000-000000000003', 'BKFC-RECEIPT-1',
  repeat('a', 64), repeat('7', 64), null, null, 120
);

do $$
declare v_reservation record;
begin
  select * into strict v_reservation from receipt_submission_reservation;
  if v_reservation.disposition <> 'acquired' then raise exception 'submission reservation not acquired'; end if;
  perform public.create_bkfc_affiliate_application_v1(
    p_reservation_id => v_reservation.reservation_id,
    p_claim_token => v_reservation.claim_token,
    p_idempotency_key => '71000000-0000-4000-8000-000000000003',
    p_payload_hash => repeat('a', 64), p_source_application_id => 'BKFC-RECEIPT-1',
    p_ingest_request_id => '40000000-0000-4000-8000-000000000004',
    p_gym_name => 'Receipt Gym', p_contact_person => 'BKFC Applicant',
    p_street_address => '1 Test Street', p_city => 'Sofia', p_administrative_region => null,
    p_postal_code => '1000', p_country => 'Bulgaria', p_email => 'receipt@example.test',
    p_phone => '+359000000002', p_website => null, p_instagram => null,
    p_disciplines_offered => 'Boxing, MMA', p_promo_video_link => null,
    p_plan_code => 'monthly', p_bkfc_app_access_interest => false,
    p_review_consent => true, p_follow_up_consent => false,
    p_consent_notice_version => 'eu-bkfc-v1',
    p_logo_path => v_reservation.reserved_application_id::text || '/logo/logo.png',
    p_logo_content_type => 'image/png', p_logo_size_bytes => 8,
    p_logo_sha256 => repeat('b', 64), p_city_country => 'Sofia, Bulgaria',
    p_website_instagram => '', p_region => 'Europe',
    p_normalized_gym_name => 'receipt gym', p_normalized_email => 'receipt@example.test'
  );
end;
$$;


do $$
declare
  v_application uuid;
  v_outbox uuid;
  v_reference text;
  v_claim uuid := gen_random_uuid();
  v_count integer;
begin
  select reserved_application_id, reserved_application_reference into v_application, v_reference
    from receipt_submission_reservation;
  select id into strict v_outbox from public.affiliate_application_notification_outbox
    where application_id = v_application and notification_type = 'application_received';
  if public.inspect_affiliate_receipt_queue('NOT-THE-TEST-GYM') <> 0 then raise exception 'scope leak'; end if;
  if public.inspect_affiliate_receipt_queue(v_reference) <> 1 then raise exception 'receipt missing'; end if;
  if exists (select 1 from public.affiliate_application_notification_outbox
    where notification_type = 'application_received' and application_id <> v_application)
    then raise exception 'historical receipt backfilled'; end if;

  select count(*) into v_count from public.claim_affiliate_receipts(v_claim, 10, v_reference);
  if v_count <> 1 then raise exception 'claim failed'; end if;
  select count(*) into v_count from public.claim_affiliate_receipts(gen_random_uuid(), 10, v_reference);
  if v_count <> 0 then raise exception 'active claim duplicated'; end if;
  begin
    perform public.complete_affiliate_receipt_delivery(v_outbox, gen_random_uuid(), true, 'bad', null);
    raise exception 'foreign claim accepted';
  exception when no_data_found then null;
  end;
  perform public.complete_affiliate_receipt_delivery(v_outbox, v_claim, false, null, 'PROVIDER_REJECTED');
  if public.inspect_affiliate_receipt_queue(v_reference) <> 0 then raise exception 'retry was not delayed'; end if;
  update public.affiliate_application_notification_outbox set next_attempt_at = now() - interval '1 minute' where id = v_outbox;
  perform public.claim_affiliate_receipts(v_claim, 10, v_reference);
  perform public.complete_affiliate_receipt_delivery(v_outbox, v_claim, true, 'receipt-provider-test', null);
  if not exists(select 1 from public.affiliate_application_notification_outbox where id = v_outbox
    and delivery_status = 'sent' and attempt_count = 2 and portal_access_id is null
    and provider_message_id = 'receipt-provider-test') then raise exception 'completion failed'; end if;
  if public.inspect_affiliate_receipt_queue(v_reference) <> 0 then raise exception 'sent receipt reclaimed'; end if;
  if not exists(select 1 from public.affiliate_application_audit_events where application_id = v_application
    and event_type = 'applicant_notification_sent') then raise exception 'delivery audit missing'; end if;
  begin
    insert into public.affiliate_application_notification_outbox
      (application_id, audit_event_id, notification_type, dedupe_key, delivery_status)
    select application_id, audit_event_id, notification_type, dedupe_key, 'pending'
      from public.affiliate_application_notification_outbox where id = v_outbox;
    raise exception 'duplicate receipt accepted';
  exception when unique_violation then null;
  end;
  -- Recover an expired lease, but never retry outside the provider idempotency window.
  update public.affiliate_application_notification_outbox
    set delivery_status = 'sending', attempt_count = 1, claim_token = v_claim,
      claimed_at = now() - interval '16 minutes' where id = v_outbox;
  if public.inspect_affiliate_receipt_queue(v_reference) <> 1 then raise exception 'stale claim not recoverable'; end if;
  update public.affiliate_application_notification_outbox
    set receipt_first_attempt_at = now() - interval '24 hours' where id = v_outbox;
  if public.inspect_affiliate_receipt_queue(v_reference) <> 0 then raise exception 'unsafe old retry'; end if;
  update public.affiliate_application_notification_outbox
    set receipt_first_attempt_at = now(), attempt_count = 3 where id = v_outbox;
  if public.inspect_affiliate_receipt_queue(v_reference) <> 0 then raise exception 'exhausted retry'; end if;
end;
$$;

-- A failed creation transaction must leave no application, receipt, or audit record.
create temporary table rollback_submission_reservation on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '72000000-0000-4000-8000-000000000003', 'BKFC-RECEIPT-ROLLBACK',
  repeat('a', 64), repeat('7', 64), null, null, 120
);

do $$
declare v_reservation record;
begin
  select * into strict v_reservation from rollback_submission_reservation;
  if v_reservation.disposition <> 'acquired' then raise exception 'submission reservation not acquired'; end if;
  begin
  perform public.create_bkfc_affiliate_application_v1(
    p_reservation_id => v_reservation.reservation_id,
    p_claim_token => v_reservation.claim_token,
    p_idempotency_key => '72000000-0000-4000-8000-000000000003',
    p_payload_hash => repeat('a', 64), p_source_application_id => 'BKFC-RECEIPT-ROLLBACK',
    p_ingest_request_id => '40000000-0000-4000-8000-000000000004',
    p_gym_name => 'Rollback Gym', p_contact_person => 'BKFC Applicant',
    p_street_address => '1 Test Street', p_city => 'Sofia', p_administrative_region => null,
    p_postal_code => '1000', p_country => 'Bulgaria', p_email => 'rollback@example.test',
    p_phone => '+359000000002', p_website => null, p_instagram => null,
    p_disciplines_offered => 'Boxing, MMA', p_promo_video_link => null,
    p_plan_code => 'monthly', p_bkfc_app_access_interest => false,
    p_review_consent => true, p_follow_up_consent => false,
    p_consent_notice_version => 'eu-bkfc-v1',
    p_logo_path => v_reservation.reserved_application_id::text || '/logo/logo.png',
    p_logo_content_type => 'image/png', p_logo_size_bytes => 8,
    p_logo_sha256 => repeat('b', 64), p_city_country => 'Sofia, Bulgaria',
    p_website_instagram => '', p_region => 'Europe',
    p_normalized_gym_name => 'rollback gym', p_normalized_email => 'rollback@example.test'
  );
  raise exception 'Simulated transaction failure' using errcode = 'ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  if exists(select 1 from public.affiliate_applications where id = v_reservation.reserved_application_id)
    or exists(select 1 from public.affiliate_application_notification_outbox where application_id = v_reservation.reserved_application_id)
    or exists(select 1 from public.affiliate_application_audit_events where application_id = v_reservation.reserved_application_id)
    then raise exception 'receipt escaped transaction rollback'; end if;
end;
$$;


do $$
declare v_replay record;
begin
  select * into v_replay from public.reserve_bkfc_integration_ingress_v1(
    'submission', '71000000-0000-4000-8000-000000000003', 'BKFC-RECEIPT-1',
    repeat('a', 64), repeat('7', 64), null, null, 120);
  if v_replay.disposition <> 'completed' then raise exception 'submission replay not recognized'; end if;
  if (select count(*) from public.affiliate_application_notification_outbox
      where application_id = v_replay.reserved_application_id and notification_type = 'application_received') <> 1
    then raise exception 'replay changed receipt count'; end if;
end;
$$;
