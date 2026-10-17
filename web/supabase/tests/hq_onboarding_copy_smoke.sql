-- HQ onboarding copy (20261017010000_hq_onboarding_copy, row 312). Throwaway local Postgres after every migration
-- (supabase_stub.sql first). Never Supabase. Fails before the migration: the report step still says "Report back to HQ".
\set ON_ERROR_STOP 1
DO $$
BEGIN
  ASSERT (SELECT step_copy #>> '{report_hq,label}' FROM quest_chapters WHERE slug = 'settle-in') = 'Report back to Wren at HQ', 'the report step names Wren';
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'settle-in') = 'Make your first catch and donate it to the museum, then report back to Wren at HQ.', 'the summary names Wren';
  -- The other steps keep their copy; the hint stays.
  ASSERT (SELECT step_copy #>> '{first_catch,label}' FROM quest_chapters WHERE slug = 'settle-in') = 'Make your first catch', 'first catch copy kept';
  ASSERT (SELECT step_copy #>> '{first_catch,hint}' FROM quest_chapters WHERE slug = 'settle-in') = 'Any fish counts. Try the pier.', 'first catch hint kept';
  ASSERT (SELECT step_copy #>> '{donate_catch,label}' FROM quest_chapters WHERE slug = 'settle-in') = 'Donate your catch to the museum shell', 'donate copy kept';
  ASSERT (SELECT step_copy #>> '{claim_plot,label}' FROM quest_chapters WHERE slug = 'settle-in') = 'Claim your plot at HQ', 'claim copy kept';
  -- No other chapter touched.
  ASSERT (SELECT count(*) FROM quest_chapters WHERE summary LIKE '%Wren%') = 1, 'only settle-in';
  RAISE NOTICE 'hq onboarding copy 1 seeded copy renamed ok';
END $$;
-- Run again: nothing changes; and an admin's own wording is never overwritten.
BEGIN;
UPDATE quest_chapters SET step_copy = jsonb_set(step_copy, '{report_hq,label}', '"Tell HQ how it went"'), summary = 'Our words' WHERE slug = 'settle-in';
\ir ../migrations/20261017010000_hq_onboarding_copy.sql
DO $$ BEGIN
  ASSERT (SELECT step_copy #>> '{report_hq,label}' || '/' || summary FROM quest_chapters WHERE slug = 'settle-in') = 'Tell HQ how it went/Our words', 'admin copy kept';
  RAISE NOTICE 'hq onboarding copy 2 admin edits kept ok';
END $$;
ROLLBACK;
\ir ../migrations/20261017010000_hq_onboarding_copy.sql
DO $$ BEGIN
  ASSERT (SELECT step_copy #>> '{report_hq,label}' FROM quest_chapters WHERE slug = 'settle-in') = 'Report back to Wren at HQ', 'idempotent';
  RAISE NOTICE 'hq onboarding copy 3 idempotent ok';
END $$;
