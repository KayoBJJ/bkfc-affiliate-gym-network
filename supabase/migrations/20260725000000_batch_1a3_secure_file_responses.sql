-- Batch 1A.3, slice 3: private, versioned file responses for gym applicants.
-- Files are uploaded directly to private Storage and become reviewable only after
-- the server re-downloads and validates the completed object.

alter table public.affiliate_application_audit_events
  drop constraint if exists affiliate_application_audit_events_event_type_check;
alter table public.affiliate_application_audit_events
  add constraint affiliate_application_audit_events_event_type_check check (
    event_type in (
      'stage_changed',
      'internal_notes_updated',
      'information_request_created',
      'information_request_revoked',
      'applicant_response_received',
      'information_attachment_uploaded',
      'information_attachment_accepted',
      'information_attachment_replacement_requested',
      'applicant_notification_requested',
      'applicant_notification_sent',
      'applicant_notification_failed'
    )
  );

create table public.affiliate_application_information_attachments (
  id uuid primary key,
  request_id uuid not null
    references public.affiliate_application_information_requests(id) on delete restrict,
  application_id uuid not null
    references public.affiliate_applications(id) on delete restrict,
  version integer not null check (version > 0),
  storage_path text not null unique check (
    storage_path ~ '^[0-9a-f-]{36}/information-responses/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]+$'
  ),
  original_filename text not null check (length(original_filename) between 1 and 255),
  content_type text not null check (length(content_type) between 1 and 200),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  status text not null default 'uploading' check (
    status in (
      'uploading',
      'uploaded',
      'accepted',
      'replacement_requested',
      'rejected'
    )
  ),
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid,
  reviewed_by_email text,
  review_note text check (review_note is null or length(review_note) <= 1000),
  unique (request_id, version),
  check ((status = 'uploading') = (uploaded_at is null)),
  check (
    (status in ('accepted', 'replacement_requested')) =
    (reviewed_at is not null)
  )
);

create index affiliate_information_attachments_request_idx
  on public.affiliate_application_information_attachments
    (request_id, version desc);
create index affiliate_information_attachments_application_idx
  on public.affiliate_application_information_attachments
    (application_id, created_at desc);

alter table public.affiliate_application_information_attachments enable row level security;
revoke all on table public.affiliate_application_information_attachments
  from public, anon, authenticated;

alter table public.affiliate_application_information_responses
  drop constraint if exists affiliate_application_information_responses_response_text_check;
alter table public.affiliate_application_information_responses
  alter column response_text drop not null;
alter table public.affiliate_application_information_responses
  add constraint affiliate_information_responses_text_check check (
    response_text is null or length(response_text) between 1 and 6000
  );

create or replace function public.create_affiliate_information_attachment_upload(
  p_token_hash text,
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
  v_request public.affiliate_application_information_requests%rowtype;
  v_version integer;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or length(trim(p_original_filename)) not between 1 and 255
    or length(trim(p_content_type)) not between 1 and 200
    or p_size_bytes not between 1 and 10485760
  then
    raise exception 'Invalid attachment upload' using errcode = '22023';
  end if;

  select * into v_request
  from public.affiliate_application_information_requests
  where token_hash = p_token_hash
  for update;

  if not found or v_request.status <> 'open' or v_request.expires_at <= now() then
    raise exception 'Information request unavailable' using errcode = 'P0002';
  end if;

  if p_storage_path !~ (
    '^' || v_request.application_id::text ||
    '/information-responses/' || v_request.id::text ||
    '/[0-9a-f-]{36}\.[a-z0-9]+$'
  ) then
    raise exception 'Invalid attachment path' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.affiliate_application_information_attachments
    where request_id = v_request.id and status in ('uploading', 'uploaded')
  ) then
    raise exception 'An attachment is already pending' using errcode = '23505';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.affiliate_application_information_attachments
  where request_id = v_request.id;

  insert into public.affiliate_application_information_attachments (
    id,
    request_id,
    application_id,
    version,
    storage_path,
    original_filename,
    content_type,
    size_bytes
  ) values (
    p_attachment_id,
    v_request.id,
    v_request.application_id,
    v_version,
    p_storage_path,
    trim(p_original_filename),
    trim(p_content_type),
    p_size_bytes
  );

  return v_version;
end;
$$;

create or replace function public.finalize_affiliate_information_attachment(
  p_token_hash text,
  p_attachment_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.affiliate_application_information_requests%rowtype;
  v_attachment public.affiliate_application_information_attachments%rowtype;
begin
  select * into v_request
  from public.affiliate_application_information_requests
  where token_hash = p_token_hash
  for update;
  if not found or v_request.status <> 'open' or v_request.expires_at <= now() then
    raise exception 'Information request unavailable' using errcode = 'P0002';
  end if;

  select * into v_attachment
  from public.affiliate_application_information_attachments
  where id = p_attachment_id and request_id = v_request.id
  for update;
  if not found then
    raise exception 'Attachment unavailable' using errcode = 'P0002';
  end if;
  if v_attachment.status = 'uploaded' then
    return v_attachment.id;
  end if;
  if v_attachment.status <> 'uploading' then
    raise exception 'Attachment unavailable' using errcode = 'P0002';
  end if;

  update public.affiliate_application_information_attachments
  set status = 'uploaded', uploaded_at = now()
  where id = v_attachment.id;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, details
  ) values (
    v_request.application_id,
    'information_attachment_uploaded',
    jsonb_build_object(
      'information_request_id', v_request.id,
      'information_attachment_id', v_attachment.id,
      'version', v_attachment.version
    )
  );

  return v_attachment.id;
end;
$$;

create or replace function public.submit_affiliate_information_response(
  p_token_hash text,
  p_response_text text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.affiliate_application_information_requests%rowtype;
  v_application public.affiliate_applications%rowtype;
  v_response_id uuid;
  v_response_event_id uuid;
  v_outbox_id uuid;
  v_response_text text := nullif(trim(p_response_text), '');
  v_attachment_ids jsonb;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or (v_response_text is not null and length(v_response_text) > 6000)
  then
    raise exception 'Invalid information response' using errcode = '22023';
  end if;

  select * into v_request
  from public.affiliate_application_information_requests
  where token_hash = p_token_hash
  for update;
  if not found or v_request.status <> 'open' or v_request.expires_at <= now() then
    raise exception 'Information request unavailable' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(id order by version), '[]'::jsonb)
  into v_attachment_ids
  from public.affiliate_application_information_attachments
  where request_id = v_request.id and status = 'uploaded';

  if v_response_text is null and jsonb_array_length(v_attachment_ids) = 0 then
    raise exception 'A response or attachment is required' using errcode = '22023';
  end if;

  select * into v_application
  from public.affiliate_applications
  where id = v_request.application_id
  for update;

  insert into public.affiliate_application_information_responses (
    request_id, application_id, response_text, submitted_at
  ) values (
    v_request.id, v_request.application_id, v_response_text, now()
  )
  on conflict (request_id) do update
  set response_text = excluded.response_text,
      submitted_at = excluded.submitted_at
  returning id into v_response_id;

  update public.affiliate_application_information_requests
  set status = 'responded', responded_at = now()
  where id = v_request.id;

  update public.affiliate_application_notification_outbox
  set delivery_status = 'cancelled', updated_at = now()
  where application_id = v_request.application_id
    and notification_type = 'more_information_required'
    and delivery_status in ('blocked_copy_pending', 'pending', 'failed');

  if v_application.review_stage is distinct from 'under_review'
    or v_application.status is distinct from 'in_review'
  then
    update public.affiliate_applications
    set review_stage = 'under_review', status = 'in_review'
    where id = v_request.application_id;

    insert into public.application_stage_history (
      application_id, review_stage, status, changed_at
    ) values (
      v_request.application_id, 'under_review', 'in_review', now()
    );

    insert into public.affiliate_application_audit_events (
      application_id, event_type, from_review_stage, to_review_stage,
      from_status, to_status, details
    ) values (
      v_request.application_id, 'stage_changed',
      v_application.review_stage, 'under_review',
      v_application.status, 'in_review',
      jsonb_build_object('source', 'applicant_information_response')
    );
  end if;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, details
  ) values (
    v_request.application_id,
    'applicant_response_received',
    jsonb_build_object(
      'information_request_id', v_request.id,
      'information_response_id', v_response_id,
      'information_attachment_ids', v_attachment_ids
    )
  )
  returning id into v_response_event_id;

  insert into public.affiliate_application_notification_outbox (
    application_id, audit_event_id, notification_type, dedupe_key, delivery_status
  ) values (
    v_request.application_id,
    v_response_event_id,
    'information_received',
    v_request.application_id::text || ':' || v_request.id::text ||
      ':information_received:v' ||
      (select coalesce(max(version), 0)::text
       from public.affiliate_application_information_attachments
       where request_id = v_request.id),
    'blocked_copy_pending'
  )
  returning id into v_outbox_id;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, details
  ) values (
    v_request.application_id,
    'applicant_notification_requested',
    jsonb_build_object(
      'information_request_id', v_request.id,
      'notification_outbox_id', v_outbox_id,
      'notification_type', 'information_received',
      'delivery_status', 'blocked_copy_pending',
      'reason', 'official_copy_not_approved'
    )
  );

  return v_response_id;
end;
$$;

create or replace function public.admin_review_affiliate_information_attachment(
  p_attachment_id uuid,
  p_decision text,
  p_review_note text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_replacement_token_hash text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attachment public.affiliate_application_information_attachments%rowtype;
  v_request public.affiliate_application_information_requests%rowtype;
  v_application public.affiliate_applications%rowtype;
  v_event_id uuid;
  v_outbox_id uuid;
  v_note text := nullif(trim(p_review_note), '');
begin
  if p_decision not in ('accepted', 'replacement_requested')
    or (v_note is not null and length(v_note) > 1000)
    or (p_decision = 'replacement_requested' and v_note is null)
    or (
      p_decision = 'replacement_requested'
      and p_replacement_token_hash !~ '^[0-9a-f]{64}$'
    )
  then
    raise exception 'Invalid attachment review' using errcode = '22023';
  end if;

  select * into v_attachment
  from public.affiliate_application_information_attachments
  where id = p_attachment_id
  for update;
  if not found or v_attachment.status <> 'uploaded' then
    raise exception 'Attachment unavailable' using errcode = 'P0002';
  end if;

  select * into v_request
  from public.affiliate_application_information_requests
  where id = v_attachment.request_id
  for update;
  select * into v_application
  from public.affiliate_applications
  where id = v_attachment.application_id
  for update;

  update public.affiliate_application_information_attachments
  set status = p_decision,
      reviewed_at = now(),
      reviewed_by_user_id = p_actor_user_id,
      reviewed_by_email = lower(nullif(trim(p_actor_email), '')),
      review_note = v_note
  where id = v_attachment.id;

  insert into public.affiliate_application_audit_events (
    application_id, event_type, actor_user_id, actor_email, details
  ) values (
    v_attachment.application_id,
    case p_decision
      when 'accepted' then 'information_attachment_accepted'
      else 'information_attachment_replacement_requested'
    end,
    p_actor_user_id,
    lower(nullif(trim(p_actor_email), '')),
    jsonb_build_object(
      'information_request_id', v_request.id,
      'information_attachment_id', v_attachment.id,
      'version', v_attachment.version,
      'has_review_note', v_note is not null
    )
  )
  returning id into v_event_id;

  if p_decision = 'replacement_requested' then
    update public.affiliate_application_information_requests
    set status = 'open',
        responded_at = null,
        token_hash = p_replacement_token_hash,
        expires_at = greatest(expires_at, now() + interval '7 days')
    where id = v_request.id;

    if v_application.review_stage is distinct from 'follow_up_required'
      or v_application.status is distinct from 'pending_info'
    then
      update public.affiliate_applications
      set review_stage = 'follow_up_required', status = 'pending_info'
      where id = v_attachment.application_id;

      insert into public.application_stage_history (
        application_id, review_stage, status, changed_at
      ) values (
        v_attachment.application_id, 'follow_up_required', 'pending_info', now()
      );

      insert into public.affiliate_application_audit_events (
        application_id, event_type, actor_user_id, actor_email,
        from_review_stage, to_review_stage, from_status, to_status, details
      ) values (
        v_attachment.application_id, 'stage_changed',
        p_actor_user_id, lower(nullif(trim(p_actor_email), '')),
        v_application.review_stage, 'follow_up_required',
        v_application.status, 'pending_info',
        jsonb_build_object('source', 'attachment_replacement_request')
      );
    end if;

    insert into public.affiliate_application_notification_outbox (
      application_id, audit_event_id, notification_type, dedupe_key, delivery_status
    ) values (
      v_attachment.application_id,
      v_event_id,
      'more_information_required',
      v_attachment.application_id::text || ':' || v_request.id::text ||
        ':attachment_replacement:v' || v_attachment.version::text,
      'blocked_copy_pending'
    )
    returning id into v_outbox_id;

    insert into public.affiliate_application_audit_events (
      application_id, event_type, actor_user_id, actor_email, details
    ) values (
      v_attachment.application_id,
      'applicant_notification_requested',
      p_actor_user_id,
      lower(nullif(trim(p_actor_email), '')),
      jsonb_build_object(
        'information_request_id', v_request.id,
        'information_attachment_id', v_attachment.id,
        'notification_outbox_id', v_outbox_id,
        'notification_type', 'more_information_required',
        'delivery_status', 'blocked_copy_pending',
        'reason', 'official_copy_not_approved'
      )
    );
  end if;

  return v_attachment.application_id;
end;
$$;

revoke all on function public.create_affiliate_information_attachment_upload(
  text, uuid, text, text, text, bigint
) from public, anon, authenticated;
revoke all on function public.finalize_affiliate_information_attachment(text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_review_affiliate_information_attachment(
  uuid, text, text, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.create_affiliate_information_attachment_upload(
  text, uuid, text, text, text, bigint
) to service_role;
grant execute on function public.finalize_affiliate_information_attachment(text, uuid)
  to service_role;
grant execute on function public.admin_review_affiliate_information_attachment(
  uuid, text, text, uuid, text, text
) to service_role;
