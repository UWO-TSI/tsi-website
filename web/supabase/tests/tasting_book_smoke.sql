-- Local smoke test for 20261102120000_tasting_book (after every migration, same throwaway cluster). Never run against Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000e1', 'taster@x'), ('00000000-0000-4000-8000-0000000000e2', 'giver@x') ON CONFLICT DO NOTHING;

-- Give: the fish leaves the bag, the fee (base plus a step per species given before) is paid, the slot stamped; a filled
-- slot is never given again. A drop in HQ's tank takes the fish and does nothing else (round 6).
DO $$
DECLARE T uuid := '00000000-0000-4000-8000-0000000000e1'; r record;
BEGIN
  PERFORM wallet_apply(T, 'coins', 1000, 'admin', 'seed', 'tb-seed');
  BEGIN PERFORM tasting_serve(T, 'fish_dace', 'cook', 100, 5, '{10,25}', '{150,400}', 250, 'tb-0001'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'no fish: ' || SQLERRM; END;
  PERFORM collections_record_catch(T, 'fish_dace', 14, true);
  PERFORM collections_record_catch(T, 'fish_dace', 15, true);
  SELECT * INTO r FROM tasting_serve(T, 'fish_dace', 'cook', 100, 5, '{10,25}', '{150,400}', 250, 'tb-0002');
  ASSERT r.paid = 100 AND r.stamped AND r.remaining = 1 AND r.earned = 0 AND NOT r.replayed, 'cook stamps';
  ASSERT r.balance = 900 AND (SELECT coins FROM wallets WHERE member_id = T) = 900, 'fee paid';
  ASSERT EXISTS (SELECT 1 FROM tasting_book WHERE member_id = T AND species_key = 'fish_dace'), 'slot stamped';
  ASSERT NOT EXISTS (SELECT 1 FROM member_buffs WHERE member_id = T), 'a stamp is no meal';
  SELECT * INTO r FROM tasting_serve(T, 'fish_dace', 'cook', 100, 5, '{10,25}', '{150,400}', 250, 'tb-0002');
  ASSERT r.replayed AND r.stamped AND r.paid = 100 AND (SELECT coins FROM wallets WHERE member_id = T) = 900, 'replay pays nothing more';
  BEGIN PERFORM tasting_serve(T, 'fish_dace', 'cook', 100, 5, '{10,25}', '{150,400}', 250, 'tb-0003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_in_book', 'cook a stamp again: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = T AND item_key = 'fish_dace') = 1, 'a refused serve keeps the fish';
  -- the tank takes any rod fish, a stamped species too, and pays, stamps and counts nothing
  SELECT * INTO r FROM tasting_serve(T, 'fish_dace', 'tank', 100, 5, '{1,2}', '{150,400}', 250, 'tb-0004');
  ASSERT r.paid = 0 AND NOT r.stamped AND r.earned = 0 AND r.marks = '{}' AND r.remaining = 0 AND r.balance = 900, 'a drop does nothing';
  ASSERT (SELECT count(*) FROM tasting_book WHERE member_id = T) = 1, 'a drop fills no slot';
  ASSERT (SELECT way FROM tasting_serves WHERE member_id = T AND idempotency_key = 'tb-0004') = 'tank', 'the drop is the tank''s';
  SELECT * INTO r FROM tasting_serve(T, 'fish_dace', 'tank', 100, 5, '{1,2}', '{150,400}', 250, 'tb-0004');
  ASSERT r.replayed AND r.remaining = 0, 'a drop replays';
  -- the second species costs a step more
  PERFORM collections_record_catch(T, 'fish_sea_bass', 30, true);
  SELECT * INTO r FROM tasting_serve(T, 'fish_sea_bass', 'cook', 100, 5, '{2,25}', '{150,400}', 250, 'tb-0010');
  ASSERT r.paid = 105 AND r.balance = 945 AND r.earned = 150 AND r.marks = '{count:2}', 'fee scales with the species given, and the give pays the mark: ' || r.paid;
  -- a drop in the tank doesn't raise the fee
  PERFORM collections_record_catch(T, 'fish_anchovy', 12, true);
  PERFORM tasting_serve(T, 'fish_anchovy', 'tank', 100, 5, '{10,25}', '{150,400}', 250, 'tb-0011');
  PERFORM collections_record_catch(T, 'fish_squid', 20, true);
  SELECT * INTO r FROM tasting_serve(T, 'fish_squid', 'cook', 100, 5, '{10,25}', '{150,400}', 250, 'tb-0012');
  ASSERT r.paid = 110, 'drops are not gives: ' || r.paid;
  -- not a rod species, a locked fish, bad prices
  PERFORM collections_record_catch(T, 'bug_ladybug', NULL, false);
  BEGIN PERFORM tasting_serve(T, 'bug_ladybug', 'cook', 100, 5, '{10,25}', '{150,400}', 250, 'tb-0005'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', 'a bug: ' || SQLERRM; END;
  PERFORM collections_record_catch(T, 'fish_loach', 15, true);
  UPDATE member_collections SET locked = TRUE WHERE user_id = T AND item_key = 'fish_loach';
  BEGIN PERFORM tasting_serve(T, 'fish_loach', 'cook', 100, 5, '{10,25}', '{150,400}', 250, 'tb-0006'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'locked: ' || SQLERRM; END;
  BEGIN PERFORM tasting_serve(T, 'fish_pike', 'cook', 9000, 5, '{10,25}', '{150,400}', 250, 'tb-0007'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_qty', 'fee: ' || SQLERRM; END;
  BEGIN PERFORM tasting_serve(T, 'fish_pike', 'cook', 100, 500, '{10,25}', '{150,400}', 250, 'tb-0013'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_qty', 'step: ' || SQLERRM; END;
  BEGIN PERFORM tasting_serve(T, 'fish_pike', 'cook', 100, 5, '{10,25}', '{150}', 250, 'tb-0008'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_qty', 'marks: ' || SQLERRM; END;
  -- broke: the fish stays (one transaction)
  PERFORM collections_record_catch(T, 'fish_pike', 70, true);
  PERFORM wallet_apply(T, 'coins', -800, 'admin', 'drain', 'tb-drain');
  BEGIN PERFORM tasting_serve(T, 'fish_pike', 'cook', 100, 5, '{10,25}', '{150,400}', 250, 'tb-0009'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient', 'broke: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = T AND item_key = 'fish_pike') = 1, 'broke keeps the fish';
  ASSERT NOT EXISTS (SELECT 1 FROM tasting_book WHERE member_id = T AND species_key = 'fish_pike'), 'broke leaves the slot';
  RAISE NOTICE 'tasting give and tank ok';
END $$;

-- A dish the book taught: not before its key fish is given (a drop in the tank teaches nothing); then the ingredients and
-- the coins, all or nothing, and its buff.
DO $$
DECLARE T uuid := '00000000-0000-4000-8000-0000000000e1'; r record; v_coins int;
BEGIN
  PERFORM wallet_apply(T, 'coins', 1000, 'admin', 'seed', 'tb-seed-2');
  PERFORM collections_record_catch(T, 'fish_red_snapper', 40, true);
  PERFORM collections_record_catch(T, 'fish_red_snapper', 41, true);
  PERFORM collections_record_catch(T, 'fish_red_snapper', 42, true);
  PERFORM collections_record_catch(T, 'fish_sea_bass', 31, true);
  BEGIN PERFORM tasting_dish(T, 'snapper_chazuke', 250, 'fish_red_snapper', '{fish_red_snapper,fish_sea_bass,fish_sea_bass}', 0.1, 0, '2030-01-01', 'tb-d001'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_learned', 'unlearnt: ' || SQLERRM; END;
  -- the dace was given, so its dish is learnt: no not_learned
  BEGIN PERFORM tasting_dish(T, 'dace_karaage', 200, 'fish_dace', '{fish_dace}', 0, 0, '2030-01-01', 'tb-d007'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM <> 'not_learned', 'a given key fish teaches: ' || SQLERRM; END;
  PERFORM tasting_serve(T, 'fish_red_snapper', 'tank', 100, 5, '{10,25}', '{150,400}', 250, 'tb-d008');
  BEGIN PERFORM tasting_dish(T, 'snapper_chazuke', 250, 'fish_red_snapper', '{fish_red_snapper,fish_sea_bass,fish_sea_bass}', 0.1, 0, '2030-01-01', 'tb-d009'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_learned', 'the tank teaches nothing: ' || SQLERRM; END;
  PERFORM tasting_serve(T, 'fish_red_snapper', 'cook', 100, 5, '{10,25}', '{150,400}', 250, 'tb-d002');
  SELECT coins INTO v_coins FROM wallets WHERE member_id = T;
  -- one sea bass short: nothing taken, nothing paid
  BEGIN PERFORM tasting_dish(T, 'snapper_chazuke', 250, 'fish_red_snapper', '{fish_red_snapper,fish_sea_bass,fish_sea_bass}', 0.1, 0, '2030-01-01', 'tb-d003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'short: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = T AND item_key = 'fish_red_snapper') = 1 AND (SELECT coins FROM wallets WHERE member_id = T) = v_coins, 'a short dish takes nothing';
  PERFORM collections_record_catch(T, 'fish_sea_bass', 32, true);
  SELECT * INTO r FROM tasting_dish(T, 'snapper_chazuke', 250, 'fish_red_snapper', '{fish_red_snapper,fish_sea_bass,fish_sea_bass}', 0.1, 0, '2030-01-01', 'tb-d004');
  ASSERT r.paid = 250 AND r.balance = v_coins - 250 AND r.source = 'snapper_chazuke' AND NOT r.replayed, 'dish served';
  ASSERT (SELECT count FROM member_collections WHERE user_id = T AND item_key = 'fish_red_snapper') = 0, 'snapper used';
  ASSERT (SELECT count FROM member_collections WHERE user_id = T AND item_key = 'fish_sea_bass') = 0, 'both sea bass used';
  ASSERT (SELECT source FROM member_buffs WHERE member_id = T) = 'snapper_chazuke' AND (SELECT luck FROM member_buffs WHERE member_id = T) = 0.1, 'its buff is the meal';
  SELECT * INTO r FROM tasting_dish(T, 'snapper_chazuke', 250, 'fish_red_snapper', '{fish_red_snapper,fish_sea_bass,fish_sea_bass}', 0.1, 0, '2030-01-01', 'tb-d004');
  ASSERT r.replayed AND (SELECT coins FROM wallets WHERE member_id = T) = v_coins - 250, 'replay pays nothing more';
  BEGIN PERFORM tasting_dish(T, 'snapper_chazuke', 0, 'fish_red_snapper', '{fish_red_snapper}', 0.1, 0, '2030-01-01', 'tb-d005'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_qty', 'free dish: ' || SQLERRM; END;
  BEGIN PERFORM tasting_dish(T, 'snapper_chazuke', 250, 'fish_red_snapper', '{}', 0.1, 0, '2030-01-01', 'tb-d006'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_qty', 'no ingredients: ' || SQLERRM; END;
  RAISE NOTICE 'tasting dish ok';
END $$;

-- The marks: paid once each as the fish given reach them; the water once, by the give that completes its page.
DO $$
DECLARE G uuid := '00000000-0000-4000-8000-0000000000e2'; r record; k text; n int := 0; v_total int; v_paid int := 0;
BEGIN
  PERFORM wallet_apply(G, 'coins', 2000, 'admin', 'seed', 'tb-seed-g');
  PERFORM collections_record_catch(G, 'fish_char', 50, true);
  SELECT * INTO r FROM tasting_serve(G, 'fish_char', 'cook', 100, 5, '{2,3}', '{150,400}', 250, 'tb-0101');
  ASSERT r.paid = 100 AND r.stamped AND r.earned = 0, 'the first give';
  v_paid := v_paid + r.paid;
  PERFORM collections_record_catch(G, 'fish_gar', 100, true);
  PERFORM collections_record_catch(G, 'fish_gar', 101, true);
  SELECT * INTO r FROM tasting_serve(G, 'fish_gar', 'tank', 100, 5, '{2,3}', '{150,400}', 250, 'tb-0103');
  ASSERT r.earned = 0 AND r.marks = '{}', 'a drop counts toward no mark';
  SELECT * INTO r FROM tasting_serve(G, 'fish_gar', 'cook', 100, 5, '{2,3}', '{150,400}', 250, 'tb-0102');
  ASSERT r.earned = 150 AND r.marks = '{count:2}', 'second give: the first mark';
  v_paid := v_paid + r.paid;
  ASSERT (SELECT source FROM wallet_ledger WHERE member_id = G AND idempotency_key = 'tasting_mark:tb-0102') = 'quest', 'marks are a quest credit';
  -- the rest of the cliff pools: the second mark, then the last one completes the page and pays the water
  SELECT count(*) INTO v_total FROM collection_species WHERE tool = 'rod' AND active AND biome = 'cliff_pool';
  ASSERT v_total >= 4, 'cliff pool species seeded';
  FOR k IN SELECT key FROM collection_species WHERE tool = 'rod' AND active AND biome = 'cliff_pool' AND key NOT IN ('fish_char', 'fish_gar') ORDER BY key LOOP
    n := n + 1;
    PERFORM collections_record_catch(G, k, 50, true);
    SELECT * INTO r FROM tasting_serve(G, k, 'cook', 100, 5, '{2,3}', '{150,400}', 250, 'tb-02' || lpad(n::text, 2, '0'));
    v_paid := v_paid + r.paid;
    IF n = 1 THEN ASSERT r.earned = 400 AND r.marks = '{count:3}', 'third give: the second mark'; END IF;
    IF n < v_total - 2 THEN ASSERT NOT r.marks @> '{water:cliff_pool}', 'a page not yet full pays nothing'; END IF;
  END LOOP;
  ASSERT r.paid = 100 + 5 * (v_total - 1) AND r.earned = 250 AND r.marks = '{water:cliff_pool}', 'the last cliff pool fish fills the water: ' || r.marks::text;
  ASSERT (SELECT coins FROM wallets WHERE member_id = G) = 2000 - v_paid + 150 + 400 + 250, 'marks paid once each, the fees taken';
  RAISE NOTICE 'tasting marks ok';
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
DO $$ BEGIN
  PERFORM tasting_serve('00000000-0000-4000-8000-0000000000e1', 'fish_pike', 'cook', 1, 0, '{}', '{}', 0, 'tb-0900');
  RAISE EXCEPTION 'member called tasting_serve';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM tasting_dish('00000000-0000-4000-8000-0000000000e1', 'snapper_chazuke', 1, 'fish_dace', '{fish_dace}', 1, 1, '2030-01-01', 'tb-0901');
  RAISE EXCEPTION 'member called tasting_dish';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO tasting_book (member_id, species_key) VALUES ('00000000-0000-4000-8000-0000000000e1', 'fish_koi');
  RAISE EXCEPTION 'member wrote a stamp';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM tasting_book) = (SELECT count(*) FROM tasting_book WHERE member_id = '00000000-0000-4000-8000-0000000000e1'), 'a member reads only their own book';
END $$;
ROLLBACK;
