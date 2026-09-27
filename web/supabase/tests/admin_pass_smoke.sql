-- Admin pass (specs/admin-pass.md). Throwaway local Postgres after every
-- migration through 20260927090000_admin_pass, with pre_launch_seed.sql.
-- Never Supabase. Each section fails before 20260927090000.
\set ON_ERROR_STOP 1

-- ─── 1. Residents: post, bio, tone, schedule; the seeded two keep their spots ─
DO $$ BEGIN
  ASSERT (SELECT schedule ->> 'day' FROM npc_personas WHERE slug = 'mayor') = 'path', 'mayor keeps the path';
  ASSERT (SELECT post || '/' || (schedule ->> 'day') FROM npc_personas WHERE slug = 'shopkeeper') = 'shopkeeper/shop', 'shopkeeper keeps the shop';
  ASSERT (SELECT bio FROM npc_personas WHERE slug = 'mayor') = '', 'bio defaults empty';
  BEGIN
    UPDATE npc_personas SET post = 'wizard' WHERE slug = 'mayor';
    RAISE EXCEPTION 'unknown post accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE npc_personas SET schedule = '[]'::jsonb WHERE slug = 'mayor';
    RAISE EXCEPTION 'array schedule accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'admin 1 residents ok';
END $$;

-- ─── 2. Versioning keys text rows (recipes) as well as uuid rows ─────────────
BEGIN;
INSERT INTO content_drafts (table_name, row_id, draft_data) VALUES
  ('crafting_recipes', 'rod-glass', '{"id": "rod-glass", "output_qty": 2}'),
  ('npc_personas', (SELECT id::text FROM npc_personas WHERE slug = 'mayor'), '{"slug": "mayor"}');
INSERT INTO content_versions (table_name, row_id, snapshot_data)
  SELECT 'crafting_recipes', id, to_jsonb(r) FROM crafting_recipes r WHERE id = 'rod-glass';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM content_drafts WHERE row_id IN ('rod-glass', (SELECT id::text FROM npc_personas WHERE slug = 'mayor'))) = 2, 'text and uuid row ids';
  ASSERT (SELECT snapshot_data ->> 'output_item' FROM content_versions WHERE table_name = 'crafting_recipes' AND row_id = 'rod-glass') = 'rod-glass', 'recipe snapshot';
  RAISE NOTICE 'admin 2 text-keyed versioning ok';
END $$;
ROLLBACK;

-- ─── 3. Only T1/T2 insert drafts (row 215); T3 and below are refused ─────────
BEGIN;
UPDATE profiles SET tier = 2 WHERE id = '00000000-0000-4000-8000-0000000001f4';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000001f1","role":"authenticated"}';
DO $$ BEGIN
  BEGIN
    INSERT INTO content_drafts (table_name, draft_data, author) VALUES ('npc_personas', '{}', '00000000-0000-4000-8000-0000000001f1');
    RAISE EXCEPTION 'a T3 saved a draft';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000001f4","role":"authenticated"}';
INSERT INTO content_drafts (table_name, draft_data, author) VALUES ('npc_personas', '{}', '00000000-0000-4000-8000-0000000001f4');
DO $$ BEGIN
  BEGIN
    INSERT INTO content_drafts (table_name, draft_data, author) VALUES ('npc_personas', '{}', '00000000-0000-4000-8000-0000000001f1');
    RAISE EXCEPTION 'a T2 saved a draft as someone else';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'admin 3 drafts T1/T2 only ok';
END $$;
ROLLBACK;
