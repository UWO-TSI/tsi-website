-- Local smoke test for draft 20261003023000_classes_v2_ranger_seed (the game chain, after the classes v2 and Arcane seeds).
-- Never Supabase. Fails before the migration (no Ranger signature rows). Leaves the classes_v2 flag off.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000004b1', 'ranger-a@x'), ('00000000-0000-4000-8000-0000000004b2', 'ranger-b@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000004b1'; B uuid := '00000000-0000-4000-8000-0000000004b2'; s text;
BEGIN
  -- Four types, one per subclass, tiers 1–5, finesse, the durability and repair ladder of every weapon.
  FOREACH s IN ARRAY ARRAY['marksman:recurve', 'sniper:rifle', 'hunter:harpoon', 'gunslinger:sixgun'] LOOP
    ASSERT (SELECT array_agg(tier ORDER BY tier) FROM weapons WHERE subclass = split_part(s, ':', 1)) = ARRAY[1, 2, 3, 4, 5], 'ranger tiers ' || s;
    ASSERT (SELECT bool_and(weapon_type = split_part(s, ':', 2) AND scaling = ARRAY['finesse'] AND max_durability = 60 + tier * 30 AND repair_per_point = tier AND active)
      FROM weapons WHERE subclass = split_part(s, ':', 1)), 'ranger rows ' || s;
    ASSERT NOT EXISTS (SELECT 1 FROM weapons WHERE weapon_type = split_part(s, ':', 2) AND subclass IS DISTINCT FROM split_part(s, ':', 1)), 'the type is theirs alone ' || s;
  END LOOP;
  ASSERT (SELECT count(*) FROM weapons WHERE subclass IN ('marksman', 'sniper', 'hunter', 'gunslinger')) = 20, 'twenty ranger weapons';
  -- Cosmetics: nine rows, inactive until launch, one price each, Gem rows show only Gems.
  ASSERT (SELECT count(*) FROM shop_items WHERE slug ~ '^(skin-(marksman|sniper|hunter|gunslinger)|aura-ranger|frame-ranger)' AND sprite_url LIKE '/assets/game/classes/cosmetics/%.svg') = 9, 'nine ranger cosmetics, each with its icon';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug ~ '^(skin-(marksman|sniper|hunter|gunslinger)|aura-ranger|frame-ranger)' AND active), 'cosmetics wait for launch';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug ~ '^(skin-|aura-ranger|frame-ranger)' AND slug ~ '(marksman|sniper|hunter|gunslinger|ranger)' AND tc_price IS NOT NULL) = 2, 'two Gem items';
  ASSERT (SELECT bool_and(cosmetic->>'subclass' IN ('marksman', 'sniper', 'hunter', 'gunslinger')) FROM shop_items WHERE slug LIKE 'skin-%' AND category = 'weapon_skin'
    AND slug ~ '(marksman|sniper|hunter|gunslinger)'), 'each skin fits its subclass';

  -- With the flag on, choosing a Ranger grants its tier-1 signature weapon; a repick comes at the best tier owned.
  INSERT INTO member_identity (member_id, family) VALUES (A, 'Ranger'), (B, 'Ranger') ON CONFLICT (member_id) DO UPDATE SET family = EXCLUDED.family;
  PERFORM combat_grant_xp(A, 11625, 'admin', 'x', 'ranger-xp-a');
  PERFORM combat_grant_xp(B, 11625, 'admin', 'x', 'ranger-xp-b');
  UPDATE economy_settings SET value = 1 WHERE key = 'classes_v2';
  SELECT * INTO r FROM combat_choose_subclass(A, 'gunslinger', 'Ranger', 'ranger-sub-a1');
  ASSERT r.fee = 0 AND EXISTS (SELECT 1 FROM member_weapons WHERE member_id = A AND weapon_key = 'sixgun-1'), 'the walnut revolver at the choice';
  PERFORM combat_choose_subclass(B, 'marksman', 'Ranger', 'ranger-sub-b1');
  INSERT INTO member_weapons (member_id, weapon_key, durability) VALUES (B, 'recurve-4', 180);
  UPDATE member_progression SET repick_source = 'launch' WHERE member_id = B;
  PERFORM combat_choose_subclass(B, 'sniper', 'Ranger', 'ranger-sub-b2');
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = B AND weapon_key = 'rifle-4'), 'a repick keeps the tier: the gilded rifle';
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = B AND weapon_key = 'recurve-4'), 'the old weapon stays owned';
  UPDATE economy_settings SET value = 0 WHERE key = 'classes_v2';
  RAISE NOTICE 'classes v2 ranger seed ok';
END $$;
