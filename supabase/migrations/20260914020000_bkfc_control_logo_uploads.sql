begin;
-- A private, dedicated bucket keeps large image bodies off the Vercel request path.
-- Never changes the frozen O1 application bucket or its upload policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bkfc-control-logos','bkfc-control-logos',false,10485760,array['image/jpeg','image/png','image/webp','image/gif','image/avif']);
create table public.bkfc_control_logo_uploads (
 command_id uuid primary key,
 application_id uuid not null references public.affiliate_applications(id) on delete restrict,
 object_path text not null unique,
 expected_version text not null check(expected_version ~ '^[0-9]{1,20}$'),
 content_type text not null check(content_type in ('image/jpeg','image/png','image/webp','image/gif','image/avif')),
 size_bytes integer not null check(size_bytes between 1 and 10485760),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 created_by_user_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '1 hour'
);
alter table public.bkfc_control_logo_uploads enable row level security;
revoke all on public.bkfc_control_logo_uploads from public,anon,authenticated,service_role;
grant select on public.bkfc_control_logo_uploads to service_role;
create function public.prepare_bkfc_control_logo_upload(p_command_id uuid,p_application_id uuid,p_version text,
 p_content_type text,p_size_bytes integer,p_sha256 text,p_actor_user_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare existing public.bkfc_control_logo_uploads%rowtype; object_key text;
begin
 if p_command_id is null or p_application_id is null or p_actor_user_id is null or p_version is null
 or p_content_type is null or p_size_bytes is null or p_sha256 is null then raise exception 'INVALID_LOGO_UPLOAD'; end if;
 perform pg_advisory_xact_lock(hashtext('bkfc-logo-actor:'||p_actor_user_id::text));
 perform pg_advisory_xact_lock(hashtext('bkfc-control:'||p_application_id::text));
 select * into existing from public.bkfc_control_logo_uploads where command_id=p_command_id;
 if found then
  if (existing.application_id,existing.expected_version,existing.content_type,existing.size_bytes,existing.sha256,existing.created_by_user_id)
   is distinct from (p_application_id,p_version,p_content_type,p_size_bytes,p_sha256,p_actor_user_id) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if existing.expires_at<=clock_timestamp() then raise exception 'LOGO_UPLOAD_EXPIRED'; end if;
  return existing.object_path;
 end if;
 if not exists(select 1 from public.affiliate_applications a join public.bkfc_gym_remote_state s on s.application_id=a.id
 where a.id=p_application_id and a.source_system='bkfc' and not s.delisted and s.listing_version=p_version)
 then raise exception 'REFRESH_LISTING_REQUIRED'; end if;
 if exists(select 1 from public.bkfc_gym_control_commands where application_id=p_application_id and delivery_status in ('queued','sending','retry_wait','uncertain'))
 then raise exception 'CONTROL_COMMAND_PENDING'; end if;
 if (select count(*) from public.bkfc_control_logo_uploads where created_by_user_id=p_actor_user_id and created_at>clock_timestamp()-interval '1 hour')>=10
 then raise exception 'LOGO_UPLOAD_RATE_LIMITED'; end if;
 object_key:=p_application_id::text||'/'||p_command_id::text;
 insert into public.bkfc_control_logo_uploads(command_id,application_id,object_path,expected_version,content_type,size_bytes,sha256,created_by_user_id)
 values(p_command_id,p_application_id,object_key,p_version,p_content_type,p_size_bytes,p_sha256,p_actor_user_id);
 return object_key;
end $$;
revoke all on function public.prepare_bkfc_control_logo_upload(uuid,uuid,text,text,integer,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.prepare_bkfc_control_logo_upload(uuid,uuid,text,text,integer,text,uuid) to service_role;
-- No browser Storage policy is granted. The server issues an upload-only signed
-- token for one immutable object (upsert=false), after admin authorization.
-- Expired temporary objects require a separately reviewed retention/cleanup job.
commit;
