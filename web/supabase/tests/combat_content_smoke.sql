-- Local smoke test for draft 20260926180000_combat_content (after every game draft
-- and the 029-035, security and crafting smokes, same throwaway cluster). Never Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000c5', 'fighter@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE r record; G uuid := '00000000-0000-4000-8000-0000000000c5'; pid uuid; v int;
  wood int; crystal int;
BEGIN
  -- content: the roster by zone, ten missions with difficulty and materials, crafted + boss gear
  ASSERT (SELECT zone FROM enemy_types WHERE key = 'rune-wisp') = 'outer' AND (SELECT armor FROM enemy_types WHERE key = 'guardian-statue') > 0, 'content roster';
  ASSERT (SELECT count(*) FROM missions WHERE active AND difficulty BETWEEN 1 AND 5 AND rewards ? 'materials') = 10, 'content missions';
  ASSERT (SELECT count(*) FROM weapons WHERE tier >= 4) = 5, 'content boss gear';
  -- starters: one per archetype plus the wraps, the sword equipped
  PERFORM combat_ensure(G);
  ASSERT (SELECT count(*) FROM member_weapons WHERE member_id = G) = 5 AND (SELECT weapon_key FROM member_weapons WHERE member_id = G AND equipped) = 'sword-driftwood', 'content starters';
  ASSERT NOT EXISTS (SELECT 1 FROM member_progression p WHERE NOT EXISTS (SELECT 1 FROM member_weapons w WHERE w.member_id = p.member_id AND w.weapon_key = 'staff-oak')), 'content starters backfilled';
  -- mission rewards: XP, coins and materials exactly once
  wood := COALESCE((SELECT count FROM member_collections WHERE user_id = G AND item_key = 'wood_branch'), 0);
  SELECT * INTO r FROM combat_mission_start(G, 'escort-botanist', 'cc-mis-0001');
  pid := r.progress_id;
  UPDATE mission_progress SET state = 'ready' WHERE id = pid;
  v := COALESCE((SELECT coins FROM wallets WHERE member_id = G), 0);
  SELECT * INTO r FROM combat_mission_complete(pid, G);
  ASSERT r.xp_awarded = 380 AND r.coins_awarded = 75 AND r.materials_awarded = '{"wood_branch":4}'::jsonb AND NOT r.replayed, 'content mission complete';
  SELECT * INTO r FROM combat_mission_complete(pid, G);
  ASSERT r.replayed, 'content mission replay';
  ASSERT (SELECT coins FROM wallets WHERE member_id = G) = v + 75, 'content mission coins once';
  ASSERT (SELECT count FROM member_collections WHERE user_id = G AND item_key = 'wood_branch') = wood + 4, 'content mission materials once';
  -- boss reward: needs a recorded boss kill, pays once per kill, then a 20 h cooldown
  BEGIN PERFORM combat_boss_reward(G, 'boss-0001', '{"coins":150,"materials":{"rock_crystal":2},"weapon":null,"rarity":null}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', 'content boss no kill: ' || SQLERRM; END;
  PERFORM combat_record_kill(G, 'shadow-fox', 'fox-0001');
  BEGIN PERFORM combat_boss_reward(G, 'fox-0001', '{"coins":150,"materials":{},"weapon":null,"rarity":null}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', 'content boss not a boss: ' || SQLERRM; END;
  PERFORM combat_record_kill(G, 'guardian-statue', 'boss-0002');
  BEGIN PERFORM combat_boss_reward(G, 'boss-0002', '{"coins":150,"materials":{},"weapon":"sword-iron","rarity":"epic"}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_reward', 'content boss off-table gear: ' || SQLERRM; END;
  v := (SELECT coins FROM wallets WHERE member_id = G);
  crystal := COALESCE((SELECT count FROM member_collections WHERE user_id = G AND item_key = 'rock_crystal'), 0);
  SELECT * INTO r FROM combat_boss_reward(G, 'boss-0002', '{"coins":150,"materials":{"rock_crystal":2},"weapon":"sword-guardian","rarity":"epic"}');
  ASSERT NOT r.replayed AND r.reward->>'weapon' = 'sword-guardian', 'content boss reward';
  SELECT * INTO r FROM combat_boss_reward(G, 'boss-0002', '{"coins":150,"materials":{},"weapon":"staff-heartstone","rarity":"legendary"}');
  ASSERT r.replayed AND r.reward->>'weapon' = 'sword-guardian', 'content boss replay keeps the first roll';
  ASSERT (SELECT coins FROM wallets WHERE member_id = G) = v + 150, 'content boss coins once';
  ASSERT (SELECT count FROM member_collections WHERE user_id = G AND item_key = 'rock_crystal') = crystal + 2, 'content boss materials once';
  ASSERT (SELECT durability FROM member_weapons WHERE member_id = G AND weapon_key = 'sword-guardian') = 180, 'content boss gear owned';
  ASSERT NOT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = G AND weapon_key = 'staff-heartstone'), 'content boss replay grants nothing';
  PERFORM combat_record_kill(G, 'guardian-statue', 'boss-0003');
  BEGIN PERFORM combat_boss_reward(G, 'boss-0003', '{"coins":150,"materials":{},"weapon":null,"rarity":null}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'boss_cooldown', 'content boss cooldown: ' || SQLERRM; END;
  UPDATE combat_boss_rewards SET created_at = NOW() - interval '21 hours' WHERE member_id = G;
  SELECT * INTO r FROM combat_boss_reward(G, 'boss-0003', '{"coins":150,"materials":{},"weapon":null,"rarity":null}');
  ASSERT NOT r.replayed, 'content boss after cooldown';
  RAISE NOTICE 'combat content ok';
END $$;

-- Members can't pay themselves a boss reward or materials.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c5","role":"authenticated"}';
DO $$ BEGIN
  BEGIN PERFORM combat_boss_reward('00000000-0000-4000-8000-0000000000c5', 'boss-9999', '{"coins":500}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'combat content: boss reward not callable by members ok'; END;
  BEGIN PERFORM combat_give_materials('00000000-0000-4000-8000-0000000000c5', '{"rock_gold_nugget":20}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'combat content: materials not callable by members ok'; END;
END $$;
ROLLBACK;
