-- Regressions found running the game signed in against the staging project
-- (Phase 1, specs/evidence/phase1/). Each section failed before its fix.
-- Throwaway local Postgres after every migration (supabase_stub.sql first). Never Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000001a1', 'p1a@x');

-- ─── 1. System letters dedupe on (broadcast_key, recipient_id) (20260926155100) ─
-- The service sends ON CONFLICT (broadcast_key, recipient_id); the partial index refused it (42P10).
INSERT INTO letters (kind, recipient_id, subject, body, broadcast_key)
VALUES ('system', '00000000-0000-4000-8000-0000000001a1', 'Settle in', 'Welcome home.', 'chapter:settle-in')
ON CONFLICT (broadcast_key, recipient_id) DO NOTHING;
INSERT INTO letters (kind, recipient_id, subject, body, broadcast_key)
VALUES ('system', '00000000-0000-4000-8000-0000000001a1', 'Settle in', 'Welcome home.', 'chapter:settle-in')
ON CONFLICT (broadcast_key, recipient_id) DO NOTHING;
INSERT INTO letters (kind, sender_id, recipient_id, body) VALUES
  ('note', '00000000-0000-4000-8000-0000000001a1', '00000000-0000-4000-8000-0000000001a1', 'one'),
  ('note', '00000000-0000-4000-8000-0000000001a1', '00000000-0000-4000-8000-0000000001a1', 'two');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM letters WHERE broadcast_key = 'chapter:settle-in') = 1, 'system letter sent twice';
  ASSERT (SELECT count(*) FROM letters WHERE kind = 'note') = 2, 'notes without a key must not collide';
  RAISE NOTICE 'phase1 1 letters ok';
END $$;

-- ─── 2. Members RSVP; they can't check themselves in (20260926155200) ────────
INSERT INTO events (id, title, event_type, start_time, is_irl)
VALUES ('00000000-0000-4000-8000-0000000001e1', 'Phase 1 IRL event', 'club', NOW(), TRUE);
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000001a1","role":"authenticated"}';
DO $$ BEGIN
  INSERT INTO event_attendance (event_id, user_id, status)
  VALUES ('00000000-0000-4000-8000-0000000001e1', '00000000-0000-4000-8000-0000000001a1', 'attended');
  RAISE EXCEPTION 'member checked themselves in';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
INSERT INTO event_attendance (event_id, user_id, status)
VALUES ('00000000-0000-4000-8000-0000000001e1', '00000000-0000-4000-8000-0000000001a1', 'registered');
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM combat_xp_ledger WHERE member_id = '00000000-0000-4000-8000-0000000001a1'), 'event XP paid';
  ASSERT NOT EXISTS (SELECT 1 FROM wallet_ledger WHERE member_id = '00000000-0000-4000-8000-0000000001a1'), 'event coins paid';
  ASSERT (SELECT status FROM event_attendance WHERE user_id = '00000000-0000-4000-8000-0000000001a1') = 'registered', 'RSVP refused';
  RAISE NOTICE 'phase1 2 attendance ok';
END $$;
ROLLBACK;

-- ─── 3. Invite codes are checked, never listed (20260926155300) ──────────────
BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM invite_codes), 'anon can list invite codes';
  ASSERT invite_code_valid(' tethos-w26 '), 'active code not accepted';
  ASSERT NOT invite_code_valid('NOPE-00'), 'unknown code accepted';
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000001a1","role":"authenticated"}';
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM invite_codes), 'signed-in users can list invite codes';
  RAISE NOTICE 'phase1 3 invite codes ok';
END $$;
ROLLBACK;
