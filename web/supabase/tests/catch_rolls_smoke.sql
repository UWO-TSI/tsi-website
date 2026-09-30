-- Server-authoritative catch rolls (20260929100000_catch_rolls). Throwaway local
-- Postgres after every migration through it. Never Supabase. Each section
-- fails before 20260929100000 (the functions and table don't exist).
-- NOW() is fixed inside a transaction, so rolls are aged by moving rolled_at back.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000c1', 'c1@x'), ('00000000-0000-4000-8000-0000000000c2', 'c2@x');

-- ─── 1. Members can't roll, land, harvest or write a roll themselves ─────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
DO $$ BEGIN
  BEGIN PERFORM collections_cast('00000000-0000-4000-8000-0000000000c1', 'fish_golden_koi', 95, true); RAISE EXCEPTION 'member cast a roll';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM collections_harvest('00000000-0000-4000-8000-0000000000c1', 'rock-0', '2026-09-29T12', 'rock_gold_nugget', NULL, false); RAISE EXCEPTION 'member harvested a forged species';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM collections_land('00000000-0000-4000-8000-0000000000c1', gen_random_uuid()); RAISE EXCEPTION 'member landed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM collections_record_catch('00000000-0000-4000-8000-0000000000c1', 'fish_golden_koi', 95, true); RAISE EXCEPTION 'member recorded a catch';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO catch_rolls (member_id, item_key, size_cm) VALUES ('00000000-0000-4000-8000-0000000000c1', 'fish_golden_koi', 95); RAISE EXCEPTION 'member wrote a roll';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM catch_rolls; RAISE EXCEPTION 'member read the rolls';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'catch 1 members locked out ok';
END $$;
ROLLBACK;

-- ─── 2. Casts: 4 s apart; land 3 s to 3 min after, once, own and latest only ──
DO $$
DECLARE
  C1 uuid := '00000000-0000-4000-8000-0000000000c1';
  a uuid; b uuid; r record;
BEGIN
  a := collections_cast(C1, 'fish_dace', 14, true);
  BEGIN PERFORM collections_cast(C1, 'fish_dace', 12, true); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'too_fast', 'cast gap: ' || SQLERRM; END;
  BEGIN PERFORM collections_land(C1, a); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'too_fast', 'reel minimum: ' || SQLERRM; END;
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '5 seconds' WHERE id = a;
  BEGIN PERFORM collections_land('00000000-0000-4000-8000-0000000000c2', a); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'no_roll', 'someone else''s roll: ' || SQLERRM; END;
  SELECT * INTO r FROM collections_land(C1, a);
  ASSERT r.item_key = 'fish_dace' AND r.size_cm = 14 AND r.count = 1, 'landed the rolled species and size';
  BEGIN PERFORM collections_land(C1, a); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_landed', 'landed twice: ' || SQLERRM; END;
  -- A newer cast voids the older roll; a roll older than 3 minutes lapses.
  a := collections_cast(C1, 'fish_bitterling', 6, true);
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '10 seconds' WHERE id = a;
  b := collections_cast(C1, 'fish_loach', 15, true);
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '5 seconds' WHERE id = b;
  BEGIN PERFORM collections_land(C1, a); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'roll_expired', 'superseded roll: ' || SQLERRM; END;
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '4 minutes' WHERE id = b;
  BEGIN PERFORM collections_land(C1, b); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'roll_expired', 'stale roll: ' || SQLERRM; END;
  ASSERT NOT EXISTS (SELECT 1 FROM member_collections WHERE user_id = C1 AND item_key IN ('fish_bitterling', 'fish_loach')), 'unlanded rolls recorded nothing';
  RAISE NOTICE 'catch 2 casts ok';
END $$;

-- ─── 3. Harvests: once per node per hour ─────────────────────────────────────
DO $$
DECLARE C1 uuid := '00000000-0000-4000-8000-0000000000c1';
BEGIN
  PERFORM collections_harvest(C1, 'rock-0', '2026-09-29T12', 'rock_stone', NULL, false);
  BEGIN PERFORM collections_harvest(C1, 'rock-0', '2026-09-29T12', 'rock_gold_nugget', NULL, false); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_harvested', 'node twice in an hour: ' || SQLERRM; END;
  PERFORM collections_harvest(C1, 'rock-0', '2026-09-29T13', 'rock_stone', NULL, false);
  PERFORM collections_harvest('00000000-0000-4000-8000-0000000000c2', 'rock-0', '2026-09-29T12', 'rock_stone', NULL, false);
  ASSERT (SELECT count FROM member_collections WHERE user_id = C1 AND item_key = 'rock_stone') = 2, 'two hours, two stones';
  ASSERT NOT EXISTS (SELECT 1 FROM member_collections WHERE user_id = C1 AND item_key = 'rock_gold_nugget'), 'the refused harvest recorded nothing';
  RAISE NOTICE 'catch 3 harvests ok';
END $$;

-- ─── 4. The hourly caps hold through harvests and landings ───────────────────
DO $$
DECLARE C2 uuid := '00000000-0000-4000-8000-0000000000c2'; a uuid;
BEGIN
  PERFORM collections_harvest(C2, 'shell-' || i, '2026-09-29T12', 'fish_golden_koi', 70, true) FROM generate_series(1, 3) i;
  BEGIN PERFORM collections_harvest(C2, 'shell-4', '2026-09-29T12', 'fish_golden_koi', 70, true); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'rate_limited', 'legendary cap by harvest: ' || SQLERRM; END;
  ASSERT NOT EXISTS (SELECT 1 FROM catch_rolls WHERE member_id = C2 AND node_id = 'shell-4'), 'a capped harvest leaves its node';
  a := collections_cast(C2, 'fish_golden_koi', 80, true);
  UPDATE catch_rolls SET rolled_at = rolled_at - INTERVAL '5 seconds' WHERE id = a;
  BEGIN PERFORM collections_land(C2, a); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'rate_limited', 'legendary cap by landing: ' || SQLERRM; END;
  ASSERT (SELECT landed_at FROM catch_rolls WHERE id = a) IS NULL, 'a capped landing stays unlanded';
  ASSERT (SELECT count FROM member_collections WHERE user_id = C2 AND item_key = 'fish_golden_koi') = 3, 'capped at 3';
  RAISE NOTICE 'catch 4 caps ok';
END $$;
