-- ─── 029 Progression: main quest chapters, club goals, contributions, letters ──
--
-- DRAFT 2026-09-24. NOT APPLIED. Do not apply outside the launch batch.
-- Spec: specs/progression-systems.md (ledger rows 33, 46, 48, 93, 95, 96,
-- 101, 102, 120, 177-184).
--
-- Depends on: 001 (profiles, events, event_attendance, bounty_claims),
-- 014/015 (content_drafts/content_versions for admin versioning),
-- 023 (member_collections). Coin debits call public.wallet_apply() from
-- 033_economy.sql (resolved at run time; apply 029-033 as one batch).
--
-- Write model: members never write these tables directly. Every write goes
-- through /api/progression/* with the service role after the server has
-- validated the request. RLS below only grants reads (own rows, or active
-- authored content) plus T1/T2 authoring on the two content tables, matching
-- the content-pipeline tables in 014/019.
--
-- Real club activity is NOT re-tracked here: event credit reads
-- event_attendance (status = 'attended') and bounty credit reads
-- bounty_claims (status = 'completed'). club_goal_contributions only records
-- the credit that was granted for them (ref_id = the source row id), which
-- is what makes crediting idempotent.
--
-- Data policy (row 48): everything in this file is prototype gameplay and
-- may be reset at launch. It holds no real-value balances.

-- ─── Authored content ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS club_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,64}$'),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  summary TEXT NOT NULL DEFAULT '' CHECK (char_length(summary) <= 500),
  goal_type TEXT NOT NULL CHECK (goal_type IN ('story', 'seasonal')),
  target_points INTEGER NOT NULL CHECK (target_points BETWEEN 1 AND 10000000),
  -- Points per unit, per source. Real activity is weighted higher by default.
  weights JSONB NOT NULL DEFAULT
    '{"coins":1,"material":20,"specimen":100,"event":500,"bounty":750,"admin":1}'::jsonb,
  -- Per-member caps (points per goal cycle). delivery = in-game deliveries only.
  caps JSONB NOT NULL DEFAULT '{"member_total":3000,"delivery":1500}'::jsonb,
  -- Which in-game delivery kinds this goal accepts at the monument/HQ.
  accepts TEXT[] NOT NULL DEFAULT '{coins}'
    CHECK (accepts <@ ARRAY['coins', 'material', 'specimen']::TEXT[]),
  -- Story: optional open/close. Seasonal: required; repeats yearly on the
  -- same month/day (cycle = the year the window opened).
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  unlocks TEXT[] NOT NULL DEFAULT '{}',
  monument_key TEXT NOT NULL DEFAULT 'plaza' CHECK (monument_key ~ '^[a-z0-9_-]{1,32}$'),
  completion_letter_subject TEXT NOT NULL DEFAULT '' CHECK (char_length(completion_letter_subject) <= 120),
  completion_letter_body TEXT NOT NULL DEFAULT '' CHECK (char_length(completion_letter_body) <= 2000),
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (window_end IS NULL OR window_start IS NULL OR window_end > window_start),
  CHECK (goal_type = 'story' OR (window_start IS NOT NULL AND window_end IS NOT NULL)),
  CHECK (jsonb_typeof(weights) = 'object' AND jsonb_typeof(caps) = 'object')
);

CREATE TABLE IF NOT EXISTS quest_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,64}$'),
  position INTEGER NOT NULL UNIQUE CHECK (position BETWEEN 1 AND 50),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  summary TEXT NOT NULL DEFAULT '' CHECK (char_length(summary) <= 500),
  -- The condition set is code (server-validated); admins edit copy, order,
  -- regions and the goal a club_goal chapter points at.
  requirement TEXT NOT NULL CHECK (requirement IN ('settle_in', 'club_goal', 'oracle_trial')),
  goal_slug TEXT REFERENCES club_goals(slug) ON UPDATE CASCADE ON DELETE SET NULL,
  step_copy JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(step_copy) = 'object'),
  unlocks_regions TEXT[] NOT NULL DEFAULT '{}',
  completion_letter TEXT NOT NULL DEFAULT '' CHECK (char_length(completion_letter) <= 2000),
  -- Highest tier number allowed to skip in one click (5 = everyone); 0 = none.
  skippable_max_tier INTEGER NOT NULL DEFAULT 3 CHECK (skippable_max_tier BETWEEN 0 AND 5),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (requirement <> 'club_goal' OR goal_slug IS NOT NULL)
);

-- ─── Per-member quest state ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS member_quest_progress (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES quest_chapters(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'skipped')),
  steps_done JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(steps_done) = 'object'),
  donated_item_key TEXT CHECK (donated_item_key IS NULL OR char_length(donated_item_key) BETWEEN 1 AND 64),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS member_quest_prefs (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- Design principle 7: anyone can hide the objective line.
  hud_muted BOOLEAN NOT NULL DEFAULT FALSE,
  -- Placeholder until the level-10 family trial exists (row 22/179). Only the
  -- service role writes it (future trial route or an admin grant).
  family_trial_completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Club goal ledger ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS club_goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES club_goals(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL DEFAULT 0,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('delivery', 'event', 'bounty', 'admin')),
  kind TEXT CHECK (kind IN ('coins', 'material', 'specimen')),
  item_key TEXT CHECK (item_key IS NULL OR char_length(item_key) BETWEEN 1 AND 64),
  amount INTEGER NOT NULL CHECK (amount > 0),          -- units offered
  amount_used INTEGER NOT NULL CHECK (amount_used >= 0), -- units consumed (capped deliveries use less)
  weight NUMERIC(10, 3) NOT NULL CHECK (weight >= 0),   -- snapshot of the admin weight at credit time
  credited_points INTEGER NOT NULL CHECK (credited_points >= 0),
  capped BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 128),
  ref_id UUID,                                          -- event_attendance.id / bounty_claims.id
  note TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((source = 'delivery') = (kind IS NOT NULL)),
  CHECK (source NOT IN ('event', 'bounty') OR ref_id IS NOT NULL),
  UNIQUE (member_id, idempotency_key)
);

-- One credit per real-activity record per goal cycle.
CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_contrib_ref_once
  ON club_goal_contributions (goal_id, cycle, source, ref_id)
  WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goal_contrib_goal ON club_goal_contributions (goal_id, cycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_contrib_member ON club_goal_contributions (member_id, created_at DESC);

-- Running per-member totals: the cap ledger. Locked row-wise on every credit.
CREATE TABLE IF NOT EXISTS club_goal_member_totals (
  goal_id UUID NOT NULL REFERENCES club_goals(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL DEFAULT 0,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credited_points INTEGER NOT NULL DEFAULT 0 CHECK (credited_points >= 0),
  delivery_points INTEGER NOT NULL DEFAULT 0 CHECK (delivery_points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (goal_id, cycle, member_id)
);

CREATE TABLE IF NOT EXISTS club_goal_completions (
  goal_id UUID NOT NULL REFERENCES club_goals(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (goal_id, cycle)
);

-- ─── Letters (row 95: letters/notes only, no item transfer) ──────────────────

CREATE TABLE IF NOT EXISTS letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('system', 'note')),
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = system
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '' CHECK (char_length(subject) <= 120),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  -- Broadcasts fan out one row per member; broadcast_key dedupes the fan-out.
  broadcast_key TEXT CHECK (broadcast_key IS NULL OR char_length(broadcast_key) <= 128),
  read_at TIMESTAMPTZ,
  reported BOOLEAN NOT NULL DEFAULT FALSE,
  reported_reason TEXT CHECK (reported_reason IS NULL OR char_length(reported_reason) <= 200),
  reported_at TIMESTAMPTZ,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (kind = 'system' OR (sender_id IS NOT NULL AND char_length(body) <= 500))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_letters_broadcast_once
  ON letters (broadcast_key, recipient_id) WHERE broadcast_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_letters_recipient ON letters (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_letters_sender_recent ON letters (sender_id, created_at DESC) WHERE sender_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_letters_reported ON letters (reported_at DESC) WHERE reported;

-- ─── updated_at triggers (function from 014) ─────────────────────────────────

DROP TRIGGER IF EXISTS trg_club_goals_updated_at ON club_goals;
CREATE TRIGGER trg_club_goals_updated_at BEFORE UPDATE ON club_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_quest_chapters_updated_at ON quest_chapters;
CREATE TRIGGER trg_quest_chapters_updated_at BEFORE UPDATE ON quest_chapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE club_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club goals readable when active" ON club_goals
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND active = TRUE);
CREATE POLICY "Club goals readable by T1/T2 (all rows)" ON club_goals
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Club goals insertable by T1/T2" ON club_goals
  FOR INSERT WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Club goals updatable by T1/T2" ON club_goals
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Club goals deletable by T1/T2" ON club_goals
  FOR DELETE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

ALTER TABLE quest_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quest chapters readable when active" ON quest_chapters
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND active = TRUE);
CREATE POLICY "Quest chapters readable by T1/T2 (all rows)" ON quest_chapters
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Quest chapters insertable by T1/T2" ON quest_chapters
  FOR INSERT WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Quest chapters updatable by T1/T2" ON quest_chapters
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Quest chapters deletable by T1/T2" ON quest_chapters
  FOR DELETE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- Own-row reads only; no member write policies (service role writes).
ALTER TABLE member_quest_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quest progress readable by owner or T1/T2" ON member_quest_progress
  FOR SELECT USING (
    member_id = (select auth.uid())
    OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2)
  );

ALTER TABLE member_quest_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quest prefs readable by owner" ON member_quest_prefs
  FOR SELECT USING (member_id = (select auth.uid()));

-- Per-member contribution rows stay private (leaderboard privacy, principle 6).
ALTER TABLE club_goal_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Goal contributions readable by owner or T1/T2" ON club_goal_contributions
  FOR SELECT USING (
    member_id = (select auth.uid())
    OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2)
  );

ALTER TABLE club_goal_member_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Goal member totals readable by owner or T1/T2" ON club_goal_member_totals
  FOR SELECT USING (
    member_id = (select auth.uid())
    OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2)
  );

ALTER TABLE club_goal_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Goal completions readable by authenticated" ON club_goal_completions
  FOR SELECT USING ((select auth.role()) = 'authenticated');

ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Letters readable by recipient or sender" ON letters
  FOR SELECT USING (
    (recipient_id = (select auth.uid()) AND hidden = FALSE)
    OR sender_id = (select auth.uid())
  );
CREATE POLICY "Reported letters readable by T1/T2" ON letters
  FOR SELECT USING (
    reported = TRUE AND (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2)
  );
CREATE POLICY "Letters moderatable by T1/T2" ON letters
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- ─── Atomic credit ───────────────────────────────────────────────────────────
-- The route plans the credit (weights, caps) from server-read goal config;
-- this function re-enforces the invariants inside one transaction:
--   * idempotency: a replayed (member, key) returns the original row;
--   * caps: the member-total row is locked and re-checked;
--   * payment: coins / collection items are debited only when the credit
--     lands, and never below zero.
-- Service role only: members cannot call it with their own numbers.

CREATE OR REPLACE FUNCTION public.progression_commit_contribution(
  p_goal_id UUID,
  p_cycle INTEGER,
  p_member_id UUID,
  p_source TEXT,
  p_kind TEXT,
  p_item_key TEXT,
  p_amount INTEGER,
  p_amount_used INTEGER,
  p_weight NUMERIC,
  p_credited INTEGER,
  p_capped BOOLEAN,
  p_member_cap INTEGER,     -- NULL = uncapped (admin credits)
  p_delivery_cap INTEGER,   -- NULL = not a delivery
  p_idempotency_key TEXT,
  p_ref_id UUID,
  p_note TEXT,
  p_created_by UUID
)
RETURNS TABLE (contribution_id UUID, replayed BOOLEAN, credited_points INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_existing club_goal_contributions%ROWTYPE;
  v_total club_goal_member_totals%ROWTYPE;
  v_id UUID;
BEGIN
  SELECT * INTO v_existing FROM club_goal_contributions c
   WHERE c.member_id = p_member_id AND c.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, TRUE, v_existing.credited_points;
    RETURN;
  END IF;

  IF p_ref_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM club_goal_contributions c
     WHERE c.goal_id = p_goal_id AND c.cycle = p_cycle AND c.source = p_source AND c.ref_id = p_ref_id;
    IF FOUND THEN
      RETURN QUERY SELECT v_existing.id, TRUE, v_existing.credited_points;
      RETURN;
    END IF;
  END IF;

  IF p_credited < 0 OR p_amount_used < 0 OR p_amount_used > p_amount THEN
    RAISE EXCEPTION 'invalid_credit';
  END IF;

  INSERT INTO club_goal_member_totals (goal_id, cycle, member_id)
  VALUES (p_goal_id, p_cycle, p_member_id)
  ON CONFLICT DO NOTHING;
  SELECT * INTO v_total FROM club_goal_member_totals t
   WHERE t.goal_id = p_goal_id AND t.cycle = p_cycle AND t.member_id = p_member_id
   FOR UPDATE;

  IF p_member_cap IS NOT NULL AND v_total.credited_points + p_credited > p_member_cap THEN
    RAISE EXCEPTION 'cap_exceeded';
  END IF;
  IF p_delivery_cap IS NOT NULL AND v_total.delivery_points + p_credited > p_delivery_cap THEN
    RAISE EXCEPTION 'cap_exceeded';
  END IF;

  IF p_source = 'delivery' AND p_amount_used > 0 THEN
    IF p_kind = 'coins' THEN
      -- Single wallet path (033_economy.sql): raises 'insufficient', idempotent per key.
      PERFORM public.wallet_apply(p_member_id, 'coins', -p_amount_used, 'goal', p_goal_id::TEXT, 'goal:' || p_idempotency_key);
    ELSE
      UPDATE member_collections SET count = count - p_amount_used, updated_at = NOW()
       WHERE user_id = p_member_id AND item_key = p_item_key AND count >= p_amount_used;
      IF NOT FOUND THEN RAISE EXCEPTION 'insufficient'; END IF;
    END IF;
  END IF;

  INSERT INTO club_goal_contributions (
    goal_id, cycle, member_id, source, kind, item_key, amount, amount_used,
    weight, credited_points, capped, idempotency_key, ref_id, note, created_by
  ) VALUES (
    p_goal_id, p_cycle, p_member_id, p_source, p_kind, p_item_key, p_amount, p_amount_used,
    p_weight, p_credited, p_capped, p_idempotency_key, p_ref_id, p_note, p_created_by
  ) RETURNING id INTO v_id;

  UPDATE club_goal_member_totals t
     SET credited_points = t.credited_points + p_credited,
         delivery_points = t.delivery_points + CASE WHEN p_source = 'delivery' THEN p_credited ELSE 0 END,
         updated_at = NOW()
   WHERE t.goal_id = p_goal_id AND t.cycle = p_cycle AND t.member_id = p_member_id;

  RETURN QUERY SELECT v_id, FALSE, p_credited;
END;
$$;

REVOKE ALL ON FUNCTION public.progression_commit_contribution(
  UUID, INTEGER, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, INTEGER, BOOLEAN,
  INTEGER, INTEGER, TEXT, UUID, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.progression_commit_contribution(
  UUID, INTEGER, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, INTEGER, BOOLEAN,
  INTEGER, INTEGER, TEXT, UUID, TEXT, UUID
) TO service_role;

-- Club-wide progress without exposing per-member rows.
CREATE OR REPLACE VIEW club_goal_progress
WITH (security_invoker = false) AS
SELECT goal_id, cycle, COALESCE(SUM(credited_points), 0)::INTEGER AS points,
       COUNT(*)::INTEGER AS contributors
  FROM club_goal_member_totals
 GROUP BY goal_id, cycle;
REVOKE ALL ON club_goal_progress FROM anon;
GRANT SELECT ON club_goal_progress TO authenticated, service_role;

-- ─── Seed (mirrors web/lib/progression/defaults.ts) ─────────────────────────
-- Targets per row 181: ~30 event check-ins (30 × 500) or ~15,000 coins.

INSERT INTO club_goals (slug, title, summary, goal_type, target_points, accepts, unlocks, monument_key,
                        completion_letter_subject, completion_letter_body, position) VALUES
  ('reopen-cafe', 'Reopen the cafe',
   'The old cafe by the plaza has been boarded up for years. Bring coins and building materials to the monument, and come to club events: every check-in counts extra.',
   'story', 15000, '{coins,material}', '{cafe,study_tables}', 'plaza',
   'The cafe is open',
   'We did it together. The boards are off the cafe and the study tables are yours. Thank you for every coin, plank and event you showed up to.',
   1),
  ('fund-museum', 'Fund the museum',
   'The museum needs funding before its doors open. Coins and donated specimens count here, and so does showing up to club events.',
   'story', 15000, '{coins,specimen}', '{museum,woods}', 'plaza',
   'The museum is open',
   'The museum doors are open and the woods path is clear. Every specimen you donated has a place on the shelves.',
   2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy,
                            unlocks_regions, completion_letter, skippable_max_tier) VALUES
  ('settle-in', 1, 'Settle in',
   'Claim your plot, make your first catch and donate it, then report to HQ.',
   'settle_in', NULL,
   '{"claim_plot":{"label":"Claim your plot at HQ"},"first_catch":{"label":"Make your first catch","hint":"Any fish counts. Try the pier."},"donate_catch":{"label":"Donate your catch to the museum shell"},"report_hq":{"label":"Report back to HQ"}}'::jsonb,
   '{village_core}',
   'Welcome to the island. The village is yours to explore.',
   5),
  ('reopen-cafe', 2, 'Reopen the cafe',
   'The whole club is reopening the cafe. Chip in at the monument and come to events.',
   'club_goal', 'reopen-cafe',
   '{"contribute":{"label":"Contribute to the cafe fund","hint":"Deliveries at the plaza monument, or come to a club event."},"goal_complete":{"label":"Cafe fund reaches its target"}}'::jsonb,
   '{cafe,study_tables}', '', 0),
  ('fund-museum', 3, 'Fund the museum',
   'The club is funding the museum. Specimens and coins count.',
   'club_goal', 'fund-museum',
   '{"contribute":{"label":"Contribute to the museum fund"},"goal_complete":{"label":"Museum fund reaches its target"}}'::jsonb,
   '{museum,woods}', '', 0),
  ('ruins-gate', 4, 'Reach the ruins gate',
   'Take the Oracle quiz and finish your family trial to open the ruins gate.',
   'oracle_trial', NULL,
   '{"oracle_quiz":{"label":"Complete the Oracle quiz"},"family_trial":{"label":"Finish the level-10 family trial"},"enter_gate":{"label":"Open the ruins gate"}}'::jsonb,
   '{cliffs,ruins_gate}',
   'The ruins gate is open to you. Tread carefully.',
   0)
ON CONFLICT (slug) DO NOTHING;
