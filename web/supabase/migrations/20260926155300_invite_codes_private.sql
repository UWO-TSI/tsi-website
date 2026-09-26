-- ─── invite_codes: check a code without listing them ───────────────────────
--
-- DRAFT 2026-09-26. NOT APPLIED. Apply after 20260926150700_identity.
-- Found in Phase 1 on staging: an active invite code makes a new sign-up a
-- TSI member (identity's handle_new_user), but every code was readable with
-- the public key: 001 lets any signed-in user list them and production has a
-- hand-made policy that lets anon list the active ones. Anyone could read the
-- code and sign up as a member. /student/signup now asks invite_code_valid()
-- instead of reading the table.
-- Test: web/supabase/tests/phase1_regressions.sql section 3.

drop policy if exists "Invite codes readable by anon for validation" on public.invite_codes;
drop policy if exists "Invite codes readable by authenticated" on public.invite_codes;

create or replace function public.invite_code_valid(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from invite_codes where code = upper(trim(p_code)) and is_active);
$$;
revoke all on function public.invite_code_valid(text) from public;
grant execute on function public.invite_code_valid(text) to anon, authenticated;
