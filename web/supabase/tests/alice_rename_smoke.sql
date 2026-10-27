-- The HQ lead is named Alice (20261027063439_catalogue_seed). Throwaway local Postgres after every migration
-- (supabase_stub.sql first). Never Supabase. Her slug stays 'wren' (an id); only her name and the copy naming her change.
\set ON_ERROR_STOP 1
-- Chapter 1 has the main quest's copy since 20261027150000_main_quest: this smoke checks its own migration against
-- chapter 1 as it was before (set here), and the main quest's migration puts it back at the end.
UPDATE quest_chapters SET summary = 'Make your first catch and donate it to the museum, then report back to Alice at HQ.',
  step_copy = '{"claim_plot":{"label":"Claim your plot at HQ"},"first_catch":{"label":"Make your first catch","hint":"Any fish counts. Try the pier."},"donate_catch":{"label":"Donate your catch to the museum shell"},"report_hq":{"label":"Report back to Alice at HQ"}}'::jsonb
 WHERE slug = 'settle-in';
DO $$
BEGIN
  ASSERT (SELECT display_name || '|' || post FROM npc_personas WHERE slug = 'wren') = 'Alice|hq_lead', 'the HQ lead is Alice';
  ASSERT (SELECT count(*) FROM npc_personas WHERE display_name = 'Wren' OR bio LIKE '%Wren%' OR array_to_string(canned_dialogue, ' ') LIKE '%Wren%' OR talk::text LIKE '%Wren%') = 0, 'no row names Wren';
  ASSERT (SELECT step_copy #>> '{report_hq,label}' FROM quest_chapters WHERE slug = 'settle-in') = 'Report back to Alice at HQ', 'the report step names Alice';
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'settle-in') = 'Make your first catch and donate it to the museum, then report back to Alice at HQ.', 'the summary names Alice';
  RAISE NOTICE 'alice rename 1 renamed ok';
END $$;
-- Run again: nothing changes; and an admin's own wording is never overwritten.
BEGIN;
UPDATE npc_personas SET display_name = 'Our lead' WHERE slug = 'wren';
UPDATE quest_chapters SET step_copy = jsonb_set(step_copy, '{report_hq,label}', '"Tell HQ how it went"'), summary = 'Our words' WHERE slug = 'settle-in';
\ir ../migrations/20261027063439_catalogue_seed.sql
DO $$ BEGIN
  ASSERT (SELECT display_name FROM npc_personas WHERE slug = 'wren') = 'Our lead', 'an admin name kept';
  ASSERT (SELECT step_copy #>> '{report_hq,label}' || '/' || summary FROM quest_chapters WHERE slug = 'settle-in') = 'Tell HQ how it went/Our words', 'admin copy kept';
  RAISE NOTICE 'alice rename 2 admin edits kept ok';
END $$;
ROLLBACK;
\ir ../migrations/20261027063439_catalogue_seed.sql
DO $$ BEGIN
  ASSERT (SELECT display_name FROM npc_personas WHERE slug = 'wren') = 'Alice', 'idempotent';
  RAISE NOTICE 'alice rename 3 idempotent ok';
END $$;
\ir ../migrations/20261027150000_main_quest.sql
DO $$ BEGIN
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'settle-in') = 'Make your first catch and bring it to Juno at the museum.', 'the main quest copy is back';
END $$;
