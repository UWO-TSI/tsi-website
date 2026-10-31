-- Never contraband on a shop row (rod-gear, David): Contraband is staff tools, granted only by an admin to a staff
-- account (lib/rarity.ts). Narrows 20261027140000_rarity_ladder's shop_items check to every rung but contraband; the
-- species and the sell prices keep theirs. Fails if a shop row is contraband: check prod has none before applying
-- (SELECT slug FROM shop_items WHERE rarity = 'contraband'). Idempotent.

ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_rarity_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_rarity_check
  CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'divine'));
