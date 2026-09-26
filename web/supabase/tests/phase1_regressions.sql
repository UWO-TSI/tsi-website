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
