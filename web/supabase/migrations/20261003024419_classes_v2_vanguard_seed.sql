-- Classes v2, the Vanguard wave (specs/classes/design-sheet.md §4 "Waves 1–4"; the LOCKED Guardian, Juggernaut,
-- Martial Artist and Assassin): the four signature weapon types × tiers 1–5 (§1.5: aegis, warhammer, handwraps, tanto),
-- and the family's shop cosmetics (§1.10: weapon skins, aura colours, nameplate frames; mostly coins, two in Gems, no
-- rate shown anywhere). Apply after 20261003015109_classes_v2_arcane_seed. Idempotent. Everything stays behind
-- classes_v2: the weapons are only granted by combat_choose_subclass with the flag on, and the cosmetics land off sale
-- (inactive) until the flag turns on (wave 5 activates them with it), as the Arcane seed's do.
-- The weapon rows are web/lib/combat/seed.ts signatureSeedSql(["guardian", "juggernaut", "monk", "assassin"]) (a test
-- holds them equal). Test: web/supabase/tests/classes_v2_vanguard_smoke.sql.

-- ─── Signature weapons ──────────────────────────────────────────────────────
INSERT INTO weapons (key, name, weapon_type, tier, scaling, max_durability, repair_per_point, subclass) VALUES
  ('aegis-oak', 'Oak shield and sword', 'aegis', 1, ARRAY['might','vitality']::text[], 90, 1, 'guardian'),
  ('aegis-iron', 'Iron shield and sword', 'aegis', 2, ARRAY['might','vitality']::text[], 120, 2, 'guardian'),
  ('aegis-rune', 'Rune-etched aegis', 'aegis', 3, ARRAY['might','vitality']::text[], 150, 3, 'guardian'),
  ('aegis-gilt', 'Gilded aegis', 'aegis', 4, ARRAY['might','vitality']::text[], 180, 4, 'guardian'),
  ('aegis-dawn', 'Dawnward aegis', 'aegis', 5, ARRAY['might','vitality']::text[], 210, 5, 'guardian'),
  ('warhammer-timber', 'Timber war hammer', 'warhammer', 1, ARRAY['might','vitality']::text[], 90, 1, 'juggernaut'),
  ('warhammer-iron', 'Iron war hammer', 'warhammer', 2, ARRAY['might','vitality']::text[], 120, 2, 'juggernaut'),
  ('warhammer-rune', 'Rune-etched war hammer', 'warhammer', 3, ARRAY['might','vitality']::text[], 150, 3, 'juggernaut'),
  ('warhammer-gilt', 'Gilded war hammer', 'warhammer', 4, ARRAY['might','vitality']::text[], 180, 4, 'juggernaut'),
  ('warhammer-quake', 'Quakeborn war hammer', 'warhammer', 5, ARRAY['might','vitality']::text[], 210, 5, 'juggernaut'),
  ('handwraps-cotton', 'Cotton fight wraps', 'handwraps', 1, ARRAY['might','finesse']::text[], 90, 1, 'monk'),
  ('handwraps-iron', 'Iron-knuckle wraps', 'handwraps', 2, ARRAY['might','finesse']::text[], 120, 2, 'monk'),
  ('handwraps-rune', 'Rune-stitched wraps', 'handwraps', 3, ARRAY['might','finesse']::text[], 150, 3, 'monk'),
  ('handwraps-gilt', 'Gilded wraps', 'handwraps', 4, ARRAY['might','finesse']::text[], 180, 4, 'monk'),
  ('handwraps-sun', 'Sunfire wraps', 'handwraps', 5, ARRAY['might','finesse']::text[], 210, 5, 'monk'),
  ('tanto-plain', 'Plain twin tanto', 'tanto', 1, ARRAY['might','finesse']::text[], 90, 1, 'assassin'),
  ('tanto-iron', 'Iron twin tanto', 'tanto', 2, ARRAY['might','finesse']::text[], 120, 2, 'assassin'),
  ('tanto-rune', 'Rune-etched tanto', 'tanto', 3, ARRAY['might','finesse']::text[], 150, 3, 'assassin'),
  ('tanto-gilt', 'Gilded tanto', 'tanto', 4, ARRAY['might','finesse']::text[], 180, 4, 'assassin'),
  ('tanto-lotus', 'Crimson lotus tanto', 'tanto', 5, ARRAY['might','finesse']::text[], 210, 5, 'assassin')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, weapon_type = EXCLUDED.weapon_type, tier = EXCLUDED.tier, scaling = EXCLUDED.scaling, max_durability = EXCLUDED.max_durability, repair_per_point = EXCLUDED.repair_per_point, subclass = EXCLUDED.subclass;

-- ─── Shop cosmetics ─────────────────────────────────────────────────────────
INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, cosmetic, sprite_url) VALUES
  ('vg-skin-ivory-aegis', 'Ivory aegis', 'weapon_skin', 'A Guardian''s shield and sword in pale ivory and brass. Looks only; every tier keeps its own trim.', 800, NULL, '{"subclass":"guardian","skin":"ivory"}', '/assets/game/classes/vanguard/shop/vg-skin-ivory-aegis.svg'),
  ('vg-skin-obsidian-hammer', 'Obsidian war hammer', 'weapon_skin', 'A Juggernaut''s hammer head in black glassy stone. Looks only.', 800, NULL, '{"subclass":"juggernaut","skin":"obsidian"}', '/assets/game/classes/vanguard/shop/vg-skin-obsidian-hammer.svg'),
  ('vg-skin-temple-wraps', 'Temple-red wraps', 'weapon_skin', 'A Martial Artist''s wraps in temple red with gold stitching. Looks only.', 800, NULL, '{"subclass":"monk","skin":"temple-red"}', '/assets/game/classes/vanguard/shop/vg-skin-temple-wraps.svg'),
  ('vg-skin-moonlit-tanto', 'Moonlit tanto', 'weapon_skin', 'An Assassin''s twin tanto with pale moonlit blades. Looks only.', 800, NULL, '{"subclass":"assassin","skin":"moonlit"}', '/assets/game/classes/vanguard/shop/vg-skin-moonlit-tanto.svg'),
  ('vg-skin-lotus-fire', 'Lotus-fire tanto', 'weapon_skin', 'Twin tanto with red lotus fire running down the blades. Looks only.', NULL, 200, '{"subclass":"assassin","skin":"lotus-fire","animated":true}', '/assets/game/classes/vanguard/shop/vg-skin-lotus-fire.svg'),
  ('vg-aura-sunforge', 'Sunforge aura', 'aura', 'Your aura in forge orange and gold.', 300, NULL, '{"ramp":["#fffbea","#ffb347","#5a2a08"]}', '/assets/game/classes/vanguard/shop/vg-aura-sunforge.svg'),
  ('vg-aura-ink-ember', 'Ink and ember aura', 'aura', 'Your aura in ember red over ink black.', 300, NULL, '{"ramp":["#fff1ee","#ff5a3c","#120709"]}', '/assets/game/classes/vanguard/shop/vg-aura-ink-ember.svg'),
  ('vg-aura-dawn-dusk', 'Dawn and dusk shimmer', 'aura', 'A two-tone aura that shimmers between dawn gold and dusk violet.', NULL, 150, '{"ramp":["#fffaf0","#ffd36e","#2e1c4a"],"shimmer":["#ffd36e","#8a6cff"]}', '/assets/game/classes/vanguard/shop/vg-aura-dawn-dusk.svg'),
  ('vg-frame-hammered', 'Hammered iron frame', 'frame', 'A nameplate frame of hammered iron with rivets.', 250, NULL, '{"image":"/assets/game/frames/vanguard-hammered.svg"}', '/assets/game/classes/vanguard/shop/vg-frame-hammered.svg'),
  ('vg-frame-brush', 'Ink brush frame', 'frame', 'A nameplate frame drawn in one stroke of black ink with a red seal.', 250, NULL, '{"image":"/assets/game/frames/vanguard-brush.svg"}', '/assets/game/classes/vanguard/shop/vg-frame-brush.svg')
ON CONFLICT (slug) DO NOTHING;

-- ─── Off sale until launch ──────────────────────────────────────────────────
-- Class cosmetics stay inactive while classes_v2 is off (wave 5 turns them on with the flag), so none of the rows
-- above can be bought, Gem-priced ones included, before members can use classes v2.
UPDATE shop_items SET active = FALSE WHERE category IN ('weapon_skin', 'aura', 'frame') AND NOT public.classes_v2_on();
