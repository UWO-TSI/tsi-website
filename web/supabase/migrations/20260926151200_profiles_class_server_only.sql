-- ─── 039 profiles.class / subclass are server-only ──────────────────────────
--
-- DRAFT 2026-09-26. NOT APPLIED. Apply after 20260926150700_identity (and the
-- rest of the game drafts). Spec: specs/cleanup-and-game-security.md item 7.
--
-- 20260926120000_profiles_privilege_guard let members write class/subclass
-- with the public key because the old client-side quiz did. The Oracle now
-- assigns the family through oracle_complete (service role) and the old quiz
-- is gone, so the guard's allowlist drops both columns. The combat subclass
-- lives in member_progression, written by combat_choose_subclass.
-- Same function as 20260926120000 otherwise.
-- Test: game_security_smoke.sql section 4; profiles_guard_smoke.sql.

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
    'preferences', 'onboarding_step', 'onboarding_completed', 'last_seen_at',
    'updated_at'
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
