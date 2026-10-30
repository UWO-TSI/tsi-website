-- Local smoke test for 20261028161000_tackle_rolls (after every migration, same throwaway cluster). Never run against Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000e1', 'roller@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE M uuid := '00000000-0000-4000-8000-0000000000e1'; r record;
BEGIN
  ASSERT (SELECT count(*) FROM shop_items WHERE category = 'tool' AND NOT active AND stackable AND slot IN ('bait', 'bobber', 'rod') AND position > 9000) = 17, 'the prizes are seeded off sale';
  PERFORM wallet_apply(M, 'coins', 2000, 'admin', 'smoke', 'seed-coins-01');
  PERFORM wallet_apply(M, 'gems', 50, 'admin', 'smoke', 'seed-gems-01');
  -- 1 pull for coins: charged once, the prize in the inventory
  SELECT * INTO r FROM tackle_roll(M, 'coins', 150, ARRAY['bait_worm'], 'roll-0001');
  ASSERT NOT r.replayed AND r.balance = 1850 AND r.prizes = ARRAY['bait_worm'], 'one pull';
  ASSERT (SELECT qty FROM member_inventory mi JOIN shop_items i ON i.id = mi.item_id WHERE mi.member_id = M AND i.slug = 'bait_worm') = 1, 'granted';
  ASSERT (SELECT source FROM wallet_ledger WHERE member_id = M AND idempotency_key = 'tackle:roll-0001') = 'shop', 'a shop debit';
  SELECT * INTO r FROM tackle_roll(M, 'coins', 150, ARRAY['bait_clam'], 'roll-0001');
  ASSERT r.replayed AND r.prizes = ARRAY['bait_worm'] AND r.balance = 1850, 'replay returns the first roll, charges nothing';
  -- 10 pulls for Gems: duplicates stack, Gems charged on their own ledger
  SELECT * INTO r FROM tackle_roll(M, 'gems', 45, ARRAY['bait_worm','bait_worm','bobber_cork','bait_shrimp','bobber_float','bait_glow_grub','bobber_brass','bait_squid_jig','bobber_pearl','rod_pumpkin'], 'roll-0002');
  ASSERT r.balance = 5 AND cardinality(r.prizes) = 10, 'ten pulls';
  ASSERT (SELECT qty FROM member_inventory mi JOIN shop_items i ON i.id = mi.item_id WHERE mi.member_id = M AND i.slug = 'bait_worm') = 3, 'duplicates stack';
  ASSERT (SELECT mi.slot FROM member_inventory mi JOIN shop_items i ON i.id = mi.item_id WHERE mi.member_id = M AND i.slug = 'rod_pumpkin') = 'rod', 'in its slot';
  ASSERT (SELECT type FROM tc_transactions WHERE user_id = M AND idempotency_key = 'tackle:roll-0002') = 'spend_shop', 'a Gem spend';
  -- not enough, a prize on sale or unknown, too many pulls: refused, nothing granted
  BEGIN PERFORM tackle_roll(M, 'gems', 45, ARRAY['bait_worm'], 'roll-0003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient', 'broke: ' || SQLERRM; END;
  BEGIN PERFORM tackle_roll(M, 'coins', 150, ARRAY['rod-glass'], 'roll-0004'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', 'a shop item: ' || SQLERRM; END;
  BEGIN PERFORM tackle_roll(M, 'coins', 150, ARRAY['nope'], 'roll-0005'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', 'unknown: ' || SQLERRM; END;
  BEGIN PERFORM tackle_roll(M, 'coins', 150, array_fill('bait_worm'::text, ARRAY[11]), 'roll-0006'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_qty', 'eleven: ' || SQLERRM; END;
  ASSERT (SELECT coins FROM wallets WHERE member_id = M) = 1850, 'refusals charge nothing';
  ASSERT (SELECT count(*) FROM tackle_rolls WHERE member_id = M) = 2, 'two rolls recorded';
  RAISE NOTICE 'tackle rolls ok';
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
DO $$ BEGIN
  PERFORM tackle_roll('00000000-0000-4000-8000-0000000000e1', 'coins', 1, ARRAY['rod_pumpkin'], 'roll-0099');
  RAISE EXCEPTION 'member called tackle_roll';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO tackle_rolls (member_id, idempotency_key, currency, cost, prizes) VALUES ('00000000-0000-4000-8000-0000000000e1', 'roll-0098', 'coins', 1, ARRAY['x']);
  RAISE EXCEPTION 'member wrote a roll';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
ROLLBACK;
