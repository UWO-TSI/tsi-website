-- ─── Community Loops: emotes, guestbook, player positions (ghost-replay) ──
-- Async community-feel features per sprint-2026-07-community-loops.md §E1.
-- - emote_types: admin-managed via E8 editor (content-pipeline-style).
-- - emote_logs: every emote a player triggers, with world coords for proximity replay.
-- - guestbook_entries: HQ wall signatures, T1/T2 moderate via `hidden` flag.
-- - player_positions: latest known position per user (upsert), drives ghost-replay.

CREATE TABLE IF NOT EXISTS emote_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  animation_key TEXT NOT NULL,
  icon_url TEXT,
  unlock_condition TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emote_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emote_type_id UUID NOT NULL REFERENCES emote_types(id) ON DELETE CASCADE,
  world_x REAL NOT NULL,
  world_z REAL NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emote_logs_recent ON emote_logs(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_emote_logs_location ON emote_logs(world_x, world_z);

CREATE TABLE IF NOT EXISTS guestbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 200),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guestbook_recent ON guestbook_entries(created_at DESC);

CREATE TABLE IF NOT EXISTS player_positions (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  world_x REAL NOT NULL,
  world_z REAL NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_positions_recent ON player_positions(recorded_at DESC);

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE emote_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Emote types readable when active" ON emote_types
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND active = TRUE);
CREATE POLICY "Emote types readable by T1/T2 (all rows)" ON emote_types
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Emote types insertable by T1/T2" ON emote_types
  FOR INSERT WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Emote types updatable by T1/T2" ON emote_types
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Emote types deletable by T1/T2" ON emote_types
  FOR DELETE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

ALTER TABLE emote_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Emote logs readable by authenticated" ON emote_logs
  FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "Emote logs insertable by self" ON emote_logs
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()));
CREATE POLICY "Emote logs deletable by T1/T2" ON emote_logs
  FOR DELETE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

ALTER TABLE guestbook_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guestbook entries readable when not hidden" ON guestbook_entries
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND hidden = FALSE);
CREATE POLICY "Guestbook entries readable by T1/T2 (all rows)" ON guestbook_entries
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Guestbook entries insertable by self" ON guestbook_entries
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()));
CREATE POLICY "Guestbook entries updatable by T1/T2" ON guestbook_entries
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Guestbook entries deletable by T1" ON guestbook_entries
  FOR DELETE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) = 1);

ALTER TABLE player_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Player positions readable by authenticated" ON player_positions
  FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "Player positions insertable by self" ON player_positions
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()));
CREATE POLICY "Player positions updatable by self" ON player_positions
  FOR UPDATE USING (user_id = (select auth.uid()));

-- ─── Seed data ─────────────────────────────────────────────────────────────
-- 5 default emote types. icon_url + unlock_condition left NULL — admins fill via E8.

INSERT INTO emote_types (slug, display_name, animation_key) VALUES
  ('wave', 'Wave', 'wave'),
  ('dance', 'Dance', 'dance'),
  ('laugh', 'Laugh', 'laugh'),
  ('point', 'Point', 'point'),
  ('sit', 'Sit', 'sit')
ON CONFLICT (slug) DO NOTHING;
