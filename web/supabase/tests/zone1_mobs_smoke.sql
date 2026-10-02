-- Zone 1 mobs (20261002182708_zone1_mobs): the outskirts' roster with the pollen sprite, and the elder thorn crab's
-- spoils. Throwaway local Postgres after every migration, with the pre_* seeds. Never Supabase. Fails before the
-- migration (no pollen sprite, no combat_miniboss_reward).
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000e1', 'outskirts@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE r record; E uuid := '00000000-0000-4000-8000-0000000000e1'; v int; stone int; xp0 bigint;
BEGIN
  -- the roster: five zone-1 types with the new swarm, each row teaching its tell; the elder is the zone's mini-boss
  ASSERT (SELECT kind = 'normal' AND zone = 'outer' AND level = 5 AND hp = 14 AND xp = 6 FROM enemy_types WHERE key = 'pollen-sprite'), 'pollen sprite row';
  ASSERT (SELECT count(*) FROM enemy_types WHERE zone = 'outer' AND kind = 'normal' AND active) = 5, 'five zone-1 types';
  ASSERT (SELECT behaviour LIKE '%packs of three%' FROM enemy_types WHERE key = 'shadow-fox'), 'fox behaviour';
  ASSERT (SELECT behaviour LIKE '%front shell%' FROM enemy_types WHERE key = 'thorn-crab'), 'crab behaviour';
  ASSERT (SELECT behaviour LIKE '%poison puddle%' AND attack_range = 6.5 FROM enemy_types WHERE key = 'mushroom-beast'), 'mushroom behaviour';
  ASSERT (SELECT behaviour LIKE '%blinks away%' FROM enemy_types WHERE key = 'rune-wisp'), 'wisp behaviour';
  ASSERT (SELECT kind = 'elite' AND behaviour LIKE 'Mini-boss.%' AND hp = 1450 AND leash_radius = 24 AND xp = 450 FROM enemy_types WHERE key = 'elder-thorn-crab'), 'elder is the mini-boss';
  ASSERT (SELECT hp = 1700 AND armor = 7 FROM enemy_types WHERE key = 'guardian-statue'), 'the rest of the roster unchanged';
  -- a sprite's kill pays its XP like any kill
  PERFORM combat_ensure(E);
  xp0 := (SELECT xp FROM member_progression WHERE member_id = E);
  PERFORM combat_record_kill(E, 'pollen-sprite', 'z1-kill-0001');
  ASSERT (SELECT xp FROM member_progression WHERE member_id = E) = xp0 + 6, 'pollen sprite kill XP';
  -- the elder's spoils: a recorded kill of that elite, once, then 20 h; never off the table
  BEGIN PERFORM combat_miniboss_reward(E, 'elder-thorn-crab', 'z1-elder-0001', '{"coins":60,"materials":{"rock_stone":3},"weapon":null,"rarity":null}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', 'no kill yet: ' || SQLERRM; END;
  PERFORM combat_record_kill(E, 'thorn-crab', 'z1-crab-0001');
  BEGIN PERFORM combat_miniboss_reward(E, 'thorn-crab', 'z1-crab-0001', '{"coins":60,"materials":{},"weapon":null,"rarity":null}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', 'a normal crab pays nothing: ' || SQLERRM; END;
  PERFORM combat_record_kill(E, 'elder-thorn-crab', 'z1-elder-0002');
  BEGIN PERFORM combat_miniboss_reward(E, 'stone-golem', 'z1-elder-0002', '{"coins":60,"materials":{},"weapon":null,"rarity":null}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', 'the kill names its enemy: ' || SQLERRM; END;
  BEGIN PERFORM combat_miniboss_reward(E, 'elder-thorn-crab', 'z1-elder-0002', '{"coins":60,"materials":{},"weapon":"sword-guardian","rarity":"rare"}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_reward', 'no boss gear off a crab: ' || SQLERRM; END;
  BEGIN PERFORM combat_miniboss_reward(E, 'elder-thorn-crab', 'z1-elder-0002', '{"coins":500,"materials":{},"weapon":null,"rarity":null}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_reward', 'coins bounded: ' || SQLERRM; END;
  v := COALESCE((SELECT coins FROM wallets WHERE member_id = E), 0);
  stone := COALESCE((SELECT count FROM member_collections WHERE user_id = E AND item_key = 'rock_stone'), 0);
  SELECT * INTO r FROM combat_miniboss_reward(E, 'elder-thorn-crab', 'z1-elder-0002', '{"coins":60,"materials":{"rock_stone":3,"rock_crystal":1},"weapon":"sword-iron","rarity":"rare"}');
  ASSERT NOT r.replayed AND r.reward->>'weapon' = 'sword-iron', 'elder reward';
  SELECT * INTO r FROM combat_miniboss_reward(E, 'elder-thorn-crab', 'z1-elder-0002', '{"coins":60,"materials":{},"weapon":"bow-yew","rarity":"rare"}');
  ASSERT r.replayed AND r.reward->>'weapon' = 'sword-iron', 'a replay keeps the first roll';
  ASSERT (SELECT coins FROM wallets WHERE member_id = E) = v + 60, 'elder coins once';
  ASSERT (SELECT count FROM member_collections WHERE user_id = E AND item_key = 'rock_stone') = stone + 3, 'elder materials once';
  ASSERT (SELECT durability FROM member_weapons WHERE member_id = E AND weapon_key = 'sword-iron') = 120, 'elder gear owned';
  ASSERT NOT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = E AND weapon_key = 'bow-yew'), 'a replay grants nothing';
  PERFORM combat_record_kill(E, 'elder-thorn-crab', 'z1-elder-0003');
  BEGIN PERFORM combat_miniboss_reward(E, 'elder-thorn-crab', 'z1-elder-0003', '{"coins":60,"materials":{},"weapon":null,"rarity":null}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'miniboss_cooldown', 'elder cooldown: ' || SQLERRM; END;
  -- its cooldown is its own: the guardian still pays
  PERFORM combat_record_kill(E, 'guardian-statue', 'z1-boss-0001');
  SELECT * INTO r FROM combat_boss_reward(E, 'z1-boss-0001', '{"coins":150,"materials":{},"weapon":null,"rarity":null}');
  ASSERT NOT r.replayed, 'the guardian is not on the elder''s cooldown';
  UPDATE combat_miniboss_rewards SET created_at = NOW() - interval '21 hours' WHERE member_id = E;
  SELECT * INTO r FROM combat_miniboss_reward(E, 'elder-thorn-crab', 'z1-elder-0003', '{"coins":60,"materials":{},"weapon":null,"rarity":null}');
  ASSERT NOT r.replayed, 'elder after its cooldown';
  RAISE NOTICE 'zone 1 mobs ok';
END $$;

-- Members can't pay themselves the elder's spoils.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
DO $$ BEGIN
  BEGIN PERFORM combat_miniboss_reward('00000000-0000-4000-8000-0000000000e1', 'elder-thorn-crab', 'z1-elder-9999', '{"coins":200}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'zone 1 mobs: mini-boss reward not callable by members ok'; END;
END $$;
ROLLBACK;
