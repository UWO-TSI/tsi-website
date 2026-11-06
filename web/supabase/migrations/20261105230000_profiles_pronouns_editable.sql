-- profiles.pronouns (20261101230000) was never added to the profile guard's allowlist, so saving pronouns on the
-- ID card through PATCH /api/profile raised "profiles: pronouns can only be changed by the server" (500).
-- Same function as 20260926180000_ownership.sql with 'pronouns' added to editable. Nothing else changes.
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
    'avatar_url', 'skills', 'social_links', 'active_theme',
    'preferences', 'onboarding_step', 'onboarding_completed', 'last_seen_at',
    'updated_at', 'pronouns'
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
