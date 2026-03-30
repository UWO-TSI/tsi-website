-- ─── Avatar Items & Player Inventory ────────────────────────────────────────
-- Shop system: items that players can buy with TSI coins and equip on avatars.

-- 1. Avatar items catalog
CREATE TABLE IF NOT EXISTS avatar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hair', 'face', 'outfit', 'accessory', 'effect', 'emote')),
  category TEXT NOT NULL CHECK (category IN ('default', 'shop', 'achievement', 'event', 'admin')),
  coin_price INTEGER NOT NULL DEFAULT 0,
  sprite_url TEXT,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Player inventory (which items a user owns + equipped state)
CREATE TABLE IF NOT EXISTS player_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES avatar_items(id) ON DELETE CASCADE,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_avatar_items_type ON avatar_items(type);
CREATE INDEX IF NOT EXISTS idx_avatar_items_rarity ON avatar_items(rarity);
CREATE INDEX IF NOT EXISTS idx_player_inventory_user ON player_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_equipped ON player_inventory(user_id, equipped) WHERE equipped = TRUE;

-- RLS
ALTER TABLE avatar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avatar items readable by all authenticated"
  ON avatar_items FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own inventory"
  ON player_inventory FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own inventory"
  ON player_inventory FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own inventory"
  ON player_inventory FOR UPDATE
  USING (user_id = auth.uid());
