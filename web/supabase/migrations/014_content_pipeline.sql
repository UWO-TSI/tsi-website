-- ─── Content Pipeline: NPC personas, shop items, seasonal palettes, content drafts ──

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS npc_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  sprite_url TEXT,
  spawn_zone TEXT NOT NULL CHECK (spawn_zone IN ('courtyard', 'shop', 'temple', 'roaming')),
  is_permanent BOOLEAN NOT NULL DEFAULT FALSE,
  persona_prompt TEXT,
  canned_dialogue TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('avatar-outfit', 'avatar-effect', 'merch', 'profile-customization')),
  sprite_url TEXT,
  description TEXT,
  tc_price INTEGER NOT NULL,
  rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  stock INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS seasonal_palettes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  palette JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seasonal_palettes_single_active
  ON seasonal_palettes (active)
  WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  row_id UUID,
  draft_data JSONB NOT NULL,
  author UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'discarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_npc_personas_active ON npc_personas(active);
CREATE INDEX IF NOT EXISTS idx_npc_personas_spawn_zone ON npc_personas(spawn_zone);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON shop_items(active);
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category);
CREATE INDEX IF NOT EXISTS idx_content_drafts_author ON content_drafts(author);
CREATE INDEX IF NOT EXISTS idx_content_drafts_status ON content_drafts(status);
CREATE INDEX IF NOT EXISTS idx_content_drafts_table_row ON content_drafts(table_name, row_id);

DROP TRIGGER IF EXISTS trg_npc_personas_updated_at ON npc_personas;
CREATE TRIGGER trg_npc_personas_updated_at
  BEFORE UPDATE ON npc_personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE npc_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NPC personas readable when active" ON npc_personas
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND active = TRUE);
CREATE POLICY "NPC personas readable by T1/T2 (all rows)" ON npc_personas
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "NPC personas insertable by T1/T2" ON npc_personas
  FOR INSERT WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "NPC personas updatable by T1/T2" ON npc_personas
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "NPC personas deletable by T1/T2" ON npc_personas
  FOR DELETE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop items readable when active" ON shop_items
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND active = TRUE);
CREATE POLICY "Shop items readable by T1/T2 (all rows)" ON shop_items
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Shop items insertable by T1/T2" ON shop_items
  FOR INSERT WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Shop items updatable by T1/T2" ON shop_items
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Shop items deletable by T1/T2" ON shop_items
  FOR DELETE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

ALTER TABLE seasonal_palettes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seasonal palettes readable when active" ON seasonal_palettes
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND active = TRUE);
CREATE POLICY "Seasonal palettes readable by T1/T2 (all rows)" ON seasonal_palettes
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Seasonal palettes insertable by T1/T2" ON seasonal_palettes
  FOR INSERT WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Seasonal palettes updatable by T1/T2" ON seasonal_palettes
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Seasonal palettes deletable by T1/T2" ON seasonal_palettes
  FOR DELETE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

ALTER TABLE content_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Content drafts readable by author" ON content_drafts
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND author = (select auth.uid()));
CREATE POLICY "Content drafts readable by T1/T2 (all rows)" ON content_drafts
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Content drafts insertable by authenticated" ON content_drafts
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL AND author = (select auth.uid()));
CREATE POLICY "Content drafts updatable by T1/T2" ON content_drafts
  FOR UPDATE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Content drafts deletable by T1/T2" ON content_drafts
  FOR DELETE USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

INSERT INTO npc_personas (slug, display_name, spawn_zone, is_permanent, persona_prompt, canned_dialogue) VALUES
  (
    'mayor',
    'Mayor Eliza',
    'courtyard',
    TRUE,
    'You are Mayor Eliza, the warm and knowledgeable historian of the TSI club. You greet members with genuine warmth, remember small details, and love sharing stories about past chapters, members who have moved on, and the traditions that make TSI feel like home. You speak in a measured, welcoming cadence — never rushed, never preachy. Keep responses under 3 sentences unless asked for a story.',
    ARRAY[
      'Welcome back to the courtyard. The light here changes with the season — have you noticed?',
      'Every brick in this square was laid by someone who believed in this place. You belong here too.',
      'If you ever want to hear how this all started, you know where to find me.'
    ]
  ),
  (
    'shopkeeper',
    'Toren',
    'shop',
    TRUE,
    'You are Toren, the shopkeeper. Dry, deadpan humor. You sell things to club members and take mild satisfaction in pointing out when an item is overpriced (it usually is, in your opinion). You are not rude — just unimpressed. Keep responses short, often one sentence. Occasionally drop a line about your shop, your inventory, or the absurdity of TSI coin economics.',
    ARRAY[
      'Welcome. Browse if you must.',
      'Everything here is, technically, for sale. Some of it is even worth buying.',
      'The hoodie is a hoodie. It will keep you warm. That is the entire pitch.'
    ]
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO shop_items (slug, display_name, category, description, tc_price, rarity, stock) VALUES
  ('tsi-hoodie', 'TSI Hoodie', 'merch', 'Heavyweight cotton hoodie with the TSI crest. Pickup at HQ.', 1500, 'rare', 50),
  ('glitch-aura', 'Glitch Aura', 'avatar-effect', 'A flickering chromatic aberration that follows your avatar.', 800, 'epic', NULL),
  ('founder-badge', 'Founder Badge', 'profile-customization', 'A rare badge displayed on your profile and in the directory.', 5000, 'legendary', 25)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO seasonal_palettes (slug, display_name, palette, active, scheduled_start, scheduled_end) VALUES
  (
    'default',
    'Default',
    '{
      "sky": "#BFE6F0",
      "grass": "#7CB342",
      "accent": "#FFD166",
      "fog": "#B0C4DE",
      "water": "#4A90D9",
      "building_primary": "#D4A574",
      "building_accent": "#8B6F4E"
    }'::jsonb,
    TRUE,
    NULL,
    NULL
  ),
  (
    'halloween',
    'Halloween',
    '{
      "sky": "#2B1B3D",
      "grass": "#3E2A47",
      "accent": "#FF7518",
      "fog": "#4A3A5C",
      "water": "#1A1226",
      "building_primary": "#5A2E8E",
      "building_accent": "#0F0A1A"
    }'::jsonb,
    FALSE,
    '2026-10-01T00:00:00Z',
    '2026-11-07T23:59:59Z'
  )
ON CONFLICT (slug) DO NOTHING;
