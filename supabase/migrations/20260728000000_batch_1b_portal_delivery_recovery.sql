-- Batch 1B, slice 2: safe portal email delivery and anti-enumeration recovery.
-- Raw portal and recovery tokens are never persisted.

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
      'applicant_portal_access_issued',
      'applicant_portal_delivery_requested',
      'applicant_portal_delivery_sent',
      'applicant_portal_delivery_failed',
      'applicant_portal_recovery_requested',
      'applicant_portal_recovery_sent',
      'applicant_portal_access_recovered',
      'applicant_notification_requested',
      'applicant_notification_sent',
      'applicant_notification_failed'
    )
  );

alter table public.affiliate_application_portal_access
  add column if not exists activated_at timestamptz,
  add column if not exists delivery_status text,
  add column if not exists delivery_reason text,
  add column if not exists provider_message_id text,
  add column if not exists delivery_error_code text;

update public.affiliate_application_portal_access
set activated_at = coalesce(activated_at, created_at),
    delivery_status = coalesce(delivery_status, 'manual'),
    delivery_reason = coalesce(delivery_reason, 'manual_applicant_update')
where delivery_status is null
   or activated_at is null
   or delivery_reason is null;

alter table public.affiliate_application_portal_access
  alter column delivery_status set default 'manual',
  alter column delivery_status set not null,
  alter column delivery_reason set default 'manual_applicant_update',
  alter column delivery_reason set not null;

alter table public.affiliate_application_portal_access
  drop constraint if exists affiliate_portal_delivery_status_check;
alter table public.affiliate_application_portal_access
  add constraint affiliate_portal_delivery_status_check check (
    delivery_status in ('manual', 'pending', 'sent', 'failed', 'recovery')
  );
alter table public.affiliate_application_portal_access
  drop constraint if exists affiliate_portal_delivery_reason_check;
alter table public.affiliate_application_portal_access
  add constraint affiliate_portal_delivery_reason_check check (
    delivery_reason in (
      'application_received',
      'more_information_required',
      'replacement_required',
      'approved',
      'rejected',
      'affiliate_activated',
      'manual_applicant_update',
      'recovery'
    )
  );

drop index if exists public.affiliate_application_portal_one_active_idx;
create unique index affiliate_application_portal_one_active_idx
  on public.affiliate_application_portal_access (application_id)
  where revoked_at is null and activated_at is not null;

create or replace function public.admin_issue_affiliate_application_portal_access(
  p_application_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_actor_user_id uuid,
  p_actor_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_id uuid;
  v_replaced_access_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= now()
    or p_expires_at > now() + interval '370 days'
  then
    raise exception 'Invalid portal access request' using errcode = '22023';
  end if;

  perform 1 from public.affiliate_applications
  where id = p_application_id for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  update public.affiliate_application_portal_access
  set revoked_at = now()
  where application_id = p_application_id
    and revoked_at is null
    and activated_at is not null
  returning id into v_replaced_access_id;

  insert into public.affiliate_application_portal_access (
    application_id,
    token_hash,
    expires_at,
    created_by_user_id,
    created_by_email,
    activated_at,
    delivery_status,
    delivery_reason
  ) values (
    p_application_id,
    p_token_hash,
    p_expires_at,
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    now(),
    'manual',
    'manual_applicant_update'
  )
  returning id into v_access_id;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, actor_user_id, actor_email, details
  ) values (
    p_application_id,
    'applicant_portal_access_issued',
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    jsonb_strip_nulls(jsonb_build_object(
      'portal_access_id', v_access_id,
      'replaced_portal_access_id', v_replaced_access_id,
      'expires_at', p_expires_at,
      'delivery_status', 'manual'
    ))
  );

  return v_access_id;
end;
$$;

create or replace function public.prepare_affiliate_application_portal_delivery(
  p_application_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_actor_user_id uuid,
  p_actor_email text,
  p_delivery_reason text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= now()
    or p_expires_at > now() + interval '370 days'
    or p_delivery_reason not in (
      'application_received',
      'more_information_required',
      'replacement_required',
      'approved',
      'rejected',
      'affiliate_activated',
      'manual_applicant_update'
    )
  then
    raise exception 'Invalid portal delivery request' using errcode = '22023';
  end if;

  perform 1 from public.affiliate_applications
  where id = p_application_id;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  update public.affiliate_application_portal_access
  set revoked_at = now(),
      delivery_status = 'failed',
      delivery_error_code = 'STALE_PENDING_DELIVERY'
  where application_id = p_application_id
    and activated_at is null
    and revoked_at is null
    and created_at < now() - interval '5 minutes';

  if exists (
    select 1
    from public.affiliate_application_portal_access
    where application_id = p_application_id
      and activated_at is null
      and revoked_at is null
  ) then
    raise exception 'Portal delivery already in progress' using errcode = '55000';
  end if;

  insert into public.affiliate_application_portal_access (
    application_id,
    token_hash,
    expires_at,
    created_by_user_id,
    created_by_email,
    delivery_status,
    delivery_reason
  ) values (
    p_application_id,
    p_token_hash,
    p_expires_at,
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    'pending',
    p_delivery_reason
  )
  returning id into v_access_id;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, actor_user_id, actor_email, details
  ) values (
    p_application_id,
    'applicant_portal_delivery_requested',
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    jsonb_build_object(
      'portal_access_id', v_access_id,
      'delivery_reason', p_delivery_reason,
      'expires_at', p_expires_at
    )
  );
  return v_access_id;
end;
$$;

create or replace function public.complete_affiliate_application_portal_delivery(
  p_access_id uuid,
  p_succeeded boolean,
  p_provider_message_id text,
  p_error_code text,
  p_actor_user_id uuid,
  p_actor_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access public.affiliate_application_portal_access%rowtype;
  v_replaced_access_id uuid;
begin
  select * into v_access
  from public.affiliate_application_portal_access
  where id = p_access_id
  for update;
  if not found
    or v_access.delivery_status <> 'pending'
    or v_access.activated_at is not null
    or v_access.revoked_at is not null
  then
    raise exception 'Portal delivery unavailable' using errcode = 'P0002';
  end if;

  perform 1 from public.affiliate_applications
  where id = v_access.application_id for update;

  if p_succeeded then
    update public.affiliate_application_portal_access
    set revoked_at = now()
    where application_id = v_access.application_id
      and id <> v_access.id
      and revoked_at is null
      and activated_at is not null
    returning id into v_replaced_access_id;

    update public.affiliate_application_portal_access
    set activated_at = now(),
        delivery_status = 'sent',
        provider_message_id = nullif(trim(p_provider_message_id), ''),
        delivery_error_code = null
    where id = v_access.id;

    insert into public.affiliate_application_audit_events (
      application_id, event_type, actor_user_id, actor_email, details
    ) values
    (
      v_access.application_id,
      'applicant_portal_access_issued',
      p_actor_user_id,
      lower(nullif(trim(p_actor_email), '')),
      jsonb_strip_nulls(jsonb_build_object(
        'portal_access_id', v_access.id,
        'replaced_portal_access_id', v_replaced_access_id,
        'expires_at', v_access.expires_at,
        'delivery_status', 'sent'
      ))
    ),
    (
      v_access.application_id,
      'applicant_portal_delivery_sent',
      p_actor_user_id,
      lower(nullif(trim(p_actor_email), '')),
      jsonb_build_object(
        'portal_access_id', v_access.id,
        'delivery_reason', v_access.delivery_reason
      )
    );
  else
    update public.affiliate_application_portal_access
    set revoked_at = now(),
        delivery_status = 'failed',
        delivery_error_code = left(coalesce(nullif(trim(p_error_code), ''), 'DELIVERY_FAILED'), 80)
    where id = v_access.id;

    insert into public.affiliate_application_audit_events (
      application_id, event_type, actor_user_id, actor_email, details
    ) values (
      v_access.application_id,
      'applicant_portal_delivery_failed',
      p_actor_user_id,
      lower(nullif(trim(p_actor_email), '')),
      jsonb_build_object(
        'portal_access_id', v_access.id,
        'delivery_reason', v_access.delivery_reason,
        'error_code', left(coalesce(nullif(trim(p_error_code), ''), 'DELIVERY_FAILED'), 80)
      )
    );
  end if;
  return v_access.application_id;
end;
$$;

create table if not exists public.affiliate_application_portal_recovery (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.affiliate_applications(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  delivery_status text not null default 'pending' check (
    delivery_status in ('pending', 'sent', 'failed')
  ),
  provider_message_id text,
  delivery_error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  consumed_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at)
);

create index if not exists affiliate_portal_recovery_token_idx
  on public.affiliate_application_portal_recovery (token_hash, expires_at)
  where consumed_at is null and revoked_at is null;

alter table public.affiliate_application_portal_recovery enable row level security;
revoke all on table public.affiliate_application_portal_recovery
  from public, anon, authenticated;

create table if not exists public.affiliate_portal_recovery_rate_limits (
  id bigint generated always as identity primary key,
  identifier_kind text not null check (identifier_kind in ('origin', 'identity')),
  identifier_hash text not null check (identifier_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists affiliate_portal_recovery_rate_lookup_idx
  on public.affiliate_portal_recovery_rate_limits (
    identifier_kind, identifier_hash, created_at desc
  );

alter table public.affiliate_portal_recovery_rate_limits enable row level security;
revoke all on table public.affiliate_portal_recovery_rate_limits
  from public, anon, authenticated;

create or replace function public.request_affiliate_application_portal_recovery(
  p_application_reference text,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_origin_hash text,
  p_identity_hash text
) returns table (
  rate_limited boolean,
  recovery_id uuid,
  application_id uuid,
  application_reference text,
  contact_person text,
  email text,
  gym_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_application public.affiliate_applications%rowtype;
  v_recovery_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or p_origin_hash !~ '^[0-9a-f]{64}$'
    or p_identity_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= v_now
    or p_expires_at > v_now + interval '31 minutes'
  then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_origin_hash));
  perform pg_advisory_xact_lock(hashtext(p_identity_hash));
  delete from public.affiliate_portal_recovery_rate_limits
  where created_at < v_now - interval '25 hours';

  if (
    select count(*) from public.affiliate_portal_recovery_rate_limits
    where identifier_kind = 'origin'
      and identifier_hash = p_origin_hash
      and created_at >= v_now - interval '1 hour'
  ) >= 5
  or (
    select count(*) from public.affiliate_portal_recovery_rate_limits
    where identifier_kind = 'identity'
      and identifier_hash = p_identity_hash
      and created_at >= v_now - interval '1 hour'
  ) >= 3
  then
    return query
      select true, null::uuid, null::uuid, null::text, null::text, null::text, null::text;
    return;
  end if;

  insert into public.affiliate_portal_recovery_rate_limits (
    identifier_kind, identifier_hash
  ) values ('origin', p_origin_hash), ('identity', p_identity_hash);

  select application.* into v_application
  from public.affiliate_applications as application
  where upper(application.application_reference) = upper(trim(p_application_reference))
    and lower(coalesce(application.normalized_email, application.email)) = lower(trim(p_email))
  order by application.created_at desc
  limit 1;

  if not found then
    return query
      select false, null::uuid, null::uuid, null::text, null::text, null::text, null::text;
    return;
  end if;

  update public.affiliate_application_portal_recovery as recovery
  set revoked_at = v_now
  where recovery.application_id = v_application.id
    and recovery.consumed_at is null
    and recovery.revoked_at is null;

  insert into public.affiliate_application_portal_recovery (
    application_id, token_hash, expires_at
  ) values (
    v_application.id, p_token_hash, p_expires_at
  )
  returning id into v_recovery_id;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, details
  ) values (
    v_application.id,
    'applicant_portal_recovery_requested',
    jsonb_build_object(
      'portal_recovery_id', v_recovery_id,
      'expires_at', p_expires_at
    )
  );

  return query select
    false,
    v_recovery_id,
    v_application.id,
    v_application.application_reference,
    v_application.contact_person,
    v_application.email,
    v_application.gym_name;
end;
$$;

create or replace function public.complete_affiliate_application_portal_recovery_delivery(
  p_recovery_id uuid,
  p_succeeded boolean,
  p_provider_message_id text,
  p_error_code text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recovery public.affiliate_application_portal_recovery%rowtype;
begin
  select * into v_recovery
  from public.affiliate_application_portal_recovery
  where id = p_recovery_id for update;
  if not found or v_recovery.delivery_status <> 'pending' then
    raise exception 'Recovery delivery unavailable' using errcode = 'P0002';
  end if;

  if p_succeeded then
    update public.affiliate_application_portal_recovery
    set delivery_status = 'sent',
        provider_message_id = nullif(trim(p_provider_message_id), ''),
        sent_at = now()
    where id = v_recovery.id;
    insert into public.affiliate_application_audit_events (
      application_id, event_type, details
    ) values (
      v_recovery.application_id,
      'applicant_portal_recovery_sent',
      jsonb_build_object('portal_recovery_id', v_recovery.id)
    );
  else
    update public.affiliate_application_portal_recovery
    set delivery_status = 'failed',
        delivery_error_code = left(coalesce(nullif(trim(p_error_code), ''), 'DELIVERY_FAILED'), 80),
        revoked_at = now()
    where id = v_recovery.id;
  end if;
  return v_recovery.application_id;
end;
$$;

create or replace function public.consume_affiliate_application_portal_recovery(
  p_recovery_token_hash text,
  p_portal_token_hash text,
  p_portal_expires_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recovery public.affiliate_application_portal_recovery%rowtype;
  v_access_id uuid;
  v_replaced_access_id uuid;
begin
  if p_recovery_token_hash !~ '^[0-9a-f]{64}$'
    or p_portal_token_hash !~ '^[0-9a-f]{64}$'
    or p_portal_expires_at <= now()
    or p_portal_expires_at > now() + interval '370 days'
  then
    raise exception 'Invalid recovery request' using errcode = '22023';
  end if;

  select * into v_recovery
  from public.affiliate_application_portal_recovery
  where token_hash = p_recovery_token_hash
  for update;
  if not found
    or v_recovery.delivery_status <> 'sent'
    or v_recovery.expires_at <= now()
    or v_recovery.consumed_at is not null
    or v_recovery.revoked_at is not null
  then
    raise exception 'Recovery link unavailable' using errcode = 'P0002';
  end if;

  perform 1 from public.affiliate_applications
  where id = v_recovery.application_id for update;

  update public.affiliate_application_portal_access
  set revoked_at = now()
  where application_id = v_recovery.application_id
    and revoked_at is null
    and activated_at is not null
  returning id into v_replaced_access_id;

  insert into public.affiliate_application_portal_access (
    application_id,
    token_hash,
    expires_at,
    activated_at,
    delivery_status,
    delivery_reason
  ) values (
    v_recovery.application_id,
    p_portal_token_hash,
    p_portal_expires_at,
    now(),
    'recovery',
    'recovery'
  )
  returning id into v_access_id;

  update public.affiliate_application_portal_recovery
  set consumed_at = now()
  where id = v_recovery.id;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, details
  ) values
  (
    v_recovery.application_id,
    'applicant_portal_access_issued',
    jsonb_strip_nulls(jsonb_build_object(
      'portal_access_id', v_access_id,
      'replaced_portal_access_id', v_replaced_access_id,
      'expires_at', p_portal_expires_at,
      'delivery_status', 'recovery'
    ))
  ),
  (
    v_recovery.application_id,
    'applicant_portal_access_recovered',
    jsonb_build_object(
      'portal_recovery_id', v_recovery.id,
      'portal_access_id', v_access_id
    )
  );

  return v_recovery.application_id;
end;
$$;

revoke all on function public.prepare_affiliate_application_portal_delivery(
  uuid, text, timestamptz, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.complete_affiliate_application_portal_delivery(
  uuid, boolean, text, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.request_affiliate_application_portal_recovery(
  text, text, text, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.complete_affiliate_application_portal_recovery_delivery(
  uuid, boolean, text, text
) from public, anon, authenticated;
revoke all on function public.consume_affiliate_application_portal_recovery(
  text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.prepare_affiliate_application_portal_delivery(
  uuid, text, timestamptz, uuid, text, text
) to service_role;
grant execute on function public.complete_affiliate_application_portal_delivery(
  uuid, boolean, text, text, uuid, text
) to service_role;
grant execute on function public.request_affiliate_application_portal_recovery(
  text, text, text, timestamptz, text, text
) to service_role;
grant execute on function public.complete_affiliate_application_portal_recovery_delivery(
  uuid, boolean, text, text
) to service_role;
grant execute on function public.consume_affiliate_application_portal_recovery(
  text, text, timestamptz
) to service_role;
