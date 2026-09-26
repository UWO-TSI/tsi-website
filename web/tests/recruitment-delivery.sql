\set ON_ERROR_STOP on
begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create table public.positions (id uuid primary key, is_active boolean, archived_at timestamptz, opens_at timestamptz, closes_at timestamptz, title text);
create table public.applications (id uuid primary key, user_id uuid, position_id uuid references public.positions, submitted_at timestamptz default now(), status text, unique(user_id,position_id));
\ir ../supabase/migrations/20260916040531_recruitment_delivery.sql
insert into positions values ('11111111-1111-4111-8111-111111111111',true,null,now()-interval '1 day',now()+interval '1 day','Developer');
insert into applications (id,user_id,position_id,status)
  select gen_random_uuid(),gen_random_uuid(),'11111111-1111-4111-8111-111111111111','screening' from generate_series(1,300);
do $$
declare a uuid; v bigint; n integer;
begin
  if (select count(*) from public.recruitment_sheet_rows) != 300 then raise exception 'lost application delivery'; end if;
  if (select count(distinct sheet_row) from public.recruitment_sheet_rows) != 300 then raise exception 'duplicate sheet rows'; end if;
  if not public.claim_recruitment_sheet('22222222-2222-4222-8222-222222222222') then raise exception 'claim failed'; end if;
  if public.claim_recruitment_sheet('33333333-3333-4333-8333-333333333333') then raise exception 'two workers claimed'; end if;
  select application_id,version into a,v from public.recruitment_sheet_rows limit 1;
  update public.applications set status='accepted' where id=a;
  perform public.ack_recruitment_sheet(jsonb_build_array(jsonb_build_object('application_id',a,'version',v)));
  if (select synced_at is not null from public.recruitment_sheet_rows where application_id=a) then raise exception 'racing edit lost'; end if;
  perform public.ack_recruitment_sheet(jsonb_build_array(jsonb_build_object('application_id',a,'version',v+1)));
  if (select synced_at is null from public.recruitment_sheet_rows where application_id=a) then raise exception 'ack failed'; end if;
  delete from public.applications where id=a;
  if not exists(select 1 from public.recruitment_sheet_rows where application_id=a and synced_at is null) then raise exception 'deletion tombstone lost'; end if;
  update public.positions set title='Developer revised';
  if exists(select 1 from public.recruitment_sheet_rows where synced_at is not null) then raise exception 'position edit not queued'; end if;
  begin
    insert into public.applications select * from public.applications limit 1;
    raise exception 'duplicate accepted';
  exception when unique_violation then null; end;
  update public.positions set closes_at=now();
  begin
    insert into public.applications (id,user_id,position_id) values (gen_random_uuid(),gen_random_uuid(),'11111111-1111-4111-8111-111111111111');
    raise exception 'closed position accepted';
  exception when check_violation then null; end;
  update public.positions set closes_at=null, archived_at=now();
  begin
    insert into public.applications (id,user_id,position_id) values (gen_random_uuid(),gen_random_uuid(),'11111111-1111-4111-8111-111111111111');
    raise exception 'archived position accepted';
  exception when check_violation then null; end;
  if has_table_privilege('authenticated','public.recruitment_sheet_rows','select') then raise exception 'queue exposed'; end if;
  if has_function_privilege('authenticated','public.claim_recruitment_sheet(uuid)','execute') then raise exception 'worker exposed'; end if;
  raise notice 'PASS: 300 inserts, unique rows, exclusive lease, racing edits, retries, tombstones, deadlines, archive, permissions';
end $$;
rollback;
