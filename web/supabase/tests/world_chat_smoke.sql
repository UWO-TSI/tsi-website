-- World chat, blocks, reports and live sanctions (20261003190000_world_chat, multiplayer M2 §6). Throwaway local
-- Postgres after every migration (supabase_stub.sql first), after realtime_card_smoke.sql. Never Supabase. Fails
-- before the migration: the tables and functions don't exist. Profiles come from the sign-up trigger (public, T5),
-- each with a Google-style display_name that must never reach a chat row or an audit row.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-00000000c701', 'wc-admin@x', '{"display_name":"Ada Adminreal"}'),
  ('00000000-0000-4000-8000-00000000c702', 'wc-alice@x', '{"display_name":"Alice Realname"}'),
  ('00000000-0000-4000-8000-00000000c703', 'wc-bob@x', '{"display_name":"Bob Realname"}'),
  ('00000000-0000-4000-8000-00000000c704', 'wc-exec@x', '{"display_name":"Eve Execreal"}'),
  ('00000000-0000-4000-8000-00000000c705', 'wc-owner@x', '{"display_name":"Olga Ownerreal"}');
-- c701 a T2 admin, c702 Alice (member, world name Rowan), c703 Bob (public, no identity row yet), c704 a T3 exec,
-- c705 a T1.
UPDATE profiles SET membership = 'member', is_active = TRUE, tier = 2 WHERE id = '00000000-0000-4000-8000-00000000c701';
UPDATE profiles SET membership = 'member', is_active = TRUE, tier = 4 WHERE id = '00000000-0000-4000-8000-00000000c702';
UPDATE profiles SET membership = 'member', is_active = TRUE, tier = 3 WHERE id = '00000000-0000-4000-8000-00000000c704';
UPDATE profiles SET membership = 'member', is_active = TRUE, tier = 1 WHERE id = '00000000-0000-4000-8000-00000000c705';
INSERT INTO member_identity (member_id, world_name, world_name_key) VALUES ('00000000-0000-4000-8000-00000000c702', 'Rowan', 'rowan');

-- ─── 1. RLS everywhere; chat and reports have no member policies; functions are service-only ─
DO $$
DECLARE f TEXT;
BEGIN
  ASSERT (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity
            AND relname IN ('world_chat_messages', 'world_blocks', 'world_reports')) = 3, 'RLS on all three tables';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('world_chat_messages', 'world_reports')),
         'chat and reports: no member policies';
  ASSERT (SELECT array_agg(cmd::text ORDER BY cmd) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'world_blocks') = ARRAY['DELETE', 'INSERT', 'SELECT'],
         'blocks: owner select, insert, delete only';
  ASSERT NOT has_table_privilege('authenticated', 'world_blocks', 'UPDATE'), 'blocks are never updated';
  FOR f IN SELECT unnest(ARRAY['realtime_log_chat(jsonb)', 'realtime_sanction(uuid,uuid,text,integer)', 'realtime_sanctions_poll(uuid[])',
                               'world_chat_prune(integer)', 'realtime_player_card(uuid)']) LOOP
    ASSERT (SELECT prosecdef FROM pg_proc WHERE oid = f::regprocedure), f || ': security definer';
    ASSERT (SELECT proconfig FROM pg_proc WHERE oid = f::regprocedure) = ARRAY['search_path=public'], f || ': search_path pinned';
    ASSERT NOT has_function_privilege('public', f, 'EXECUTE') AND NOT has_function_privilege('anon', f, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', f, 'EXECUTE') AND has_function_privilege('service_role', f, 'EXECUTE'), f || ': service role only';
  END LOOP;
  RAISE NOTICE 'world chat 1 RLS, policies, definer functions and grants ok';
END $$;

-- ─── 2. Members and anon can't read or write chat lines or reports, or call the functions ─
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000c701","role":"authenticated"}';
DO $$ BEGIN
  BEGIN PERFORM 1 FROM world_chat_messages; RAISE EXCEPTION 'a T2 read chat lines directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM world_reports; RAISE EXCEPTION 'a member read reports';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO world_chat_messages (id, shard, room_id, area, member_id, world_name, body)
    VALUES (gen_random_uuid(), 1, 'r', 'village', '00000000-0000-4000-8000-00000000c701', 'Forged', 'hi');
    RAISE EXCEPTION 'a member forged a chat line';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO world_reports (reporter_id, target_id, reason) VALUES ('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c702', 'x');
    RAISE EXCEPTION 'a member wrote a report directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM realtime_log_chat('[]'::jsonb); RAISE EXCEPTION 'a member logged chat';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c703', 'remove', 1);
    RAISE EXCEPTION 'a T2 called realtime_sanction with their own key';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM realtime_sanctions_poll(ARRAY['00000000-0000-4000-8000-00000000c702']::uuid[]); RAISE EXCEPTION 'a member polled sanctions';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM world_chat_prune(); RAISE EXCEPTION 'a member pruned';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
DO $$ BEGIN
  BEGIN PERFORM 1 FROM world_chat_messages; RAISE EXCEPTION 'anon read chat'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM world_blocks; RAISE EXCEPTION 'anon read blocks'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM world_reports; RAISE EXCEPTION 'anon read reports'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'world chat 2 members and anon kept out of chat, reports and the functions ok';
END $$;
ROLLBACK;

-- ─── 3. Blocks: each member reads, adds and removes only their own ─────────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000c702","role":"authenticated"}';
DO $$ BEGIN
  INSERT INTO world_blocks (blocker_id, blocked_id) VALUES ('00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-00000000c703');
  ASSERT (SELECT count(*) FROM world_blocks) = 1, 'Alice sees her block';
  BEGIN
    INSERT INTO world_blocks (blocker_id, blocked_id) VALUES ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c704');
    RAISE EXCEPTION 'Alice blocked on Bob''s behalf';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO world_blocks (blocker_id, blocked_id) VALUES ('00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-00000000c702');
    RAISE EXCEPTION 'Alice blocked herself';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO world_blocks (blocker_id, blocked_id) VALUES ('00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-00000000c703');
    RAISE EXCEPTION 'a duplicate block';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    UPDATE world_blocks SET blocked_id = '00000000-0000-4000-8000-00000000c704';
    RAISE EXCEPTION 'a block was edited';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Bob can't see, and can't lift, the block on him.
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000c703","role":"authenticated"}';
DO $$
DECLARE n INTEGER;
BEGIN
  ASSERT (SELECT count(*) FROM world_blocks) = 0, 'Bob can''t see who blocked him';
  DELETE FROM world_blocks WHERE blocker_id = '00000000-0000-4000-8000-00000000c702';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'Bob lifted Alice''s block';
END $$;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000c702","role":"authenticated"}';
DO $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM world_blocks WHERE blocked_id = '00000000-0000-4000-8000-00000000c703';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 1, 'Alice lifts her own block';
END $$;
RESET ROLE;
-- The service role (the realtime server) reads both directions.
INSERT INTO world_blocks (blocker_id, blocked_id) VALUES
  ('00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-00000000c703'),
  ('00000000-0000-4000-8000-00000000c704', '00000000-0000-4000-8000-00000000c702');
SET LOCAL ROLE service_role;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM world_blocks WHERE blocker_id = '00000000-0000-4000-8000-00000000c702' OR blocked_id = '00000000-0000-4000-8000-00000000c702') = 2,
         'the service role reads both directions';
  RAISE NOTICE 'world chat 3 blocks RLS ok';
END $$;
ROLLBACK;

-- ─── 4. realtime_log_chat: batched, idempotent, skips bad rows, no real names ───
SET ROLE service_role;
DO $$
DECLARE
  batch JSONB := jsonb_build_array(
    jsonb_build_object('id', '00000000-0000-4000-8000-0000000c7a01', 'shard', 1, 'room_id', 'roomA', 'area', 'village',
                       'member_id', '00000000-0000-4000-8000-00000000c702', 'world_name', 'Rowan', 'body', 'hello all', 'created_at', '2026-10-03T12:00:00Z'),
    jsonb_build_object('id', '00000000-0000-4000-8000-0000000c7a02', 'shard', 1, 'room_id', 'roomA', 'area', 'cafe',
                       'member_id', '00000000-0000-4000-8000-00000000dead', 'world_name', 'Ghost', 'body', 'boo', 'created_at', '2026-10-03T12:00:01Z'),
    jsonb_build_object('id', '00000000-0000-4000-8000-0000000c7a03', 'shard', 1, 'room_id', 'roomA', 'area', 'village',
                       'member_id', '00000000-0000-4000-8000-00000000c703', 'world_name', 'Islander', 'body', repeat('x', 201)),
    jsonb_build_object('id', '00000000-0000-4000-8000-0000000c7a04', 'shard', 0, 'room_id', 'roomA', 'area', 'village',
                       'member_id', '00000000-0000-4000-8000-00000000c703', 'world_name', 'Islander', 'body', 'shard zero'),
    jsonb_build_object('id', '00000000-0000-4000-8000-0000000c7a05', 'shard', 1, 'room_id', 'roomA', 'area', 'Village!',
                       'member_id', '00000000-0000-4000-8000-00000000c703', 'world_name', 'Islander', 'body', 'bad area'),
    jsonb_build_object('id', '00000000-0000-4000-8000-0000000c7a06', 'shard', 2, 'room_id', 'roomB', 'area', 'hq',
                       'member_id', '00000000-0000-4000-8000-00000000c703', 'world_name', 'Islander', 'body', 'no time given'),
    jsonb_build_object('id', '00000000-0000-4000-8000-0000000c7a06', 'shard', 2, 'room_id', 'roomB', 'area', 'hq',
                       'member_id', '00000000-0000-4000-8000-00000000c703', 'world_name', 'Islander', 'body', 'the same id twice'));
  big JSONB := (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'shard', 1, 'room_id', 'roomA', 'area', 'village',
                       'member_id', NULL, 'world_name', 'Bot', 'body', 'spam')) FROM generate_series(1, 501));
BEGIN
  ASSERT realtime_log_chat(batch) = 3, 'three good rows of seven';
  ASSERT realtime_log_chat(batch) = 0, 'a resent batch inserts nothing';
  ASSERT realtime_log_chat('[]'::jsonb) = 0, 'an empty batch';
  ASSERT (SELECT member_id FROM world_chat_messages WHERE id = '00000000-0000-4000-8000-0000000c7a02') IS NULL, 'an unknown member is stored as null';
  ASSERT (SELECT member_id = '00000000-0000-4000-8000-00000000c702' AND world_name = 'Rowan' AND area = 'village' AND body = 'hello all'
                 AND created_at = '2026-10-03T12:00:00Z'::timestamptz FROM world_chat_messages WHERE id = '00000000-0000-4000-8000-0000000c7a01'), 'stored as sent';
  ASSERT (SELECT created_at > NOW() - INTERVAL '1 minute' FROM world_chat_messages WHERE id = '00000000-0000-4000-8000-0000000c7a06'), 'no time: now';
  ASSERT (SELECT count(*) FROM world_chat_messages WHERE id = '00000000-0000-4000-8000-0000000c7a06') = 1, 'a repeated id inserts once';
  BEGIN PERFORM realtime_log_chat(big); RAISE EXCEPTION 'a batch over 500'; EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'too_many' THEN RAISE; END IF; END;
  BEGIN PERFORM realtime_log_chat('{"id":1}'::jsonb); RAISE EXCEPTION 'an object instead of an array'; EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid' THEN RAISE; END IF; END;
  BEGIN PERFORM realtime_log_chat(NULL); RAISE EXCEPTION 'null rows'; EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid' THEN RAISE; END IF; END;
  ASSERT NOT EXISTS (SELECT 1 FROM world_chat_messages m WHERE m::text ~* '(realname|adminreal|execreal|ownerreal|@x)'), 'a real name or email in a chat row';
  RAISE NOTICE 'world chat 4 realtime_log_chat ok';
END $$;
RESET ROLE;

-- ─── 5. realtime_sanction: T1/T2 only, atomic with its audit row ───────────────
SET ROLE service_role;
DO $$
DECLARE r JSONB;
BEGIN
  -- Refusals change nothing.
  BEGIN PERFORM realtime_sanction('00000000-0000-4000-8000-00000000c704', '00000000-0000-4000-8000-00000000c703', 'mute', 7); RAISE EXCEPTION 'a T3 muted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'forbidden' THEN RAISE; END IF; END;
  BEGIN PERFORM realtime_sanction('00000000-0000-4000-8000-00000000dead', '00000000-0000-4000-8000-00000000c703', 'mute', 7); RAISE EXCEPTION 'no actor';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'forbidden' THEN RAISE; END IF; END;
  BEGIN PERFORM realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000dead', 'remove', 7); RAISE EXCEPTION 'no target';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'not_found' THEN RAISE; END IF; END;
  BEGIN PERFORM realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c701', 'remove', 7); RAISE EXCEPTION 'removed themselves';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'self' THEN RAISE; END IF; END;
  BEGIN PERFORM realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c705', 'remove', 7); RAISE EXCEPTION 'a T2 removed the T1';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'staff' THEN RAISE; END IF; END;
  BEGIN PERFORM realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c703', 'remove', 0); RAISE EXCEPTION '0 days';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid' THEN RAISE; END IF; END;
  BEGIN PERFORM realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c703', 'remove', 366); RAISE EXCEPTION '366 days';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid' THEN RAISE; END IF; END;
  BEGIN PERFORM realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c703', 'ban', 7); RAISE EXCEPTION 'an unknown action';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid' THEN RAISE; END IF; END;
  ASSERT NOT EXISTS (SELECT 1 FROM moderation_log WHERE target_id IN ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c705')), 'refusals logged nothing';

  -- Bob (no identity row yet) removed for 3 days by the T2: the row appears, the audit row says remove_world.
  r := realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c703', 'remove', 3);
  ASSERT (r->>'member_id')::uuid = '00000000-0000-4000-8000-00000000c703' AND r->'muted_until' = 'null'::jsonb, 'remove: the result';
  ASSERT (r->>'removed_until')::timestamptz BETWEEN NOW() + INTERVAL '3 days' - INTERVAL '1 minute' AND NOW() + INTERVAL '3 days' + INTERVAL '1 minute', 'remove: 3 days';
  ASSERT (SELECT removed_until FROM member_identity WHERE member_id = '00000000-0000-4000-8000-00000000c703') = (r->>'removed_until')::timestamptz, 'stored';
  ASSERT realtime_player_card('00000000-0000-4000-8000-00000000c703')->>'removed_until' IS NOT NULL, 'the card carries the real removed_until';
  ASSERT (SELECT action || '/' || item_kind || '/' || excerpt FROM moderation_log WHERE target_id = '00000000-0000-4000-8000-00000000c703' ORDER BY id DESC LIMIT 1)
       = 'remove_world/member/Islander', 'audit: remove_world, by world name';
  -- The T1 mutes Alice for the default 7 days; her world name goes in the audit row.
  r := realtime_sanction('00000000-0000-4000-8000-00000000c705', '00000000-0000-4000-8000-00000000c702', 'mute', NULL);
  ASSERT (r->>'muted_until')::timestamptz > NOW() + INTERVAL '6 days 23 hours', 'mute: 7 days by default';
  ASSERT (SELECT action || '/' || excerpt || '/' || actor_id FROM moderation_log WHERE target_id = '00000000-0000-4000-8000-00000000c702' ORDER BY id DESC LIMIT 1)
       = 'mute/Rowan/00000000-0000-4000-8000-00000000c705', 'audit: mute by the T1';
  -- Restore and unmute clear them; you may lift your own sanction.
  r := realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c703', 'restore', NULL);
  ASSERT r->'removed_until' = 'null'::jsonb AND (SELECT removed_until FROM member_identity WHERE member_id = '00000000-0000-4000-8000-00000000c703') IS NULL, 'restore';
  r := realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c702', 'unmute', NULL);
  ASSERT r->'muted_until' = 'null'::jsonb, 'unmute';
  PERFORM realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c701', 'restore', NULL);
  ASSERT (SELECT array_agg(action ORDER BY id) FROM moderation_log WHERE target_id IN ('00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-00000000c703'))
       = ARRAY['remove_world', 'mute', 'restore_world', 'unmute'], 'one audit row per sanction';
  ASSERT NOT EXISTS (SELECT 1 FROM moderation_log WHERE excerpt ~* '(realname|adminreal|ownerreal)'), 'a real name in the audit log';
  RAISE NOTICE 'world chat 5 realtime_sanction ok';
END $$;
RESET ROLE;

-- ─── 6. realtime_sanctions_poll: a row per known member ─────────────────────────
SET ROLE service_role;
DO $$ BEGIN
  PERFORM realtime_sanction('00000000-0000-4000-8000-00000000c701', '00000000-0000-4000-8000-00000000c702', 'mute', 2);
  ASSERT (SELECT count(*) FROM realtime_sanctions_poll(ARRAY['00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-00000000c703',
                                                            '00000000-0000-4000-8000-00000000c704', '00000000-0000-4000-8000-00000000dead']::uuid[])) = 3,
         'three known members, the unknown id skipped';
  ASSERT (SELECT muted_until > NOW() + INTERVAL '1 day' AND removed_until IS NULL FROM realtime_sanctions_poll(ARRAY['00000000-0000-4000-8000-00000000c702']::uuid[])),
         'Alice muted two days';
  ASSERT (SELECT muted_until IS NULL AND removed_until IS NULL FROM realtime_sanctions_poll(ARRAY['00000000-0000-4000-8000-00000000c704']::uuid[])),
         'no identity row: nothing';
  ASSERT (SELECT count(*) FROM realtime_sanctions_poll('{}'::uuid[])) = 0, 'an empty poll';
  RAISE NOTICE 'world chat 6 realtime_sanctions_poll ok';
END $$;
RESET ROLE;

-- ─── 7. The card: the same keys, the real removed_until ────────────────────────
DO $$
DECLARE c JSONB;
BEGIN
  UPDATE member_identity SET removed_until = NOW() + INTERVAL '1 day' WHERE member_id = '00000000-0000-4000-8000-00000000c702';
  c := realtime_player_card('00000000-0000-4000-8000-00000000c702');
  ASSERT (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(c) k)
       = ARRAY['aura','badge','classes_v2','created_at','family','frame','level','look','mastery','muted_until','name','removed_until','subclass','tier'], 'the §2.2 keys';
  ASSERT (c->>'removed_until')::timestamptz > NOW() + INTERVAL '23 hours' AND (c->>'muted_until')::timestamptz > NOW() + INTERVAL '1 day', 'removed_until and muted_until';
  ASSERT c->>'name' = 'Rowan', 'world name';
  UPDATE member_identity SET removed_until = NULL WHERE member_id = '00000000-0000-4000-8000-00000000c702';
  ASSERT realtime_player_card('00000000-0000-4000-8000-00000000c702')->'removed_until' = 'null'::jsonb, 'lifted';
  RAISE NOTICE 'world chat 7 card removed_until ok';
END $$;

-- ─── 8. The audit log's new kinds and actions; the old ones still pass, unknown ones don't ─
BEGIN;
DO $$ BEGIN
  INSERT INTO moderation_log (actor_id, action, item_kind, item_id, target_id, excerpt) VALUES
    ('00000000-0000-4000-8000-00000000c701', 'remove_mute', 'world_chat', 'report-1', '00000000-0000-4000-8000-00000000c702', 'rude'),
    ('00000000-0000-4000-8000-00000000c701', 'restore_world', 'member', NULL, '00000000-0000-4000-8000-00000000c703', 'Islander'),
    ('00000000-0000-4000-8000-00000000c701', 'reset_name', 'name', NULL, '00000000-0000-4000-8000-00000000c703', 'Islander'),
    ('00000000-0000-4000-8000-00000000c701', 'dismiss', 'letter', 'note-9', NULL, NULL);
  BEGIN INSERT INTO moderation_log (action, item_kind) VALUES ('ban', 'world_chat'); RAISE EXCEPTION 'unknown action accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO moderation_log (action, item_kind) VALUES ('remove_world', 'planet'); RAISE EXCEPTION 'unknown kind accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  ASSERT (SELECT count(*) FROM pg_constraint WHERE conrelid = 'moderation_log'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%action%') = 1,
         'one action check (the old one replaced)';
  ASSERT (SELECT count(*) FROM pg_constraint WHERE conrelid = 'moderation_log'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%item_kind%') = 1,
         'one item_kind check (the old one replaced)';
  RAISE NOTICE 'world chat 8 moderation_log constraints ok';
END $$;
ROLLBACK;

-- ─── 9. Reports: context is at most 20 lines; one report of a line per reporter ──
BEGIN;
DO $$ BEGIN
  INSERT INTO world_reports (reporter_id, target_id, line_id, room_id, shard, reason, context) VALUES
    ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-0000000c7a01', 'roomA', 1, 'rude',
     '[{"id":"00000000-0000-4000-8000-0000000c7a01","member_id":"00000000-0000-4000-8000-00000000c702","world_name":"Rowan","area":"village","body":"hello all","created_at":"2026-10-03T12:00:00Z"}]');
  BEGIN
    INSERT INTO world_reports (reporter_id, target_id, line_id, reason) VALUES
      ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-0000000c7a01', 'again');
    RAISE EXCEPTION 'the same reporter reported the same line twice';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  -- A player reported from the roster twice is fine (no line).
  INSERT INTO world_reports (reporter_id, target_id, reason) VALUES
    ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', 'name'),
    ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', 'name again');
  BEGIN
    INSERT INTO world_reports (reporter_id, target_id, reason, context)
    VALUES ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', 'x', (SELECT jsonb_agg(i) FROM generate_series(1, 21) i));
    RAISE EXCEPTION '21 lines of context';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO world_reports (reporter_id, target_id, reason, status) VALUES ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', 'x', 'actioned');
    RAISE EXCEPTION 'closed without a time';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO world_reports (reporter_id, target_id, reason) VALUES ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', '');
    RAISE EXCEPTION 'an empty reason';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'world chat 9 report constraints ok';
END $$;
ROLLBACK;

-- ─── 10. Prune: 30 days, or 90 after a report closes; open reports keep their line ─
BEGIN;
INSERT INTO world_chat_messages (id, shard, room_id, area, member_id, world_name, body, created_at) VALUES
  ('00000000-0000-4000-8000-0000000c7b01', 1, 'old', 'village', '00000000-0000-4000-8000-00000000c702', 'Rowan', 'old, unreported', NOW() - INTERVAL '31 days'),
  ('00000000-0000-4000-8000-0000000c7b02', 1, 'old', 'village', '00000000-0000-4000-8000-00000000c702', 'Rowan', 'old, open report', NOW() - INTERVAL '60 days'),
  ('00000000-0000-4000-8000-0000000c7b03', 1, 'old', 'village', '00000000-0000-4000-8000-00000000c702', 'Rowan', 'old, closed 10 days ago', NOW() - INTERVAL '60 days'),
  ('00000000-0000-4000-8000-0000000c7b04', 1, 'old', 'village', '00000000-0000-4000-8000-00000000c702', 'Rowan', 'old, closed 91 days ago', NOW() - INTERVAL '120 days'),
  ('00000000-0000-4000-8000-0000000c7b05', 1, 'new', 'village', '00000000-0000-4000-8000-00000000c702', 'Rowan', 'recent', NOW() - INTERVAL '29 days'),
  ('00000000-0000-4000-8000-0000000c7b06', 1, 'old', 'village', '00000000-0000-4000-8000-00000000c702', 'Rowan', 'old, unreported 2', NOW() - INTERVAL '40 days');
INSERT INTO world_reports (reporter_id, target_id, line_id, reason, status, created_at, resolved_at) VALUES
  ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-0000000c7b02', 'open one', 'open', NOW() - INTERVAL '59 days', NULL),
  ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-0000000c7b03', 'closed recently', 'dismissed', NOW() - INTERVAL '59 days', NOW() - INTERVAL '10 days'),
  ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', '00000000-0000-4000-8000-0000000c7b04', 'closed long ago', 'actioned', NOW() - INTERVAL '119 days', NOW() - INTERVAL '91 days'),
  ('00000000-0000-4000-8000-00000000c703', '00000000-0000-4000-8000-00000000c702', NULL, 'roster, closed long ago', 'dismissed', NOW() - INTERVAL '200 days', NOW() - INTERVAL '100 days');
SET LOCAL ROLE service_role;
DO $$
DECLARE r JSONB;
BEGIN
  -- Bounded: one of each per run at p_limit 1, oldest first.
  r := world_chat_prune(1);
  ASSERT r = '{"lines": 1, "reports": 1}'::jsonb, 'p_limit 1: ' || r::text;
  ASSERT NOT EXISTS (SELECT 1 FROM world_reports WHERE reason = 'roster, closed long ago'), 'the oldest closed report first';
  r := world_chat_prune();
  ASSERT r = '{"lines": 2, "reports": 1}'::jsonb, 'the rest: ' || r::text;
  ASSERT (SELECT array_agg(body ORDER BY body) FROM world_chat_messages WHERE id::text LIKE '%c7b0%')
       = ARRAY['old, closed 10 days ago', 'old, open report', 'recent'], 'kept: the open report''s line, the recently closed one''s, the recent line';
  ASSERT (SELECT array_agg(reason ORDER BY reason) FROM world_reports WHERE target_id = '00000000-0000-4000-8000-00000000c702')
       = ARRAY['closed recently', 'open one'], 'kept: open and recently closed reports';
  ASSERT world_chat_prune() = '{"lines": 0, "reports": 0}'::jsonb, 'nothing left to prune';
  RAISE NOTICE 'world chat 10 prune ok';
END $$;
ROLLBACK;
