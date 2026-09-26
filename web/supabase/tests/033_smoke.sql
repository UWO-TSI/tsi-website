-- Local smoke test for draft 033_economy (after 029-032 smokes, same throwaway
-- cluster; pre033_seed.sql ran before 033 was applied). Never run against Supabase.
\set ON_ERROR_STOP 1
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000000aa'; B uuid := '00000000-0000-4000-8000-0000000000bb';
  C uuid := '00000000-0000-4000-8000-0000000000cc'; v int; rod uuid; hoodie uuid; tote uuid; res uuid;
BEGIN
  -- 024 reconciliation: one source of truth
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('coins', 'gear')), '033 legacy columns dropped';
  ASSERT (SELECT coins FROM wallets WHERE member_id = C) = 777, '033 migrated coins';
  ASSERT (SELECT count(*) FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.member_id = C AND s.slug = 'rod-cedar') = 1, '033 migrated gear';
  -- the ledger and the wallet agree for everyone
  ASSERT NOT EXISTS (SELECT 1 FROM wallets w WHERE w.coins <> (SELECT COALESCE(SUM(amount), 0) FROM wallet_ledger l WHERE l.member_id = w.member_id)), '033 ledger = wallet';

  -- idempotent credit/debit, insufficient
  SELECT * INTO r FROM wallet_apply(B, 'coins', 50, 'admin', 'x', 'smoke:credit-1');
  v := r.balance;
  SELECT * INTO r FROM wallet_apply(B, 'coins', 50, 'admin', 'x', 'smoke:credit-1');
  ASSERT r.replayed AND r.balance = v, '033 credit replay';
  BEGIN PERFORM wallet_apply(B, 'coins', -100000, 'shop', 'x', 'smoke:debit-1'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient', '033 insufficient: ' || SQLERRM; END;
  ASSERT (SELECT coins FROM wallets WHERE member_id = B) = v, '033 no partial debit';

  -- buy: price sanity, non-stackable once, replay
  SELECT id INTO rod FROM shop_items WHERE slug = 'rod-basic';
  BEGIN PERFORM economy_buy(C, rod, 1, 1, 'b-1'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_price', '033 bad price: ' || SQLERRM; END;
  SELECT * INTO r FROM economy_buy(C, rod, 1, 100, 'b-2');
  ASSERT r.balance = 677 AND r.owned = 1 AND NOT r.replayed, '033 buy';
  SELECT * INTO r FROM economy_buy(C, rod, 1, 100, 'b-2');
  ASSERT r.replayed AND r.balance = 677, '033 buy replay';
  BEGIN PERFORM economy_buy(C, rod, 1, 100, 'b-3'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_owned', '033 owned: ' || SQLERRM; END;

  -- sell by rarity (roster species and a non-roster fish via 024's fish_prices)
  INSERT INTO member_collections (user_id, item_key, count) VALUES (C, 'fish_coelacanth', 2), (C, 'fish_guppy', 3), (C, 'bug_mantis', 1);
  SELECT * INTO r FROM economy_sell(C, 'fish_coelacanth', 1, 's-1');
  ASSERT r.paid = 600 AND r.remaining = 1 AND r.balance = 1277, '033 sell legendary fish';
  SELECT * INTO r FROM economy_sell(C, 'fish_coelacanth', 1, 's-1');
  ASSERT r.replayed AND r.remaining = 1, '033 sell replay';
  SELECT * INTO r FROM economy_sell(C, 'fish_guppy', 3, 's-2');
  ASSERT r.paid = 24, '033 sell non-roster common fish';
  SELECT * INTO r FROM economy_sell(C, 'bug_mantis', 1, 's-3');
  ASSERT r.paid = 50, '033 sell rare bug';
  BEGIN PERFORM economy_sell(C, 'bug_mantis', 1, 's-4'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', '033 sell none: ' || SQLERRM; END;

  -- merch: stock 1, reserve / sold out / cancel refunds / fulfil / replay; T1/T2 only
  SELECT id INTO tote FROM shop_items WHERE slug = 'merch-tote';
  UPDATE shop_items SET stock = 1 WHERE id = tote;
  SELECT * INTO r FROM merch_reserve(C, tote, 'merch-0001', 'AB12');
  res := r.reservation_id;
  ASSERT r.gems_balance = 300 AND NOT r.replayed, '033 reserve';
  ASSERT (SELECT stock FROM shop_items WHERE id = tote) = 0, '033 stock reserved';
  UPDATE profiles SET tethos_coins = 5000 WHERE id = A;
  BEGIN PERFORM merch_reserve(A, tote, 'merch-0002', 'CD34'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'sold_out', '033 sold out: ' || SQLERRM; END;
  BEGIN PERFORM merch_resolve(res, C, 'cancel', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'forbidden', '033 member cannot resolve: ' || SQLERRM; END;
  UPDATE profiles SET tier = 1 WHERE id = A;
  SELECT * INTO r FROM merch_resolve(res, A, 'cancel', 'changed mind');
  ASSERT r.status = 'cancelled' AND NOT r.replayed, '033 cancel';
  SELECT * INTO r FROM merch_resolve(res, A, 'cancel', 'retry');
  ASSERT r.replayed, '033 cancel replay';
  ASSERT (SELECT tethos_coins FROM profiles WHERE id = C) = 900, '033 gems refunded once';
  ASSERT (SELECT stock FROM shop_items WHERE id = tote) = 1, '033 stock returned';
  BEGIN PERFORM merch_resolve(res, A, 'fulfil', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_resolved', '033 resolved: ' || SQLERRM; END;
  SELECT * INTO r FROM merch_reserve(A, tote, 'merch-0003', 'EF56');
  PERFORM merch_resolve(r.reservation_id, A, 'fulfil', 'picked up at HQ');
  ASSERT (SELECT status FROM merch_reservations WHERE id = r.reservation_id) = 'fulfilled', '033 fulfil';
  ASSERT (SELECT count(*) FROM tc_transactions WHERE user_id = C AND type IN ('spend_merch', 'refund_merch')) = 2, '033 gems ledger rows';

  -- daily gift once per Toronto day
  SELECT * INTO r FROM daily_gift_claim(B);
  ASSERT r.claimed AND r.coins = CASE WHEN EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'America/Toronto')::DATE) = 5 THEN 20 ELSE 10 END, '033 daily gift (Friday double)';
  SELECT * INTO r FROM daily_gift_claim(B);
  ASSERT NOT r.claimed AND r.coins = 0, '033 daily gift once';
  ASSERT r.day = (NOW() AT TIME ZONE 'America/Toronto')::DATE, '033 Toronto day';

  -- in-person event attendance credits once
  INSERT INTO events (id, title, event_type, start_time) VALUES ('00000000-0000-4000-8000-00000000e001', 'Workshop', 'workshop', NOW());
  INSERT INTO event_attendance (id, event_id, user_id, status) VALUES ('00000000-0000-4000-8000-00000000ea01', '00000000-0000-4000-8000-00000000e001', B, 'registered');
  v := (SELECT coins FROM wallets WHERE member_id = B);
  UPDATE event_attendance SET status = 'attended' WHERE id = '00000000-0000-4000-8000-00000000ea01';
  UPDATE event_attendance SET status = 'attended' WHERE id = '00000000-0000-4000-8000-00000000ea01';
  ASSERT (SELECT coins FROM wallets WHERE member_id = B) = v + 50, '033 event credit once';

  ASSERT NOT EXISTS (SELECT 1 FROM wallets w WHERE w.coins <> (SELECT COALESCE(SUM(amount), 0) FROM wallet_ledger l WHERE l.member_id = w.member_id)), '033 ledger = wallet at end';
  RAISE NOTICE '033 ok';
END $$;
