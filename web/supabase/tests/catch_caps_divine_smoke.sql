-- The hourly catch caps by rarity (20261028150000_catch_caps_divine). Throwaway local Postgres after every migration,
-- with the pre_* seeds. Never Supabase. Fails before the migration: a divine or contraband catch takes the common cap
-- (60 an hour), so the fourth is recorded.
\set ON_ERROR_STOP 1
-- Earlier smokes in the chain re-run 20261003054110_backpack, which defines collections_record_catch with the old caps:
-- apply this one again (it is idempotent). The chain's first run of this smoke, before that line, was the fail-first run.
\ir ../migrations/20261028150000_catch_caps_divine.sql
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000ca901', 'cap-1@x'), ('00000000-0000-4000-8000-0000000ca902', 'cap-2@x'),
  ('00000000-0000-4000-8000-0000000ca903', 'cap-3@x'), ('00000000-0000-4000-8000-0000000ca904', 'cap-4@x')
ON CONFLICT DO NOTHING;
-- One stand-in species per rarity (no fish is legendary or divine in the catalogue yet), copied from a real fish.
CREATE TEMP TABLE cap_species AS SELECT * FROM collection_species WHERE category = 'fish' AND active ORDER BY position LIMIT 1;
INSERT INTO collection_species SELECT (c).* FROM (
  SELECT jsonb_populate_record(c, jsonb_build_object('key', 'smoke_cap_' || r, 'rarity', r, 'position', c.position + 9000 + n)) AS c
  FROM cap_species c, unnest(ARRAY['legendary', 'divine', 'contraband', 'epic']) WITH ORDINALITY AS t(r, n)) x;
DO $$
DECLARE
  r TEXT; cap INT; i INT; m uuid; refused BOOLEAN;
BEGIN
  FOR r, cap, m IN VALUES ('legendary', 3, '00000000-0000-4000-8000-0000000ca901'::uuid), ('divine', 3, '00000000-0000-4000-8000-0000000ca902'::uuid),
                          ('contraband', 3, '00000000-0000-4000-8000-0000000ca903'::uuid), ('epic', 6, '00000000-0000-4000-8000-0000000ca904'::uuid) LOOP
    FOR i IN 1..cap LOOP PERFORM public.collections_record_catch(m, 'smoke_cap_' || r, NULL, FALSE); END LOOP;
    refused := FALSE;
    BEGIN
      PERFORM public.collections_record_catch(m, 'smoke_cap_' || r, NULL, FALSE);
    EXCEPTION WHEN raise_exception THEN refused := SQLERRM = 'rate_limited';
    END;
    ASSERT refused, format('%s: the catch past %s an hour is refused', r, cap);
    ASSERT (SELECT count FROM member_collections WHERE user_id = m AND item_key = 'smoke_cap_' || r) = cap, format('%s: %s kept', r, cap);
  END LOOP;
  RAISE NOTICE 'catch caps divine smoke ok';
END $$;
DELETE FROM member_collections WHERE item_key LIKE 'smoke_cap_%';
DELETE FROM collection_catch_hours WHERE item_key LIKE 'smoke_cap_%';
DELETE FROM collection_species WHERE key LIKE 'smoke_cap_%';
