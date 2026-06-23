alter table public.affiliate_applications
  add column if not exists bkfc_app_access_interest boolean not null default false;
