-- ─── v1 drop: chapter 1 without the plot (specs/v1-drop.md §2) ───────────────
--
-- Claiming your plot is the home island's drop (v4, web/lib/game/drops.ts
-- STEP_FEATURE): until then the settle-in chapter's claim_plot step is hidden
-- (releasedChapters) and its summary leaves the plot out. Only a summary still as
-- 20260926150200_progression seeded it is changed, so an admin's own edit stays.
-- The steps' copy and everyone's progress are untouched. Mirrors DEFAULT_CHAPTERS
-- in web/lib/progression/defaults.ts. Idempotent. Apply after
-- 20261007120000_autumn_grass. Test: web/supabase/tests/v1_drop_copy_smoke.sql.

UPDATE quest_chapters
   SET summary = 'Make your first catch and donate it to the museum, then report to HQ.'
 WHERE slug = 'settle-in'
   AND summary = 'Claim your plot, make your first catch and donate it, then report to HQ.';
