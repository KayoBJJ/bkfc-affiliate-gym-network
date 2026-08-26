begin;

-- This bucket is charged for every authenticated, cheap-header-valid submission
-- attempt before the request body is read. It stores only a one-way credential
-- fingerprint; current and previous rotation credentials therefore remain in
-- independent PII-free buckets without any row backfill.
alter table public.bkfc_integration_rate_limit_buckets
  add constraint bkfc_integration_rate_limit_buckets_direction_check_v2
  check (direction in ('submission_preparse', 'submission', 'callback')) not valid;

alter table public.bkfc_integration_rate_limit_buckets
  validate constraint bkfc_integration_rate_limit_buckets_direction_check_v2;

alter table public.bkfc_integration_rate_limit_buckets
  drop constraint bkfc_integration_rate_limit_buckets_direction_check;

alter table public.bkfc_integration_rate_limit_buckets
  rename constraint bkfc_integration_rate_limit_buckets_direction_check_v2
  to bkfc_integration_rate_limit_buckets_direction_check;

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
  if p_direction in ('submission_preparse', 'submission') then
    v_capacity := 10;
    v_refill_per_second := 1;
  elsif p_direction = 'callback' then
    v_capacity := 50;
    v_refill_per_second := 5;
  else
    raise exception 'Invalid integration rate-limit direction' using errcode = '22023';
  end if;
  if p_credential_fingerprint is null
    or p_credential_fingerprint !~ '^[a-f0-9]{64}$'
  then
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
  if not found then
    raise exception 'Integration rate-limit bucket unavailable' using errcode = '55000';
  end if;

  -- Capture time after serialization. A waiter must never move last_refill_at
  -- backwards with a timestamp captured before another session held the lock.
  v_now := pg_catalog.clock_timestamp();
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
    where direction = p_direction
      and credential_fingerprint = p_credential_fingerprint;
    return query select true, 0;
  else
    update public.bkfc_integration_rate_limit_buckets
    set tokens = v_available, last_refill_at = v_now, updated_at = v_now
    where direction = p_direction
      and credential_fingerprint = p_credential_fingerprint;
    return query select false,
      greatest(1, pg_catalog.ceil((1 - v_available) / v_refill_per_second)::integer);
  end if;
end;
$$;

create or replace function public.consume_bkfc_submission_preparse_rate_limit_v1(
  p_credential_fingerprint text
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_credential_fingerprint is null
    or p_credential_fingerprint !~ '^[a-f0-9]{64}$'
  then
    raise exception 'Invalid integration credential fingerprint' using errcode = '22023';
  end if;

  return query
  select decision.allowed, decision.retry_after_seconds
  from public.consume_bkfc_integration_rate_limit_v1(
    'submission_preparse',
    p_credential_fingerprint
  ) as decision;
end;
$$;

revoke all on function public.consume_bkfc_integration_rate_limit_v1(text, text)
  from public, anon, authenticated, service_role;
revoke all on table public.bkfc_integration_rate_limit_buckets
  from public, anon, authenticated, service_role;
revoke all on function public.consume_bkfc_submission_preparse_rate_limit_v1(text)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_bkfc_submission_preparse_rate_limit_v1(text)
  to service_role;

comment on function public.consume_bkfc_submission_preparse_rate_limit_v1(text) is
  'Consumes one globally shared pre-parser attempt token for a validated credential fingerprint before body access; returns only allowed and bounded retry delay.';
comment on table public.bkfc_integration_rate_limit_buckets is
  'PII-free durable integration token buckets. submission_preparse charges every authenticated cheap-header-valid attempt; submission and callback remain replay-aware business quotas.';

commit;
