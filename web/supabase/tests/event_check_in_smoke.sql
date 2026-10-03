-- Event check-in (specs/polish/portal-bugs.md #26). Throwaway local Postgres after
-- every migration (supabase_stub.sql first). Never Supabase. Section 1 failed
-- before 20261003080000; section 2 holds the trigger path the route relies on.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-00000000c1a1', 'checkin-a@x'),
  ('00000000-0000-4000-8000-00000000c1a2', 'checkin-b@x');
INSERT INTO events (id, title, event_type, start_time, is_irl, qr_check_in_code) VALUES
  ('00000000-0000-4000-8000-00000000c1e1', 'Check-in social', 'social', NOW(), TRUE, '00000000-0000-4000-8000-00000000c1c1');

-- ─── 1. Members read the event, never its check-in code (20261003080000) ─────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000c1a1","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT title FROM events WHERE id = '00000000-0000-4000-8000-00000000c1e1') = 'Check-in social', 'members lost the event';
  BEGIN
    PERFORM qr_check_in_code FROM events;
    RAISE EXCEPTION 'members can read the check-in code';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'check-in 1 code hidden ok';
END $$;
ROLLBACK;

-- ─── 2. The route's writes pay the event's coins and XP once ────────────────
-- A first scan inserts 'attended'; an RSVP becomes 'attended'; a rescan's
-- update (status <> 'attended') touches nothing.
BEGIN;
SET LOCAL ROLE service_role;
INSERT INTO event_attendance (event_id, user_id, status) VALUES
  ('00000000-0000-4000-8000-00000000c1e1', '00000000-0000-4000-8000-00000000c1a1', 'attended'),
  ('00000000-0000-4000-8000-00000000c1e1', '00000000-0000-4000-8000-00000000c1a2', 'registered');
UPDATE event_attendance SET status = 'attended'
  WHERE event_id = '00000000-0000-4000-8000-00000000c1e1' AND user_id = '00000000-0000-4000-8000-00000000c1a2' AND status <> 'attended';
UPDATE event_attendance SET status = 'attended'
  WHERE event_id = '00000000-0000-4000-8000-00000000c1e1' AND status <> 'attended';
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM event_attendance WHERE event_id = '00000000-0000-4000-8000-00000000c1e1' AND status = 'attended') = 2, 'both checked in';
  ASSERT (SELECT count(*) FROM wallet_ledger WHERE member_id = '00000000-0000-4000-8000-00000000c1a1' AND source = 'event') = 1, 'scan: coins once';
  ASSERT (SELECT count(*) FROM wallet_ledger WHERE member_id = '00000000-0000-4000-8000-00000000c1a2' AND source = 'event') = 1, 'RSVP then scan: coins once';
  ASSERT (SELECT count(*) FROM combat_xp_ledger WHERE member_id = '00000000-0000-4000-8000-00000000c1a1') = 1, 'scan: XP once';
  ASSERT (SELECT count(*) FROM combat_xp_ledger WHERE member_id = '00000000-0000-4000-8000-00000000c1a2') = 1, 'RSVP then scan: XP once';
  RAISE NOTICE 'check-in 2 pays once ok';
END $$;
ROLLBACK;
