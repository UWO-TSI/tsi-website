-- ─── Player persistence — "the world remembers me" foundation ────
--
-- Reviewer flag (other Claude): "Persistence is the genre. ACNH's soul
-- is 'the world remembers me'. If a returning player feels reset, the
-- whole brand promise breaks."
--
-- This migration adds the three missing persistence layers:
--   1. player_inventory  — which shop items each member owns
--   2. achievements      — content-pipeline table of unlockable badges
--   3. player_achievements — which achievements each member has unlocked
--   4. profiles ext      — first_seen_at, last_seen_at, preferences JSONB
--
-- Already persisted (no change): npc_memories (D1), npc_conversations
-- (D1), player_positions (E1), emote_logs (E1), guestbook_entries (E1),
-- profiles base columns, avatar_config, skills, social_links.

-- ─── 1. player_inventory ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase', 'grant', 'earned', 'starter')),
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_player_inventory_user ON player_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_equipped ON player_inventory(user_id, equipped) WHERE equipped = TRUE;

ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own inventory" ON player_inventory
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "T1/T2 read all inventory" ON player_inventory
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Users update own inventory equipped state" ON player_inventory
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
-- INSERTs (purchases, grants) go through service role only — no client policy.
-- DELETE (retirement) goes through service role only — no client policy.

-- ─── 2. achievements (content-pipeline pattern) ──────────────────

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  badge_url TEXT,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,  -- secret achievements (not shown until unlocked)
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  tc_reward INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_active ON achievements(active) WHERE active = TRUE;

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements readable when active" ON achievements
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND active = TRUE);
CREATE POLICY "Achievements readable by T1/T2 (all rows)" ON achievements
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Achievements insertable by T1/T2" ON achievements
  FOR INSERT WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Achievements updatable by T1/T2" ON achievements
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Achievements deletable by T1/T2" ON achievements
  FOR DELETE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- ─── 3. player_achievements ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  progress JSONB NOT NULL DEFAULT '{}',  -- optional partial-progress state pre-unlock
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_player_achievements_user ON player_achievements(user_id, unlocked_at DESC);

ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own achievements" ON player_achievements
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Authenticated read others' non-hidden achievements" ON player_achievements
  FOR SELECT USING (
    (select auth.role()) = 'authenticated'
    AND achievement_id IN (SELECT id FROM achievements WHERE hidden = FALSE)
  );
CREATE POLICY "T1/T2 read all player_achievements" ON player_achievements
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
-- All INSERT / UPDATE via service role — server checks unlock conditions.

-- ─── 4. profiles extension ───────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0;

-- ─── Seed: starter achievements ──────────────────────────────────

INSERT INTO achievements (slug, display_name, description, rarity, tc_reward) VALUES
  ('first-steps', 'First Steps', 'Logged into TSI World for the first time.', 'common', 25),
  ('walking-the-grounds', 'Walking the Grounds', 'Visited all three buildings (HQ, Shop, Oracle Temple).', 'common', 50),
  ('met-the-mayor', 'Met the Mayor', 'Had your first conversation with Mayor Eliza.', 'common', 50),
  ('a-soft-soul', 'A Soft Soul', 'Signed the guestbook.', 'common', 25),
  ('emote-ic', 'Emote-ic', 'Used 5 different emotes.', 'rare', 100),
  ('night-owl', 'Night Owl', 'Spent time in TSI World after midnight.', 'rare', 50),
  ('regular', 'Regular', 'Logged in on 7 different days.', 'rare', 200),
  ('founding-member', 'Founding Member', 'Created your account during Phase 1.', 'legendary', 1000)
ON CONFLICT (slug) DO NOTHING;
