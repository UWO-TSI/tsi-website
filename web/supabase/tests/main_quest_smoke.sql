-- The main quest, chapters 1 to 6 (20261027150000_main_quest, then the catalogue seed after it). Throwaway local
-- Postgres after every migration (supabase_stub.sql first). Never Supabase.
\set ON_ERROR_STOP 1
DO $$
BEGIN
  ASSERT (SELECT string_agg(slug || ':' || requirement || ':' || coalesce(world, 'both'), ',' ORDER BY position) FROM quest_chapters) =
    'settle-in:settle_in:village,reopen-cafe:club_goal:both,fund-museum:club_goal:both,ruins-gate:oracle_trial:both,first-find:first_find:new,odiles-net:bug_net:new,pims-shovel:dig:new,brams-challenge:rod_challenge:new,the-museum:museum_collab:new,elizas-pickaxe:pickaxe:new',
    'the village keeps settle-in, the new world gets the main quest, the club''s chapters are both worlds''';
  -- The village's rows keep their positions (its journal numbers chapters by position: 1, then 3 for the museum fund).
  ASSERT (SELECT string_agg(slug || '@' || position, ',' ORDER BY position) FROM quest_chapters WHERE world IS DISTINCT FROM 'new') =
    'settle-in@1,reopen-cafe@2,fund-museum@3,ruins-gate@4', 'village positions unchanged';
  -- The village's chapter 1, exactly as it was.
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'settle-in') = 'Make your first catch and donate it to the museum, then report back to Alice at HQ.', 'village summary unchanged';
  ASSERT (SELECT step_copy #>> '{report_hq,label}' FROM quest_chapters WHERE slug = 'settle-in') = 'Report back to Alice at HQ', 'village report step unchanged';
  ASSERT (SELECT completion_letter FROM quest_chapters WHERE slug = 'settle-in') = 'Welcome to the island. The village is yours to explore.', 'village letter unchanged';
  ASSERT (SELECT reward_item FROM quest_chapters WHERE slug = 'brams-challenge') = 'rod-cedar', 'Bram gives the Cedar rod';
  ASSERT (SELECT count(*) FROM quest_chapters WHERE reward_item IS NOT NULL) = 1, 'only Bram gives an item';
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'first-find') = 'Make your first catch and bring it to Juno at the museum.', 'the new world''s chapter 1 ends with Juno';
  ASSERT (SELECT completion_letter FROM quest_chapters WHERE slug = 'first-find') LIKE 'Thank you for the museum%Juno, the museum', 'her letter';
  RAISE NOTICE 'main quest 1 chapters ok';
END $$;
-- A chapter added with no world plays in both (the column's default).
BEGIN;
INSERT INTO quest_chapters (slug, position, title, requirement) VALUES ('smoke-both', 42, 'Smoke', 'oracle_trial');
DO $$ BEGIN ASSERT (SELECT world FROM quest_chapters WHERE slug = 'smoke-both') IS NULL, 'default both'; END $$;
ROLLBACK;
-- The widened CHECKs take the new values and still refuse others.
BEGIN;
INSERT INTO npc_personas (slug, display_name, spawn_zone, post) VALUES ('smoke-guide', 'Smoke', 'courtyard', 'museum_guide');
INSERT INTO shop_items (slug, display_name, category, price_coins, slot) VALUES ('smoke-pickaxe', 'Smoke pickaxe', 'tool', 1, 'pickaxe');
INSERT INTO quest_chapters (slug, position, title, requirement, reward_item) VALUES ('smoke-dig', 40, 'Smoke', 'dig', 'smoke-pickaxe');
ROLLBACK;
DO $$
BEGIN
  BEGIN INSERT INTO npc_personas (slug, display_name, spawn_zone, post) VALUES ('smoke-bad', 'Smoke', 'courtyard', 'pirate'); RAISE EXCEPTION 'FAIL a bad post went in';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO quest_chapters (slug, position, title, requirement) VALUES ('smoke-bad', 41, 'Smoke', 'treasure'); RAISE EXCEPTION 'FAIL a bad requirement went in';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO quest_chapters (slug, position, title, requirement, reward_item) VALUES ('smoke-bad', 41, 'Smoke', 'dig', 'Not A Slug'); RAISE EXCEPTION 'FAIL a bad reward_item went in';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO quest_chapters (slug, position, title, requirement, world) VALUES ('smoke-bad', 41, 'Smoke', 'dig', 'moon'); RAISE EXCEPTION 'FAIL a bad world went in';
  EXCEPTION WHEN check_violation THEN NULL; END;
  ASSERT (SELECT count(*) FROM pg_constraint WHERE conrelid = 'npc_personas'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%museum_curator%') = 1, 'one post CHECK';
  RAISE NOTICE 'main quest 2 checks ok';
END $$;
-- Run again: nothing changes, nothing duplicates; an admin's own chapter 1 wording stays.
BEGIN;
UPDATE quest_chapters SET summary = 'Our words', world = NULL WHERE slug = 'settle-in';
\ir ../migrations/20261027150000_main_quest.sql
DO $$ BEGIN
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'settle-in') = 'Our words', 'admin copy kept';
  RAISE NOTICE 'main quest 3 admin edits kept ok';
END $$;
ROLLBACK;
\ir ../migrations/20261027150000_main_quest.sql
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM quest_chapters) = 10, 'idempotent: ten chapters';
  ASSERT (SELECT count(*) FROM pg_constraint WHERE conrelid = 'shop_items'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%shovel%') = 1, 'idempotent: one slot CHECK';
  RAISE NOTICE 'main quest 4 idempotent ok';
END $$;
-- The catalogue seed after it (20261028144209_catalogue_seed): Juno, the pickaxe, rocks that need it, the buried finds.
DO $$ BEGIN
  ASSERT (SELECT display_name || '|' || post || '|' || (schedule->>'home') FROM npc_personas WHERE slug = 'docent') = 'Juno|museum_guide|museum', 'Juno, the museum''s guide';
  ASSERT (SELECT slot || '|' || active::text FROM shop_items WHERE slug = 'pickaxe-basic') = 'pickaxe|false', 'the pickaxe: a tool, off sale (Eliza gives it)';
  -- The village's rocks and clams play as before: the pickaxe and the dig spots are the new world's, in code.
  ASSERT (SELECT string_agg(key || ':' || tool || ':' || biome, ',' ORDER BY key) FROM collection_species WHERE key IN ('rock_stone', 'rock_iron_nugget', 'rock_clay', 'shell_asari')) =
    'rock_clay:shovel:rocks,rock_iron_nugget:shovel:rocks,rock_stone:shovel:rocks,shell_asari:shovel:beach', 'rocks and clams unchanged';
  ASSERT (SELECT count(*) FROM collection_species WHERE key LIKE 'find\_%' AND tool = 'shovel' AND wing = 'nature_room' AND donatable) = 7, 'seven buried finds for the new world''s museum';
  RAISE NOTICE 'main quest 5 catalogue ok';
END $$;
