-- The main quest, chapters 1 to 6 (20261027150000_main_quest, then the catalogue seed after it). Throwaway local
-- Postgres after every migration (supabase_stub.sql first). Never Supabase.
\set ON_ERROR_STOP 1
DO $$
BEGIN
  ASSERT (SELECT string_agg(slug || ':' || requirement, ',' ORDER BY position) FROM quest_chapters) =
    'settle-in:settle_in,odiles-net:bug_net,pims-shovel:dig,brams-challenge:rod_challenge,the-museum:museum_collab,elizas-pickaxe:pickaxe,reopen-cafe:club_goal,fund-museum:club_goal,ruins-gate:oracle_trial',
    'the personal chapters 1 to 6 come before the club''s';
  ASSERT (SELECT reward_item FROM quest_chapters WHERE slug = 'brams-challenge') = 'rod-cedar', 'Bram gives the Cedar rod';
  ASSERT (SELECT count(*) FROM quest_chapters WHERE reward_item IS NOT NULL) = 1, 'only Bram gives an item';
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'settle-in') = 'Make your first catch and bring it to Juno at the museum.', 'chapter 1 ends with Juno';
  ASSERT (SELECT step_copy ? 'report_hq' FROM quest_chapters WHERE slug = 'settle-in') = false, 'no report to Alice';
  ASSERT (SELECT reward_coins FROM quest_chapters WHERE slug = 'settle-in') = 100, '100 coins from the museum';
  ASSERT (SELECT completion_letter FROM quest_chapters WHERE slug = 'settle-in') LIKE 'Thank you for the museum%Juno, the museum', 'her letter';
  RAISE NOTICE 'main quest 1 chapters ok';
END $$;
-- The widened CHECKs take the new values and still refuse others.
BEGIN;
INSERT INTO npc_personas (slug, display_name, spawn_zone, post) VALUES ('smoke-guide', 'Smoke', 'courtyard', 'museum_guide');
INSERT INTO collection_species (key, category, name, biome, tool, rarity) VALUES ('smoke_rock', 'mineral', 'Smoke rock', 'rocks', 'pickaxe', 'common');
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
  ASSERT (SELECT count(*) FROM pg_constraint WHERE conrelid = 'npc_personas'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%museum_curator%') = 1, 'one post CHECK';
  RAISE NOTICE 'main quest 2 checks ok';
END $$;
-- Run again: nothing changes, nothing duplicates; an admin's own chapter 1 wording stays.
BEGIN;
UPDATE quest_chapters SET summary = 'Our words' WHERE slug = 'settle-in';
\ir ../migrations/20261027150000_main_quest.sql
DO $$ BEGIN
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'settle-in') = 'Our words', 'admin copy kept';
  RAISE NOTICE 'main quest 3 admin edits kept ok';
END $$;
ROLLBACK;
\ir ../migrations/20261027150000_main_quest.sql
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM quest_chapters) = 9, 'idempotent: nine chapters';
  ASSERT (SELECT count(*) FROM pg_constraint WHERE conrelid = 'shop_items'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%shovel%') = 1, 'idempotent: one slot CHECK';
  RAISE NOTICE 'main quest 4 idempotent ok';
END $$;
