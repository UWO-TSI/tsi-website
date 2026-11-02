-- The per-rod catch tracker and the Training rod (20261102170000_rod_catches). Throwaway local Postgres after every
-- migration through it and the catalogue seed that adds the Training rod's row. Never Supabase. Each section fails
-- before 20261102170000 (no rod_key, no rod_catches, a four-argument collections_cast).
-- NOW() is fixed inside a transaction, so rolls are aged by moving rolled_at back.
\set ON_ERROR_STOP 1
-- backpack_smoke.sql re-applies 20261003054110_backpack, which brings back the four-argument cast this migration drops.
DROP FUNCTION IF EXISTS collections_cast(uuid, text, numeric, boolean);
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000007c1', 'd1@x'), ('00000000-0000-4000-8000-0000000007c2', 'd2@x');

-- ─── 1. A landed cast counts for its rod; an unlanded or refused one doesn't ──
DO $$
DECLARE
  D1 uuid := '00000000-0000-4000-8000-0000000007c1';
  a uuid;
BEGIN
  a := collections_cast(D1, 'fish_dace', 14, true, 'rod_cedar');
  ASSERT (SELECT rod_key FROM catch_rolls WHERE id = a) = 'rod_cedar', 'the cast keeps its rod';
  ASSERT NOT EXISTS (SELECT 1 FROM rod_catches WHERE member_id = D1), 'a cast alone counts nothing';
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '5 seconds' WHERE id = a;
  PERFORM collections_land(D1, a);
  ASSERT (SELECT count FROM rod_catches WHERE member_id = D1 AND rod_key = 'rod_cedar') = 1, 'the land counts one for the cedar rod';
  -- A land refused after collections_land (out of season, in seasonal_land's transaction) counts nothing.
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '10 seconds' WHERE member_id = D1;
  a := collections_cast(D1, 'fish_loach', 15, true, 'rod_cedar');
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '5 seconds' WHERE id = a;
  BEGIN PERFORM seasonal_land(D1, a, ARRAY['fish_loach'], NULL, NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'out_of_season', 'closed species: ' || SQLERRM; END;
  ASSERT (SELECT count FROM rod_catches WHERE member_id = D1 AND rod_key = 'rod_cedar') = 1, 'a refused land counted nothing';
  -- A cast with no rod (an old caller: p_rod defaults to NULL) lands and counts nothing.
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '10 seconds' WHERE member_id = D1;
  a := collections_cast(D1, 'fish_dace', 13, true);
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '5 seconds' WHERE id = a;
  PERFORM collections_land(D1, a);
  ASSERT (SELECT sum(count) FROM rod_catches WHERE member_id = D1) = 1, 'a rodless land counts nothing';
  RAISE NOTICE 'rod catches 1 counting ok';
END $$;

-- ─── 2. The Flimsy rod's 50th fish finds the Training rod, once ──────────────
DO $$
DECLARE
  D1 uuid := '00000000-0000-4000-8000-0000000007c1';
  a uuid;
  training uuid := (SELECT id FROM shop_items WHERE catalogue_ref = 'rod_training');
BEGIN
  ASSERT training IS NOT NULL, 'the Training rod has a shop row';
  ASSERT NOT (SELECT active FROM shop_items WHERE id = training), 'the Training rod is never sold';
  INSERT INTO rod_catches (member_id, rod_key, count) VALUES (D1, 'rod_flimsy', 48);
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '10 seconds' WHERE member_id = D1;
  a := collections_cast(D1, 'fish_dace', 12, true, 'rod_flimsy');
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '5 seconds' WHERE id = a;
  PERFORM collections_land(D1, a);
  ASSERT NOT EXISTS (SELECT 1 FROM member_inventory WHERE member_id = D1 AND item_id = training), 'the 49th finds nothing';
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '10 seconds' WHERE member_id = D1;
  a := collections_cast(D1, 'fish_dace', 12, true, 'rod_flimsy');
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '5 seconds' WHERE id = a;
  PERFORM collections_land(D1, a);
  ASSERT (SELECT count FROM rod_catches WHERE member_id = D1 AND rod_key = 'rod_flimsy') = 50, 'fifty on the flimsy rod';
  ASSERT (SELECT qty FROM member_inventory WHERE member_id = D1 AND item_id = training) = 1, 'the 50th finds the Training rod';
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '10 seconds' WHERE member_id = D1;
  a := collections_cast(D1, 'fish_dace', 12, true, 'rod_flimsy');
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '5 seconds' WHERE id = a;
  PERFORM collections_land(D1, a);
  ASSERT (SELECT qty FROM member_inventory WHERE member_id = D1 AND item_id = training) = 1, 'found once';
  -- Fish on another rod never find it.
  INSERT INTO rod_catches (member_id, rod_key, count) VALUES ('00000000-0000-4000-8000-0000000007c2', 'rod_cedar', 80);
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '10 seconds' WHERE member_id = '00000000-0000-4000-8000-0000000007c2';
  a := collections_cast('00000000-0000-4000-8000-0000000007c2', 'fish_dace', 12, true, 'rod_cedar');
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '5 seconds' WHERE id = a;
  PERFORM collections_land('00000000-0000-4000-8000-0000000007c2', a);
  ASSERT NOT EXISTS (SELECT 1 FROM member_inventory WHERE member_id = '00000000-0000-4000-8000-0000000007c2' AND item_id = training), 'only the flimsy rod finds it';
  RAISE NOTICE 'rod catches 2 training rod ok';
END $$;

-- ─── 3. Owners read their own counts; nobody writes them or casts ────────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000007c1","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM rod_catches) = 2, 'd1 reads their own two rods';
  ASSERT NOT EXISTS (SELECT 1 FROM rod_catches WHERE member_id <> '00000000-0000-4000-8000-0000000007c1'), 'and nobody else''s';
  BEGIN INSERT INTO rod_catches (member_id, rod_key, count) VALUES ('00000000-0000-4000-8000-0000000007c1', 'rod_glass', 999); RAISE EXCEPTION 'member wrote a count';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE rod_catches SET count = 999; RAISE EXCEPTION 'member raised a count';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM rod_catches; RAISE EXCEPTION 'member cleared a count';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM collections_cast('00000000-0000-4000-8000-0000000007c1', 'fish_dace', 12, true, 'rod_flimsy'); RAISE EXCEPTION 'member cast';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'rod catches 3 owner read only ok';
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM 1 FROM rod_catches; RAISE EXCEPTION 'anon read the counts';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'rod catches 4 anon locked out ok';
END $$;
ROLLBACK;
\echo smoke ok
