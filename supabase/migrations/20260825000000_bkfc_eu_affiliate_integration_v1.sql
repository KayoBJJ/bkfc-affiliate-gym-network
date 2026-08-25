-- Frozen BKFC-EU affiliate application integration v1 (EU side).
-- Additive only. This file must be rehearsed against the deployed-schema baseline
-- and is intentionally not applied by repository implementation work.
-- Compatibility rule: payment coordination is attached only to applications with
-- an explicit, valid source_system='bkfc' identity. Legacy and other-source rows
-- retain the pre-integration approval, notification, audit, history, and activation flow.

alter table public.affiliate_applications
  add column if not exists street_address text,
  add column if not exists city text,
  add column if not exists administrative_region text,
  add column if not exists postal_code text,
  add column if not exists country_code text,
  add column if not exists website text,
  add column if not exists instagram text,
  add column if not exists source_system text,
  add column if not exists source_application_id text,
  add column if not exists submitted_at timestamptz,
  add column if not exists ingest_request_id uuid,
  add column if not exists consent_notice_version text,
  add column if not exists consent_capture_source text,
  add column if not exists review_consent_at timestamptz,
  add column if not exists follow_up_consent_at timestamptz,
  add column if not exists logo_content_type text,
  add column if not exists logo_size_bytes integer,
  add column if not exists logo_sha256 text,
  add column if not exists updated_at timestamptz;

alter table public.affiliate_applications
  alter column review_stage set default 'submitted';

update public.affiliate_applications
set review_stage = 'submitted'
where review_stage = 'submitted ';

alter table public.affiliate_applications
  add constraint affiliate_applications_street_address_check
    check (street_address is null or pg_catalog.char_length(street_address) <= 200),
  add constraint affiliate_applications_city_check
    check (city is null or pg_catalog.char_length(city) <= 100),
  add constraint affiliate_applications_administrative_region_check
    check (administrative_region is null or pg_catalog.char_length(administrative_region) <= 100),
  add constraint affiliate_applications_postal_code_check
    check (postal_code is null or pg_catalog.char_length(postal_code) <= 20),
  add constraint affiliate_applications_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add constraint affiliate_applications_website_check
    check (website is null or pg_catalog.char_length(website) <= 300),
  add constraint affiliate_applications_instagram_check
    check (instagram is null or pg_catalog.char_length(instagram) <= 300),
  add constraint affiliate_applications_source_system_check
    check (source_system is null or source_system ~ '^[a-z][a-z0-9_]{0,31}$'),
  add constraint affiliate_applications_source_application_id_check
    check (source_application_id is null or source_application_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  add constraint affiliate_applications_consent_notice_version_check
    check (consent_notice_version is null or consent_notice_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  add constraint affiliate_applications_consent_capture_source_check
    check (consent_capture_source is null or consent_capture_source in ('bkfc_webflow')),
  add constraint affiliate_applications_logo_content_type_check
    check (logo_content_type is null or logo_content_type in ('image/png', 'image/jpeg', 'image/webp')),
  add constraint affiliate_applications_logo_size_bytes_check
    check (logo_size_bytes is null or logo_size_bytes between 1 and 3145728),
  add constraint affiliate_applications_logo_sha256_check
    check (logo_sha256 is null or logo_sha256 ~ '^[a-f0-9]{64}$'),
  add constraint affiliate_applications_follow_up_consent_timestamp_check
    check (source_system is distinct from 'bkfc'
      or (follow_up_consent = true and follow_up_consent_at is not null)
      or (coalesce(follow_up_consent, false) = false and follow_up_consent_at is null)),
  add constraint affiliate_applications_bkfc_source_required_check
    check (
      source_system is distinct from 'bkfc'
      or (
        source_application_id is not null
        and submitted_at is not null
        and ingest_request_id is not null
        and idempotency_key is not null
        and payload_hash ~ '^[a-f0-9]{64}$'
        and city is not null
        and country is not null
        and consent_notice_version is not null
        and consent_capture_source = 'bkfc_webflow'
        and review_consent = true
        and review_consent_at is not null
        and logo_path is not null
        and logo_content_type is not null
        and logo_size_bytes is not null
        and logo_sha256 is not null
      )
    );

create unique index affiliate_applications_source_identity_uidx
  on public.affiliate_applications (source_system, source_application_id)
  where source_system is not null and source_application_id is not null;

create index affiliate_applications_source_submitted_idx
  on public.affiliate_applications (source_system, submitted_at desc);

create table public.affiliate_application_payment_coordination (
  application_id uuid not null,
  plan_code text not null,
  payment_status text not null default 'not_requested',
  current_payment_request_id uuid null,
  payment_requested_at timestamptz null,
  payment_link_sent_at timestamptz null,
  paid_at timestamptz null,
  cancelled_at timestamptz null,
  refunded_at timestamptz null,
  last_status_event_id uuid null,
  last_status_event_occurred_at timestamptz null,
  payment_operation_state text not null default 'none',
  last_operational_error_code text null,
  last_operational_error_at timestamptz null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint affiliate_application_payment_coordination_pkey primary key (application_id),
  constraint affiliate_application_payment_coordination_application_fkey foreign key (application_id)
    references public.affiliate_applications(id) on delete restrict,
  constraint affiliate_application_payment_coordination_plan_code_check
    check (plan_code in ('monthly', 'quarterly')),
  constraint affiliate_application_payment_coordination_payment_status_check
    check (payment_status in ('not_requested', 'pending', 'paid', 'cancelled', 'refunded')),
  constraint affiliate_application_payment_coordination_operation_state_check
    check (payment_operation_state in (
      'none', 'initiation_queued', 'initiation_retrying', 'initiation_intervention_required',
      'cancellation_queued', 'cancellation_retrying', 'cancellation_accepted',
      'cancellation_intervention_required'
    )),
  constraint affiliate_application_payment_coordination_request_pair_check check (
    (current_payment_request_id is null and payment_requested_at is null)
    or (current_payment_request_id is not null and payment_requested_at is not null)
  ),
  constraint affiliate_application_payment_coordination_initial_state_check check (
    payment_status <> 'not_requested' or (
      current_payment_request_id is null and payment_requested_at is null
      and payment_link_sent_at is null and paid_at is null
      and cancelled_at is null and refunded_at is null
    )
  ),
  constraint affiliate_application_payment_coordination_paid_timestamp_check
    check (payment_status <> 'paid' or paid_at is not null),
  constraint affiliate_application_payment_coordination_cancelled_timestamp_check
    check (payment_status <> 'cancelled' or cancelled_at is not null),
  constraint affiliate_application_payment_coordination_refunded_timestamp_check
    check (payment_status <> 'refunded' or refunded_at is not null),
  constraint affiliate_application_payment_coordination_link_request_check
    check (payment_link_sent_at is null or payment_requested_at is not null),
  constraint affiliate_application_payment_coordination_event_pair_check check (
    (last_status_event_id is null and last_status_event_occurred_at is null)
    or (last_status_event_id is not null and last_status_event_occurred_at is not null)
  ),
  constraint affiliate_application_payment_coordination_operational_error_check
    check (last_operational_error_code is null or last_operational_error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  constraint affiliate_application_payment_coordination_timestamp_order_check
    check (created_at <= updated_at)
);

create table public.affiliate_application_payment_command_outbox (
  command_id uuid not null default pg_catalog.gen_random_uuid(),
  application_id uuid not null,
  bkfc_application_id text not null,
  command_type text not null,
  payment_request_id uuid not null,
  idempotency_key uuid not null,
  payload jsonb not null,
  payload_hash text not null,
  delivery_status text not null default 'queued',
  request_reason text not null,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz null,
  claim_token uuid null,
  claimed_at timestamptz null,
  last_attempt_at timestamptz null,
  last_request_id uuid null,
  last_http_status integer null,
  last_error_code text null,
  accepted_at timestamptz null,
  created_by_user_id uuid null,
  created_by_email text null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint affiliate_application_payment_command_outbox_pkey primary key (command_id),
  constraint affiliate_application_payment_command_outbox_application_fkey foreign key (application_id)
    references public.affiliate_applications(id) on delete restrict,
  constraint affiliate_application_payment_command_outbox_payment_request_fkey foreign key (payment_request_id)
    references public.affiliate_application_payment_command_outbox(command_id)
    on delete restrict deferrable initially deferred,
  constraint affiliate_application_payment_command_outbox_idempotency_key_key unique (idempotency_key),
  constraint affiliate_application_payment_command_outbox_command_type_check
    check (command_type in ('payment_initiation', 'payment_cancellation')),
  constraint affiliate_application_payment_command_outbox_delivery_status_check
    check (delivery_status in ('queued', 'sending', 'retry_wait', 'accepted', 'intervention_required', 'suppressed')),
  constraint affiliate_application_payment_command_outbox_request_reason_check
    check (request_reason in ('approval', 'legacy_initialization', 'staff_reissue', 'approval_reversal')),
  constraint affiliate_application_payment_command_outbox_type_reason_check check (
    (command_type = 'payment_initiation'
      and request_reason in ('approval', 'legacy_initialization', 'staff_reissue')
      and command_id = payment_request_id)
    or (command_type = 'payment_cancellation'
      and request_reason = 'approval_reversal'
      and command_id <> payment_request_id)
  ),
  constraint affiliate_application_payment_command_outbox_bkfc_id_check
    check (bkfc_application_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint affiliate_application_payment_command_outbox_payload_check
    check (pg_catalog.jsonb_typeof(payload) = 'object'),
  constraint affiliate_application_payment_command_outbox_payload_hash_check
    check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint affiliate_application_payment_command_outbox_attempt_count_check check (attempt_count >= 0),
  constraint affiliate_application_payment_command_outbox_claim_pair_check check (
    (claim_token is null and claimed_at is null) or (claim_token is not null and claimed_at is not null)
  ),
  constraint affiliate_application_payment_command_outbox_sending_claim_check check (
    delivery_status <> 'sending' or (claim_token is not null and claimed_at is not null)
  ),
  constraint affiliate_application_payment_command_outbox_retry_time_check
    check (delivery_status <> 'retry_wait' or next_attempt_at is not null),
  constraint affiliate_application_payment_command_outbox_accepted_time_check check (
    (delivery_status = 'accepted' and accepted_at is not null)
    or (delivery_status <> 'accepted' and accepted_at is null)
  ),
  constraint affiliate_application_payment_command_outbox_suppression_check
    check (delivery_status <> 'suppressed' or command_type = 'payment_initiation'),
  constraint affiliate_application_payment_command_outbox_http_status_check
    check (last_http_status is null or last_http_status between 100 and 599),
  constraint affiliate_application_payment_command_outbox_error_code_check
    check (last_error_code is null or last_error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  constraint affiliate_application_payment_command_outbox_timestamp_order_check check (
    created_at <= updated_at
    and (last_attempt_at is null or last_attempt_at >= created_at)
    and (accepted_at is null or accepted_at >= created_at)
  )
);

create table public.affiliate_application_payment_status_events (
  id uuid not null default pg_catalog.gen_random_uuid(),
  external_event_id uuid not null,
  application_id uuid not null,
  payment_request_id uuid not null,
  bkfc_application_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default pg_catalog.now(),
  reason_code text null,
  payload_hash text not null,
  request_id uuid not null,
  previous_status text not null,
  resulting_status text not null,
  applied boolean not null,
  not_applied_reason text null,
  constraint affiliate_application_payment_status_events_pkey primary key (id),
  constraint affiliate_application_payment_status_events_external_event_key unique (external_event_id),
  constraint affiliate_application_payment_status_events_application_fkey foreign key (application_id)
    references public.affiliate_applications(id) on delete restrict,
  constraint affiliate_application_payment_status_events_request_fkey foreign key (payment_request_id)
    references public.affiliate_application_payment_command_outbox(command_id) on delete restrict,
  constraint affiliate_application_payment_status_events_event_type_check check (event_type in (
    'payment_link_sent', 'payment_paid', 'payment_cancelled', 'payment_refunded', 'payment_initiation_failed'
  )),
  constraint affiliate_application_payment_status_events_previous_status_check
    check (previous_status in ('not_requested', 'pending', 'paid', 'cancelled', 'refunded')),
  constraint affiliate_application_payment_status_events_resulting_status_check
    check (resulting_status in ('not_requested', 'pending', 'paid', 'cancelled', 'refunded')),
  constraint affiliate_application_payment_status_events_application_id_check
    check (bkfc_application_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint affiliate_application_payment_status_events_reason_code_check
    check (reason_code is null or reason_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint affiliate_application_payment_status_events_payload_hash_check
    check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint affiliate_application_payment_status_events_applied_reason_check check (
    (applied = true and not_applied_reason is null)
    or (applied = false and not_applied_reason in (
      'superseded_attempt', 'transition_not_permitted', 'stale_event', 'duplicate_business_state'
    ))
  ),
  constraint affiliate_application_payment_status_events_future_time_check
    check (occurred_at <= received_at + interval '5 minutes')
);

create table public.bkfc_integration_rate_limit_buckets (
  direction text not null,
  credential_fingerprint text not null,
  tokens numeric(12,6) not null,
  last_refill_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint bkfc_integration_rate_limit_buckets_pkey
    primary key (direction, credential_fingerprint),
  constraint bkfc_integration_rate_limit_buckets_direction_check
    check (direction in ('submission', 'callback')),
  constraint bkfc_integration_rate_limit_buckets_fingerprint_check
    check (credential_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint bkfc_integration_rate_limit_buckets_tokens_check
    check (tokens between 0 and 50),
  constraint bkfc_integration_rate_limit_buckets_timestamp_order_check
    check (created_at <= updated_at and last_refill_at <= updated_at)
);

-- The reservation is deliberately separate from application/payment rows. PostgREST
-- commits this row and the bucket debit before any duplicate query, Storage upload,
-- callback correlation check, or business write. It contains identities/hashes only.
create table public.bkfc_integration_ingress_reservations (
  reservation_id uuid not null default pg_catalog.gen_random_uuid(),
  direction text not null,
  logical_request_id uuid not null,
  source_application_id text not null,
  payload_hash text not null,
  credential_fingerprint text not null,
  eu_application_id uuid null,
  payment_request_id uuid null,
  reserved_application_id uuid null,
  reserved_application_reference text null,
  lifecycle_state text not null default 'in_progress',
  claim_token uuid null,
  lease_expires_at timestamptz null,
  outcome_code text null,
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null default (pg_catalog.now() + interval '30 days'),
  completed_at timestamptz null,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint bkfc_integration_ingress_reservations_pkey primary key (reservation_id),
  constraint bkfc_integration_ingress_reservations_logical_key unique (direction, logical_request_id),
  constraint bkfc_integration_ingress_reservations_direction_check
    check (direction in ('submission', 'callback')),
  constraint bkfc_integration_ingress_reservations_source_id_check
    check (source_application_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint bkfc_integration_ingress_reservations_payload_hash_check
    check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint bkfc_integration_ingress_reservations_fingerprint_check
    check (credential_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint bkfc_integration_ingress_reservations_state_check
    check (lifecycle_state in ('in_progress', 'completed', 'terminal_rejected')),
  constraint bkfc_integration_ingress_reservations_outcome_check
    check (outcome_code is null or outcome_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  constraint bkfc_integration_ingress_reservations_shape_check check (
    (direction = 'submission'
      and eu_application_id is null and payment_request_id is null
      and reserved_application_id is not null and reserved_application_reference is not null)
    or (direction = 'callback'
      and eu_application_id is not null and payment_request_id is not null
      and reserved_application_id is null and reserved_application_reference is null)
  ),
  constraint bkfc_integration_ingress_reservations_lifecycle_check check (
    (lifecycle_state = 'in_progress' and completed_at is null)
    or (lifecycle_state in ('completed', 'terminal_rejected')
      and completed_at is not null and claim_token is null and lease_expires_at is null
      and outcome_code is not null)
  ),
  constraint bkfc_integration_ingress_reservations_claim_check
    check (claim_token is null or (lifecycle_state = 'in_progress' and lease_expires_at is not null)),
  constraint bkfc_integration_ingress_reservations_timestamp_check
    check (created_at <= updated_at and created_at < expires_at
      and (completed_at is null or completed_at >= created_at))
);

create table public.affiliate_application_payment_delivery_throttle (
  singleton boolean not null default true,
  tokens numeric(12,6) not null default 5,
  last_refill_at timestamptz not null default pg_catalog.now(),
  constraint affiliate_application_payment_delivery_throttle_pkey primary key (singleton),
  constraint affiliate_application_payment_delivery_throttle_singleton_check check (singleton = true),
  constraint affiliate_application_payment_delivery_throttle_tokens_check check (tokens between 0 and 5)
);

insert into public.affiliate_application_payment_delivery_throttle (singleton, tokens)
values (true, 5);

alter table public.affiliate_application_payment_coordination
  add constraint affiliate_application_payment_coordination_current_request_fkey
    foreign key (current_payment_request_id)
    references public.affiliate_application_payment_command_outbox(command_id) on delete restrict,
  add constraint affiliate_application_payment_coordination_last_event_fkey
    foreign key (last_status_event_id)
    references public.affiliate_application_payment_status_events(external_event_id) on delete restrict;

create index affiliate_application_payment_coordination_status_idx
  on public.affiliate_application_payment_coordination (payment_status, updated_at desc);
create index affiliate_application_payment_coordination_operation_idx
  on public.affiliate_application_payment_coordination (payment_operation_state, updated_at);
create unique index affiliate_application_payment_command_one_initiation_idx
  on public.affiliate_application_payment_command_outbox(payment_request_id)
  where command_type = 'payment_initiation';
create unique index affiliate_application_payment_command_one_cancellation_idx
  on public.affiliate_application_payment_command_outbox(payment_request_id)
  where command_type = 'payment_cancellation';
create index affiliate_application_payment_command_delivery_idx
  on public.affiliate_application_payment_command_outbox(delivery_status, next_attempt_at, created_at);
create index affiliate_application_payment_command_application_idx
  on public.affiliate_application_payment_command_outbox(application_id, command_type, created_at desc);
create index affiliate_application_payment_command_bkfc_idx
  on public.affiliate_application_payment_command_outbox(bkfc_application_id, created_at desc);
create index affiliate_application_payment_status_events_application_idx
  on public.affiliate_application_payment_status_events(application_id, occurred_at desc);
create index affiliate_application_payment_status_events_request_idx
  on public.affiliate_application_payment_status_events(payment_request_id, occurred_at desc);
create unique index bkfc_integration_ingress_submission_source_uidx
  on public.bkfc_integration_ingress_reservations(source_application_id)
  where direction = 'submission';
create index bkfc_integration_ingress_reservations_recovery_idx
  on public.bkfc_integration_ingress_reservations(lifecycle_state, lease_expires_at, expires_at);

create or replace function public.set_affiliate_application_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

create or replace function public.set_affiliate_payment_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

create or replace function public.prevent_affiliate_payment_command_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.command_id is distinct from old.command_id
    or new.application_id is distinct from old.application_id
    or new.bkfc_application_id is distinct from old.bkfc_application_id
    or new.command_type is distinct from old.command_type
    or new.payment_request_id is distinct from old.payment_request_id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.payload is distinct from old.payload
    or new.payload_hash is distinct from old.payload_hash
    or new.request_reason is distinct from old.request_reason
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.created_by_email is distinct from old.created_by_email
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Payment command identity is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_affiliate_payment_command_bkfc_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1
    from public.affiliate_applications as application
    where application.id = new.application_id
      and application.source_system = 'bkfc'
      and application.source_application_id = new.bkfc_application_id
      and application.source_application_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
  ) then
    raise exception 'BKFC application identity is required' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_affiliate_payment_status_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'Payment status events are append-only' using errcode = '55000';
end;
$$;

create trigger set_affiliate_application_updated_at
before update on public.affiliate_applications
for each row execute function public.set_affiliate_application_updated_at();
create trigger set_affiliate_payment_coordination_updated_at
before update on public.affiliate_application_payment_coordination
for each row execute function public.set_affiliate_payment_updated_at();
create trigger set_affiliate_payment_command_updated_at
before update on public.affiliate_application_payment_command_outbox
for each row execute function public.set_affiliate_payment_updated_at();
create trigger set_bkfc_integration_rate_limit_updated_at
before update on public.bkfc_integration_rate_limit_buckets
for each row execute function public.set_affiliate_payment_updated_at();
create trigger set_bkfc_integration_ingress_reservation_updated_at
before update on public.bkfc_integration_ingress_reservations
for each row execute function public.set_affiliate_payment_updated_at();
create trigger prevent_affiliate_payment_command_identity_update
before update on public.affiliate_application_payment_command_outbox
for each row execute function public.prevent_affiliate_payment_command_identity_mutation();
create trigger enforce_affiliate_payment_command_bkfc_identity_insert
before insert on public.affiliate_application_payment_command_outbox
for each row execute function public.enforce_affiliate_payment_command_bkfc_identity();
create trigger prevent_affiliate_payment_status_event_update_delete
before update or delete on public.affiliate_application_payment_status_events
for each row execute function public.prevent_affiliate_payment_status_event_mutation();

create or replace function public.bkfc_json_canonicalize_v1(p_value jsonb)
returns text
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  v_type text := pg_catalog.jsonb_typeof(p_value);
  v_result text;
begin
  if v_type = 'object' then
    select '{' || coalesce(pg_catalog.string_agg(
      pg_catalog.to_jsonb(entry.key)::text || ':' || public.bkfc_json_canonicalize_v1(entry.value),
      ',' order by entry.key collate "C"), '') || '}'
    into v_result
    from pg_catalog.jsonb_each(p_value) as entry(key, value);
    return v_result;
  elsif v_type = 'array' then
    select '[' || coalesce(pg_catalog.string_agg(
      public.bkfc_json_canonicalize_v1(entry.value), ',' order by entry.ordinality), '') || ']'
    into v_result
    from pg_catalog.jsonb_array_elements(p_value) with ordinality as entry(value, ordinality);
    return v_result;
  end if;
  return p_value::text;
end;
$$;

create or replace function public.bkfc_json_sha256_v1(p_value jsonb)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(public.bkfc_json_canonicalize_v1(p_value), 'UTF8')),
    'hex'
  );
$$;

create or replace function public.consume_bkfc_integration_rate_limit_v1(
  p_direction text,
  p_credential_fingerprint text
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_bucket public.bkfc_integration_rate_limit_buckets%rowtype;
  v_capacity numeric;
  v_refill_per_second numeric;
  v_available numeric;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_direction = 'submission' then
    v_capacity := 10;
    v_refill_per_second := 1;
  elsif p_direction = 'callback' then
    v_capacity := 50;
    v_refill_per_second := 5;
  else
    raise exception 'Invalid integration rate-limit direction' using errcode = '22023';
  end if;
  if p_credential_fingerprint is null or p_credential_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid integration credential fingerprint' using errcode = '22023';
  end if;

  insert into public.bkfc_integration_rate_limit_buckets (
    direction, credential_fingerprint, tokens, last_refill_at, updated_at
  ) values (p_direction, p_credential_fingerprint, v_capacity, v_now, v_now)
  on conflict (direction, credential_fingerprint) do nothing;

  select bucket.* into v_bucket
  from public.bkfc_integration_rate_limit_buckets as bucket
  where bucket.direction = p_direction
    and bucket.credential_fingerprint = p_credential_fingerprint
  for update;
  if not found then raise exception 'Integration rate-limit bucket unavailable' using errcode = '55000'; end if;

  v_available := least(
    v_capacity,
    v_bucket.tokens + greatest(
      0,
      pg_catalog.date_part('epoch', v_now - v_bucket.last_refill_at)
    ) * v_refill_per_second
  );
  if v_available >= 1 then
    update public.bkfc_integration_rate_limit_buckets
    set tokens = v_available - 1, last_refill_at = v_now, updated_at = v_now
    where direction = p_direction and credential_fingerprint = p_credential_fingerprint;
    return query select true, 0;
  else
    update public.bkfc_integration_rate_limit_buckets
    set tokens = v_available, last_refill_at = v_now, updated_at = v_now
    where direction = p_direction and credential_fingerprint = p_credential_fingerprint;
    return query select false,
      greatest(1, pg_catalog.ceil((1 - v_available) / v_refill_per_second)::integer);
  end if;
end;
$$;

-- Preflight is the only ingress quota consumer. Advisory locks serialize a logical
-- request (and BKFC submission identity), so overlapping workers debit one token.
-- Existing outcomes and stale claims return before quota; RATE_LIMITED is returned,
-- not raised, so the denied bucket refill timestamp also commits.
create or replace function public.reserve_bkfc_integration_ingress_v1(
  p_direction text,
  p_logical_request_id uuid,
  p_source_application_id text,
  p_payload_hash text,
  p_credential_fingerprint text,
  p_eu_application_id uuid,
  p_payment_request_id uuid,
  p_lease_seconds integer
)
returns table (
  disposition text,
  reservation_id uuid,
  claim_token uuid,
  logical_request_id uuid,
  reserved_application_id uuid,
  reserved_application_reference text,
  outcome_code text,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_reservation public.bkfc_integration_ingress_reservations%rowtype;
  v_application public.affiliate_applications%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_claim_token uuid;
  v_application_id uuid;
  v_application_reference text;
  v_rate_allowed boolean;
  v_retry_after integer;
begin
  if p_direction not in ('submission', 'callback')
    or p_logical_request_id is null
    or p_source_application_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_payload_hash !~ '^[a-f0-9]{64}$'
    or p_credential_fingerprint !~ '^[a-f0-9]{64}$'
    or p_lease_seconds not between 30 and 900
    or (p_direction = 'submission' and (p_eu_application_id is not null or p_payment_request_id is not null))
    or (p_direction = 'callback' and (p_eu_application_id is null or p_payment_request_id is null))
  then raise exception 'VALIDATION_FAILED' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('bkfc-ingress:' || p_direction || ':' || p_logical_request_id::text, 0)
  );
  if p_direction = 'submission' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('bkfc-ingress-source:' || p_source_application_id, 0)
    );

    select application.* into v_application
    from public.affiliate_applications as application
    where application.idempotency_key = p_logical_request_id
    for update;
    if found then
      if v_application.payload_hash is distinct from p_payload_hash then
        return query select 'idempotency_conflict'::text, null::uuid, null::uuid,
          p_logical_request_id, null::uuid, null::text, 'IDEMPOTENCY_CONFLICT'::text, 0;
      else
        return query select 'completed'::text, null::uuid, null::uuid,
          p_logical_request_id, v_application.id, v_application.application_reference,
          'APPLICATION_ALREADY_RECEIVED'::text, 0;
      end if;
      return;
    end if;

    select application.* into v_application
    from public.affiliate_applications as application
    where application.source_system = 'bkfc'
      and application.source_application_id = p_source_application_id
    for update;
    if found then
      if v_application.payload_hash is distinct from p_payload_hash then
        return query select 'source_conflict'::text, null::uuid, null::uuid,
          p_logical_request_id, null::uuid, null::text, 'BKFC_APPLICATION_ID_CONFLICT'::text, 0;
      else
        return query select 'completed'::text, null::uuid, null::uuid,
          p_logical_request_id, v_application.id, v_application.application_reference,
          'APPLICATION_ALREADY_RECEIVED'::text, 0;
      end if;
      return;
    end if;
  end if;

  select reservation.* into v_reservation
  from public.bkfc_integration_ingress_reservations as reservation
  where reservation.direction = p_direction
    and reservation.logical_request_id = p_logical_request_id
  for update;
  if found then
    if v_reservation.payload_hash is distinct from p_payload_hash
      or v_reservation.source_application_id is distinct from p_source_application_id
      or v_reservation.eu_application_id is distinct from p_eu_application_id
      or v_reservation.payment_request_id is distinct from p_payment_request_id
    then
      return query select 'idempotency_conflict'::text, v_reservation.reservation_id, null::uuid,
        p_logical_request_id, v_reservation.reserved_application_id,
        v_reservation.reserved_application_reference, 'IDEMPOTENCY_CONFLICT'::text, 0;
      return;
    end if;
    if v_reservation.lifecycle_state = 'completed' then
      return query select 'completed'::text, v_reservation.reservation_id, null::uuid,
        p_logical_request_id, v_reservation.reserved_application_id,
        v_reservation.reserved_application_reference, v_reservation.outcome_code, 0;
      return;
    elsif v_reservation.lifecycle_state = 'terminal_rejected' then
      return query select 'terminal_rejected'::text, v_reservation.reservation_id, null::uuid,
        p_logical_request_id, v_reservation.reserved_application_id,
        v_reservation.reserved_application_reference, v_reservation.outcome_code, 0;
      return;
    elsif v_reservation.claim_token is null or v_reservation.lease_expires_at <= v_now then
      v_claim_token := pg_catalog.gen_random_uuid();
      update public.bkfc_integration_ingress_reservations
      set claim_token = v_claim_token,
        lease_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
        outcome_code = null
      where bkfc_integration_ingress_reservations.reservation_id = v_reservation.reservation_id;
      return query select 'acquired'::text, v_reservation.reservation_id, v_claim_token,
        p_logical_request_id, v_reservation.reserved_application_id,
        v_reservation.reserved_application_reference, null::text, 0;
      return;
    else
      v_retry_after := greatest(1, pg_catalog.ceil(
        pg_catalog.date_part('epoch', v_reservation.lease_expires_at - v_now)
      )::integer);
      return query select 'in_progress'::text, v_reservation.reservation_id, null::uuid,
        p_logical_request_id, v_reservation.reserved_application_id,
        v_reservation.reserved_application_reference, 'REQUEST_IN_PROGRESS'::text, v_retry_after;
      return;
    end if;
  end if;

  if p_direction = 'submission' then
    select reservation.* into v_reservation
    from public.bkfc_integration_ingress_reservations as reservation
    where reservation.direction = 'submission'
      and reservation.source_application_id = p_source_application_id
    for update;
    if found then
      if v_reservation.payload_hash is distinct from p_payload_hash then
        return query select 'source_conflict'::text, v_reservation.reservation_id, null::uuid,
          v_reservation.logical_request_id, v_reservation.reserved_application_id,
          v_reservation.reserved_application_reference, 'BKFC_APPLICATION_ID_CONFLICT'::text, 0;
        return;
      elsif v_reservation.lifecycle_state = 'completed' then
        return query select 'completed'::text, v_reservation.reservation_id, null::uuid,
          v_reservation.logical_request_id, v_reservation.reserved_application_id,
          v_reservation.reserved_application_reference, v_reservation.outcome_code, 0;
        return;
      elsif v_reservation.lifecycle_state = 'terminal_rejected' then
        return query select 'terminal_rejected'::text, v_reservation.reservation_id, null::uuid,
          v_reservation.logical_request_id, v_reservation.reserved_application_id,
          v_reservation.reserved_application_reference, v_reservation.outcome_code, 0;
        return;
      elsif v_reservation.claim_token is null or v_reservation.lease_expires_at <= v_now then
        v_claim_token := pg_catalog.gen_random_uuid();
        update public.bkfc_integration_ingress_reservations
        set claim_token = v_claim_token,
          lease_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
          outcome_code = null
        where bkfc_integration_ingress_reservations.reservation_id = v_reservation.reservation_id;
        return query select 'acquired'::text, v_reservation.reservation_id, v_claim_token,
          v_reservation.logical_request_id, v_reservation.reserved_application_id,
          v_reservation.reserved_application_reference, null::text, 0;
        return;
      else
        v_retry_after := greatest(1, pg_catalog.ceil(
          pg_catalog.date_part('epoch', v_reservation.lease_expires_at - v_now)
        )::integer);
        return query select 'in_progress'::text, v_reservation.reservation_id, null::uuid,
          v_reservation.logical_request_id, v_reservation.reserved_application_id,
          v_reservation.reserved_application_reference, 'REQUEST_IN_PROGRESS'::text, v_retry_after;
        return;
      end if;
    end if;
  end if;

  select rate.allowed, rate.retry_after_seconds
  into v_rate_allowed, v_retry_after
  from public.consume_bkfc_integration_rate_limit_v1(p_direction, p_credential_fingerprint) as rate;
  if not v_rate_allowed then
    return query select 'rate_limited'::text, null::uuid, null::uuid,
      p_logical_request_id, null::uuid, null::text, 'RATE_LIMITED'::text, v_retry_after;
    return;
  end if;

  v_claim_token := pg_catalog.gen_random_uuid();
  if p_direction = 'submission' then
    v_application_id := pg_catalog.gen_random_uuid();
    v_application_reference := 'BKFC-GYM-' || pg_catalog.upper(pg_catalog.substr(
      pg_catalog.replace(v_application_id::text, '-', ''), 1, 12
    ));
  end if;
  insert into public.bkfc_integration_ingress_reservations (
    direction, logical_request_id, source_application_id, payload_hash,
    credential_fingerprint, eu_application_id, payment_request_id,
    reserved_application_id, reserved_application_reference,
    lifecycle_state, claim_token, lease_expires_at
  ) values (
    p_direction, p_logical_request_id, p_source_application_id, p_payload_hash,
    p_credential_fingerprint, p_eu_application_id, p_payment_request_id,
    v_application_id, v_application_reference, 'in_progress', v_claim_token,
    v_now + pg_catalog.make_interval(secs => p_lease_seconds)
  ) returning * into v_reservation;
  return query select 'acquired'::text, v_reservation.reservation_id, v_claim_token,
    p_logical_request_id, v_reservation.reserved_application_id,
    v_reservation.reserved_application_reference, null::text, 0;
end;
$$;

create or replace function public.finalize_bkfc_integration_ingress_reservation_v1(
  p_reservation_id uuid,
  p_claim_token uuid,
  p_payload_hash text,
  p_outcome_code text,
  p_terminal boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_reservation public.bkfc_integration_ingress_reservations%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_reservation_id is null or p_claim_token is null
    or p_payload_hash !~ '^[a-f0-9]{64}$'
    or p_outcome_code !~ '^[A-Z][A-Z0-9_]{0,63}$'
  then raise exception 'VALIDATION_FAILED' using errcode = '22023'; end if;
  select reservation.* into v_reservation
  from public.bkfc_integration_ingress_reservations as reservation
  where reservation.reservation_id = p_reservation_id
  for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_reservation.payload_hash is distinct from p_payload_hash then
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505';
  end if;
  if v_reservation.lifecycle_state = 'terminal_rejected'
    and v_reservation.outcome_code = p_outcome_code and p_terminal
  then return true; end if;
  if v_reservation.lifecycle_state is distinct from 'in_progress'
    or v_reservation.claim_token is distinct from p_claim_token
  then raise exception 'RESERVATION_CLAIM_CONFLICT' using errcode = '55000'; end if;
  if p_terminal then
    update public.bkfc_integration_ingress_reservations
    set lifecycle_state = 'terminal_rejected', outcome_code = p_outcome_code,
      completed_at = v_now, claim_token = null, lease_expires_at = null
    where reservation_id = p_reservation_id;
  else
    update public.bkfc_integration_ingress_reservations
    set outcome_code = p_outcome_code, claim_token = null, lease_expires_at = v_now
    where reservation_id = p_reservation_id;
  end if;
  return true;
end;
$$;

create or replace function public.create_bkfc_affiliate_application_v1(
  p_reservation_id uuid,
  p_claim_token uuid,
  p_idempotency_key uuid,
  p_payload_hash text,
  p_source_application_id text,
  p_ingest_request_id uuid,
  p_gym_name text,
  p_contact_person text,
  p_street_address text,
  p_city text,
  p_administrative_region text,
  p_postal_code text,
  p_country text,
  p_email text,
  p_phone text,
  p_website text,
  p_instagram text,
  p_disciplines_offered text,
  p_promo_video_link text,
  p_plan_code text,
  p_bkfc_app_access_interest boolean,
  p_review_consent boolean,
  p_follow_up_consent boolean,
  p_consent_notice_version text,
  p_logo_path text,
  p_logo_content_type text,
  p_logo_size_bytes integer,
  p_logo_sha256 text,
  p_city_country text,
  p_website_instagram text,
  p_region text,
  p_normalized_gym_name text,
  p_normalized_email text
)
returns table (
  id uuid,
  application_reference text,
  source_application_id text,
  submitted_at timestamptz,
  review_stage text,
  status text,
  payment_status text,
  reused boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_reservation public.bkfc_integration_ingress_reservations%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_reservation_id is null or p_claim_token is null
    or p_idempotency_key is null or p_ingest_request_id is null
    or p_payload_hash !~ '^[a-f0-9]{64}$'
    or p_source_application_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_plan_code not in ('monthly', 'quarterly')
    or p_review_consent is distinct from true
  then
    raise exception 'VALIDATION_FAILED' using errcode = '22023';
  end if;

  select reservation.* into v_reservation
  from public.bkfc_integration_ingress_reservations as reservation
  where reservation.reservation_id = p_reservation_id
  for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_reservation.direction is distinct from 'submission'
    or v_reservation.lifecycle_state is distinct from 'in_progress'
    or v_reservation.claim_token is distinct from p_claim_token
    or v_reservation.logical_request_id is distinct from p_idempotency_key
    or v_reservation.source_application_id is distinct from p_source_application_id
    or v_reservation.payload_hash is distinct from p_payload_hash
    or v_reservation.reserved_application_id is null
    or v_reservation.reserved_application_reference is null
  then raise exception 'RESERVATION_CLAIM_CONFLICT' using errcode = '55000'; end if;

  if exists (
    select 1 from public.affiliate_applications as duplicate
    where duplicate.normalized_gym_name = p_normalized_gym_name
      and duplicate.normalized_email = p_normalized_email
      and duplicate.status is distinct from 'rejected'
      and duplicate.created_at >= v_now - interval '30 days'
  ) then
    raise exception 'DUPLICATE_SUBMISSION' using errcode = '23505';
  end if;

  insert into public.affiliate_applications (
    id, application_reference, idempotency_key, payload_hash,
    normalized_gym_name, normalized_email, gym_name, city_country, country, region,
    contact_person, email, phone, website_instagram, disciplines_offered,
    logo_url, logo_path, gym_photo_urls, gym_photo_paths, fighter_list_url,
    fighter_list_path, promo_video_link, review_consent, follow_up_consent,
    bkfc_app_access_interest, status, review_stage,
    street_address, city, administrative_region, postal_code, website, instagram,
    source_system, source_application_id, submitted_at, ingest_request_id,
    consent_notice_version, consent_capture_source, review_consent_at,
    follow_up_consent_at, logo_content_type, logo_size_bytes, logo_sha256, updated_at
  ) values (
    v_reservation.reserved_application_id, v_reservation.reserved_application_reference,
    p_idempotency_key, p_payload_hash,
    p_normalized_gym_name, p_normalized_email, p_gym_name, p_city_country, p_country, p_region,
    p_contact_person, p_email, p_phone, p_website_instagram, p_disciplines_offered,
    null, p_logo_path, array[]::text[], array[]::text[], null,
    null, p_promo_video_link, true, p_follow_up_consent,
    coalesce(p_bkfc_app_access_interest, false), 'new', 'submitted',
    p_street_address, p_city, p_administrative_region, p_postal_code, p_website, p_instagram,
    'bkfc', p_source_application_id, v_now, p_ingest_request_id,
    p_consent_notice_version, 'bkfc_webflow', v_now,
    case when p_follow_up_consent then v_now else null end,
    p_logo_content_type, p_logo_size_bytes, p_logo_sha256, v_now
  );

  insert into public.affiliate_application_payment_coordination (
    application_id, plan_code, payment_status, payment_operation_state
  ) values (v_reservation.reserved_application_id, p_plan_code, 'not_requested', 'none');

  update public.bkfc_integration_ingress_reservations
  set lifecycle_state = 'completed', outcome_code = 'APPLICATION_RECEIVED',
    completed_at = v_now, claim_token = null, lease_expires_at = null
  where reservation_id = p_reservation_id;

  return query select
    v_reservation.reserved_application_id, v_reservation.reserved_application_reference,
    p_source_application_id, v_now,
    'submitted'::text, 'new'::text, 'not_requested'::text, false;
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
begin
  if p_review_stage not in (
    'submitted', 'under_review', 'follow_up_required', 'interview',
    'trial_candidate', 'approved', 'rejected', 'activated_affiliate'
  ) then
    raise exception 'Invalid review stage' using errcode = '22023';
  end if;
  if p_status not in ('new', 'in_review', 'pending_info', 'candidate', 'approved', 'rejected', 'active') then
    raise exception 'Invalid application status' using errcode = '22023';
  end if;
  if (p_review_stage, p_status) not in (
    ('submitted', 'new'), ('under_review', 'in_review'),
    ('follow_up_required', 'pending_info'), ('interview', 'in_review'),
    ('trial_candidate', 'candidate'), ('approved', 'approved'),
    ('rejected', 'rejected'), ('activated_affiliate', 'active')
  ) then
    raise exception 'Review stage and application status do not match' using errcode = '22023';
  end if;

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
  then
    return query select false, null::uuid, null::uuid;
    return;
  end if;

  if p_review_stage = 'approved' and p_status = 'approved'
    and v_application.review_stage = 'rejected' and v_application.status = 'rejected'
  then
    raise exception 'Direct rejected application approval is not permitted' using errcode = '55000';
  end if;

  if v_is_bkfc and p_review_stage = 'activated_affiliate' and p_status = 'active' then
    select coordination.* into v_coordination
    from public.affiliate_application_payment_coordination as coordination
    where coordination.application_id = p_application_id
    for update;
    if v_application.review_stage is distinct from 'approved'
      or v_application.status is distinct from 'approved'
      or not found
      or v_coordination.payment_status is distinct from 'paid'
    then
      raise exception 'ACTIVATION_REQUIRES_APPROVED_AND_PAID' using errcode = '55000';
    end if;
  end if;

  if v_is_bkfc and p_review_stage = 'approved' and p_status = 'approved' then
    select coordination.* into v_coordination
    from public.affiliate_application_payment_coordination as coordination
    where coordination.application_id = p_application_id
    for update;
    if not found then
      raise exception 'PAYMENT_COORDINATION_REQUIRED' using errcode = '55000';
    end if;
    if v_coordination.payment_status in ('not_requested', 'cancelled') then
      v_payment_request_id := pg_catalog.gen_random_uuid();
      v_idempotency_key := pg_catalog.gen_random_uuid();
      v_payload := pg_catalog.jsonb_build_object(
        'contractVersion', 1,
        'paymentRequestId', v_payment_request_id::text,
        'euApplicationId', v_application.id::text,
        'euApplicationReference', v_application.application_reference,
        'bkfcApplicationId', v_application.source_application_id,
        'planCode', v_coordination.plan_code,
        'gymName', v_application.gym_name,
        'recipient', pg_catalog.jsonb_build_object(
          'name', v_application.contact_person,
          'email', pg_catalog.lower(v_application.email)
        ),
        'approvedAt', pg_catalog.to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      );
      insert into public.affiliate_application_payment_command_outbox (
        command_id, application_id, bkfc_application_id, command_type,
        payment_request_id, idempotency_key, payload, payload_hash,
        delivery_status, request_reason, created_by_user_id, created_by_email
      ) values (
        v_payment_request_id, p_application_id, v_application.source_application_id,
        'payment_initiation', v_payment_request_id, v_idempotency_key,
        v_payload, public.bkfc_json_sha256_v1(v_payload), 'queued', 'approval',
        p_actor_user_id, pg_catalog.lower(nullif(pg_catalog.btrim(p_actor_email), ''))
      );
      update public.affiliate_application_payment_coordination
      set payment_status = 'pending', current_payment_request_id = v_payment_request_id,
        payment_requested_at = v_now, payment_link_sent_at = null,
        cancelled_at = case when v_coordination.payment_status = 'cancelled' then v_coordination.cancelled_at else null end,
        payment_operation_state = 'initiation_queued', last_operational_error_code = null,
        last_operational_error_at = null
      where application_id = p_application_id;
    elsif v_coordination.payment_status = 'refunded' then
      raise exception 'Refunded applications cannot initiate payment' using errcode = '55000';
    end if;
  end if;

  if v_is_bkfc
    and v_application.review_stage = 'approved' and v_application.status = 'approved'
    and (p_review_stage, p_status) <> ('approved', 'approved')
  then
    select coordination.* into v_coordination
    from public.affiliate_application_payment_coordination as coordination
    where coordination.application_id = p_application_id
    for update;
    if found and v_coordination.current_payment_request_id is not null then
      select command.* into v_initiation
      from public.affiliate_application_payment_command_outbox as command
      where command.command_id = v_coordination.current_payment_request_id
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
        where application_id = p_application_id;
      elsif found then
        select cancellation.command_id into v_cancellation_id
        from public.affiliate_application_payment_command_outbox as cancellation
        where cancellation.command_type = 'payment_cancellation'
          and cancellation.payment_request_id = v_initiation.payment_request_id;
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
          last_operational_error_code = case when payment_status = 'paid'
            then 'APPROVAL_REVERSED_AFTER_PAYMENT' else null end,
          last_operational_error_at = case when payment_status = 'paid' then v_now else null end
        where application_id = p_application_id;
      end if;
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
  v_payment_request_id uuid := pg_catalog.gen_random_uuid();
  v_idempotency_key uuid := pg_catalog.gen_random_uuid();
  v_payload jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_plan_code not in ('monthly', 'quarterly')
    or p_request_reason not in ('legacy_initialization', 'staff_reissue')
    or nullif(pg_catalog.btrim(p_actor_email), '') is null
  then raise exception 'Invalid payment request' using errcode = '22023'; end if;
  select application.* into v_application
  from public.affiliate_applications as application
  where application.id = p_application_id for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  if v_application.review_stage <> 'approved' or v_application.status <> 'approved' then
    raise exception 'Application must be approved' using errcode = '55000';
  end if;
  if v_application.source_system is distinct from 'bkfc' or v_application.source_application_id is null then
    raise exception 'BKFC application identity is required' using errcode = '55000';
  end if;
  select coordination.* into v_coordination
  from public.affiliate_application_payment_coordination as coordination
  where coordination.application_id = p_application_id for update;
  if not found then
    if p_request_reason <> 'legacy_initialization' then
      raise exception 'Legacy initialization is required' using errcode = '55000';
    end if;
    insert into public.affiliate_application_payment_coordination (
      application_id, plan_code, payment_status, payment_operation_state
    ) values (p_application_id, p_plan_code, 'not_requested', 'none')
    returning * into v_coordination;
  end if;
  if v_coordination.payment_status in ('paid', 'refunded') then
    raise exception 'Paid or refunded payment cannot be reissued' using errcode = '55000';
  end if;
  if p_request_reason = 'legacy_initialization' and v_coordination.current_payment_request_id is not null then
    raise exception 'Legacy payment already initialized' using errcode = '55000';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'contractVersion', 1, 'paymentRequestId', v_payment_request_id::text,
    'euApplicationId', v_application.id::text,
    'euApplicationReference', v_application.application_reference,
    'bkfcApplicationId', v_application.source_application_id,
    'planCode', p_plan_code, 'gymName', v_application.gym_name,
    'recipient', pg_catalog.jsonb_build_object(
      'name', v_application.contact_person, 'email', pg_catalog.lower(v_application.email)
    ),
    'approvedAt', pg_catalog.to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
  insert into public.affiliate_application_payment_command_outbox (
    command_id, application_id, bkfc_application_id, command_type, payment_request_id,
    idempotency_key, payload, payload_hash, delivery_status, request_reason,
    created_by_user_id, created_by_email
  ) values (
    v_payment_request_id, p_application_id, v_application.source_application_id,
    'payment_initiation', v_payment_request_id, v_idempotency_key, v_payload,
    public.bkfc_json_sha256_v1(v_payload), 'queued', p_request_reason,
    p_actor_user_id, pg_catalog.lower(pg_catalog.btrim(p_actor_email))
  );
  update public.affiliate_application_payment_coordination
  set plan_code = p_plan_code, payment_status = 'pending',
    current_payment_request_id = v_payment_request_id, payment_requested_at = v_now,
    payment_link_sent_at = null, payment_operation_state = 'initiation_queued',
    last_operational_error_code = null, last_operational_error_at = null
  where application_id = p_application_id;
  return v_payment_request_id;
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

  -- Global across overlapping cron and manual worker invocations.
  perform pg_catalog.pg_advisory_xact_lock(1112233445);

  with suppressed as (
    update public.affiliate_application_payment_command_outbox as command
    set delivery_status = 'suppressed', next_attempt_at = null,
      claim_token = null, claimed_at = null, last_error_code = 'APPROVAL_NOT_CURRENT'
    where command.command_type = 'payment_initiation'
      and command.delivery_status in ('queued', 'retry_wait')
      and not exists (
        select 1 from public.affiliate_applications as application
        where application.id = command.application_id
          and application.review_stage = 'approved' and application.status = 'approved'
      )
    returning command.application_id, command.payment_request_id
  )
  update public.affiliate_application_payment_coordination as coordination
  set payment_status = case when coordination.payment_status in ('paid', 'refunded')
      then coordination.payment_status else 'cancelled' end,
    cancelled_at = case when coordination.payment_status in ('paid', 'refunded')
      then coordination.cancelled_at else pg_catalog.now() end,
    payment_operation_state = case when coordination.payment_status in ('paid', 'refunded')
      then 'cancellation_intervention_required' else 'none' end
  from suppressed
  where coordination.application_id = suppressed.application_id
    and coordination.current_payment_request_id = suppressed.payment_request_id;

  select throttle.tokens, throttle.last_refill_at
  into v_tokens, v_last_refill_at
  from public.affiliate_application_payment_delivery_throttle as throttle
  where throttle.singleton = true
  for update;
  if not found then raise exception 'Payment delivery throttle unavailable' using errcode = '55000'; end if;
  v_tokens := least(
    5,
    v_tokens + greatest(0, pg_catalog.date_part('epoch', v_now - v_last_refill_at)) * 5
  );
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
    p_batch_size,
    greatest(0, 5 - v_active),
    pg_catalog.floor(v_tokens)::integer,
    v_eligible
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
    order by command.created_at
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
  v_command public.affiliate_application_payment_command_outbox%rowtype;
  v_approved boolean;
begin
  select command.* into v_command
  from public.affiliate_application_payment_command_outbox as command
  where command.command_id = p_command_id
    and command.delivery_status = 'sending'
    and command.claim_token = p_claim_token
  for update;
  if not found then raise exception 'Payment command claim unavailable' using errcode = 'P0002'; end if;
  if v_command.command_type = 'payment_cancellation' then return true; end if;
  select application.review_stage = 'approved' and application.status = 'approved'
  into v_approved
  from public.affiliate_applications as application
  where application.id = v_command.application_id
  for update;
  if coalesce(v_approved, false) then return true; end if;
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
  v_command public.affiliate_application_payment_command_outbox%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_disposition not in ('accepted', 'retry', 'intervention')
    or p_request_id is null
    or (p_http_status is not null and p_http_status not between 100 and 599)
    or (p_error_code is not null and p_error_code !~ '^[A-Z][A-Z0-9_]{0,63}$')
  then raise exception 'Invalid payment command completion' using errcode = '22023'; end if;
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
        payment_operation_state = case when p_outcome = 'cancelled' then 'none' else 'none' end,
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
      where application_id = v_command.application_id;
    elsif p_outcome = 'processing' then
      update public.affiliate_application_payment_coordination
      set payment_operation_state = 'cancellation_accepted'
      where application_id = v_command.application_id;
    else
      update public.affiliate_application_payment_coordination
      set payment_operation_state = 'cancellation_intervention_required',
        last_operational_error_code = coalesce(p_error_code, 'PAYMENT_ALREADY_COMPLETED'),
        last_operational_error_at = v_now
      where application_id = v_command.application_id;
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
    where application_id = v_command.application_id;
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
    where application_id = v_command.application_id;
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
    if v_existing.payload_hash is distinct from p_payload_hash then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return query select true, v_existing.applied, v_existing.resulting_status, v_existing.not_applied_reason;
    return;
  end if;

  select reservation.* into v_reservation
  from public.bkfc_integration_ingress_reservations as reservation
  where reservation.reservation_id = p_reservation_id
  for update;
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
  where application.id = p_application_id
  for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_application.source_system is distinct from 'bkfc'
    or v_application.source_application_id is distinct from p_bkfc_application_id
  then raise exception 'CORRELATION_CONFLICT' using errcode = '23505'; end if;

  select command.* into v_command
  from public.affiliate_application_payment_command_outbox as command
  where command.command_id = p_payment_request_id
    and command.command_type = 'payment_initiation';
  if not found then raise exception 'PAYMENT_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_command.application_id is distinct from p_application_id
    or v_command.bkfc_application_id is distinct from p_bkfc_application_id
  then raise exception 'PAYMENT_REQUEST_MISMATCH' using errcode = '23505'; end if;

  select coordination.* into v_coordination
  from public.affiliate_application_payment_coordination as coordination
  where coordination.application_id = p_application_id
  for update;
  if not found then raise exception 'PAYMENT_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  v_previous := v_coordination.payment_status;
  v_result := v_previous;
  v_current := v_coordination.current_payment_request_id = p_payment_request_id;

  if p_event_type in ('payment_link_sent', 'payment_initiation_failed') and not v_current then
    v_not_applied := 'superseded_attempt';
  elsif p_event_type = 'payment_cancelled' and not v_current then
    v_not_applied := 'superseded_attempt';
  elsif p_event_type in ('payment_link_sent', 'payment_cancelled', 'payment_initiation_failed')
    and v_coordination.last_status_event_occurred_at is not null
    and p_occurred_at < v_coordination.last_status_event_occurred_at
  then
    v_not_applied := 'stale_event';
  elsif p_event_type = 'payment_link_sent' then
    if v_previous <> 'pending' then
      v_not_applied := 'transition_not_permitted';
    elsif v_coordination.payment_link_sent_at is not null then
      v_not_applied := 'duplicate_business_state';
    else
      v_applied := true;
    end if;
  elsif p_event_type = 'payment_paid' then
    if v_previous = 'refunded' then
      v_not_applied := 'transition_not_permitted';
    elsif v_previous = 'paid' then
      v_not_applied := 'duplicate_business_state';
    else
      v_applied := true;
      v_result := 'paid';
    end if;
  elsif p_event_type = 'payment_cancelled' then
    if v_previous in ('paid', 'refunded') then
      v_not_applied := 'transition_not_permitted';
    elsif v_previous = 'cancelled' then
      v_not_applied := 'duplicate_business_state';
    elsif v_previous <> 'pending' then
      v_not_applied := 'transition_not_permitted';
    else
      v_applied := true;
      v_result := 'cancelled';
    end if;
  elsif p_event_type = 'payment_refunded' then
    if v_previous = 'refunded' then
      v_not_applied := 'duplicate_business_state';
    else
      v_applied := true;
      v_result := 'refunded';
    end if;
  elsif p_event_type = 'payment_initiation_failed' then
    if v_previous <> 'pending' then
      v_not_applied := 'transition_not_permitted';
    else
      v_applied := true;
    end if;
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
    where application_id = p_application_id;
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
alter table public.bkfc_integration_rate_limit_buckets enable row level security;
alter table public.bkfc_integration_ingress_reservations enable row level security;
alter table public.affiliate_application_payment_delivery_throttle enable row level security;

revoke all on table public.affiliate_application_payment_coordination from public, anon, authenticated;
revoke all on table public.affiliate_application_payment_command_outbox from public, anon, authenticated;
revoke all on table public.affiliate_application_payment_status_events from public, anon, authenticated;
revoke all on table public.bkfc_integration_rate_limit_buckets from public, anon, authenticated;
revoke all on table public.bkfc_integration_ingress_reservations from public, anon, authenticated;
revoke all on table public.affiliate_application_payment_delivery_throttle from public, anon, authenticated;
revoke all on table public.bkfc_integration_rate_limit_buckets from service_role;
revoke all on table public.bkfc_integration_ingress_reservations from service_role;
revoke all on table public.affiliate_application_payment_coordination from service_role;
revoke all on table public.affiliate_application_payment_command_outbox from service_role;
revoke all on table public.affiliate_application_payment_status_events from service_role;
revoke all on table public.affiliate_application_payment_delivery_throttle from service_role;
grant select, insert, update on table public.affiliate_application_payment_coordination to service_role;
grant select, insert, update on table public.affiliate_application_payment_command_outbox to service_role;
grant select, insert on table public.affiliate_application_payment_status_events to service_role;
grant select, update on table public.affiliate_application_payment_delivery_throttle to service_role;

revoke all on function public.set_affiliate_application_updated_at() from public, anon, authenticated;
revoke all on function public.set_affiliate_payment_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_affiliate_payment_command_identity_mutation() from public, anon, authenticated;
revoke all on function public.enforce_affiliate_payment_command_bkfc_identity() from public, anon, authenticated;
revoke all on function public.prevent_affiliate_payment_status_event_mutation() from public, anon, authenticated;
revoke all on function public.bkfc_json_canonicalize_v1(jsonb) from public, anon, authenticated;
revoke all on function public.bkfc_json_sha256_v1(jsonb) from public, anon, authenticated;
revoke all on function public.set_affiliate_application_updated_at() from service_role;
revoke all on function public.set_affiliate_payment_updated_at() from service_role;
revoke all on function public.prevent_affiliate_payment_command_identity_mutation() from service_role;
revoke all on function public.enforce_affiliate_payment_command_bkfc_identity() from service_role;
revoke all on function public.prevent_affiliate_payment_status_event_mutation() from service_role;
revoke all on function public.bkfc_json_canonicalize_v1(jsonb) from service_role;
revoke all on function public.bkfc_json_sha256_v1(jsonb) from service_role;
revoke all on function public.consume_bkfc_integration_rate_limit_v1(text, text) from public, anon, authenticated;
revoke all on function public.consume_bkfc_integration_rate_limit_v1(text, text) from service_role;
revoke all on function public.reserve_bkfc_integration_ingress_v1(
  text, uuid, text, text, text, uuid, uuid, integer
) from public, anon, authenticated;
revoke all on function public.finalize_bkfc_integration_ingress_reservation_v1(
  uuid, uuid, text, text, boolean
) from public, anon, authenticated;
revoke all on function public.create_bkfc_affiliate_application_v1(
  uuid, uuid, uuid, text, text, uuid, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, boolean, boolean, boolean, text,
  text, text, integer, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.admin_transition_affiliate_application(uuid, text, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.admin_create_affiliate_payment_request(uuid, text, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_affiliate_payment_command_delivery(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.confirm_affiliate_payment_command_transmission(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_affiliate_payment_command_delivery(
  uuid, uuid, text, uuid, integer, text, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.record_bkfc_payment_status_event_v1(
  uuid, uuid, uuid, text, text, timestamptz, text, text, uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.create_bkfc_affiliate_application_v1(
  uuid, uuid, uuid, text, text, uuid, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, boolean, boolean, boolean, text,
  text, text, integer, text, text, text, text, text, text
) to service_role;
grant execute on function public.reserve_bkfc_integration_ingress_v1(
  text, uuid, text, text, text, uuid, uuid, integer
) to service_role;
grant execute on function public.finalize_bkfc_integration_ingress_reservation_v1(
  uuid, uuid, text, text, boolean
) to service_role;
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

comment on table public.affiliate_application_payment_command_outbox is
  'Generalized immutable-identity EU to BKFC payment initiation/cancellation command outbox.';
comment on table public.affiliate_application_payment_status_events is
  'Append-only authenticated BKFC business payment-status events; contains no raw Stripe data.';
comment on table public.bkfc_integration_ingress_reservations is
  'PII-free durable ingress preflight reservations; quota commits before business processing.';
