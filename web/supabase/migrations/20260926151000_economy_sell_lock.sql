-- ─── 037 economy_sell: serialise same-key retries ───────────────────────────
--
-- DRAFT 2026-09-26. NOT APPLIED. Apply after 20260926150900_collections_server_only.
-- Spec: specs/cleanup-and-game-security.md item 2 (audit R3).
--
-- 033's economy_sell checked the replay key before taking any lock. A retry
-- arriving while the first call was still open passed the check, waited on the
-- member_collections row, took the items again, and then wallet_apply replayed
-- without paying: items gone twice, coins once. Taking a transaction-scoped
-- advisory lock on (member, key) first makes the retry wait and then replay.
-- Body otherwise unchanged from 033.
-- Test: web/supabase/tests/game_security_smoke.sql section 2.

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
  UPDATE member_collections mc SET count = mc.count - p_qty, updated_at = NOW()
   WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key AND mc.count >= p_qty
  RETURNING mc.count INTO v_have;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_items'; END IF;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', v_price * p_qty, 'sell', p_item_key, v_key) a;
  RETURN QUERY SELECT v_bal, v_have, v_price * p_qty, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.economy_sell(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_sell(UUID, TEXT, INTEGER, TEXT) TO service_role;
