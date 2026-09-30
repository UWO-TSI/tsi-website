-- Chapter 4's copy (20260929100200_chapter4_subclass_copy). Throwaway local Postgres
-- after every migration through it. Never Supabase. Fails before 20260929100200.
\set ON_ERROR_STOP 1
DO $$ BEGIN
  ASSERT (SELECT step_copy #>> '{family_trial,label}' FROM quest_chapters WHERE slug = 'ruins-gate') = 'Reach level 10 and choose your subclass', 'seeded step renamed';
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'ruins-gate') LIKE '%choose your subclass%', 'seeded summary renamed';
  RAISE NOTICE 'chapter 4 copy 1 seed renamed ok';
END $$;
-- A second run keeps an admin's own wording.
BEGIN;
UPDATE quest_chapters SET step_copy = jsonb_set(step_copy, '{family_trial,label}', '"Pick your path"'), summary = 'Our words' WHERE slug = 'ruins-gate';
\ir ../migrations/20260929100200_chapter4_subclass_copy.sql
DO $$ BEGIN
  ASSERT (SELECT step_copy #>> '{family_trial,label}' || '/' || summary FROM quest_chapters WHERE slug = 'ruins-gate') = 'Pick your path/Our words', 'admin copy kept';
  RAISE NOTICE 'chapter 4 copy 2 admin edits kept ok';
END $$;
ROLLBACK;
