-- game_events: the game's small event log, and the read the admin analytics page makes (specs/analytics.md).
-- David, 2026-11-06: "make a backened analytics dashboard to see players and like funnel for each major step and gauge
-- engagement so that i can see whats wrong and what gts peopel to log out and never come back".
--
-- What is kept: per signed-in member, the session (a random id per page load), its start, a heartbeat every few
-- minutes while the tab shows, its end, each funnel step reached and each feature's first use, with the screen the
-- player was on. Ids from one list in code (web/lib/analytics/steps.ts), never free text, never personal data.
-- Written only by the server route (service role) after it checks the session; members can't read or write it.
-- Rows go after 180 days (game_events_prune, daily through pg_cron where it exists).
-- Rollback: select cron.unschedule('game-events-prune'); drop function game_analytics_snapshot(timestamptz);
--   drop function game_events_prune(integer); drop table game_events;

CREATE TABLE IF NOT EXISTS public.game_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('session_start', 'heartbeat', 'session_end', 'step', 'feature')),
  step TEXT CHECK (step ~ '^[a-z0-9_]{1,40}$'),
  screen TEXT CHECK (screen ~ '^[a-z0-9_]{1,24}$'),
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((kind IN ('step', 'feature')) = (step IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS game_events_member_at ON public.game_events (member_id, at);
CREATE INDEX IF NOT EXISTS game_events_at ON public.game_events (at);
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_events FROM PUBLIC, anon, authenticated;

-- ─── game_events_prune: the 180-day limit, bounded ──────────────────────────
CREATE OR REPLACE FUNCTION public.game_events_prune(p_limit INTEGER DEFAULT 50000)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n INTEGER;
BEGIN
  DELETE FROM game_events WHERE id IN (
    SELECT id FROM game_events WHERE at < NOW() - INTERVAL '180 days'
     ORDER BY at LIMIT LEAST(GREATEST(COALESCE(p_limit, 50000), 1), 200000));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.game_events_prune(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.game_events_prune(INTEGER) TO service_role;

-- Daily at 08:47 UTC, where pg_cron exists (Supabase; not the throwaway smoke Postgres).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('game-events-prune', '47 8 * * *', 'SELECT public.game_events_prune()');
  END IF;
END $$;

-- ─── game_analytics_snapshot: what the admin page adds up (web/lib/analytics/report.ts) ──────────────────
-- One read for the page, server only (the route checks T1/T2 first). World names only: no real name, no email.
-- Players: accounts that are members, or have played (the log, or the arrival paid). Steps are all time (the furthest
-- a player got), the rest from p_since. History from before the log comes from the game's own tables.
CREATE OR REPLACE FUNCTION public.game_analytics_snapshot(p_since TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH players AS (
    SELECT p.id, i.world_name AS name, p.created_at AS joined, p.avatar_config, i.name_set_at
      FROM profiles p LEFT JOIN member_identity i ON i.member_id = p.id
     WHERE p.membership = 'member'
        OR EXISTS (SELECT 1 FROM game_events e WHERE e.member_id = p.id)
        OR EXISTS (SELECT 1 FROM wallet_ledger l WHERE l.member_id = p.id AND l.source = 'quest' AND l.ref = 'arrival')
  ),
  act AS (
    SELECT member_id AS m, at FROM game_events WHERE at >= p_since
    UNION ALL SELECT member_id, created_at FROM wallet_ledger WHERE created_at >= p_since
    UNION ALL SELECT member_id, claimed_at FROM daily_login_claims WHERE claimed_at >= p_since
    UNION ALL SELECT member_id, created_at FROM craft_log WHERE created_at >= p_since
    UNION ALL SELECT member_id, killed_at FROM combat_kills WHERE killed_at >= p_since
    UNION ALL SELECT member_id, started_at FROM study_sessions WHERE started_at >= p_since
    UNION ALL SELECT member_id, created_at FROM world_chat_messages WHERE created_at >= p_since
    UNION ALL SELECT member_id, handed_at FROM museum_handins WHERE handed_at >= p_since
    UNION ALL SELECT member_id, started_at FROM volleyball_casual_tickets WHERE started_at >= p_since
    UNION ALL SELECT member_id, created_at FROM sushi_orders WHERE created_at >= p_since
    UNION ALL SELECT member_id, created_at FROM chef_order_fills WHERE created_at >= p_since
    UNION ALL SELECT member_id, created_at FROM fishing_task_claims WHERE created_at >= p_since
  ),
  steps AS (
    SELECT member_id AS m, step AS s, MIN(at) AS at FROM game_events WHERE kind = 'step' GROUP BY 1, 2
    UNION ALL SELECT id, 'creator', name_set_at FROM players WHERE avatar_config ? 'look'
    UNION ALL SELECT member_id, 'arrived', MIN(created_at) FROM wallet_ledger WHERE source = 'quest' AND ref = 'arrival' GROUP BY 1
    UNION ALL SELECT member_id, 'first_sale', MIN(created_at) FROM wallet_ledger WHERE source = 'sell' GROUP BY 1
    UNION ALL SELECT c.user_id, 'first_catch', MIN(c.first_collected_at) FROM member_collections c
                JOIN collection_species s ON s.key = c.item_key AND s.category IN ('fish', 'sea') GROUP BY 1
    UNION ALL SELECT member_id, 'first_quest', MIN(completed_at) FROM member_quest_progress
               WHERE status = 'completed' AND completed_at IS NOT NULL GROUP BY 1
  ),
  sessions AS (
    SELECT member_id AS m, MIN(at) AS start, MAX(at) AS "end",
           (ARRAY_AGG(step ORDER BY at DESC) FILTER (WHERE kind = 'step'))[1] AS last_step,
           (ARRAY_AGG(screen ORDER BY at DESC) FILTER (WHERE screen IS NOT NULL))[1] AS screen
      FROM game_events WHERE at >= p_since GROUP BY member_id, session_id
  ),
  uses AS (
    SELECT member_id AS m, step AS f, at::date AS d FROM game_events WHERE kind = 'feature' AND at >= p_since
    UNION SELECT member_id, CASE source WHEN 'sell' THEN 'selling' WHEN 'shop' THEN 'shop' WHEN 'daily_gift' THEN 'daily_gift'
             WHEN 'dig' THEN 'digging' WHEN 'friend' THEN 'residents' WHEN 'volleyball' THEN 'volleyball' WHEN 'campfire' THEN 'campfire'
             WHEN 'mission' THEN 'missions' WHEN 'study' THEN 'study' WHEN 'chapter' THEN 'quests' END, created_at::date
            FROM wallet_ledger WHERE created_at >= p_since
             AND source IN ('sell', 'shop', 'daily_gift', 'dig', 'friend', 'volleyball', 'campfire', 'mission', 'study', 'chapter')
    UNION SELECT member_id, 'crafting', created_at::date FROM craft_log WHERE created_at >= p_since
    UNION SELECT member_id, 'combat', killed_at::date FROM combat_kills WHERE killed_at >= p_since
    UNION SELECT member_id, 'chat', created_at::date FROM world_chat_messages WHERE created_at >= p_since
    UNION SELECT member_id, 'museum', handed_at::date FROM museum_handins WHERE handed_at >= p_since
    UNION SELECT member_id, 'sushi', created_at::date FROM sushi_orders WHERE created_at >= p_since
    UNION SELECT member_id, 'chef', created_at::date FROM chef_order_fills WHERE created_at >= p_since
    UNION SELECT member_id, 'fish_tasks', created_at::date FROM fishing_task_claims WHERE created_at >= p_since
  )
  SELECT jsonb_build_object(
    'players', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'joined', p.joined, 'last', l.at))
                 FROM players p LEFT JOIN (SELECT m, MAX(at) AS at FROM act GROUP BY m) l ON l.m = p.id), '[]'),
    'steps', COALESCE((SELECT jsonb_agg(jsonb_build_object('m', s.m, 's', s.s, 'at', s.at)) FROM steps s WHERE s.m IN (SELECT id FROM players)), '[]'),
    'sessions', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM sessions x WHERE x.m IN (SELECT id FROM players)), '[]'),
    'uses', COALESCE((SELECT jsonb_agg(to_jsonb(u)) FROM uses u WHERE u.m IN (SELECT id FROM players)), '[]'),
    'days', COALESCE((SELECT jsonb_agg(jsonb_build_object('m', d.m, 'd', d.d)) FROM (SELECT DISTINCT m, at::date AS d FROM act) d
                       WHERE d.m IN (SELECT id FROM players)), '[]'));
$$;
REVOKE ALL ON FUNCTION public.game_analytics_snapshot(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.game_analytics_snapshot(TIMESTAMPTZ) TO service_role;
