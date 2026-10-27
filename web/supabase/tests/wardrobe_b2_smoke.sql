-- Wardrobe batch 2 and David's pricing of 2026-10-17 (20261017172740_catalogue_seed; specs/wardrobe/batch2-pricing.json,
-- Gem prices x10; round 2: #22 its ushanka and goggles alone at 200 Gems, #07 in silver; the colour wheel a 250-Gem row;
-- the avatar effect at 250). Throwaway local Postgres after every
-- migration (supabase_stub.sql first), after wardrobe_cut_smoke.sql. Never Supabase. Fails before the migration: no
-- batch-2 row exists, and a whole face cannot be a shop row (the category check refuses 'face').
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000033b0', 'b2-buyer@x'),
  ('00000000-0000-4000-8000-0000000033b1', 'b2-new@x');

DO $$
BEGIN
  -- Every priced item is one row at David's price: 5 hairstyles, 22 accessories (#22's ushanka and goggles, #07 in silver),
  -- 4 whole faces (#12 and #13 deleted, #22's hair removed). Hair shelf (David, 2026-10-27): four more hairstyles on sale at
  -- 350 coins, and Wavy half-up removed (its row stays, off sale).
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799) = 35, 'thirty-five batch-2 rows (the wavy half-up row kept, off sale)';
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799 AND category = 'hair' AND slug LIKE 'wear-hair-%' AND active) = 8, 'eight hairstyles on sale';
  ASSERT NOT (SELECT active FROM shop_items WHERE slug = 'wear-hair-wavy-half-up'), 'wavy half-up is off sale';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug IN ('wear-hair-baby-sprout', 'wear-hair-layered-shag', 'wear-hair-swept-fringe', 'wear-hair-vkei') AND price_coins = 350 AND active) = 4, 'four more hairstyles at 350 coins';
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799 AND category = 'accessory') = 22, 'twenty-two accessories';
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799 AND category = 'face' AND catalogue_ref LIKE 'face:%') = 4, 'four whole faces';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE position BETWEEN 600 AND 799 AND slug <> 'wear-hair-wavy-half-up' AND (NOT active OR coalesce(starter_qty, 0) > 0)), 'all sold but the removed wavy half-up, none a starter';
  -- One price each: coins in price_coins, Gems in tc_price (shop_items_one_price).
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE position BETWEEN 600 AND 799 AND (price_coins IS NULL) = (tc_price IS NULL)), 'one currency each';
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799 AND tc_price IS NOT NULL) = 12, 'twelve in Gems (2 hairstyles, 10 accessories)';
  ASSERT (SELECT tc_price = 200 AND price_coins IS NULL AND category = 'accessory' AND catalogue_ref = 'acc_ushanka_goggles' FROM shop_items WHERE slug = 'wear-acc-ushanka-goggles'), '#22 is its ushanka and goggles, 200 Gems';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug = 'wear-hair-goggle-ushanka' OR catalogue_ref = 'hair_goggle_ushanka'), '#22''s hair is gone';
  ASSERT (SELECT price_coins = 350 FROM shop_items WHERE slug = 'wear-hair-ribbon-bob'), '#23 is 350 coins';
  ASSERT (SELECT price_coins = 250 FROM shop_items WHERE slug = 'wear-acc-propeller-cap'), 'acc #01 is 250 coins';
  ASSERT (SELECT tc_price = 50 FROM shop_items WHERE slug = 'wear-acc-paper-tie'), 'acc #03 is 50 Gems';
  ASSERT (SELECT tc_price = 100 FROM shop_items WHERE slug = 'wear-acc-bear-hood'), 'acc #20 is 100 Gems';
  ASSERT (SELECT price_coins = 50 FROM shop_items WHERE slug = 'wear-acc-half-rim-glasses'), 'acc #07 is 50 coins';
  ASSERT (SELECT price_coins = 50 AND catalogue_ref = 'acc_half_rim_glasses_silver' FROM shop_items WHERE slug = 'wear-acc-half-rim-glasses-silver'), '#07 in silver at #07''s price';
  ASSERT (SELECT tc_price = 200 FROM shop_items WHERE slug = 'wear-acc-red-band-straw-hat'), 'acc #24 is 200 Gems';
  ASSERT (SELECT bool_and(tc_price IN (50, 100, 200)) FROM shop_items WHERE position BETWEEN 600 AND 799 AND tc_price IS NOT NULL), 'Gem prices x10';
  ASSERT (SELECT price_coins = 250 AND catalogue_ref = 'face:silly_cat' FROM shop_items WHERE slug = 'face-silly-cat'), 'face #20 is 250 coins';
  -- Free items have no row (the starting creator offers them); #16 is skipped; coin rows can be a daily special, Gem rows not.
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE catalogue_ref IN ('acc_thin_glasses', 'face:silly', 'face:silly_smile')), 'free items unsold';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE catalogue_ref IN ('acc_wheat_sprig', 'acc_round_wire_glasses')), '#12 and #13 deleted';
  ASSERT (SELECT display_name FROM shop_items WHERE slug = 'wear-acc-ushanka-goggles') = 'Ushanka and goggles', '#22 named for its hat';
  ASSERT NOT (SELECT active FROM shop_items WHERE slug = 'net-basic') AND NOT (SELECT active FROM shop_items WHERE slug = 'shovel-basic'), 'the tier-1 net and shovel stay retired';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug LIKE '%visor-blue%' OR slug LIKE '%sci-fi%'), 'the sci-fi visor skipped';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE position BETWEEN 600 AND 799 AND special_pool <> (price_coins IS NOT NULL)), 'specials: coin rows only';
  -- Every row has its icon; earlier rows did not move.
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE position BETWEEN 600 AND 799 AND sprite_url NOT LIKE '/assets/icons/%'), 'icons set';
  ASSERT (SELECT position FROM shop_items WHERE slug = 'wear-acc-visor') = 232 AND (SELECT position FROM shop_items WHERE slug = 'dye-wheat-blonde') = 233, 'earlier rows in place';
  ASSERT (SELECT count(*) FROM shop_items WHERE starter_qty > 0 AND slug LIKE 'wear-%') = 8, 'still eight starter clothes';
  -- The colour wheel: one 250-Gem row, sold, never a special or a starter; the dyes stay on sale as presets.
  ASSERT (SELECT tc_price = 250 AND price_coins IS NULL AND active AND NOT special_pool AND coalesce(starter_qty, 0) = 0 AND category = 'hair'
    AND position = 800 AND sprite_url = '/assets/icons/colour-wheel.webp' FROM shop_items WHERE slug = 'hair-colour-wheel' AND catalogue_ref = 'colour-wheel'), 'the colour wheel row';
  ASSERT (SELECT count(*) FROM shop_items WHERE catalogue_ref LIKE 'hair:%' AND active) = 6, 'six dyes still sold';
  -- The avatar effect at 250 Gems; profile customization unchanged.
  ASSERT (SELECT tc_price = 250 AND price_coins IS NULL FROM shop_items WHERE slug = 'glitch-aura' AND category = 'avatar-effect'), 'avatar effect 250 Gems';
  ASSERT (SELECT tc_price = 5000 FROM shop_items WHERE slug = 'founder-badge' AND category = 'profile-customization'), 'profile customization unchanged';
END $$;

-- Bought with coins (a whole face) and with Gems (#22's ushanka): owned by catalogue_ref, once; a new account gets none.
DO $$
DECLARE
  M uuid := '00000000-0000-4000-8000-0000000033b0';
  N uuid := '00000000-0000-4000-8000-0000000033b1';
  r record;
BEGIN
  PERFORM wallet_apply(M, 'coins', 400, 'admin', 'smoke', 'b2:fund-coins');
  PERFORM wallet_apply(M, 'gems', 600, 'earn_bounty', 'smoke', 'b2:fund-gems');
  SELECT * INTO r FROM economy_buy(M, (SELECT id FROM shop_items WHERE slug = 'face-silly-cat'), 1, 250, 'b2-face-1');
  ASSERT r.owned = 1 AND r.balance = 150, 'face bought for 250 coins';
  SELECT * INTO r FROM economy_buy(M, (SELECT id FROM shop_items WHERE slug = 'wear-acc-ushanka-goggles'), 1, 200, 'b2-hat-1');
  ASSERT r.owned = 1 AND r.balance = 400, 'the ushanka bought for 200 Gems';
  SELECT * INTO r FROM economy_buy(M, (SELECT id FROM shop_items WHERE slug = 'hair-colour-wheel'), 1, 250, 'b2-wheel-1');
  ASSERT r.owned = 1 AND r.balance = 150, 'the colour wheel bought for 250 Gems';
  BEGIN
    PERFORM economy_buy(M, (SELECT id FROM shop_items WHERE slug = 'hair-colour-wheel'), 1, 250, 'b2-wheel-2');
    RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM IN ('already_owned', 'insufficient'), 'the wheel is a one-time unlock: ' || SQLERRM;
  END;
  ASSERT (SELECT count(*) FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.member_id = M AND s.catalogue_ref IN ('face:silly_cat', 'acc_ushanka_goggles', 'colour-wheel')) = 3, 'owned by ref';
  BEGIN
    PERFORM economy_buy(M, (SELECT id FROM shop_items WHERE slug = 'face-silly-cat'), 1, 250, 'b2-face-2');
    RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM IN ('already_owned', 'insufficient'), 'a face is owned once: ' || SQLERRM;
  END;
  PERFORM economy_grant_starters(N);
  ASSERT NOT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.member_id = N AND s.position BETWEEN 600 AND 799), 'no batch-2 starter';
END $$;

-- Idempotent: the migration again changes nothing.
\ir ../migrations/20261017172740_catalogue_seed.sql
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799) = 35, 'still thirty-five rows';
  ASSERT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE s.slug = 'face-silly-cat'), 'the buyer keeps the face';
  ASSERT (SELECT tc_price FROM shop_items WHERE slug = 'glitch-aura') = 250, 'still 250 Gems';
  RAISE NOTICE 'wardrobe b2 ok';
END $$;
