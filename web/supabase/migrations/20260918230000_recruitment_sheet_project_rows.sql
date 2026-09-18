-- Project tabs (David, 2026-09-18): one tab per developer project listing the
-- applicants who ranked it in their top 3, so each PM sees their own pool.
-- Fixed rows per (project, application), assigned once at queue time from the
-- application's picks; picks never change after submission.
--
-- Idempotent: safe to re-run.

create table if not exists public.recruitment_sheet_project_rows (
  application_id uuid not null,
  project text not null,
  project_row bigint not null,
  primary key (application_id, project),
  unique (project, project_row)
);
alter table public.recruitment_sheet_project_rows enable row level security;
revoke all on public.recruitment_sheet_project_rows from anon, authenticated;
grant all on public.recruitment_sheet_project_rows to service_role;

create or replace function private.assign_recruitment_tab_rows(p_application_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_position uuid;
  v_archived timestamptz;
  v_pick record;
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
  if v_archived is null then
    -- Picks are stored as "Partner (Project title)"; the partner is the key.
    for v_pick in
      select distinct split_part(e->>'answer', ' (', 1) as partner
        from public.applications a, jsonb_array_elements(a.essay_answers) e
       where a.id = p_application_id
         and e->>'question_id' in ('__project_choice_1', '__project_choice_2', '__project_choice_3')
         and coalesce(e->>'answer', '') <> ''
    loop
      insert into public.recruitment_sheet_project_rows (application_id, project, project_row)
      values (p_application_id, v_pick.partner,
              (select coalesce(max(x.project_row), 1) + 1 from public.recruitment_sheet_project_rows x where x.project = v_pick.partner))
      on conflict (application_id, project) do nothing;
    end loop;
  end if;
end;
$$;
revoke all on function private.assign_recruitment_tab_rows(uuid) from public, anon, authenticated;

-- Backfill (existing rows keep their tab_row/all_row; only project rows are new), then re-queue.
do $$
declare rec record;
begin
  for rec in
    select r.application_id from public.recruitment_sheet_rows r
      join public.applications a on a.id = r.application_id
      join public.positions p on p.id = a.position_id
     where p.archived_at is null
     order by a.submitted_at, a.id
  loop
    perform private.assign_recruitment_tab_rows(rec.application_id);
  end loop;
end $$;
update public.recruitment_sheet_rows set version = version + 1, synced_at = null;
