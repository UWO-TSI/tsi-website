-- Wardrobe batch 2 (20261016163845_catalogue_seed; David's prices, specs/wardrobe/batch2-pricing.json). Throwaway local
-- Postgres after every migration (supabase_stub.sql first), after wardrobe_cut_smoke.sql. Never Supabase. Fails before
-- the migration: no batch-2 row exists, and a whole face cannot be a shop row (the category check refuses 'face').
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000033b0', 'b2-buyer@x'),
  ('00000000-0000-4000-8000-0000000033b1', 'b2-new@x');

DO $$
BEGIN
  -- Every priced item is one row at David's price: 6 hairstyles, 21 accessories, 4 whole faces.
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799) = 31, 'thirty-one batch-2 rows';
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799 AND category = 'hair' AND slug LIKE 'wear-hair-%') = 6, 'six hairstyles';
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799 AND category = 'accessory') = 21, 'twenty-one accessories';
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799 AND category = 'face' AND catalogue_ref LIKE 'face:%') = 4, 'four whole faces';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE position BETWEEN 600 AND 799 AND (NOT active OR coalesce(starter_qty, 0) > 0)), 'all sold, none a starter';
  -- One price each: coins in price_coins, Gems in tc_price (shop_items_one_price).
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE position BETWEEN 600 AND 799 AND (price_coins IS NULL) = (tc_price IS NULL)), 'one currency each';
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799 AND tc_price IS NOT NULL) = 14, 'fourteen in Gems';
  ASSERT (SELECT tc_price = 30 AND price_coins IS NULL FROM shop_items WHERE slug = 'wear-hair-goggle-ushanka'), '#22 is 30 Gems';
  ASSERT (SELECT price_coins = 350 FROM shop_items WHERE slug = 'wear-hair-ribbon-bob'), '#23 is 350 coins';
  ASSERT (SELECT price_coins = 250 FROM shop_items WHERE slug = 'wear-acc-propeller-cap'), 'acc #01 is 250 coins';
  ASSERT (SELECT tc_price = 5 FROM shop_items WHERE slug = 'wear-acc-paper-tie'), 'acc #03 is 5 Gems';
  ASSERT (SELECT price_coins = 50 FROM shop_items WHERE slug = 'wear-acc-half-rim-glasses'), 'acc #07 is 50 coins';
  ASSERT (SELECT tc_price = 20 FROM shop_items WHERE slug = 'wear-acc-red-band-straw-hat'), 'acc #24 is 20 Gems';
  ASSERT (SELECT price_coins = 250 AND catalogue_ref = 'face:silly_cat' FROM shop_items WHERE slug = 'face-silly-cat'), 'face #20 is 250 coins';
  -- Free items have no row (the starting creator offers them); #16 is skipped; coin rows can be a daily special, Gem rows not.
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE catalogue_ref IN ('acc_thin_glasses', 'acc_round_wire_glasses', 'face:silly', 'face:silly_smile')), 'free items unsold';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug LIKE '%visor-blue%' OR slug LIKE '%sci-fi%'), 'the sci-fi visor skipped';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE position BETWEEN 600 AND 799 AND special_pool <> (price_coins IS NOT NULL)), 'specials: coin rows only';
  -- Every row has its icon; earlier rows did not move.
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE position BETWEEN 600 AND 799 AND sprite_url NOT LIKE '/assets/icons/%'), 'icons set';
  ASSERT (SELECT position FROM shop_items WHERE slug = 'wear-acc-visor') = 232 AND (SELECT position FROM shop_items WHERE slug = 'dye-wheat-blonde') = 233, 'earlier rows in place';
  ASSERT (SELECT count(*) FROM shop_items WHERE starter_qty > 0 AND slug LIKE 'wear-%') = 8, 'still eight starter clothes';
END $$;

-- Bought with coins (a whole face) and with Gems (a hairstyle): owned by catalogue_ref, once; a new account gets none.
DO $$
DECLARE
  M uuid := '00000000-0000-4000-8000-0000000033b0';
  N uuid := '00000000-0000-4000-8000-0000000033b1';
  r record;
BEGIN
  PERFORM wallet_apply(M, 'coins', 400, 'admin', 'smoke', 'b2:fund-coins');
  PERFORM wallet_apply(M, 'gems', 40, 'earn_bounty', 'smoke', 'b2:fund-gems');
  SELECT * INTO r FROM economy_buy(M, (SELECT id FROM shop_items WHERE slug = 'face-silly-cat'), 1, 250, 'b2-face-1');
  ASSERT r.owned = 1 AND r.balance = 150, 'face bought for 250 coins';
  SELECT * INTO r FROM economy_buy(M, (SELECT id FROM shop_items WHERE slug = 'wear-hair-goggle-ushanka'), 1, 30, 'b2-hair-1');
  ASSERT r.owned = 1 AND r.balance = 10, 'hairstyle bought for 30 Gems';
  ASSERT (SELECT count(*) FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.member_id = M AND s.catalogue_ref IN ('face:silly_cat', 'hair_goggle_ushanka')) = 2, 'owned by ref';
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
\ir ../migrations/20261016163845_catalogue_seed.sql
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 600 AND 799) = 31, 'still thirty-one rows';
  ASSERT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE s.slug = 'face-silly-cat'), 'the buyer keeps the face';
  RAISE NOTICE 'wardrobe b2 ok';
END $$;
