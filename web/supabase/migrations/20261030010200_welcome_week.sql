-- d-streak (specs/launch/v1-gameplay.md; David 2026-10-28: "see the reward for logging in each day ... in the end user
-- gets a total of like 1500 coins, 25 gems, and mystery box with a wheel that spins for gear/clothing"): a new member's
-- welcome week rides the daily gift. Their first seven gift days (log-in days, not necessarily in a row) each bring the
-- track's reward, shown ahead of time on the gift card (lib/wallet/catalogue.ts WELCOME_TRACK mirrors this):
--   day 1 200 coins, day 2 300 coins, day 3 5 Gems, day 4 400 coins, day 5 10 Gems, day 6 600 coins,
--   day 7 the mystery box and 10 Gems (1500 coins and 25 Gems over the week).
-- The box is one random prize the member doesn't own yet, spun on a wheel: clothing (an active special_pool outfit, hair,
-- face or accessory priced in coins at no more than welcome_box_coins) or gear (the second-tier rod, net and shovel);
-- welcome_box_coins in coins when there's nothing left. Furniture joins only when welcome_box_furniture is 1 (homes are
-- closed: flip it when they open). Never Contraband (staff-only), merch, wallpaper, flooring or gem items (boxPool
-- mirrors this). Rolled here, once: the daily claim row makes it once a day, the ledger keys once per welcome day. Gems
-- go through wallet_apply as earn_streak. The settings rows come with the economy seed (lib/wallet/catalogue.ts SETTINGS).
-- The return type grows, so the function is dropped and made again.

DROP FUNCTION IF EXISTS public.daily_gift_claim(UUID);
CREATE FUNCTION public.daily_gift_claim(p_member_id UUID)
RETURNS TABLE (coins INTEGER, balance INTEGER, claimed BOOLEAN, day DATE, welcome_day INTEGER, welcome_coins INTEGER, welcome_gems INTEGER, welcome_item TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_day DATE := (NOW() AT TIME ZONE 'America/Toronto')::DATE;
  v_amount INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'daily_gift_coins'), 10);
  v_bal INTEGER;
  v_n INTEGER;
  v_bonus INTEGER := 0;
  v_gems INTEGER := 0;
  v_item shop_items%ROWTYPE;
BEGIN
  -- Row 225: doubled on Fridays (Toronto calendar day).
  IF EXTRACT(ISODOW FROM v_day) = 5 THEN v_amount := v_amount * 2; END IF;
  INSERT INTO daily_login_claims (member_id, day, coins) VALUES (p_member_id, v_day, v_amount) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    SELECT COALESCE((SELECT w.coins FROM wallets w WHERE w.member_id = p_member_id), 0) INTO v_bal;
    RETURN QUERY SELECT 0, v_bal, FALSE, v_day, NULL::INTEGER, 0, 0, NULL::TEXT; RETURN;
  END IF;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', v_amount, 'daily_gift', v_day::TEXT, 'daily:' || v_day) a;

  SELECT COUNT(*) INTO v_n FROM daily_login_claims c WHERE c.member_id = p_member_id;
  IF v_n > 7 THEN
    RETURN QUERY SELECT v_amount, v_bal, TRUE, v_day, NULL::INTEGER, 0, 0, NULL::TEXT; RETURN;
  END IF;
  v_bonus := (ARRAY[200, 300, 0, 400, 0, 600, 0])[v_n];
  v_gems := (ARRAY[0, 0, 5, 0, 10, 0, 10])[v_n];
  IF v_n = 7 THEN
    SELECT i.* INTO v_item FROM shop_items i
    WHERE i.active AND i.price_coins IS NOT NULL AND i.retired_at IS NULL
      AND ((i.special_pool AND i.price_coins <= COALESCE((SELECT value FROM economy_settings WHERE key = 'welcome_box_coins'), 300)
            AND (i.category IN ('outfit', 'hair', 'face', 'accessory')
                 OR (i.category = 'furniture' AND COALESCE((SELECT value FROM economy_settings WHERE key = 'welcome_box_furniture'), 0) = 1)))
           OR i.slug IN ('rod-cedar', 'net-mid', 'shovel-mid'))
      AND (i.stackable OR NOT EXISTS (SELECT 1 FROM member_inventory m WHERE m.member_id = p_member_id AND m.item_id = i.id))
    ORDER BY random() LIMIT 1;
    IF FOUND THEN
      INSERT INTO member_inventory (member_id, item_id, qty, slot) VALUES (p_member_id, v_item.id, 1, v_item.slot)
      ON CONFLICT (member_id, item_id) DO UPDATE SET qty = member_inventory.qty + 1;
    ELSE
      v_bonus := COALESCE((SELECT value FROM economy_settings WHERE key = 'welcome_box_coins'), 300);
    END IF;
  END IF;
  IF v_bonus > 0 THEN
    SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', v_bonus, 'daily_gift', 'welcome:' || v_n, 'welcome:' || v_n) a;
  END IF;
  IF v_gems > 0 THEN
    PERFORM public.wallet_apply(p_member_id, 'gems', v_gems, 'earn_streak', 'Welcome week, day ' || v_n, 'welcome-gems:' || v_n);
  END IF;
  RETURN QUERY SELECT v_amount, v_bal, TRUE, v_day, v_n, v_bonus, v_gems, v_item.slug;
END;
$$;

DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.daily_gift_claim(UUID) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.daily_gift_claim(UUID) TO service_role;
END $$;
