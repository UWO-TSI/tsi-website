-- ─── 038 wallet_apply keeps the legacy Gem transaction types ────────────────
--
-- DRAFT 2026-09-26. NOT APPLIED. Apply after 20260926151000_economy_sell_lock.
-- Spec: specs/cleanup-and-game-security.md item 3 (audit R4).
--
-- The pre-game Gem writers (bounty and achievement rewards, onboarding bonus,
-- marketplace and avatar purchases, T1/T2 awards) read-modify-wrote
-- profiles.tethos_coins without a lock or key and raced wallet_apply's Gem
-- branch. They now call wallet_apply; a p_source that is already a
-- tc_transactions type (earn_bounty, spend_marketplace, ...) is recorded as
-- that type so the Gem history keeps its labels. Body otherwise unchanged from 033.
-- Test: game_security_smoke.sql section 3; lib/wallet/economy.test.ts "one write path".

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
    v_type := CASE WHEN p_source ~ '^(earn|spend|refund)_' THEN p_source
                   WHEN p_source = 'shop' THEN 'spend_shop' WHEN p_source = 'merch' THEN 'spend_merch' WHEN p_source = 'refund' THEN 'refund_merch'
                   WHEN p_source = 'event' THEN 'earn_event' WHEN p_source = 'quest' THEN 'earn_quest' ELSE 'earn_admin' END;
    INSERT INTO tc_transactions (user_id, amount, balance_after, type, description, idempotency_key)
    VALUES (p_member_id, p_amount, v_bal + p_amount, v_type, p_ref, p_idempotency_key);
    UPDATE profiles p SET tethos_coins = v_bal + p_amount WHERE p.id = p_member_id;
    RETURN QUERY SELECT v_bal + p_amount, FALSE;
  ELSE
    RAISE EXCEPTION 'bad_currency';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_apply(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_apply(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) TO service_role;
