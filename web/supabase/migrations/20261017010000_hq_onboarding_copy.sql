-- ─── Row 312: chapter 1 after the HQ visit (specs/hq-onboarding.md) ─────────────────
--
-- After Bram's tour you register with Wren at HQ, and she sends you to donate your
-- first find and come back to tell her. The settle-in chapter's last step and its
-- summary name her. Copy only: only copy still as seeded changes, so an admin's own
-- wording stays; the steps, their order and everyone's progress are untouched. Mirrors
-- DEFAULT_CHAPTERS in web/lib/progression/defaults.ts and the step's fallback in
-- web/lib/progression/chapters.ts. Idempotent. Apply after 20261015072009_catalogue_seed.
-- Test: web/supabase/tests/hq_onboarding_copy_smoke.sql.

UPDATE quest_chapters
   SET step_copy = jsonb_set(step_copy, '{report_hq,label}', '"Report back to Wren at HQ"')
 WHERE slug = 'settle-in'
   AND step_copy #>> '{report_hq,label}' = 'Report back to HQ';

UPDATE quest_chapters
   SET summary = 'Make your first catch and donate it to the museum, then report back to Wren at HQ.'
 WHERE slug = 'settle-in'
   AND summary = 'Make your first catch and donate it to the museum, then report to HQ.';
