-- v1 drop copy (20261013200000_v1_drop_copy). Throwaway local Postgres after every migration (supabase_stub.sql
-- first), after autumn_grass_smoke.sql. Never Supabase. Fails before the migration: the settle-in summary still says
-- "Claim your plot". A later copy pass (20261017010000_hq_onboarding_copy, row 312: "report back to Wren at HQ") keeps
-- the plot out; this smoke passes over it and leaves the summary as it found it.
\set ON_ERROR_STOP 1
DO $$
DECLARE was text := (SELECT summary FROM quest_chapters WHERE slug = 'settle-in');
BEGIN
  -- (The main quest, 20261027150000, rewords it again, still without the plot.)
  ASSERT was LIKE 'Make your first catch and donate it to the museum, then report%HQ.' OR was = 'Make your first catch and bring it to Juno at the museum.', 'the settle-in summary leaves the plot out';
  -- The steps keep their copy (the claim step is hidden in code until the home island's drop, not deleted).
  ASSERT (SELECT step_copy->'claim_plot'->>'label' FROM quest_chapters WHERE slug = 'settle-in') = 'Claim your plot at HQ', 'claim step copy kept';
  -- Idempotent, and an admin's own summary is never overwritten.
  UPDATE quest_chapters SET summary = 'An admin wrote this.' WHERE slug = 'settle-in';
  UPDATE quest_chapters SET summary = 'Make your first catch and donate it to the museum, then report to HQ.'
   WHERE slug = 'settle-in' AND summary = 'Claim your plot, make your first catch and donate it, then report to HQ.';
  ASSERT (SELECT summary FROM quest_chapters WHERE slug = 'settle-in') = 'An admin wrote this.', 'an edited summary stays';
  UPDATE quest_chapters SET summary = was WHERE slug = 'settle-in';
  RAISE NOTICE 'v1 drop copy ok';
END $$;
