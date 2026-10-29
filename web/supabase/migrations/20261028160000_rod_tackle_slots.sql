-- Rod add-on slots (David, 2026-10-27, specs/launch/v1-gameplay.md x-shop): bait and a bobber on the rod
-- (lib/game/rods.ts TACKLE), equipped one per slot like clothes (member_inventory.equipped, one per slot). Widens the
-- shop's slot check so the next catalogue seed can give the Lucky bobber and Sweet bait their slots, and gives the
-- Lucky bobbers already owned their slot so they can be equipped. Idempotent.

ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_slot_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_slot_check
  CHECK (slot IS NULL OR slot IN ('rod', 'net', 'shovel', 'outfit', 'hair', 'accessory', 'bait', 'bobber'));

UPDATE member_inventory SET slot = 'bobber'
WHERE slot IS NULL AND item_id IN (SELECT id FROM shop_items WHERE slug = 'bobber-lucky');
