\set ON_ERROR_STOP on
begin;
create temporary table rehearsal_submission_reservation on commit preserve rows as
select * from public.reserve_bkfc_integration_ingress_v1(
  'submission', '41b00000-0000-4000-8000-000000000003', 'BKFC-LIFECYCLE-FIXTURE',
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
    p_idempotency_key => '41b00000-0000-4000-8000-000000000003',
    p_payload_hash => repeat('a', 64), p_source_application_id => 'BKFC-LIFECYCLE-FIXTURE',
    p_ingest_request_id => '40000000-0000-4000-8000-000000000004',
    p_gym_name => 'Lifecycle Gym', p_contact_person => 'BKFC Applicant',
    p_street_address => '1 Test Street', p_city => 'Sofia', p_administrative_region => null,
    p_postal_code => '1000', p_country => 'Bulgaria', p_email => 'lifecycle@example.test',
    p_phone => '+359000000002', p_website => null, p_instagram => null,
    p_disciplines_offered => 'Boxing, MMA', p_promo_video_link => null,
    p_plan_code => 'monthly', p_bkfc_app_access_interest => false,
    p_review_consent => true, p_follow_up_consent => false,
    p_consent_notice_version => 'eu-bkfc-v1',
    p_logo_path => v_reservation.reserved_application_id::text || '/logo/logo.png',
    p_logo_content_type => 'image/png', p_logo_size_bytes => 8,
    p_logo_sha256 => repeat('b', 64), p_city_country => 'Sofia, Bulgaria',
    p_website_instagram => '', p_region => 'Europe',
    p_normalized_gym_name => 'lifecycle gym', p_normalized_email => 'lifecycle@example.test'
  );
end;
$$;

select * from public.admin_transition_affiliate_application(
  (select reserved_application_id from rehearsal_submission_reservation), 'approved', 'approved',
  '90000000-0000-4000-8000-000000000001', 'admin@example.test'
);

create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION: %', label; end if; end $$;
create function pg_temp.callback(kind text, age interval, expected boolean, reason text default null,
  cycle uuid default null, event uuid default gen_random_uuid()) returns uuid language plpgsql as $$
declare app uuid := (select reserved_application_id from rehearsal_submission_reservation);
 req uuid := coalesce(cycle, (select current_payment_request_id from public.affiliate_application_payment_coordination where application_id=app));
 stamp timestamptz := date_trunc('day', now()) - interval '2 days' + age;
 hash text := public.bkfc_json_sha256_v1(jsonb_build_object('type',kind,'event',event,'request',req,'at',stamp));
 reservation record; result record;
begin
 select * into reservation from public.reserve_bkfc_integration_ingress_v1('callback',event,
 'BKFC-LIFECYCLE-FIXTURE',hash,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),app,req,120);
 select * into result from public.record_bkfc_payment_status_event_v1(event,app,req,'BKFC-LIFECYCLE-FIXTURE',
 kind,stamp,null,hash,gen_random_uuid(),reservation.reservation_id,reservation.claim_token);
 perform pg_temp.check_true(result.applied = expected and result.not_applied_reason is not distinct from reason, kind||' disposition');
 perform pg_temp.check_true(exists(select 1 from public.bkfc_integration_ingress_reservations
 where reservation_id=reservation.reservation_id and lifecycle_state='completed'),kind||' durable acknowledgement');
 return event;
end $$;

do $$
declare app uuid := (select reserved_application_id from rehearsal_submission_reservation);
 first_cycle uuid; initial_paid timestamptz; e uuid; result record; h text;
begin
 select current_payment_request_id into first_cycle from public.affiliate_application_payment_coordination where application_id=app;
 perform pg_temp.callback('renewal_paid','0 hours',false,'transition_not_permitted');
 perform pg_temp.check_true((select paid_at is null and payment_status='pending' from public.affiliate_application_payment_coordination where application_id=app),'renewal cannot establish first payment');
 begin
  perform public.admin_transition_affiliate_application(app,'activated_affiliate','active',gen_random_uuid(),'admin@example.test');
  raise exception 'activation incorrectly succeeded';
 exception when sqlstate '55000' then null; end;
 e := pg_temp.callback('payment_paid','1 hour',true);
 select paid_at into initial_paid from public.affiliate_application_payment_coordination where application_id=app;
 perform public.admin_transition_affiliate_application(app,'activated_affiliate','active',gen_random_uuid(),'admin@example.test');
 perform pg_temp.callback('renewal_paid','2 hours',true);
 perform pg_temp.callback('renewal_past_due','3 hours',true);
 perform pg_temp.check_true((select payment_status='past_due' and subscription_status='past_due' and paid_at=initial_paid from public.affiliate_application_payment_coordination where application_id=app),'overdue preserves initial evidence');
 -- The published/review state is never automatically rewritten by callbacks.
 perform pg_temp.check_true((select review_stage='activated_affiliate' and status='active' from public.affiliate_applications where id=app),'overdue does not invent a visibility policy');
 begin
  perform public.admin_create_affiliate_payment_request(app,'monthly','staff_reissue',gen_random_uuid(),'admin@example.test');
  raise exception 'past due reissue incorrectly succeeded';
 exception when sqlstate '55000' then null; end;
 perform pg_temp.callback('renewal_paid','2 hours 30 minutes',false,'stale_event');
 perform pg_temp.callback('payment_paid','4 hours',false,'duplicate_business_state');
 perform pg_temp.check_true((select payment_status='past_due' from public.affiliate_application_payment_coordination where application_id=app),'repeated initial paid cannot recover overdue');
 perform public.admin_transition_affiliate_application(app,'under_review','in_review',gen_random_uuid(),'admin@example.test');
 perform pg_temp.callback('renewal_paid','5 hours',true);
 perform pg_temp.check_true((select review_stage='under_review' and status='in_review' from public.affiliate_applications where id=app),'recovery preserves manual review/suspension');
 perform pg_temp.check_true((select paid_at=initial_paid and subscription_status='active' from public.affiliate_application_payment_coordination where application_id=app),'recovery keeps initial payment separate');
 perform pg_temp.callback('renewal_past_due','6 hours',true);
 perform pg_temp.callback('subscription_cancelled','7 hours',true);
 perform pg_temp.callback('renewal_paid','8 hours',false,'transition_not_permitted');
 perform pg_temp.callback('payment_paid','9 hours',false,'duplicate_business_state');
 perform pg_temp.check_true((select payment_status='cancelled' and subscription_status='cancelled' from public.affiliate_application_payment_coordination where application_id=app),'ended lifecycle is terminal');
 -- Exact replay returns original recorded result, even after newer state changes.
 select payload_hash into h from public.affiliate_application_payment_status_events where external_event_id=e;
 select * into result from public.record_bkfc_payment_status_event_v1(e,app,first_cycle,'BKFC-LIFECYCLE-FIXTURE','payment_paid',initial_paid,null,h,gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
 perform pg_temp.check_true(result.reused and result.applied and result.payment_status='paid','exact replay retains original outcome');
 begin
  perform public.record_bkfc_payment_status_event_v1(e,app,first_cycle,'BKFC-LIFECYCLE-FIXTURE','payment_paid',initial_paid,null,repeat('f',64),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
  raise exception 'conflict incorrectly succeeded';
 exception when unique_violation then null; end;
 perform public.admin_transition_affiliate_application(app,'approved','approved',gen_random_uuid(),'admin@example.test');
 perform pg_temp.check_true((select current_payment_request_id<>first_cycle and paid_at is null and subscription_status='unknown' and last_renewal_paid_at is null and subscription_cancelled_at is null from public.affiliate_application_payment_coordination where application_id=app),'new lifecycle resets all evidence');
 perform pg_temp.callback('renewal_paid','10 hours',false,'superseded_payment_request',first_cycle);
 perform pg_temp.callback('renewal_past_due','11 hours',false,'superseded_payment_request',first_cycle);
 perform pg_temp.callback('subscription_cancelled','12 hours',false,'superseded_payment_request',first_cycle);
 perform pg_temp.check_true((select payment_status='pending' and paid_at is null from public.affiliate_application_payment_coordination where application_id=app),'old lifecycle cannot mutate new cycle');
 perform pg_temp.callback('payment_paid','13 hours',true);
 perform pg_temp.callback('payment_refunded','14 hours',true);
 perform pg_temp.callback('renewal_paid','15 hours',false,'transition_not_permitted');
 perform pg_temp.callback('subscription_cancelled','16 hours',true);
 perform pg_temp.check_true((select payment_status='refunded' and subscription_status='cancelled' from public.affiliate_application_payment_coordination where application_id=app),'refund evidence remains distinct from subscription termination');
 perform pg_temp.check_true(not has_function_privilege('authenticated','public.record_bkfc_payment_status_event_v1(uuid,uuid,uuid,text,text,timestamptz,text,text,uuid,uuid,uuid)','execute'),'callback inaccessible to browser role');
 raise notice 'v1.1 lifecycle assertions passed';
end $$;

rollback;
