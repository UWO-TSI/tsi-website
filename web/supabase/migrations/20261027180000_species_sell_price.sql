-- Per-species sell prices (David, 2026-10-27: "edit rarity and price sold" per fish, bug, fruit...; the catalogue
-- editor, specs/tools/catalogue-editor). collection_species.sell_price, when set, is what one of that species
-- sells for; NULL keeps the category and rarity's price (sell_prices). The roster's `price` (lib/collections/roster.ts)
-- sets it through the generated block below (lib/seedMigrations.ts "species-prices"). Idempotent.

ALTER TABLE collection_species ADD COLUMN IF NOT EXISTS sell_price INTEGER CHECK (sell_price > 0);

-- 20261003054110's sale, paying the species' own price when it has one.
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
  SELECT s.category, s.rarity, s.sell_price INTO v_cat, v_rarity, v_price FROM collection_species s WHERE s.key = p_item_key;
  IF v_cat IS NULL AND to_regclass('public.fish_prices') IS NOT NULL THEN
    EXECUTE 'SELECT ''fish'', rarity FROM public.fish_prices WHERE item_key = $1' INTO v_cat, v_rarity USING p_item_key;
    IF v_rarity = 'seaking' THEN v_rarity := 'legendary'; END IF;
  END IF;
  IF v_price IS NULL THEN
    SELECT sp.price INTO v_price FROM sell_prices sp WHERE sp.category = v_cat AND sp.rarity = v_rarity;
  END IF;
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

-- BEGIN GENERATED SPECIES PRICES (web/scripts/gen-seeds.mjs)
UPDATE collection_species SET sell_price = NULL WHERE sell_price IS NOT NULL;
-- END GENERATED SPECIES PRICES
