-- Resident lines for the new world (20261029062659_catalogue_seed, residents block): Odile's dragonflies and Marlo's
-- sketching moved from the pond to the river, by guarded UPDATEs that change a resident only while its lines are still
-- as the last seed left them. Throwaway local Postgres after every migration (supabase_stub.sql first). Never Supabase.
-- Self-contained, rolled back: it puts both rows back as 20261027063439 seeded them, edits Marlo as an admin would,
-- and applies the migration again (it is idempotent).
\set ON_ERROR_STOP 1
BEGIN;
DO $$
BEGIN
  ASSERT (SELECT canned_dialogue[2] FROM npc_personas WHERE slug = 'curator') = 'Did you see the dragonflies along the river? Odonata. Lovely.', 'the chain: Odile''s new line';
  ASSERT (SELECT talk::text FROM npc_personas WHERE slug = 'curator') LIKE '%dragonflies along the river%', 'the chain: Odile''s new talk';
  ASSERT (SELECT canned_dialogue[2] FROM npc_personas WHERE slug = 'marlo') = 'The river looks different every hour.', 'the chain: Marlo''s new line';
  ASSERT NOT EXISTS (SELECT 1 FROM npc_personas WHERE slug IN ('curator', 'marlo') AND (talk::text LIKE '%pond%' OR array_to_string(canned_dialogue, '|') LIKE '%pond%')), 'no pond left';
END $$;
-- Back as seeded (unedited), and Marlo with an admin's edit to his lines.
UPDATE npc_personas SET canned_dialogue = array_replace(canned_dialogue, 'Did you see the dragonflies along the river? Odonata. Lovely.', 'Did you see the dragonflies by the pond? Odonata. Lovely.'),
  talk = replace(talk::text, 'Did you see the dragonflies along the river? Odonata. Lovely things.', 'Did you see the dragonflies by the pond? Odonata. Lovely things.')::jsonb WHERE slug = 'curator';
UPDATE npc_personas SET canned_dialogue = ARRAY['An admin wrote this.'], talk = replace(talk::text, 'The river looks different every hour.', 'The pond looks different every hour.')::jsonb WHERE slug = 'marlo';
\ir ../migrations/20261029062659_catalogue_seed.sql
DO $$
BEGIN
  ASSERT (SELECT canned_dialogue[2] FROM npc_personas WHERE slug = 'curator') = 'Did you see the dragonflies along the river? Odonata. Lovely.', 'an unedited row gets the new line';
  ASSERT (SELECT talk::text FROM npc_personas WHERE slug = 'curator') LIKE '%dragonflies along the river%', 'and the new talk';
  ASSERT (SELECT canned_dialogue FROM npc_personas WHERE slug = 'marlo') = ARRAY['An admin wrote this.'], 'an edited row keeps the admin''s lines';
  ASSERT (SELECT talk::text FROM npc_personas WHERE slug = 'marlo') LIKE '%The pond looks different every hour.%', 'and the whole row is left alone';
  RAISE NOTICE 'resident_lines smoke ok';
END $$;
ROLLBACK;
