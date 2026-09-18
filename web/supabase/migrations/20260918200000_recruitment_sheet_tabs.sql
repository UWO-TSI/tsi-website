-- Reviewer tabs in the recruitment workbook (David, 2026-09-18): one tab
-- per live role plus "All applicants", read by 15 PMs/VPs who discuss
-- applicants through Google Sheets comments. Comments anchor to cells, so
-- every application keeps a fixed row in each tab for life. Rows are
-- assigned once, in submission order, never reused. Archived rounds get no
-- reviewer rows (their master rows stay).
--
-- Idempotent: safe to re-run.

alter table public.recruitment_sheet_rows
  add column if not exists position_id uuid,
  add column if not exists tab_row bigint,
  add column if not exists all_row bigint;

create unique index if not exists recruitment_sheet_rows_tab_row
  on public.recruitment_sheet_rows (position_id, tab_row) where tab_row is not null;
create unique index if not exists recruitment_sheet_rows_all_row
  on public.recruitment_sheet_rows (all_row) where all_row is not null;

-- Assign reviewer rows for one queued application. Row 1 of every tab is the
-- header, so numbering starts at 2. Serialised per position with an advisory
-- lock; the unique indexes above are the backstop.
create or replace function private.assign_recruitment_tab_rows(p_application_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_position uuid;
  v_archived timestamptz;
begin
  select a.position_id, p.archived_at into v_position, v_archived
    from public.applications a join public.positions p on p.id = a.position_id
   where a.id = p_application_id;
  if v_position is null then return; end if;
  perform pg_advisory_xact_lock(hashtext('recruitment_sheet_tab_rows'));
  update public.recruitment_sheet_rows r
     set position_id = v_position,
         tab_row = case when v_archived is null and r.tab_row is null
                        then (select coalesce(max(x.tab_row), 1) + 1 from public.recruitment_sheet_rows x where x.position_id = v_position)
                        else r.tab_row end,
         all_row = case when v_archived is null and r.all_row is null
                        then (select coalesce(max(x.all_row), 1) + 1 from public.recruitment_sheet_rows x)
                        else r.all_row end
   where r.application_id = p_application_id;
end;
$$;
revoke all on function private.assign_recruitment_tab_rows(uuid) from public, anon, authenticated;

create or replace function private.queue_recruitment_tab_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assign_recruitment_tab_rows(new.application_id);
  return null;
end;
$$;
revoke all on function private.queue_recruitment_tab_rows() from public, anon, authenticated;
drop trigger if exists queue_recruitment_tab_rows on public.recruitment_sheet_rows;
create trigger queue_recruitment_tab_rows after insert on public.recruitment_sheet_rows
  for each row execute function private.queue_recruitment_tab_rows();

-- Backfill in submission order, live rounds only, then queue every row so the
-- worker writes the new tabs.
do $$
declare rec record;
begin
  for rec in
    select r.application_id from public.recruitment_sheet_rows r
      join public.applications a on a.id = r.application_id
      join public.positions p on p.id = a.position_id
     where r.tab_row is null and p.archived_at is null
     order by a.submitted_at, a.id
  loop
    perform private.assign_recruitment_tab_rows(rec.application_id);
  end loop;
end $$;
update public.recruitment_sheet_rows set version = version + 1, synced_at = null;
