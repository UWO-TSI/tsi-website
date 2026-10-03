-- ─── Classes v2, the Arcane wave: signature weapons, shop cosmetics, the Pollen form's trait ───
--
-- DRAFT 2026-10-03. NOT APPLIED. Spec: specs/classes/design-sheet.md (the Elementalist, Illusionist, Necromancer and
-- Transmuter LOCKED sections; §1.5 signature weapons; §1.10 shop cosmetics; §4 waves 1–4). Apply after
-- 20261002182708_zone1_mobs. Idempotent. The same rows live in web/lib/combat/arcaneSeed.ts (arcaneSeed.test.ts keeps
-- them equal) and web/lib/combat/kits.ts TRAITS. Nothing here changes today's game while economy_settings.classes_v2 is
-- off, except that a Transmuter's pollen-sprite kills now count toward its Pollen trait (the zone-1 wave left it empty).
-- Test: web/supabase/tests/classes_v2_arcane_smoke.sql.

-- The four signature types, tiers 1–5 (one base mesh each, the shared trim kit; arcana scales them all). The subclass
-- column is what combat_choose_subclass grants from (tier 1 the first time, the highest owned tier on a repick).
INSERT INTO weapons (key, name, weapon_type, tier, scaling, max_durability, repair_per_point, subclass) VALUES
  ('prism-staff-1', 'Driftwood prism staff', 'prism-staff', 1, ARRAY['arcana']::text[], 90, 1, 'elementalist'),
  ('prism-staff-2', 'Iron-banded prism staff', 'prism-staff', 2, ARRAY['arcana']::text[], 120, 2, 'elementalist'),
  ('prism-staff-3', 'Rune-cut prism staff', 'prism-staff', 3, ARRAY['arcana']::text[], 150, 3, 'elementalist'),
  ('prism-staff-4', 'Gilded prism staff', 'prism-staff', 4, ARRAY['arcana']::text[], 180, 4, 'elementalist'),
  ('prism-staff-5', 'Starlit prism staff', 'prism-staff', 5, ARRAY['arcana']::text[], 210, 5, 'elementalist'),
  ('trick-deck-1', 'Paper trick deck', 'trick-deck', 1, ARRAY['arcana']::text[], 90, 1, 'illusionist'),
  ('trick-deck-2', 'Silver-edged trick deck', 'trick-deck', 2, ARRAY['arcana']::text[], 120, 2, 'illusionist'),
  ('trick-deck-3', 'Rune-inked trick deck', 'trick-deck', 3, ARRAY['arcana']::text[], 150, 3, 'illusionist'),
  ('trick-deck-4', 'Gilded trick deck', 'trick-deck', 4, ARRAY['arcana']::text[], 180, 4, 'illusionist'),
  ('trick-deck-5', 'Starlit trick deck', 'trick-deck', 5, ARRAY['arcana']::text[], 210, 5, 'illusionist'),
  ('bone-tome-1', 'Cracked bone tome', 'bone-tome', 1, ARRAY['arcana']::text[], 90, 1, 'necromancer'),
  ('bone-tome-2', 'Iron-clasped bone tome', 'bone-tome', 2, ARRAY['arcana']::text[], 120, 2, 'necromancer'),
  ('bone-tome-3', 'Rune-bound bone tome', 'bone-tome', 3, ARRAY['arcana']::text[], 150, 3, 'necromancer'),
  ('bone-tome-4', 'Gilded bone tome', 'bone-tome', 4, ARRAY['arcana']::text[], 180, 4, 'necromancer'),
  ('bone-tome-5', 'Soul-lit bone tome', 'bone-tome', 5, ARRAY['arcana']::text[], 210, 5, 'necromancer'),
  ('tooth-charm-1', 'Corded tooth charm', 'tooth-charm', 1, ARRAY['arcana']::text[], 90, 1, 'transmuter'),
  ('tooth-charm-2', 'Iron-set tooth charm', 'tooth-charm', 2, ARRAY['arcana']::text[], 120, 2, 'transmuter'),
  ('tooth-charm-3', 'Rune-carved tooth charm', 'tooth-charm', 3, ARRAY['arcana']::text[], 150, 3, 'transmuter'),
  ('tooth-charm-4', 'Gilded tooth charm', 'tooth-charm', 4, ARRAY['arcana']::text[], 180, 4, 'transmuter'),
  ('tooth-charm-5', 'Soul-lit tooth charm', 'tooth-charm', 5, ARRAY['arcana']::text[], 210, 5, 'transmuter')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, weapon_type = EXCLUDED.weapon_type, tier = EXCLUDED.tier, scaling = EXCLUDED.scaling,
  max_durability = EXCLUDED.max_durability, repair_per_point = EXCLUDED.repair_per_point, subclass = EXCLUDED.subclass;

-- Shop cosmetics (§1.10): weapon skins (a material set on that subclass's weapon, every tier, never its stats) and aura
-- colour sets (three hex values for whichever subclass is active). Coins mostly; three of twelve in Gems. No rate anywhere.
INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, position, cosmetic, sprite_url) VALUES
  ('skin-prism-ember', 'Ember prism staff', 'weapon_skin', 'Charred wood and copper bands for the Elementalist''s staff. Looks only: your tier still shows.', 800, NULL, 900, '{"subclass":"elementalist","skin":"ember"}'::jsonb, '/assets/game/classes/elementalist.svg'),
  ('skin-prism-glacier', 'Glacier prism staff', 'weapon_skin', 'Pale birch and frosted silver for the Elementalist''s staff. Looks only.', 800, NULL, 901, '{"subclass":"elementalist","skin":"glacier"}'::jsonb, '/assets/game/classes/elementalist.svg'),
  ('aura-elementalist-fire', 'Wildfire aura', 'aura', 'Your aura''s motes burn orange.', 300, NULL, 902, '{"ramp":["#fff6d8","#ff8a3d","#5a1408"],"subclass":"elementalist"}'::jsonb, '/assets/game/classes/elementalist.svg'),
  ('aura-elementalist-tide', 'Tide aura', 'aura', 'Your aura''s motes run sea-blue.', 300, NULL, 903, '{"ramp":["#f2fdff","#4fb8ff","#0c2c5a"],"subclass":"elementalist"}'::jsonb, '/assets/game/classes/elementalist.svg'),
  ('aura-elementalist-storm', 'Storm shimmer aura', 'aura', 'Two-tone motes, violet into storm-teal.', NULL, 150, 904, '{"ramp":["#ffffff","#7fd8ff","#5a2a9a"],"subclass":"elementalist"}'::jsonb, '/assets/game/classes/elementalist.svg'),
  ('skin-deck-joker', 'Joker''s deck', 'weapon_skin', 'Midnight card backs with gold edges and a red Joker. Looks only.', 800, NULL, 905, '{"subclass":"illusionist","skin":"joker"}'::jsonb, '/assets/game/classes/illusionist.svg'),
  ('aura-illusionist-mirror', 'Mirror-shard aura', 'aura', 'Your floating cards glint like broken glass.', 300, NULL, 906, '{"ramp":["#ffffff","#bfe8ff","#2a3a6a"],"subclass":"illusionist"}'::jsonb, '/assets/game/classes/illusionist.svg'),
  ('skin-tome-ossuary', 'Ossuary binding', 'weapon_skin', 'A pale bone binding with an iron spine and a sea-green soul gem. Looks only.', 800, NULL, 907, '{"subclass":"necromancer","skin":"ossuary"}'::jsonb, '/assets/game/classes/necromancer.svg'),
  ('aura-necromancer-soulfire', 'Soul-fire aura', 'aura', 'Your bone dust burns with green soul-fire.', 300, NULL, 908, '{"ramp":["#f0fff8","#5cffc8","#0a3a2a"],"subclass":"necromancer"}'::jsonb, '/assets/game/classes/necromancer.svg'),
  ('aura-necromancer-violet', 'Violet soul-fire aura', 'aura', 'Two-tone soul-fire, violet into green.', NULL, 150, 909, '{"ramp":["#fff4ff","#c77dff","#1f3a2a"],"subclass":"necromancer"}'::jsonb, '/assets/game/classes/necromancer.svg'),
  ('skin-charm-obsidian', 'Obsidian tooth charm', 'weapon_skin', 'A black glass fang on a violet cord. Looks only.', 800, NULL, 910, '{"subclass":"transmuter","skin":"obsidian"}'::jsonb, '/assets/game/classes/transmuter.svg'),
  ('skin-charm-amber', 'Amber tooth charm', 'weapon_skin', 'A fang set in glowing amber that pulses with your forms.', NULL, 200, 911, '{"subclass":"transmuter","skin":"amber"}'::jsonb, '/assets/game/classes/transmuter.svg')
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, category = EXCLUDED.category, description = EXCLUDED.description,
  price_coins = EXCLUDED.price_coins, tc_price = EXCLUDED.tc_price, position = EXCLUDED.position, cosmetic = EXCLUDED.cosmetic,
  sprite_url = COALESCE(shop_items.sprite_url, EXCLUDED.sprite_url);

-- BEGIN TRAITS (web/lib/combat/kits.ts TRAITS; service.test.ts keeps them equal)
-- The Transmuter learns the Pollen form from the zone-1 pollen sprites (combat_record_kill counts the trait's defeats).
UPDATE enemy_types e SET trait = v.trait FROM (VALUES
  ('pollen-sprite', 'pollen-swarm')
) v(key, trait) WHERE e.key = v.key;
-- END TRAITS

-- Coordinator guard (2026-10-03): class cosmetics stay off sale until the classes v2 launch (wave 5 sets them active
-- when it turns economy_settings.classes_v2 on). Without this, the rows above would be buyable, Gem-priced ones
-- included, for a class system members can't use yet.
UPDATE shop_items SET active = FALSE WHERE category IN ('weapon_skin', 'aura', 'frame') AND NOT public.classes_v2_on();
