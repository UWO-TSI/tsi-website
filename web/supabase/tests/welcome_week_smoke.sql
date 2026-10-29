-- The welcome week (20261029062500_welcome_week, d-streak). Throwaway local Postgres after every migration through it
-- (supabase_stub.sql first). Never Supabase. Fails before it: daily_gift_claim has no welcome columns. Self-contained,
-- rolled back: past log-in days are written straight into daily_login_claims. Its members (77001 to 77009) are used by no
-- other smoke, so they start with no coins and no gift days (nothing credits coins at signup: 003_profile_trigger only
-- makes the profile).
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000077001', 'welcome-1@x'), ('00000000-0000-4000-8000-000000077007', 'welcome-7@x'),
  ('00000000-0000-4000-8000-000000077008', 'welcome-8@x'), ('00000000-0000-4000-8000-000000077009', 'welcome-none@x'),
  ('00000000-0000-4000-8000-000000077010', 'welcome-homes@x'),
  ('00000000-0000-4000-8000-000000077003', 'welcome-3@x')
ON CONFLICT DO NOTHING;
-- Past gift days: two for f3 (today is the third), six for f7 and f9 (today is their seventh), seven for f8 (the eighth).
INSERT INTO daily_login_claims (member_id, day, coins)
  SELECT m, (NOW() AT TIME ZONE 'America/Toronto')::DATE - g, 10
  FROM (VALUES ('00000000-0000-4000-8000-000000077007'::uuid, 6), ('00000000-0000-4000-8000-000000077008'::uuid, 7),
               ('00000000-0000-4000-8000-000000077009'::uuid, 6), ('00000000-0000-4000-8000-000000077003'::uuid, 2)) AS t(m, n), generate_series(1, n) AS g;
DO $$
DECLARE r record; d int := CASE WHEN EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'America/Toronto')::DATE) = 5 THEN 20 ELSE 10 END;
  F1 uuid := '00000000-0000-4000-8000-000000077001'; F7 uuid := '00000000-0000-4000-8000-000000077007';
  F8 uuid := '00000000-0000-4000-8000-000000077008'; F9 uuid := '00000000-0000-4000-8000-000000077009';
  F10 uuid := '00000000-0000-4000-8000-000000077010'; F3 uuid := '00000000-0000-4000-8000-000000077003';
BEGIN
  -- Day 1: the gift and the track's day 1 (200 coins), credited exactly once.
  ASSERT NOT EXISTS (SELECT 1 FROM wallets WHERE member_id = F1 AND coins <> 0) AND NOT EXISTS (SELECT 1 FROM daily_login_claims WHERE member_id = F1), 'a fresh member';
  SELECT * INTO r FROM daily_gift_claim(F1);
  ASSERT r.claimed AND r.coins = d AND r.welcome_day = 1 AND r.welcome_coins = 200 AND r.welcome_gems = 0 AND r.welcome_item IS NULL, 'welcome day 1';
  ASSERT r.balance = d + 200 AND (SELECT coins FROM wallets WHERE member_id = F1) = d + 200, 'day 1 credits exactly the gift and its bonus';
  SELECT * INTO r FROM daily_gift_claim(F1);
  ASSERT NOT r.claimed AND r.welcome_day IS NULL AND r.welcome_coins = 0 AND r.coins = 0, 'once a day';
  ASSERT (SELECT coins FROM wallets WHERE member_id = F1) = d + 200, 'a second claim the same day adds 0';
  ASSERT (SELECT count(*) FROM wallet_ledger WHERE member_id = F1) = 2 AND (SELECT count(*) FROM wallet_ledger WHERE member_id = F1 AND idempotency_key = 'welcome:1') = 1, 'one gift row, one bonus row';

  -- Day 3: 5 Gems and no bonus coins, the Gems once (earn_streak).
  SELECT * INTO r FROM daily_gift_claim(F3);
  ASSERT r.claimed AND r.welcome_day = 3 AND r.welcome_coins = 0 AND r.welcome_gems = 5, 'welcome day 3: gems';
  ASSERT (SELECT tethos_coins FROM profiles WHERE id = F3) = 5 AND (SELECT count(*) FROM tc_transactions WHERE user_id = F3 AND idempotency_key = 'welcome-gems:3' AND type = 'earn_streak' AND amount = 5) = 1, 'the gems land once';

  -- Day 7: the mystery box, clothing or gear the member doesn't own, and 10 Gems.
  SELECT * INTO r FROM daily_gift_claim(F7);
  ASSERT r.claimed AND r.welcome_day = 7 AND r.welcome_coins = 0 AND r.welcome_gems = 10 AND r.welcome_item IS NOT NULL, 'welcome day 7 box';
  ASSERT (SELECT tethos_coins FROM profiles WHERE id = F7) = 10, 'and its gems';
  ASSERT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id
                 WHERE i.member_id = F7 AND s.slug = r.welcome_item AND s.active AND ((s.special_pool AND s.price_coins <= 300
                   AND s.category IN ('outfit', 'hair', 'face', 'accessory')) OR s.slug IN ('rod-cedar', 'net-mid', 'shovel-mid'))), 'the box item is given: clothing or gear, no furniture while homes are closed';

  -- Day 8: the week is over.
  SELECT * INTO r FROM daily_gift_claim(F8);
  ASSERT r.claimed AND r.coins = d AND r.welcome_day IS NULL AND r.welcome_coins = 0, 'after the week, just the gift';

  -- Day 7 with nothing left to win: coins instead (homes closed, so furniture isn't in the box: owning the rest empties it).
  ASSERT COALESCE((SELECT value FROM economy_settings WHERE key = 'welcome_box_furniture'), 0) = 0, 'furniture is out of the box by default';
  INSERT INTO member_inventory (member_id, item_id, qty, slot)
    SELECT F9, id, 1, slot FROM shop_items WHERE (special_pool AND active AND price_coins IS NOT NULL AND category <> 'furniture') OR slug IN ('rod-cedar', 'net-mid', 'shovel-mid')
  ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM daily_gift_claim(F9);
  ASSERT r.welcome_day = 7 AND r.welcome_item IS NULL AND r.welcome_coins = 300, 'an empty box pays coins';
  -- Homes open: one switch puts furniture back in the box (furniture is all that's left for F10).
  INSERT INTO economy_settings (key, value) VALUES ('welcome_box_furniture', 1) ON CONFLICT (key) DO UPDATE SET value = 1;
  INSERT INTO daily_login_claims (member_id, day, coins)
    SELECT F10, (NOW() AT TIME ZONE 'America/Toronto')::DATE - g, 10 FROM generate_series(1, 6) AS g;
  INSERT INTO member_inventory (member_id, item_id, qty, slot)
    SELECT F10, id, 1, slot FROM shop_items WHERE (special_pool AND active AND price_coins IS NOT NULL AND category <> 'furniture') OR slug IN ('rod-cedar', 'net-mid', 'shovel-mid')
  ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM daily_gift_claim(F10);
  ASSERT r.welcome_day = 7 AND (SELECT category FROM shop_items WHERE slug = r.welcome_item) = 'furniture', 'with homes open, the box can hold furniture';
  RAISE NOTICE 'welcome week ok';
END $$;
ROLLBACK;
