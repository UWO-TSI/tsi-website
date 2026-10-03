-- ─── events.qr_check_in_code: only the server reads it ──────────────────────
--
-- The door QR (/student/check-in?event=&code=, POST /api/events/:id/check-in) is
-- the proof a member was at an in-person event: the one XP source that can't be
-- earned online (rows 11, 23). Every signed-in account could read every event's
-- code (`select qr_check_in_code from events` with the public key, or
-- GET /api/events, which returned *), so anyone could check in from home.
-- Members keep every other column; the check-in route and the T1/T2 QR route
-- (GET /api/events/:id/check-in) read the code as service_role.
--
-- Apply AFTER the matching app code is deployed: the old /api/events and the old
-- event editor read events.* with the user's key, which fails once this is in.
-- The new code works with or without this migration. Column list built from the
-- live table, so it also covers columns production has that the files don't.
-- Test: web/supabase/tests/event_check_in_smoke.sql.
--
-- Rollback (SQL editor): grant select on public.events to anon, authenticated;

revoke select on public.events from anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'events'
    and column_name <> 'qr_check_in_code';
  execute format('grant select (%s) on public.events to authenticated', cols);
end;
$$;
