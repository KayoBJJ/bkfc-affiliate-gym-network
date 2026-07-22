-- Turnstile + anonymous application cleanup support.
-- The cleanup worker uses this narrowly scoped helper before removing any object.

create index if not exists affiliate_upload_sessions_cleanup_idx
  on public.affiliate_application_upload_sessions (status, updated_at, expires_at);

create or replace function public.affiliate_application_asset_is_linked(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.affiliate_applications application
    where application.logo_path = p_path
      or application.fighter_list_path = p_path
      or p_path = any(coalesce(application.gym_photo_paths, array[]::text[]))
  );
$$;

revoke all on function public.affiliate_application_asset_is_linked(text) from public;
grant execute on function public.affiliate_application_asset_is_linked(text) to service_role;
