-- Local smoke test for 20261101120000_tasting_book (after every migration, same throwaway cluster). Never run against Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000e1', 'taster@x'), ('00000000-0000-4000-8000-0000000000e2', 'giver@x') ON CONFLICT DO NOTHING;

-- Cook: the fish leaves the bag, the fee is paid, the buff set, the slot stamped once; a cook again is just the meal.
DO $$
DECLARE T uuid := '00000000-0000-4000-8000-0000000000e1'; r record; v_coins int;
BEGIN
  PERFORM wallet_apply(T, 'coins', 1000, 'admin', 'seed', 'tb-seed');
  BEGIN PERFORM tasting_serve(T, 'fish_dace', 'cook', 10, 0.1, 0.1, '2030-01-01', '{10,25}', '{150,400}', 250, 'tb-0001'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'no fish: ' || SQLERRM; END;
  PERFORM collections_record_catch(T, 'fish_dace', 14, true);
  PERFORM collections_record_catch(T, 'fish_dace', 15, true);
  SELECT * INTO r FROM tasting_serve(T, 'fish_dace', 'cook', 10, 0.1, 0.1, '2030-01-01', '{10,25}', '{150,400}', 250, 'tb-0002');
  ASSERT r.paid = 10 AND r.stamped AND r.remaining = 1 AND r.earned = 0 AND NOT r.replayed, 'cook stamps';
  ASSERT r.balance = 990 AND (SELECT coins FROM wallets WHERE member_id = T) = 990, 'fee paid';
  ASSERT (SELECT way FROM tasting_book WHERE member_id = T AND species_key = 'fish_dace') = 'cooked', 'slot cooked';
  ASSERT (SELECT source FROM member_buffs WHERE member_id = T) = 'tasting', 'meal buff set';
  SELECT * INTO r FROM tasting_serve(T, 'fish_dace', 'cook', 10, 0.1, 0.1, '2030-01-01', '{10,25}', '{150,400}', 250, 'tb-0002');
  ASSERT r.replayed AND r.stamped AND (SELECT coins FROM wallets WHERE member_id = T) = 990, 'replay pays nothing more';
  SELECT * INTO r FROM tasting_serve(T, 'fish_dace', 'cook', 10, 0.1, 0.1, '2030-01-01', '{10,25}', '{150,400}', 250, 'tb-0003');
  ASSERT NOT r.stamped AND r.remaining = 0 AND r.balance = 980, 'second cook: the meal, no stamp';
  -- the aquarium only takes an empty slot
  PERFORM collections_record_catch(T, 'fish_dace', 16, true);
  BEGIN PERFORM tasting_serve(T, 'fish_dace', 'aquarium', 0, 0, 0, '2030-01-01', '{10,25}', '{150,400}', 250, 'tb-0004'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_in_book', 'aquarium on a stamp: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = T AND item_key = 'fish_dace') = 1, 'a refused gift keeps the fish';
  -- not a rod species, a locked fish, a bad price
  PERFORM collections_record_catch(T, 'bug_ladybug', NULL, false);
  BEGIN PERFORM tasting_serve(T, 'bug_ladybug', 'cook', 10, 0.1, 0.1, '2030-01-01', '{10,25}', '{150,400}', 250, 'tb-0005'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', 'a bug: ' || SQLERRM; END;
  UPDATE member_collections SET locked = TRUE WHERE user_id = T AND item_key = 'fish_dace';
  BEGIN PERFORM tasting_serve(T, 'fish_dace', 'cook', 10, 0.1, 0.1, '2030-01-01', '{10,25}', '{150,400}', 250, 'tb-0006'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'locked: ' || SQLERRM; END;
  BEGIN PERFORM tasting_serve(T, 'fish_pike', 'cook', 9000, 0.1, 0.1, '2030-01-01', '{10,25}', '{150,400}', 250, 'tb-0007'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_qty', 'fee: ' || SQLERRM; END;
  BEGIN PERFORM tasting_serve(T, 'fish_pike', 'cook', 10, 0.1, 0.1, '2030-01-01', '{10,25}', '{150}', 250, 'tb-0008'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_qty', 'marks: ' || SQLERRM; END;
  -- broke: the fish stays (one transaction)
  PERFORM collections_record_catch(T, 'fish_pike', 70, true);
  PERFORM wallet_apply(T, 'coins', -980, 'admin', 'drain', 'tb-drain');
  BEGIN PERFORM tasting_serve(T, 'fish_pike', 'cook', 10, 0.1, 0.1, '2030-01-01', '{10,25}', '{150,400}', 250, 'tb-0009'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient', 'broke: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = T AND item_key = 'fish_pike') = 1, 'broke keeps the fish';
  ASSERT NOT EXISTS (SELECT 1 FROM tasting_book WHERE member_id = T AND species_key = 'fish_pike'), 'broke leaves the slot';
  RAISE NOTICE 'tasting cook ok';
END $$;

-- The aquarium: free, fills the slot; the marks pay once, the water once.
DO $$
DECLARE G uuid := '00000000-0000-4000-8000-0000000000e2'; r record; k text; n int := 0; v_total int;
BEGIN
  PERFORM collections_record_catch(G, 'fish_char', 50, true);
  SELECT * INTO r FROM tasting_serve(G, 'fish_char', 'aquarium', 0, 0, 0, '2030-01-01', '{2,3}', '{150,400}', 250, 'tb-0101');
  ASSERT r.paid = 0 AND NOT r.stamped AND r.earned = 0 AND r.remaining = 0, 'gift';
  ASSERT (SELECT way FROM tasting_book WHERE member_id = G AND species_key = 'fish_char') = 'aquarium', 'slot in the aquarium';
  ASSERT NOT EXISTS (SELECT 1 FROM member_buffs WHERE member_id = G), 'a gift is no meal';
  PERFORM collections_record_catch(G, 'fish_gar', 100, true);
  SELECT * INTO r FROM tasting_serve(G, 'fish_gar', 'aquarium', 0, 0, 0, '2030-01-01', '{2,3}', '{150,400}', 250, 'tb-0102');
  ASSERT r.earned = 150 AND r.marks = '{count:2}' AND r.balance = 150, 'second slot: the first mark';
  ASSERT (SELECT source FROM wallet_ledger WHERE member_id = G AND idempotency_key = 'tasting_mark:tb-0102') = 'quest', 'marks are a quest credit';
  -- the rest of the cliff pools: the third mark, then the full water
  SELECT count(*) INTO v_total FROM collection_species WHERE tool = 'rod' AND active AND biome = 'cliff_pool';
  FOR k IN SELECT key FROM collection_species WHERE tool = 'rod' AND active AND biome = 'cliff_pool' AND key NOT IN ('fish_char', 'fish_gar') ORDER BY key LOOP
    n := n + 1;
    PERFORM collections_record_catch(G, k, 50, true);
    SELECT * INTO r FROM tasting_serve(G, k, 'aquarium', 0, 0, 0, '2030-01-01', '{2,3}', '{150,400}', 250, 'tb-02' || lpad(n::text, 2, '0'));
    IF n = 1 THEN ASSERT r.earned = 400 AND r.marks = '{count:3}', 'third slot: the second mark'; END IF;
  END LOOP;
  ASSERT v_total >= 3, 'cliff pool species seeded';
  ASSERT r.marks @> '{water:cliff_pool}' AND r.earned >= 250, 'the last cliff pool fish fills the water: ' || r.marks::text;
  ASSERT (SELECT coins FROM wallets WHERE member_id = G) = 150 + 400 + 250, 'marks paid once each';
  RAISE NOTICE 'tasting aquarium ok';
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
DO $$ BEGIN
  PERFORM tasting_serve('00000000-0000-4000-8000-0000000000e1', 'fish_dace', 'cook', 0, 1, 1, '2030-01-01', '{}', '{}', 0, 'tb-0900');
  RAISE EXCEPTION 'member called tasting_serve';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO tasting_book (member_id, species_key, way) VALUES ('00000000-0000-4000-8000-0000000000e1', 'fish_koi', 'cooked');
  RAISE EXCEPTION 'member wrote a stamp';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM tasting_book) = (SELECT count(*) FROM tasting_book WHERE member_id = '00000000-0000-4000-8000-0000000000e1'), 'a member reads only their own book';
END $$;
ROLLBACK;
