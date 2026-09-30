-- Moderation audit log (20260929100100_moderation_log). Throwaway local Postgres
-- after every migration through it, after catch_rolls_smoke.sql (uses its c1/c2).
-- Never Supabase. Fails before 20260929100100 (no table).
\set ON_ERROR_STOP 1

-- The server writes after an action (service role).
INSERT INTO moderation_log (actor_id, action, item_kind, item_id, target_id, excerpt)
VALUES ('00000000-0000-4000-8000-0000000000c1', 'remove_mute', 'letter', 'note-1', '00000000-0000-4000-8000-0000000000c2', 'rude');

-- ─── 1. T1/T2 read it; T3-T5 and anon see nothing; nobody writes, edits or deletes ─
BEGIN;
UPDATE profiles SET tier = 2 WHERE id = '00000000-0000-4000-8000-0000000000c1';
UPDATE profiles SET tier = 3 WHERE id = '00000000-0000-4000-8000-0000000000c2';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM moderation_log) = 1, 'a T2 reads the log';
  BEGIN
    UPDATE moderation_log SET excerpt = 'nothing happened';
    RAISE EXCEPTION 'a T2 edited the log';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM moderation_log;
    RAISE EXCEPTION 'a T2 deleted the log';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO moderation_log (actor_id, action, item_kind, target_id) VALUES ('00000000-0000-4000-8000-0000000000c1', 'unmute', 'member', '00000000-0000-4000-8000-0000000000c1');
    RAISE EXCEPTION 'a T2 forged an entry';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM moderation_log) = 0, 'a T3 reads nothing';
END $$;
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM moderation_log;
    RAISE EXCEPTION 'anon read the log';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'moderation log 1 T1/T2 read-only ok';
END $$;
ROLLBACK;

-- ─── 2. Only known actions and kinds ─────────────────────────────────────────
DO $$ BEGIN
  BEGIN
    INSERT INTO moderation_log (action, item_kind) VALUES ('ban', 'letter');
    RAISE EXCEPTION 'unknown action accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  ASSERT (SELECT action || '/' || item_kind || '/' || excerpt FROM moderation_log WHERE item_id = 'note-1') = 'remove_mute/letter/rude', 'entry kept';
  RAISE NOTICE 'moderation log 2 checks ok';
END $$;
