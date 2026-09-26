-- ─── member_badges: signed-in readers only ─────────────────────────────────
--
-- DRAFT 2026-09-26. NOT APPLIED. Apply after 20260926150700_identity.
-- Found in Phase 1 on staging: identity grants the view to authenticated and
-- service_role, but Supabase's default privileges had already granted it to
-- anon, so the public key listed every account id with its membership badge
-- and family (the view reads profiles as its owner, past the column grants).
-- Test: web/supabase/tests/phase1_regressions.sql section 4.

revoke all on public.member_badges from anon;
