-- Local smoke test for the DRAFT web/supabase/drafts/classes_v2_launch.sql (not a migration yet). Runs after the full
-- chain and every smoke, in the same throwaway cluster: zsh specs/evidence/launch-fixes/sql-smoke.sh --drafts. Never
-- Supabase. It applies the draft twice (\ir), with members playing between the runs, and checks the second run
-- changes nothing. It leaves the flag on (the launch's end state); nothing runs after it.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000005a1', 'launch-a@x'), -- Elementalist who owns the rune staff (a tier-3 weapon)
  ('00000000-0000-4000-8000-0000000005a2', 'launch-b@x'), -- Guardian with the gate's starters only (tier 1)
  ('00000000-0000-4000-8000-0000000005a3', 'launch-c@x'), -- below level 10, no subclass
  ('00000000-0000-4000-8000-0000000005a4', 'launch-d@x'), -- Priest who holds an Oracle token from a paid reading
  ('00000000-0000-4000-8000-0000000005a5', 'launch-e@x'), -- Hunter who owns a guardian drop (tier 4)
  ('00000000-0000-4000-8000-0000000005a6', 'launch-f@x')  -- Shaman with a mastery row already (a playtest's)
ON CONFLICT DO NOTHING;

-- Before: today's world (the flag off), the members as they'd stand at launch.
DO $$
DECLARE A uuid := '00000000-0000-4000-8000-0000000005a1'; B uuid := '00000000-0000-4000-8000-0000000005a2'; C uuid := '00000000-0000-4000-8000-0000000005a3';
  D uuid := '00000000-0000-4000-8000-0000000005a4'; E uuid := '00000000-0000-4000-8000-0000000005a5'; F uuid := '00000000-0000-4000-8000-0000000005a6';
BEGIN
  ASSERT (SELECT value FROM economy_settings WHERE key = 'classes_v2') = 0, 'launch: the flag starts off';
  ASSERT NOT EXISTS (SELECT 1 FROM data_backfills WHERE key = 'classes_v2_launch'), 'launch: never applied';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug IN ('aura-warden-sunrise', 'skin-prism-ember', 'skin-charm-amber', 'vg-frame-hammered') AND active), 'launch: class cosmetics off sale';
  INSERT INTO member_identity (member_id, family) VALUES (A, 'Arcane'), (B, 'Vanguard'), (C, 'Warden'), (D, 'Warden'), (E, 'Ranger'), (F, 'Warden')
  ON CONFLICT (member_id) DO UPDATE SET family = EXCLUDED.family;
  PERFORM combat_grant_xp(m, 11625, 'admin', 'x', 'launch-xp-' || m::text) FROM unnest(ARRAY[A, B, D, E, F]) m;
  PERFORM combat_grant_xp(C, 2000, 'event', 'x', 'launch-xp-c');
  PERFORM combat_choose_subclass(A, 'elementalist', 'Arcane', 'launch-sub-a');
  PERFORM combat_choose_subclass(B, 'guardian', 'Vanguard', 'launch-sub-b');
  PERFORM combat_choose_subclass(D, 'priest', 'Warden', 'launch-sub-d');
  PERFORM combat_choose_subclass(E, 'hunter', 'Ranger', 'launch-sub-e');
  PERFORM combat_choose_subclass(F, 'shaman', 'Warden', 'launch-sub-f');
  INSERT INTO member_weapons (member_id, weapon_key, durability) VALUES (A, 'staff-rune', 150), (E, 'sword-guardian', 180);
  UPDATE member_weapons SET equipped = FALSE WHERE member_id = A;
  UPDATE member_weapons SET equipped = TRUE WHERE member_id = A AND weapon_key = 'staff-rune';
  UPDATE member_progression SET repick_source = 'oracle' WHERE member_id = D;
  INSERT INTO member_subclass_mastery (member_id, subclass, xp, mastery) VALUES (F, 'shaman', 900, combat_mastery_for_xp(900));
  ASSERT (SELECT level FROM member_progression WHERE member_id = C) < 10 AND (SELECT subclass FROM member_progression WHERE member_id = C) IS NULL, 'launch: C has no subclass';
  ASSERT NOT EXISTS (SELECT 1 FROM member_weapons mw JOIN weapons w ON w.key = mw.weapon_key WHERE mw.member_id IN (A, B, D, E) AND w.subclass IS NOT NULL), 'launch: no signature weapons yet';
END $$;

\ir ../drafts/classes_v2_launch.sql

-- After the first run.
DO $$
DECLARE A uuid := '00000000-0000-4000-8000-0000000005a1'; B uuid := '00000000-0000-4000-8000-0000000005a2'; C uuid := '00000000-0000-4000-8000-0000000005a3';
  D uuid := '00000000-0000-4000-8000-0000000005a4'; E uuid := '00000000-0000-4000-8000-0000000005a5'; F uuid := '00000000-0000-4000-8000-0000000005a6';
  sig CONSTANT text := 'SELECT EXISTS (SELECT 1 FROM member_weapons mw JOIN weapons w ON w.key = mw.weapon_key WHERE mw.member_id = $1 AND w.subclass = $2 AND w.tier = $3)';
  l letters%ROWTYPE; ok boolean;
BEGIN
  ASSERT (SELECT value FROM economy_settings WHERE key = 'classes_v2') = 1, 'launch: the flag is on';
  ASSERT EXISTS (SELECT 1 FROM data_backfills WHERE key = 'classes_v2_launch'), 'launch: the marker';
  -- 1. A mastery row at mastery 1 for each member with a subclass; a row that existed keeps its XP; none for C.
  ASSERT (SELECT count(*) FROM member_subclass_mastery WHERE member_id IN (A, B, D, E) AND xp = 0 AND mastery = 1) = 4, 'launch: mastery 1 rows';
  ASSERT (SELECT xp FROM member_subclass_mastery WHERE member_id = F AND subclass = 'shaman') = 900, 'launch: an existing row keeps its XP';
  ASSERT NOT EXISTS (SELECT 1 FROM member_subclass_mastery WHERE member_id = C), 'launch: no row without a subclass';
  -- 2. The signature weapon at the highest tier owned: the rune staff is 3, a guardian drop 4, the starters 1.
  EXECUTE sig INTO ok USING A, 'elementalist', 3; ASSERT ok, 'launch: A gets the tier-3 prism staff';
  ASSERT NOT EXISTS (SELECT 1 FROM member_weapons mw JOIN weapons w ON w.key = mw.weapon_key WHERE mw.member_id = A AND w.subclass = 'elementalist' AND w.tier <> 3), 'launch: A gets one, at 3';
  EXECUTE sig INTO ok USING B, 'guardian', 1; ASSERT ok, 'launch: B gets the tier-1 aegis';
  EXECUTE sig INTO ok USING D, 'priest', 1; ASSERT ok, 'launch: D gets the tier-1 sunstone staff';
  EXECUTE sig INTO ok USING E, 'hunter', 4; ASSERT ok, 'launch: E gets the tier-4 harpoon (a guardian drop counts)';
  EXECUTE sig INTO ok USING F, 'shaman', 1; ASSERT ok, 'launch: F gets the tier-1 totem staff';
  ASSERT NOT EXISTS (SELECT 1 FROM member_weapons mw JOIN weapons w ON w.key = mw.weapon_key WHERE mw.member_id = C AND w.subclass IS NOT NULL), 'launch: C gets none';
  ASSERT (SELECT durability FROM member_weapons WHERE member_id = E AND weapon_key = (SELECT key FROM weapons WHERE subclass = 'hunter' AND tier = 4)) = (SELECT max_durability FROM weapons WHERE subclass = 'hunter' AND tier = 4), 'launch: at full durability';
  ASSERT (SELECT weapon_key FROM member_weapons WHERE member_id = A AND equipped) = 'staff-rune', 'launch: what A holds stays';
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = A AND weapon_key = 'staff-rune'), 'launch: legacy weapons stay owned';
  -- 3. One free repick; an Oracle token is kept; none for C.
  ASSERT (SELECT count(*) FROM member_progression WHERE member_id IN (A, B, E, F) AND repick_source = 'launch') = 4, 'launch: the free repick';
  ASSERT (SELECT repick_source FROM member_progression WHERE member_id = D) = 'oracle', 'launch: an Oracle token stays';
  ASSERT (SELECT repick_source FROM member_progression WHERE member_id = C) IS NULL, 'launch: C gets no token';
  -- 4. One system letter each, none for C; short, no rate, no em dash.
  ASSERT (SELECT count(*) FROM letters WHERE broadcast_key = 'classes_v2:launch' AND recipient_id IN (A, B, D, E, F)) = 5, 'launch: five letters';
  ASSERT NOT EXISTS (SELECT 1 FROM letters WHERE broadcast_key = 'classes_v2:launch' AND recipient_id = C), 'launch: no letter for C';
  SELECT * INTO l FROM letters WHERE broadcast_key = 'classes_v2:launch' AND recipient_id = A;
  ASSERT l.kind = 'system' AND l.sender_id IS NULL AND l.read_at IS NULL, 'launch: a system letter, unread';
  ASSERT char_length(l.body) BETWEEN 200 AND 900 AND position('—' IN l.body || l.subject) = 0 AND l.body !~* '\m(CAD|conversion|rate)\M' AND position('$' IN l.body) = 0, 'launch: the letter''s copy';
  -- 5. On sale: every aura and the coin skins; frames and the Gem skins stay off (david-decisions #12 B).
  ASSERT (SELECT bool_and(active) FROM shop_items WHERE slug IN ('aura-elementalist-fire', 'aura-warden-sunrise', 'vg-aura-dawn-dusk', 'skin-prism-ember', 'vg-skin-ivory-aegis', 'skin-living-staff-cherry')), 'launch: auras and coin skins on sale';
  ASSERT NOT (SELECT bool_or(active) FROM shop_items WHERE slug IN ('skin-charm-amber', 'skin-totem-staff-aurora', 'vg-skin-lotus-fire', 'skin-gunslinger-starfire', 'frame-ranger-fletching', 'vg-frame-hammered', 'vg-frame-brush')), 'launch: Gem skins and frames stay off';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE category = 'weapon_skin' AND tc_price IS NULL AND NOT active AND cosmetic->>'subclass' IS NOT NULL), 'launch: every coin skin';
  RAISE NOTICE 'classes v2 launch: first run ok';
END $$;

-- Members play between the runs: A spends the free repick, B trains mastery, C reaches level 10 and chooses, an admin
-- takes one aura off sale.
DO $$
DECLARE A uuid := '00000000-0000-4000-8000-0000000005a1'; B uuid := '00000000-0000-4000-8000-0000000005a2'; C uuid := '00000000-0000-4000-8000-0000000005a3';
  r record;
BEGIN
  SELECT * INTO r FROM combat_choose_subclass(A, 'illusionist', 'Arcane', 'launch-sub-a2');
  ASSERT r.fee = 0 AND NOT r.replayed, 'launch: the repick is free';
  ASSERT (SELECT repick_source FROM member_progression WHERE member_id = A) IS NULL, 'launch: the repick is spent';
  ASSERT EXISTS (SELECT 1 FROM member_weapons mw JOIN weapons w ON w.key = mw.weapon_key WHERE mw.member_id = A AND w.subclass = 'illusionist' AND w.tier = 3), 'launch: the new weapon at the tier carried';
  PERFORM combat_record_kill(B, 'shadow-fox', 'launch-kill-b1');
  ASSERT (SELECT xp FROM member_subclass_mastery WHERE member_id = B AND subclass = 'guardian') > 0, 'launch: kills train mastery';
  PERFORM combat_grant_xp(C, 9625, 'admin', 'x', 'launch-xp-c2');
  PERFORM combat_choose_subclass(C, 'summoner', 'Warden', 'launch-sub-c');
  ASSERT EXISTS (SELECT 1 FROM member_subclass_mastery WHERE member_id = C AND subclass = 'summoner' AND mastery = 1), 'launch: a new choice gets its row';
  ASSERT (SELECT repick_source FROM member_progression WHERE member_id = C) IS NULL, 'launch: a new choice gets no launch token';
  UPDATE shop_items SET active = FALSE WHERE slug = 'aura-warden-moss';
END $$;
CREATE TEMP TABLE launch_mid AS SELECT
  (SELECT count(*) FROM member_subclass_mastery) AS mastery_rows, (SELECT count(*) FROM letters WHERE broadcast_key = 'classes_v2:launch') AS letters,
  (SELECT count(*) FROM member_weapons) AS weapons, (SELECT count(*) FROM member_progression WHERE repick_source IS NOT NULL) AS tokens,
  (SELECT xp FROM member_subclass_mastery WHERE member_id = '00000000-0000-4000-8000-0000000005a2' AND subclass = 'guardian') AS b_xp;

\ir ../drafts/classes_v2_launch.sql

-- After the second run: nothing changed.
DO $$
DECLARE A uuid := '00000000-0000-4000-8000-0000000005a1'; C uuid := '00000000-0000-4000-8000-0000000005a3'; m launch_mid%ROWTYPE;
BEGIN
  SELECT * INTO m FROM launch_mid;
  ASSERT (SELECT count(*) FROM member_subclass_mastery) = m.mastery_rows, 'launch rerun: no mastery rows added';
  ASSERT (SELECT xp FROM member_subclass_mastery WHERE member_id = '00000000-0000-4000-8000-0000000005a2' AND subclass = 'guardian') = m.b_xp, 'launch rerun: mastery XP kept';
  ASSERT (SELECT count(*) FROM letters WHERE broadcast_key = 'classes_v2:launch') = m.letters, 'launch rerun: no letters again';
  ASSERT (SELECT count(*) FROM member_weapons) = m.weapons, 'launch rerun: no weapons again';
  ASSERT (SELECT count(*) FROM member_progression WHERE repick_source IS NOT NULL) = m.tokens, 'launch rerun: no tokens again';
  ASSERT (SELECT repick_source FROM member_progression WHERE member_id = A) IS NULL, 'launch rerun: a spent repick stays spent';
  ASSERT NOT EXISTS (SELECT 1 FROM letters WHERE broadcast_key = 'classes_v2:launch' AND recipient_id = C), 'launch rerun: no letter for a later choice';
  ASSERT NOT (SELECT active FROM shop_items WHERE slug = 'aura-warden-moss'), 'launch rerun: an item taken off sale stays off';
  ASSERT (SELECT value FROM economy_settings WHERE key = 'classes_v2') = 1, 'launch rerun: the flag stays on';
  ASSERT (SELECT count(*) FROM data_backfills WHERE key = 'classes_v2_launch') = 1, 'launch rerun: one marker';
  RAISE NOTICE 'classes v2 launch smoke ok';
END $$;
