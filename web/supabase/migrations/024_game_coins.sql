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
