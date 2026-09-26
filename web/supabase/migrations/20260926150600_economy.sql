-- ─── 033 Economy: one wallet path, shop, selling, inventory, merch, daily gift ─
--
-- DRAFT 2026-09-24. NOT APPLIED. Spec: specs/economy.md (rows 11, 14, 15,
-- 18, 21, 30, 46, 47, 76, 82, 91, 94, 115, 126, 127, 186, 187, 200, 215).
-- Depends on 001, 014 (shop_items), 016 (events.is_irl), 023, 024 (if
-- applied), 029-032 (whose coin writes already call wallet_apply below).
--
-- One source of truth per currency:
--   * Play coins: wallet_ledger (append-only) with wallets.coins as the
--     locked running balance. 024's profiles.coins is migrated into it as
--     an opening entry and then dropped; 024's client-callable earn_coins /
--     sell_catches / buy_gear are replaced by service-role functions.
--   * Gems: stay where the real records already are (profiles.tethos_coins
--     + tc_transactions, applied, row 48 "real records kept"). tc_transactions
--     gains an idempotency key and the merch/shop types.
-- Every write is a service-role function; members only read their own rows.
-- No transfers between accounts exist (row 46). No currency ever converts.

-- ─── Wallet core ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  source TEXT NOT NULL CHECK (source IN ('study', 'sell', 'chapter', 'quest', 'daily_gift', 'event', 'admin', 'shop', 'room', 'goal', 'refund', 'migration')),
  ref TEXT CHECK (ref IS NULL OR char_length(ref) <= 200),
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 6 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_member ON wallet_ledger (member_id, created_at DESC);

-- Gems keep their existing ledger; make it idempotent and teach it the new types.
ALTER TABLE tc_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tc_transactions_idem ON tc_transactions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE tc_transactions DROP CONSTRAINT IF EXISTS tc_transactions_type_check;
ALTER TABLE tc_transactions ADD CONSTRAINT tc_transactions_type_check CHECK (type IN (
  'earn_quest', 'earn_bounty', 'earn_event', 'earn_achievement', 'earn_birthday', 'earn_streak', 'earn_admin',
  'spend_marketplace', 'spend_theme', 'spend_shop', 'spend_merch', 'refund_merch'));

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wallet readable by owner or T1/T2" ON wallets
  FOR SELECT USING (member_id = (select auth.uid()) OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ledger readable by owner or T1/T2" ON wallet_ledger
  FOR SELECT USING (member_id = (select auth.uid()) OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- The single write path. Positive = credit, negative = debit. Replaying a
-- key returns the current balance and changes nothing. Never below zero.
CREATE OR REPLACE FUNCTION public.wallet_apply(
  p_member_id UUID, p_currency TEXT, p_amount INTEGER, p_source TEXT, p_ref TEXT, p_idempotency_key TEXT
) RETURNS TABLE (balance INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_bal INTEGER;
  v_type TEXT;
BEGIN
  IF p_amount = 0 THEN RAISE EXCEPTION 'zero_amount'; END IF;
  IF p_currency = 'coins' THEN
    INSERT INTO wallets (member_id) VALUES (p_member_id) ON CONFLICT DO NOTHING;
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM wallet_ledger l WHERE l.member_id = p_member_id AND l.idempotency_key = p_idempotency_key) THEN
      RETURN QUERY SELECT v_bal, TRUE; RETURN;
    END IF;
    IF v_bal + p_amount < 0 THEN RAISE EXCEPTION 'insufficient'; END IF;
    INSERT INTO wallet_ledger (member_id, amount, balance_after, source, ref, idempotency_key)
    VALUES (p_member_id, p_amount, v_bal + p_amount, p_source, p_ref, p_idempotency_key);
    UPDATE wallets w SET coins = v_bal + p_amount, updated_at = NOW() WHERE w.member_id = p_member_id;
    RETURN QUERY SELECT v_bal + p_amount, FALSE;
  ELSIF p_currency = 'gems' THEN
    SELECT p.tethos_coins INTO v_bal FROM profiles p WHERE p.id = p_member_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'no_member'; END IF;
    IF EXISTS (SELECT 1 FROM tc_transactions t WHERE t.user_id = p_member_id AND t.idempotency_key = p_idempotency_key) THEN
      RETURN QUERY SELECT v_bal, TRUE; RETURN;
    END IF;
    IF v_bal + p_amount < 0 THEN RAISE EXCEPTION 'insufficient'; END IF;
    v_type := CASE p_source WHEN 'shop' THEN 'spend_shop' WHEN 'merch' THEN 'spend_merch' WHEN 'refund' THEN 'refund_merch'
                            WHEN 'event' THEN 'earn_event' WHEN 'quest' THEN 'earn_quest' ELSE 'earn_admin' END;
    INSERT INTO tc_transactions (user_id, amount, balance_after, type, description, idempotency_key)
    VALUES (p_member_id, p_amount, v_bal + p_amount, v_type, p_ref, p_idempotency_key);
    UPDATE profiles p SET tethos_coins = v_bal + p_amount WHERE p.id = p_member_id;
    RETURN QUERY SELECT v_bal + p_amount, FALSE;
  ELSE
    RAISE EXCEPTION 'bad_currency';
  END IF;
END;
$$;

-- ─── Retire 024's client-callable coin functions; migrate its balances ──────
DROP FUNCTION IF EXISTS public.earn_coins(INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.sell_catches(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.buy_gear(TEXT);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'coins') THEN
    INSERT INTO wallets (member_id, coins)
      SELECT id, coins FROM profiles WHERE coins > 0
      ON CONFLICT (member_id) DO NOTHING;
    INSERT INTO wallet_ledger (member_id, amount, balance_after, source, ref, idempotency_key)
      SELECT id, coins, coins, 'migration', '024 profiles.coins', 'migration:024' FROM profiles WHERE coins > 0
      ON CONFLICT DO NOTHING;
    ALTER TABLE profiles DROP COLUMN coins;
  END IF;
END $$;

-- ─── Economy settings (admin-tunable numbers) ───────────────────────────────
CREATE TABLE IF NOT EXISTS economy_settings (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL CHECK (value >= 0)
);
ALTER TABLE economy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Economy settings readable" ON economy_settings FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "Economy settings writable by T1/T2" ON economy_settings
  FOR ALL USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2))
  WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- ─── Shop catalogue: extend 014's shop_items (edited by the existing ShopEditor) ─
-- tc_price stays the Gems price (legacy name, see web/lib/economy.ts); price_coins
-- is new. Exactly one price per item.
ALTER TABLE shop_items ALTER COLUMN tc_price DROP NOT NULL;
ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS price_coins INTEGER CHECK (price_coins IS NULL OR price_coins > 0),
  ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IS NULL OR tier IN ('basic', 'mid', 'premium')),
  ADD COLUMN IF NOT EXISTS slot TEXT CHECK (slot IS NULL OR slot IN ('rod', 'net', 'shovel', 'outfit', 'hair', 'accessory')),
  ADD COLUMN IF NOT EXISTS special_pool BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stackable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS catalogue_ref TEXT,
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_category_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_category_check CHECK (category IN (
  'avatar-outfit', 'avatar-effect', 'merch', 'profile-customization',
  'tool', 'outfit', 'hair', 'accessory', 'furniture', 'wallpaper', 'flooring'));
ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_one_price;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_one_price CHECK ((price_coins IS NULL) <> (tc_price IS NULL));
ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_merch_in_gems;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_merch_in_gems CHECK (category <> 'merch' OR tc_price IS NOT NULL);

-- ─── Inventory and equip ────────────────────────────────────────────────────
-- New table rather than player_inventory: that name has two conflicting
-- definitions (005 → avatar_items, 020 → shop_items) and no quantity.
CREATE TABLE IF NOT EXISTS member_inventory (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  slot TEXT,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, item_id),
  CHECK (NOT equipped OR slot IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_inventory_one_per_slot ON member_inventory (member_id, slot) WHERE equipped;
ALTER TABLE member_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inventory readable by owner or T1/T2" ON member_inventory
  FOR SELECT USING (member_id = (select auth.uid()) OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- ─── Selling by rarity (row 91) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sell_prices (
  category TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  price INTEGER NOT NULL CHECK (price > 0),
  PRIMARY KEY (category, rarity)
);
ALTER TABLE sell_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sell prices readable" ON sell_prices FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "Sell prices writable by T1/T2" ON sell_prices
  FOR ALL USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2))
  WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- ─── Merch reservations (row 47): reserve stock + Gems, campus pickup ───────
CREATE TABLE IF NOT EXISTS merch_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE RESTRICT,
  gems INTEGER NOT NULL CHECK (gems > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'fulfilled', 'cancelled')),
  pickup_code TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 6 AND 200),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_merch_open ON merch_reservations (status, created_at) WHERE status = 'reserved';
ALTER TABLE merch_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merch reservations readable by owner or T1/T2" ON merch_reservations
  FOR SELECT USING (member_id = (select auth.uid()) OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- ─── Daily login gift (once per Toronto day) ────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_login_claims (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  coins INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, day)
);
ALTER TABLE daily_login_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Daily claims readable by owner" ON daily_login_claims FOR SELECT USING (member_id = (select auth.uid()));

-- ─── Chapter rewards (progression, 029) ─────────────────────────────────────
ALTER TABLE quest_chapters ADD COLUMN IF NOT EXISTS reward_coins INTEGER NOT NULL DEFAULT 0 CHECK (reward_coins BETWEEN 0 AND 5000);
UPDATE quest_chapters SET reward_coins = 100 WHERE slug = 'settle-in' AND reward_coins = 0;
UPDATE quest_chapters SET reward_coins = 300 WHERE slug = 'ruins-gate' AND reward_coins = 0;

-- ─── Functions (service role only) ──────────────────────────────────────────

-- Buy: price is computed by the server (specials included) and sanity-checked here.
CREATE OR REPLACE FUNCTION public.economy_buy(p_member_id UUID, p_item_id UUID, p_qty INTEGER, p_price_each INTEGER, p_idempotency_key TEXT)
RETURNS TABLE (balance INTEGER, owned INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  it shop_items%ROWTYPE;
  v_base INTEGER;
  v_currency TEXT;
  v_bal INTEGER;
  v_owned INTEGER;
  v_key TEXT := 'buy:' || p_idempotency_key;
BEGIN
  SELECT * INTO it FROM shop_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  v_currency := CASE WHEN it.price_coins IS NOT NULL THEN 'coins' ELSE 'gems' END;
  IF (v_currency = 'coins' AND EXISTS (SELECT 1 FROM wallet_ledger WHERE member_id = p_member_id AND idempotency_key = v_key))
     OR (v_currency = 'gems' AND EXISTS (SELECT 1 FROM tc_transactions WHERE user_id = p_member_id AND idempotency_key = v_key)) THEN
    SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, v_currency, -1, 'shop', it.slug, v_key) a;
    SELECT qty INTO v_owned FROM member_inventory WHERE member_id = p_member_id AND item_id = p_item_id;
    RETURN QUERY SELECT v_bal, COALESCE(v_owned, 0), TRUE; RETURN;
  END IF;
  IF NOT it.active OR it.category = 'merch' OR (it.available_from IS NOT NULL AND NOW() < it.available_from)
     OR (it.available_until IS NOT NULL AND NOW() > it.available_until) OR it.retired_at IS NOT NULL THEN
    RAISE EXCEPTION 'not_for_sale';
  END IF;
  IF p_qty < 1 OR p_qty > 20 OR (NOT it.stackable AND p_qty <> 1) THEN RAISE EXCEPTION 'bad_qty'; END IF;
  IF NOT it.stackable AND EXISTS (SELECT 1 FROM member_inventory WHERE member_id = p_member_id AND item_id = p_item_id) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;
  v_base := COALESCE(it.price_coins, it.tc_price);
  IF p_price_each > v_base OR p_price_each < v_base / 2 THEN RAISE EXCEPTION 'bad_price'; END IF;
  IF it.stock IS NOT NULL THEN
    IF it.stock < p_qty THEN RAISE EXCEPTION 'sold_out'; END IF;
    UPDATE shop_items SET stock = stock - p_qty WHERE id = p_item_id;
  END IF;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, v_currency, -(p_price_each * p_qty), 'shop', it.slug, v_key) a;
  INSERT INTO member_inventory (member_id, item_id, qty, slot) VALUES (p_member_id, p_item_id, p_qty, it.slot)
  ON CONFLICT (member_id, item_id) DO UPDATE SET qty = member_inventory.qty + EXCLUDED.qty
  RETURNING qty INTO v_owned;
  RETURN QUERY SELECT v_bal, v_owned, FALSE;
END;
$$;

-- Sell collection items; price by the species' category and rarity. Species not in
-- the launch roster fall back to 024's fish_prices rarity when that table exists.
CREATE OR REPLACE FUNCTION public.economy_sell(p_member_id UUID, p_item_key TEXT, p_qty INTEGER, p_idempotency_key TEXT)
RETURNS TABLE (balance INTEGER, remaining INTEGER, paid INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_cat TEXT;
  v_rarity TEXT;
  v_price INTEGER;
  v_have INTEGER;
  v_bal INTEGER;
  v_key TEXT := 'sell:' || p_idempotency_key;
BEGIN
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE member_id = p_member_id AND idempotency_key = v_key) THEN
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id;
    SELECT mc.count INTO v_have FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key;
    RETURN QUERY SELECT v_bal, COALESCE(v_have, 0), (SELECT amount FROM wallet_ledger WHERE member_id = p_member_id AND idempotency_key = v_key), TRUE; RETURN;
  END IF;
  IF p_qty < 1 OR p_qty > 200 THEN RAISE EXCEPTION 'bad_qty'; END IF;
  SELECT s.category, s.rarity INTO v_cat, v_rarity FROM collection_species s WHERE s.key = p_item_key;
  IF v_cat IS NULL AND to_regclass('public.fish_prices') IS NOT NULL THEN
    EXECUTE 'SELECT ''fish'', rarity FROM public.fish_prices WHERE item_key = $1' INTO v_cat, v_rarity USING p_item_key;
    IF v_rarity = 'seaking' THEN v_rarity := 'legendary'; END IF;
  END IF;
  SELECT sp.price INTO v_price FROM sell_prices sp WHERE sp.category = v_cat AND sp.rarity = v_rarity;
  IF v_price IS NULL THEN RAISE EXCEPTION 'not_sellable'; END IF;
  UPDATE member_collections mc SET count = mc.count - p_qty, updated_at = NOW()
   WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key AND mc.count >= p_qty
  RETURNING mc.count INTO v_have;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_items'; END IF;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', v_price * p_qty, 'sell', p_item_key, v_key) a;
  RETURN QUERY SELECT v_bal, v_have, v_price * p_qty, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.merch_reserve(p_member_id UUID, p_item_id UUID, p_idempotency_key TEXT, p_pickup_code TEXT)
RETURNS TABLE (reservation_id UUID, gems_balance INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  it shop_items%ROWTYPE;
  r merch_reservations%ROWTYPE;
  v_bal INTEGER;
  v_max INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'max_open_merch'), 3);
BEGIN
  SELECT * INTO r FROM merch_reservations WHERE member_id = p_member_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    SELECT p.tethos_coins INTO v_bal FROM profiles p WHERE p.id = p_member_id;
    RETURN QUERY SELECT r.id, v_bal, TRUE; RETURN;
  END IF;
  SELECT * INTO it FROM shop_items WHERE id = p_item_id FOR UPDATE;  -- serialises the stock race
  IF NOT FOUND OR it.category <> 'merch' OR NOT it.active OR it.tc_price IS NULL THEN RAISE EXCEPTION 'not_for_sale'; END IF;
  IF it.stock IS NOT NULL AND it.stock < 1 THEN RAISE EXCEPTION 'sold_out'; END IF;
  IF (SELECT count(*) FROM merch_reservations WHERE member_id = p_member_id AND status = 'reserved') >= v_max THEN
    RAISE EXCEPTION 'too_many_open';
  END IF;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'gems', -it.tc_price, 'merch', it.slug, 'merch:' || p_idempotency_key) a;
  IF it.stock IS NOT NULL THEN UPDATE shop_items SET stock = stock - 1 WHERE id = p_item_id; END IF;
  INSERT INTO merch_reservations (member_id, item_id, gems, pickup_code, idempotency_key)
  VALUES (p_member_id, p_item_id, it.tc_price, p_pickup_code, p_idempotency_key)
  RETURNING * INTO r;
  RETURN QUERY SELECT r.id, v_bal, FALSE;
END;
$$;

-- Fulfil (handed over on campus) or cancel (Gems refunded, stock returned). T1/T2 only.
CREATE OR REPLACE FUNCTION public.merch_resolve(p_reservation_id UUID, p_actor_id UUID, p_action TEXT, p_note TEXT)
RETURNS TABLE (status TEXT, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  r merch_reservations%ROWTYPE;
  v_target TEXT := CASE p_action WHEN 'fulfil' THEN 'fulfilled' WHEN 'cancel' THEN 'cancelled' END;
BEGIN
  IF v_target IS NULL THEN RAISE EXCEPTION 'bad_action'; END IF;
  IF (SELECT tier FROM profiles WHERE id = p_actor_id) NOT IN (1, 2) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM merch_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.status = v_target THEN RETURN QUERY SELECT r.status, TRUE; RETURN; END IF;
  IF r.status <> 'reserved' THEN RAISE EXCEPTION 'already_resolved'; END IF;
  IF v_target = 'cancelled' THEN
    PERFORM public.wallet_apply(r.member_id, 'gems', r.gems, 'refund', 'merch refund', 'merch_refund:' || r.id);
    UPDATE shop_items SET stock = stock + 1 WHERE id = r.item_id AND stock IS NOT NULL;
  END IF;
  UPDATE merch_reservations SET status = v_target, resolved_by = p_actor_id, resolved_at = NOW(), note = p_note WHERE id = r.id;
  RETURN QUERY SELECT v_target, FALSE;
END;
$$;

-- Daily gift: once per America/Toronto calendar day; 10 coins, 20 on Fridays (row 225).
CREATE OR REPLACE FUNCTION public.daily_gift_claim(p_member_id UUID)
RETURNS TABLE (coins INTEGER, balance INTEGER, claimed BOOLEAN, day DATE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_day DATE := (NOW() AT TIME ZONE 'America/Toronto')::DATE;
  v_amount INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'daily_gift_coins'), 10);
  v_bal INTEGER;
BEGIN
  -- Row 225: doubled on Fridays (Toronto calendar day).
  IF EXTRACT(ISODOW FROM v_day) = 5 THEN v_amount := v_amount * 2; END IF;
  INSERT INTO daily_login_claims (member_id, day, coins) VALUES (p_member_id, v_day, v_amount) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    SELECT COALESCE((SELECT w.coins FROM wallets w WHERE w.member_id = p_member_id), 0) INTO v_bal;
    RETURN QUERY SELECT 0, v_bal, FALSE, v_day; RETURN;
  END IF;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', v_amount, 'daily_gift', v_day::TEXT, 'daily:' || v_day) a;
  RETURN QUERY SELECT v_amount, v_bal, TRUE, v_day;
END;
$$;

-- In-person event attendance (QR check-in) credits coins once per attendance row.
CREATE OR REPLACE FUNCTION public.economy_event_attendance_credit() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'event_attendance_coins'), 50);
BEGIN
  IF NEW.status = 'attended' AND NEW.user_id IS NOT NULL AND v_amount > 0
     AND EXISTS (SELECT 1 FROM events e WHERE e.id = NEW.event_id AND e.is_irl) THEN
    PERFORM public.wallet_apply(NEW.user_id, 'coins', v_amount, 'event', NEW.event_id::TEXT, 'event:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_event_attendance_coins ON event_attendance;
CREATE TRIGGER trg_event_attendance_coins AFTER INSERT OR UPDATE OF status ON event_attendance
  FOR EACH ROW WHEN (NEW.status = 'attended') EXECUTE FUNCTION public.economy_event_attendance_credit();

-- Legacy gear (024 profiles.gear) → inventory, once the catalogue exists (seed below).

DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.wallet_apply(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.wallet_apply(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) TO service_role;
  REVOKE ALL ON FUNCTION public.economy_buy(UUID, UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.economy_buy(UUID, UUID, INTEGER, INTEGER, TEXT) TO service_role;
  REVOKE ALL ON FUNCTION public.economy_sell(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.economy_sell(UUID, TEXT, INTEGER, TEXT) TO service_role;
  REVOKE ALL ON FUNCTION public.merch_reserve(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.merch_reserve(UUID, UUID, TEXT, TEXT) TO service_role;
  REVOKE ALL ON FUNCTION public.merch_resolve(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.merch_resolve(UUID, UUID, TEXT, TEXT) TO service_role;
  REVOKE ALL ON FUNCTION public.daily_gift_claim(UUID) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.daily_gift_claim(UUID) TO service_role;
END $$;

-- ─── Seed (web/lib/wallet/catalogue.ts) ─────────────────────────────────────
-- BEGIN GENERATED ECONOMY SEED (web/scripts/gen-economy-seed.mjs)
INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, position) VALUES
  ('rod-basic', 'Basic rod', 'tool', 'A sturdy starter rod.', 100, NULL, 'basic', 'rod', FALSE, FALSE, NULL, NULL, 1),
  ('rod-cedar', 'Cedar rod', 'tool', 'Lighter, and a little lucky.', 400, NULL, 'mid', 'rod', FALSE, FALSE, NULL, 'rod_cedar', 2),
  ('rod-glass', 'Glass rod', 'tool', 'The pier regulars'' favourite.', 1200, NULL, 'premium', 'rod', FALSE, FALSE, NULL, 'rod_glass', 3),
  ('bobber-lucky', 'Lucky bobber', 'tool', 'Tackle. Purely for luck.', 600, NULL, 'premium', NULL, FALSE, FALSE, NULL, 'bobber_lucky', 4),
  ('net-basic', 'Bug net', 'tool', '', 100, NULL, 'basic', 'net', FALSE, FALSE, NULL, NULL, 5),
  ('net-mid', 'Wide net', 'tool', '', 400, NULL, 'mid', 'net', FALSE, FALSE, NULL, NULL, 6),
  ('shovel-basic', 'Shovel', 'tool', '', 100, NULL, 'basic', 'shovel', FALSE, FALSE, NULL, NULL, 7),
  ('shovel-mid', 'Iron shovel', 'tool', '', 400, NULL, 'mid', 'shovel', FALSE, FALSE, NULL, NULL, 8),
  ('outfit-sage-overalls', 'Sage overalls', 'outfit', '', 150, NULL, NULL, 'outfit', TRUE, FALSE, NULL, NULL, 9),
  ('outfit-cream-knit', 'Cream knit sweater', 'outfit', '', 150, NULL, NULL, 'outfit', TRUE, FALSE, NULL, NULL, 10),
  ('outfit-wharf-raincoat', 'Wharf raincoat', 'outfit', '', 180, NULL, NULL, 'outfit', TRUE, FALSE, NULL, NULL, 11),
  ('outfit-club-tee', 'Club tee', 'outfit', '', 120, NULL, NULL, 'outfit', TRUE, FALSE, NULL, NULL, 12),
  ('hair-chestnut', 'Chestnut hair dye', 'hair', '', 120, NULL, NULL, 'hair', TRUE, FALSE, NULL, NULL, 13),
  ('hair-sea-glass', 'Sea-glass hair dye', 'hair', '', 140, NULL, NULL, 'hair', TRUE, FALSE, NULL, NULL, 14),
  ('hair-sunset', 'Sunset hair dye', 'hair', '', 140, NULL, NULL, 'hair', TRUE, FALSE, NULL, NULL, 15),
  ('acc-straw-hat', 'Straw hat', 'accessory', '', 80, NULL, NULL, 'accessory', TRUE, FALSE, NULL, NULL, 16),
  ('acc-round-glasses', 'Round glasses', 'accessory', '', 80, NULL, NULL, 'accessory', TRUE, FALSE, NULL, NULL, 17),
  ('acc-bandana', 'Bandana', 'accessory', '', 60, NULL, NULL, 'accessory', TRUE, FALSE, NULL, NULL, 18),
  ('furn-lounge-sofa', 'Sofa', 'furniture', '', 300, NULL, NULL, NULL, TRUE, TRUE, NULL, 'lounge-sofa', 19),
  ('furn-study-desk', 'Study desk', 'furniture', '', 250, NULL, NULL, NULL, TRUE, TRUE, NULL, 'study-desk', 20),
  ('furn-study-chair', 'Study chair', 'furniture', '', 120, NULL, NULL, NULL, TRUE, TRUE, NULL, 'study-chair', 21),
  ('furn-bookshelf', 'Bookshelf', 'furniture', '', 220, NULL, NULL, NULL, TRUE, TRUE, NULL, 'bookshelf', 22),
  ('furn-floor-lamp', 'Floor lamp', 'furniture', '', 110, NULL, NULL, NULL, TRUE, TRUE, NULL, 'floor-lamp', 23),
  ('furn-plant-monstera', 'Monstera', 'furniture', '', 90, NULL, NULL, NULL, TRUE, TRUE, NULL, 'plant-monstera', 24),
  ('furn-lounge-rug', 'Cream rug', 'furniture', '', 140, NULL, NULL, NULL, TRUE, TRUE, NULL, 'lounge-rug', 25),
  ('furn-wall-clock', 'Wall clock', 'furniture', '', 80, NULL, NULL, NULL, TRUE, TRUE, NULL, 'wall-clock', 26),
  ('furn-wall-frame', 'Picture frame', 'furniture', '', 60, NULL, NULL, NULL, TRUE, TRUE, NULL, 'wall-frame', 27),
  ('furn-bench-park', 'Park bench', 'furniture', '', 180, NULL, NULL, NULL, TRUE, TRUE, NULL, 'bench-park', 28),
  ('furn-streetlamp', 'Street lamp', 'furniture', '', 160, NULL, NULL, NULL, TRUE, TRUE, NULL, 'streetlamp', 29),
  ('furn-campfire', 'Campfire', 'furniture', '', 200, NULL, NULL, NULL, TRUE, TRUE, NULL, 'campfire', 30),
  ('wall-stripe', 'Striped wallpaper', 'wallpaper', '', 100, NULL, NULL, NULL, FALSE, FALSE, NULL, 'stripe02', 31),
  ('wall-log', 'Log wallpaper', 'wallpaper', '', 120, NULL, NULL, NULL, FALSE, FALSE, NULL, 'log00', 32),
  ('wall-brick', 'Brick wallpaper', 'wallpaper', '', 120, NULL, NULL, NULL, FALSE, FALSE, NULL, 'brick00', 33),
  ('floor-tatami', 'Tatami flooring', 'flooring', '', 100, NULL, NULL, NULL, FALSE, FALSE, NULL, 'tatami00', 34),
  ('floor-carpet', 'Soft carpet', 'flooring', '', 100, NULL, NULL, NULL, FALSE, FALSE, NULL, 'simplecarpet01', 35),
  ('floor-plain', 'Plain boards', 'flooring', '', 80, NULL, NULL, NULL, FALSE, FALSE, NULL, 'simple00', 36),
  ('merch-sticker-pack', 'TSI sticker pack', 'merch', 'Five die-cut stickers. Pick up at HQ on campus.', NULL, 150, NULL, NULL, FALSE, FALSE, 100, NULL, 37),
  ('merch-tote', 'TSI tote bag', 'merch', 'Canvas tote. Pick up at HQ on campus.', NULL, 600, NULL, NULL, FALSE, FALSE, 30, NULL, 38)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO sell_prices (category, rarity, price) VALUES
  ('fish', 'common', 8),
  ('fish', 'uncommon', 20),
  ('fish', 'rare', 60),
  ('fish', 'epic', 180),
  ('fish', 'legendary', 600),
  ('sea', 'common', 8),
  ('sea', 'uncommon', 20),
  ('sea', 'rare', 60),
  ('sea', 'epic', 180),
  ('sea', 'legendary', 600),
  ('bug', 'common', 6),
  ('bug', 'uncommon', 16),
  ('bug', 'rare', 50),
  ('bug', 'epic', 150),
  ('bug', 'legendary', 500),
  ('fruit', 'common', 10),
  ('fruit', 'uncommon', 25),
  ('fruit', 'rare', 60),
  ('fruit', 'epic', 150),
  ('fruit', 'legendary', 400),
  ('nature', 'common', 4),
  ('nature', 'uncommon', 12),
  ('nature', 'rare', 40),
  ('nature', 'epic', 120),
  ('nature', 'legendary', 400),
  ('mineral', 'common', 5),
  ('mineral', 'uncommon', 15),
  ('mineral', 'rare', 45),
  ('mineral', 'epic', 135),
  ('mineral', 'legendary', 450)
ON CONFLICT (category, rarity) DO NOTHING;
INSERT INTO economy_settings (key, value) VALUES
  ('daily_gift_coins', 10),
  ('event_attendance_coins', 50),
  ('special_count', 3),
  ('special_discount_pct', 20),
  ('max_open_merch', 3)
ON CONFLICT (key) DO NOTHING;
-- END GENERATED ECONOMY SEED

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'gear') THEN
    INSERT INTO member_inventory (member_id, item_id, qty, slot)
      SELECT p.id, s.id, 1, s.slot
        FROM profiles p CROSS JOIN LATERAL jsonb_array_elements_text(p.gear) g(key)
        JOIN shop_items s ON s.catalogue_ref = g.key
      ON CONFLICT DO NOTHING;
    ALTER TABLE profiles DROP COLUMN gear;
  END IF;
END $$;
