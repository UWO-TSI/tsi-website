-- ─── letters: a broadcast key the upserts can conflict on ───────────────────
--
-- DRAFT 2026-09-26. NOT APPLIED. Apply after 20260926150200_progression.
-- Found in Phase 1 on staging (specs/evidence/phase1/): the system-letter and
-- broadcast upserts send ON CONFLICT (broadcast_key, recipient_id), which
-- Postgres can't match to the partial index from 150200 (42P10). Every system
-- letter failed, so reporting to HQ saved the chapter as completed, answered
-- 500 and never paid the chapter's coins.
-- A plain unique index keeps the same rule: notes have a NULL broadcast_key,
-- and NULLs never collide.
-- Test: web/supabase/tests/phase1_regressions.sql section 1.

drop index if exists public.idx_letters_broadcast_once;
create unique index idx_letters_broadcast_once on public.letters (broadcast_key, recipient_id);
