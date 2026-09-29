-- Local smoke test for the unapplied drafts 029/030/031 (never run against a
-- Supabase project). Needs a throwaway Postgres with stub auth schema/roles,
-- then 001, 014, 015, 016, 023, 024, 029, 030, 031, 032, 033 applied (coins live
-- in 033's wallet; 029/030 debit through wallet_apply). See
-- specs/evidence/systems/sql-smoke.md for the exact commands.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000000aa', 'a@x'), ('00000000-0000-4000-8000-0000000000bb', 'b@x');
INSERT INTO profiles (id, email, display_name) VALUES
  ('00000000-0000-4000-8000-0000000000aa', 'a@x', 'Maya'),
  ('00000000-0000-4000-8000-0000000000bb', 'b@x', 'Jordan')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;  -- a profile trigger may have created the row
SELECT * FROM wallet_apply('00000000-0000-4000-8000-0000000000aa', 'coins', 2000, 'admin', 'smoke seed', 'seed:a');
SELECT * FROM wallet_apply('00000000-0000-4000-8000-0000000000bb', 'coins', 100, 'admin', 'smoke seed', 'seed:b');

-- 029: idempotent capped credit + coin debit
DO $$
DECLARE g uuid; r record; A uuid := '00000000-0000-4000-8000-0000000000aa'; B uuid := '00000000-0000-4000-8000-0000000000bb';
BEGIN
  SELECT id INTO g FROM club_goals WHERE slug = 'reopen-cafe';
  SELECT * INTO r FROM progression_commit_contribution(g, 0, A, 'delivery', 'coins', NULL, 500, 500, 1, 500, false, 3000, 1500, 'delivery:k1', NULL, NULL, NULL);
  ASSERT NOT r.replayed AND r.credited_points = 500, '029 first credit';
  SELECT * INTO r FROM progression_commit_contribution(g, 0, A, 'delivery', 'coins', NULL, 500, 500, 1, 500, false, 3000, 1500, 'delivery:k1', NULL, NULL, NULL);
  ASSERT r.replayed, '029 replay';
  ASSERT (SELECT coins FROM wallets WHERE member_id = A) = 1500, '029 charged once';
  BEGIN
    PERFORM progression_commit_contribution(g, 0, A, 'delivery', 'coins', NULL, 1100, 1100, 1, 1100, false, 3000, 1500, 'delivery:k2', NULL, NULL, NULL);
    RAISE EXCEPTION 'expected cap_exceeded';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'cap_exceeded', '029 cap: ' || SQLERRM; END;
  ASSERT (SELECT coins FROM wallets WHERE member_id = A) = 1500, '029 no charge over cap';
  BEGIN
    PERFORM progression_commit_contribution(g, 0, B, 'delivery', 'coins', NULL, 200, 200, 1, 200, false, 3000, 1500, 'delivery:k3', NULL, NULL, NULL);
    RAISE EXCEPTION 'expected insufficient';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient', '029 insufficient: ' || SQLERRM; END;
  ASSERT (SELECT points FROM club_goal_progress WHERE goal_id = g AND cycle = 0) = 500, '029 progress view';
  RAISE NOTICE '029 ok';
END $$;

-- 030: save (optimistic, idempotent), buy room (price, cap, coins)
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000000aa'; B uuid := '00000000-0000-4000-8000-0000000000bb';
BEGIN
  SELECT * INTO r FROM home_save_layout(A, 0, 'save-0001', '[{"id":"room-1","wallpaper":"log00","flooring":"tatami00","items":[{"uid":"x","piece":"floor-lamp","cell":[5,2],"rot":0}]}]', '[]');
  ASSERT r.revision = 1 AND NOT r.replayed, '030 save';
  SELECT * INTO r FROM home_save_layout(A, 0, 'save-0001', '[]', '[]');
  ASSERT r.replayed AND r.revision = 1, '030 save replay';
  BEGIN PERFORM home_save_layout(A, 0, 'save-0002', '[]', '[]'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'revision_conflict', '030 conflict: ' || SQLERRM; END;
  SELECT * INTO r FROM home_buy_room(A, 500, 4, 'room-0001', 'room-2', 'stripe02', 'tatami00');
  ASSERT r.rooms_count = 2 AND r.coins = 1000 AND NOT r.replayed, '030 buy';
  SELECT * INTO r FROM home_buy_room(A, 500, 4, 'room-0001', 'room-2', 'stripe02', 'tatami00');
  ASSERT r.replayed AND r.rooms_count = 2 AND r.coins = 1000, '030 buy replay';
  PERFORM home_buy_room(A, 500, 4, 'room-0002', 'room-3', 'stripe02', 'tatami00');
  PERFORM wallet_apply(A, 'coins', 3500, 'admin', 'smoke top-up', 'seed:a2');
  PERFORM home_buy_room(A, 500, 4, 'room-0003', 'room-4', 'stripe02', 'tatami00');
  BEGIN PERFORM home_buy_room(A, 500, 4, 'room-0004', 'room-5', 'stripe02', 'tatami00'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'room_cap', '030 cap: ' || SQLERRM; END;
  ASSERT (SELECT coins FROM wallets WHERE member_id = A) = 3500, '030 cap not charged';
  ASSERT (SELECT count(*) FROM member_home_rooms WHERE member_id = A) = 4, '030 rows';
  BEGIN PERFORM home_buy_room(B, 500, 4, 'room-0005', 'room-2', 'stripe02', 'tatami00'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient', '030 insufficient: ' || SQLERRM; END;
  RAISE NOTICE '030 ok';
END $$;

-- 031: records, weekly bests, museum first donor + duplicate refusal
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000000aa'; B uuid := '00000000-0000-4000-8000-0000000000bb';
BEGIN
  ASSERT (SELECT count(*) FROM collection_species) >= 100, '031 roster seeded'; -- + crafting materials (20260926160000)
  ASSERT (SELECT count(*) FROM collection_species WHERE category = 'fish' AND key NOT IN ('fish_yellow_perch', 'fish_sturgeon', 'fish_giant_trevally')) = 40, '031 40 fish'; -- + 3 limited-time catches (20260929120000)
  SELECT * INTO r FROM collections_record_catch(A, 'fish_dace', 12.5, true);
  ASSERT r.count = 1 AND r.new_record AND r.best_size_cm = 12.5, '031 first catch';
  SELECT * INTO r FROM collections_record_catch(A, 'fish_dace', 11.0, true);
  ASSERT r.count = 2 AND r.total_collected = 2 AND NOT r.new_record AND r.best_size_cm = 12.5, '031 smaller catch';
  ASSERT (SELECT size_cm FROM weekly_catch_bests WHERE user_id = A AND item_key = 'fish_dace') = 12.5, '031 weekly best kept';
  PERFORM collections_record_catch(B, 'fish_dace', 17.0, true);
  SELECT * INTO r FROM museum_donate(A, 'fish_dace', 'donate-0001', 12.5);
  ASSERT NOT r.replayed, '031 donate';
  SELECT * INTO r FROM museum_donate(A, 'fish_dace', 'donate-0001', 12.5);
  ASSERT r.replayed, '031 donate replay';
  ASSERT (SELECT count FROM member_collections WHERE user_id = A AND item_key = 'fish_dace') = 1, '031 consumed once';
  BEGIN PERFORM museum_donate(B, 'fish_dace', 'donate-0002', 17.0); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_donated', '031 duplicate: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = B AND item_key = 'fish_dace') = 1, '031 duplicate keeps specimen';
  ASSERT (SELECT donor_id FROM museum_donations WHERE species_key = 'fish_dace') = A, '031 first donor credited';
  BEGIN PERFORM museum_donate(B, 'fish_carp', 'donate-0003', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_owned', '031 not owned: ' || SQLERRM; END;
  BEGIN PERFORM museum_donate(B, 'apple', 'donate-0004', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_donatable', '031 fruit: ' || SQLERRM; END;
  RAISE NOTICE '031 ok';
END $$;
