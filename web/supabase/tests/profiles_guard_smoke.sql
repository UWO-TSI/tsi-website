-- Smoke test for 20260926120000_profiles_privilege_guard.sql.
-- Throwaway local Postgres 16 only (never a Supabase project):
--   psql -f web/supabase/tests/supabase_stub.sql
--   psql -f each web/supabase/migrations/*.sql in name order (the legacy chain
--        has known statement errors in 020's achievements section; unrelated)
--   psql -f web/supabase/tests/profiles_guard_smoke.sql
-- Every check raises (and ON_ERROR_STOP aborts) on failure.
\set ON_ERROR_STOP 1
SET client_min_messages = notice;

-- Seed as postgres: A and B are ordinary members (T4), C is T1.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-00000000000a', 'a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.test'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.test');
-- handle_new_user created the profiles; the SQL editor (postgres) can still promote.
UPDATE profiles SET tier = 1 WHERE id = '00000000-0000-4000-8000-00000000000c';
INSERT INTO npc_personas (slug, display_name, spawn_zone, active) VALUES ('hidden', 'Hidden', 'shop', false);
DO $$ BEGIN
  ASSERT (SELECT tier FROM profiles WHERE id = '00000000-0000-4000-8000-00000000000c') = 1;
  RAISE NOTICE 'ok: postgres (SQL editor) can set tier';
END $$;

-- ─── Member A ────────────────────────────────────────────────────────────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
DO $$
DECLARE
  col text;
  n int;
BEGIN
  -- Every server-only column is refused on the caller's own row.
  FOREACH col IN ARRAY array[
    'tier = 1', 'tethos_coins = 99999', 'xp = 99999', 'level = 99', 'rank = ''Legend''',
    'position = ''President''', 'team_id = gen_random_uuid()', 'is_active = false',
    'is_alumni = true', 'has_voted = true', 'login_streak = 99', 'login_count = 99',
    'email = ''x@evil.test''', 'uwo_email = ''x@evil.test''', 'gdrive_email = ''x@evil.test''',
    'id = ''00000000-0000-4000-8000-00000000000b''', 'created_at = now() - interval ''1 year''',
    'last_login_at = now()', 'first_seen_at = now()', 'portfolio = ''x''', 'side = ''x'''
  ] LOOP
    BEGIN
      EXECUTE 'UPDATE profiles SET ' || col || ' WHERE id = auth.uid()';
      RAISE EXCEPTION 'FAIL: member changed own %', col;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'ok: own % refused (%)', split_part(col, ' =', 1), SQLERRM;
    END;
  END LOOP;

  -- Another member's row is invisible to UPDATE (RLS): no error, no rows.
  UPDATE profiles SET display_name = 'pwned' WHERE id = '00000000-0000-4000-8000-00000000000b';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'FAIL: member updated another row';
  RAISE NOTICE 'ok: other member''s row not updatable (0 rows)';

  -- Every column the app writes with the user's key still works, in one go.
  UPDATE profiles SET
    display_name = 'Maya', bio = 'hi', year = '3', program = 'SE', hometown = 'London',
    birthday = '2004-01-01', phone = '555', preferred_email = 'm@example.test',
    github_username = 'maya', instagram = 'maya', linkedin = 'maya', discord_tag = 'maya',
    favourite_music = 'x', dream_retirement = 'x', spirit_animal = 'x', fun_fact = 'x',
    avatar_url = 'x', avatar_config = '{"hair":"a"}', skills = '{go}', social_links = '{"github":"maya"}',
    active_theme = 'light', preferences = '{"sfx":0.2}',
    onboarding_step = 4, onboarding_completed = true, last_seen_at = now(), updated_at = now()
  WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 1, 'FAIL: editable columns refused';
  -- Writing a privileged column back to its current value is not a change.
  UPDATE profiles SET tier = tier, tethos_coins = tethos_coins, display_name = 'Maya L' WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 1, 'FAIL: no-op write of privileged column refused';
  RAISE NOTICE 'ok: all 26 editable columns update on own row (class/subclass server-only since 20260926151200)';

  -- No self-insert (the INSERT policy is gone; handle_new_user creates rows).
  BEGIN
    INSERT INTO profiles (id, email, display_name, tier)
      VALUES ('00000000-0000-4000-8000-00000000000a', 'a@example.test', 'A', 1)
      ON CONFLICT (id) DO UPDATE SET display_name = excluded.display_name;
    RAISE EXCEPTION 'FAIL: member upserted own profile';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: self insert/upsert refused (%)', SQLERRM;
  END;

  -- Reads: member-visible columns of everyone, private columns of no one.
  ASSERT (SELECT count(*) FROM (SELECT id, display_name, tier, level, class, xp, rank, avatar_url FROM profiles) s) = 3,
    'FAIL: member cannot list public columns';
  RAISE NOTICE 'ok: member reads public columns of all 3 profiles';
  BEGIN
    PERFORM email FROM profiles WHERE id = '00000000-0000-4000-8000-00000000000b';
    RAISE EXCEPTION 'FAIL: member read another member''s email';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: other member''s email unreadable (%)', SQLERRM;
  END;
  FOREACH col IN ARRAY array['phone', 'birthday', 'preferred_email', 'uwo_email', 'gdrive_email', 'hometown', '*'] LOOP
    BEGIN
      EXECUTE 'SELECT ' || col || ' FROM profiles';
      RAISE EXCEPTION 'FAIL: member read %', col;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'ok: select % refused', col;
    END;
  END LOOP;

  -- Tier-gated RLS elsewhere still resolves the caller's tier (T4: no hidden NPCs).
  ASSERT (SELECT count(*) FROM npc_personas WHERE NOT active) = 0, 'FAIL: T4 sees T1/T2 rows';
  RAISE NOTICE 'ok: T4 member gets no T1/T2-only rows';
END $$;
COMMIT;

-- ─── T1 admin C: the tier subquery in other tables' policies still works ─────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM npc_personas WHERE NOT active) = 1, 'FAIL: T1 lost T1/T2 policy access';
  RAISE NOTICE 'ok: T1 still passes (select tier from profiles ...) policies';
  BEGIN
    UPDATE profiles SET tier = 2 WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL: T1 changed own tier with the user key';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: even T1 cannot change tier with the user key';
  END;
END $$;
COMMIT;

-- ─── anon ────────────────────────────────────────────────────────────────────
BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM id FROM profiles;
    RAISE EXCEPTION 'FAIL: anon read profiles';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: anon cannot read profiles';
  END;
END $$;
COMMIT;

-- ─── service_role (server routes) ────────────────────────────────────────────
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
DO $$ BEGIN
  UPDATE profiles SET tier = 2, tethos_coins = 100 WHERE id = '00000000-0000-4000-8000-00000000000b';
  ASSERT (SELECT tier FROM profiles WHERE id = '00000000-0000-4000-8000-00000000000b') = 2, 'FAIL: service_role tier';
  ASSERT (SELECT email FROM profiles WHERE id = '00000000-0000-4000-8000-00000000000b') = 'b@example.test',
    'FAIL: service_role email read';
  RAISE NOTICE 'ok: service_role changes tier/tethos_coins and reads email';
END $$;
COMMIT;

-- Nothing member A tried stuck.
DO $$ BEGIN
  ASSERT (SELECT tier = 4 AND tethos_coins = 0 AND xp = 0 AND email = 'a@example.test' AND display_name = 'Maya L'
          FROM profiles WHERE id = '00000000-0000-4000-8000-00000000000a'), 'FAIL: A row state';
  ASSERT (SELECT display_name FROM profiles WHERE id = '00000000-0000-4000-8000-00000000000b') = 'b',
    'FAIL: B row touched by A';
  RAISE NOTICE 'ok: final state (A still T4 / 0 Gems; B untouched by A)';
END $$;
