-- Local smoke test for draft 20261002181044_classes_v2 (last in the game chain; same
-- throwaway cluster). Never Supabase. Leaves the classes_v2 flag off as it found it.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000002c1', 'cv2-a@x'), ('00000000-0000-4000-8000-0000000002c2', 'cv2-b@x'),
  ('00000000-0000-4000-8000-0000000002c3', 'cv2-c@x') ON CONFLICT DO NOTHING;
-- Two signature types with their tiers (each family wave seeds the real ones).
INSERT INTO weapons (key, name, weapon_type, tier, scaling, max_durability, repair_per_point, subclass) VALUES
  ('cv2-staff-1', 'Smoke staff I', 'cv2staff', 1, ARRAY['arcana'], 90, 1, 'elementalist'),
  ('cv2-staff-2', 'Smoke staff II', 'cv2staff', 2, ARRAY['arcana'], 120, 2, 'elementalist'),
  ('cv2-staff-3', 'Smoke staff III', 'cv2staff', 3, ARRAY['arcana'], 150, 3, 'elementalist'),
  ('cv2-cards-1', 'Smoke cards I', 'cv2cards', 1, ARRAY['arcana'], 90, 1, 'illusionist'),
  ('cv2-cards-2', 'Smoke cards II', 'cv2cards', 2, ARRAY['arcana'], 120, 2, 'illusionist');
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000002c1'; B uuid := '00000000-0000-4000-8000-0000000002c2'; C uuid := '00000000-0000-4000-8000-0000000002c3';
  ord text[]; att uuid; v int; skin uuid; aura uuid; out jsonb;
BEGIN
  -- The curve matches web/lib/combat/mastery.ts: 800 + 300·(M − 1) per level, 66,500 to 20.
  ASSERT combat_mastery_for_xp(0) = 1 AND combat_mastery_for_xp(799) = 1 AND combat_mastery_for_xp(800) = 2, 'cv2 curve start';
  ASSERT combat_mastery_for_xp(3299) = 3 AND combat_mastery_for_xp(3300) = 4 AND combat_mastery_for_xp(11900) = 8, 'cv2 curve checkpoints';
  ASSERT combat_mastery_for_xp(66499) = 19 AND combat_mastery_for_xp(66500) = 20 AND combat_mastery_for_xp(9999999) = 20, 'cv2 curve 20';
  ASSERT (SELECT value FROM economy_settings WHERE key = 'classes_v2') = 0, 'cv2 flag ships off';
  -- Weapon types open to a pattern; a type that isn't one is refused.
  BEGIN INSERT INTO weapons (key, name, weapon_type, tier, scaling, max_durability, repair_per_point) VALUES ('cv2-bad', 'Bad', 'Bad Type', 1, ARRAY['might'], 90, 1); RAISE EXCEPTION 'cv2 expected an error 1';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO weapons (key, name, weapon_type, tier, scaling, max_durability, repair_per_point, subclass) VALUES ('cv2-staff-1b', 'Twin', 'cv2staff', 1, ARRAY['arcana'], 90, 1, 'elementalist'); RAISE EXCEPTION 'cv2 expected an error 2';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  INSERT INTO member_identity (member_id, family) VALUES (A, 'Arcane'), (B, 'Arcane'), (C, 'Arcane') ON CONFLICT (member_id) DO UPDATE SET family = EXCLUDED.family;
  PERFORM combat_grant_xp(A, 11625, 'admin', 'x', 'cv2-xp-a');
  PERFORM combat_grant_xp(B, 11625, 'admin', 'x', 'cv2-xp-b');
  PERFORM combat_grant_xp(C, 11625, 'admin', 'x', 'cv2-xp-c');
  PERFORM wallet_apply(A, 'coins', 1000, 'admin', 'smoke seed', 'cv2-seed-a');

  -- ── Flag off: today's rules hold (a change costs the fee, the gate's starters, no mastery) ──
  PERFORM combat_choose_subclass(A, 'elementalist', 'Arcane', 'cv2-sub-a1');
  ASSERT (SELECT count(*) FROM member_weapons WHERE member_id = A AND weapon_key IN ('bow-willow', 'staff-oak', 'tome-spirits')) = 3, 'cv2 off: starters';
  ASSERT NOT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = A AND weapon_key LIKE 'cv2-%'), 'cv2 off: no signature grant';
  PERFORM combat_record_kill(A, 'shadow-fox', 'cv2-kill-a0');
  ASSERT NOT EXISTS (SELECT 1 FROM member_subclass_mastery WHERE member_id = A), 'cv2 off: kills train no mastery';
  ASSERT (SELECT subclass FROM combat_xp_ledger WHERE member_id = A AND idempotency_key = 'kill:cv2-kill-a0') IS NULL, 'cv2 off: ledger subclass null';
  v := (SELECT coins FROM wallets WHERE member_id = A);
  SELECT * INTO r FROM combat_choose_subclass(A, 'illusionist', 'Arcane', 'cv2-sub-a2');
  ASSERT r.fee = 250 AND (SELECT coins FROM wallets WHERE member_id = A) = v - 250, 'cv2 off: the change still costs the fee';

  -- ── Flag on ──
  UPDATE economy_settings SET value = 1 WHERE key = 'classes_v2';
  -- First choice: free, a mastery row at 0, the tier-1 signature weapon, no starters.
  SELECT * INTO r FROM combat_choose_subclass(B, 'elementalist', 'Arcane', 'cv2-sub-b1');
  ASSERT r.fee = 0 AND r.subclass = 'elementalist' AND NOT r.replayed, 'cv2 first choice free';
  ASSERT (SELECT xp FROM member_subclass_mastery WHERE member_id = B AND subclass = 'elementalist') = 0, 'cv2 mastery row at 0';
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = B AND weapon_key = 'cv2-staff-1'), 'cv2 tier-1 signature granted';
  ASSERT NOT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = B AND weapon_key IN ('bow-willow', 'staff-oak', 'tome-spirits')), 'cv2 no gate starters';
  -- Locked: a change needs the repick token.
  BEGIN PERFORM combat_choose_subclass(B, 'illusionist', 'Arcane', 'cv2-sub-b2'); RAISE EXCEPTION 'cv2 expected an error 3';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'cv2 locked: ' || SQLERRM; END;
  -- Ruins XP trains the active subclass (kills, missions); club events and admin grants don't; replays count once.
  SELECT * INTO r FROM combat_record_kill(B, 'shadow-fox', 'cv2-kill-b1');
  SELECT * INTO r FROM combat_record_kill(B, 'shadow-fox', 'cv2-kill-b1');
  ASSERT (SELECT xp FROM member_subclass_mastery WHERE member_id = B AND subclass = 'elementalist') = (SELECT xp FROM enemy_types WHERE key = 'shadow-fox'), 'cv2 kill trains once';
  ASSERT (SELECT subclass FROM combat_xp_ledger WHERE member_id = B AND idempotency_key = 'kill:cv2-kill-b1') = 'elementalist', 'cv2 ledger names the subclass';
  PERFORM combat_grant_xp(B, 2000, 'event', 'x', 'cv2-event-b1');
  PERFORM combat_grant_xp(B, 500, 'admin', 'x', 'cv2-admin-b1');
  ASSERT (SELECT xp FROM member_subclass_mastery WHERE member_id = B AND subclass = 'elementalist') = (SELECT xp FROM enemy_types WHERE key = 'shadow-fox'), 'cv2 events and admin train nothing';
  SELECT * INTO r FROM combat_mission_start(B, 'hunt-foxes', 'cv2-mis-b1');
  UPDATE mission_progress SET state = 'ready' WHERE id = r.progress_id;
  PERFORM combat_mission_complete(r.progress_id, B);
  ASSERT (SELECT xp FROM member_subclass_mastery WHERE member_id = B AND subclass = 'elementalist') = (SELECT xp FROM enemy_types WHERE key = 'shadow-fox') + 300, 'cv2 mission trains';
  ASSERT (SELECT mastery FROM member_subclass_mastery WHERE member_id = B AND subclass = 'elementalist') = 1, 'cv2 below 800 is mastery 1';
  -- The paid redo grants the token; the change spends it (no fee); the new weapon comes at the highest signature tier owned.
  INSERT INTO member_weapons (member_id, weapon_key, durability) VALUES (B, 'cv2-staff-3', 150);
  ord := ARRAY(SELECT format('%s%s', d, lpad(n::text, 2, '0')) FROM unnest(ARRAY['ei','sn','tf','jp']) d, generate_series(1, 16) n);
  PERFORM wallet_apply(B, 'coins', 1000, 'admin', 'smoke seed', 'cv2-seed-b');
  UPDATE member_identity SET quiz_taken_at = NOW() - interval '8 days' WHERE member_id = B;
  SELECT * INTO r FROM oracle_start(B, 'cv2-oracle-b1', ord, 250, 7);
  ASSERT r.fee_paid = 250, 'cv2 the redo is paid';
  att := r.attempt_id;
  INSERT INTO oracle_responses (attempt_id, item_id, value) SELECT att, x, 1 FROM unnest(ord) x;
  PERFORM oracle_complete(att, B, 'ENTP', 'Arcane', '{}', '{}');
  ASSERT (SELECT repick_source FROM member_progression WHERE member_id = B) = 'oracle', 'cv2 a paid reading grants the token';
  v := (SELECT coins FROM wallets WHERE member_id = B);
  SELECT * INTO r FROM combat_choose_subclass(B, 'illusionist', 'Arcane', 'cv2-sub-b3');
  ASSERT r.fee = 0 AND NOT r.replayed AND (SELECT coins FROM wallets WHERE member_id = B) = v, 'cv2 the change is free with the token';
  ASSERT (SELECT repick_source FROM member_progression WHERE member_id = B) IS NULL, 'cv2 the token is spent';
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = B AND weapon_key = 'cv2-cards-2'), 'cv2 carry-over: the best tier the type has up to the owned 3';
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = B AND weapon_key = 'cv2-staff-1'), 'cv2 old signature weapons stay';
  SELECT * INTO r FROM combat_choose_subclass(B, 'illusionist', 'Arcane', 'cv2-sub-b3');
  ASSERT r.replayed AND r.subclass = 'illusionist', 'cv2 the change replays by its key';
  BEGIN PERFORM combat_choose_subclass(B, 'elementalist', 'Arcane', 'cv2-sub-b4'); RAISE EXCEPTION 'cv2 expected an error 4';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'cv2 locked again: ' || SQLERRM; END;
  -- Mastery stays with each subclass: kills now train the illusionist, the elementalist row keeps its XP.
  v := (SELECT xp FROM member_subclass_mastery WHERE member_id = B AND subclass = 'elementalist');
  PERFORM combat_record_kill(B, 'rune-wisp', 'cv2-kill-b2');
  ASSERT (SELECT xp FROM member_subclass_mastery WHERE member_id = B AND subclass = 'elementalist') = v, 'cv2 the old row is kept';
  ASSERT (SELECT xp FROM member_subclass_mastery WHERE member_id = B AND subclass = 'illusionist') > 0, 'cv2 the new row trains';
  -- The launch gift: one free in-family repick, no reading.
  PERFORM combat_choose_subclass(C, 'necromancer', 'Arcane', 'cv2-sub-c1');
  UPDATE member_progression SET repick_source = 'launch' WHERE member_id = C;
  SELECT * INTO r FROM combat_choose_subclass(C, 'transmuter', 'Arcane', 'cv2-sub-c2');
  ASSERT r.fee = 0 AND (SELECT repick_source FROM member_progression WHERE member_id = C) IS NULL, 'cv2 launch token spent';
  BEGIN PERFORM combat_choose_subclass(C, 'priest', 'Warden', 'cv2-sub-c3'); RAISE EXCEPTION 'cv2 expected an error 5';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'wrong_family', 'cv2 family still holds: ' || SQLERRM; END;

  -- ── Cosmetics: categories, ownership, mastery milestones ──
  INSERT INTO shop_items (slug, display_name, category, description, price_coins, cosmetic) VALUES
    ('cv2-skin', 'Smoke skin', 'weapon_skin', 'x', 800, '{"subclass":"illusionist","skin":"smoke"}'),
    ('cv2-aura', 'Smoke aura', 'aura', 'x', 300, '{"ramp":["#ffffff","#b48cff","#3a2466"]}');
  BEGIN INSERT INTO shop_items (slug, display_name, category, description, price_coins) VALUES ('cv2-bad', 'Bad', 'weapon_skin', 'x', 800); RAISE EXCEPTION 'cv2 expected an error 6';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO shop_items (slug, display_name, category, description, tc_price, cosmetic) VALUES ('cv2-frame', 'Smoke frame', 'frame', 'x', 120, '{"image":"/x.png"}');
  skin := (SELECT id FROM shop_items WHERE slug = 'cv2-skin'); aura := (SELECT id FROM shop_items WHERE slug = 'cv2-aura');
  BEGIN PERFORM combat_equip_cosmetic(B, 'illusionist', 'weapon_skin', skin::text); RAISE EXCEPTION 'cv2 expected an error 7';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_owned', 'cv2 skin not owned: ' || SQLERRM; END;
  INSERT INTO member_inventory (member_id, item_id, qty) VALUES (B, skin, 1), (B, aura, 1);
  out := combat_equip_cosmetic(B, 'illusionist', 'weapon_skin', skin::text);
  ASSERT out->>'weapon_skin' = skin::text, 'cv2 skin equipped';
  BEGIN PERFORM combat_equip_cosmetic(B, 'elementalist', 'weapon_skin', skin::text); RAISE EXCEPTION 'cv2 expected an error 8';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_cosmetic', 'cv2 skin fits one weapon: ' || SQLERRM; END;
  BEGIN PERFORM combat_equip_cosmetic(B, 'illusionist', 'frame', aura::text); RAISE EXCEPTION 'cv2 expected an error 9';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_cosmetic', 'cv2 kind must match: ' || SQLERRM; END;
  BEGIN PERFORM combat_equip_cosmetic(B, 'illusionist', 'frame', 'mastery:bronze'); RAISE EXCEPTION 'cv2 expected an error 10';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'cv2 bronze at 5: ' || SQLERRM; END;
  UPDATE member_subclass_mastery SET xp = 7000, mastery = combat_mastery_for_xp(7000) WHERE member_id = B AND subclass = 'illusionist';
  out := combat_equip_cosmetic(B, 'illusionist', 'frame', 'mastery:bronze');
  ASSERT out->>'frame' = 'mastery:bronze' AND out->>'weapon_skin' = skin::text, 'cv2 bronze at mastery 6';
  BEGIN PERFORM combat_equip_cosmetic(B, 'illusionist', 'frame', 'mastery:gold'); RAISE EXCEPTION 'cv2 expected an error 11';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'cv2 gold at 20: ' || SQLERRM; END;
  out := combat_equip_cosmetic(B, 'illusionist', 'weapon_skin', NULL);
  ASSERT NOT (out ? 'weapon_skin') AND out->>'frame' = 'mastery:bronze', 'cv2 unequip';
  BEGIN PERFORM combat_equip_cosmetic(B, 'necromancer', 'frame', NULL); RAISE EXCEPTION 'cv2 expected an error 12';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', 'cv2 a subclass never played: ' || SQLERRM; END;

  UPDATE economy_settings SET value = 0 WHERE key = 'classes_v2';
  RAISE NOTICE 'classes v2 ok';
END $$;

-- Members read mastery (public with the profile) but write nothing and call nothing.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000002c1","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM member_subclass_mastery WHERE member_id = '00000000-0000-4000-8000-0000000002c2') = 2, 'cv2 mastery readable';
  BEGIN UPDATE member_subclass_mastery SET xp = 99999 WHERE member_id = '00000000-0000-4000-8000-0000000002c1';
    ASSERT NOT FOUND, 'cv2 members cannot write mastery';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM combat_equip_cosmetic('00000000-0000-4000-8000-0000000002c2', 'illusionist', 'frame', NULL); RAISE EXCEPTION 'cv2 expected an error 13';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM classes_v2_on(); RAISE EXCEPTION 'cv2 expected an error 14';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'classes v2: members read mastery, write and call nothing ok';
END $$;
ROLLBACK;
