-- f-requests (specs/launch/v1-gameplay.md): the fish market's 3 requests a day. The server picks the day's requests
-- and each reward (lib/wallet/rules.ts fishRequests: FISH_REQUEST_PAY times the fish's sell price); this function
-- takes one unlocked fish for a request once per member per Toronto day and pays the reward, atomically, once per key.
-- Paid as a 'quest' credit (ref fish_request:<item>), so the ledger's source list stays as it is.

CREATE TABLE IF NOT EXISTS fish_request_fills (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  item_key TEXT NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 64),
  reward INTEGER NOT NULL CHECK (reward > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, day, item_key)
);
ALTER TABLE fish_request_fills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fish request fills readable by owner" ON fish_request_fills FOR SELECT USING ((select auth.uid()) = member_id);
REVOKE INSERT, UPDATE, DELETE ON fish_request_fills FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.fish_request_fill(p_member_id UUID, p_day DATE, p_item_key TEXT, p_reward INTEGER, p_idempotency_key TEXT)
RETURNS TABLE (balance INTEGER, remaining INTEGER, paid INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_have INTEGER;
  v_bal INTEGER;
  v_key TEXT := 'fish_request:' || p_idempotency_key;
BEGIN
  -- One lock per member and day: a retry and a second key for the same request queue behind each other.
  PERFORM pg_advisory_xact_lock(hashtext(p_member_id::TEXT || ':fish_request:' || p_day::TEXT));
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE member_id = p_member_id AND idempotency_key = v_key) THEN
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id;
    SELECT mc.count INTO v_have FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key;
    RETURN QUERY SELECT v_bal, COALESCE(v_have, 0), (SELECT amount FROM wallet_ledger WHERE member_id = p_member_id AND idempotency_key = v_key), TRUE; RETURN;
  END IF;
  IF p_reward < 1 OR p_reward > 5000 THEN RAISE EXCEPTION 'bad_qty'; END IF;
  IF EXISTS (SELECT 1 FROM fish_request_fills f WHERE f.member_id = p_member_id AND f.day = p_day AND f.item_key = p_item_key) THEN
    RAISE EXCEPTION 'already_filled';
  END IF;
  IF EXISTS (SELECT 1 FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key AND mc.locked) THEN
    RAISE EXCEPTION 'locked';
  END IF;
  UPDATE member_collections mc SET count = mc.count - 1, updated_at = NOW()
   WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key AND mc.count >= 1
  RETURNING mc.count INTO v_have;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_items'; END IF;
  INSERT INTO fish_request_fills (member_id, day, item_key, reward) VALUES (p_member_id, p_day, p_item_key, p_reward);
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', p_reward, 'quest', 'fish_request:' || p_item_key, v_key) a;
  RETURN QUERY SELECT v_bal, v_have, p_reward, FALSE;
END;
$$;
REVOKE ALL ON FUNCTION public.fish_request_fill(UUID, DATE, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fish_request_fill(UUID, DATE, TEXT, INTEGER, TEXT) TO service_role;
