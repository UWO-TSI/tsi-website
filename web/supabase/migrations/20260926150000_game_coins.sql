-- ─── Game coins wallet (Economy v2, specs/economy-v2-currencies.md) ────
--
-- DRAFT 2026-07-25 — NOT YET APPLIED. Apply with the launch-window batch.
--
-- The in-game play currency (displayed "TC 🪙"), earned by selling catches
-- at the Wharf Shack. This is NOT the money tier: the legacy tc_balance
-- column is the money-equivalent wallet (displayed "Gems 💎" since the
-- 2026-07-25 rename). Coins never convert to gems or CAD — there is no
-- code path and there must never be one.
--
-- Members can read their own coins via the existing profiles RLS, but
-- CANNOT write the column directly (column-level revoke): all earning
-- goes through the SECURITY DEFINER earn_coins() with a per-call cap,
-- so a malicious client can't self-inflate the wallet.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.coins IS
  'Play-currency wallet (TC): earned via earn_coins() only; never converts to gems or CAD.';

-- Column-level write protection: the generic self-update profile policy
-- must not allow direct coin writes.
REVOKE UPDATE (coins) ON public.profiles FROM authenticated;

-- Earn path: capped per call (max single sale ≈ sea king 2500 × 1.25).
CREATE OR REPLACE FUNCTION public.earn_coins(p_amount INTEGER, p_reason TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  IF p_amount < 1 OR p_amount > 4000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.profiles
     SET coins = coins + p_amount
   WHERE id = auth.uid()
  RETURNING coins INTO new_balance;
  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.earn_coins(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.earn_coins(INTEGER, TEXT) TO authenticated;


-- ═══ E4 additions (2026-07-25, still DRAFT — same launch-window batch) ═══

-- Server-side price authority: the client's SELL_PRICES table mirrors
-- this (lib/game/fishing.ts). Reference data — readable, never writable.
CREATE TABLE IF NOT EXISTS public.fish_prices (
  item_key TEXT PRIMARY KEY,
  rarity TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0)
);
ALTER TABLE public.fish_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Fish prices readable" ON public.fish_prices;
CREATE POLICY "Fish prices readable" ON public.fish_prices FOR SELECT USING (true);

INSERT INTO public.fish_prices (item_key, rarity, price) VALUES
  ('fish_anchovy', 'common', 8),
  ('fish_angelfish', 'uncommon', 20),
  ('fish_arapaima', 'epic', 180),
  ('fish_arowana', 'epic', 180),
  ('fish_barred_knifejaw', 'uncommon', 20),
  ('fish_barreleye', 'epic', 180),
  ('fish_betta', 'uncommon', 20),
  ('fish_bichir', 'rare', 60),
  ('fish_bitterling', 'common', 8),
  ('fish_black_bass', 'rare', 60),
  ('fish_blowfish', 'uncommon', 20),
  ('fish_blue_marlin', 'epic', 180),
  ('fish_bluegill', 'uncommon', 20),
  ('fish_butterfly_fish', 'uncommon', 20),
  ('fish_carp', 'uncommon', 20),
  ('fish_catfish', 'epic', 180),
  ('fish_char', 'rare', 60),
  ('fish_clown_fish', 'common', 8),
  ('fish_coelacanth', 'legendary', 600),
  ('fish_crayfish', 'common', 8),
  ('fish_crucian_carp', 'uncommon', 20),
  ('fish_dab', 'common', 8),
  ('fish_dace', 'common', 8),
  ('fish_doctor_fish', 'uncommon', 20),
  ('fish_dorado', 'epic', 180),
  ('fish_football_fish', 'rare', 60),
  ('fish_freshwater_goby', 'common', 8),
  ('fish_frog', 'common', 8),
  ('fish_gar', 'epic', 180),
  ('fish_giant_trevally', 'rare', 60),
  ('fish_golden_arowana', 'legendary', 600),
  ('fish_golden_koi', 'legendary', 600),
  ('fish_golden_trout', 'legendary', 600),
  ('fish_goldfish', 'uncommon', 20),
  ('fish_great_white_shark', 'epic', 180),
  ('fish_guppy', 'common', 8),
  ('fish_hammerhead_shark', 'legendary', 600),
  ('fish_horse_mackerel', 'common', 8),
  ('fish_killifish', 'common', 8),
  ('fish_king_salmon', 'epic', 180),
  ('fish_loach', 'common', 8),
  ('fish_mahi_mahi', 'rare', 60),
  ('fish_mitten_crab', 'uncommon', 20),
  ('fish_moray_eel', 'uncommon', 20),
  ('fish_napoleonfish', 'epic', 180),
  ('fish_neon_tetra', 'common', 8),
  ('fish_oarfish', 'epic', 180),
  ('fish_ocean_sunfish', 'epic', 180),
  ('fish_olive_flounder', 'uncommon', 20),
  ('fish_pale_chub', 'common', 8),
  ('fish_pike', 'rare', 60),
  ('fish_piranha', 'rare', 60),
  ('fish_pond_smelt', 'common', 8),
  ('fish_pop_eyed_goldfish', 'uncommon', 20),
  ('fish_porcupine_fish', 'uncommon', 20),
  ('fish_rainbow_trout', 'uncommon', 20),
  ('fish_ranchu_goldfish', 'uncommon', 20),
  ('fish_ray', 'rare', 60),
  ('fish_red_snapper', 'uncommon', 20),
  ('fish_ribbon_eel', 'uncommon', 20),
  ('fish_salmon', 'uncommon', 20),
  ('fish_saw_shark', 'epic', 180),
  ('fish_sea_bass', 'common', 8),
  ('fish_sea_butterfly', 'common', 8),
  ('fish_seahorse', 'uncommon', 20),
  ('fish_snakehead', 'rare', 60),
  ('fish_snapping_turtle', 'rare', 60),
  ('fish_soft_shelled_turtle', 'uncommon', 20),
  ('fish_squid', 'common', 8),
  ('fish_stringfish', 'legendary', 600),
  ('fish_sturgeon', 'legendary', 600),
  ('fish_suckerfish', 'uncommon', 20),
  ('fish_surgeonfish', 'common', 8),
  ('fish_sweetfish', 'uncommon', 20),
  ('fish_tadpole', 'common', 8),
  ('fish_tilapia', 'uncommon', 20),
  ('fish_tuna', 'epic', 180),
  ('fish_whale_shark', 'epic', 180),
  ('fish_yamame_trout', 'uncommon', 20),
  ('fish_yellow_perch', 'common', 8),
  ('fish_zebra_turkeyfish', 'uncommon', 20),
  ('sea_abalone', 'rare', 60),
  ('sea_barnacle', 'common', 8),
  ('sea_dungeness_crab', 'uncommon', 20),
  ('sea_firefly_squid', 'uncommon', 20),
  ('sea_garden_eel', 'uncommon', 20),
  ('sea_giant_isopod', 'epic', 180),
  ('sea_pearl_oyster', 'rare', 60),
  ('sea_scallop', 'common', 8),
  ('sea_sea_star', 'common', 8),
  ('sea_sweet_shrimp', 'common', 8)
ON CONFLICT (item_key) DO UPDATE SET rarity = EXCLUDED.rarity, price = EXCLUDED.price;

-- Atomic sale: decrement the catch stack + credit coins in one call.
-- Prices resolve server-side (fish_prices) — a client can never name its
-- own price. Row lock prevents double-sell races.
CREATE OR REPLACE FUNCTION public.sell_catches(p_key TEXT, p_qty INTEGER)
RETURNS TABLE (coins INTEGER, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price INTEGER;
  v_have INTEGER;
  v_paid INTEGER;
  v_balance INTEGER;
  v_remaining INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_qty < 1 OR p_qty > 200 THEN
    RAISE EXCEPTION 'invalid qty';
  END IF;
  SELECT fp.price INTO v_price FROM public.fish_prices fp WHERE fp.item_key = p_key;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'not sellable';
  END IF;
  SELECT mc.count INTO v_have
    FROM public.member_collections mc
   WHERE mc.user_id = auth.uid() AND mc.item_key = p_key
   FOR UPDATE;
  IF v_have IS NULL OR v_have < p_qty THEN
    RAISE EXCEPTION 'not enough';
  END IF;
  UPDATE public.member_collections mc
     SET count = mc.count - p_qty, updated_at = NOW()
   WHERE mc.user_id = auth.uid() AND mc.item_key = p_key
  RETURNING mc.count INTO v_remaining;
  v_paid := LEAST(v_price * p_qty, 10000);
  UPDATE public.profiles p
     SET coins = p.coins + v_paid
   WHERE p.id = auth.uid()
  RETURNING p.coins INTO v_balance;
  RETURN QUERY SELECT v_balance, v_remaining;
END;
$$;
REVOKE ALL ON FUNCTION public.sell_catches(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_catches(TEXT, INTEGER) TO authenticated;

-- Gear: owned rod/tackle keys on the profile. Same write protection as
-- coins — all purchases through buy_gear().
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gear JSONB NOT NULL DEFAULT '[]'::jsonb;
REVOKE UPDATE (gear) ON public.profiles FROM authenticated;

CREATE TABLE IF NOT EXISTS public.gear_prices (
  item_key TEXT PRIMARY KEY,
  price INTEGER NOT NULL CHECK (price > 0)
);
ALTER TABLE public.gear_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gear prices readable" ON public.gear_prices;
CREATE POLICY "Gear prices readable" ON public.gear_prices FOR SELECT USING (true);

INSERT INTO public.gear_prices (item_key, price) VALUES
  ('rod_cedar', 350),
  ('rod_glass', 1200),
  ('bobber_lucky', 600)
ON CONFLICT (item_key) DO UPDATE SET price = EXCLUDED.price;

-- Buy gear: debit coins + append the item, atomically. Cosmetic flair
-- only (design principle #4) — gear never gates mechanics.
CREATE OR REPLACE FUNCTION public.buy_gear(p_item TEXT)
RETURNS TABLE (coins INTEGER, gear JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price INTEGER;
  v_balance INTEGER;
  v_gear JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT gp.price INTO v_price FROM public.gear_prices gp WHERE gp.item_key = p_item;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'unknown item';
  END IF;
  SELECT p.coins, p.gear INTO v_balance, v_gear
    FROM public.profiles p WHERE p.id = auth.uid() FOR UPDATE;
  IF v_gear ? p_item THEN
    RAISE EXCEPTION 'already owned';
  END IF;
  IF v_balance < v_price THEN
    RAISE EXCEPTION 'not enough coins';
  END IF;
  UPDATE public.profiles p
     SET coins = p.coins - v_price,
         gear = p.gear || to_jsonb(p_item)
   WHERE p.id = auth.uid()
  RETURNING p.coins, p.gear INTO v_balance, v_gear;
  RETURN QUERY SELECT v_balance, v_gear;
END;
$$;
REVOKE ALL ON FUNCTION public.buy_gear(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_gear(TEXT) TO authenticated;
