-- ─── 032 Study: tables, Pomodoro sessions, settlement, weekly stats ──────────
--
-- DRAFT 2026-09-24. NOT APPLIED. Spec: specs/study.md (rows S1, 72-81, 126,
-- 164-171, 214). Depends on 001 (profiles); coins are paid through
-- public.wallet_apply() from 20260926150600_economy.sql (apply 029-033 as one batch).
--
-- Phases are derived server-side from timestamps (web/lib/study/rules.ts):
-- every /api/study call replays wall-clock time, so a session moves from
-- focus to break, finishes, or times out after the 5-minute grace without a
-- client telling it to. Clients never report minutes. Members read their own
-- rows; the service role writes (seat claims, transitions with an optimistic
-- `version`, and the one idempotent coin settlement per session).

CREATE TABLE IF NOT EXISTS study_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,64}$'),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  location TEXT NOT NULL,                 -- cafe | outdoor-plaza | outdoor-pier ...
  anchor TEXT NOT NULL,                   -- world anchor for seat props (island agent)
  kind TEXT NOT NULL CHECK (kind IN ('window', 'two', 'four', 'couch', 'outdoor')),
  seats INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 8),
  host_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- first sitter (row 168)
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  allowed UUID[] NOT NULL DEFAULT '{}',   -- let in by the host while locked
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (NOT is_private OR host_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES study_tables(id) ON DELETE CASCADE,
  seat INTEGER NOT NULL CHECK (seat BETWEEN 1 AND 8),
  focus_len INTEGER CHECK (focus_len BETWEEN 5 AND 90),
  break_len INTEGER CHECK (break_len BETWEEN 1 AND 30),
  cycles INTEGER CHECK (cycles BETWEEN 1 AND 8),
  phase TEXT NOT NULL DEFAULT 'seated' CHECK (phase IN ('seated', 'focus', 'break', 'ended')),
  cycle_index INTEGER NOT NULL DEFAULT 0 CHECK (cycle_index >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  phase_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT CHECK (end_reason IN ('left', 'finished', 'timeout')),
  minutes_completed INTEGER NOT NULL DEFAULT 0 CHECK (minutes_completed >= 0),
  blocks_completed INTEGER NOT NULL DEFAULT 0 CHECK (blocks_completed >= 0),
  bonus_earned INTEGER NOT NULL DEFAULT 0 CHECK (bonus_earned >= 0),
  longest_block INTEGER NOT NULL DEFAULT 0 CHECK (longest_block >= 0),
  coins_paid INTEGER,
  settled_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 0,
  CHECK ((phase = 'ended') = (ended_at IS NOT NULL)),
  CHECK (phase = 'seated' OR phase = 'ended' OR focus_len IS NOT NULL),
  CHECK (settled_at IS NULL OR ended_at IS NOT NULL)
);

-- One seat, one sitter; one active session per member (rows 80, 168).
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_seat_taken ON study_sessions (table_id, seat) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_member_active ON study_sessions (member_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_study_unsettled ON study_sessions (member_id) WHERE ended_at IS NOT NULL AND settled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_study_ended ON study_sessions (ended_at);

CREATE TABLE IF NOT EXISTS member_study_prefs (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  board_opt_in BOOLEAN NOT NULL DEFAULT FALSE,  -- row 171: no forced ranking
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly totals (Monday, America/Toronto), by the week a session ended.
CREATE OR REPLACE VIEW study_weekly_stats AS
SELECT member_id,
       (date_trunc('week', ended_at AT TIME ZONE 'America/Toronto'))::DATE AS week_start,
       SUM(minutes_completed)::INTEGER AS minutes,
       MAX(longest_block)::INTEGER AS longest_block,
       COUNT(*)::INTEGER AS sessions
  FROM study_sessions
 WHERE ended_at IS NOT NULL
 GROUP BY member_id, week_start;
REVOKE ALL ON study_weekly_stats FROM anon, authenticated;
GRANT SELECT ON study_weekly_stats TO service_role;

ALTER TABLE study_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Study tables readable by authenticated" ON study_tables
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND active = TRUE);
CREATE POLICY "Study tables writable by T1/T2" ON study_tables
  FOR ALL USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2))
  WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Study sessions readable by owner" ON study_sessions
  FOR SELECT USING (member_id = (select auth.uid()));
ALTER TABLE member_study_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Study prefs readable by owner" ON member_study_prefs
  FOR SELECT USING (member_id = (select auth.uid()));

-- ─── Table chat (row 77): text only, seated members, muted during focus by default (client) ─
CREATE TABLE IF NOT EXISTS study_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES study_tables(id) ON DELETE CASCADE,
  member_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  reported BOOLEAN NOT NULL DEFAULT FALSE,
  reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reported_reason TEXT CHECK (reported_reason IS NULL OR char_length(reported_reason) <= 200),
  reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_study_chat_table ON study_chat_messages (table_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_chat_member ON study_chat_messages (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_chat_reported ON study_chat_messages (reported_at DESC) WHERE reported;
ALTER TABLE study_chat_messages ENABLE ROW LEVEL SECURITY;
-- Reads/writes go through /api/study/chat (service role checks the seat); T1/T2 moderate.
CREATE POLICY "Study chat reported readable by T1/T2" ON study_chat_messages
  FOR SELECT USING (reported AND (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Study chat moderatable by T1/T2" ON study_chat_messages
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- ─── Settlement: once per session, coins = minutes + bonus ───────────────────
-- Re-checks that the credited minutes fit inside the session's wall-clock
-- span and the bonus inside the completed blocks, so a bad write can't mint.
CREATE OR REPLACE FUNCTION public.study_settle(p_session_id UUID, p_member_id UUID)
RETURNS TABLE (coins INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  s study_sessions%ROWTYPE;
  v_coins INTEGER;
BEGIN
  SELECT * INTO s FROM study_sessions WHERE id = p_session_id AND member_id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF s.ended_at IS NULL THEN RAISE EXCEPTION 'not_ended'; END IF;
  IF s.settled_at IS NOT NULL THEN
    RETURN QUERY SELECT s.coins_paid, TRUE; RETURN;
  END IF;
  IF s.minutes_completed > CEIL(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60.0)
     OR s.bonus_earned > s.blocks_completed * ROUND(10.0 * COALESCE(s.focus_len, 0) / 25.0) THEN
    RAISE EXCEPTION 'implausible';
  END IF;
  v_coins := s.minutes_completed + s.bonus_earned;
  UPDATE study_sessions SET coins_paid = v_coins, settled_at = NOW() WHERE id = p_session_id;
  IF v_coins > 0 THEN
    -- Single wallet path (20260926150600_economy.sql), idempotent per session.
    PERFORM public.wallet_apply(p_member_id, 'coins', v_coins, 'study', p_session_id::TEXT, 'study:' || p_session_id);
  END IF;
  RETURN QUERY SELECT v_coins, FALSE;
END;
$$;
REVOKE ALL ON FUNCTION public.study_settle(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.study_settle(UUID, UUID) TO service_role;

-- ─── Seed: starter tables (mirrors web/lib/study/tables.ts) ─────────────────
INSERT INTO study_tables (id, slug, label, location, anchor, kind, seats, position) VALUES
  ('00000000-0000-4000-8000-000000005101', 'cafe-window-1', 'Window seat 1', 'cafe', 'study:cafe-window-1', 'window', 2, 1),
  ('00000000-0000-4000-8000-000000005102', 'cafe-window-2', 'Window seat 2', 'cafe', 'study:cafe-window-2', 'window', 2, 2),
  ('00000000-0000-4000-8000-000000005103', 'cafe-two-1', 'Table for two', 'cafe', 'study:cafe-two-1', 'two', 2, 3),
  ('00000000-0000-4000-8000-000000005104', 'cafe-two-2', 'Corner table for two', 'cafe', 'study:cafe-two-2', 'two', 2, 4),
  ('00000000-0000-4000-8000-000000005105', 'cafe-four-1', 'Big table', 'cafe', 'study:cafe-four-1', 'four', 4, 5),
  ('00000000-0000-4000-8000-000000005106', 'cafe-four-2', 'Bookshelf table', 'cafe', 'study:cafe-four-2', 'four', 4, 6),
  ('00000000-0000-4000-8000-000000005107', 'cafe-couch', 'Couch corner', 'cafe', 'study:cafe-couch', 'couch', 3, 7),
  ('00000000-0000-4000-8000-000000005108', 'plaza-picnic', 'Plaza picnic table', 'outdoor-plaza', 'study:plaza-picnic', 'outdoor', 4, 8),
  ('00000000-0000-4000-8000-000000005109', 'pier-bench', 'Pier table', 'outdoor-pier', 'study:pier-bench', 'outdoor', 2, 9)
ON CONFLICT (slug) DO NOTHING;
