-- The island ID's pronouns (tutorial-v2 round 6, David's v5-id: "remove like where youre from and put stuff thats
-- important in game, like pronouns"). Optional, shown on your ID with your world name; never a real name.
alter table public.profiles add column if not exists pronouns text;
alter table public.profiles drop constraint if exists profiles_pronouns_len;
alter table public.profiles add constraint profiles_pronouns_len check (pronouns is null or char_length(pronouns) <= 24);
