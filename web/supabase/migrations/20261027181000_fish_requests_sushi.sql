-- Fishing depth (specs/launch/v1-gameplay.md f-requests, f-sushi; specs/launch/sushi-bar.md phase B).
-- * The fish market's 3 requests a day and the sushi chef's order: the server picks the day's requests and each reward
--   (lib/wallet/rules.ts fishRequests, chefOrder); fish_request_fill takes one unlocked fish for a request once per
--   member per Toronto day and board and pays it as a 'quest' credit (ref fish_request:<item>, so the ledger's source
--   list stays as it is), plus the chef's staff meal.
-- * Meals at the sushi bar: sushi_order pays a dish's coins (a 'shop' debit) or one unlocked epic or legendary fish for
--   the feast, and sets the member's meal buff (member_buffs, one at a time: the last meal replaces it), which the
--   server's fishing casts read (lib/collections/rolls.ts fishRoll). The server prices dishes and buffs
--   (lib/wallet/catalogue.ts SUSHI_MENU); these functions run for the service role only.

CREATE TABLE IF NOT EXISTS fish_request_fills (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  board TEXT NOT NULL CHECK (board IN ('market', 'chef')),
  item_key TEXT NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 64),
  reward INTEGER NOT NULL CHECK (reward > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, day, board, item_key)
);
ALTER TABLE fish_request_fills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fish request fills readable by owner" ON fish_request_fills FOR SELECT USING ((select auth.uid()) = member_id);
REVOKE INSERT, UPDATE, DELETE ON fish_request_fills FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS member_buffs (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (char_length(source) BETWEEN 1 AND 64),
  luck NUMERIC(4, 2) NOT NULL CHECK (luck BETWEEN 0 AND 1),
  size NUMERIC(4, 2) NOT NULL CHECK (size BETWEEN 0 AND 1),
  until TIMESTAMPTZ NOT NULL
);
ALTER TABLE member_buffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Member buffs readable by owner" ON member_buffs FOR SELECT USING ((select auth.uid()) = member_id);
REVOKE INSERT, UPDATE, DELETE ON member_buffs FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS sushi_orders (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 6 AND 200),
  dish TEXT NOT NULL CHECK (char_length(dish) BETWEEN 1 AND 64),
  paid INTEGER NOT NULL CHECK (paid >= 0),
  fish_key TEXT,
  luck NUMERIC(4, 2) NOT NULL,
  size NUMERIC(4, 2) NOT NULL,
  until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, idempotency_key)
);
ALTER TABLE sushi_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sushi orders readable by owner" ON sushi_orders FOR SELECT USING ((select auth.uid()) = member_id);
REVOKE INSERT, UPDATE, DELETE ON sushi_orders FROM anon, authenticated;

-- One unlocked fish out of a member's collection; how many are left.
CREATE OR REPLACE FUNCTION public.collections_take_one(p_member_id UUID, p_item_key TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_have INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key AND mc.locked) THEN
    RAISE EXCEPTION 'locked';
  END IF;
  UPDATE member_collections mc SET count = mc.count - 1, updated_at = NOW()
   WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key AND mc.count >= 1
  RETURNING mc.count INTO v_have;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_items'; END IF;
  RETURN v_have;
END;
$$;

CREATE OR REPLACE FUNCTION public.fish_request_fill(p_member_id UUID, p_day DATE, p_board TEXT, p_item_key TEXT, p_reward INTEGER, p_idempotency_key TEXT,
  p_luck NUMERIC DEFAULT 0, p_size NUMERIC DEFAULT 0, p_until TIMESTAMPTZ DEFAULT NULL)
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
  IF EXISTS (SELECT 1 FROM fish_request_fills f WHERE f.member_id = p_member_id AND f.day = p_day AND f.board = p_board AND f.item_key = p_item_key) THEN
    RAISE EXCEPTION 'already_filled';
  END IF;
  v_have := public.collections_take_one(p_member_id, p_item_key);
  INSERT INTO fish_request_fills (member_id, day, board, item_key, reward) VALUES (p_member_id, p_day, p_board, p_item_key, p_reward);
  IF p_until IS NOT NULL THEN
    INSERT INTO member_buffs (member_id, source, luck, size, until) VALUES (p_member_id, 'staff_meal', p_luck, p_size, p_until)
    ON CONFLICT (member_id) DO UPDATE SET source = EXCLUDED.source, luck = EXCLUDED.luck, size = EXCLUDED.size, until = EXCLUDED.until;
  END IF;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', p_reward, 'quest', 'fish_request:' || p_item_key, v_key) a;
  RETURN QUERY SELECT v_bal, v_have, p_reward, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.sushi_order(p_member_id UUID, p_dish TEXT, p_price INTEGER, p_fish_key TEXT, p_luck NUMERIC, p_size NUMERIC, p_until TIMESTAMPTZ, p_idempotency_key TEXT)
RETURNS TABLE (balance INTEGER, paid INTEGER, source TEXT, luck NUMERIC, size NUMERIC, until TIMESTAMPTZ, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_bal INTEGER;
  o sushi_orders%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_member_id::TEXT || ':sushi:' || p_idempotency_key));
  SELECT * INTO o FROM sushi_orders s WHERE s.member_id = p_member_id AND s.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id;
    RETURN QUERY SELECT COALESCE(v_bal, 0), o.paid, o.dish, o.luck, o.size, o.until, TRUE; RETURN;
  END IF;
  IF p_price < 0 OR p_price > 5000 OR (p_price > 0) = (p_fish_key IS NOT NULL) THEN RAISE EXCEPTION 'bad_qty'; END IF;
  IF p_fish_key IS NOT NULL THEN
    PERFORM public.collections_take_one(p_member_id, p_fish_key);
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id;
  ELSE
    SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', -p_price, 'shop', 'sushi:' || p_dish, 'sushi:' || p_idempotency_key) a;
  END IF;
  INSERT INTO member_buffs (member_id, source, luck, size, until) VALUES (p_member_id, p_dish, p_luck, p_size, p_until)
  ON CONFLICT (member_id) DO UPDATE SET source = EXCLUDED.source, luck = EXCLUDED.luck, size = EXCLUDED.size, until = EXCLUDED.until;
  INSERT INTO sushi_orders (member_id, idempotency_key, dish, paid, fish_key, luck, size, until)
  VALUES (p_member_id, p_idempotency_key, p_dish, p_price, p_fish_key, p_luck, p_size, p_until);
  RETURN QUERY SELECT COALESCE(v_bal, 0), p_price, p_dish, p_luck, p_size, p_until, FALSE;
END;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['collections_take_one(uuid, text)',
    'fish_request_fill(uuid, date, text, text, integer, text, numeric, numeric, timestamptz)',
    'sushi_order(uuid, text, integer, text, numeric, numeric, timestamptz, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
