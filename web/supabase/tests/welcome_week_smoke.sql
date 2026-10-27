-- The welcome week (20261027190000_welcome_week, d-streak). Throwaway local Postgres after every migration through it
-- (supabase_stub.sql first). Never Supabase. Fails before it: daily_gift_claim has no welcome columns. Self-contained,
-- rolled back: past log-in days are written straight into daily_login_claims. Its members (77001 to 77009) are used by no
-- other smoke, so they start with no coins and no gift days (nothing credits coins at signup: 003_profile_trigger only
-- makes the profile).
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000077001', 'welcome-1@x'), ('00000000-0000-4000-8000-000000077007', 'welcome-7@x'),
  ('00000000-0000-4000-8000-000000077008', 'welcome-8@x'), ('00000000-0000-4000-8000-000000077009', 'welcome-none@x')
ON CONFLICT DO NOTHING;
-- Past gift days: six for f7 and f9 (today is their seventh), seven for f8 (today is the eighth).
INSERT INTO daily_login_claims (member_id, day, coins)
  SELECT m, (NOW() AT TIME ZONE 'America/Toronto')::DATE - g, 10
  FROM (VALUES ('00000000-0000-4000-8000-000000077007'::uuid, 6), ('00000000-0000-4000-8000-000000077008'::uuid, 7),
               ('00000000-0000-4000-8000-000000077009'::uuid, 6)) AS t(m, n), generate_series(1, n) AS g;
DO $$
DECLARE r record; d int := CASE WHEN EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'America/Toronto')::DATE) = 5 THEN 20 ELSE 10 END;
  F1 uuid := '00000000-0000-4000-8000-000000077001'; F7 uuid := '00000000-0000-4000-8000-000000077007';
  F8 uuid := '00000000-0000-4000-8000-000000077008'; F9 uuid := '00000000-0000-4000-8000-000000077009';
BEGIN
  -- Day 1: the gift and the day-1 bonus, credited exactly once.
  ASSERT NOT EXISTS (SELECT 1 FROM wallets WHERE member_id = F1 AND coins <> 0) AND NOT EXISTS (SELECT 1 FROM daily_login_claims WHERE member_id = F1), 'a fresh member';
  SELECT * INTO r FROM daily_gift_claim(F1);
  ASSERT r.claimed AND r.coins = d AND r.welcome_day = 1 AND r.welcome_coins = 10 AND r.welcome_item IS NULL, 'welcome day 1';
  ASSERT r.balance = d + 10 AND (SELECT coins FROM wallets WHERE member_id = F1) = d + 10, 'day 1 credits exactly the gift and its bonus';
  SELECT * INTO r FROM daily_gift_claim(F1);
  ASSERT NOT r.claimed AND r.welcome_day IS NULL AND r.welcome_coins = 0 AND r.coins = 0, 'once a day';
  ASSERT (SELECT coins FROM wallets WHERE member_id = F1) = d + 10, 'a second claim the same day adds 0';
  ASSERT (SELECT count(*) FROM wallet_ledger WHERE member_id = F1) = 2 AND (SELECT count(*) FROM wallet_ledger WHERE member_id = F1 AND idempotency_key = 'welcome:1') = 1, 'one gift row, one bonus row';

  -- Day 7: the mystery box, a starter item the member doesn't own, no coins.
  SELECT * INTO r FROM daily_gift_claim(F7);
  ASSERT r.claimed AND r.welcome_day = 7 AND r.welcome_coins = 0 AND r.welcome_item IS NOT NULL, 'welcome day 7 box';
  ASSERT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id
                 WHERE i.member_id = F7 AND s.slug = r.welcome_item AND s.special_pool AND s.active AND s.price_coins <= 300
                   AND s.category IN ('outfit', 'hair', 'face', 'accessory', 'furniture')), 'the box item is given, starter loot only';

  -- Day 8: the week is over.
  SELECT * INTO r FROM daily_gift_claim(F8);
  ASSERT r.claimed AND r.coins = d AND r.welcome_day IS NULL AND r.welcome_coins = 0, 'after the week, just the gift';

  -- Day 7 with nothing left to win: coins instead (furniture never runs out, so it leaves the box here; rolled back).
  UPDATE shop_items SET special_pool = FALSE WHERE stackable;
  INSERT INTO member_inventory (member_id, item_id, qty, slot)
    SELECT F9, id, 1, slot FROM shop_items WHERE special_pool AND active AND price_coins IS NOT NULL;
  SELECT * INTO r FROM daily_gift_claim(F9);
  ASSERT r.welcome_day = 7 AND r.welcome_item IS NULL AND r.welcome_coins = 300, 'an empty box pays coins';
  RAISE NOTICE 'welcome week ok';
END $$;
ROLLBACK;
