\set ON_ERROR_STOP on

-- Fresh disposable local databases only. Statements deliberately commit independently,
-- matching the PostgREST reservation/business/finalization transaction boundaries.

insert into public.affiliate_applications (
  id, application_reference, gym_name, city_country, contact_person, email, phone,
  website_instagram, disciplines_offered, review_consent, follow_up_consent,
  review_stage, status
) values (
  '10000000-0000-4000-8000-000000000001', 'LEGACY-REHEARSAL-1', 'Legacy Gym',
  'Sofia, Bulgaria', 'Legacy Applicant', 'legacy@example.test', '+359000000001',
  '', 'Boxing', true, false, 'submitted', 'new'
);

select * from public.admin_transition_affiliate_application(
  '10000000-0000-4000-8000-000000000001', 'approved', 'approved',
  '90000000-0000-4000-8000-000000000001', 'admin@example.test'
);

do $$
begin
  if not exists (
    select 1 from public.affiliate_applications
    where id = '10000000-0000-4000-8000-000000000001'
      and review_stage = 'approved' and status = 'approved'
  ) then raise exception 'legacy approval failed'; end if;
  if exists (
    select 1 from public.affiliate_application_payment_coordination
    where application_id = '10000000-0000-4000-8000-000000000001'
  ) then raise exception 'legacy coordination was fabricated'; end if;
  if exists (
    select 1 from public.affiliate_application_payment_command_outbox
    where application_id = '10000000-0000-4000-8000-000000000001'
  ) then raise exception 'legacy command was fabricated'; end if;
end;
$$;

select * from public.admin_transition_affiliate_application(
  '10000000-0000-4000-8000-000000000001', 'activated_affiliate', 'active',
  '90000000-0000-4000-8000-000000000001', 'admin@example.test'
);

create temporary table rehearsal_submission_reservation on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '30000000-0000-4000-8000-000000000003', 'BKFC-REHEARSAL-2',
  repeat('a', 64), repeat('e', 64), null, null, 120
);

do $$
declare v_reservation record;
begin
  select * into strict v_reservation from rehearsal_submission_reservation;
  if v_reservation.disposition <> 'acquired' then raise exception 'submission reservation not acquired'; end if;
  perform public.create_bkfc_affiliate_application_v1(
    p_reservation_id => v_reservation.reservation_id,
    p_claim_token => v_reservation.claim_token,
    p_idempotency_key => '30000000-0000-4000-8000-000000000003',
    p_payload_hash => repeat('a', 64), p_source_application_id => 'BKFC-REHEARSAL-2',
    p_ingest_request_id => '40000000-0000-4000-8000-000000000004',
    p_gym_name => 'BKFC Gym', p_contact_person => 'BKFC Applicant',
    p_street_address => '1 Test Street', p_city => 'Sofia', p_administrative_region => null,
    p_postal_code => '1000', p_country => 'Bulgaria', p_email => 'bkfc@example.test',
    p_phone => '+359000000002', p_website => null, p_instagram => null,
    p_disciplines_offered => 'Boxing, MMA', p_promo_video_link => null,
    p_plan_code => 'monthly', p_bkfc_app_access_interest => false,
    p_review_consent => true, p_follow_up_consent => false,
    p_consent_notice_version => 'eu-bkfc-v1',
    p_logo_path => v_reservation.reserved_application_id::text || '/logo/logo.png',
    p_logo_content_type => 'image/png', p_logo_size_bytes => 8,
    p_logo_sha256 => repeat('b', 64), p_city_country => 'Sofia, Bulgaria',
    p_website_instagram => '', p_region => 'Europe',
    p_normalized_gym_name => 'bkfc gym', p_normalized_email => 'bkfc@example.test'
  );
end;
$$;

select * from public.admin_transition_affiliate_application(
  (select reserved_application_id from rehearsal_submission_reservation), 'approved', 'approved',
  '90000000-0000-4000-8000-000000000001', 'admin@example.test'
);

do $$
declare
  v_application_id uuid := (select reserved_application_id from rehearsal_submission_reservation);
  v_changed boolean;
begin
  if (select payment_status from public.affiliate_application_payment_coordination
      where application_id = v_application_id) <> 'pending'
  then raise exception 'BKFC approval did not become pending'; end if;
  if (select count(*) from public.affiliate_application_payment_command_outbox
      where application_id = v_application_id and command_type = 'payment_initiation') <> 1
  then raise exception 'BKFC approval command cardinality failed'; end if;
  if exists (select 1 from public.affiliate_application_payment_command_outbox
      where bkfc_application_id is null)
  then raise exception 'null BKFC identity entered outbox'; end if;
  select changed into v_changed from public.admin_transition_affiliate_application(
    v_application_id, 'approved', 'approved',
    '90000000-0000-4000-8000-000000000001', 'admin@example.test'
  );
  if v_changed then raise exception 'repeated approval was not a no-op'; end if;
  if (select count(*) from public.affiliate_application_payment_command_outbox
      where application_id = v_application_id and command_type = 'payment_initiation') <> 1
  then raise exception 'repeated approval created a command'; end if;
end;
$$;

do $$
declare v_claimed integer;
begin
  select count(*) into v_claimed
  from public.claim_affiliate_payment_command_delivery(
    '70000000-0000-4000-8000-000000000007', 25, 900
  );
  if v_claimed <> 1 then raise exception 'durable command claim failed'; end if;
end;
$$;

select * from public.admin_transition_affiliate_application(
  (select reserved_application_id from rehearsal_submission_reservation), 'submitted', 'new',
  '90000000-0000-4000-8000-000000000001', 'admin@example.test'
);

do $$
declare v_application_id uuid := (select reserved_application_id from rehearsal_submission_reservation);
begin
  if (select count(*) from public.affiliate_application_payment_command_outbox
      where application_id = v_application_id and command_type = 'payment_cancellation') <> 1
  then raise exception 'uncertain initiation reversal did not create one cancellation'; end if;
end;
$$;

select * from public.admin_transition_affiliate_application(
  (select reserved_application_id from rehearsal_submission_reservation), 'approved', 'approved',
  '90000000-0000-4000-8000-000000000001', 'admin@example.test'
);

do $$
declare v_application_id uuid := (select reserved_application_id from rehearsal_submission_reservation);
begin
  begin
    perform public.admin_transition_affiliate_application(
      v_application_id, 'activated_affiliate', 'active',
      '90000000-0000-4000-8000-000000000001', 'admin@example.test'
    );
    raise exception 'unpaid BKFC activation unexpectedly succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'ACTIVATION_REQUIRES_APPROVED_AND_PAID' then raise; end if;
  end;
end;
$$;

update public.affiliate_application_payment_coordination
set payment_status = 'paid', paid_at = pg_catalog.now(), payment_operation_state = 'none'
where application_id = (select reserved_application_id from rehearsal_submission_reservation);

select * from public.admin_transition_affiliate_application(
  (select reserved_application_id from rehearsal_submission_reservation), 'activated_affiliate', 'active',
  '90000000-0000-4000-8000-000000000001', 'admin@example.test'
);

-- Completed replay is resolved before quota and does not touch its bucket.
create temporary table completed_bucket_before on commit preserve rows as
select tokens, last_refill_at, updated_at from public.bkfc_integration_rate_limit_buckets
where direction = 'submission' and credential_fingerprint = repeat('e', 64);
create temporary table completed_replay on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '30000000-0000-4000-8000-000000000003', 'BKFC-REHEARSAL-2',
  repeat('a', 64), repeat('e', 64), null, null, 120
);
do $$
begin
  if (select disposition from completed_replay) <> 'completed'
    then raise exception 'completed replay was not reused'; end if;
  if (select row(tokens, last_refill_at, updated_at) from completed_bucket_before)
     is distinct from
     (select row(tokens, last_refill_at, updated_at) from public.bkfc_integration_rate_limit_buckets
      where direction = 'submission' and credential_fingerprint = repeat('e', 64))
    then raise exception 'completed replay consumed quota'; end if;
end;
$$;

-- Sequentially reproduces two serialized concurrent arrivals: one token, one claim.
create temporary table concurrent_first on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '31000000-0000-4000-8000-000000000003', 'BKFC-CONCURRENT-1',
  repeat('c', 64), repeat('f', 64), null, null, 120
);
create temporary table concurrent_bucket_before_second on commit preserve rows as
select tokens, last_refill_at, updated_at from public.bkfc_integration_rate_limit_buckets
where direction = 'submission' and credential_fingerprint = repeat('f', 64);
create temporary table concurrent_second on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '31000000-0000-4000-8000-000000000003', 'BKFC-CONCURRENT-1',
  repeat('c', 64), repeat('f', 64), null, null, 120
);
create temporary table source_identity_recovery on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '31100000-0000-4000-8000-000000000003', 'BKFC-CONCURRENT-1',
  repeat('c', 64), repeat('f', 64), null, null, 120
);
do $$
begin
  if (select disposition from concurrent_first) <> 'acquired'
    or (select disposition from concurrent_second) <> 'in_progress'
    then raise exception 'concurrent reservation dispositions failed'; end if;
  if (select disposition from source_identity_recovery) <> 'in_progress'
    or (select logical_request_id from source_identity_recovery) <>
       '31000000-0000-4000-8000-000000000003'::uuid
    then raise exception 'BKFC source identity did not recover original reservation'; end if;
  if (select row(tokens, last_refill_at, updated_at) from concurrent_bucket_before_second)
     is distinct from
     (select row(tokens, last_refill_at, updated_at) from public.bkfc_integration_rate_limit_buckets
      where direction = 'submission' and credential_fingerprint = repeat('f', 64))
    then raise exception 'in-progress replay consumed quota'; end if;
end;
$$;

-- Changed bodies conflict; stale claims retain identity without another token.
create temporary table changed_replay on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '31000000-0000-4000-8000-000000000003', 'BKFC-CONCURRENT-1',
  repeat('d', 64), repeat('f', 64), null, null, 120
);
update public.bkfc_integration_ingress_reservations
set lease_expires_at = pg_catalog.now() - interval '1 second'
where reservation_id = (select reservation_id from concurrent_first);
create temporary table stale_bucket_before on commit preserve rows as
select tokens, last_refill_at, updated_at from public.bkfc_integration_rate_limit_buckets
where direction = 'submission' and credential_fingerprint = repeat('f', 64);
create temporary table stale_recovery on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '31000000-0000-4000-8000-000000000003', 'BKFC-CONCURRENT-1',
  repeat('c', 64), repeat('f', 64), null, null, 120
);
do $$
begin
  if (select disposition from changed_replay) <> 'idempotency_conflict'
    then raise exception 'changed body did not conflict'; end if;
  if (select disposition from stale_recovery) <> 'acquired'
    then raise exception 'stale reservation was not reclaimed'; end if;
  if (select reserved_application_id from stale_recovery) is distinct from
     (select reserved_application_id from concurrent_first)
    then raise exception 'stale recovery changed application identity'; end if;
  if (select claim_token from stale_recovery) is not distinct from
     (select claim_token from concurrent_first)
    then raise exception 'stale recovery did not rotate claim'; end if;
  if (select row(tokens, last_refill_at, updated_at) from stale_bucket_before)
     is distinct from
     (select row(tokens, last_refill_at, updated_at) from public.bkfc_integration_rate_limit_buckets
      where direction = 'submission' and credential_fingerprint = repeat('f', 64))
    then raise exception 'stale recovery consumed quota'; end if;
end;
$$;

-- Business rejection happens after a committed reservation and cannot refund quota.
create temporary table duplicate_reservation on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '32000000-0000-4000-8000-000000000003', 'BKFC-DUPLICATE-1',
  repeat('8', 64), repeat('8', 64), null, null, 120
);
do $$
declare v record;
begin
  select * into strict v from duplicate_reservation;
  begin
    perform public.create_bkfc_affiliate_application_v1(
      v.reservation_id, v.claim_token, '32000000-0000-4000-8000-000000000003',
      repeat('8', 64), 'BKFC-DUPLICATE-1', '42000000-0000-4000-8000-000000000004',
      'BKFC Gym', 'Another Applicant', '2 Test Street', 'Sofia', null, '1000', 'Bulgaria',
      'bkfc@example.test', '+359000000003', null, null, 'Boxing', null, 'monthly', false,
      true, false, 'eu-bkfc-v1', v.reserved_application_id::text || '/logo/logo.png',
      'image/png', 8, repeat('8', 64), 'Sofia, Bulgaria', '', 'Europe',
      'bkfc gym', 'bkfc@example.test'
    );
    raise exception 'duplicate business rejection did not occur';
  exception when unique_violation then
    if sqlerrm <> 'DUPLICATE_SUBMISSION' then raise; end if;
  end;
end;
$$;
select public.finalize_bkfc_integration_ingress_reservation_v1(
  reservation_id, claim_token, repeat('8', 64), 'DUPLICATE_SUBMISSION', true
) from duplicate_reservation;
do $$
begin
  if (select tokens from public.bkfc_integration_rate_limit_buckets
      where direction = 'submission' and credential_fingerprint = repeat('8', 64)) > 9.1
    then raise exception 'duplicate business rejection refunded quota'; end if;
end;
$$;

-- Submission capacity is 10; the 11th distinct new submission is limited exactly.
do $$
declare v record;
begin
  for i in 1..10 loop
    select * into strict v from public.reserve_bkfc_integration_ingress_v1(
      'submission', pg_catalog.gen_random_uuid(), 'BKFC-SUBMISSION-' || i::text,
      repeat('6', 64), repeat('6', 64), null, null, 120
    );
    if v.disposition <> 'acquired' then raise exception 'submission bucket exhausted early at %', i; end if;
  end loop;
  select * into strict v from public.reserve_bkfc_integration_ingress_v1(
    'submission', pg_catalog.gen_random_uuid(), 'BKFC-SUBMISSION-11',
    repeat('6', 64), repeat('6', 64), null, null, 120
  );
  if v.disposition <> 'rate_limited' or v.retry_after_seconds <> 1
    then raise exception 'submission 11th request was not limited exactly'; end if;
end;
$$;

-- Callback capacity is 50; the 51st distinct new callback is limited exactly.
do $$
declare v record;
begin
  for i in 1..50 loop
    select * into strict v from public.reserve_bkfc_integration_ingress_v1(
      'callback', pg_catalog.gen_random_uuid(), 'BKFC-CALLBACK-' || i::text,
      repeat('9', 64), repeat('9', 64), pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(), 120
    );
    if v.disposition <> 'acquired' then raise exception 'callback bucket exhausted early at %', i; end if;
  end loop;
  select * into strict v from public.reserve_bkfc_integration_ingress_v1(
    'callback', pg_catalog.gen_random_uuid(), 'BKFC-CALLBACK-51',
    repeat('9', 64), repeat('9', 64), pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(), 120
  );
  if v.disposition <> 'rate_limited' or v.retry_after_seconds <> 1
    then raise exception 'callback 51st request was not limited exactly'; end if;
end;
$$;

-- Callback correlation rejection is consumed; terminal replay is free and stable.
create temporary table rejected_callback on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'callback', '33000000-0000-4000-8000-000000000003', 'BKFC-MISSING-1',
  repeat('7', 64), repeat('7', 64), '23000000-0000-4000-8000-000000000002',
  '53000000-0000-4000-8000-000000000005', 120
);
do $$
declare v record;
begin
  select * into strict v from rejected_callback;
  begin
    perform public.record_bkfc_payment_status_event_v1(
      '33000000-0000-4000-8000-000000000003', '23000000-0000-4000-8000-000000000002',
      '53000000-0000-4000-8000-000000000005', 'BKFC-MISSING-1', 'payment_paid',
      pg_catalog.now(), null, repeat('7', 64), '43000000-0000-4000-8000-000000000004',
      v.reservation_id, v.claim_token
    );
    raise exception 'missing application callback unexpectedly succeeded';
  exception when no_data_found then
    if sqlerrm <> 'APPLICATION_NOT_FOUND' then raise; end if;
  end;
end;
$$;
select public.finalize_bkfc_integration_ingress_reservation_v1(
  reservation_id, claim_token, repeat('7', 64), 'APPLICATION_NOT_FOUND', true
) from rejected_callback;
create temporary table rejected_callback_bucket_before on commit preserve rows as
select tokens, last_refill_at, updated_at from public.bkfc_integration_rate_limit_buckets
where direction = 'callback' and credential_fingerprint = repeat('7', 64);
create temporary table rejected_callback_retry on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'callback', '33000000-0000-4000-8000-000000000003', 'BKFC-MISSING-1',
  repeat('7', 64), repeat('7', 64), '23000000-0000-4000-8000-000000000002',
  '53000000-0000-4000-8000-000000000005', 120
);
do $$
begin
  if (select disposition from rejected_callback_retry) <> 'terminal_rejected'
    or (select outcome_code from rejected_callback_retry) <> 'APPLICATION_NOT_FOUND'
    then raise exception 'terminal callback retry was not stable'; end if;
  if (select row(tokens, last_refill_at, updated_at) from rejected_callback_bucket_before)
     is distinct from
     (select row(tokens, last_refill_at, updated_at) from public.bkfc_integration_rate_limit_buckets
      where direction = 'callback' and credential_fingerprint = repeat('7', 64))
    then raise exception 'terminal callback retry consumed quota'; end if;
end;
$$;

do $$
begin
  begin
    insert into public.affiliate_application_payment_command_outbox (
      command_id, application_id, bkfc_application_id, command_type,
      payment_request_id, idempotency_key, payload, payload_hash,
      delivery_status, request_reason
    ) values (
      '50000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000001', 'FABRICATED-BKFC-ID',
      'payment_initiation', '50000000-0000-4000-8000-000000000005',
      '60000000-0000-4000-8000-000000000006', '{}'::jsonb, repeat('c', 64),
      'queued', 'legacy_initialization'
    );
    raise exception 'fabricated legacy BKFC identity entered outbox';
  exception when sqlstate '55000' then
    if sqlerrm <> 'BKFC application identity is required' then raise; end if;
  end;
end;
$$;
