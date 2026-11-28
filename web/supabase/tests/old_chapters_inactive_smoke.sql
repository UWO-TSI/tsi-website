-- 20261128200412_old_chapters_inactive. Throwaway local Postgres after every migration (supabase_stub.sql first).
-- Never Supabase. The four old chapters stop being offered; their rows stay, and the road's chapters stay active.
\set ON_ERROR_STOP 1
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM quest_chapters WHERE slug IN ('settle-in', 'reopen-cafe', 'fund-museum', 'ruins-gate')) = 4, 'the rows stay';
  ASSERT (SELECT count(*) FROM quest_chapters WHERE slug IN ('settle-in', 'reopen-cafe', 'fund-museum', 'ruins-gate') AND active) = 0, 'none offered';
  ASSERT (SELECT bool_and(active) FROM quest_chapters WHERE slug IN ('first-find', 'odiles-net', 'pims-shovel', 'brams-challenge', 'the-museum')), 'the road stays';
  RAISE NOTICE 'old chapters inactive ok';
END $$;
