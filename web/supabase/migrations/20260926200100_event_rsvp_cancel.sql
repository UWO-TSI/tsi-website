-- ─── event_attendance: members cancel their own RSVP (coordinator ruling 7) ─
--
-- /api/events/[id]/rsvp deletes the caller's row with the user key, but no
-- delete policy exists in production (008 never ran there; 155000 drops it
-- from fresh replays), so un-RSVP answered success and the row stayed.
-- Only a 'registered' row: a check-in ('attended', a server write since
-- 155200) stays on record.
-- Test: web/supabase/tests/launch_fixes_smoke.sql section 4.

drop policy if exists "Users can cancel own RSVP" on public.event_attendance;
create policy "Users can cancel own RSVP" on public.event_attendance
  for delete using (user_id = (select auth.uid()) and status = 'registered');
