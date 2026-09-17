-- Additive delivery infrastructure. Does not open/close roles or alter old applications.
create schema if not exists private;

create index if not exists idx_applications_review_order
  on public.applications (submitted_at desc, id desc);
create index if not exists idx_applications_user_recent
  on public.applications (user_id, submitted_at desc);

create table public.recruitment_sheet_state (
  id boolean primary key default true check (id),
  spreadsheet_id text,
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text
);
insert into public.recruitment_sheet_state (id) values (true);

-- Stable row numbers make a timed-out Google write safe to retry. Deleted
-- applications retain a tombstone until their former spreadsheet row is cleared.
create table public.recruitment_sheet_rows (
  application_id uuid primary key,
  sheet_row bigint generated always as identity (start with 2) unique,
  version bigint not null default 1,
  synced_at timestamptz
);
create index recruitment_sheet_pending on public.recruitment_sheet_rows (sheet_row)
  where synced_at is null;
alter table public.recruitment_sheet_state enable row level security;
alter table public.recruitment_sheet_rows enable row level security;
revoke all on public.recruitment_sheet_state, public.recruitment_sheet_rows from anon, authenticated;
grant all on public.recruitment_sheet_state, public.recruitment_sheet_rows to service_role;
grant usage, select on sequence public.recruitment_sheet_rows_sheet_row_seq to service_role;

create or replace function private.queue_recruitment_sheet() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.recruitment_sheet_rows (application_id)
  values (coalesce(new.id, old.id))
  on conflict (application_id) do update
    set version = public.recruitment_sheet_rows.version + 1, synced_at = null;
  return coalesce(new, old);
end;
$$;
revoke all on function private.queue_recruitment_sheet() from public, anon, authenticated;
create trigger queue_recruitment_sheet after insert or update or delete
  on public.applications for each row execute function private.queue_recruitment_sheet();

create or replace function private.queue_position_sheet() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.recruitment_sheet_rows r set version = r.version + 1, synced_at = null
  where r.application_id in (select a.id from public.applications a where a.position_id = new.id);
  return new;
end;
$$;
revoke all on function private.queue_position_sheet() from public, anon, authenticated;
create trigger queue_position_sheet after update on public.positions
  for each row execute function private.queue_position_sheet();

insert into public.recruitment_sheet_rows (application_id)
  select id from public.applications order by submitted_at, id;

-- A single server worker batches writes, including cold starts on separate instances.
create or replace function public.claim_recruitment_sheet(p_token uuid) returns boolean
language sql security invoker set search_path = '' as $$
  with claimed as (
    update public.recruitment_sheet_state
    set lease_token = p_token, lease_until = now() + interval '5 minutes'
    where id and (lease_until is null or lease_until < now()) and next_attempt_at <= now()
    returning id
  ) select exists(select 1 from claimed);
$$;
revoke all on function public.claim_recruitment_sheet(uuid) from public, anon, authenticated;
grant execute on function public.claim_recruitment_sheet(uuid) to service_role;

-- Enforce timing even when callers bypass the form and use the Data API.
create or replace function private.check_recruitment_open() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.positions p where p.id = new.position_id
      and p.is_active and p.archived_at is null
      and (p.opens_at is null or p.opens_at <= now())
      and (p.closes_at is null or p.closes_at > now())
  ) then
    raise exception 'This position is not accepting applications' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.check_recruitment_open() from public, anon, authenticated;
create trigger check_recruitment_open before insert on public.applications
  for each row execute function private.check_recruitment_open();

create or replace function public.ack_recruitment_sheet(p_rows jsonb) returns void
language sql security invoker set search_path = '' as $$
  update public.recruitment_sheet_rows r set synced_at = now()
  from jsonb_to_recordset(p_rows) as sent(application_id uuid, version bigint)
  where r.application_id = sent.application_id and r.version = sent.version;
$$;
revoke all on function public.ack_recruitment_sheet(jsonb) from public, anon, authenticated;
grant execute on function public.ack_recruitment_sheet(jsonb) to service_role;

-- All public submissions go through the validated server endpoint. Otherwise
-- authenticated Data API callers could supply their own verdict/tags/notes.
revoke insert on public.applications from anon, authenticated;

-- Existing objects stay intact; the new intake uses small PDF resumes.
-- Apply on Supabase, where the Storage schema is present.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets set file_size_limit = 2097152 where id = 'resumes';
  end if;
end $$;
