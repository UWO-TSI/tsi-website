-- ─── World friends: codes, requests and friendships (v1 "Arrival") ───────────
--
-- specs/v1-drop.md §3 (decided with David 2026-10-13): add a friend by clicking a player nearby or by their friend
-- code; requests and accepts; friends see where each other are and can join each other's shard. Apply after
-- 20261003190000_world_chat (world_blocks).
--
-- - world_friend_codes: one code per member, 8 characters from an alphabet without 0/O, 1/I/L (shown as ABCD-EFGH).
--   Made by /api/world/friends on first use (lib/world/friendCode.ts). A member reads only their own.
-- - world_friend_requests: from → to, one per direction. Either side reads theirs.
-- - world_friends: one row per pair (a_id < b_id). Either side reads theirs; the realtime server reads them with the
--   service role at join (realtime/src/sources.ts) and hears changes through POST /internal/friend.
-- - Writes go only through the service-role functions below (called by /api/world/friends), so the rules hold in one
--   place: no friending yourself, no request across a block (either way), at most WORLD_FRIENDS_MAX friends each,
--   WORLD_FRIEND_PENDING_MAX open requests out and WORLD_FRIEND_HOURLY new ones an hour; a request to someone who
--   already asked you is an accept.
-- - A block (world_blocks insert) ends the pair's friendship and requests, by trigger.
--
-- Member ids and world names only, never real names (row 222). Test: web/supabase/tests/world_friends_smoke.sql.
--
-- Rollback (SQL editor), in order:
--   drop trigger if exists world_blocks_end_friendship on world_blocks;
--   drop function if exists public.world_blocks_end_friendship(), public.world_friend_remove(uuid, uuid),
--     public.world_friend_accept(uuid, uuid), public.world_friend_request(uuid, uuid);
--   drop table if exists world_friends, world_friend_requests, world_friend_codes;

-- ─── Codes ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_friend_codes (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[2-9A-HJKMNP-Z]{8}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE world_friend_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON world_friend_codes FROM anon, authenticated;
GRANT SELECT ON world_friend_codes TO authenticated;
DROP POLICY IF EXISTS "Friend codes readable by their owner" ON world_friend_codes;
CREATE POLICY "Friend codes readable by their owner" ON world_friend_codes FOR SELECT TO authenticated
  USING (member_id = (select auth.uid()));

-- ─── Requests ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_friend_requests (
  from_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_id, to_id),
  CHECK (from_id <> to_id)
);
CREATE INDEX IF NOT EXISTS idx_world_friend_requests_to ON world_friend_requests (to_id, created_at DESC);
ALTER TABLE world_friend_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON world_friend_requests FROM anon, authenticated;
GRANT SELECT ON world_friend_requests TO authenticated;
DROP POLICY IF EXISTS "Friend requests readable by either side" ON world_friend_requests;
CREATE POLICY "Friend requests readable by either side" ON world_friend_requests FOR SELECT TO authenticated
  USING ((select auth.uid()) IN (from_id, to_id));

-- ─── Friendships ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_friends (
  a_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  b_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (a_id, b_id),
  CHECK (a_id < b_id)
);
CREATE INDEX IF NOT EXISTS idx_world_friends_b ON world_friends (b_id);
ALTER TABLE world_friends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON world_friends FROM anon, authenticated;
GRANT SELECT ON world_friends TO authenticated;
DROP POLICY IF EXISTS "Friendships readable by either side" ON world_friends;
CREATE POLICY "Friendships readable by either side" ON world_friends FOR SELECT TO authenticated
  USING ((select auth.uid()) IN (a_id, b_id));

-- ─── world_friend_request: ask, or accept when they asked first ──────────────
-- Returns 'requested', 'friends' (they had asked you: now friends), 'already_friends' or 'already_requested'.
-- Raises invalid (null or yourself), not_found (no such profile), blocked (a block either way), limit (friends,
-- open requests or the hourly count). Limits: 200 friends each (protocol FRIENDS_MAX), 30 open requests out, 20 new
-- requests an hour (lib/world/friends.ts mirrors them).
CREATE OR REPLACE FUNCTION public.world_friend_request(p_from UUID, p_to UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a UUID := LEAST(p_from, p_to);
  v_b UUID := GREATEST(p_from, p_to);
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN RAISE EXCEPTION 'invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_to) OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_from) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF EXISTS (SELECT 1 FROM world_blocks WHERE (blocker_id = p_from AND blocked_id = p_to) OR (blocker_id = p_to AND blocked_id = p_from)) THEN
    RAISE EXCEPTION 'blocked';
  END IF;
  IF EXISTS (SELECT 1 FROM world_friends WHERE a_id = v_a AND b_id = v_b) THEN RETURN 'already_friends'; END IF;
  -- They asked first: this is the accept.
  IF EXISTS (SELECT 1 FROM world_friend_requests WHERE from_id = p_to AND to_id = p_from) THEN
    IF (SELECT count(*) FROM world_friends WHERE p_from IN (a_id, b_id)) >= 200
       OR (SELECT count(*) FROM world_friends WHERE p_to IN (a_id, b_id)) >= 200 THEN RAISE EXCEPTION 'limit'; END IF;
    DELETE FROM world_friend_requests WHERE (from_id = p_to AND to_id = p_from) OR (from_id = p_from AND to_id = p_to);
    INSERT INTO world_friends (a_id, b_id) VALUES (v_a, v_b) ON CONFLICT DO NOTHING;
    RETURN 'friends';
  END IF;
  IF EXISTS (SELECT 1 FROM world_friend_requests WHERE from_id = p_from AND to_id = p_to) THEN RETURN 'already_requested'; END IF;
  IF (SELECT count(*) FROM world_friends WHERE p_from IN (a_id, b_id)) >= 200
     OR (SELECT count(*) FROM world_friend_requests WHERE from_id = p_from) >= 30
     OR (SELECT count(*) FROM world_friend_requests WHERE from_id = p_from AND created_at > NOW() - INTERVAL '1 hour') >= 20 THEN
    RAISE EXCEPTION 'limit';
  END IF;
  INSERT INTO world_friend_requests (from_id, to_id) VALUES (p_from, p_to);
  RETURN 'requested';
END;
$$;

-- ─── world_friend_accept: say yes to a request ───────────────────────────────
-- Returns 'friends' (or 'already_friends'). Raises not_found (no request from them), blocked, limit.
CREATE OR REPLACE FUNCTION public.world_friend_accept(p_me UUID, p_from UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_me IS NULL OR p_from IS NULL OR p_me = p_from THEN RAISE EXCEPTION 'invalid'; END IF;
  IF EXISTS (SELECT 1 FROM world_friends WHERE a_id = LEAST(p_me, p_from) AND b_id = GREATEST(p_me, p_from)) THEN
    DELETE FROM world_friend_requests WHERE (from_id = p_from AND to_id = p_me) OR (from_id = p_me AND to_id = p_from);
    RETURN 'already_friends';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM world_friend_requests WHERE from_id = p_from AND to_id = p_me) THEN RAISE EXCEPTION 'not_found'; END IF;
  -- A request between a blocked pair can't stand (the block's trigger ends them; this is belt and braces).
  IF EXISTS (SELECT 1 FROM world_blocks WHERE (blocker_id = p_me AND blocked_id = p_from) OR (blocker_id = p_from AND blocked_id = p_me)) THEN
    RAISE EXCEPTION 'blocked';
  END IF;
  IF (SELECT count(*) FROM world_friends WHERE p_me IN (a_id, b_id)) >= 200
     OR (SELECT count(*) FROM world_friends WHERE p_from IN (a_id, b_id)) >= 200 THEN RAISE EXCEPTION 'limit'; END IF;
  DELETE FROM world_friend_requests WHERE (from_id = p_from AND to_id = p_me) OR (from_id = p_me AND to_id = p_from);
  INSERT INTO world_friends (a_id, b_id) VALUES (LEAST(p_me, p_from), GREATEST(p_me, p_from)) ON CONFLICT DO NOTHING;
  RETURN 'friends';
END;
$$;

-- ─── world_friend_remove: unfriend, decline or cancel ────────────────────────
-- Everything between the pair goes: the friendship and requests both ways. Returns whether they were friends.
CREATE OR REPLACE FUNCTION public.world_friend_remove(p_me UUID, p_other UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_was BOOLEAN;
BEGIN
  IF p_me IS NULL OR p_other IS NULL OR p_me = p_other THEN RAISE EXCEPTION 'invalid'; END IF;
  DELETE FROM world_friends WHERE a_id = LEAST(p_me, p_other) AND b_id = GREATEST(p_me, p_other);
  v_was := FOUND;
  DELETE FROM world_friend_requests WHERE (from_id = p_me AND to_id = p_other) OR (from_id = p_other AND to_id = p_me);
  RETURN v_was;
END;
$$;

-- ─── A block ends the pair's friendship and requests ─────────────────────────
CREATE OR REPLACE FUNCTION public.world_blocks_end_friendship()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM world_friends WHERE a_id = LEAST(NEW.blocker_id, NEW.blocked_id) AND b_id = GREATEST(NEW.blocker_id, NEW.blocked_id);
  DELETE FROM world_friend_requests WHERE (from_id = NEW.blocker_id AND to_id = NEW.blocked_id) OR (from_id = NEW.blocked_id AND to_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS world_blocks_end_friendship ON world_blocks;
CREATE TRIGGER world_blocks_end_friendship AFTER INSERT ON world_blocks FOR EACH ROW EXECUTE FUNCTION public.world_blocks_end_friendship();

-- Service role only.
REVOKE ALL ON FUNCTION public.world_friend_request(UUID, UUID), public.world_friend_accept(UUID, UUID), public.world_friend_remove(UUID, UUID),
  public.world_blocks_end_friendship() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.world_friend_request(UUID, UUID), public.world_friend_accept(UUID, UUID), public.world_friend_remove(UUID, UUID)
  TO service_role;
