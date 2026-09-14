begin;
-- Separate from payment delivery: no remote calls or feature enablement in this migration.
create table public.bkfc_gym_control_commands (
 command_id uuid primary key,
 sequence_id bigint generated always as identity unique,
 application_id uuid not null references public.affiliate_applications(id) on delete restrict,
 bkfc_application_id text not null,
 payment_request_id_at_enqueue uuid,
 command_type text not null check (command_type in ('read','edit','logo','visibility','cancel_subscription','delist','retry_deliveries')),
 payload jsonb not null check (jsonb_typeof(payload)='object'),
 expected_version text,
 delivery_status text not null default 'queued' check (delivery_status in ('queued','sending','retry_wait','accepted','failed','uncertain')),
 attempt_count integer not null default 0 check (attempt_count >= 0),
 total_attempt_count integer not null default 0,
 last_retry_by_user_id uuid, last_retry_by_email text, last_retry_at timestamptz,
 claim_token uuid, lease_expires_at timestamptz, next_attempt_at timestamptz,
 last_request_id uuid, last_http_status integer, last_code text,
 created_by_user_id uuid not null, created_by_email text not null,
 created_at timestamptz not null default clock_timestamp(), completed_at timestamptz,
 check ((command_type in ('edit','logo') and expected_version ~ '^[0-9]{1,20}$' and expected_version is not null)
   or (command_type not in ('edit','logo') and expected_version is null)),
 check (octet_length(payload::text) <= case when command_type='logo' then 14000000 else 32768 end),
 check ((delivery_status='sending') = (claim_token is not null and lease_expires_at is not null))
);
create unique index bkfc_gym_control_one_unresolved_per_gym on public.bkfc_gym_control_commands(application_id)
 where delivery_status in ('queued','sending','retry_wait','uncertain');
create table public.bkfc_gym_control_attempts (
 command_id uuid not null references public.bkfc_gym_control_commands(command_id),
 claim_token uuid primary key, request_id uuid, disposition text, code text, http_status integer,
 started_at timestamptz not null default clock_timestamp(), completed_at timestamptz
);
alter table public.bkfc_gym_control_attempts enable row level security;
revoke all on public.bkfc_gym_control_attempts from public,anon,authenticated,service_role;
grant select on public.bkfc_gym_control_attempts to service_role;
create table public.bkfc_gym_remote_state (
 application_id uuid primary key references public.affiliate_applications(id) on delete restrict,
 state jsonb, listing_version text, confirmed_visible boolean, delisted boolean not null default false,
 cancellation_requested_mode text check (cancellation_requested_mode in ('immediately','at_period_end')),
 last_command_id uuid references public.bkfc_gym_control_commands(command_id),
 observed_at timestamptz, visibility_confirmed_at timestamptz
);
alter table public.bkfc_gym_control_commands enable row level security;
alter table public.bkfc_gym_remote_state enable row level security;
revoke all on public.bkfc_gym_control_commands, public.bkfc_gym_remote_state from public,anon,authenticated,service_role;
grant select on public.bkfc_gym_control_commands, public.bkfc_gym_remote_state to service_role;

create function public.enqueue_bkfc_gym_control(p_command_id uuid,p_application_id uuid,p_command_type text,
 p_payload jsonb,p_expected_version text,p_actor_user_id uuid,p_actor_email text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare app public.affiliate_applications%rowtype; existing public.bkfc_gym_control_commands%rowtype;
 remote public.bkfc_gym_remote_state%rowtype;
begin
 if p_command_id is null or p_actor_user_id is null or nullif(btrim(p_actor_email),'') is null
 or p_command_type is null or p_payload is null then raise exception 'INVALID_CONTROL_COMMAND' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtext('bkfc-control:'||p_application_id::text));
 select * into app from public.affiliate_applications where id=p_application_id for update;
 if not found or app.source_system is distinct from 'bkfc' or app.source_application_id is null then
 raise exception 'BKFC_APPLICATION_REQUIRED' using errcode='55000'; end if;
 select * into existing from public.bkfc_gym_control_commands where command_id=p_command_id;
 if found then
  if existing.application_id is distinct from p_application_id or existing.command_type is distinct from p_command_type
   or existing.payload is distinct from p_payload or existing.expected_version is distinct from p_expected_version then
   raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
  return p_command_id;
 end if;
 select * into remote from public.bkfc_gym_remote_state where application_id=p_application_id;
 if remote.delisted and p_command_type<>'read' then raise exception 'APPLICATION_DELISTED' using errcode='55000'; end if;
 if exists(select 1 from public.bkfc_gym_control_commands where application_id=p_application_id
  and delivery_status in ('queued','sending','retry_wait','uncertain')) then
 raise exception 'CONTROL_COMMAND_PENDING' using errcode='55000'; end if;
 if p_command_type in ('edit','logo') and (remote.listing_version is null or p_expected_version is distinct from remote.listing_version) then
 raise exception 'REFRESH_LISTING_REQUIRED' using errcode='55000'; end if;
 if p_command_type='visibility' and p_payload->>'visible'='true' and (
  (app.review_stage,app.status) not in (('approved','approved'),('activated_affiliate','active'))
  or not exists(select 1 from public.affiliate_application_payment_coordination where application_id=p_application_id and payment_status='paid' and paid_at is not null)
 ) then raise exception 'PUBLICATION_REQUIRES_APPROVED_AND_PAID' using errcode='55000'; end if;
 insert into public.bkfc_gym_control_commands(command_id,application_id,bkfc_application_id,command_type,payload,expected_version,created_by_user_id,created_by_email,payment_request_id_at_enqueue)
 values(p_command_id,p_application_id,app.source_application_id,p_command_type,p_payload,p_expected_version,p_actor_user_id,lower(p_actor_email),
 (select current_payment_request_id from public.affiliate_application_payment_coordination where application_id=p_application_id));
 return p_command_id;
end $$;

create function public.claim_bkfc_gym_control(p_claim_token uuid,p_application_id uuid default null)
returns setof public.bkfc_gym_control_commands language plpgsql security definer set search_path=pg_catalog as $$
declare cmd public.bkfc_gym_control_commands%rowtype;
begin
 if p_claim_token is null then raise exception 'CLAIM_REQUIRED'; end if;
 -- One claim per worker run bounds network time. Expired leases reuse the same command identity.
 for cmd in select * from public.bkfc_gym_control_commands c where
  (p_application_id is null or c.application_id=p_application_id) and
  (c.delivery_status='queued' or (c.delivery_status='retry_wait' and c.next_attempt_at<=clock_timestamp())
  or (c.delivery_status='sending' and c.lease_expires_at<clock_timestamp()))
 order by sequence_id for update skip locked limit 1
 loop
  if cmd.attempt_count>=6 then
   update public.bkfc_gym_control_commands set delivery_status='uncertain',claim_token=null,lease_expires_at=null,
    last_code='ATTEMPTS_EXHAUSTED' where command_id=cmd.command_id;
   return;
  end if;
  -- A replay must never apply an old billing/visibility decision to a replacement lifecycle.
  if cmd.command_type in ('visibility','cancel_subscription','delist') and cmd.payment_request_id_at_enqueue is distinct from
   (select current_payment_request_id from public.affiliate_application_payment_coordination where application_id=cmd.application_id) then
   update public.bkfc_gym_control_commands set delivery_status=case when cmd.total_attempt_count=0 then 'failed' else 'uncertain' end,
    claim_token=null,lease_expires_at=null,last_code='CONTROL_LIFECYCLE_CHANGED' where command_id=cmd.command_id;
   return;
  end if;
  -- Approval must still hold on retries, too. If prior success is possible, stop for reconciliation.
  if cmd.command_type='visibility' and cmd.payload->>'visible'='true' and not exists(
   select 1 from public.affiliate_applications a join public.affiliate_application_payment_coordination p on p.application_id=a.id
   where a.id=cmd.application_id and (a.review_stage,a.status) in (('approved','approved'),('activated_affiliate','active'))
   and p.payment_status='paid' and p.paid_at is not null
  ) then
   update public.bkfc_gym_control_commands set delivery_status=case when cmd.total_attempt_count=0 then 'failed' else 'uncertain' end,
    claim_token=null,lease_expires_at=null,last_code='PUBLICATION_REQUIRES_APPROVED_AND_PAID',completed_at=case when cmd.total_attempt_count=0 then clock_timestamp() else null end where command_id=cmd.command_id;
   return;
  end if;
  insert into public.bkfc_gym_control_attempts(command_id,claim_token) values(cmd.command_id,p_claim_token);
  return query update public.bkfc_gym_control_commands set delivery_status='sending',claim_token=p_claim_token,
   lease_expires_at=clock_timestamp()+interval '2 minutes',attempt_count=attempt_count+1,total_attempt_count=total_attempt_count+1,next_attempt_at=null
   where command_id=cmd.command_id returning *;
 end loop;
end $$;

create function public.complete_bkfc_gym_control(p_command_id uuid,p_claim_token uuid,p_disposition text,
 p_request_id uuid,p_http_status integer,p_code text,p_next_attempt_at timestamptz,p_state jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare cmd public.bkfc_gym_control_commands%rowtype;
begin
 if p_disposition is null or p_disposition not in ('accepted','retry','failed','uncertain') or p_request_id is null
  or p_code is null or p_code !~ '^[A-Z][A-Z0-9_]{0,63}$' or (p_disposition='retry' and p_next_attempt_at is null) then raise exception 'INVALID_CONTROL_OUTCOME'; end if;
 select * into cmd from public.bkfc_gym_control_commands where command_id=p_command_id and claim_token=p_claim_token and delivery_status='sending' for update;
 if not found then raise exception 'CONTROL_CLAIM_CONFLICT' using errcode='55000'; end if;
 if p_disposition='accepted' and cmd.command_type in ('read','edit','logo') and
  (p_state is null or p_state->>'euApplicationId' is distinct from cmd.application_id::text
   or p_state->>'version' is null or p_state->>'version' !~ '^[0-9]{1,20}$') then raise exception 'INVALID_GYM_STATE'; end if;
 update public.bkfc_gym_control_commands set delivery_status=case when p_disposition='retry' then 'retry_wait' else p_disposition end,
 claim_token=null,lease_expires_at=null,next_attempt_at=p_next_attempt_at,last_request_id=p_request_id,last_http_status=p_http_status,last_code=p_code,
 completed_at=case when p_disposition in ('accepted','failed') then clock_timestamp() else null end where command_id=p_command_id;
 update public.bkfc_gym_control_attempts set request_id=p_request_id,disposition=p_disposition,code=p_code,http_status=p_http_status,completed_at=clock_timestamp() where claim_token=p_claim_token;
 if p_disposition='accepted' then
  insert into public.bkfc_gym_remote_state(application_id) values(cmd.application_id) on conflict do nothing;
  update public.bkfc_gym_remote_state set last_command_id=p_command_id,
   state=coalesce(p_state,state),listing_version=coalesce(p_state->>'version',listing_version),
   observed_at=case when p_state is not null then clock_timestamp() else observed_at end,
   confirmed_visible=case when cmd.command_type='delist' then false when cmd.command_type='visibility' then (cmd.payload->>'visible')::boolean
    when p_state is not null then (p_state->'listing'->>'displayOnSite')::boolean else confirmed_visible end,
   visibility_confirmed_at=case when cmd.command_type in ('visibility','delist') or p_state is not null then clock_timestamp() else visibility_confirmed_at end,
   delisted=delisted or cmd.command_type='delist' or coalesce(p_state->>'status'='delisted',false),
   cancellation_requested_mode=case when cmd.command_type='cancel_subscription' then cmd.payload->>'mode' else cancellation_requested_mode end
  where application_id=cmd.application_id;
 elsif p_code='STALE_LISTING_VERSION' then
  -- A rejected version cannot be reused. Operator must explicitly read and review.
  update public.bkfc_gym_remote_state set listing_version=null where application_id=cmd.application_id;
 end if;
 return true;
end $$;

create function public.retry_bkfc_gym_control(p_command_id uuid,p_actor_user_id uuid,p_actor_email text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_actor_user_id is null or nullif(btrim(p_actor_email),'') is null then raise exception 'ACTOR_REQUIRED'; end if;
 -- Only an unresolved command can be resumed. Rejected stale edits require a new reviewed command.
 update public.bkfc_gym_control_commands set delivery_status='queued',attempt_count=0,next_attempt_at=null,
 last_retry_by_user_id=p_actor_user_id,last_retry_by_email=lower(p_actor_email),last_retry_at=clock_timestamp()
 where command_id=p_command_id and delivery_status='uncertain';
 return found;
end $$;
-- Command identity and actor evidence cannot be edited, including by workers.
create function public.guard_bkfc_gym_control_identity() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'CONTROL_HISTORY_IMMUTABLE'; end if;
 if (new.command_id,new.sequence_id,new.application_id,new.bkfc_application_id,new.payment_request_id_at_enqueue,new.command_type,new.payload,new.expected_version,new.created_by_user_id,new.created_by_email,new.created_at)
 is distinct from (old.command_id,old.sequence_id,old.application_id,old.bkfc_application_id,old.payment_request_id_at_enqueue,old.command_type,old.payload,old.expected_version,old.created_by_user_id,old.created_by_email,old.created_at)
 then raise exception 'CONTROL_IDENTITY_IMMUTABLE'; end if;
 return new;
end $$;
create trigger bkfc_gym_control_identity before update or delete on public.bkfc_gym_control_commands for each row execute function public.guard_bkfc_gym_control_identity();
revoke all on function public.enqueue_bkfc_gym_control(uuid,uuid,text,jsonb,text,uuid,text),public.claim_bkfc_gym_control(uuid,uuid),public.complete_bkfc_gym_control(uuid,uuid,text,uuid,integer,text,timestamptz,jsonb),public.retry_bkfc_gym_control(uuid,uuid,text),public.guard_bkfc_gym_control_identity() from public,anon,authenticated,service_role;
grant execute on function public.enqueue_bkfc_gym_control(uuid,uuid,text,jsonb,text,uuid,text),public.claim_bkfc_gym_control(uuid,uuid),public.complete_bkfc_gym_control(uuid,uuid,text,uuid,integer,text,timestamptz,jsonb),public.retry_bkfc_gym_control(uuid,uuid,text) to service_role;
commit;
