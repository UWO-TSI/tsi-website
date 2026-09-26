-- Launch-readiness fixes (specs/launch-readiness-fixes.md). Throwaway local
-- Postgres after every migration, with pre_launch_seed.sql applied before
-- 20260926190000. Never Supabase. Each section failed before its migration.
\set ON_ERROR_STOP 1

-- ─── 1. Existing profiles: public unless staff, hired or whitelisted; public is T5 (190000) ─
DO $$ BEGIN
  ASSERT (SELECT membership || '/' || tier FROM profiles WHERE id = '00000000-0000-4000-8000-0000000001f1') = 'member/3', 'staff stays a member at T3';
  ASSERT (SELECT membership || '/' || tier FROM profiles WHERE id = '00000000-0000-4000-8000-0000000001f2') = 'member/4', 'hired applicant stays a member at T4';
  ASSERT (SELECT membership || '/' || tier FROM profiles WHERE id = '00000000-0000-4000-8000-0000000001f3') = 'public/5', 'unreleased verdict is not hired';
  ASSERT (SELECT membership || '/' || tier FROM profiles WHERE id = '00000000-0000-4000-8000-0000000001f4') = 'member/4', 'whitelisted stays a member';
  ASSERT (SELECT membership || '/' || tier FROM profiles WHERE id = '00000000-0000-4000-8000-0000000001f5') = 'public/5', 'plain account becomes public T5';
  RAISE NOTICE 'launch 1 membership backfill ok';
END $$;

-- ─── 2. Sign-ups: public T5 unless whitelisted or an active invite code (190000) ─
BEGIN;
INSERT INTO invite_codes (code, term, is_active) VALUES ('LAUNCH-01', 'Fall 2026', TRUE), ('OLD-00', 'W26', FALSE);
INSERT INTO member_email_whitelist (email) VALUES ('lf-new-listed@x');
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000002f1', 'lf-new-code@x', '{"invite_code":" launch-01 "}'),
  ('00000000-0000-4000-8000-0000000002f2', 'lf-new-old@x', '{"invite_code":"OLD-00"}'),
  ('00000000-0000-4000-8000-0000000002f3', 'lf-new-plain@x', '{"full_name":"Grace Hopper"}'),
  ('00000000-0000-4000-8000-0000000002f4', 'LF-New-Listed@x', '{}');
DO $$ BEGIN
  ASSERT (SELECT membership || '/' || tier FROM profiles WHERE id = '00000000-0000-4000-8000-0000000002f1') = 'member/4', 'invite code sign-up is a T4 member';
  ASSERT (SELECT membership || '/' || tier FROM profiles WHERE id = '00000000-0000-4000-8000-0000000002f2') = 'public/5', 'inactive code sign-up is public T5';
  ASSERT (SELECT membership || '/' || tier || '/' || display_name FROM profiles WHERE id = '00000000-0000-4000-8000-0000000002f3') = 'public/5/Grace Hopper', 'plain sign-up is public T5 (name fallback kept)';
  ASSERT (SELECT membership || '/' || tier FROM profiles WHERE id = '00000000-0000-4000-8000-0000000002f4') = 'member/4', 'whitelisted sign-up is a T4 member';
  RAISE NOTICE 'launch 2 sign-up tiers ok';
END $$;
ROLLBACK;

-- ─── 3. T1/T2 mark members (190000, POST /api/admin/members/:id/membership) ──
BEGIN;
UPDATE profiles SET tier = 2 WHERE id = '00000000-0000-4000-8000-0000000001f4';
DO $$
DECLARE r RECORD;
BEGIN
  BEGIN
    PERFORM admin_set_membership('00000000-0000-4000-8000-0000000001f2', '00000000-0000-4000-8000-0000000001f5', 'member');
    RAISE EXCEPTION 'a T4 marked a member';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'forbidden', SQLERRM;
  END;
  BEGIN
    PERFORM admin_set_membership('00000000-0000-4000-8000-0000000000ff', '00000000-0000-4000-8000-0000000001f5', 'member');
    RAISE EXCEPTION 'an unknown actor marked a member';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'forbidden', SQLERRM;
  END;
  SELECT * INTO r FROM admin_set_membership('00000000-0000-4000-8000-0000000001f4', '00000000-0000-4000-8000-0000000001f5', 'member');
  ASSERT r.membership || '/' || r.tier = 'member/4', 'public T5 marked member becomes T4';
  SELECT * INTO r FROM admin_set_membership('00000000-0000-4000-8000-0000000001f4', '00000000-0000-4000-8000-0000000001f5', 'member');
  ASSERT r.membership || '/' || r.tier = 'member/4', 'replay is a no-op';
  SELECT * INTO r FROM admin_set_membership('00000000-0000-4000-8000-0000000001f4', '00000000-0000-4000-8000-0000000001f2', 'public');
  ASSERT r.membership || '/' || r.tier = 'public/5', 'member marked public becomes T5';
  ASSERT (SELECT badge FROM member_badges WHERE member_id = '00000000-0000-4000-8000-0000000001f2') IS NULL, 'badge follows membership';
  BEGIN
    PERFORM admin_set_membership('00000000-0000-4000-8000-0000000001f4', '00000000-0000-4000-8000-0000000001f1', 'public');
    RAISE EXCEPTION 'staff made public';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'staff', SQLERRM;
  END;
  BEGIN
    PERFORM admin_set_membership('00000000-0000-4000-8000-0000000001f4', '00000000-0000-4000-8000-0000000009ff', 'public');
    RAISE EXCEPTION 'unknown member';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', SQLERRM;
  END;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000001f4","role":"authenticated"}';
DO $$ BEGIN
  PERFORM admin_set_membership('00000000-0000-4000-8000-0000000001f4', '00000000-0000-4000-8000-0000000001f3', 'member');
  RAISE EXCEPTION 'admin_set_membership callable with a user key';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'launch 3 admin membership ok';
END $$;
ROLLBACK;

-- ─── 4. Members cancel their own RSVP, not a check-in or someone else's (190100) ─
INSERT INTO events (id, title, event_type, start_time, is_irl)
VALUES ('00000000-0000-4000-8000-0000000002e1', 'Launch RSVP event', 'club', NOW(), TRUE);
INSERT INTO event_attendance (event_id, user_id, status) VALUES
  ('00000000-0000-4000-8000-0000000002e1', '00000000-0000-4000-8000-0000000001f2', 'attended'),
  ('00000000-0000-4000-8000-0000000002e1', '00000000-0000-4000-8000-0000000001f4', 'registered');
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000001f5","role":"authenticated"}';
INSERT INTO event_attendance (event_id, user_id, status) VALUES ('00000000-0000-4000-8000-0000000002e1', '00000000-0000-4000-8000-0000000001f5', 'registered');
DELETE FROM event_attendance WHERE user_id = '00000000-0000-4000-8000-0000000001f4';
DELETE FROM event_attendance WHERE event_id = '00000000-0000-4000-8000-0000000002e1' AND user_id = '00000000-0000-4000-8000-0000000001f5';
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000001f2","role":"authenticated"}';
DELETE FROM event_attendance WHERE user_id = '00000000-0000-4000-8000-0000000001f2';
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM event_attendance WHERE user_id = '00000000-0000-4000-8000-0000000001f5'), 'un-RSVP left the row';
  ASSERT EXISTS (SELECT 1 FROM event_attendance WHERE user_id = '00000000-0000-4000-8000-0000000001f4'), 'deleted someone else''s RSVP';
  ASSERT EXISTS (SELECT 1 FROM event_attendance WHERE user_id = '00000000-0000-4000-8000-0000000001f2' AND status = 'attended'), 'deleted own check-in';
  RAISE NOTICE 'launch 4 un-RSVP ok';
END $$;
ROLLBACK;
