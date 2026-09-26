-- ─── profiles: stop self-promotion and cross-member private reads ───────────
--
-- Before this migration any signed-in user (every Google sign-in, including
-- recruitment applicants) could, with the public anon key:
--   * UPDATE their own row's tier / tethos_coins / xp / level / rank / ...,
--     because the UPDATE policy only checks auth.uid() = id and the
--     authenticated role holds table-wide UPDATE. tier <= 2 unlocks the admin
--     dashboard, /api/economy awards, content publishing and every RLS policy
--     that checks (select tier from profiles where id = auth.uid()) in (1, 2).
--   * SELECT every column of every profile, including email.
--
-- 1. BEFORE UPDATE trigger: user requests may change only the columns in
--    `editable` below (what the profile editor, onboarding, Oracle quiz and
--    presence heartbeat write). Anything else is server-only. The check keys
--    off current_user: PostgREST runs user requests as anon/authenticated, while
--    service_role, the SQL editor (postgres / supabase_admin) and SECURITY
--    DEFINER functions (handle_new_user) run as other roles and pass. JWT
--    claims are not consulted; the role PostgREST switched to is what counts.
-- 2. UPDATE policy gains an explicit WITH CHECK; the INSERT policy is dropped
--    (profiles are created by the handle_new_user SECURITY DEFINER trigger on
--    auth.users; a user without a row could otherwise insert tier = 1).
-- 3. Reads: authenticated keeps SELECT only on the member-visible columns
--    below. email, phone, birthday, hometown, the *_email columns, social
--    handles, login tracking etc. are readable only by service_role. The one
--    screen that needs a user's own private columns (/api/profile) and the T1/T2
--    member list (/api/admin/members) read them server-side with service_role.
--
-- Column lists skip columns that don't exist, so this applies to prod (which
-- has no avatar_config / skills / social_links) and to a full local replay.
--
-- Apply AFTER the matching app code is deployed: the old code reads profiles.*
-- with the user's key (/api/profile), which fails once section 3 is in place.
-- The new code works with or without this migration.
--
-- Rollback (SQL editor; restores the pre-migration behaviour):
--   drop trigger if exists profiles_guard_privileged on public.profiles;
--   drop function if exists public.profiles_guard_privileged();
--   drop policy "Users can update own profile" on public.profiles;
--   create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
--   create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
--   grant select on public.profiles to anon, authenticated;

-- 1 ─────────────────────────────────────────────────────────────────────────
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  editable constant text[] := array[
    'display_name', 'bio', 'year', 'program', 'hometown', 'birthday', 'phone',
    'preferred_email', 'github_username', 'instagram', 'linkedin', 'discord_tag',
    'favourite_music', 'dream_retirement', 'spirit_animal', 'fun_fact',
    'avatar_url', 'avatar_config', 'skills', 'social_links', 'active_theme',
    'preferences', 'class', 'subclass', 'onboarding_step',
    'onboarding_completed', 'last_seen_at', 'updated_at'
  ];
  changed text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  select string_agg(n.key, ', ' order by n.key) into changed
  from jsonb_each(to_jsonb(new)) n
  where n.key <> all (editable)
    and n.value is distinct from (to_jsonb(old) -> n.key);

  if changed is not null then
    raise exception 'profiles: % can only be changed by the server', changed
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged();

-- 2 ─────────────────────────────────────────────────────────────────────────
alter policy "Users can update own profile" on public.profiles
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;

-- 3 ─────────────────────────────────────────────────────────────────────────
revoke select on public.profiles from anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = any (array[
      'id', 'display_name', 'avatar_url', 'tier', 'position', 'class',
      'subclass', 'team_id', 'level', 'xp', 'rank', 'tethos_coins',
      'is_active', 'is_alumni', 'onboarding_completed', 'onboarding_step',
      'created_at', 'year', 'bio', 'avatar_config', 'skills', 'social_links'
    ]);
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end;
$$;
