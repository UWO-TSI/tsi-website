-- Traditions and trick-or-treat (20261013210000_traditions). Throwaway local Postgres after every migration
-- (supabase_stub.sql first), after v1_drop_copy_smoke.sql. Never Supabase. Fails before the migration: no traditions
-- table, no treats, no traditions_treat.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000031a0', 'treat@x');

DO $$
DECLARE
  M uuid := '00000000-0000-4000-8000-0000000031a0';
  fill text[];
BEGIN
  -- The calendar: Halloween seeded, Oct 25 to Nov 1, everything on; everyone reads it, nobody but T1/T2 writes it.
  ASSERT (SELECT starts_on || ' ' || ends_on FROM traditions WHERE id = 'halloween') = '10-25 11-01', 'Halloween''s window';
  ASSERT (SELECT content FROM traditions WHERE id = 'halloween') = '{"pumpkins":true,"costumes":true,"trick_or_treat":true,"fog_nights":true}'::jsonb, 'Halloween''s content';
  ASSERT has_table_privilege('anon', 'traditions', 'select'), 'anon reads the calendar';
  BEGIN INSERT INTO traditions (id, title, starts_on, ends_on) VALUES ('bad', 'Bad', '13-01', '01-01'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO traditions (id, title, starts_on, ends_on, content) VALUES ('arr', 'Arr', '01-01', '01-02', '[]'::jsonb); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- The treats are bag items that stack and can be eaten, never donated.
  ASSERT (SELECT count(*) FROM collection_species WHERE sub = 'treat' AND category = 'fruit' AND NOT donatable AND active) = 3, 'three treats';

  -- A full bag: the resident's treat doesn't fit, and nothing is recorded (knock again after making room).
  SELECT array_agg(key ORDER BY key) INTO fill FROM (SELECT key FROM collection_species WHERE category = 'fish' ORDER BY key LIMIT 20) f;
  INSERT INTO member_collections (user_id, item_key, count) SELECT M, k, 1 FROM unnest(fill) k;
  BEGIN PERFORM traditions_treat(M, 'curator', '2026-10-25', 'treat_toffee'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bag_full', 'full bag: ' || SQLERRM; END;
  ASSERT NOT EXISTS (SELECT 1 FROM trick_or_treats WHERE member_id = M), 'no treat recorded while the bag is full';

  -- Room made: the treat lands, once per resident per night.
  DELETE FROM member_collections WHERE user_id = M AND item_key = fill[1];
  ASSERT (SELECT t.count FROM traditions_treat(M, 'curator', '2026-10-25', 'treat_toffee') t) = 1, 'a toffee';
  BEGIN PERFORM traditions_treat(M, 'curator', '2026-10-25', 'treat_lollipop'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_treated', 'same resident, same night: ' || SQLERRM; END;
  -- Another resident the same night, and the same resident the next night: both answer (the toffees stack: no new slot).
  ASSERT (SELECT t.count FROM traditions_treat(M, 'curator', '2026-10-26', 'treat_toffee') t) = 2, 'the next night';
  ASSERT (SELECT t.count FROM traditions_treat(M, 'wharf-keeper', '2026-10-26', 'treat_toffee') t) = 3, 'another door';
  ASSERT (SELECT count(*) FROM trick_or_treats WHERE member_id = M) = 3, 'three nights-and-doors recorded';
  BEGIN PERFORM traditions_treat(M, 'crafter', '2026-10-26', 'fish_bass'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_a_treat', 'a fish is no treat: ' || SQLERRM; END;

  -- Only the server gives treats; members read only their own.
  ASSERT NOT has_function_privilege('authenticated', 'public.traditions_treat(uuid, text, date, text)', 'execute'), 'service role only';
  ASSERT NOT has_table_privilege('authenticated', 'trick_or_treats', 'insert'), 'members can''t write treats';
  RAISE NOTICE 'traditions ok';
END $$;
