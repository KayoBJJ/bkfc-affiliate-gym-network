\set ON_ERROR_STOP on
-- Synthetic pre-migration schema for disposable PostgreSQL ONLY.
-- This is not a dump of staging: external Auth/Storage services are not exercised.
create schema if not exists auth;
create schema if not exists storage;
create table if not exists auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create table if not exists storage.buckets(id text primary key, public boolean);
create table if not exists storage.objects(id uuid primary key, bucket_id text, name text);
create table public.affiliate_applications (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 gym_name text not null, city_country text not null, country text, region text,
 contact_person text not null, email text not null, phone text not null,
 website_instagram text, disciplines_offered text, logo_url text, gym_photo_urls text[],
 fighter_list_url text, promo_video_link text, review_consent boolean not null default false,
 follow_up_consent boolean default false, status text not null default 'new',
 review_stage text not null default 'submitted', internal_notes text
);
create table public.application_stage_history (
 id uuid primary key default gen_random_uuid(), application_id uuid references public.affiliate_applications(id),
 review_stage text, status text, changed_at timestamptz default now()
);
