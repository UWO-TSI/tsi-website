-- Local smoke test for 20261002191742_classes_v2_vanguard_seed (the Vanguard wave: four signature types × five tiers,
-- the family's shop cosmetics). Throwaway local Postgres after every migration, never Supabase. Fails before the
-- migration (no aegis, no vg- cosmetics). Leaves the classes_v2 flag off as it found it.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000003a1', 'vg-a@x'), ('00000000-0000-4000-8000-0000000003a2', 'vg-b@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000003a1'; B uuid := '00000000-0000-4000-8000-0000000003a2'; skin uuid; out jsonb;
BEGIN
  -- The four types, five tiers each, every one the Vanguard's and its own (one type per subclass, §1.5).
  ASSERT (SELECT count(*) FROM weapons WHERE subclass IN ('guardian', 'juggernaut', 'monk', 'assassin')) = 20, 'vg 20 signature rows';
  ASSERT (SELECT count(DISTINCT weapon_type) FROM weapons WHERE subclass IN ('guardian', 'juggernaut', 'monk', 'assassin')) = 4, 'vg four types';
  ASSERT (SELECT bool_and(n = 5) FROM (SELECT count(*) n FROM weapons WHERE subclass IN ('guardian', 'juggernaut', 'monk', 'assassin') GROUP BY subclass) x), 'vg tiers 1-5 each';
  ASSERT (SELECT count(DISTINCT subclass) = 1 FROM weapons WHERE weapon_type = 'aegis'), 'vg the aegis is the Guardian''s alone';
  ASSERT (SELECT tier = 1 AND max_durability = 90 AND scaling = ARRAY['might','vitality'] FROM weapons WHERE key = 'aegis-oak'), 'vg the oak aegis is tier 1';
  ASSERT (SELECT tier = 5 AND subclass = 'assassin' FROM weapons WHERE key = 'tanto-lotus'), 'vg the lotus tanto is tier 5';
  ASSERT (SELECT subclass FROM weapons WHERE key = 'handwraps-cotton') = 'monk', 'vg the Martial Artist keeps the key monk';
  ASSERT (SELECT subclass FROM weapons WHERE key = 'wraps-cloth') IS NULL, 'vg today''s wraps stay a common weapon';

  -- The cosmetics: three kinds, the shape check, two in Gems (no rate anywhere), the rest coins.
  ASSERT (SELECT count(*) FROM shop_items WHERE slug LIKE 'vg-%') = 10, 'vg ten cosmetics';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug LIKE 'vg-%' AND tc_price IS NOT NULL) = 2, 'vg two in Gems';
  ASSERT (SELECT bool_and(category IN ('weapon_skin', 'aura', 'frame')) FROM shop_items WHERE slug LIKE 'vg-%'), 'vg cosmetic categories';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug LIKE 'vg-%' AND (description ~* 'CAD|\$|dollar|rate')), 'vg no money talk';

  -- With the flag on, a Vanguard choice grants its tier-1 signature weapon; a repick carries the best tier owned.
  UPDATE economy_settings SET value = 1 WHERE key = 'classes_v2';
  INSERT INTO member_identity (member_id, family) VALUES (A, 'Vanguard'), (B, 'Vanguard') ON CONFLICT (member_id) DO UPDATE SET family = EXCLUDED.family;
  PERFORM combat_grant_xp(A, 11625, 'admin', 'x', 'vg-xp-a');
  PERFORM combat_grant_xp(B, 11625, 'admin', 'x', 'vg-xp-b');
  SELECT * INTO r FROM combat_choose_subclass(A, 'assassin', 'Vanguard', 'vg-sub-a1');
  ASSERT r.fee = 0 AND EXISTS (SELECT 1 FROM member_weapons WHERE member_id = A AND weapon_key = 'tanto-plain'), 'vg the plain tanto is granted';
  INSERT INTO member_weapons (member_id, weapon_key, durability) VALUES (A, 'tanto-gilt', 180);
  UPDATE member_progression SET repick_source = 'launch' WHERE member_id = A;
  PERFORM combat_choose_subclass(A, 'guardian', 'Vanguard', 'vg-sub-a2');
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = A AND weapon_key = 'aegis-gilt'), 'vg carry-over: the gilded aegis at tier 4';
  ASSERT NOT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = A AND weapon_key = 'aegis-dawn'), 'vg never above the best owned';
  PERFORM combat_choose_subclass(B, 'monk', 'Vanguard', 'vg-sub-b1');
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = B AND weapon_key = 'handwraps-cotton'), 'vg the Martial Artist gets the cotton wraps';

  -- A skin fits its own subclass's weapon only.
  skin := (SELECT id FROM shop_items WHERE slug = 'vg-skin-moonlit-tanto');
  INSERT INTO member_inventory (member_id, item_id, qty) VALUES (A, skin, 1);
  out := combat_equip_cosmetic(A, 'assassin', 'weapon_skin', skin::text);
  ASSERT out->>'weapon_skin' = skin::text, 'vg the tanto skin on the assassin';
  BEGIN PERFORM combat_equip_cosmetic(A, 'guardian', 'weapon_skin', skin::text); RAISE EXCEPTION 'vg expected an error 1';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_cosmetic', 'vg a tanto skin never fits the aegis: ' || SQLERRM; END;

  UPDATE economy_settings SET value = 0 WHERE key = 'classes_v2';
  RAISE NOTICE 'classes v2 vanguard ok';
END $$;
