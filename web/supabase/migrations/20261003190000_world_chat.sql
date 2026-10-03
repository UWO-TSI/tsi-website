-- ─── World chat, blocks, reports and live sanctions (multiplayer M2) ─────────
--
-- specs/multiplayer.md §2.3, §6 and M2; rows 298 (free-text chat for members and
-- public accounts, with a filter, mute, block and report, logged for admins) and
-- 221 (T1/T2 moderation). Apply after 20261003170000_realtime_card.
--
-- - world_chat_messages: every island chat line, written in batches by the realtime
--   server through realtime_log_chat (service role only). The id is the server's,
--   the one clients report by. Member ids and world names only, never real names
--   or emails (row 222).
-- - world_blocks: who blocked whom. A member reads, adds and removes their own
--   rows; the realtime server reads both directions with the service role and stops
--   chat lines and emotes between the pair.
-- - world_reports: a report of a line or a player, with the last 20 lines of that
--   room's chat copied in as context, so it reads after the lines are pruned.
--   Written by /api/world/report, read and closed by /api/admin/moderation.
-- - member_identity.removed_until: a T1/T2 removal from the world (the realtime
--   server refuses joins and closes with 4102 until then).
-- - moderation_log takes item_kind 'world_chat' and the actions remove_world and
--   restore_world. Its constraints are dropped and re-added here; 20260929100100
--   stays as applied.
-- - realtime_sanction: a T1/T2 mute, unmute, removal or restore and its audit row,
--   in one transaction. realtime_sanctions_poll: the realtime server's 60 s check of
--   connected players. realtime_player_card now returns the real removed_until.
-- - world_chat_prune, daily through pg_cron when it is installed: lines go after 30
--   days unless a report names them; a report goes 90 days after it is closed (its
--   line with it). Bounded deletes, one job run a day (the 2026-09-18 outage was
--   pg_cron write volume, STATE.md).
--
-- Every function is SECURITY DEFINER with search_path pinned, executable by the
-- service role only. Test: web/supabase/tests/world_chat_smoke.sql.
--
-- Rollback (SQL editor), in order:
--   select cron.unschedule('world-chat-prune');  -- if scheduled
--   drop function if exists public.world_chat_prune(integer), public.realtime_sanctions_poll(uuid[]),
--     public.realtime_sanction(uuid, uuid, text, integer), public.realtime_log_chat(jsonb);
--   drop table if exists world_reports, world_blocks, world_chat_messages;
--   then re-run 20261003170000_realtime_card.sql (removed_until back to null) and
--   re-add moderation_log's two checks with 20260929100100's lists (after deleting
--   any world_chat / remove_world / restore_world rows). The column can stay.

-- ─── Removal from the world ──────────────────────────────────────────────────
ALTER TABLE member_identity ADD COLUMN IF NOT EXISTS removed_until TIMESTAMPTZ;

-- ─── Chat lines ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_chat_messages (
  id UUID PRIMARY KEY,                       -- the realtime server's line id (protocol ChatLine.id)
  shard SMALLINT NOT NULL CHECK (shard BETWEEN 1 AND 255),
  room_id TEXT NOT NULL CHECK (char_length(room_id) BETWEEN 1 AND 64),
  area TEXT NOT NULL CHECK (area ~ '^[a-z]{1,16}$'),   -- a protocol AREAS name
  member_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  world_name TEXT NOT NULL CHECK (char_length(world_name) BETWEEN 1 AND 32),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,     -- removed by T1/T2
  reported BOOLEAN NOT NULL DEFAULT FALSE    -- named by a report (world_reports has who, why, when)
);
CREATE INDEX IF NOT EXISTS idx_world_chat_room ON world_chat_messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_chat_member ON world_chat_messages (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_chat_created ON world_chat_messages (created_at);
ALTER TABLE world_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON world_chat_messages FROM anon, authenticated;

-- ─── Blocks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_blocks (
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_world_blocks_blocked ON world_blocks (blocked_id);
ALTER TABLE world_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON world_blocks FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON world_blocks TO authenticated;
DROP POLICY IF EXISTS "World blocks readable by their owner" ON world_blocks;
CREATE POLICY "World blocks readable by their owner" ON world_blocks FOR SELECT TO authenticated
  USING (blocker_id = (select auth.uid()));
DROP POLICY IF EXISTS "World blocks added by their owner" ON world_blocks;
CREATE POLICY "World blocks added by their owner" ON world_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = (select auth.uid()));
DROP POLICY IF EXISTS "World blocks removed by their owner" ON world_blocks;
CREATE POLICY "World blocks removed by their owner" ON world_blocks FOR DELETE TO authenticated
  USING (blocker_id = (select auth.uid()));

-- ─── Reports ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  line_id UUID REFERENCES world_chat_messages(id) ON DELETE SET NULL,   -- null: a player reported from the roster
  room_id TEXT CHECK (room_id IS NULL OR char_length(room_id) BETWEEN 1 AND 64),
  shard SMALLINT CHECK (shard IS NULL OR shard BETWEEN 1 AND 255),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 200),
  -- Up to 20 lines of that room's chat as {id, member_id, world_name, area, body, created_at}, oldest first.
  context JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(context) = 'array' AND jsonb_array_length(context) <= 20),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CHECK ((status = 'open') = (resolved_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_world_reports_reporter ON world_reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_reports_open ON world_reports (created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_world_reports_line ON world_reports (line_id) WHERE line_id IS NOT NULL;
-- One report of a line per reporter.
CREATE UNIQUE INDEX IF NOT EXISTS idx_world_reports_once ON world_reports (reporter_id, line_id) WHERE line_id IS NOT NULL;
ALTER TABLE world_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON world_reports FROM anon, authenticated;

-- ─── The audit log learns world chat and world removals ─────────────────────
ALTER TABLE moderation_log DROP CONSTRAINT IF EXISTS moderation_log_action_check;
ALTER TABLE moderation_log ADD CONSTRAINT moderation_log_action_check
  CHECK (action IN ('remove', 'remove_mute', 'dismiss', 'mute', 'unmute', 'reset_name', 'remove_world', 'restore_world'));
ALTER TABLE moderation_log DROP CONSTRAINT IF EXISTS moderation_log_item_kind_check;
ALTER TABLE moderation_log ADD CONSTRAINT moderation_log_item_kind_check
  CHECK (item_kind IN ('letter', 'chat', 'name', 'member', 'world_chat'));

-- ─── realtime_log_chat: the realtime server's batched insert ────────────────
-- p_rows: a JSON array (at most 500) of {id, shard, room_id, area, member_id,
-- world_name, body, created_at}. Idempotent by id, so a batch whose answer was lost
-- can be sent again. A member id without a profile is stored as null; a row that
-- breaks a table check is skipped rather than failing the batch. Returns the count
-- inserted.
CREATE OR REPLACE FUNCTION public.realtime_log_chat(p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n INTEGER;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'invalid'; END IF;
  IF jsonb_array_length(p_rows) > 500 THEN RAISE EXCEPTION 'too_many'; END IF;
  INSERT INTO world_chat_messages (id, shard, room_id, area, member_id, world_name, body, created_at)
  SELECT r.id, r.shard, r.room_id, r.area, p.id, r.world_name, r.body, COALESCE(r.created_at, NOW())
    FROM jsonb_to_recordset(p_rows) AS r(id UUID, shard INTEGER, room_id TEXT, area TEXT, member_id UUID, world_name TEXT, body TEXT, created_at TIMESTAMPTZ)
    LEFT JOIN profiles p ON p.id = r.member_id
   WHERE r.id IS NOT NULL
     AND r.shard BETWEEN 1 AND 255
     AND char_length(r.room_id) BETWEEN 1 AND 64
     AND r.area ~ '^[a-z]{1,16}$'
     AND char_length(r.world_name) BETWEEN 1 AND 32
     AND char_length(r.body) BETWEEN 1 AND 200
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- ─── realtime_sanction: a T1/T2 world sanction and its audit row ────────────
-- p_action: mute | unmute | remove | restore. Mute and remove last p_days (default
-- 7, 1..365) from now. Refusals: forbidden (the actor isn't T1/T2), not_found (no
-- such profile), self (muting or removing yourself), staff (muting or removing a
-- T1/T2), invalid. The audit row names the world name, never the real one. Returns
-- {member_id, muted_until, removed_until}; the caller tells the realtime server.
CREATE OR REPLACE FUNCTION public.realtime_sanction(p_actor UUID, p_member UUID, p_action TEXT, p_days INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_tier INTEGER;
  v_target_tier INTEGER;
  v_until TIMESTAMPTZ;
  r member_identity%ROWTYPE;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('mute', 'unmute', 'remove', 'restore') THEN RAISE EXCEPTION 'invalid'; END IF;
  SELECT tier INTO v_actor_tier FROM profiles WHERE id = p_actor;
  IF v_actor_tier IS NULL OR v_actor_tier NOT IN (1, 2) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT tier INTO v_target_tier FROM profiles WHERE id = p_member;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_action IN ('mute', 'remove') THEN
    IF p_member = p_actor THEN RAISE EXCEPTION 'self'; END IF;
    IF v_target_tier IN (1, 2) THEN RAISE EXCEPTION 'staff'; END IF;
    IF p_days IS NOT NULL AND (p_days < 1 OR p_days > 365) THEN RAISE EXCEPTION 'invalid'; END IF;
    v_until := NOW() + make_interval(days => COALESCE(p_days, 7));
  END IF;
  INSERT INTO member_identity (member_id) VALUES (p_member) ON CONFLICT (member_id) DO NOTHING;
  UPDATE member_identity
     SET muted_until = CASE p_action WHEN 'mute' THEN v_until WHEN 'unmute' THEN NULL ELSE muted_until END,
         removed_until = CASE p_action WHEN 'remove' THEN v_until WHEN 'restore' THEN NULL ELSE removed_until END,
         updated_at = NOW()
   WHERE member_id = p_member
  RETURNING * INTO r;
  INSERT INTO moderation_log (actor_id, action, item_kind, target_id, excerpt)
  VALUES (p_actor,
          CASE p_action WHEN 'remove' THEN 'remove_world' WHEN 'restore' THEN 'restore_world' ELSE p_action END,
          'member', p_member, COALESCE(r.world_name, 'Islander'));
  RETURN jsonb_build_object('member_id', p_member, 'muted_until', r.muted_until, 'removed_until', r.removed_until);
END;
$$;

-- ─── realtime_sanctions_poll: the 60 s safety net for connected players ─────
-- A row per id that has a profile (at most 2000 ids), null when not sanctioned.
CREATE OR REPLACE FUNCTION public.realtime_sanctions_poll(p_members UUID[])
RETURNS TABLE (member_id UUID, muted_until TIMESTAMPTZ, removed_until TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, i.muted_until, i.removed_until
    FROM profiles p
    LEFT JOIN member_identity i ON i.member_id = p.id
   WHERE p.id = ANY (p_members[1:2000])
$$;

-- ─── world_chat_prune: retention, bounded ───────────────────────────────────
-- Closed reports 90 days after they closed, then lines older than 30 days that no
-- remaining report names (open reports keep theirs). At most p_limit rows of each
-- per run, oldest first. Returns {reports, lines} deleted.
CREATE OR REPLACE FUNCTION public.world_chat_prune(p_limit INTEGER DEFAULT 20000)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20000), 1), 100000);
  v_reports INTEGER;
  v_lines INTEGER;
BEGIN
  DELETE FROM world_reports WHERE id IN (
    SELECT id FROM world_reports
     WHERE status <> 'open' AND resolved_at < NOW() - INTERVAL '90 days'
     ORDER BY resolved_at LIMIT v_limit);
  GET DIAGNOSTICS v_reports = ROW_COUNT;
  DELETE FROM world_chat_messages WHERE id IN (
    SELECT c.id FROM world_chat_messages c
     WHERE c.created_at < NOW() - INTERVAL '30 days'
       AND NOT EXISTS (SELECT 1 FROM world_reports r WHERE r.line_id = c.id)
     ORDER BY c.created_at LIMIT v_limit);
  GET DIAGNOSTICS v_lines = ROW_COUNT;
  RETURN jsonb_build_object('reports', v_reports, 'lines', v_lines);
END;
$$;

-- Daily at 08:41 UTC (04:41 in Toronto), where pg_cron exists (Supabase; not the
-- throwaway smoke Postgres). cron.schedule with a name replaces a job of that name.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('world-chat-prune', '41 8 * * *', 'SELECT public.world_chat_prune()');
  END IF;
END $$;

-- ─── realtime_player_card: the real removed_until ───────────────────────────
-- Same signature, keys and grants as 20261003170000; only removed_until changes.
CREATE OR REPLACE FUNCTION public.realtime_player_card(p_member UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'name', COALESCE(i.world_name, 'Islander'),
    'badge', CASE WHEN p.membership = 'member' AND p.is_active THEN 'member' END,
    'tier', p.tier,
    'look', CASE WHEN jsonb_typeof(p.avatar_config->'look') = 'object'
                  AND octet_length((p.avatar_config->'look')::TEXT) <= 2048
                 THEN p.avatar_config->'look' END,
    'family', i.family,
    'level', COALESCE(g.level, 1),
    'subclass', g.subclass,
    'mastery', m.mastery,
    'aura', m.cosmetics->>'aura',
    'frame', m.cosmetics->>'frame',
    'classes_v2', public.classes_v2_on(),
    'muted_until', i.muted_until,
    'removed_until', i.removed_until,
    'created_at', p.created_at
  )
    FROM profiles p
    LEFT JOIN member_identity i ON i.member_id = p.id
    LEFT JOIN member_progression g ON g.member_id = p.id
    LEFT JOIN member_subclass_mastery m ON m.member_id = p.id AND m.subclass = g.subclass
   WHERE p.id = p_member
$$;

-- ─── Grants: service role only ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.realtime_log_chat(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realtime_log_chat(JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.realtime_sanction(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realtime_sanction(UUID, UUID, TEXT, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.realtime_sanctions_poll(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realtime_sanctions_poll(UUID[]) TO service_role;
REVOKE ALL ON FUNCTION public.world_chat_prune(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.world_chat_prune(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.realtime_player_card(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realtime_player_card(UUID) TO service_role;
