-- ─── profiles.avatar_config: close the production schema drift ───────────────
--
-- 004 defines avatar_config, but production never got it (read-only check
-- 2026-09-26: prod has `preferences`, not `avatar_config`). The character look
-- (PATCH /api/profile → avatar_config.look) and the study seat-mates' looks
-- read it. The #40 guard already lists it as member-editable; its SELECT grant
-- skipped the missing column, so grant it here once the column exists.
--
-- Same definition as 004 so production and a full replay end up identical.
-- Idempotent: on production it adds the column, on a replay both statements
-- are no-ops. Smoke: web/supabase/tests/avatar_config_smoke.sql.
--
-- Rollback (SQL editor), only while nothing has been saved into it:
--   alter table public.profiles drop column if exists avatar_config;

alter table public.profiles add column if not exists avatar_config jsonb not null default '{}';

grant select (avatar_config) on public.profiles to authenticated;
