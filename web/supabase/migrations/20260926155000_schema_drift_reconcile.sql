-- ─── Production schema drift reconciliation ─────────────────────────────────
--
-- DRAFT 2026-09-26. NOT APPLIED. Apply after 20260926151200 (the last game
-- draft); idempotent, so re-running it or running it on a fresh replay is a no-op.
-- Evidence: specs/evidence/phase1/schema-drift.md (read-only production dump
-- diffed against a staging replay of every migration file).
--
-- Production was built partly by hand, so it is not what the files replay to:
--   * 004 never ran there: its trigram index needs pg_trgm, which production
--     does not have, so the whole file rolled back. No avatar_config / skills /
--     social_links, and tier still stops at 4 although the admin tier editor
--     offers 5.
--   * handle_new_user() was hardened by hand in production (Google name
--     fallbacks, a sign-up never fails on the profile insert). No file has
--     that body, and 20260926150700_identity replaced it with a version that
--     drops both. Merged below: production's fallbacks and guard plus
--     identity's member/public decision.
--   * 005, 007 and 008 never ran in production. On a fresh replay they leave
--     write policies that let any signed-in user create achievements, award
--     them to themselves, grant themselves inventory, and delete (then
--     re-insert) their own event attendance. Dropped here.
--   * The portfolios bucket (lib/google-sheets.ts signs links from it) exists
--     only in production.

-- 1 ── 004's profile columns and tier range ──────────────────────────────────
alter table public.profiles add column if not exists avatar_config jsonb not null default '{}';
alter table public.profiles add column if not exists skills text[] not null default '{}';
alter table public.profiles add column if not exists social_links jsonb not null default '{}';
-- 20260926120000 granted column SELECT only on the columns that existed then.
grant select (avatar_config, skills, social_links) on public.profiles to authenticated;

alter table public.profiles drop constraint if exists profiles_tier_check;
alter table public.profiles add constraint profiles_tier_check check (tier between 1 and 5);

-- 2 ── Profile creation: production's hardening + identity's membership ──────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite text := upper(trim(new.raw_user_meta_data->>'invite_code'));
  v_member boolean;
begin
  begin
    v_member := exists (select 1 from public.member_email_whitelist w where w.email = lower(new.email))
      or (v_invite is not null and v_invite <> '' and exists (select 1 from public.invite_codes c where c.code = v_invite and c.is_active));
    insert into public.profiles (id, email, display_name, membership)
    values (
      new.id,
      coalesce(new.email, new.raw_user_meta_data->>'email', ''),
      coalesce(
        new.raw_user_meta_data->>'display_name',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(coalesce(new.email, ''), '@', 1),
        'Agent'
      ),
      case when v_member then 'member' else 'public' end
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'profiles insert failed for user %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- 3 ── Write policies production never had ───────────────────────────────────
drop policy if exists "Achievements insertable by authenticated" on public.achievements;
drop policy if exists "Achievements updatable by authenticated" on public.achievements;
drop policy if exists "User achievements insertable by authenticated" on public.user_achievements;
drop policy if exists "Users can insert own inventory" on public.player_inventory;
drop policy if exists "Users can update own inventory" on public.player_inventory;
drop policy if exists "Users can delete own attendance" on public.event_attendance;

-- 4 ── Production-only bucket ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolios', 'portfolios', false, 52428800, array[
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime',
  'video/webm', 'application/pdf', 'application/zip', 'application/x-zip-compressed'])
on conflict (id) do nothing;
