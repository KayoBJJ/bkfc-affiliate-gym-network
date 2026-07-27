-- Batch 1B, slice 2 hotfix: qualify the recovery table reference.
--
-- The function returns a column named application_id. PostgreSQL therefore
-- requires the recovery table's application_id to be explicitly qualified.

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

revoke all on function public.request_affiliate_application_portal_recovery(
  text, text, text, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.request_affiliate_application_portal_recovery(
  text, text, text, timestamptz, text, text
) to service_role;
