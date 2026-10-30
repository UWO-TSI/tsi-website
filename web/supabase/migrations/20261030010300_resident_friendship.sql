-- d-friends (specs/launch/v1-gameplay.md; David 2026-10-28: "make it half a heart and like giving them stuff ... gifts
-- increase a heart, non like stuff no increase, ok like half heart, and hate -1 heart"): resident friendship in half
-- hearts, `level` 0 to 10 (five hearts). The first talk of a Toronto day with a resident adds half a heart; one gift a
-- day per resident moves it by its taste (the API judges it from the roster, lib/npc/friendship.ts giftTaste): loved +1
-- heart, liked +1/2, neither 0, hated -1, never below none. Each whole heart reached brings a reward once: odd hearts a
-- letter from them (sent by the API with their name, keyed `friend:<slug>:<heart>`), even hearts a small coin gift paid
-- here (friend_gift_coins x heart / 2, its ledger key once per heart), so a heart lost and won back pays nothing twice.

CREATE TABLE IF NOT EXISTS resident_friendships (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resident TEXT NOT NULL CHECK (char_length(resident) BETWEEN 1 AND 64),
  level INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 10),
  last_day DATE,
  last_gift_day DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, resident)
);
ALTER TABLE resident_friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Friendships readable by owner" ON resident_friendships;
CREATE POLICY "Friendships readable by owner" ON resident_friendships FOR SELECT USING (member_id = (select auth.uid()));

-- The ledger sources for the friend gift and campfire hour's bonus (s-campfire, POST /api/world/campfire).
-- The union of whatever the list holds now (other migrations widen it too) and these, so a re-run never narrows it.
DO $$
DECLARE v TEXT[];
BEGIN
  SELECT array_agg(DISTINCT m[1]) INTO v FROM pg_constraint k, regexp_matches(pg_get_constraintdef(k.oid), '''([^'']+)''', 'g') m
  WHERE k.conrelid = 'public.wallet_ledger'::regclass AND k.contype = 'c' AND pg_get_constraintdef(k.oid) LIKE '%source%' AND pg_get_constraintdef(k.oid) LIKE '%''study''%';
  v := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(v, '{}') || ARRAY[
    'study', 'sell', 'chapter', 'quest', 'daily_gift', 'event', 'admin', 'shop', 'room', 'goal', 'refund', 'migration', 'respec',
    'mission', 'repair', 'stat_reset', 'friend', 'campfire']) x ORDER BY x);
  ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_source_check;
  EXECUTE format('ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_source_check CHECK (source IN (%s))', (SELECT string_agg(quote_literal(x), ', ') FROM unnest(v) x));
END $$;

-- Moves a friendship by p_delta half hearts (clamped to 0..10) and pays the even hearts it newly reaches. Internal.
CREATE OR REPLACE FUNCTION public.resident_friend_move(p_member_id UUID, p_resident TEXT, p_delta INTEGER)
RETURNS TABLE (was INTEGER, level INTEGER, coins INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_was INTEGER;
  v_level INTEGER;
  v_coins INTEGER := 0;
  v_per INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'friend_gift_coins'), 50);
  v_paid RECORD;
BEGIN
  SELECT f.level INTO v_was FROM resident_friendships f WHERE f.member_id = p_member_id AND f.resident = p_resident FOR UPDATE;
  v_level := GREATEST(0, LEAST(10, v_was + p_delta));
  UPDATE resident_friendships f SET level = v_level, updated_at = NOW() WHERE f.member_id = p_member_id AND f.resident = p_resident;
  FOR h IN (v_was / 2 + 1)..(v_level / 2) LOOP
    IF h % 2 = 0 AND v_per > 0 THEN
      SELECT * INTO v_paid FROM public.wallet_apply(p_member_id, 'coins', v_per * h / 2, 'friend', p_resident, 'friend:' || p_resident || ':' || h);
      IF NOT v_paid.replayed THEN v_coins := v_coins + v_per * h / 2; END IF;
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_was, v_level, v_coins;
END;
$$;

-- The day's first talk with a resident: half a heart.
DROP FUNCTION IF EXISTS public.resident_friend_talk(UUID, TEXT);
CREATE FUNCTION public.resident_friend_talk(p_member_id UUID, p_resident TEXT)
RETURNS TABLE (was INTEGER, level INTEGER, coins INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_day DATE := (NOW() AT TIME ZONE 'America/Toronto')::DATE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM npc_personas p WHERE p.slug = p_resident AND p.active) THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO resident_friendships (member_id, resident) VALUES (p_member_id, p_resident) ON CONFLICT DO NOTHING;
  UPDATE resident_friendships f SET last_day = v_day WHERE f.member_id = p_member_id AND f.resident = p_resident AND f.last_day IS DISTINCT FROM v_day;
  IF NOT FOUND THEN
    RETURN QUERY SELECT f.level, f.level, 0 FROM resident_friendships f WHERE f.member_id = p_member_id AND f.resident = p_resident; RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.resident_friend_move(p_member_id, p_resident, 1);
END;
$$;

-- A gift (one a day per resident): one of the item leaves your bag (never a locked one), and the friendship moves by
-- p_delta half hearts (the API's judgement of the resident's taste: 2, 1, 0 or -2).
CREATE OR REPLACE FUNCTION public.resident_friend_gift(p_member_id UUID, p_resident TEXT, p_item_key TEXT, p_delta INTEGER)
RETURNS TABLE (was INTEGER, level INTEGER, coins INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_day DATE := (NOW() AT TIME ZONE 'America/Toronto')::DATE;
BEGIN
  IF p_delta NOT IN (-2, 0, 1, 2) THEN RAISE EXCEPTION 'bad_delta'; END IF;
  IF NOT EXISTS (SELECT 1 FROM npc_personas p WHERE p.slug = p_resident AND p.active) THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO resident_friendships (member_id, resident) VALUES (p_member_id, p_resident) ON CONFLICT DO NOTHING;
  UPDATE resident_friendships f SET last_gift_day = v_day WHERE f.member_id = p_member_id AND f.resident = p_resident AND f.last_gift_day IS DISTINCT FROM v_day;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift_done'; END IF;
  UPDATE member_collections SET count = count - 1, updated_at = NOW()
   WHERE user_id = p_member_id AND item_key = p_item_key AND count >= 1 AND NOT locked;
  IF NOT FOUND THEN RAISE EXCEPTION 'none_left'; END IF;
  RETURN QUERY SELECT * FROM public.resident_friend_move(p_member_id, p_resident, p_delta);
END;
$$;

DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.resident_friend_move(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
  REVOKE ALL ON FUNCTION public.resident_friend_talk(UUID, TEXT) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.resident_friend_talk(UUID, TEXT) TO service_role;
  REVOKE ALL ON FUNCTION public.resident_friend_gift(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.resident_friend_gift(UUID, TEXT, TEXT, INTEGER) TO service_role;
END $$;
