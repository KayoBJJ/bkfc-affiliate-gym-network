-- Batch 1B, slice 3: authorize existing information-response operations from an
-- active applicant portal without rotating or exposing the emailed response token.

create or replace function public.require_active_affiliate_portal_request_token_hash(
  p_portal_token_hash text,
  p_request_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response_token_hash text;
begin
  if p_portal_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid portal request' using errcode = '22023';
  end if;

  select information_request.token_hash
  into v_response_token_hash
  from public.affiliate_application_portal_access as portal_access
  join public.affiliate_application_information_requests as information_request
    on information_request.application_id = portal_access.application_id
  join public.affiliate_applications as application
    on application.id = portal_access.application_id
  where portal_access.token_hash = p_portal_token_hash
    and portal_access.activated_at is not null
    and portal_access.revoked_at is null
    and portal_access.expires_at > now()
    and information_request.id = p_request_id
    and information_request.status = 'open'
    and information_request.expires_at > now()
    and application.review_stage = 'follow_up_required'
  for update of portal_access, information_request;

  if not found then
    raise exception 'Portal request unavailable' using errcode = 'P0002';
  end if;

  return v_response_token_hash;
end;
$$;

create or replace function public.create_affiliate_information_attachment_upload_from_portal(
  p_portal_token_hash text,
  p_request_id uuid,
  p_attachment_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_content_type text,
  p_size_bytes bigint
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response_token_hash text;
begin
  v_response_token_hash := public.require_active_affiliate_portal_request_token_hash(
    p_portal_token_hash,
    p_request_id
  );
  return public.create_affiliate_information_attachment_upload(
    v_response_token_hash,
    p_attachment_id,
    p_storage_path,
    p_original_filename,
    p_content_type,
    p_size_bytes
  );
end;
$$;

create or replace function public.finalize_affiliate_information_attachment_from_portal(
  p_portal_token_hash text,
  p_request_id uuid,
  p_attachment_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response_token_hash text;
begin
  v_response_token_hash := public.require_active_affiliate_portal_request_token_hash(
    p_portal_token_hash,
    p_request_id
  );
  return public.finalize_affiliate_information_attachment(
    v_response_token_hash,
    p_attachment_id
  );
end;
$$;

create or replace function public.submit_affiliate_information_response_from_portal(
  p_portal_token_hash text,
  p_request_id uuid,
  p_response_text text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response_token_hash text;
begin
  v_response_token_hash := public.require_active_affiliate_portal_request_token_hash(
    p_portal_token_hash,
    p_request_id
  );
  return public.submit_affiliate_information_response(
    v_response_token_hash,
    p_response_text
  );
end;
$$;

revoke all on function public.require_active_affiliate_portal_request_token_hash(text, uuid)
  from public, anon, authenticated;
revoke all on function public.create_affiliate_information_attachment_upload_from_portal(
  text, uuid, uuid, text, text, text, bigint
) from public, anon, authenticated;
revoke all on function public.finalize_affiliate_information_attachment_from_portal(
  text, uuid, uuid
) from public, anon, authenticated;
revoke all on function public.submit_affiliate_information_response_from_portal(
  text, uuid, text
) from public, anon, authenticated;

grant execute on function public.create_affiliate_information_attachment_upload_from_portal(
  text, uuid, uuid, text, text, text, bigint
) to service_role;
grant execute on function public.finalize_affiliate_information_attachment_from_portal(
  text, uuid, uuid
) to service_role;
grant execute on function public.submit_affiliate_information_response_from_portal(
  text, uuid, text
) to service_role;
