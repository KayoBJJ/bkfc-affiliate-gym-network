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
 actor uuid := gen_random_uuid(); c uuid; next_id uuid; token uuid; old_token uuid; row public.bkfc_gym_control_commands%rowtype;
 remote jsonb; bad boolean;
begin
 begin
  perform public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'visibility','{"visible":true,"reasonCode":null}',null,actor,'admin@example.test');
  raise exception 'unpaid publication permitted';
 exception when sqlstate '55000' then null; end;
 perform pg_temp.callback('payment_paid','1 hour',true);
 -- Queued publication is checked again after a manual review change.
 begin
  c:=public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'visibility','{"visible":true,"reasonCode":null}',null,actor,'admin@example.test');
  perform public.admin_transition_affiliate_application(app,'under_review','in_review',actor,'admin@example.test');
  perform pg_temp.check_true(not exists(select 1 from public.claim_bkfc_gym_control(gen_random_uuid(),app)),'manual review change blocks first transmission');
  perform pg_temp.check_true((select delivery_status='failed' from public.bkfc_gym_control_commands where command_id=c),'unsent ineligible publication fails');
  raise exception 'rollback scenario' using errcode='ZX001';
 exception when sqlstate 'ZX001' then null; end;
 -- An uncertain mutation cannot be replayed against a replacement payment lifecycle.
 begin
  c:=public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'visibility','{"visible":true,"reasonCode":null}',null,actor,'admin@example.test');
  token:=gen_random_uuid(); perform public.claim_bkfc_gym_control(token,app);
  perform public.complete_bkfc_gym_control(c,token,'retry',gen_random_uuid(),null,'NETWORK_OUTCOME_UNKNOWN',clock_timestamp()-interval '1 second',null);
  perform public.create_bkfc_payment_initiation_cycle_v2(app,'monthly','approval',actor,'admin@example.test',clock_timestamp());
  perform pg_temp.check_true(not exists(select 1 from public.claim_bkfc_gym_control(gen_random_uuid(),app)),'new lifecycle blocks old mutation replay');
  perform pg_temp.check_true((select delivery_status='uncertain' and last_code='CONTROL_LIFECYCLE_CHANGED' from public.bkfc_gym_control_commands where command_id=c),'old lifecycle requires reconciliation');
  raise exception 'rollback scenario' using errcode='ZX001';
 exception when sqlstate 'ZX001' then null; end;
 remote := jsonb_build_object('euApplicationId',app,'version','3','status','paid','listing',jsonb_build_object('displayOnSite',false));
 c := public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'read','{}',null,actor,'admin@example.test');
 perform pg_temp.check_true(public.enqueue_bkfc_gym_control(c,app,'read','{}',null,actor,'admin@example.test')=c,'enqueue replay');
 begin
  perform public.enqueue_bkfc_gym_control(c,app,'read','{"changed":true}',null,actor,'admin@example.test');
  raise exception 'changed command identity accepted';
 exception when unique_violation then null; end;
 begin
  perform public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'visibility','{"visible":false,"reasonCode":null}',null,actor,'admin@example.test');
  raise exception 'newer command passed pending command';
 exception when sqlstate '55000' then null; end;
 token:=gen_random_uuid(); select * into strict row from public.claim_bkfc_gym_control(token,app);
 perform pg_temp.check_true(row.command_id=c and row.total_attempt_count=1,'first claim');
 perform pg_temp.check_true(not exists(select 1 from public.claim_bkfc_gym_control(gen_random_uuid(),app)),'parallel claim cannot duplicate delivery');
 perform public.complete_bkfc_gym_control(c,token,'retry',gen_random_uuid(),503,'HTTP_503',clock_timestamp()-interval '1 second',null);
 old_token:=token; token:=gen_random_uuid(); select * into strict row from public.claim_bkfc_gym_control(token,app);
 perform pg_temp.check_true(row.command_id=c and row.total_attempt_count=2,'retry retains command identity');
 begin
  perform public.complete_bkfc_gym_control(c,old_token,'accepted',gen_random_uuid(),200,'GYM_STATE',null,remote);
  raise exception 'old lease completed current attempt';
 exception when sqlstate '55000' then null; end;
 perform public.complete_bkfc_gym_control(c,token,'accepted',gen_random_uuid(),200,'GYM_STATE',null,remote);
 perform pg_temp.check_true((select count(*)=2 from public.bkfc_gym_control_attempts where command_id=c),'attempt history persisted');
 c:=public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'edit','{"city":"Sofia"}','3',actor,'admin@example.test');
 token:=gen_random_uuid(); perform public.claim_bkfc_gym_control(token,app);
 perform public.complete_bkfc_gym_control(c,token,'failed',gen_random_uuid(),409,'STALE_LISTING_VERSION',null,null);
 perform pg_temp.check_true((select listing_version is null from public.bkfc_gym_remote_state where application_id=app),'stale edit invalidates version');
 begin
  perform public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'edit','{"city":"Sofia"}','3',actor,'admin@example.test');
  raise exception 'stale version reused without refresh';
 exception when sqlstate '55000' then null; end;
 c:=public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'read','{}',null,actor,'admin@example.test');
 token:=gen_random_uuid(); perform public.claim_bkfc_gym_control(token,app);
 perform public.complete_bkfc_gym_control(c,token,'accepted',gen_random_uuid(),200,'GYM_STATE',null,remote||'{"version":"4"}');
 c:=public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'visibility','{"visible":true,"reasonCode":null}',null,actor,'admin@example.test');
 token:=gen_random_uuid(); perform public.claim_bkfc_gym_control(token,app);
 perform public.complete_bkfc_gym_control(c,token,'uncertain',gen_random_uuid(),null,'NETWORK_OUTCOME_UNKNOWN',null,null);
 perform pg_temp.check_true((select confirmed_visible=false from public.bkfc_gym_remote_state where application_id=app),'uncertain publication is not confirmed');
 begin
  perform public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'visibility','{"visible":false,"reasonCode":null}',null,actor,'admin@example.test');
  raise exception 'new decision overtook uncertain publication';
 exception when sqlstate '55000' then null; end;
 perform pg_temp.check_true(public.retry_bkfc_gym_control(c,actor,'admin@example.test'),'operator retries unresolved identity');
 old_token:=token; token:=gen_random_uuid(); select * into strict row from public.claim_bkfc_gym_control(token,app);
 perform pg_temp.check_true(row.total_attempt_count=2 and row.command_id=c,'manual retry retains lifetime attempts and identity');
 perform public.complete_bkfc_gym_control(c,token,'accepted',gen_random_uuid(),200,'GYM_VISIBILITY_UPDATED',null,null);
 perform pg_temp.check_true((select confirmed_visible=true from public.bkfc_gym_remote_state where application_id=app),'publication only confirmed after successful C4');
 next_id:=public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'visibility','{"visible":false,"reasonCode":null}',null,actor,'admin@example.test');
 token:=gen_random_uuid(); perform public.claim_bkfc_gym_control(token,app);
 perform public.complete_bkfc_gym_control(next_id,token,'accepted',gen_random_uuid(),200,'GYM_VISIBILITY_UPDATED',null,null);
 begin
  perform public.complete_bkfc_gym_control(c,old_token,'accepted',gen_random_uuid(),200,'GYM_VISIBILITY_UPDATED',null,null);
  raise exception 'old completion overwrote newer visibility';
 exception when sqlstate '55000' then null; end;
 perform pg_temp.check_true((select confirmed_visible=false from public.bkfc_gym_remote_state where application_id=app),'new visibility survives old replay');
 c:=gen_random_uuid(); perform public.enqueue_bkfc_gym_control(c,app,'cancel_subscription',jsonb_build_object('cancellationId',c,'mode','at_period_end','reasonCode','eu_requested'),null,actor,'admin@example.test');
 token:=gen_random_uuid(); perform public.claim_bkfc_gym_control(token,app);
 perform public.complete_bkfc_gym_control(c,token,'accepted',gen_random_uuid(),202,'SUBSCRIPTION_CANCELLATION_ACCEPTED',null,null);
 perform pg_temp.check_true((select payment_status='paid' and subscription_status='active' from public.affiliate_application_payment_coordination where application_id=app),'C5 acceptance does not fabricate subscription termination');
 perform pg_temp.check_true((select cancellation_requested_mode='at_period_end' from public.bkfc_gym_remote_state where application_id=app),'paid-through cancellation distinct');
 c:=public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'delist','{"reasonCode":"eu_requested"}',null,actor,'admin@example.test');
 token:=gen_random_uuid(); perform public.claim_bkfc_gym_control(token,app);
 perform public.complete_bkfc_gym_control(c,token,'accepted',gen_random_uuid(),200,'GYM_DELISTED',null,null);
 perform pg_temp.check_true((select delisted and confirmed_visible=false from public.bkfc_gym_remote_state where application_id=app),'delisting confirmed separately');
 begin
  perform public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'visibility','{"visible":true,"reasonCode":null}',null,actor,'admin@example.test');
  raise exception 'delisted gym reopened';
 exception when sqlstate '55000' then null; end;
 perform public.enqueue_bkfc_gym_control(gen_random_uuid(),app,'read','{}',null,actor,'admin@example.test');
 begin
  update public.bkfc_gym_control_commands set payload='{}' where command_id=c;
  raise exception 'command identity mutated';
 exception when raise_exception then
  if sqlerrm<>'CONTROL_IDENTITY_IMMUTABLE' then raise; end if;
 end;
 perform pg_temp.check_true(not has_function_privilege('authenticated','public.enqueue_bkfc_gym_control(uuid,uuid,text,jsonb,text,uuid,text)','execute'),'browser cannot enqueue');
 perform pg_temp.check_true(not has_function_privilege('anon','public.claim_bkfc_gym_control(uuid,uuid)','execute'),'anonymous cannot claim');
 perform pg_temp.check_true(not has_table_privilege('authenticated','public.bkfc_gym_remote_state','select'),'browser cannot read remote state');
 perform pg_temp.check_true(not has_table_privilege('service_role','public.bkfc_gym_control_commands','update'),'workers cannot rewrite identity directly');
 raise notice 'C1-C7 control persistence assertions passed';
end $$;
rollback;
