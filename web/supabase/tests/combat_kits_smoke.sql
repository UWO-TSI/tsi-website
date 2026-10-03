-- Local smoke test for draft 20260926210000_combat_kits (after every game draft,
-- 20260926190000_combat_content and its smoke, same throwaway cluster). Never Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000d1', 'shifter@x'), ('00000000-0000-4000-8000-0000000000d2', 'druid@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE r record; T uuid := '00000000-0000-4000-8000-0000000000d1'; D uuid := '00000000-0000-4000-8000-0000000000d2'; v int; lo text[];
BEGIN
  ASSERT (SELECT count(*) FROM enemy_types WHERE trait IS NOT NULL AND key <> 'pollen-sprite') = 7 AND (SELECT trait FROM enemy_types WHERE key = 'guardian-statue') IS NULL, 'kits traits seeded'; -- the pollen sprite's is the Arcane wave's
  -- Loadout: needs a subclass; one to four distinct keys; a set, so repeating it is harmless.
  PERFORM combat_ensure(T);
  BEGIN PERFORM combat_set_loadout(T, ARRAY['transmuter.aspect']); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'no_subclass', 'kits loadout before subclass: ' || SQLERRM; END;
  INSERT INTO member_identity (member_id, family) VALUES (T, 'Arcane'), (D, 'Warden') ON CONFLICT (member_id) DO UPDATE SET family = EXCLUDED.family;
  PERFORM combat_grant_xp(T, 11625, 'admin', 'x', 'kits-xp-t1');
  PERFORM combat_grant_xp(D, 11625, 'admin', 'x', 'kits-xp-d1');
  PERFORM combat_choose_subclass(T, 'transmuter', 'Arcane', 'kits-sub-t1');
  PERFORM combat_choose_subclass(D, 'druid', 'Warden', 'kits-sub-d1');
  lo := combat_set_loadout(T, ARRAY['transmuter.aspect', 'trait.fox-stride', 'arcane.starfall', 'arcane.blink']);
  lo := combat_set_loadout(T, ARRAY['transmuter.aspect', 'trait.fox-stride', 'arcane.starfall', 'arcane.blink']);
  ASSERT (SELECT loadout FROM member_progression WHERE member_id = T) = ARRAY['transmuter.aspect', 'trait.fox-stride', 'arcane.starfall', 'arcane.blink'], 'kits loadout saved';
  BEGIN PERFORM combat_set_loadout(T, ARRAY['a', 'b', 'c', 'd', 'e']); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_loadout', 'kits loadout five: ' || SQLERRM; END;
  BEGIN PERFORM combat_set_loadout(T, ARRAY['arcane.blink', 'arcane.blink']); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_loadout', 'kits loadout duplicate: ' || SQLERRM; END;
  BEGIN PERFORM combat_set_loadout(T, ARRAY['Robert''); drop']); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_loadout', 'kits loadout shape: ' || SQLERRM; END;
  -- Traits (rows 40, 41): a Transmuter's first defeat of a species teaches it, later ones train it; replays and the boss count for nothing; others learn nothing.
  PERFORM combat_record_kill(T, 'thorn-crab', 'kits-kill-1');
  PERFORM combat_record_kill(T, 'thorn-crab', 'kits-kill-1');
  ASSERT (SELECT traits FROM member_progression WHERE member_id = T) = '{"crab-shell":1}'::jsonb, 'kits first defeat teaches, replay does not';
  PERFORM combat_record_kill(T, 'elder-thorn-crab', 'kits-kill-2');
  PERFORM combat_record_kill(T, 'guardian-statue', 'kits-kill-3');
  PERFORM combat_record_kill(T, 'shadow-fox', 'kits-kill-4');
  ASSERT (SELECT traits FROM member_progression WHERE member_id = T) = '{"crab-shell":2,"fox-stride":1}'::jsonb, 'kits traits trained';
  PERFORM combat_record_kill(D, 'thorn-crab', 'kits-kill-9');
  ASSERT (SELECT traits FROM member_progression WHERE member_id = D) = '{}'::jsonb, 'kits non-transmuter learns nothing';
  -- Subclass change (row 20): charged once per key; a retried key after a later change answers with its first result.
  PERFORM wallet_apply(T, 'coins', 600, 'admin', 'smoke seed', 'kits-seed-t1');
  v := (SELECT coins FROM wallets WHERE member_id = T);
  SELECT * INTO r FROM combat_choose_subclass(T, 'elementalist', 'Arcane', 'kits-sub-t2');
  ASSERT r.fee = 250 AND NOT r.replayed, 'kits change charged';
  SELECT * INTO r FROM combat_choose_subclass(T, 'transmuter', 'Arcane', 'kits-sub-t3');
  SELECT * INTO r FROM combat_choose_subclass(T, 'elementalist', 'Arcane', 'kits-sub-t2');
  ASSERT r.replayed AND r.subclass = 'elementalist' AND r.fee = 250, 'kits retried key replays its first result';
  ASSERT (SELECT subclass FROM member_progression WHERE member_id = T) = 'transmuter', 'kits replay changes nothing';
  ASSERT (SELECT coins FROM wallets WHERE member_id = T) = v - 500, 'kits two changes, two fees';
  RAISE NOTICE 'combat kits ok';
END $$;

-- Members can't set their own loadout or kills through the functions.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}';
DO $$ BEGIN
  BEGIN PERFORM combat_set_loadout('00000000-0000-4000-8000-0000000000d1', ARRAY['arcane.blink']); RAISE EXCEPTION 'x';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'combat kits: loadout not callable by members ok'; END;
  BEGIN PERFORM combat_record_kill('00000000-0000-4000-8000-0000000000d1', 'thorn-crab', 'kits-kill-x'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'combat kits: kills not callable by members ok'; END;
END $$;
ROLLBACK;
