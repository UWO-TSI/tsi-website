-- The main quest, round 2 (20261030010100_main_quest_r2, then the catalogue seed after it): chapter XP, dig loot and the
-- museum's drive. Throwaway local Postgres after every migration (supabase_stub.sql first). Never Supabase. Each
-- section fails before 20261030010100 (the column, tables and functions don't exist).
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000a2e01', 'e1@x'), ('00000000-0000-4000-8000-0000000a2e02', 'e2@x');

-- ─── 1. Chapter XP: chapter 1 pays a level; 'chapter' XP is a real source, a level up comes back ───
DO $$
DECLARE E1 uuid := '00000000-0000-4000-8000-0000000a2e01'; r record;
BEGIN
  ASSERT (SELECT reward_xp FROM quest_chapters WHERE slug = 'first-find') = 125, 'chapter 1 pays 125 XP';
  ASSERT (SELECT count(*) FROM quest_chapters WHERE reward_xp > 0) = 1, 'only chapter 1 pays XP';
  ASSERT public.combat_level_for_xp(125) = 2, '125 XP is level 2';
  SELECT * INTO r FROM public.combat_grant_xp(E1, 125, 'chapter', 'first-find', 'chapter_xp:first-find');
  ASSERT r.xp = 125 AND r.level = 2 AND r.levelled_up AND NOT r.replayed, 'chapter XP levels up: ' || row_to_json(r)::text;
  SELECT * INTO r FROM public.combat_grant_xp(E1, 125, 'chapter', 'first-find', 'chapter_xp:first-find');
  ASSERT r.xp = 125 AND r.replayed, 'paid once';
  BEGIN INSERT INTO quest_chapters (slug, position, title, requirement, reward_xp) VALUES ('smoke-xp', 43, 'Smoke', 'dig', -1); RAISE EXCEPTION 'FAIL negative XP went in';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'main quest r2 1 chapter xp ok';
END $$;

-- ─── 2. Dig loot: the broken sudo lands in the bag, a purse pays the wallet once, each spot once an hour ───
DO $$
DECLARE E1 uuid := '00000000-0000-4000-8000-0000000a2e01'; r record; v_gems INTEGER;
BEGIN
  ASSERT (SELECT donatable AND wing = 'nature_room' AND rarity = 'legendary' FROM collection_species WHERE key = 'find_broken_sudo'), 'the broken sudo is a real buried find';
  SELECT * INTO r FROM public.collections_dig(E1, 'dig-soil-9', '2026-10-28T15', 'find_broken_sudo', NULL, false, NULL, NULL);
  ASSERT r.count = 1 AND r.total_collected = 1 AND r.digs = 1, 'the sudo lands: ' || row_to_json(r)::text;
  ASSERT (SELECT count FROM member_collections WHERE user_id = E1 AND item_key = 'find_broken_sudo') = 1, 'in the bag';
  BEGIN PERFORM public.collections_dig(E1, 'dig-soil-9', '2026-10-28T15', 'find_amber', 4, false, NULL, NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_harvested', 'one dig per spot an hour: ' || SQLERRM; END;
  ASSERT (SELECT digs FROM member_digs WHERE member_id = E1) = 1, 'a refused dig counts nothing';
  -- Coins: into the wallet, keyed by the spot and hour.
  SELECT * INTO r FROM public.collections_dig(E1, 'dig-sand-2', '2026-10-28T15', NULL, NULL, false, 'coins', 32);
  ASSERT r.count IS NULL AND r.digs = 2, 'a purse: ' || row_to_json(r)::text;
  ASSERT (SELECT coins FROM wallets WHERE member_id = E1) >= 32, 'coins paid';
  ASSERT (SELECT count(*) FROM wallet_ledger WHERE member_id = E1 AND source = 'dig' AND amount = 32) = 1, 'one dig credit';
  -- A gem: the premium currency, type earn_dig.
  SELECT tethos_coins INTO v_gems FROM profiles WHERE id = E1;
  PERFORM public.collections_dig(E1, 'dig-sand-3', '2026-10-28T15', NULL, NULL, false, 'gems', 1);
  ASSERT (SELECT tethos_coins FROM profiles WHERE id = E1) = coalesce(v_gems, 0) + 1, 'a gem paid';
  ASSERT (SELECT count(*) FROM tc_transactions WHERE user_id = E1 AND type = 'earn_dig') = 1, 'one gem transaction';
  -- Refused: not a dig spot, both or neither loot, an odd currency, too big a purse.
  BEGIN PERFORM public.collections_dig(E1, 'rock-1', '2026-10-28T16', 'rock_stone', NULL, false, NULL, NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_a_dig', SQLERRM; END;
  BEGIN PERFORM public.collections_dig(E1, 'dig-sand-4', '2026-10-28T16', 'find_amber', 4, false, 'coins', 5); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_loot', SQLERRM; END;
  BEGIN PERFORM public.collections_dig(E1, 'dig-sand-4', '2026-10-28T16', NULL, NULL, false, 'tickets', 5); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_currency', SQLERRM; END;
  BEGIN PERFORM public.collections_dig(E1, 'dig-sand-4', '2026-10-28T16', NULL, NULL, false, 'gems', 2); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_amount', SQLERRM; END;
  ASSERT (SELECT digs FROM member_digs WHERE member_id = E1) = 3, 'three digs';
  RAISE NOTICE 'main quest r2 2 dig loot ok';
END $$;

-- ─── 3. The museum's drive: a kind already on display can still be handed in, and counts ───
DO $$
DECLARE E1 uuid := '00000000-0000-4000-8000-0000000a2e01'; E2 uuid := '00000000-0000-4000-8000-0000000a2e02'; r record; sp TEXT;
BEGIN
  -- A fish nobody has donated yet in this database.
  SELECT key INTO sp FROM collection_species WHERE category = 'fish' AND donatable AND active AND key NOT IN (SELECT species_key FROM museum_donations) ORDER BY key LIMIT 1;
  PERFORM public.collections_record_catch(E2, sp, 12, false);
  PERFORM public.collections_record_catch(E2, sp, 13, false);
  PERFORM public.museum_donate(E2, sp, 'r2-don-0001', 12);
  ASSERT (SELECT count(*) FROM museum_donations WHERE species_key = sp) = 1, 'on display';
  -- The second one can't be donated (one per species), but it can be handed in to the drive.
  SELECT * INTO r FROM public.museum_hand_in(E2, sp, 'r2-hand-0001');
  ASSERT NOT r.replayed, 'handed in';
  SELECT * INTO r FROM public.museum_hand_in(E2, sp, 'r2-hand-0001');
  ASSERT r.replayed, 'a replayed key is a no-op';
  ASSERT (SELECT count(*) FROM museum_handins WHERE member_id = E2) = 1, 'one hand-in';
  ASSERT (SELECT count FROM member_collections WHERE user_id = E2 AND item_key = sp) = 0, 'consumed one';
  BEGIN PERFORM public.museum_hand_in(E2, sp, 'r2-hand-0002'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_owned', SQLERRM; END;
  -- The broken sudo can go to the drive too (a buried find), from the dig above.
  PERFORM public.museum_hand_in(E1, 'find_broken_sudo', 'r2-hand-sudo');
  BEGIN PERFORM public.museum_hand_in(E1, 'rock_stone', 'r2-hand-rock'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_donatable', SQLERRM; END;
  RAISE NOTICE 'main quest r2 3 museum drive ok';
END $$;

-- ─── 4. Members can't dig, hand in or write the tallies themselves ───
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000a2e01","role":"authenticated"}';
DO $$ BEGIN
  BEGIN PERFORM collections_dig('00000000-0000-4000-8000-0000000a2e01', 'dig-soil-1', '2026-10-28T17', 'find_broken_sudo', NULL, false, NULL, NULL); RAISE EXCEPTION 'member dug';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM museum_hand_in('00000000-0000-4000-8000-0000000a2e01', 'fish_dace', 'r2-x-0001'); RAISE EXCEPTION 'member handed in';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO museum_handins (member_id, species_key, idempotency_key) VALUES ('00000000-0000-4000-8000-0000000a2e01', 'fish_dace', 'r2-y-0001'); RAISE EXCEPTION 'member wrote a hand-in';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE member_digs SET digs = 99; RAISE EXCEPTION 'member wrote digs';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ASSERT (SELECT count(*) FROM museum_handins) = 2, 'the drive is readable';
  RAISE NOTICE 'main quest r2 4 members locked out ok';
END $$;
ROLLBACK;

-- ─── 5. Copy: the new wording where 20261030010000's stood ───
DO $$
BEGIN
  ASSERT (SELECT step_copy #>> '{donate_new,label}' FROM quest_chapters WHERE slug = 'the-museum') = 'Bring Odile 3 things for the museum', 'museum step';
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'the-museum') LIKE 'The museum opens when the club has brought it%', 'museum summary';
  ASSERT (SELECT step_copy #>> '{dig_up,hint}' FROM quest_chapters WHERE slug = 'pims-shovel') LIKE 'Look closely:%', 'dig hint';
  ASSERT (SELECT active FROM quest_chapters WHERE slug = 'elizas-pickaxe'), 'the pickaxe row stays (parked in code, web/lib/game/drops.ts)';
  RAISE NOTICE 'main quest r2 5 copy ok';
END $$;

-- ─── 6. Idempotent: applied again, nothing moves ───
\ir ../migrations/20261030010100_main_quest_r2.sql
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM pg_constraint WHERE conrelid = 'wallet_ledger'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%study%') = 1, 'one wallet source CHECK';
  ASSERT (SELECT count(*) FROM pg_constraint WHERE conrelid = 'combat_xp_ledger'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%kill%') = 1, 'one XP source CHECK';
  ASSERT (SELECT count(*) FROM museum_handins) = 2 AND (SELECT digs FROM member_digs WHERE member_id = '00000000-0000-4000-8000-0000000a2e01') = 3, 'data kept';
  RAISE NOTICE 'main quest r2 6 idempotent ok';
END $$;
