-- The tackle shop's rolls (David, 2026-10-28: "the tackle shop should be like a gatcha roll for parts thing one for coin
-- one for gem, roll for 1 to 10, seasonal crazy bait and rod"). The server rolls each pull (lib/wallet/tackle.ts
-- rollTackle, a secure random, by the odds the counter shows) and prices it; tackle_roll charges the coins or Gems,
-- grants each prize into the member's inventory and records the roll, once per idempotency key (a replay returns the
-- first roll's prizes and charges nothing). Service role only.
-- The prizes are shop rows off sale (active FALSE, so the shop never lists them), stacking, in rod-gear's add-on slots
-- (bait, bobber; 20261030010600_rod_tackle_slots.sql widens the same check the same way) or the rod
-- slot, valued in coins by rarity (shop_items needs one price; nothing sells them). Their pictures are stand-ins until their models are made. Rows from lib/wallet/tackle.ts TACKLE_PRIZES.
-- Idempotent.

ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_slot_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_slot_check
  CHECK (slot IS NULL OR slot IN ('rod', 'net', 'shovel', 'pickaxe', 'outfit', 'hair', 'accessory', 'bait', 'bobber'));

INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, sprite_url, rarity, position, active) VALUES
  ('bait_worm', 'Sea worm', 'tool', 'Fish bite a little sooner.', 50, NULL, NULL, 'bait', FALSE, TRUE, NULL, 'bait_worm', '/assets/icons/bug_bagworm.webp', 'common', 9001, FALSE),
  ('bait_clam', 'Clam bait', 'tool', 'A little more time to hook a bite.', 50, NULL, NULL, 'bait', FALSE, TRUE, NULL, 'bait_clam', '/assets/icons/shell_asari.webp', 'common', 9002, FALSE),
  ('bobber_cork', 'Cork bobber', 'tool', 'A slightly wider catch bar.', 50, NULL, NULL, 'bobber', FALSE, TRUE, NULL, 'bobber_cork', '/assets/icons/bobber-lucky.webp', 'common', 9003, FALSE),
  ('bait_shrimp', 'Shrimp bait', 'tool', 'Bites come sooner and stay longer.', 150, NULL, NULL, 'bait', FALSE, TRUE, NULL, 'bait_shrimp', '/assets/icons/sea_sweet_shrimp.webp', 'uncommon', 9004, FALSE),
  ('bobber_float', 'Striped float', 'tool', 'Easier to hook and to hold.', 150, NULL, NULL, 'bobber', FALSE, TRUE, NULL, 'bobber_float', '/assets/icons/bobber-lucky.webp', 'uncommon', 9005, FALSE),
  ('bait_glow_grub', 'Glow grub', 'tool', 'Rarer fish come to the light.', 400, NULL, NULL, 'bait', FALSE, TRUE, NULL, 'bait_glow_grub', '/assets/icons/bug_firefly.webp', 'rare', 9006, FALSE),
  ('bobber_brass', 'Brass bobber', 'tool', 'The line holds when a fish pulls.', 400, NULL, NULL, 'bobber', FALSE, TRUE, NULL, 'bobber_brass', '/assets/icons/bobber-lucky.webp', 'rare', 9007, FALSE),
  ('bait_squid_jig', 'Squid jig', 'tool', 'Big, rare fish can''t resist it.', 1000, NULL, NULL, 'bait', FALSE, TRUE, NULL, 'bait_squid_jig', '/assets/icons/sea_firefly_squid.webp', 'epic', 9008, FALSE),
  ('bobber_pearl', 'Pearl bobber', 'tool', 'Luckier casts and a steadier bar.', 1000, NULL, NULL, 'bobber', FALSE, TRUE, NULL, 'bobber_pearl', '/assets/icons/bobber-lucky.webp', 'epic', 9009, FALSE),
  ('bait_candy_corn', 'Candy corn bait', 'tool', 'Autumn only. Fish go wild for it.', 2500, NULL, NULL, 'bait', FALSE, TRUE, NULL, 'bait_candy_corn', '/assets/icons/treat_candy_corn.webp', 'legendary', 9010, FALSE),
  ('rod_pumpkin', 'Pumpkin rod', 'tool', 'Autumn only. A whole rod, and a lucky one.', 2500, NULL, NULL, 'rod', FALSE, TRUE, NULL, 'rod_pumpkin', '/assets/icons/rod_cedar.webp', 'legendary', 9011, FALSE),
  ('bait_snowflake', 'Snowflake jig', 'tool', 'Winter only. Bites wait for you.', 2500, NULL, NULL, 'bait', FALSE, TRUE, NULL, 'bait_snowflake', '/assets/icons/rock_crystal.webp', 'legendary', 9012, FALSE),
  ('rod_icicle', 'Icicle rod', 'tool', 'Winter only. A whole rod with a long bite window.', 2500, NULL, NULL, 'rod', FALSE, TRUE, NULL, 'rod_icicle', '/assets/icons/rod_glass.webp', 'legendary', 9013, FALSE),
  ('bait_blossom', 'Blossom fly', 'tool', 'Spring only. Fish rise for it at once.', 2500, NULL, NULL, 'bait', FALSE, TRUE, NULL, 'bait_blossom', '/assets/icons/flower_cosmos.webp', 'legendary', 9014, FALSE),
  ('rod_bamboo', 'Bamboo shoot rod', 'tool', 'Spring only. A whole rod that lures fish in.', 2500, NULL, NULL, 'rod', FALSE, TRUE, NULL, 'rod_bamboo', '/assets/icons/rod_cedar.webp', 'legendary', 9015, FALSE),
  ('bait_firefly', 'Firefly lure', 'tool', 'Summer only. Lights up the rarest fish.', 2500, NULL, NULL, 'bait', FALSE, TRUE, NULL, 'bait_firefly', '/assets/icons/bug_firefly.webp', 'legendary', 9016, FALSE),
  ('rod_sunburst', 'Sunburst rod', 'tool', 'Summer only. A whole rod, strong and bright.', 2500, NULL, NULL, 'rod', FALSE, TRUE, NULL, 'rod_sunburst', '/assets/icons/rod_glass.webp', 'legendary', 9017, FALSE)
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, slot = EXCLUDED.slot, stackable = TRUE,
  catalogue_ref = EXCLUDED.catalogue_ref, sprite_url = EXCLUDED.sprite_url, rarity = EXCLUDED.rarity, active = FALSE, price_coins = EXCLUDED.price_coins, tc_price = NULL;

CREATE TABLE IF NOT EXISTS tackle_rolls (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 6 AND 200),
  currency TEXT NOT NULL CHECK (currency IN ('coins', 'gems')),
  cost INTEGER NOT NULL CHECK (cost > 0),
  prizes TEXT[] NOT NULL CHECK (cardinality(prizes) BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, idempotency_key)
);
ALTER TABLE tackle_rolls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tackle rolls readable by owner" ON tackle_rolls;
CREATE POLICY "Tackle rolls readable by owner" ON tackle_rolls FOR SELECT USING ((select auth.uid()) = member_id);
REVOKE INSERT, UPDATE, DELETE ON tackle_rolls FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.tackle_roll(p_member_id UUID, p_currency TEXT, p_cost INTEGER, p_prizes TEXT[], p_idempotency_key TEXT)
RETURNS TABLE (balance INTEGER, prizes TEXT[], replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  r tackle_rolls%ROWTYPE;
  v_bal INTEGER;
  v_slug TEXT;
  it shop_items%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_member_id::TEXT || ':tackle:' || p_idempotency_key));
  SELECT * INTO r FROM tackle_rolls t WHERE t.member_id = p_member_id AND t.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    v_bal := CASE r.currency WHEN 'coins' THEN (SELECT w.coins FROM wallets w WHERE w.member_id = p_member_id) ELSE (SELECT p.tethos_coins FROM profiles p WHERE p.id = p_member_id) END;
    RETURN QUERY SELECT COALESCE(v_bal, 0), r.prizes, TRUE; RETURN;
  END IF;
  IF p_currency NOT IN ('coins', 'gems') OR p_cost < 1 OR p_cost > 100000 OR cardinality(p_prizes) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'bad_qty'; END IF;
  -- Only the off-sale prize rows can be granted this way.
  IF EXISTS (SELECT 1 FROM unnest(p_prizes) s LEFT JOIN shop_items i ON i.slug = s WHERE i.id IS NULL OR i.active OR NOT i.stackable OR i.category <> 'tool') THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, p_currency, -p_cost, 'shop', 'tackle:' || cardinality(p_prizes), 'tackle:' || p_idempotency_key) a;
  FOREACH v_slug IN ARRAY p_prizes LOOP
    SELECT * INTO it FROM shop_items WHERE slug = v_slug;
    INSERT INTO member_inventory (member_id, item_id, qty, slot) VALUES (p_member_id, it.id, 1, it.slot)
    ON CONFLICT (member_id, item_id) DO UPDATE SET qty = member_inventory.qty + 1;
  END LOOP;
  INSERT INTO tackle_rolls (member_id, idempotency_key, currency, cost, prizes) VALUES (p_member_id, p_idempotency_key, p_currency, p_cost, p_prizes);
  RETURN QUERY SELECT v_bal, p_prizes, FALSE;
END;
$$;
REVOKE ALL ON FUNCTION public.tackle_roll(uuid, text, integer, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tackle_roll(uuid, text, integer, text[], text) TO service_role;
