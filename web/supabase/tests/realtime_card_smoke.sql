-- realtime_player_card (20261003170000_realtime_card, multiplayer M1 §2.2). Throwaway local
-- Postgres after every migration (supabase_stub.sql first). Never Supabase. Fails before the
-- migration: the function doesn't exist. Profiles come from the sign-up trigger, so each one
-- carries a Google-style display_name the card must never show.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000ca401', 'card-member@x', '{"display_name":"Rosalind Realname"}'),
  ('00000000-0000-4000-8000-0000000ca402', 'card-public@x', '{"display_name":"Grace Hiddenname"}'),
  ('00000000-0000-4000-8000-0000000ca403', 'card-alumni@x', '{"display_name":"Ada Formername"}');

-- A: an active member with a world name, a look, a family, level 12 as a druid with mastery 3
-- and two cosmetics, muted until next week. B: a public account that has set nothing.
-- C: an inactive member whose look is over the 2 KB cap.
UPDATE economy_settings SET value = 0 WHERE key = 'classes_v2';
UPDATE profiles SET membership = 'member', is_active = TRUE, tier = 4,
       avatar_config = '{"body":"legacy","look":{"preset":"v7","hair":"bob","skin":3}}'
 WHERE id = '00000000-0000-4000-8000-0000000ca401';
UPDATE profiles SET membership = 'member', is_active = FALSE, tier = 3,
       avatar_config = jsonb_build_object('look', jsonb_build_object('note', repeat('x', 2100)))
 WHERE id = '00000000-0000-4000-8000-0000000ca403';
INSERT INTO member_identity (member_id, world_name, world_name_key, family, muted_until) VALUES
  ('00000000-0000-4000-8000-0000000ca401', 'Maple', 'maple', 'Warden', NOW() + INTERVAL '7 days');
INSERT INTO member_progression (member_id, xp, level, subclass) VALUES
  ('00000000-0000-4000-8000-0000000ca401', 19250, combat_level_for_xp(19250), 'druid');
INSERT INTO member_subclass_mastery (member_id, subclass, xp, mastery, cosmetics) VALUES
  ('00000000-0000-4000-8000-0000000ca401', 'druid', 1900, combat_mastery_for_xp(1900), '{"aura":"mastery:colour","frame":"mastery:bronze"}'),
  ('00000000-0000-4000-8000-0000000ca401', 'shaman', 0, 1, '{"aura":"other-subclass"}');

-- ─── 1. Members and anonymous callers can't read anyone's card ────────────────
BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM realtime_player_card('00000000-0000-4000-8000-0000000ca401'); RAISE EXCEPTION 'anon read a card';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000ca401","role":"authenticated"}';
DO $$ BEGIN
  BEGIN PERFORM realtime_player_card('00000000-0000-4000-8000-0000000ca401'); RAISE EXCEPTION 'a member read their own card';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM realtime_player_card('00000000-0000-4000-8000-0000000ca402'); RAISE EXCEPTION 'a member read another card';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'realtime card 1 anon and members denied ok';
END $$;
ROLLBACK;
DO $$ BEGIN
  ASSERT (SELECT prosecdef FROM pg_proc WHERE proname = 'realtime_player_card'), 'security definer';
  ASSERT (SELECT proconfig FROM pg_proc WHERE proname = 'realtime_player_card') = ARRAY['search_path=public'], 'search_path pinned';
  ASSERT NOT has_function_privilege('public', 'realtime_player_card(uuid)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'realtime_player_card(uuid)', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'realtime_player_card(uuid)', 'EXECUTE')
     AND has_function_privilege('service_role', 'realtime_player_card(uuid)', 'EXECUTE'), 'grants: service role only';
  RAISE NOTICE 'realtime card 1b definer, search_path, grants ok';
END $$;

-- ─── 2. The service role gets exactly the §2.2 fields for a seeded member ─────
SET ROLE service_role;
CREATE TEMP TABLE cards AS
  SELECT u.id, realtime_player_card(u.id) AS card
    FROM (VALUES ('00000000-0000-4000-8000-0000000ca401'::uuid), ('00000000-0000-4000-8000-0000000ca402'), ('00000000-0000-4000-8000-0000000ca403')) u(id);
RESET ROLE;
DO $$
DECLARE a jsonb := (SELECT card FROM cards WHERE id = '00000000-0000-4000-8000-0000000ca401');
BEGIN
  ASSERT (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(a) k)
       = ARRAY['aura','badge','classes_v2','created_at','family','frame','level','look','mastery','muted_until','name','removed_until','subclass','tier'],
         'exactly the §2.2 keys: ' || (SELECT string_agg(k, ',') FROM jsonb_object_keys(a) k);
  ASSERT a->>'name' = 'Maple', 'world name';
  ASSERT a->>'badge' = 'member', 'active member badge';
  ASSERT (a->>'tier')::int = 4, 'tier';
  ASSERT a->'look' = '{"preset":"v7","hair":"bob","skin":3}'::jsonb, 'look is avatar_config.look only';
  ASSERT a->>'family' = 'Warden', 'family';
  ASSERT (a->>'level')::int = 12 AND a->>'subclass' = 'druid', 'level and subclass';
  ASSERT (a->>'mastery')::int = 3 AND a->>'aura' = 'mastery:colour' AND a->>'frame' = 'mastery:bronze', 'the active subclass''s mastery and cosmetics, not the other row''s';
  ASSERT a->'classes_v2' = 'false'::jsonb, 'flag off';
  ASSERT (a->>'muted_until')::timestamptz > NOW() + INTERVAL '6 days', 'muted_until';
  ASSERT a->'removed_until' = 'null'::jsonb, 'removed_until null until M2';
  ASSERT (a->>'created_at')::timestamptz = (SELECT created_at FROM profiles WHERE id = '00000000-0000-4000-8000-0000000ca401'), 'the profile''s age';
  RAISE NOTICE 'realtime card 2 member fields ok';
END $$;

-- ─── 3. The real name and the email never appear, on any card ──────────────────
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM cards WHERE card IS NOT NULL) = 3, 'three cards';
  ASSERT NOT EXISTS (SELECT 1 FROM cards c JOIN profiles p ON p.id = c.id
                      WHERE position(p.display_name IN c.card::text) > 0
                         OR position(split_part(p.display_name, ' ', 1) IN c.card::text) > 0
                         OR position(p.email IN c.card::text) > 0), 'a real name or email leaked';
  ASSERT NOT EXISTS (SELECT 1 FROM cards WHERE card::text ~* '(realname|hiddenname|formername|@x)'), 'a real name or email leaked';
  RAISE NOTICE 'realtime card 3 no real names ok';
END $$;

-- ─── 4. Defaults: no identity is "Islander", public accounts get no badge ──────
BEGIN;
DO $$
DECLARE b jsonb := (SELECT card FROM cards WHERE id = '00000000-0000-4000-8000-0000000ca402');
        c jsonb := (SELECT card FROM cards WHERE id = '00000000-0000-4000-8000-0000000ca403');
BEGIN
  ASSERT b->>'name' = 'Islander', 'missing identity falls back to Islander, not ' || (b->>'name');
  ASSERT b->'badge' = 'null'::jsonb AND (b->>'tier')::int = 5, 'public account: no badge, tier 5 from the sign-up trigger';
  ASSERT (b->>'level')::int = 1 AND b->'subclass' = 'null'::jsonb AND b->'mastery' = 'null'::jsonb
     AND b->'aura' = 'null'::jsonb AND b->'frame' = 'null'::jsonb AND b->'family' = 'null'::jsonb, 'no progression yet';
  ASSERT b->'look' = 'null'::jsonb AND b->'muted_until' = 'null'::jsonb, 'nothing set';
  ASSERT c->>'name' = 'Islander' AND c->'badge' = 'null'::jsonb, 'inactive member: no badge';
  ASSERT c->'look' = 'null'::jsonb, 'a look over 2 KB is dropped';
  -- An identity row without a world name (e.g. after the quiz) is still "Islander".
  INSERT INTO member_identity (member_id, family) VALUES ('00000000-0000-4000-8000-0000000ca402', 'Arcane');
  ASSERT realtime_player_card('00000000-0000-4000-8000-0000000ca402')->>'name' = 'Islander', 'identity without a name';
  ASSERT realtime_player_card('00000000-0000-4000-8000-0000000ca402')->>'family' = 'Arcane', 'family without a name';
  -- A look that isn't an object is dropped.
  UPDATE profiles SET avatar_config = '{"look":"not-an-object"}' WHERE id = '00000000-0000-4000-8000-0000000ca402';
  ASSERT realtime_player_card('00000000-0000-4000-8000-0000000ca402')->'look' = 'null'::jsonb, 'a non-object look';
  -- No profile: null, so the server refuses the join.
  ASSERT realtime_player_card('00000000-0000-4000-8000-00000000dead') IS NULL, 'unknown member';
  RAISE NOTICE 'realtime card 4 defaults ok';
END $$;
ROLLBACK;

-- ─── 5. The classes v2 flag is read live ──────────────────────────────────────
BEGIN;
UPDATE economy_settings SET value = 1 WHERE key = 'classes_v2';
DO $$ BEGIN
  ASSERT realtime_player_card('00000000-0000-4000-8000-0000000ca401')->'classes_v2' = 'true'::jsonb, 'flag on';
  RAISE NOTICE 'realtime card 5 classes_v2 ok';
END $$;
ROLLBACK;
