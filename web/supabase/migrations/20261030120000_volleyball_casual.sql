-- ─── Beach volleyball: a few coins for a casual win (game/volleyball) ───────
--
-- Spec: specs/minigames/beach-volleyball.md ("Match and rewards"; David 2026-10-30: "casual win is just like chill
-- coins, ranked gets better rewards"). Phase 1's match runs in the player's browser, so the server can't see the
-- rally. It never takes the client's word for a payout: a match opens a server ticket
-- (volleyball_casual_start), and its claim (volleyball_casual_finish) pays only for a legal finished set (21 or more,
-- won by 2) that the caller's team won, no sooner than a floor of seconds per point played since the ticket opened,
-- once per ticket (wallet_apply's idempotency key), within a daily cap of paid wins. A loss, a capped win or a refused
-- claim is recorded with nothing paid, and closes the ticket for good. Both functions are service-role only
-- (/api/volleyball/start and /finish call them); members read their own tickets.
--
-- Phase 3 (ranked) adds volleyball_matches and volleyball_ratings beside this table; ranked rewards (gems, the
-- Beach ball rod) are theirs, not this one's.

-- The ledger's sources: the union of whatever the list holds now (other lanes rewrite it too) and 'volleyball'.
DO $$
DECLARE v_vals TEXT[];
BEGIN
  SELECT array_agg(DISTINCT m[1]) INTO v_vals
  FROM pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') m
  WHERE c.conname = 'wallet_ledger_source_check' AND c.conrelid = 'public.wallet_ledger'::regclass;
  v_vals := ARRAY(SELECT DISTINCT v FROM unnest(COALESCE(v_vals, '{}') || ARRAY['volleyball']) v ORDER BY v);
  ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_source_check;
  EXECUTE format('ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_source_check CHECK (source IN (%s))',
    (SELECT string_agg(quote_literal(v), ', ') FROM unnest(v_vals) v));
END $$;

INSERT INTO economy_settings (key, value) VALUES
  ('volleyball_casual_win_coins', 15),   -- a casual win: about one uncommon fish, a little over the daily gift
  ('volleyball_casual_daily_wins', 5),   -- paid wins a Toronto day; more still count, for nothing
  ('volleyball_casual_s_per_point', 3)   -- the claim's floor: bot against bot plays about 9.5 s a point
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS volleyball_casual_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seed INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  home_points SMALLINT,
  away_points SMALLINT,
  -- open: playing; won: paid; lost; capped: won over the daily cap; too_fast, bad_score: refused claims;
  -- abandoned: a newer match opened; expired: claimed after the ticket's 2 hours.
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'capped', 'too_fast', 'bad_score', 'abandoned', 'expired')),
  paid INTEGER NOT NULL DEFAULT 0 CHECK (paid >= 0)
);
CREATE INDEX IF NOT EXISTS volleyball_casual_tickets_member ON volleyball_casual_tickets (member_id, status, finished_at);
ALTER TABLE volleyball_casual_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own volleyball tickets readable" ON volleyball_casual_tickets;
CREATE POLICY "Own volleyball tickets readable" ON volleyball_casual_tickets FOR SELECT USING (member_id = (select auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON volleyball_casual_tickets FROM anon, authenticated;

-- A match starts: a fresh ticket; any ticket still open for this member is abandoned (one match at a time).
CREATE OR REPLACE FUNCTION public.volleyball_casual_start(p_member_id UUID)
RETURNS TABLE (ticket UUID, seed INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE v_id UUID; v_seed INTEGER := floor(random() * 100000)::INTEGER;
BEGIN
  UPDATE volleyball_casual_tickets t SET status = 'abandoned', finished_at = NOW() WHERE t.member_id = p_member_id AND t.status = 'open';
  INSERT INTO volleyball_casual_tickets (member_id, seed) VALUES (p_member_id, v_seed) RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, v_seed;
END;
$$;

-- A match ends: checked, recorded once, paid once. A second claim on the same ticket returns the first's outcome.
CREATE OR REPLACE FUNCTION public.volleyball_casual_finish(p_member_id UUID, p_ticket UUID, p_home INTEGER, p_away INTEGER)
RETURNS TABLE (status TEXT, paid INTEGER, balance INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  t volleyball_casual_tickets%ROWTYPE;
  v_day DATE := (NOW() AT TIME ZONE 'America/Toronto')::DATE;
  v_coins INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'volleyball_casual_win_coins'), 15);
  v_cap INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'volleyball_casual_daily_wins'), 5);
  v_floor INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'volleyball_casual_s_per_point'), 3);
  v_status TEXT; v_paid INTEGER := 0; v_bal INTEGER;
BEGIN
  SELECT * INTO t FROM volleyball_casual_tickets x WHERE x.id = p_ticket FOR UPDATE;
  IF NOT FOUND OR t.member_id <> p_member_id THEN RAISE EXCEPTION 'not_found'; END IF;
  v_bal := COALESCE((SELECT w.coins FROM wallets w WHERE w.member_id = p_member_id), 0);
  IF t.status <> 'open' THEN
    RETURN QUERY SELECT t.status, t.paid, v_bal, TRUE; RETURN;
  END IF;
  IF t.started_at < NOW() - INTERVAL '2 hours' THEN v_status := 'expired';
  -- One set to 21, won by 2: over 21 only by exactly 2.
  ELSIF p_home IS NULL OR p_away IS NULL OR LEAST(p_home, p_away) < 0 OR GREATEST(p_home, p_away) > 99
     OR GREATEST(p_home, p_away) < 21 OR ABS(p_home - p_away) < 2 OR (GREATEST(p_home, p_away) > 21 AND ABS(p_home - p_away) <> 2) THEN v_status := 'bad_score';
  ELSIF NOW() - t.started_at < make_interval(secs => v_floor * (p_home + p_away)) THEN v_status := 'too_fast';
  ELSIF p_home < p_away THEN v_status := 'lost';
  ELSIF (SELECT COUNT(*) FROM volleyball_casual_tickets x WHERE x.member_id = p_member_id AND x.status = 'won'
           AND (x.finished_at AT TIME ZONE 'America/Toronto')::DATE = v_day) >= v_cap THEN v_status := 'capped';
  ELSE
    v_status := 'won'; v_paid := v_coins;
    SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', v_coins, 'volleyball', p_ticket::TEXT, 'volleyball:casual:' || p_ticket) a;
  END IF;
  UPDATE volleyball_casual_tickets x SET status = v_status, paid = v_paid, finished_at = NOW(),
    home_points = CASE WHEN v_status = 'bad_score' THEN NULL ELSE p_home END, away_points = CASE WHEN v_status = 'bad_score' THEN NULL ELSE p_away END
  WHERE x.id = p_ticket;
  RETURN QUERY SELECT v_status, v_paid, v_bal, FALSE;
END;
$$;

DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.volleyball_casual_start(UUID) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.volleyball_casual_start(UUID) TO service_role;
  REVOKE ALL ON FUNCTION public.volleyball_casual_finish(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.volleyball_casual_finish(UUID, UUID, INTEGER, INTEGER) TO service_role;
END $$;
