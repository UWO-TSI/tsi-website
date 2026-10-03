-- ─── Classes v2, the Ranger family: signature weapons and shop cosmetics ──────
--
-- DRAFT 2026-10-03. NOT APPLIED. Apply after 20261003015109_classes_v2_arcane_seed (and
-- 20261002181044_classes_v2). Spec: specs/classes/design-sheet.md, the Marksman,
-- Sniper, Hunter and Gunslinger sections (LOCKED), §1.5 signature weapons, §1.10
-- shop cosmetics. Mirrored in web/lib/combat/weapons.ts (signature tiers) and
-- web/lib/combat/rangerKits.ts (the kits). Test: web/supabase/tests/classes_v2_ranger_smoke.sql.
--
-- Four signature types, one per subclass, five tiers each on one trim kit (wood
-- and cloth, iron, rune-etched, gold with a glow part, animated runes): the
-- Marksman's recurve bow, the Sniper's long rifle, the Hunter's harpoon crossbow,
-- the Gunslinger's revolver. Finesse scales them all. combat_choose_subclass
-- (20261002181044) grants the tier-1 weapon at the choice, or the highest tier of
-- any signature weapon owned on a repick. Nothing changes while classes_v2 is off.
--
-- Cosmetics (none sellable until the flag is on: inactive rows, like every
-- classes v2 item): a weapon skin per subclass and one animated skin, two aura
-- colour sets and an animated one, a nameplate frame. Coins mostly; the Gem-priced
-- ones show their Gem price only (no rate anywhere).

INSERT INTO weapons (key, name, weapon_type, tier, scaling, max_durability, repair_per_point, subclass) VALUES
  ('recurve-1', 'Ash recurve', 'recurve', 1, ARRAY['finesse']::text[], 90, 1, 'marksman'),
  ('recurve-2', 'Iron-tipped recurve', 'recurve', 2, ARRAY['finesse']::text[], 120, 2, 'marksman'),
  ('recurve-3', 'Runed recurve', 'recurve', 3, ARRAY['finesse']::text[], 150, 3, 'marksman'),
  ('recurve-4', 'Gilded recurve', 'recurve', 4, ARRAY['finesse']::text[], 180, 4, 'marksman'),
  ('recurve-5', 'Starlit recurve', 'recurve', 5, ARRAY['finesse']::text[], 210, 5, 'marksman'),
  ('rifle-1', 'Brass long rifle', 'rifle', 1, ARRAY['finesse']::text[], 90, 1, 'sniper'),
  ('rifle-2', 'Iron long rifle', 'rifle', 2, ARRAY['finesse']::text[], 120, 2, 'sniper'),
  ('rifle-3', 'Runed long rifle', 'rifle', 3, ARRAY['finesse']::text[], 150, 3, 'sniper'),
  ('rifle-4', 'Gilded long rifle', 'rifle', 4, ARRAY['finesse']::text[], 180, 4, 'sniper'),
  ('rifle-5', 'Starlit long rifle', 'rifle', 5, ARRAY['finesse']::text[], 210, 5, 'sniper'),
  ('harpoon-1', 'Harpoon crossbow', 'harpoon', 1, ARRAY['finesse']::text[], 90, 1, 'hunter'),
  ('harpoon-2', 'Iron harpoon crossbow', 'harpoon', 2, ARRAY['finesse']::text[], 120, 2, 'hunter'),
  ('harpoon-3', 'Runed harpoon crossbow', 'harpoon', 3, ARRAY['finesse']::text[], 150, 3, 'hunter'),
  ('harpoon-4', 'Gilded harpoon crossbow', 'harpoon', 4, ARRAY['finesse']::text[], 180, 4, 'hunter'),
  ('harpoon-5', 'Starlit harpoon crossbow', 'harpoon', 5, ARRAY['finesse']::text[], 210, 5, 'hunter'),
  ('sixgun-1', 'Walnut revolver', 'sixgun', 1, ARRAY['finesse']::text[], 90, 1, 'gunslinger'),
  ('sixgun-2', 'Iron revolver', 'sixgun', 2, ARRAY['finesse']::text[], 120, 2, 'gunslinger'),
  ('sixgun-3', 'Runed revolver', 'sixgun', 3, ARRAY['finesse']::text[], 150, 3, 'gunslinger'),
  ('sixgun-4', 'Gilded revolver', 'sixgun', 4, ARRAY['finesse']::text[], 180, 4, 'gunslinger'),
  ('sixgun-5', 'Starlit revolver', 'sixgun', 5, ARRAY['finesse']::text[], 210, 5, 'gunslinger')
ON CONFLICT (key) DO NOTHING;

INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, cosmetic, active, sprite_url) VALUES
  ('skin-marksman-fletcher', 'Fletcher''s recurve', 'weapon_skin', 'A Marksman skin: pale ash limbs, sea-blue fletching, every tier.', 800, NULL,
    '{"subclass":"marksman","skin":"fletcher"}', FALSE, '/assets/game/classes/cosmetics/skin-marksman-fletcher.svg'),
  ('skin-sniper-longshot', 'Longshot brass', 'weapon_skin', 'A Sniper skin: polished brass and dark walnut, every tier.', 800, NULL,
    '{"subclass":"sniper","skin":"longshot"}', FALSE, '/assets/game/classes/cosmetics/skin-sniper-longshot.svg'),
  ('skin-hunter-whalebone', 'Whalebone harpoon', 'weapon_skin', 'A Hunter skin: bone-white stock and a tarred chain, every tier.', 800, NULL,
    '{"subclass":"hunter","skin":"whalebone"}', FALSE, '/assets/game/classes/cosmetics/skin-hunter-whalebone.svg'),
  ('skin-gunslinger-pearl', 'Pearl-grip revolver', 'weapon_skin', 'A Gunslinger skin: a pearl grip and a blued barrel, every tier.', 800, NULL,
    '{"subclass":"gunslinger","skin":"pearl"}', FALSE, '/assets/game/classes/cosmetics/skin-gunslinger-pearl.svg'),
  ('skin-gunslinger-starfire', 'Starfire revolver', 'weapon_skin', 'An animated Gunslinger skin: sparks run the cylinder when it spins.', NULL, 200,
    '{"subclass":"gunslinger","skin":"starfire","animated":true}', FALSE, '/assets/game/classes/cosmetics/skin-gunslinger-starfire.svg'),
  ('aura-ranger-tide', 'Tideline aura', 'aura', 'Sea-glass motes for any subclass.', 300, NULL,
    '{"ramp":["#f2fffd","#4fd6c4","#0b3b3f"]}', FALSE, '/assets/game/classes/cosmetics/aura-ranger-tide.svg'),
  ('aura-ranger-dusk', 'Duskwing aura', 'aura', 'Twilight-blue motes for any subclass.', 300, NULL,
    '{"ramp":["#f6f2ff","#7c8cff","#1d1d5a"]}', FALSE, '/assets/game/classes/cosmetics/aura-ranger-dusk.svg'),
  ('aura-ranger-aurora', 'Aurora aura', 'aura', 'A two-tone shimmer, green into blue, for any subclass.', NULL, 150,
    '{"ramp":["#f2fff6","#62e0b0","#1b2f66"],"shimmer":["#62e0b0","#6f8dff"]}', FALSE, '/assets/game/classes/cosmetics/aura-ranger-aurora.svg'),
  ('frame-ranger-fletching', 'Fletching frame', 'frame', 'A nameplate frame of crossed arrows.', 250, NULL,
    '{"image":"/assets/game/frames/ranger-fletching.svg"}', FALSE, '/assets/game/classes/cosmetics/frame-ranger-fletching.svg')
ON CONFLICT (slug) DO NOTHING;

-- Class cosmetics stay off sale until the classes v2 launch (the coordinator's guard, as the Arcane seed ends): wave 5
-- sets them active when it turns economy_settings.classes_v2 on.
UPDATE shop_items SET active = FALSE WHERE category IN ('weapon_skin', 'aura', 'frame') AND NOT public.classes_v2_on();
