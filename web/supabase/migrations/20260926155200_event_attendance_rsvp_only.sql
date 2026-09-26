-- ─── event_attendance: members RSVP, only the server checks them in ─────────
--
-- DRAFT 2026-09-26. NOT APPLIED. Apply after 20260926150800_combat.
-- Found in Phase 1 on staging: 001's "Event attendance insertable" only checks
-- user_id = auth.uid(), so a member could insert their own row as 'attended'
-- with the public key. From 150600/150800 on, that insert pays event coins,
-- 2,000 combat XP and club-goal event points: in-person attendance, the one
-- XP source members can't farm online, was self-service. RSVP (the only
-- member write, app/api/events/[id]/rsvp) inserts 'registered'; check-in is
-- a server write.
-- Test: web/supabase/tests/phase1_regressions.sql section 2.

alter policy "Event attendance insertable" on public.event_attendance
  with check (user_id = auth.uid() and status = 'registered');
