-- World friends: codes, requests, friendships and the block trigger (20261013170000_world_friends, specs/v1-drop.md
-- §3). Throwaway local Postgres after every migration (supabase_stub.sql first), after world_chat_smoke.sql. Never
-- Supabase. Fails before the migration: the tables and functions don't exist. Profiles come from the sign-up trigger,
-- each with a Google-style display_name that must never reach a friends row.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-00000000f801', 'fr-alice@x', '{"display_name":"Alice Realname"}'),
  ('00000000-0000-4000-8000-00000000f802', 'fr-bob@x', '{"display_name":"Bob Realname"}'),
  ('00000000-0000-4000-8000-00000000f803', 'fr-cara@x', '{"display_name":"Cara Realname"}'),
  ('00000000-0000-4000-8000-00000000f804', 'fr-dan@x', '{"display_name":"Dan Realname"}');
-- A crowd for the limits: f9xx (40 of them).
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT ('00000000-0000-4000-8000-000000f9' || lpad(to_hex(n), 4, '0'))::uuid, 'fr-crowd' || n || '@x', '{"display_name":"Crowd Realname"}'
  FROM generate_series(1, 40) AS n;

-- ─── 1. RLS on all three; read-only policies; no direct writes; service-only functions ─
DO $$
DECLARE f TEXT; t TEXT;
BEGIN
  ASSERT (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity
            AND relname IN ('world_friend_codes', 'world_friend_requests', 'world_friends')) = 3, 'RLS on all three tables';
  FOREACH t IN ARRAY ARRAY['world_friend_codes', 'world_friend_requests', 'world_friends'] LOOP
    ASSERT (SELECT array_agg(cmd::text) FROM pg_policies WHERE schemaname = 'public' AND tablename = t) = ARRAY['SELECT'], t || ': a read policy only';
    ASSERT NOT has_table_privilege('authenticated', t, 'INSERT') AND NOT has_table_privilege('authenticated', t, 'UPDATE')
       AND NOT has_table_privilege('authenticated', t, 'DELETE'), t || ': members never write directly';
    ASSERT NOT has_table_privilege('anon', t, 'SELECT'), t || ': anon reads nothing';
  END LOOP;
  FOR f IN SELECT unnest(ARRAY['world_friend_request(uuid,uuid)', 'world_friend_accept(uuid,uuid)', 'world_friend_remove(uuid,uuid)']) LOOP
    ASSERT (SELECT prosecdef FROM pg_proc WHERE oid = f::regprocedure), f || ': security definer';
    ASSERT (SELECT proconfig FROM pg_proc WHERE oid = f::regprocedure) = ARRAY['search_path=public'], f || ': search_path pinned';
    ASSERT NOT has_function_privilege('public', f, 'EXECUTE') AND NOT has_function_privilege('anon', f, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', f, 'EXECUTE') AND has_function_privilege('service_role', f, 'EXECUTE'), f || ': service role only';
  END LOOP;
  ASSERT (SELECT prosecdef FROM pg_proc WHERE oid = 'world_blocks_end_friendship()'::regprocedure), 'the block trigger runs as its owner';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'world_blocks_end_friendship' AND tgrelid = 'world_blocks'::regclass), 'the block trigger is on world_blocks';
  RAISE NOTICE 'world friends 1 RLS, policies, grants and definer functions ok';
END $$;

-- ─── 2. Codes: the alphabet without look-alikes, one per member, unique ───────────
DO $$ BEGIN
  INSERT INTO world_friend_codes (member_id, code) VALUES ('00000000-0000-4000-8000-00000000f801', 'ABCD2345');
  INSERT INTO world_friend_codes (member_id, code) VALUES ('00000000-0000-4000-8000-00000000f802', 'WXYZ6789');
  BEGIN INSERT INTO world_friend_codes (member_id, code) VALUES ('00000000-0000-4000-8000-00000000f803', 'ABCD2345'); RAISE EXCEPTION 'a duplicate code';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN INSERT INTO world_friend_codes (member_id, code) VALUES ('00000000-0000-4000-8000-00000000f801', 'QQQQ2222'); RAISE EXCEPTION 'two codes for one member';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN INSERT INTO world_friend_codes (member_id, code) VALUES ('00000000-0000-4000-8000-00000000f803', 'ABCD0OIL'); RAISE EXCEPTION 'look-alike characters';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO world_friend_codes (member_id, code) VALUES ('00000000-0000-4000-8000-00000000f803', 'abcd2345'); RAISE EXCEPTION 'lower case';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO world_friend_codes (member_id, code) VALUES ('00000000-0000-4000-8000-00000000f803', 'ABC2345'); RAISE EXCEPTION 'seven characters';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'world friends 2 codes ok';
END $$;

-- ─── 3. Requests and accepts through the service role ─────────────────────────
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE A UUID := '00000000-0000-4000-8000-00000000f801'; B UUID := '00000000-0000-4000-8000-00000000f802'; C UUID := '00000000-0000-4000-8000-00000000f803';
BEGIN
  ASSERT world_friend_request(A, B) = 'requested', 'alice asks bob';
  ASSERT world_friend_request(A, B) = 'already_requested', 'asking twice is fine';
  ASSERT world_friend_request(B, A) = 'friends', 'bob asking back is the accept';
  ASSERT (SELECT count(*) FROM world_friend_requests WHERE A IN (from_id, to_id)) = 0, 'both requests gone';
  ASSERT (SELECT count(*) FROM world_friends WHERE a_id = LEAST(A, B) AND b_id = GREATEST(A, B)) = 1, 'one row for the pair, ordered';
  ASSERT world_friend_request(A, B) = 'already_friends' AND world_friend_request(B, A) = 'already_friends', 'friends already';
  ASSERT world_friend_request(C, A) = 'requested', 'cara asks alice';
  ASSERT world_friend_accept(A, C) = 'friends', 'alice says yes';
  ASSERT world_friend_accept(A, C) = 'already_friends', 'saying yes twice is fine';
  BEGIN PERFORM world_friend_accept(A, '00000000-0000-4000-8000-00000000f804'); RAISE EXCEPTION 'accepted a request that was never made';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', SQLERRM; END;
  BEGIN PERFORM world_friend_request(A, A); RAISE EXCEPTION 'friended yourself';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'invalid', SQLERRM; END;
  BEGIN PERFORM world_friend_request(A, NULL); RAISE EXCEPTION 'friended nobody';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'invalid', SQLERRM; END;
  BEGIN PERFORM world_friend_request(A, '00000000-0000-4000-8000-0000000000ee'); RAISE EXCEPTION 'friended a stranger with no profile';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', SQLERRM; END;
  -- Decline and cancel: everything between the pair goes.
  ASSERT world_friend_request('00000000-0000-4000-8000-00000000f804', A) = 'requested', 'dan asks alice';
  ASSERT NOT world_friend_remove(A, '00000000-0000-4000-8000-00000000f804'), 'a decline: they were not friends';
  ASSERT NOT EXISTS (SELECT 1 FROM world_friend_requests WHERE to_id = A), 'the request is gone';
  ASSERT world_friend_remove(C, A), 'cara unfriends alice';
  ASSERT NOT EXISTS (SELECT 1 FROM world_friends WHERE C IN (a_id, b_id)), 'no friendship left';
  RAISE NOTICE 'world friends 3 request, accept, decline, cancel and unfriend ok';
END $$;
COMMIT;

-- ─── 4. Limits: 20 new requests an hour, 30 open, 200 friends ─────────────────
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE D UUID := '00000000-0000-4000-8000-00000000f804'; n INT;
BEGIN
  FOR n IN 1..20 LOOP ASSERT world_friend_request(D, ('00000000-0000-4000-8000-000000f9' || lpad(to_hex(n), 4, '0'))::uuid) = 'requested', 'request ' || n; END LOOP;
  BEGIN PERFORM world_friend_request(D, '00000000-0000-4000-8000-000000f90015'); RAISE EXCEPTION 'a 21st request this hour';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'limit', SQLERRM; END;
  -- An hour later the hourly count is clear, but 30 open requests is the cap.
  UPDATE world_friend_requests SET created_at = NOW() - INTERVAL '2 hours' WHERE from_id = D;
  FOR n IN 21..30 LOOP PERFORM world_friend_request(D, ('00000000-0000-4000-8000-000000f9' || lpad(to_hex(n), 4, '0'))::uuid); END LOOP;
  ASSERT (SELECT count(*) FROM world_friend_requests WHERE from_id = D) = 30, 'thirty open';
  UPDATE world_friend_requests SET created_at = NOW() - INTERVAL '2 hours' WHERE from_id = D;
  BEGIN PERFORM world_friend_request(D, '00000000-0000-4000-8000-000000f90020'); RAISE EXCEPTION 'a 31st open request';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'limit', SQLERRM; END;
  -- Someone answering one of them is fine: an accept isn't a new request.
  ASSERT world_friend_request('00000000-0000-4000-8000-000000f90001', D) = 'friends', 'an answer makes friends';
  RAISE NOTICE 'world friends 4 hourly and open-request limits ok';
END $$;
ROLLBACK;
BEGIN;
-- 200 friends for alice (the crowd of 40 isn't enough: make the profiles), then one more is refused, either way round.
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT ('00000000-0000-4000-8000-0000fa' || lpad(to_hex(n), 6, '0'))::uuid, 'fr-many' || n || '@x', '{"display_name":"Many Realname"}' FROM generate_series(1, 200) AS n;
INSERT INTO world_friends (a_id, b_id)
SELECT LEAST('00000000-0000-4000-8000-00000000f801'::uuid, u), GREATEST('00000000-0000-4000-8000-00000000f801'::uuid, u)
  FROM (SELECT ('00000000-0000-4000-8000-0000fa' || lpad(to_hex(n), 6, '0'))::uuid AS u FROM generate_series(1, 200) AS n) g
ON CONFLICT DO NOTHING;
SET LOCAL ROLE service_role;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM world_friends WHERE '00000000-0000-4000-8000-00000000f801' IN (a_id, b_id)) >= 200, 'alice has 200 friends';
  BEGIN PERFORM world_friend_request('00000000-0000-4000-8000-00000000f801', '00000000-0000-4000-8000-00000000f804'); RAISE EXCEPTION 'a 201st friend asked';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'limit', SQLERRM; END;
  PERFORM world_friend_request('00000000-0000-4000-8000-00000000f803', '00000000-0000-4000-8000-00000000f801');
  BEGIN PERFORM world_friend_accept('00000000-0000-4000-8000-00000000f801', '00000000-0000-4000-8000-00000000f803'); RAISE EXCEPTION 'a 201st friend accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'limit', SQLERRM; END;
  RAISE NOTICE 'world friends 4b the 200-friend cap ok';
END $$;
ROLLBACK;

-- ─── 5. RLS: each side reads only its own; members can't write or call the functions ─
SET ROLE service_role;
SELECT world_friend_request('00000000-0000-4000-8000-00000000f803', '00000000-0000-4000-8000-00000000f802');
RESET ROLE;
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000f801","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM world_friends) = 1, 'alice reads her one friendship (bob)';
  ASSERT (SELECT count(*) FROM world_friend_requests) = 0, 'alice reads no one else''s requests';
  ASSERT (SELECT array_agg(code) FROM world_friend_codes) = ARRAY['ABCD2345'], 'alice reads only her own code';
  BEGIN INSERT INTO world_friends (a_id, b_id) VALUES ('00000000-0000-4000-8000-00000000f801', '00000000-0000-4000-8000-00000000f804'); RAISE EXCEPTION 'a member forged a friendship';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO world_friend_requests (from_id, to_id) VALUES ('00000000-0000-4000-8000-00000000f801', '00000000-0000-4000-8000-00000000f804'); RAISE EXCEPTION 'a member wrote a request directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM world_friends; RAISE EXCEPTION 'a member deleted a friendship directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE world_friend_codes SET code = 'HHHH2222'; RAISE EXCEPTION 'a member changed a code';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM world_friend_request('00000000-0000-4000-8000-00000000f801', '00000000-0000-4000-8000-00000000f804'); RAISE EXCEPTION 'a member called the request function';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM world_friend_remove('00000000-0000-4000-8000-00000000f801', '00000000-0000-4000-8000-00000000f802'); RAISE EXCEPTION 'a member called the remove function';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000f802","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM world_friends) = 1, 'bob reads the same friendship';
  ASSERT (SELECT count(*) FROM world_friend_requests) = 1, 'bob reads cara''s request to him';
  ASSERT (SELECT array_agg(code) FROM world_friend_codes) = ARRAY['WXYZ6789'], 'bob reads only his code';
END $$;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000f804","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM world_friends) = 0 AND (SELECT count(*) FROM world_friend_codes) = 0, 'dan reads nothing of theirs';
END $$;
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
DO $$ BEGIN
  BEGIN PERFORM 1 FROM world_friends; RAISE EXCEPTION 'anon read friendships'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM world_friend_codes; RAISE EXCEPTION 'anon read codes'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'world friends 5 each side reads its own, nobody writes directly ok';
END $$;
ROLLBACK;

-- ─── 6. A block (a member's own insert) ends the friendship and requests; none can cross it ─
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000f802","role":"authenticated"}';
INSERT INTO world_blocks (blocker_id, blocked_id) VALUES ('00000000-0000-4000-8000-00000000f802', '00000000-0000-4000-8000-00000000f801');
INSERT INTO world_blocks (blocker_id, blocked_id) VALUES ('00000000-0000-4000-8000-00000000f802', '00000000-0000-4000-8000-00000000f803');
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM world_friends WHERE '00000000-0000-4000-8000-00000000f802' IN (a_id, b_id)), 'the block ended bob and alice';
  ASSERT NOT EXISTS (SELECT 1 FROM world_friend_requests WHERE to_id = '00000000-0000-4000-8000-00000000f802'), 'and cara''s request to bob';
  BEGIN PERFORM world_friend_request('00000000-0000-4000-8000-00000000f801', '00000000-0000-4000-8000-00000000f802'); RAISE EXCEPTION 'asked across a block';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'blocked', SQLERRM; END;
  BEGIN PERFORM world_friend_request('00000000-0000-4000-8000-00000000f802', '00000000-0000-4000-8000-00000000f803'); RAISE EXCEPTION 'the blocker asked across their own block';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'blocked', SQLERRM; END;
  RAISE NOTICE 'world friends 6 a block ends the friendship and requests, and none crosses it ok';
END $$;
ROLLBACK;

-- ─── 7. Never a real name: the rows hold member ids only ──────────────────────
DO $$ BEGIN
  ASSERT (SELECT array_agg(column_name::text ORDER BY column_name) FROM information_schema.columns WHERE table_name = 'world_friends') = ARRAY['a_id', 'b_id', 'created_at'], 'friendship columns';
  ASSERT (SELECT array_agg(column_name::text ORDER BY column_name) FROM information_schema.columns WHERE table_name = 'world_friend_requests') = ARRAY['created_at', 'from_id', 'to_id'], 'request columns';
  RAISE NOTICE 'world friends 7 ids only, no names ok';
END $$;

DELETE FROM world_friends WHERE '00000000-0000-4000-8000-00000000f801' IN (a_id, b_id) OR '00000000-0000-4000-8000-00000000f803' IN (a_id, b_id);
DELETE FROM world_friend_requests WHERE from_id IN (SELECT id FROM profiles WHERE display_name LIKE '%Realname');
SELECT 'world_friends smoke ok';
