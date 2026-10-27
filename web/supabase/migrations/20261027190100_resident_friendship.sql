-- d-friends (specs/launch/v1-gameplay.md): resident friendship. The first talk of a Toronto day with a resident raises
-- your friendship with them a level, up to 5. Odd levels bring a letter from them (sent by the API with their name,
-- lib/npc/friendship.ts, keyed `friend:<slug>:<level>` so it lands once); even levels a small coin gift, paid here with
-- the level so it can't be lost or paid twice (friend_gift_coins x level / 2; the setting comes with the economy seed).

CREATE TABLE IF NOT EXISTS resident_friendships (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resident TEXT NOT NULL CHECK (char_length(resident) BETWEEN 1 AND 64),
  level INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
  last_day DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, resident)
);
ALTER TABLE resident_friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Friendships readable by owner" ON resident_friendships;
CREATE POLICY "Friendships readable by owner" ON resident_friendships FOR SELECT USING (member_id = (select auth.uid()));

-- The ledger sources for the friend gift and campfire hour's bonus (s-campfire, POST /api/world/campfire).
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_source_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_source_check CHECK (source IN (
  'study', 'sell', 'chapter', 'quest', 'daily_gift', 'event', 'admin', 'shop', 'room', 'goal', 'refund', 'migration', 'respec',
  'mission', 'repair', 'stat_reset', 'friend', 'campfire'));

CREATE OR REPLACE FUNCTION public.resident_friend_talk(p_member_id UUID, p_resident TEXT)
RETURNS TABLE (level INTEGER, leveled BOOLEAN, coins INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_day DATE := (NOW() AT TIME ZONE 'America/Toronto')::DATE;
  v_level INTEGER;
  v_coins INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM npc_personas p WHERE p.slug = p_resident AND p.active) THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO resident_friendships (member_id, resident) VALUES (p_member_id, p_resident) ON CONFLICT DO NOTHING;
  UPDATE resident_friendships f SET level = f.level + 1, last_day = v_day, updated_at = NOW()
  WHERE f.member_id = p_member_id AND f.resident = p_resident AND f.level < 5 AND f.last_day IS DISTINCT FROM v_day
  RETURNING f.level INTO v_level;
  IF NOT FOUND THEN
    SELECT f.level INTO v_level FROM resident_friendships f WHERE f.member_id = p_member_id AND f.resident = p_resident;
    RETURN QUERY SELECT v_level, FALSE, 0; RETURN;
  END IF;
  IF v_level % 2 = 0 THEN
    v_coins := COALESCE((SELECT value FROM economy_settings WHERE key = 'friend_gift_coins'), 50) * v_level / 2;
    IF v_coins > 0 THEN
      PERFORM public.wallet_apply(p_member_id, 'coins', v_coins, 'friend', p_resident, 'friend:' || p_resident || ':' || v_level);
    END IF;
  END IF;
  RETURN QUERY SELECT v_level, TRUE, v_coins;
END;
$$;

DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.resident_friend_talk(UUID, TEXT) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.resident_friend_talk(UUID, TEXT) TO service_role;
END $$;
