-- The game's event log and the admin analytics read (20261106210000_game_events). Throwaway local Postgres after every
-- migration, with the pre_* seeds. Never Supabase. Fails before the migration: no game_events.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000a0001', 'an-1@x'), ('00000000-0000-4000-8000-0000000a0002', 'an-2@x'),
  ('00000000-0000-4000-8000-0000000a0003', 'an-3@x')
ON CONFLICT DO NOTHING;
DO $$
DECLARE
  A uuid := '00000000-0000-4000-8000-0000000a0001';  -- a member who arrived, fished, sold, then went quiet
  B uuid := '00000000-0000-4000-8000-0000000a0002';  -- a logged player: two sessions
  C uuid := '00000000-0000-4000-8000-0000000a0003';  -- a public account that never played: not a player
  S1 uuid := '00000000-0000-4000-8000-00000000a5e1';
  S2 uuid := '00000000-0000-4000-8000-00000000a5e2';
  fish text := (SELECT key FROM collection_species WHERE category = 'fish' ORDER BY key LIMIT 1);
  snap jsonb; n integer;
BEGIN
  UPDATE profiles SET membership = 'member', created_at = NOW() - INTERVAL '20 days', avatar_config = '{"look": {}}' WHERE id = A;
  UPDATE profiles SET membership = 'public', created_at = NOW() - INTERVAL '2 days' WHERE id IN (B, C);
  INSERT INTO member_identity (member_id, world_name, world_name_key, name_set_at) VALUES (A, 'Pebble', 'an-smoke-pebble', NOW() - INTERVAL '20 days')
    ON CONFLICT (member_id) DO UPDATE SET world_name = 'Pebble', world_name_key = 'an-smoke-pebble';
  INSERT INTO wallet_ledger (member_id, amount, balance_after, source, ref, idempotency_key, created_at) VALUES
    (A, 5, 5, 'quest', 'arrival', 'arrival:v2', NOW() - INTERVAL '20 days'),
    (A, 12, 17, 'sell', 'x', 'sell:an-smoke-1', NOW() - INTERVAL '19 days');
  INSERT INTO member_collections (user_id, item_key, count, first_collected_at) VALUES (A, fish, 1, NOW() - INTERVAL '20 days');

  -- The log: two sessions for B, the steps and a feature, the screens.
  INSERT INTO game_events (member_id, session_id, kind, step, screen, at) VALUES
    (B, S1, 'session_start', NULL, 'opening', NOW() - INTERVAL '2 days'),
    (B, S1, 'step', 'arrival_aboard', 'opening', NOW() - INTERVAL '2 days'),
    (B, S1, 'step', 'creator', 'opening', NOW() - INTERVAL '2 days' + INTERVAL '3 minutes'),
    (B, S1, 'heartbeat', NULL, 'opening', NOW() - INTERVAL '2 days' + INTERVAL '6 minutes'),
    (B, S1, 'session_end', NULL, 'opening', NOW() - INTERVAL '2 days' + INTERVAL '7 minutes'),
    (B, S2, 'session_start', NULL, 'village', NOW() - INTERVAL '1 hour'),
    (B, S2, 'step', 'creator', 'village', NOW() - INTERVAL '50 minutes'),
    (B, S2, 'feature', 'fishing', 'village', NOW() - INTERVAL '40 minutes'),
    (B, S2, 'session_end', NULL, 'museum', NOW() - INTERVAL '30 minutes');

  -- Only ids of the list's shape: free text and a step on a heartbeat are refused.
  BEGIN
    INSERT INTO game_events (member_id, session_id, kind, step) VALUES (B, S1, 'step', 'Hello there, my name is');
    RAISE EXCEPTION 'free text step accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO game_events (member_id, session_id, kind, step) VALUES (B, S1, 'heartbeat', 'creator');
    RAISE EXCEPTION 'a heartbeat with a step accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO game_events (member_id, session_id, kind) VALUES (B, S1, 'page_view');
    RAISE EXCEPTION 'an unknown kind accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  snap := game_analytics_snapshot(NOW() - INTERVAL '200 days');
  ASSERT (SELECT COUNT(*) FROM jsonb_array_elements(snap->'players') p WHERE p->>'id' IN (A::text, B::text)) = 2, 'A (member) and B (logged) are players';
  ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(snap->'players') p WHERE p->>'id' = C::text), 'C never played';
  ASSERT (SELECT p->>'name' FROM jsonb_array_elements(snap->'players') p WHERE p->>'id' = A::text) = 'Pebble', 'the world name';
  ASSERT NOT (snap::text ILIKE '%@x%'), 'no email in the snapshot';
  ASSERT (SELECT string_agg(s->>'s', ',' ORDER BY s->>'s') FROM jsonb_array_elements(snap->'steps') s WHERE s->>'m' = A::text)
    = 'arrived,creator,first_catch,first_sale', 'A''s history from the tables: ' || COALESCE((SELECT string_agg(s->>'s', ',') FROM jsonb_array_elements(snap->'steps') s WHERE s->>'m' = A::text), '');
  ASSERT (SELECT (s->>'at')::timestamptz FROM jsonb_array_elements(snap->'steps') s WHERE s->>'m' = B::text AND s->>'s' = 'creator')
    < NOW() - INTERVAL '1 day', 'a step''s first time wins';
  ASSERT (SELECT COUNT(*) FROM jsonb_array_elements(snap->'sessions') x WHERE x->>'m' = B::text) = 2, 'B has two sessions';
  ASSERT (SELECT x->>'screen' FROM jsonb_array_elements(snap->'sessions') x WHERE x->>'m' = B::text ORDER BY x->>'start' DESC LIMIT 1) = 'museum', 'the last screen';
  ASSERT (SELECT x->>'last_step' FROM jsonb_array_elements(snap->'sessions') x WHERE x->>'m' = B::text ORDER BY x->>'start' LIMIT 1) = 'creator', 'the last step';
  ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(snap->'uses') u WHERE u->>'m' = A::text AND u->>'f' = 'selling'), 'a sale is a use of selling';
  ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(snap->'uses') u WHERE u->>'m' = B::text AND u->>'f' = 'fishing'), 'a logged feature';
  ASSERT (SELECT COUNT(*) FROM jsonb_array_elements(snap->'days') d WHERE d->>'m' = A::text) = 2, 'A played on two days';

  -- 180 days, then gone.
  INSERT INTO game_events (member_id, session_id, kind, at) VALUES (B, S1, 'heartbeat', NOW() - INTERVAL '181 days');
  n := game_events_prune();
  ASSERT n = 1 AND NOT EXISTS (SELECT 1 FROM game_events WHERE at < NOW() - INTERVAL '180 days'), 'pruned: ' || n;
  ASSERT (SELECT COUNT(*) FROM game_events WHERE member_id = B) = 9, 'the rest stay';
  RAISE NOTICE 'game_events: ids only, history from the tables, sessions and screens, 180-day prune';
END $$;

-- Closed to members and the public; the server's role reads it.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000a0002","role":"authenticated"}', false);
DO $$ BEGIN
  BEGIN PERFORM 1 FROM game_events LIMIT 1; RAISE EXCEPTION 'a member read the log';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO game_events (member_id, session_id, kind) VALUES ('00000000-0000-4000-8000-0000000a0002', gen_random_uuid(), 'heartbeat');
    RAISE EXCEPTION 'a member wrote the log';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM game_analytics_snapshot(NOW()); RAISE EXCEPTION 'a member read the snapshot';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM game_events_prune(); RAISE EXCEPTION 'a member pruned';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM 1 FROM game_events LIMIT 1; RAISE EXCEPTION 'anon read the log';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM game_analytics_snapshot(NOW()); RAISE EXCEPTION 'anon read the snapshot';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ BEGIN
  ASSERT jsonb_typeof(game_analytics_snapshot(NOW() - INTERVAL '30 days')->'players') = 'array', 'the server reads it';
  ASSERT (SELECT COUNT(*) FROM game_events) > 0, 'the server sees the log';
  RAISE NOTICE 'game_events: closed to anon and members, open to the server';
END $$;
RESET ROLE;
