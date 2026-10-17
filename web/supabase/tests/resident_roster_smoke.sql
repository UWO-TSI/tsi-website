-- Resident roster (20261017020000_resident_roster, row 217). Throwaway local Postgres after every migration through
-- it (supabase_stub.sql first). Never Supabase. Fails before it: production had two residents.
\set ON_ERROR_STOP 1
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM npc_personas WHERE active AND is_permanent) = 10, 'the roster walks: ten residents, got ' || (SELECT count(*) FROM npc_personas);
  ASSERT (SELECT display_name || '|' || post FROM npc_personas WHERE slug = 'curator') = 'Odile|museum_curator', 'Odile (the net, row 312)';
  ASSERT (SELECT display_name || '|' || post FROM npc_personas WHERE slug = 'crafter') = 'Pim|workshop_crafter', 'Pim (the shovel, row 312)';
  ASSERT (SELECT schedule->>'home' FROM npc_personas WHERE slug = 'crafter') = 'hq', 'a routine and a home';
  ASSERT (SELECT jsonb_array_length(talk) FROM npc_personas WHERE slug = 'curator') = 3, 'their conversations';
  ASSERT (SELECT bool_and(public.npc_talk_ok(talk)) FROM npc_personas), 'every talk the editor''s shape';
  -- The two production had keep their names, spawn and lines, and gain the roster's post, bio, tone and routine.
  ASSERT (SELECT display_name || '|' || spawn_zone || '|' || post || '|' || tone FROM npc_personas WHERE slug = 'shopkeeper') = 'Toren|shop|shopkeeper|dry', 'Toren';
  ASSERT (SELECT canned_dialogue[1] FROM npc_personas WHERE slug = 'mayor') LIKE 'Welcome back to the courtyard%', 'the mayor''s lines kept';
  ASSERT (SELECT post || '|' || tone FROM npc_personas WHERE slug = 'mayor') = 'villager|warm', 'the mayor''s post and tone';
  ASSERT (SELECT bio FROM npc_personas WHERE slug = 'mayor') LIKE 'The island''s first resident%', 'the mayor''s bio';
  ASSERT (SELECT schedule->>'home' FROM npc_personas WHERE slug = 'mayor') = 'hq', 'the mayor''s routine';
  ASSERT (SELECT talk->0->>0 FROM npc_personas WHERE slug = 'mayor') = '[happy] Ah, {name}. Stay a while, if you like.', 'the mayor''s talk kept';
  RAISE NOTICE 'resident roster 1 seeded ok';
END $$;
-- A resident an admin made or edited stays as they left it; a missing one comes back.
BEGIN;
DELETE FROM npc_personas WHERE slug IN ('curator', 'crafter');
INSERT INTO npc_personas (slug, display_name, spawn_zone, is_permanent, bio) VALUES ('curator', 'Our curator', 'courtyard', TRUE, 'Written in the editor');
UPDATE npc_personas SET post = NULL, bio = 'Edited in the editor', tone = NULL, schedule = '{"day": "path"}' WHERE slug = 'mayor';
\ir ../migrations/20261017020000_resident_roster.sql
DO $$ BEGIN
  ASSERT (SELECT display_name || '|' || bio FROM npc_personas WHERE slug = 'curator') = 'Our curator|Written in the editor', 'an admin''s resident kept';
  ASSERT (SELECT bio || '|' || coalesce(post, '-') FROM npc_personas WHERE slug = 'mayor') = 'Edited in the editor|-', 'an admin''s edit kept';
  ASSERT (SELECT display_name FROM npc_personas WHERE slug = 'crafter') = 'Pim', 'a missing resident comes back';
  RAISE NOTICE 'resident roster 2 admin edits kept ok';
END $$;
ROLLBACK;
-- Again: nothing changes.
\ir ../migrations/20261017020000_resident_roster.sql
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM npc_personas) = 10, 'idempotent';
  ASSERT (SELECT count(DISTINCT slug) FROM npc_personas) = 10, 'no duplicates';
  RAISE NOTICE 'resident roster 3 idempotent ok';
END $$;
