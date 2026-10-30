-- The rarity ladder (David, 2026-10-27, specs/launch/v1-gameplay.md f-rods): common, uncommon, rare, epic,
-- legendary, divine, contraband, for every item and fish (lib/rarity.ts). Widens the rarity checks on the species,
-- the sell prices and the shop rows, so the next catalogue seed can add Divine's sell prices (lib/wallet/catalogue.ts
-- SELL_PRICES). Contraband has no sell price, so the shop won't buy it. Idempotent.

ALTER TABLE collection_species DROP CONSTRAINT IF EXISTS collection_species_rarity_check;
ALTER TABLE collection_species ADD CONSTRAINT collection_species_rarity_check
  CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'divine', 'contraband'));

ALTER TABLE sell_prices DROP CONSTRAINT IF EXISTS sell_prices_rarity_check;
ALTER TABLE sell_prices ADD CONSTRAINT sell_prices_rarity_check
  CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'divine', 'contraband'));

ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_rarity_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_rarity_check
  CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'divine', 'contraband'));

