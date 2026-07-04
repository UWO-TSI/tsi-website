-- ─── Member collections (cozy marathon G1/G4/G5, 2026-07-04) ────────────────
-- Stackable cozy collectibles (fruit shaken from trees, picked flowers,
-- caught fish). Deliberately NOT player_inventory: that table is FK'd to
-- shop_items with UNIQUE(user_id, item_id) — cosmetics, not stackables.
--
-- Principle #3 stays intact: collectibles carry no TC and no XP. They are
-- flavor + collection-book material only.
--
-- Applied to remote via the management API on creation day (ledger-recorded
-- as member_collections). Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS member_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 64),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  first_collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_member_collections_user ON member_collections(user_id);

ALTER TABLE member_collections ENABLE ROW LEVEL SECURITY;

-- Users read their own collection; T1/T2 can read all (admin/curiosity).
DROP POLICY IF EXISTS "Collections readable by owner" ON member_collections;
CREATE POLICY "Collections readable by owner"
  ON member_collections FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT tier FROM profiles WHERE id = (SELECT auth.uid())) IN (1, 2)
  );

-- Writes go through the API route (user-scoped client), so self-only.
DROP POLICY IF EXISTS "Collections insert own" ON member_collections;
CREATE POLICY "Collections insert own"
  ON member_collections FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Collections update own" ON member_collections;
CREATE POLICY "Collections update own"
  ON member_collections FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
