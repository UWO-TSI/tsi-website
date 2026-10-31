-- Fishing depth (specs/launch/v1-gameplay.md f-requests, f-records, f-sushi; specs/launch/sushi-bar.md phase B; David's
-- review 2026-10-28). Not applied before; replaces the unapplied 20261027181000_fish_requests_sushi.sql.
-- * Fishing tasks (David: "its not a hand one over, its if you did it you claim it"): the server picks each Toronto day's
--   and week's tasks and rewards (lib/wallet/rules.ts fishingTasks); fishing_task_claim checks the task is done from the
--   member's own landed catches (a rod cast landed today in catch_rolls; this week's weekly_catch_bests) and pays it once
--   per period as a 'quest' credit. Nothing is taken from the bag.
-- * The sushi chef's order still takes the fish: chef_order_fill, once per member per day, pays coins and the staff meal.
-- * The fish market's monthly board (David: "a place to put your fish to monthly leaderboard"): monthly_fish_enter puts
--   one of a fish the member landed this month on the board (it leaves the bag) at the biggest size they caught it this
--   month; a bigger one later replaces their entry.
-- * Meals at the sushi bar: sushi_order pays a dish's coins (a 'shop' debit) or one unlocked epic or legendary fish for
--   the feast, and sets the member's meal buff (member_buffs, one at a time: the last meal replaces it), which the
--   server's fishing casts read (lib/collections/rolls.ts fishRoll). The server prices dishes and buffs
--   (lib/wallet/catalogue.ts SUSHI_MENU); every function here runs for the service role only.

CREATE TABLE IF NOT EXISTS fishing_task_claims (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('day', 'week')),
  period_start DATE NOT NULL,
  task_id TEXT NOT NULL CHECK (char_length(task_id) BETWEEN 1 AND 80),
  reward INTEGER NOT NULL CHECK (reward > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, period, period_start, task_id)
);
ALTER TABLE fishing_task_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Fishing task claims readable by owner" ON fishing_task_claims;
CREATE POLICY "Fishing task claims readable by owner" ON fishing_task_claims FOR SELECT USING ((select auth.uid()) = member_id);
REVOKE INSERT, UPDATE, DELETE ON fishing_task_claims FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS chef_order_fills (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  item_key TEXT NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 64),
  reward INTEGER NOT NULL CHECK (reward > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, day)
);
ALTER TABLE chef_order_fills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chef order fills readable by owner" ON chef_order_fills;
CREATE POLICY "Chef order fills readable by owner" ON chef_order_fills FOR SELECT USING ((select auth.uid()) = member_id);
REVOKE INSERT, UPDATE, DELETE ON chef_order_fills FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS monthly_fish_entries (
  month DATE NOT NULL,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL REFERENCES collection_species(key) ON DELETE CASCADE,
  size_cm NUMERIC(7, 1) NOT NULL CHECK (size_cm > 0),
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 6 AND 200),
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (month, member_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_monthly_fish_entries_month ON monthly_fish_entries (month);
ALTER TABLE monthly_fish_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Monthly fish entries readable by authenticated" ON monthly_fish_entries;
CREATE POLICY "Monthly fish entries readable by authenticated" ON monthly_fish_entries FOR SELECT USING ((select auth.role()) = 'authenticated');
REVOKE INSERT, UPDATE, DELETE ON monthly_fish_entries FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS member_buffs (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (char_length(source) BETWEEN 1 AND 64),
  luck NUMERIC(4, 2) NOT NULL CHECK (luck BETWEEN 0 AND 1),
  size NUMERIC(4, 2) NOT NULL CHECK (size BETWEEN 0 AND 1),
  until TIMESTAMPTZ NOT NULL
);
ALTER TABLE member_buffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Member buffs readable by owner" ON member_buffs;
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
DROP POLICY IF EXISTS "Sushi orders readable by owner" ON sushi_orders;
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

-- Toronto's calendar day and its week's Monday now.
CREATE OR REPLACE FUNCTION public.toronto_today() RETURNS DATE LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (NOW() AT TIME ZONE 'America/Toronto')::DATE;
$$;

CREATE OR REPLACE FUNCTION public.fishing_task_claim(p_member_id UUID, p_period TEXT, p_start DATE, p_task TEXT, p_item_key TEXT, p_need INTEGER, p_reward INTEGER, p_idempotency_key TEXT)
RETURNS TABLE (balance INTEGER, paid INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_key TEXT := 'fish_task:' || p_idempotency_key;
  v_today DATE := public.toronto_today();
  v_period DATE;
  v_from TIMESTAMPTZ;
  v_done BOOLEAN;
  v_bal INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_member_id::TEXT || ':fish_task:' || p_start::TEXT));
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE member_id = p_member_id AND idempotency_key = v_key) THEN
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id;
    RETURN QUERY SELECT v_bal, (SELECT amount FROM wallet_ledger WHERE member_id = p_member_id AND idempotency_key = v_key), TRUE; RETURN;
  END IF;
  -- Only this period's tasks: today, or this week from its Monday.
  IF p_period = 'day' THEN v_period := v_today; ELSIF p_period = 'week' THEN v_period := date_trunc('week', v_today)::DATE; END IF;
  IF v_period IS NULL OR p_start <> v_period THEN RAISE EXCEPTION 'not_requested'; END IF;
  IF p_reward < 1 OR p_reward > 5000 OR p_need < 1 OR p_need > 50 OR (p_item_key IS NULL) = (p_task LIKE 'catch:%') THEN RAISE EXCEPTION 'bad_qty'; END IF;
  IF EXISTS (SELECT 1 FROM fishing_task_claims c WHERE c.member_id = p_member_id AND c.period = p_period AND c.period_start = p_start AND c.task_id = p_task) THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;
  v_from := p_start::TIMESTAMP AT TIME ZONE 'America/Toronto';
  IF p_item_key IS NOT NULL AND p_period = 'day' THEN
    -- A rod cast of that fish landed today (catch_rolls keeps a day of them).
    v_done := EXISTS (SELECT 1 FROM catch_rolls c WHERE c.member_id = p_member_id AND c.node_id IS NULL AND c.item_key = p_item_key AND c.landed_at >= v_from);
  ELSIF p_item_key IS NOT NULL THEN
    v_done := EXISTS (SELECT 1 FROM weekly_catch_bests w WHERE w.user_id = p_member_id AND w.week_start = p_start AND w.item_key = p_item_key);
  ELSE
    v_done := (SELECT count(*) FROM weekly_catch_bests w JOIN collection_species s ON s.key = w.item_key
               WHERE w.user_id = p_member_id AND w.week_start = p_start AND s.category = 'fish') >= p_need;
  END IF;
  IF NOT v_done THEN RAISE EXCEPTION 'not_done'; END IF;
  INSERT INTO fishing_task_claims (member_id, period, period_start, task_id, reward) VALUES (p_member_id, p_period, p_start, p_task, p_reward);
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', p_reward, 'quest', 'fish_task:' || p_task, v_key) a;
  RETURN QUERY SELECT v_bal, p_reward, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.chef_order_fill(p_member_id UUID, p_day DATE, p_item_key TEXT, p_reward INTEGER, p_idempotency_key TEXT,
  p_luck NUMERIC, p_size NUMERIC, p_until TIMESTAMPTZ)
RETURNS TABLE (balance INTEGER, remaining INTEGER, paid INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_have INTEGER;
  v_bal INTEGER;
  v_key TEXT := 'chef_order:' || p_idempotency_key;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_member_id::TEXT || ':chef_order:' || p_day::TEXT));
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE member_id = p_member_id AND idempotency_key = v_key) THEN
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id;
    SELECT mc.count INTO v_have FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key;
    RETURN QUERY SELECT v_bal, COALESCE(v_have, 0), (SELECT amount FROM wallet_ledger WHERE member_id = p_member_id AND idempotency_key = v_key), TRUE; RETURN;
  END IF;
  IF p_reward < 1 OR p_reward > 5000 THEN RAISE EXCEPTION 'bad_qty'; END IF;
  IF EXISTS (SELECT 1 FROM chef_order_fills f WHERE f.member_id = p_member_id AND f.day = p_day) THEN RAISE EXCEPTION 'already_filled'; END IF;
  v_have := public.collections_take_one(p_member_id, p_item_key);
  INSERT INTO chef_order_fills (member_id, day, item_key, reward) VALUES (p_member_id, p_day, p_item_key, p_reward);
  INSERT INTO member_buffs (member_id, source, luck, size, until) VALUES (p_member_id, 'staff_meal', p_luck, p_size, p_until)
  ON CONFLICT (member_id) DO UPDATE SET source = EXCLUDED.source, luck = EXCLUDED.luck, size = EXCLUDED.size, until = EXCLUDED.until;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', p_reward, 'quest', 'chef_order:' || p_item_key, v_key) a;
  RETURN QUERY SELECT v_bal, v_have, p_reward, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.monthly_fish_enter(p_member_id UUID, p_item_key TEXT, p_idempotency_key TEXT)
RETURNS TABLE (size_cm NUMERIC, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_month DATE := date_trunc('month', public.toronto_today())::DATE;
  v_size NUMERIC;
  v_had BOOLEAN;
  e monthly_fish_entries%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_member_id::TEXT || ':monthly_fish:' || p_item_key));
  SELECT * INTO e FROM monthly_fish_entries m WHERE m.month = v_month AND m.member_id = p_member_id AND m.item_key = p_item_key;
  v_had := FOUND;
  IF v_had AND e.idempotency_key = p_idempotency_key THEN RETURN QUERY SELECT e.size_cm, TRUE; RETURN; END IF;
  -- The biggest of it landed since the Toronto month began.
  SELECT max(w.size_cm) INTO v_size FROM weekly_catch_bests w
   WHERE w.user_id = p_member_id AND w.item_key = p_item_key AND w.caught_at >= v_month::TIMESTAMP AT TIME ZONE 'America/Toronto';
  IF v_size IS NULL THEN RAISE EXCEPTION 'not_this_month'; END IF;
  IF v_had AND e.size_cm >= v_size THEN RAISE EXCEPTION 'not_bigger'; END IF;
  PERFORM public.collections_take_one(p_member_id, p_item_key);
  INSERT INTO monthly_fish_entries AS m (month, member_id, item_key, size_cm, idempotency_key) VALUES (v_month, p_member_id, p_item_key, v_size, p_idempotency_key)
  ON CONFLICT (month, member_id, item_key) DO UPDATE SET size_cm = EXCLUDED.size_cm, idempotency_key = EXCLUDED.idempotency_key, entered_at = NOW();
  RETURN QUERY SELECT v_size, FALSE;
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
    'toronto_today()',
    'fishing_task_claim(uuid, text, date, text, text, integer, integer, text)',
    'chef_order_fill(uuid, date, text, integer, text, numeric, numeric, timestamptz)',
    'monthly_fish_enter(uuid, text, text)',
    'sushi_order(uuid, text, integer, text, numeric, numeric, timestamptz, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
