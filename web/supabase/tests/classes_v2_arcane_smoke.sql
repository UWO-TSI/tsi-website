-- Local smoke test for draft 20261003015109_classes_v2_arcane_seed (the Arcane wave): the four signature types with
-- their five tiers, the twelve shop cosmetics, the Pollen form's trait. Throwaway local Postgres after every migration,
-- with the pre_* seeds. Never Supabase. Fails before the migration (no prism staff, no pollen trait). Leaves the
-- classes_v2 flag as it found it.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000003a1', 'arcane-a@x'), ('00000000-0000-4000-8000-0000000003a2', 'arcane-b@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000003a1'; B uuid := '00000000-0000-4000-8000-0000000003a2'; flag int; skin uuid; out jsonb;
BEGIN
  -- Four types, five tiers each, one subclass each, arcana scaling, the systems' durability and repair rule.
  ASSERT (SELECT count(*) FROM weapons WHERE subclass IN ('elementalist', 'illusionist', 'necromancer', 'transmuter')
          AND weapon_type IN ('prism-staff', 'trick-deck', 'bone-tome', 'tooth-charm')) = 20, 'arcane: 20 signature rows';
  ASSERT (SELECT array_agg(DISTINCT weapon_type ORDER BY weapon_type) FROM weapons WHERE subclass = 'elementalist' AND weapon_type <> 'cv2staff') = ARRAY['prism-staff'], 'arcane: one type a subclass';
  ASSERT (SELECT array_agg(tier ORDER BY tier) FROM weapons WHERE weapon_type = 'bone-tome') = ARRAY[1, 2, 3, 4, 5], 'arcane: tiers 1-5';
  ASSERT (SELECT bool_and(scaling = ARRAY['arcana'] AND max_durability = 60 + 30 * tier AND repair_per_point = tier) FROM weapons WHERE weapon_type = 'tooth-charm'), 'arcane: the systems rule';
  ASSERT (SELECT subclass FROM weapons WHERE key = 'trick-deck-4') = 'illusionist', 'arcane: the deck is the illusionist''s';
  -- The Pollen form's trait, and a Transmuter's pollen-sprite kill counts toward it.
  ASSERT (SELECT trait FROM enemy_types WHERE key = 'pollen-sprite') = 'pollen-swarm', 'arcane: pollen trait';
  ASSERT (SELECT trait FROM enemy_types WHERE key = 'thorn-crab') = 'crab-shell', 'arcane: the other traits stand';
  INSERT INTO member_identity (member_id, family) VALUES (A, 'Arcane'), (B, 'Arcane') ON CONFLICT (member_id) DO UPDATE SET family = EXCLUDED.family;
  PERFORM combat_grant_xp(A, 11625, 'admin', 'x', 'arcane-xp-a');
  PERFORM combat_grant_xp(B, 11625, 'admin', 'x', 'arcane-xp-b');
  flag := (SELECT value FROM economy_settings WHERE key = 'classes_v2');
  UPDATE economy_settings SET value = 1 WHERE key = 'classes_v2';
  PERFORM combat_choose_subclass(A, 'transmuter', 'Arcane', 'arcane-sub-a1');
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = A AND weapon_key = 'tooth-charm-1'), 'arcane: the tier-1 charm granted';
  PERFORM combat_record_kill(A, 'pollen-sprite', 'arcane-kill-a1');
  PERFORM combat_record_kill(A, 'pollen-sprite', 'arcane-kill-a2');
  ASSERT (SELECT (traits->>'pollen-swarm')::int FROM member_progression WHERE member_id = A) = 2, 'arcane: two defeats train the pollen trait';
  PERFORM combat_choose_subclass(B, 'elementalist', 'Arcane', 'arcane-sub-b1');
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = B AND weapon_key = 'prism-staff-1'), 'arcane: the tier-1 prism staff granted';
  PERFORM combat_record_kill(B, 'pollen-sprite', 'arcane-kill-b1');
  ASSERT NOT ((SELECT traits FROM member_progression WHERE member_id = B) ? 'pollen-swarm'), 'arcane: only a transmuter learns forms';
  -- Twelve cosmetics: skins keyed to their subclass's weapon, aura colour sets of three; three in Gems.
  ASSERT (SELECT count(*) FROM shop_items WHERE slug LIKE 'skin-%' AND category = 'weapon_skin' AND cosmetic->>'subclass' IN ('elementalist', 'illusionist', 'necromancer', 'transmuter')) = 6, 'arcane: six skins';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug LIKE 'aura-%' AND category = 'aura' AND jsonb_array_length(cosmetic->'ramp') = 3 AND cosmetic->>'subclass' IN ('elementalist', 'illusionist', 'necromancer', 'transmuter')) = 6, 'arcane: six aura sets';
  ASSERT (SELECT count(*) FROM shop_items WHERE position BETWEEN 900 AND 911 AND tc_price IS NOT NULL AND price_coins IS NULL) = 3, 'arcane: three Gem items';
  skin := (SELECT id FROM shop_items WHERE slug = 'skin-prism-ember');
  INSERT INTO member_inventory (member_id, item_id, qty) VALUES (B, skin, 1);
  out := combat_equip_cosmetic(B, 'elementalist', 'weapon_skin', skin::text);
  ASSERT out->>'weapon_skin' = skin::text, 'arcane: the staff skin equips on the elementalist';
  BEGIN PERFORM combat_equip_cosmetic(A, 'transmuter', 'weapon_skin', skin::text); RAISE EXCEPTION 'arcane expected an error';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_owned', 'arcane: not owned: ' || SQLERRM; END;
  UPDATE economy_settings SET value = flag WHERE key = 'classes_v2';
  RAISE NOTICE 'classes_v2_arcane smoke ok';
END $$;
