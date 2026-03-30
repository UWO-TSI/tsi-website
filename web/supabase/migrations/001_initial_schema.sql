-- ============================================
-- TETHOS Student Dashboard — Initial Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('operations', 'projects')),
  portfolio TEXT CHECK (portfolio IN ('external', 'internal', 'marketing')),
  npo_partner TEXT,
  term TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 4 CHECK (tier BETWEEN 1 AND 4),
  position TEXT,
  class TEXT,
  subclass TEXT,
  team_id UUID REFERENCES teams(id),
  portfolio TEXT,
  side TEXT,

  -- Gamification
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  rank TEXT NOT NULL DEFAULT 'Initiate',
  tethos_coins INTEGER NOT NULL DEFAULT 0,

  -- Onboarding
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step INTEGER NOT NULL DEFAULT 0,

  -- Profile fields
  year TEXT,
  program TEXT,
  hometown TEXT,
  birthday DATE,
  phone TEXT,
  preferred_email TEXT,
  uwo_email TEXT,
  gdrive_email TEXT,
  github_username TEXT,
  instagram TEXT,
  linkedin TEXT,
  discord_tag TEXT,
  favourite_music TEXT,
  dream_retirement TEXT,
  spirit_animal TEXT,
  fun_fact TEXT,
  avatar_url TEXT,
  bio TEXT,

  -- Theme
  active_theme TEXT NOT NULL DEFAULT 'dark',

  -- Meta
  is_alumni BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  login_streak INTEGER NOT NULL DEFAULT 0
);

-- Invite Codes
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  term TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  uses INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to increment invite code uses
CREATE OR REPLACE FUNCTION increment_invite_uses(code_value TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE invite_codes SET uses = uses + 1 WHERE code = code_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'info' CHECK (urgency IN ('info', 'warning', 'critical')),
  is_banner BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(announcement_id, user_id)
);

-- Bounties
CREATE TABLE IF NOT EXISTS bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  client_name TEXT,
  pay_cad DECIMAL(10,2),
  pay_tc INTEGER,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  deadline TIMESTAMPTZ,
  tech_stack TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'claimed', 'in_progress', 'review', 'completed', 'expired')),
  submitted_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bounty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID REFERENCES bounties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(bounty_id, user_id)
);

CREATE TABLE IF NOT EXISTS bounty_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID REFERENCES bounties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ
);

-- Events / Calendar
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('club', 'team', 'bounty', 'volunteer', 'social', 'workshop', 'meeting')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location TEXT,
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  team_id UUID REFERENCES teams(id),
  bounty_id UUID REFERENCES bounties(id),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'cancelled')),
  tc_reward INTEGER DEFAULT 0,
  xp_reward INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'absent')),
  UNIQUE(event_id, user_id)
);

-- Kanban
CREATE TABLE IF NOT EXISTS kanban_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES kanban_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID REFERENCES kanban_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_card_assignees (
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE IF NOT EXISTS kanban_card_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT
);

CREATE TABLE IF NOT EXISTS kanban_card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_card_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES kanban_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL
);

-- Marketplace
CREATE TABLE IF NOT EXISTS marketplace_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price_tc INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'merch' CHECK (category IN ('merch', 'theme', 'accessory', 'special')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold_out', 'coming_soon', 'hidden')),
  theme_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  item_id UUID REFERENCES marketplace_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  total_tc INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_pickup' CHECK (status IN ('pending_pickup', 'fulfilled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

-- Job Board
CREATE TABLE IF NOT EXISTS job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  job_type TEXT NOT NULL CHECK (job_type IN ('internship', 'full_time', 'part_time', 'contract')),
  url TEXT NOT NULL,
  categories TEXT[],
  tags TEXT[],
  description TEXT,
  posted_by UUID REFERENCES profiles(id),
  is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES job_listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quests
CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  quest_type TEXT NOT NULL CHECK (quest_type IN ('daily', 'weekly', 'seasonal')),
  xp_reward INTEGER NOT NULL DEFAULT 0,
  tc_reward INTEGER NOT NULL DEFAULT 0,
  criteria TEXT,
  is_auto_tracked BOOLEAN NOT NULL DEFAULT FALSE,
  auto_track_type TEXT,
  auto_track_count INTEGER,
  max_completions INTEGER DEFAULT 1,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_interval TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quest_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'in_progress', 'completed', 'expired')),
  progress INTEGER NOT NULL DEFAULT 0,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(quest_id, user_id)
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  tc_reward INTEGER DEFAULT 0,
  xp_reward INTEGER DEFAULT 0,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  criteria_type TEXT,
  criteria_value INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Transaction Logs
CREATE TABLE IF NOT EXISTS tc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn_quest', 'earn_bounty', 'earn_event', 'earn_achievement', 'earn_birthday', 'earn_streak', 'earn_admin', 'spend_marketplace', 'spend_theme')),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  reference_type TEXT,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mentorship
CREATE TABLE IF NOT EXISTS mentorship_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  is_mentor BOOLEAN NOT NULL DEFAULT FALSE,
  skills TEXT[],
  availability TEXT,
  max_mentees INTEGER DEFAULT 3,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mentorship_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES profiles(id),
  mentee_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Portfolios
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  bio TEXT,
  accent_color TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  sections JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bounty', 'project', 'personal', 'case_study')),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link TEXT,
  tech_stack TEXT[],
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time Capsule
CREATE TABLE IF NOT EXISTS time_capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  open_date TIMESTAMPTZ NOT NULL,
  is_opened BOOLEAN NOT NULL DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Themes
CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  css_variables JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_purchasable BOOLEAN NOT NULL DEFAULT TRUE,
  preview_url TEXT
);

CREATE TABLE IF NOT EXISTS user_themes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  theme_id TEXT REFERENCES themes(id),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, theme_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams readable by authenticated" ON teams FOR SELECT USING (auth.role() = 'authenticated');

-- Invite Codes
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invite codes readable by authenticated" ON invite_codes FOR SELECT USING (auth.role() = 'authenticated');

-- Announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Announcements readable by authenticated" ON announcements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Announcements insertable by authenticated" ON announcements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Announcements updatable by creator" ON announcements FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Announcements deletable by creator" ON announcements FOR DELETE USING (auth.role() = 'authenticated');

-- Announcement Dismissals
ALTER TABLE announcement_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own dismissals" ON announcement_dismissals FOR ALL USING (user_id = auth.uid());

-- Bounties
ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bounties readable by authenticated" ON bounties FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Bounties insertable by authenticated" ON bounties FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Bounties updatable by authenticated" ON bounties FOR UPDATE USING (auth.role() = 'authenticated');

-- Bounty Claims
ALTER TABLE bounty_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bounty claims readable" ON bounty_claims FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Bounty claims insertable" ON bounty_claims FOR INSERT WITH CHECK (user_id = auth.uid());

-- Events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events readable by authenticated" ON events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Events insertable by authenticated" ON events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Events updatable by authenticated" ON events FOR UPDATE USING (auth.role() = 'authenticated');

-- Event Attendance
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event attendance readable" ON event_attendance FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Event attendance insertable" ON event_attendance FOR INSERT WITH CHECK (user_id = auth.uid());

-- Kanban
ALTER TABLE kanban_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kanban boards readable" ON kanban_boards FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kanban columns readable" ON kanban_columns FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Kanban columns writable" ON kanban_columns FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kanban cards readable" ON kanban_cards FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Kanban cards writable" ON kanban_cards FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE kanban_card_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kanban assignees readable" ON kanban_card_assignees FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Kanban assignees writable" ON kanban_card_assignees FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE kanban_card_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kanban comments readable" ON kanban_card_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Kanban comments insertable" ON kanban_card_comments FOR INSERT WITH CHECK (user_id = auth.uid());

ALTER TABLE kanban_card_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kanban checklist readable" ON kanban_card_checklist FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Kanban checklist writable" ON kanban_card_checklist FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE kanban_card_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kanban labels readable" ON kanban_card_labels FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Kanban labels writable" ON kanban_card_labels FOR ALL USING (auth.role() = 'authenticated');

-- Marketplace
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketplace items readable" ON marketplace_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Marketplace items writable" ON marketplace_items FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own orders readable" ON marketplace_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Orders insertable" ON marketplace_orders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Orders updatable" ON marketplace_orders FOR UPDATE USING (auth.role() = 'authenticated');

-- Job Board
ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Jobs readable" ON job_listings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Jobs insertable" ON job_listings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Jobs updatable" ON job_listings FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Jobs deletable" ON job_listings FOR DELETE USING (auth.role() = 'authenticated');

ALTER TABLE job_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Job comments readable" ON job_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Job comments insertable" ON job_comments FOR INSERT WITH CHECK (user_id = auth.uid());

-- Quests
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quests readable" ON quests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Quests writable" ON quests FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE quest_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quest progress readable" ON quest_progress FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Quest progress insertable" ON quest_progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Quest progress updatable" ON quest_progress FOR UPDATE USING (user_id = auth.uid());

-- Achievements
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements readable" ON achievements FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User achievements readable" ON user_achievements FOR SELECT USING (auth.role() = 'authenticated');

-- Transactions
ALTER TABLE tc_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own TC transactions" ON tc_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "TC transactions insertable" ON tc_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own XP transactions" ON xp_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "XP transactions insertable" ON xp_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications readable" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Notifications insertable" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Own notifications updatable" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Mentorship
ALTER TABLE mentorship_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mentorship profiles readable" ON mentorship_profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Own mentorship profile writable" ON mentorship_profiles FOR ALL USING (user_id = auth.uid());

ALTER TABLE mentorship_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mentorship matches readable" ON mentorship_matches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Mentorship matches insertable" ON mentorship_matches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Mentorship matches updatable" ON mentorship_matches FOR UPDATE USING (auth.role() = 'authenticated');

-- Portfolios
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portfolios readable" ON portfolios FOR SELECT USING (auth.role() = 'authenticated' OR is_public = TRUE);
CREATE POLICY "Own portfolio writable" ON portfolios FOR ALL USING (user_id = auth.uid());

ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portfolio items readable" ON portfolio_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Portfolio items writable" ON portfolio_items FOR ALL USING (auth.role() = 'authenticated');

-- Time Capsule
ALTER TABLE time_capsules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own time capsules" ON time_capsules FOR ALL USING (user_id = auth.uid());

-- Themes
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Themes readable" ON themes FOR SELECT USING (TRUE);

ALTER TABLE user_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own themes readable" ON user_themes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Own themes insertable" ON user_themes FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- SEED DATA: Default Themes
-- ============================================

INSERT INTO themes (id, name, description, css_variables, is_default, is_purchasable) VALUES
  ('dark', 'Dark', 'Default Tethos dark theme', '{}', TRUE, FALSE),
  ('cyberpunk', 'Cyberpunk', 'Neon pink and purple with scanlines', '{"--color-brand-blue": "#ff00ff", "--color-accent-cyan": "#00ffff", "--color-brand-yellow": "#ff6b6b"}', FALSE, TRUE),
  ('forest', 'Forest', 'Deep green with organic shapes', '{"--color-brand-blue": "#059669", "--color-accent-cyan": "#34d399", "--color-brand-yellow": "#fbbf24"}', FALSE, TRUE),
  ('retro', 'Retro Terminal', 'Amber monochrome CRT effect', '{"--color-brand-blue": "#f59e0b", "--color-accent-cyan": "#fbbf24", "--color-brand-yellow": "#f59e0b"}', FALSE, TRUE),
  ('light', 'Light', 'Clean white with blue accents', '{"--color-bg-main": "#f8fafc", "--color-bg-alt": "#ffffff", "--color-text-primary": "#0f172a"}', FALSE, TRUE),
  ('ocean', 'Ocean', 'Deep blue with wave patterns', '{"--color-brand-blue": "#0284c7", "--color-accent-cyan": "#38bdf8", "--color-brand-yellow": "#fbbf24"}', FALSE, TRUE),
  ('sunset', 'Sunset', 'Warm gradient with orange accents', '{"--color-brand-blue": "#ea580c", "--color-accent-cyan": "#fb923c", "--color-brand-yellow": "#fbbf24"}', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SEED DATA: Default Achievements
-- ============================================

INSERT INTO achievements (name, display_name, description, icon, tc_reward, xp_reward, is_secret, criteria_type, criteria_value) VALUES
  ('FIRST_BLOOD', 'First Blood', 'Complete your first bounty', '⚔️', 100, 100, FALSE, 'bounty_count', 1),
  ('TEAM_PLAYER', 'Team Player', 'Complete 5 team tasks', '🤝', 200, 200, FALSE, 'team_tasks', 5),
  ('QUEST_MASTER', 'Quest Master', 'Complete 50 quests', '🎯', 500, 500, FALSE, 'quest_count', 50),
  ('SOCIAL_BUTTERFLY', 'Social Butterfly', 'Attend 10 events', '🦋', 300, 300, FALSE, 'event_count', 10),
  ('COIN_COLLECTOR', 'Coin Collector', 'Earn 5000 TC total', '💰', 0, 200, FALSE, 'tc_earned', 5000),
  ('STREAK_WARRIOR', 'Streak Warrior', '30-day login streak', '🔥', 1000, 1000, FALSE, 'login_streak', 30),
  ('BOUNTY_HUNTER', 'Bounty Hunter', 'Complete 10 bounties', '🏹', 500, 500, FALSE, 'bounty_count', 10),
  ('MENTOR', 'Mentor', 'Help 5 mentees', '🎓', 400, 400, FALSE, 'mentee_count', 5),
  ('NIGHT_OWL', 'Night Owl', 'Log in after midnight 10 times', '🦉', 0, 100, FALSE, 'night_login', 10),
  ('EARLY_BIRD', 'Early Bird', 'Log in before 7am 10 times', '🐦', 0, 100, FALSE, 'early_login', 10),
  ('FULL_HOUSE', 'Full House', 'Fill out every profile field', '🏠', 100, 100, FALSE, 'profile_complete', 1),
  ('TIME_TRAVELER', 'Time Traveler', 'Find the Time Capsule', '⏳', 0, 200, TRUE, NULL, NULL),
  ('KONAMI_MASTER', 'Konami Master', 'Enter the Konami code', '🎮', 0, 100, TRUE, NULL, NULL),
  ('EXPLORER', 'Explorer', 'Visit every page in the dashboard', '🗺️', 200, 300, TRUE, 'pages_visited', 15)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SEED DATA: Default Invite Code
-- ============================================

INSERT INTO invite_codes (code, term, is_active) VALUES
  ('TETHOS-W26', 'W2026', TRUE)
ON CONFLICT (code) DO NOTHING;
