-- Row 270 / cafe-polish §7: the premium café's 20 seats (20261001072421_cafe_tables_seed) — window
-- stools, tables for two and four, a four-seat booth and a communal table — the same 7 café table ids,
-- outdoor tables untouched, and a re-run changes nothing. Throwaway local Postgres after every
-- migration. Never Supabase. Fails before the migration (19 seats, the old labels).
\set ON_ERROR_STOP 1
DO $$
BEGIN
  ASSERT (SELECT sum(seats) FROM study_tables WHERE location = 'cafe') = 20, 'cafe seats: ' || (SELECT sum(seats) FROM study_tables WHERE location = 'cafe');
  ASSERT (SELECT count(*) FROM study_tables WHERE location = 'cafe' AND id::text LIKE '00000000-0000-4000-8000-00000000510%') = 7, 'the 7 cafe table ids';
  ASSERT (SELECT label = 'Booth' AND seats = 4 AND kind = 'couch' FROM study_tables WHERE slug = 'cafe-couch'), 'booth';
  ASSERT (SELECT label FROM study_tables WHERE slug = 'cafe-four-2') = 'Communal table', 'communal';
  ASSERT (SELECT label FROM study_tables WHERE slug = 'cafe-window-1') = 'Window bar 1', 'window bar';
  ASSERT (SELECT label = 'Plaza picnic table' AND seats = 4 FROM study_tables WHERE slug = 'plaza-picnic'), 'outdoor untouched';
END $$;
\ir ../migrations/20261001072421_cafe_tables_seed.sql
DO $$
BEGIN
  ASSERT (SELECT sum(seats) FROM study_tables WHERE location = 'cafe') = 20, 'idempotent';
  ASSERT (SELECT count(*) FROM study_tables) = 9, 'no new tables';
  RAISE NOTICE 'cafe tables ok';
END $$;
