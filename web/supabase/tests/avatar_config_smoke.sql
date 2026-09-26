-- Smoke test for 20260926170000_profiles_avatar_config.sql (production has no
-- profiles.avatar_config: schema drift). Throwaway local Postgres 16 only, after
-- the full chain (specs/evidence/study-character/sql-smoke.md). Simulates
-- production by dropping the column, applies the migration twice (idempotent),
-- then checks the grant, a member's own write and a cross-member read.
\set ON_ERROR_STOP 1
SET client_min_messages = notice;

ALTER TABLE public.profiles DROP COLUMN avatar_config;
\ir ../migrations/20260926170000_profiles_avatar_config.sql
\ir ../migrations/20260926170000_profiles_avatar_config.sql

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'look-a@example.test'),
  ('00000000-0000-4000-8000-0000000000b1', 'look-b@example.test');

DO $$ BEGIN
  ASSERT (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_config') = 'jsonb', 'FAIL: avatar_config missing';
  ASSERT (SELECT avatar_config FROM profiles WHERE id = '00000000-0000-4000-8000-0000000000a1') = '{}'::jsonb, 'FAIL: new profile not defaulted to {}';
  ASSERT has_column_privilege('authenticated', 'public.profiles', 'avatar_config', 'SELECT'), 'FAIL: authenticated cannot read avatar_config';
  ASSERT NOT has_column_privilege('anon', 'public.profiles', 'avatar_config', 'SELECT'), 'FAIL: anon can read avatar_config';
  RAISE NOTICE 'ok: column re-added as jsonb, default {}, SELECT for authenticated only';
END $$;

-- Member A saves a look through the #40 guard (avatar_config is member-editable).
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
DO $$ DECLARE n int; BEGIN
  UPDATE profiles SET avatar_config = '{"look":{"skin":2,"bangs":"bangs_straight"}}' WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 1, 'FAIL: member could not save own avatar_config';
  RAISE NOTICE 'ok: member saves own look';
END $$;
COMMIT;

-- Member B (a seat-mate) reads A's look.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT avatar_config -> 'look' ->> 'skin' FROM profiles WHERE id = '00000000-0000-4000-8000-0000000000a1') = '2', 'FAIL: another member cannot read the look';
  RAISE NOTICE 'ok: another member reads the look';
END $$;
COMMIT;

\echo 'avatar_config smoke ok'
