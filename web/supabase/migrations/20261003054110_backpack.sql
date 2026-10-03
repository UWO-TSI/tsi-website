-- ─── The backpack and the home storage chest (rows 279–283) ──────────────────
--
-- Spec: specs/game-ui.md milestone 2 (items 5–7), defaults from specs/game-ui-questions.md 23–24.
-- Apply after 20261003015109_classes_v2_arcane_seed. Needs 20260926150400 + 150900 (member_collections,
-- collection_species, collections_record_catch), 20260926150600 + 151000 (shop_items, member_inventory,
-- economy_sell), 20260926160000 + 20260930100000 (crafting_recipes, the recipe drops) and 20260929100000
-- (collections_cast). Idempotent. Test: web/supabase/tests/backpack_smoke.sql.
--
--   * The bag has slots: 20, or 30 / 40 with a pocket upgrade (a shop row whose catalogue_ref is 'bag:<slots>').
--     Slots come from member_collections: materials and fruit stack to 30; flowers, shells and mushrooms to 10;
--     each fish, sea creature and bug takes its own (web/lib/collections/bag.ts mirrors bag_stack, bag_slots and
--     bag_capacity). Gear, wearables and furniture take none (row 280).
--   * A cast, a landing and a harvest refuse 'bag_full' when the item needs a slot the bag doesn't have. The whole
--     step rolls back: the node stays unharvested, the roll unlanded. A member already over capacity keeps
--     everything and picks nothing up until they are back under. Crafting is unchanged: it only takes from the bag.
--   * member_collections.locked: economy_sell and collections_drop refuse a locked item; storing all materials
--     leaves it in the bag.
--   * member_storage is the home storage chest (200 slots, the same stacks). storage_move moves a stack between
--     the bag and the chest; storage_store_materials moves every unlocked material. Each write happens once per
--     key (bag_log). The pocket upgrades' shop rows and recipes are the seed blocks at the end.
--   * Every write is a service-role function; members read only their own rows.

ALTER TABLE member_collections ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS member_storage (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 64),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, item_key)
);
ALTER TABLE member_storage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Storage readable by owner" ON member_storage;
CREATE POLICY "Storage readable by owner" ON member_storage FOR SELECT USING (member_id = (select auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON member_storage FROM anon, authenticated;

-- One row per bag write and key (a drop, a move, storing all materials): a retry with the same key replays it.
CREATE TABLE IF NOT EXISTS bag_log (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 100),
  action TEXT NOT NULL CHECK (action IN ('drop', 'store', 'take', 'store_materials')),
  item_key TEXT,
  qty INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, idempotency_key)
);
ALTER TABLE bag_log ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
REVOKE ALL ON bag_log FROM anon, authenticated;

-- ─── Slots ───────────────────────────────────────────────────────────────────

-- How many of an item share one slot, by its roster category (bag.ts stackSize).
CREATE OR REPLACE FUNCTION public.bag_stack(p_category TEXT) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_category IN ('mineral', 'fruit') THEN 30 WHEN p_category = 'nature' THEN 10 ELSE 1 END;
$$;

-- The slots a member's bag ('bag') or chest ('chest') fills, as if it held p_delta more of p_key (bag.ts slotsUsed).
CREATE OR REPLACE FUNCTION public.bag_slots(p_member_id UUID, p_store TEXT, p_key TEXT DEFAULT NULL, p_delta INTEGER DEFAULT 0)
RETURNS INTEGER LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(SUM(CEIL(t.n::NUMERIC / public.bag_stack(s.category))), 0)::INTEGER
    FROM (SELECT x.item_key, SUM(x.count) AS n
            FROM (SELECT mc.item_key, mc.count FROM member_collections mc WHERE mc.user_id = p_member_id AND p_store = 'bag'
                  UNION ALL SELECT ms.item_key, ms.count FROM member_storage ms WHERE ms.member_id = p_member_id AND p_store = 'chest'
                  UNION ALL SELECT p_key, p_delta WHERE p_key IS NOT NULL) x
           GROUP BY x.item_key) t
    LEFT JOIN collection_species s ON s.key = t.item_key
   WHERE t.n > 0;
$$;

-- The bag's size: 20, or the biggest pocket upgrade the member owns; the chest's: 200 (bag.ts bagCapacity, CHEST_SLOTS).
CREATE OR REPLACE FUNCTION public.bag_capacity(p_member_id UUID, p_store TEXT DEFAULT 'bag')
RETURNS INTEGER LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN p_store = 'chest' THEN 200 ELSE GREATEST(20, COALESCE(MAX(substr(s.catalogue_ref, 5)::INTEGER), 0)) END
    FROM member_inventory i JOIN shop_items s ON s.id = i.item_id
   WHERE i.member_id = p_member_id AND s.catalogue_ref ~ '^bag:[0-9]+$';
$$;

-- 'bag_full' (or 'storage_full') when p_delta more of p_key would leave the store over its size, so a store already
-- over takes nothing. Serialised per member: two pickups at once can't both take the last slot. Every function that
-- moves stock into the bag or the chest takes this lock before touching a row.
CREATE OR REPLACE FUNCTION public.bag_check(p_member_id UUID, p_store TEXT, p_key TEXT, p_delta INTEGER)
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('bag:' || p_member_id::TEXT));
  IF public.bag_slots(p_member_id, p_store, p_key, p_delta) > public.bag_capacity(p_member_id, p_store) THEN
    RAISE EXCEPTION '%', CASE p_store WHEN 'chest' THEN 'storage_full' ELSE 'bag_full' END;
  END IF;
END;
$$;

-- ─── Pickups refuse when the item has no slot ────────────────────────────────

-- 20260926150900's catch record, with the bag's check first (land and harvest both come through here).
CREATE OR REPLACE FUNCTION public.collections_record_catch(p_member_id UUID, p_item_key TEXT, p_size NUMERIC, p_trophy BOOLEAN)
RETURNS TABLE (count INTEGER, total_collected INTEGER, best_size_cm NUMERIC, new_record BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_old NUMERIC;
  v_row member_collections%ROWTYPE;
  v_hour TIMESTAMPTZ := date_trunc('hour', NOW());
  v_rarity TEXT;
BEGIN
  PERFORM public.bag_check(p_member_id, 'bag', p_item_key, 1);
  SELECT s.rarity INTO v_rarity FROM collection_species s WHERE s.key = p_item_key;
  IF v_rarity IS NULL AND to_regclass('public.fish_prices') IS NOT NULL THEN
    EXECUTE 'SELECT rarity FROM public.fish_prices WHERE item_key = $1' INTO v_rarity USING p_item_key;
  END IF;
  DELETE FROM collection_catch_hours h WHERE h.user_id = p_member_id AND h.hour < v_hour;
  INSERT INTO collection_catch_hours AS h (user_id, hour, item_key, n) VALUES (p_member_id, v_hour, p_item_key, 1)
  ON CONFLICT (user_id, hour, item_key) DO UPDATE SET n = h.n + 1
    WHERE h.n < CASE v_rarity WHEN 'legendary' THEN 3 WHEN 'seaking' THEN 3 WHEN 'epic' THEN 6
                              WHEN 'rare' THEN 12 WHEN 'uncommon' THEN 30 ELSE 60 END;
  IF NOT FOUND OR (SELECT sum(h.n) FROM collection_catch_hours h WHERE h.user_id = p_member_id AND h.hour = v_hour) > 200 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT mc.best_size_cm INTO v_old FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key FOR UPDATE;
  INSERT INTO member_collections AS mc (user_id, item_key, count, total_collected, best_size_cm, best_size_at)
  VALUES (p_member_id, p_item_key, 1, 1, p_size, CASE WHEN p_size IS NULL THEN NULL ELSE NOW() END)
  ON CONFLICT (user_id, item_key) DO UPDATE SET
    count = mc.count + 1,
    total_collected = mc.total_collected + 1,
    best_size_cm = CASE WHEN EXCLUDED.best_size_cm IS NOT NULL AND (mc.best_size_cm IS NULL OR EXCLUDED.best_size_cm > mc.best_size_cm) THEN EXCLUDED.best_size_cm ELSE mc.best_size_cm END,
    best_size_at = CASE WHEN EXCLUDED.best_size_cm IS NOT NULL AND (mc.best_size_cm IS NULL OR EXCLUDED.best_size_cm > mc.best_size_cm) THEN NOW() ELSE mc.best_size_at END,
    updated_at = NOW()
  RETURNING mc.* INTO v_row;
  IF p_trophy AND p_size IS NOT NULL THEN
    INSERT INTO weekly_catch_bests AS w (week_start, user_id, item_key, size_cm)
    VALUES (date_trunc('week', NOW() AT TIME ZONE 'America/Toronto')::DATE, p_member_id, p_item_key, p_size)
    ON CONFLICT (week_start, user_id, item_key) DO UPDATE SET size_cm = EXCLUDED.size_cm, caught_at = NOW()
      WHERE EXCLUDED.size_cm > w.size_cm;
  END IF;
  RETURN QUERY SELECT v_row.count, v_row.total_collected, v_row.best_size_cm,
    (p_size IS NOT NULL AND (v_old IS NULL OR p_size > v_old));
END;
$$;

-- 20260929100000's cast: a fish the bag has no slot for doesn't bite (the land checks again: the bag can fill meanwhile).
CREATE OR REPLACE FUNCTION public.collections_cast(p_member_id UUID, p_item_key TEXT, p_size NUMERIC, p_trophy BOOLEAN)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('catch_rolls:' || p_member_id::text));
  IF EXISTS (SELECT 1 FROM catch_rolls c WHERE c.member_id = p_member_id AND c.node_id IS NULL AND c.rolled_at > NOW() - INTERVAL '4 seconds') THEN
    RAISE EXCEPTION 'too_fast';
  END IF;
  PERFORM public.bag_check(p_member_id, 'bag', p_item_key, 1);
  DELETE FROM catch_rolls c WHERE c.member_id = p_member_id AND c.rolled_at < NOW() - INTERVAL '1 day';
  INSERT INTO catch_rolls (member_id, item_key, size_cm, trophy) VALUES (p_member_id, p_item_key, p_size, p_trophy) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ─── Locks and drops ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.collections_set_lock(p_member_id UUID, p_item_key TEXT, p_locked BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE member_collections SET locked = p_locked, updated_at = NOW() WHERE user_id = p_member_id AND item_key = p_item_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_owned'; END IF;
END;
$$;

-- The key's log row, first: true for a new write, false for a replay of the same one, 'key_reused' otherwise. A
-- concurrent retry waits on the row, then replays; a write that fails rolls its row back.
CREATE OR REPLACE FUNCTION public.bag_log_once(p_member_id UUID, p_key TEXT, p_action TEXT, p_item_key TEXT, p_qty INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r bag_log%ROWTYPE;
BEGIN
  INSERT INTO bag_log (member_id, idempotency_key, action, item_key, qty) VALUES (p_member_id, p_key, p_action, p_item_key, p_qty)
  ON CONFLICT (member_id, idempotency_key) DO NOTHING;
  IF FOUND THEN RETURN TRUE; END IF;
  SELECT * INTO r FROM bag_log l WHERE l.member_id = p_member_id AND l.idempotency_key = p_key;
  IF r.action <> p_action OR r.item_key IS DISTINCT FROM p_item_key OR (p_action <> 'store_materials' AND r.qty <> p_qty) THEN
    RAISE EXCEPTION 'key_reused';
  END IF;
  RETURN FALSE;
END;
$$;

-- Drop items for good (an unlocked one), once per key. Returns how many are left.
CREATE OR REPLACE FUNCTION public.collections_drop(p_member_id UUID, p_item_key TEXT, p_qty INTEGER, p_idempotency_key TEXT)
RETURNS TABLE (count INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE v_left INTEGER;
BEGIN
  IF NOT public.bag_log_once(p_member_id, p_idempotency_key, 'drop', p_item_key, p_qty) THEN
    RETURN QUERY SELECT COALESCE((SELECT mc.count FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key), 0), TRUE;
    RETURN;
  END IF;
  IF p_qty < 1 OR p_qty > 999 THEN RAISE EXCEPTION 'bad_qty'; END IF;
  UPDATE member_collections mc SET count = mc.count - p_qty, updated_at = NOW()
   WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key AND mc.count >= p_qty AND NOT mc.locked
  RETURNING mc.count INTO v_left;
  IF NOT FOUND THEN
    RAISE EXCEPTION '%', CASE WHEN EXISTS (SELECT 1 FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key AND mc.locked)
                              THEN 'locked' ELSE 'insufficient_items' END;
  END IF;
  RETURN QUERY SELECT v_left, FALSE;
END;
$$;

-- 20260926151000's sale, refusing a locked item (the bag's favourites).
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
  PERFORM pg_advisory_xact_lock(hashtext(p_member_id::TEXT || ':' || v_key));
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
  IF EXISTS (SELECT 1 FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key AND mc.locked) THEN
    RAISE EXCEPTION 'locked';
  END IF;
  UPDATE member_collections mc SET count = mc.count - p_qty, updated_at = NOW()
   WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key AND mc.count >= p_qty
  RETURNING mc.count INTO v_have;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_items'; END IF;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', v_price * p_qty, 'sell', p_item_key, v_key) a;
  RETURN QUERY SELECT v_bal, v_have, v_price * p_qty, FALSE;
END;
$$;

-- ─── The home storage chest ──────────────────────────────────────────────────

-- Move p_qty of an item to the chest ('chest') or back to the bag ('bag'), once per key.
CREATE OR REPLACE FUNCTION public.storage_move(p_member_id UUID, p_item_key TEXT, p_qty INTEGER, p_to TEXT, p_idempotency_key TEXT)
RETURNS TABLE (replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_to IS NULL OR p_to NOT IN ('chest', 'bag') THEN RAISE EXCEPTION 'bad_move'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('bag:' || p_member_id::TEXT));  -- bag_check's lock, before any row
  IF NOT public.bag_log_once(p_member_id, p_idempotency_key, CASE p_to WHEN 'chest' THEN 'store' ELSE 'take' END, p_item_key, p_qty) THEN
    RETURN QUERY SELECT TRUE; RETURN;
  END IF;
  IF p_qty < 1 OR p_qty > 999 THEN RAISE EXCEPTION 'bad_qty'; END IF;
  IF p_to = 'chest' THEN
    UPDATE member_collections SET count = count - p_qty, updated_at = NOW() WHERE user_id = p_member_id AND item_key = p_item_key AND count >= p_qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_items'; END IF;
    PERFORM public.bag_check(p_member_id, 'chest', p_item_key, p_qty);
    INSERT INTO member_storage AS ms (member_id, item_key, count) VALUES (p_member_id, p_item_key, p_qty)
    ON CONFLICT (member_id, item_key) DO UPDATE SET count = ms.count + EXCLUDED.count, updated_at = NOW();
  ELSE
    UPDATE member_storage SET count = count - p_qty, updated_at = NOW() WHERE member_id = p_member_id AND item_key = p_item_key AND count >= p_qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_items'; END IF;
    PERFORM public.bag_check(p_member_id, 'bag', p_item_key, p_qty);
    -- A move, not a catch: the lifetime total stays what was caught.
    INSERT INTO member_collections AS mc (user_id, item_key, count, total_collected) VALUES (p_member_id, p_item_key, p_qty, 0)
    ON CONFLICT (user_id, item_key) DO UPDATE SET count = mc.count + EXCLUDED.count, updated_at = NOW();
  END IF;
  RETURN QUERY SELECT FALSE;
END;
$$;

-- Every unlocked material in the bag (branch, stone, clay, ore, crystal) into the chest, once per key. Returns how many moved.
CREATE OR REPLACE FUNCTION public.storage_store_materials(p_member_id UUID, p_idempotency_key TEXT)
RETURNS TABLE (moved INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_moved INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('bag:' || p_member_id::TEXT));
  IF NOT public.bag_log_once(p_member_id, p_idempotency_key, 'store_materials', NULL, 0) THEN
    RETURN QUERY SELECT l.qty, TRUE FROM bag_log l WHERE l.member_id = p_member_id AND l.idempotency_key = p_idempotency_key;
    RETURN;
  END IF;
  FOR r IN SELECT mc.item_key, mc.count FROM member_collections mc JOIN collection_species s ON s.key = mc.item_key
            WHERE mc.user_id = p_member_id AND mc.count > 0 AND s.category = 'mineral' AND NOT mc.locked
            ORDER BY mc.item_key FOR UPDATE OF mc LOOP
    PERFORM public.bag_check(p_member_id, 'chest', r.item_key, r.count);
    UPDATE member_collections mc SET count = 0, updated_at = NOW() WHERE mc.user_id = p_member_id AND mc.item_key = r.item_key;
    INSERT INTO member_storage AS ms (member_id, item_key, count) VALUES (p_member_id, r.item_key, r.count)
    ON CONFLICT (member_id, item_key) DO UPDATE SET count = ms.count + EXCLUDED.count, updated_at = NOW();
    v_moved := v_moved + r.count;
  END LOOP;
  UPDATE bag_log l SET qty = v_moved WHERE l.member_id = p_member_id AND l.idempotency_key = p_idempotency_key;
  RETURN QUERY SELECT v_moved, FALSE;
END;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['bag_stack(text)', 'bag_slots(uuid, text, text, integer)', 'bag_capacity(uuid, text)', 'bag_check(uuid, text, text, integer)',
    'bag_log_once(uuid, text, text, text, integer)', 'collections_record_catch(uuid, text, numeric, boolean)', 'collections_cast(uuid, text, numeric, boolean)',
    'collections_set_lock(uuid, text, boolean)', 'collections_drop(uuid, text, integer, text)', 'economy_sell(uuid, text, integer, text)',
    'storage_move(uuid, text, integer, text, text)', 'storage_store_materials(uuid, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- ─── The pocket upgrades: shop rows, recipes, icons ─────────────────────────
-- Generated by web/scripts/gen-seeds.mjs from the TS catalogues (lib/seedMigrations.ts): each changed seed's new
-- block, then an upsert of its changed rows. Bag-30 "Roomier pocket" (shop, 1,500 coins; a starter recipe: bagworm x4,
-- branch x6); bag-40 "Roomiest pocket" (crafted only: bagworm x6, gold nugget, windflower x2; the bottle, an epic catch).
-- previous block: 20260926150600_economy.sql
-- seed: economy
-- BEGIN GENERATED ECONOMY SEED (web/scripts/gen-seeds.mjs)
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
  ('acc-straw-hat', 'Straw hat', 'accessory', '', 80, NULL, NULL, 'accessory', TRUE, FALSE, NULL, 'acc_straw_hat', 16),
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
  ('merch-tote', 'TSI tote bag', 'merch', 'Canvas tote. Pick up at HQ on campus.', NULL, 600, NULL, NULL, FALSE, FALSE, 30, NULL, 38),
  ('bag-30', 'Roomier pocket', 'tool', 'Your backpack holds 30 things instead of 20.', 1500, NULL, NULL, NULL, FALSE, FALSE, NULL, 'bag:30', 39)
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
  ('max_open_merch', 3)
ON CONFLICT (key) DO NOTHING;
-- END GENERATED ECONOMY SEED
-- The rows this change adds or edits, so they land where the insert above does nothing.
INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, position) VALUES
  ('bag-30', 'Roomier pocket', 'tool', 'Your backpack holds 30 things instead of 20.', 1500, NULL, NULL, NULL, FALSE, FALSE, NULL, 'bag:30', 39)
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, category = EXCLUDED.category, description = EXCLUDED.description, price_coins = EXCLUDED.price_coins, tc_price = EXCLUDED.tc_price, tier = EXCLUDED.tier, slot = EXCLUDED.slot, special_pool = EXCLUDED.special_pool, stackable = EXCLUDED.stackable, stock = EXCLUDED.stock, catalogue_ref = EXCLUDED.catalogue_ref, position = EXCLUDED.position;

-- previous block: 20261002052225_catalogue_seed.sql
-- seed: crafting
-- BEGIN GENERATED CRAFTING SEED (web/scripts/gen-crafting-seed.mjs)
INSERT INTO collection_species (key, category, sub, name, biome, tool, rarity, size_min_cm, size_max_cm, start_hour, end_hour,
  rain_any_hour, weather, months, one_liner, icon, model, asset_ready, donatable, wing, position) VALUES
  ('wood_branch', 'mineral', 'wood', 'Tree branch', 'trees', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'Shake a tree and one usually falls out.', '/assets/icons/wood_branch.webp', NULL, FALSE, FALSE, NULL, 101)
ON CONFLICT (key) DO NOTHING;
INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, position, active) VALUES
  ('rod-lighthouse', 'Lighthouse rod', 'tool', 'Tier 4. Legendary fish will bite.', 3000, NULL, 'premium', 'rod', FALSE, FALSE, NULL, 'rod_lighthouse', 101, FALSE),
  ('rod-tidewarden', 'Tidewarden rod', 'tool', 'Tier 5. The widest bite window on the island.', 6000, NULL, 'premium', 'rod', FALSE, FALSE, NULL, 'rod_tidewarden', 102, FALSE),
  ('net-silk', 'Silk net', 'tool', 'Tier 3. Crafted at a workbench.', 1200, NULL, 'premium', 'net', FALSE, FALSE, NULL, NULL, 103, FALSE),
  ('net-dragonfly', 'Dragonfly net', 'tool', 'Tier 4. Crafted at a workbench.', 3000, NULL, 'premium', 'net', FALSE, FALSE, NULL, NULL, 104, FALSE),
  ('net-emperor', 'Emperor net', 'tool', 'Tier 5. Crafted at a workbench.', 6000, NULL, 'premium', 'net', FALSE, FALSE, NULL, NULL, 105, FALSE),
  ('shovel-sturdy', 'Sturdy shovel', 'tool', 'Tier 3. Crafted at a workbench.', 1200, NULL, 'premium', 'shovel', FALSE, FALSE, NULL, NULL, 106, FALSE),
  ('shovel-crystal', 'Crystal shovel', 'tool', 'Tier 4. Crafted at a workbench.', 3000, NULL, 'premium', 'shovel', FALSE, FALSE, NULL, NULL, 107, FALSE),
  ('shovel-gold', 'Golden shovel', 'tool', 'Tier 5. Crafted at a workbench.', 6000, NULL, 'premium', 'shovel', FALSE, FALSE, NULL, NULL, 108, FALSE),
  ('acc-flower-crown', 'Flower crown', 'accessory', '', 200, NULL, NULL, 'accessory', FALSE, FALSE, NULL, 'acc_flower_crown', 109, FALSE),
  ('acc-shell-necklace', 'Shell necklace', 'accessory', '', 250, NULL, NULL, 'accessory', FALSE, FALSE, NULL, 'acc_shell_necklace', 110, FALSE),
  ('acc-crystal-circlet', 'Crystal circlet', 'accessory', 'Rare. Catches the lamplight.', 2000, NULL, NULL, 'accessory', FALSE, FALSE, NULL, 'acc_crystal_circlet', 111, FALSE),
  ('outfit-silk-sweater', 'Silk sweater', 'outfit', '', 300, NULL, NULL, 'outfit', FALSE, FALSE, NULL, 'outfit_silk_sweater', 112, FALSE),
  ('outfit-monarch-cape', 'Monarch cape', 'outfit', 'Rare. Orange and black, like October.', 1500, NULL, NULL, 'outfit', FALSE, FALSE, NULL, 'outfit_monarch_cape', 113, FALSE),
  ('outfit-koi-kimono', 'Koi kimono', 'outfit', 'Rare. Woven around a golden koi scale.', 4000, NULL, NULL, 'outfit', FALSE, FALSE, NULL, 'outfit_koi_kimono', 114, FALSE),
  ('glider-leaf', 'Leaf glider', 'tool', 'Jump, then press jump again while falling and hold it to glide. Crafted at a workbench.', 3000, NULL, 'premium', NULL, FALSE, FALSE, NULL, 'glider_leaf', 119, FALSE),
  ('bag-40', 'Roomiest pocket', 'tool', 'Your backpack holds 40 things. Crafted at a workbench.', 3000, NULL, NULL, NULL, FALSE, FALSE, NULL, 'bag:40', 120, FALSE),
  ('card-shovel-sturdy', 'Sturdy shovel recipe', 'tool', 'Recipe card. Buying it teaches you the recipe.', 300, NULL, NULL, NULL, FALSE, FALSE, NULL, 'recipe:shovel-sturdy', 115, TRUE),
  ('card-acc-flower-crown', 'Flower crown recipe', 'tool', 'Recipe card. Buying it teaches you the recipe.', 300, NULL, NULL, NULL, FALSE, FALSE, NULL, 'recipe:acc-flower-crown', 116, TRUE),
  ('card-furn-bookshelf', 'Bookshelf recipe', 'tool', 'Recipe card. Buying it teaches you the recipe.', 300, NULL, NULL, NULL, FALSE, FALSE, NULL, 'recipe:furn-bookshelf', 117, TRUE),
  ('card-furn-floor-lamp', 'Floor lamp recipe', 'tool', 'Recipe card. Buying it teaches you the recipe.', 300, NULL, NULL, NULL, FALSE, FALSE, NULL, 'recipe:furn-floor-lamp', 118, TRUE)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO crafting_recipes (id, output_item, output_weapon, output_qty, ingredients, sources, position) VALUES
  ('rod-glass', 'rod-glass', NULL, 1, '{"wood_branch":4,"rock_crystal":1,"rock_clay":2}'::jsonb, ARRAY['bottle']::text[], 1),
  ('rod-lighthouse', 'rod-lighthouse', NULL, 1, '{"wood_branch":6,"rock_iron_nugget":3,"sea_pearl_oyster":1,"fish_black_bass":1}'::jsonb, ARRAY['quest','bottle']::text[], 2),
  ('rod-tidewarden', 'rod-tidewarden', NULL, 1, '{"wood_branch":8,"rock_gold_nugget":1,"rock_crystal":2,"fish_tuna":1,"sea_giant_isopod":1}'::jsonb, ARRAY['quest','bottle']::text[], 3),
  ('net-silk', 'net-silk', NULL, 1, '{"wood_branch":4,"bug_bagworm":3}'::jsonb, ARRAY['bottle']::text[], 4),
  ('net-dragonfly', 'net-dragonfly', NULL, 1, '{"wood_branch":5,"rock_iron_nugget":2,"bug_darner_dragonfly":2}'::jsonb, ARRAY['bottle']::text[], 5),
  ('net-emperor', 'net-emperor', NULL, 1, '{"wood_branch":6,"rock_gold_nugget":1,"bug_emperor_butterfly":1,"bug_rhinoceros_beetle":1}'::jsonb, ARRAY['quest','bottle']::text[], 6),
  ('shovel-sturdy', 'shovel-sturdy', NULL, 1, '{"wood_branch":2,"rock_iron_nugget":3,"rock_stone":2}'::jsonb, ARRAY['shop']::text[], 7),
  ('shovel-crystal', 'shovel-crystal', NULL, 1, '{"wood_branch":3,"rock_iron_nugget":3,"rock_crystal":2}'::jsonb, ARRAY['bottle']::text[], 8),
  ('shovel-gold', 'shovel-gold', NULL, 1, '{"wood_branch":3,"rock_iron_nugget":4,"rock_gold_nugget":2}'::jsonb, ARRAY['quest','bottle']::text[], 9),
  ('acc-straw-hat', 'acc-straw-hat', NULL, 1, '{"wood_branch":3}'::jsonb, ARRAY['starter']::text[], 10),
  ('acc-flower-crown', 'acc-flower-crown', NULL, 1, '{"flower_cosmos":2,"flower_lily":2,"flower_rose":1}'::jsonb, ARRAY['shop']::text[], 11),
  ('acc-shell-necklace', 'acc-shell-necklace', NULL, 1, '{"shell_scallop":2,"shell_turban":1,"shell_whelk":1}'::jsonb, ARRAY['bottle']::text[], 12),
  ('outfit-silk-sweater', 'outfit-silk-sweater', NULL, 1, '{"bug_bagworm":4,"flower_lily":2}'::jsonb, ARRAY['bottle']::text[], 13),
  ('outfit-monarch-cape', 'outfit-monarch-cape', NULL, 1, '{"bug_monarch_butterfly":2,"bug_bagworm":3,"flower_mum":2}'::jsonb, ARRAY['bottle']::text[], 14),
  ('outfit-koi-kimono', 'outfit-koi-kimono', NULL, 1, '{"fish_golden_koi":1,"bug_bagworm":4,"flower_rose":3}'::jsonb, ARRAY['quest','bottle']::text[], 15),
  ('acc-crystal-circlet', 'acc-crystal-circlet', NULL, 1, '{"rock_crystal":2,"rock_gold_nugget":1}'::jsonb, ARRAY['quest','bottle']::text[], 16),
  ('furn-campfire', 'furn-campfire', NULL, 1, '{"wood_branch":5,"rock_stone":3}'::jsonb, ARRAY['starter']::text[], 17),
  ('furn-study-chair', 'furn-study-chair', NULL, 1, '{"wood_branch":4}'::jsonb, ARRAY['starter']::text[], 18),
  ('furn-bookshelf', 'furn-bookshelf', NULL, 1, '{"wood_branch":8}'::jsonb, ARRAY['shop']::text[], 19),
  ('furn-floor-lamp', 'furn-floor-lamp', NULL, 1, '{"wood_branch":2,"rock_iron_nugget":2,"bug_firefly":1}'::jsonb, ARRAY['shop']::text[], 20),
  ('furn-study-desk', 'furn-study-desk', NULL, 1, '{"wood_branch":6,"rock_iron_nugget":1}'::jsonb, ARRAY['bottle']::text[], 21),
  ('furn-bench-park', 'furn-bench-park', NULL, 1, '{"wood_branch":6,"rock_iron_nugget":2}'::jsonb, ARRAY['bottle']::text[], 22),
  ('furn-streetlamp', 'furn-streetlamp', NULL, 1, '{"rock_iron_nugget":4,"rock_stone":2,"bug_firefly":1}'::jsonb, ARRAY['bottle']::text[], 23),
  ('furn-plant-monstera', 'furn-plant-monstera', NULL, 1, '{"rock_clay":3,"wood_branch":1}'::jsonb, ARRAY['bottle']::text[], 24),
  ('furn-wall-clock', 'furn-wall-clock', NULL, 1, '{"wood_branch":3,"rock_iron_nugget":1}'::jsonb, ARRAY['bottle']::text[], 25),
  ('furn-wall-frame', 'furn-wall-frame', NULL, 1, '{"wood_branch":2,"flower_pansy":1}'::jsonb, ARRAY['bottle']::text[], 26),
  ('furn-lounge-rug', 'furn-lounge-rug', NULL, 1, '{"bug_bagworm":3,"flower_hyacinth":2}'::jsonb, ARRAY['bottle']::text[], 27),
  ('sword-iron', NULL, 'sword-iron', 1, '{"rock_iron_nugget":4,"wood_branch":2}'::jsonb, ARRAY['bottle']::text[], 28),
  ('bow-yew', NULL, 'bow-yew', 1, '{"wood_branch":6,"bug_bagworm":2}'::jsonb, ARRAY['bottle']::text[], 29),
  ('revolver-brass', NULL, 'revolver-brass', 1, '{"rock_iron_nugget":3,"rock_gold_nugget":1}'::jsonb, ARRAY['quest','bottle']::text[], 30),
  ('staff-rune', NULL, 'staff-rune', 1, '{"wood_branch":4,"rock_crystal":2,"fish_football_fish":1}'::jsonb, ARRAY['quest','bottle']::text[], 31),
  ('glider-leaf', 'glider-leaf', NULL, 1, '{"wood_branch":6,"flower_windflower":2,"bug_red_dragonfly":1}'::jsonb, ARRAY['quest','bottle']::text[], 32),
  ('bag-30', 'bag-30', NULL, 1, '{"bug_bagworm":4,"wood_branch":6}'::jsonb, ARRAY['starter']::text[], 33),
  ('bag-40', 'bag-40', NULL, 1, '{"bug_bagworm":6,"rock_gold_nugget":1,"flower_windflower":2}'::jsonb, ARRAY['bottle']::text[], 34)
ON CONFLICT (id) DO NOTHING;
-- END GENERATED CRAFTING SEED
-- The rows this change adds or edits, so they land where the insert above does nothing.
INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, position, active) VALUES
  ('bag-40', 'Roomiest pocket', 'tool', 'Your backpack holds 40 things. Crafted at a workbench.', 3000, NULL, NULL, NULL, FALSE, FALSE, NULL, 'bag:40', 120, FALSE)
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, category = EXCLUDED.category, description = EXCLUDED.description, price_coins = EXCLUDED.price_coins, tc_price = EXCLUDED.tc_price, tier = EXCLUDED.tier, slot = EXCLUDED.slot, special_pool = EXCLUDED.special_pool, stackable = EXCLUDED.stackable, stock = EXCLUDED.stock, catalogue_ref = EXCLUDED.catalogue_ref, position = EXCLUDED.position, active = EXCLUDED.active;
INSERT INTO crafting_recipes (id, output_item, output_weapon, output_qty, ingredients, sources, position) VALUES
  ('bag-30', 'bag-30', NULL, 1, '{"bug_bagworm":4,"wood_branch":6}'::jsonb, ARRAY['starter']::text[], 33),
  ('bag-40', 'bag-40', NULL, 1, '{"bug_bagworm":6,"rock_gold_nugget":1,"flower_windflower":2}'::jsonb, ARRAY['bottle']::text[], 34)
ON CONFLICT (id) DO UPDATE SET output_item = EXCLUDED.output_item, output_weapon = EXCLUDED.output_weapon, output_qty = EXCLUDED.output_qty, ingredients = EXCLUDED.ingredients, sources = EXCLUDED.sources, position = EXCLUDED.position;

-- previous block: 20260930100000_recipe_drops.sql
-- seed: recipe-drops
-- BEGIN GENERATED RECIPE DROPS (web/lib/crafting/seed.ts recipeDropsSql)
UPDATE crafting_recipes r SET drop_rarity = d.rarity FROM (VALUES
  ('rod-glass', 'rare'),
  ('net-silk', 'rare'),
  ('acc-shell-necklace', 'rare'),
  ('outfit-silk-sweater', 'rare'),
  ('furn-study-desk', 'rare'),
  ('furn-bench-park', 'rare'),
  ('furn-streetlamp', 'rare'),
  ('furn-plant-monstera', 'rare'),
  ('furn-wall-clock', 'rare'),
  ('furn-wall-frame', 'rare'),
  ('furn-lounge-rug', 'rare'),
  ('sword-iron', 'rare'),
  ('bow-yew', 'rare'),
  ('net-dragonfly', 'epic'),
  ('shovel-crystal', 'epic'),
  ('outfit-monarch-cape', 'epic'),
  ('bag-40', 'epic')
) AS d (id, rarity) WHERE r.id = d.id AND r.drop_rarity IS NULL;
INSERT INTO recipe_drop_chances (rarity, chance) VALUES ('rare', 0.02), ('epic', 0.05), ('legendary', 0.15)
ON CONFLICT (rarity) DO NOTHING;
-- END GENERATED RECIPE DROPS

-- previous block: 20261002052225_catalogue_seed.sql
-- seed: shop-icons
-- BEGIN GENERATED SHOP ICONS (web/scripts/gen-seeds.mjs)
UPDATE shop_items s SET sprite_url = v.url FROM (VALUES
  ('rod-basic', '/assets/icons/rod_flimsy.webp'),
  ('rod-cedar', '/assets/icons/rod_cedar.webp'),
  ('rod-glass', '/assets/icons/rod_glass.webp'),
  ('bobber-lucky', '/assets/icons/bobber-lucky.webp'),
  ('net-basic', '/assets/icons/net-basic.webp'),
  ('net-mid', '/assets/icons/net-mid.webp'),
  ('shovel-basic', '/assets/icons/shovel-basic.webp'),
  ('shovel-mid', '/assets/icons/shovel-mid.webp'),
  ('outfit-sage-overalls', '/assets/icons/onepiece_jumpsuit.webp'),
  ('outfit-cream-knit', '/assets/icons/top_sweater_vest.webp'),
  ('outfit-wharf-raincoat', '/assets/icons/top_raincoat.webp'),
  ('outfit-club-tee', '/assets/icons/top_tee.webp'),
  ('hair-chestnut', '/assets/icons/hair-chestnut.webp'),
  ('hair-sea-glass', '/assets/icons/hair-sea-glass.webp'),
  ('hair-sunset', '/assets/icons/hair-sunset.webp'),
  ('acc-straw-hat', '/assets/icons/acc_straw_hat.webp'),
  ('acc-round-glasses', '/assets/icons/acc_glasses_round.webp'),
  ('acc-bandana', '/assets/icons/acc_scarf.webp'),
  ('furn-lounge-sofa', '/assets/icons/lounge-sofa.webp'),
  ('furn-study-desk', '/assets/icons/study-desk.webp'),
  ('furn-study-chair', '/assets/icons/study-chair.webp'),
  ('furn-bookshelf', '/assets/icons/bookshelf.webp'),
  ('furn-floor-lamp', '/assets/icons/floor-lamp.webp'),
  ('furn-plant-monstera', '/assets/icons/plant-monstera.webp'),
  ('furn-lounge-rug', '/assets/icons/lounge-rug.webp'),
  ('furn-wall-clock', '/assets/icons/wall-clock.webp'),
  ('furn-wall-frame', '/assets/icons/wall-frame.webp'),
  ('furn-bench-park', '/assets/icons/bench-park.webp'),
  ('furn-streetlamp', '/assets/icons/streetlamp.webp'),
  ('furn-campfire', '/assets/icons/campfire.webp'),
  ('wall-stripe', '/assets/icons/wall-stripe02.webp'),
  ('wall-log', '/assets/icons/wall-log00.webp'),
  ('wall-brick', '/assets/icons/wall-brick00.webp'),
  ('floor-tatami', '/assets/icons/floor-tatami00.webp'),
  ('floor-carpet', '/assets/icons/floor-simplecarpet01.webp'),
  ('floor-plain', '/assets/icons/floor-simple00.webp'),
  ('merch-sticker-pack', '/assets/icons/merch-sticker-pack.webp'),
  ('merch-tote', '/assets/icons/merch-tote.webp'),
  ('bag-30', '/assets/icons/bag-30.webp'),
  ('wear-top-tee', '/assets/icons/top_tee.webp'),
  ('wear-top-hoodie', '/assets/icons/top_hoodie.webp'),
  ('wear-top-cardigan', '/assets/icons/top_cardigan.webp'),
  ('wear-top-stripe-ls', '/assets/icons/top_stripe_ls.webp'),
  ('wear-top-collar-shirt', '/assets/icons/top_collar_shirt.webp'),
  ('wear-top-sweater-vest', '/assets/icons/top_sweater_vest.webp'),
  ('wear-top-tsi-crew', '/assets/icons/top_tsi_crew.webp'),
  ('wear-top-raincoat', '/assets/icons/top_raincoat.webp'),
  ('wear-bottom-shorts', '/assets/icons/bottom_shorts.webp'),
  ('wear-bottom-trousers', '/assets/icons/bottom_trousers.webp'),
  ('wear-bottom-pleated-skirt', '/assets/icons/bottom_pleated_skirt.webp'),
  ('wear-bottom-overall-shorts', '/assets/icons/bottom_overall_shorts.webp'),
  ('wear-bottom-joggers', '/assets/icons/bottom_joggers.webp'),
  ('wear-bottom-long-skirt', '/assets/icons/bottom_long_skirt.webp'),
  ('wear-onepiece-raincape', '/assets/icons/onepiece_raincape.webp'),
  ('wear-onepiece-sundress', '/assets/icons/onepiece_sundress.webp'),
  ('wear-onepiece-robe', '/assets/icons/onepiece_robe.webp'),
  ('wear-onepiece-jumpsuit', '/assets/icons/onepiece_jumpsuit.webp'),
  ('wear-shoes-slipon', '/assets/icons/shoes_slipon.webp'),
  ('wear-shoes-sneakers', '/assets/icons/shoes_sneakers.webp'),
  ('wear-shoes-boots', '/assets/icons/shoes_boots.webp'),
  ('wear-shoes-sandals', '/assets/icons/shoes_sandals.webp'),
  ('wear-shoes-loafers', '/assets/icons/shoes_loafers.webp'),
  ('wear-shoes-rainboots', '/assets/icons/shoes_rainboots.webp'),
  ('wear-acc-glasses-round', '/assets/icons/acc_glasses_round.webp'),
  ('wear-acc-glasses-square', '/assets/icons/acc_glasses_square.webp'),
  ('wear-acc-beanie', '/assets/icons/acc_beanie.webp'),
  ('wear-acc-sunhat', '/assets/icons/acc_sunhat.webp'),
  ('wear-acc-cap', '/assets/icons/acc_cap.webp'),
  ('wear-acc-backpack', '/assets/icons/acc_backpack.webp'),
  ('wear-acc-shoulder-bag', '/assets/icons/acc_shoulder_bag.webp'),
  ('wear-acc-scarf', '/assets/icons/acc_scarf.webp'),
  ('dye-wheat-blonde', '/assets/icons/dye-6.webp'),
  ('dye-copper', '/assets/icons/dye-7.webp'),
  ('dye-rust-red', '/assets/icons/dye-8.webp'),
  ('dye-silver', '/assets/icons/dye-9.webp'),
  ('dye-blossom-pink', '/assets/icons/dye-10.webp'),
  ('dye-sea-blue', '/assets/icons/dye-11.webp'),
  ('furn-home-bed', '/assets/icons/home-bed.webp'),
  ('furn-closet', '/assets/icons/closet.webp'),
  ('furn-lounge-table', '/assets/icons/lounge-table.webp'),
  ('furn-reading-table', '/assets/icons/reading-table.webp'),
  ('furn-wooden-chest', '/assets/icons/wooden-chest.webp'),
  ('furn-color-box-shelf', '/assets/icons/color-box-shelf.webp'),
  ('furn-counter-register', '/assets/icons/counter-register.webp'),
  ('furn-barrel', '/assets/icons/barrel.webp'),
  ('furn-plant-yucca', '/assets/icons/plant-yucca.webp'),
  ('furn-antique-clock', '/assets/icons/antique-clock.webp'),
  ('furn-altar', '/assets/icons/altar.webp'),
  ('furn-remains-pillar', '/assets/icons/remains-pillar.webp'),
  ('furn-shopping-cart', '/assets/icons/shopping-cart.webp'),
  ('furn-windmill-retro', '/assets/icons/windmill-retro.webp'),
  ('furn-gold-hha-trophy', '/assets/icons/gold-hha-trophy.webp'),
  ('furn-candle', '/assets/icons/candle.webp'),
  ('furn-yellow-message-mat', '/assets/icons/yellow-message-mat.webp'),
  ('furn-acorn-rug', '/assets/icons/acorn-rug.webp'),
  ('furn-wall-driedflower', '/assets/icons/wall-driedflower.webp'),
  ('furn-bulletinboard', '/assets/icons/bulletinboard.webp'),
  ('furn-bench-wood', '/assets/icons/bench-wood.webp'),
  ('furn-fence-country-a', '/assets/icons/fence-country-a.webp'),
  ('furn-stone-lantern', '/assets/icons/stone-lantern.webp'),
  ('furn-beach-parasol', '/assets/icons/beach-parasol.webp'),
  ('furn-beach-bed', '/assets/icons/beach-bed.webp'),
  ('furn-bush-azalea', '/assets/icons/bush-azalea.webp'),
  ('furn-flower-tulip', '/assets/icons/flower-tulip.webp'),
  ('furn-flower-rose', '/assets/icons/flower-rose.webp'),
  ('furn-tree-hardwood-a', '/assets/icons/tree-hardwood-a.webp'),
  ('furn-silver-hha-trophy', '/assets/icons/silver-hha-trophy.webp'),
  ('furn-lounge-tea', '/assets/icons/lounge-tea.webp'),
  ('furn-tree-cedar-snow', '/assets/icons/tree-cedar-snow.webp'),
  ('furn-monument-banner', '/assets/icons/monument-banner.webp'),
  ('furn-beach-towel', '/assets/icons/beach-towel.webp'),
  ('rod-lighthouse', '/assets/icons/rod_lighthouse.webp'),
  ('rod-tidewarden', '/assets/icons/rod_tidewarden.webp'),
  ('net-silk', '/assets/icons/net-silk.webp'),
  ('net-dragonfly', '/assets/icons/net-dragonfly.webp'),
  ('net-emperor', '/assets/icons/net-emperor.webp'),
  ('shovel-sturdy', '/assets/icons/shovel-sturdy.webp'),
  ('shovel-crystal', '/assets/icons/shovel-crystal.webp'),
  ('shovel-gold', '/assets/icons/shovel-gold.webp'),
  ('acc-flower-crown', '/assets/icons/acc_flower_crown.webp'),
  ('acc-shell-necklace', '/assets/icons/acc_shell_necklace.webp'),
  ('acc-crystal-circlet', '/assets/icons/acc_crystal_circlet.webp'),
  ('outfit-silk-sweater', '/assets/icons/outfit_silk_sweater.webp'),
  ('outfit-monarch-cape', '/assets/icons/outfit_monarch_cape.webp'),
  ('outfit-koi-kimono', '/assets/icons/outfit_koi_kimono.webp'),
  ('glider-leaf', '/assets/icons/glider_leaf.webp'),
  ('bag-40', '/assets/icons/bag-40.webp'),
  ('card-shovel-sturdy', '/assets/icons/recipe_card.webp'),
  ('card-acc-flower-crown', '/assets/icons/recipe_card.webp'),
  ('card-furn-bookshelf', '/assets/icons/recipe_card.webp'),
  ('card-furn-floor-lamp', '/assets/icons/recipe_card.webp')
) AS v (slug, url) WHERE s.slug = v.slug AND s.sprite_url IS DISTINCT FROM v.url AND (s.sprite_url IS NULL OR s.sprite_url LIKE '/assets/icons/%');
-- END GENERATED SHOP ICONS
