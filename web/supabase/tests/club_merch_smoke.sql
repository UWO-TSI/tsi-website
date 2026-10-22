-- The club merch on sale at David's prices (20261022185120_catalogue_seed; specs/merch/): the TSI keycap keychain and the
-- TSI lanyard at 800 Gems, the GENESIS sticker at 200, redeemed with Gems and picked up at HQ on campus, stock unset
-- (unlimited). Throwaway local Postgres after every migration (supabase_stub.sql first), after wardrobe_b2_smoke.sql.
-- Never Supabase. Fails before the migration: none of the three rows exists.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000044c0', 'merch-buyer@x'),
  ('00000000-0000-4000-8000-0000000044c1', 'merch-desk@x');

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM shop_items WHERE slug IN ('merch-tsi-keycap-keychain', 'merch-tsi-lanyard', 'merch-genesis-sticker')) = 3, 'three merch rows';
  ASSERT (SELECT tc_price = 800 AND display_name = 'TSI keycap keychain' AND position = 40 FROM shop_items WHERE slug = 'merch-tsi-keycap-keychain'), 'the keychain is 800 Gems';
  ASSERT (SELECT tc_price = 800 AND display_name = 'TSI lanyard' AND position = 41 FROM shop_items WHERE slug = 'merch-tsi-lanyard'), 'the lanyard is 800 Gems';
  ASSERT (SELECT tc_price = 200 AND display_name = 'GENESIS sticker' AND position = 42 FROM shop_items WHERE slug = 'merch-genesis-sticker'), 'the sticker is 200 Gems';
  -- On sale as club merch: Gems only, unlimited, never a daily special, a starter or stackable; picked up at HQ.
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug IN ('merch-tsi-keycap-keychain', 'merch-tsi-lanyard', 'merch-genesis-sticker')
    AND (category <> 'merch' OR NOT active OR price_coins IS NOT NULL OR stock IS NOT NULL OR special_pool OR stackable
         OR coalesce(starter_qty, 0) > 0 OR catalogue_ref IS NOT NULL OR description NOT LIKE '%Pick up at HQ on campus.')), 'club merch, on sale, unlimited';
  -- Their pictures: the keychain's and the lanyard's icons, the sticker's foil sprite.
  ASSERT (SELECT sprite_url FROM shop_items WHERE slug = 'merch-tsi-keycap-keychain') = '/assets/icons/merch-tsi-keycap-keychain.webp', 'keychain icon';
  ASSERT (SELECT sprite_url FROM shop_items WHERE slug = 'merch-tsi-lanyard') = '/assets/icons/merch-tsi-lanyard.webp', 'lanyard icon';
  ASSERT (SELECT sprite_url FROM shop_items WHERE slug = 'merch-genesis-sticker') = '/assets/game/items/merch-genesis-sticker-light-sprite.webp', 'sticker sprite';
  -- Earlier rows did not move.
  ASSERT (SELECT position FROM shop_items WHERE slug = 'bag-30') = 39 AND (SELECT position FROM shop_items WHERE slug = 'merch-tote') = 38, 'earlier rows in place';
  ASSERT (SELECT tc_price FROM shop_items WHERE slug = 'merch-tote') = 600 AND (SELECT tc_price FROM shop_items WHERE slug = 'merch-sticker-pack') = 150, 'earlier merch prices kept';
END $$;

-- Redeemed with Gems: each reserved once, the Gems taken, the stock left unlimited; the desk hands one over and cancels one.
DO $$
DECLARE
  M uuid := '00000000-0000-4000-8000-0000000044c0';
  D uuid := '00000000-0000-4000-8000-0000000044c1';
  r record;
  keychain uuid := (SELECT id FROM shop_items WHERE slug = 'merch-tsi-keycap-keychain');
BEGIN
  PERFORM wallet_apply(M, 'gems', 1800, 'earn_bounty', 'smoke', 'club-merch:fund');
  SELECT * INTO r FROM merch_reserve(M, keychain, 'club-merch-1', 'KEY01');
  ASSERT NOT r.replayed AND r.gems_balance = 1000, 'the keychain reserved for 800 Gems';
  SELECT * INTO r FROM merch_reserve(M, (SELECT id FROM shop_items WHERE slug = 'merch-tsi-lanyard'), 'club-merch-2', 'LAN02');
  ASSERT r.gems_balance = 200, 'the lanyard reserved for 800 Gems';
  SELECT * INTO r FROM merch_reserve(M, (SELECT id FROM shop_items WHERE slug = 'merch-genesis-sticker'), 'club-merch-3', 'GEN03');
  ASSERT r.gems_balance = 0, 'the sticker reserved for 200 Gems';
  SELECT * INTO r FROM merch_reserve(M, keychain, 'club-merch-1', 'KEY01');
  ASSERT r.replayed, 'a replayed redeem charges nothing';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug IN ('merch-tsi-keycap-keychain', 'merch-tsi-lanyard', 'merch-genesis-sticker') AND stock IS NOT NULL), 'still unlimited';
  ASSERT (SELECT array_agg(gems ORDER BY idempotency_key) FROM merch_reservations WHERE member_id = M AND status = 'reserved') = ARRAY[800, 800, 200], 'three pickups waiting';
  UPDATE profiles SET tier = 1 WHERE id = D;
  PERFORM merch_resolve((SELECT id FROM merch_reservations WHERE member_id = M AND idempotency_key = 'club-merch-1'), D, 'fulfil', 'picked up at HQ');
  PERFORM merch_resolve((SELECT id FROM merch_reservations WHERE member_id = M AND idempotency_key = 'club-merch-3'), D, 'cancel', 'changed mind');
  ASSERT (SELECT tethos_coins FROM profiles WHERE id = M) = 200, 'the cancelled sticker refunded';
  ASSERT (SELECT stock FROM shop_items WHERE slug = 'merch-genesis-sticker') IS NULL, 'a cancel leaves it unlimited';
END $$;

-- Idempotent: the migration again changes nothing, and the pickups stay.
\ir ../migrations/20261022185120_catalogue_seed.sql
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM shop_items WHERE slug IN ('merch-tsi-keycap-keychain', 'merch-tsi-lanyard', 'merch-genesis-sticker')) = 3, 'still three rows';
  ASSERT (SELECT tc_price FROM shop_items WHERE slug = 'merch-genesis-sticker') = 200, 'still 200 Gems';
  ASSERT (SELECT count(*) FROM merch_reservations WHERE member_id = '00000000-0000-4000-8000-0000000044c0') = 3, 'the pickups kept';
  RAISE NOTICE 'club merch ok';
END $$;

-- David, 2026-10-22: "Take both off sale". The placeholder tote and sticker pack aren't real merch, so
-- 20261022212455_catalogue_seed retires them (active false, rows and prices kept): a redeem is refused and the three
-- real items stay on sale. Applying it again changes nothing. Fails before that migration: the sticker pack is active.
DO $$
DECLARE
  M uuid := '00000000-0000-4000-8000-0000000044c0';
  refused text;
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug IN ('merch-tote', 'merch-sticker-pack') AND active), 'the placeholder merch is off sale';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug IN ('merch-tsi-keycap-keychain', 'merch-tsi-lanyard', 'merch-genesis-sticker') AND active) = 3, 'the three real items on sale';
  BEGIN
    PERFORM merch_reserve(M, (SELECT id FROM shop_items WHERE slug = 'merch-sticker-pack'), 'placeholder-1', 'STK01');
  EXCEPTION WHEN OTHERS THEN refused := SQLERRM;
  END;
  ASSERT refused = 'not_for_sale', 'the sticker pack refused: ' || coalesce(refused, 'reserved');
  ASSERT (SELECT tethos_coins FROM profiles WHERE id = M) = 200, 'no Gems taken';
END $$;
\ir ../migrations/20261022212455_catalogue_seed.sql
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug IN ('merch-tote', 'merch-sticker-pack') AND active), 'still off sale';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug IN ('merch-tsi-keycap-keychain', 'merch-tsi-lanyard', 'merch-genesis-sticker') AND active) = 3, 'the real three still on sale';
  RAISE NOTICE 'placeholder merch off sale ok';
END $$;
