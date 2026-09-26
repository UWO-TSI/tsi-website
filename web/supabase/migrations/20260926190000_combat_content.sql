-- ─── Combat content A: the ruins roster, ten missions, crafted and boss gear ─
--
-- DRAFT 2026-09-26. NOT APPLIED. Spec: specs/combat-content.md Part A (rows
-- 21, 213, 228-231; ruling 2026-09-26: one starter weapon per archetype).
-- Apply after 20260926180000_ownership (the latest draft). Depends on 20260926150800_combat
-- (weapons, enemy_types, missions, combat_* functions), 20260926150400
-- (member_collections.total_collected, collection_species), 033 wallet_apply.
-- Content lives in web/lib/combat/ (content.ts, weapons.ts); the seed below is
-- generated and upserts over the first one in 20260926150800.
-- Test: web/supabase/tests/combat_content_smoke.sql.

ALTER TABLE enemy_types ADD COLUMN IF NOT EXISTS armor NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (armor >= 0);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS difficulty SMALLINT NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5);

-- ─── Seed (web/lib/combat/) ─────────────────────────────────────────────────
-- BEGIN GENERATED COMBAT SEED (web/scripts/gen-seeds.mjs)
INSERT INTO weapons (key, name, weapon_type, tier, scaling, max_durability, repair_per_point) VALUES
  ('sword-driftwood', 'Driftwood sword', 'sword', 1, ARRAY['might']::text[], 90, 1),
  ('sword-iron', 'Iron sword', 'sword', 2, ARRAY['might']::text[], 120, 2),
  ('shield-buckler', 'Buckler and blade', 'shield', 1, ARRAY['might','vitality']::text[], 90, 1),
  ('bow-willow', 'Willow bow', 'bow', 1, ARRAY['finesse']::text[], 90, 1),
  ('bow-yew', 'Yew longbow', 'bow', 2, ARRAY['finesse']::text[], 120, 2),
  ('revolver-brass', 'Brass revolver', 'revolver', 2, ARRAY['finesse']::text[], 120, 2),
  ('staff-oak', 'Oak staff', 'staff', 1, ARRAY['arcana']::text[], 90, 1),
  ('staff-rune', 'Rune staff', 'staff', 3, ARRAY['arcana']::text[], 150, 3),
  ('tome-spirits', 'Tome of small spirits', 'tome', 1, ARRAY['spirit']::text[], 90, 1),
  ('totem-cedar', 'Cedar totem', 'totem', 1, ARRAY['spirit']::text[], 90, 1),
  ('wraps-cloth', 'Cloth hand wraps', 'fists', 1, ARRAY['might','finesse']::text[], 90, 1),
  ('sword-guardian', 'Guardian''s edge', 'sword', 4, ARRAY['might']::text[], 180, 4),
  ('bow-sentinel', 'Sentinel bow', 'bow', 4, ARRAY['finesse']::text[], 180, 4),
  ('staff-sigil', 'Sigil staff', 'staff', 4, ARRAY['arcana']::text[], 180, 4),
  ('tome-warden', 'Warden''s grimoire', 'tome', 4, ARRAY['spirit']::text[], 180, 4),
  ('staff-heartstone', 'Heartstone staff', 'staff', 5, ARRAY['arcana','spirit']::text[], 210, 5)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, weapon_type = EXCLUDED.weapon_type, tier = EXCLUDED.tier, scaling = EXCLUDED.scaling, max_durability = EXCLUDED.max_durability, repair_per_point = EXCLUDED.repair_per_point;
INSERT INTO enemy_types (key, name, kind, zone, level, hp, damage, defense, armor, aggro_radius, attack_range, leash_radius, xp, behaviour) VALUES
  ('shadow-fox', 'Shadow fox', 'normal', 'outer', 5, 60, 8, 0, 0, 7, 1.5, 21, 30, 'Crouches, eyes flare, then pounces; dodge sideways.'),
  ('thorn-crab', 'Thorn crab', 'normal', 'outer', 5, 90, 10, 0.3, 0, 4, 1.2, 12, 35, 'Raises both claws, then sweeps a wide arc in front.'),
  ('mushroom-beast', 'Mushroom beast', 'normal', 'outer', 5, 110, 9, 0.1, 0, 5, 4, 15, 40, 'Cap swells, then it spits spores at where you stood.'),
  ('rune-wisp', 'Rune wisp', 'normal', 'outer', 5, 70, 9, 0, 0, 8, 7, 24, 40, 'Ring spins up and glows, then a rune bolt flies at your spot.'),
  ('animated-book', 'Animated book', 'normal', 'inner', 10, 120, 13, 0.2, 0, 6, 2, 18, 65, 'Pages flutter open, then it snaps shut on a short charge.'),
  ('stone-golem', 'Stone golem', 'elite', 'inner', 12, 420, 22, 0.45, 2, 6, 2.5, 18, 220, 'Raises both fists, core glows, then slams the ground around it.'),
  ('elder-thorn-crab', 'Elder thorn crab', 'elite', 'outer', 7, 300, 16, 0.4, 0, 5, 1.8, 15, 160, 'A slower, wider claw sweep; hit it from behind.'),
  ('guardian-statue', 'Guardian statue', 'boss', 'boss', 15, 1800, 28, 0.35, 9, 9, 3, 11, 1200, 'Overhead slam on a ring marker, a sigil beam sweep with a stagger after it, two rune wisps below half health, enraged at a fifth.')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind, zone = EXCLUDED.zone, level = EXCLUDED.level, hp = EXCLUDED.hp, damage = EXCLUDED.damage, defense = EXCLUDED.defense, armor = EXCLUDED.armor, aggro_radius = EXCLUDED.aggro_radius, attack_range = EXCLUDED.attack_range, leash_radius = EXCLUDED.leash_radius, xp = EXCLUDED.xp, behaviour = EXCLUDED.behaviour;
INSERT INTO missions (key, title, template, zone, difficulty, params, rewards, cooldown_hours) VALUES
  ('hunt-foxes', 'Fox trouble', 'hunt', 'outer', 1, '{"enemy":"shadow-fox","count":6}'::jsonb, '{"xp":300,"coins":60,"materials":{"wood_branch":3}}'::jsonb, 20),
  ('hunt-crabs', 'Crab season', 'hunt', 'outer', 2, '{"enemy":"thorn-crab","count":5}'::jsonb, '{"xp":320,"coins":60,"materials":{"rock_stone":3}}'::jsonb, 20),
  ('hunt-wisps', 'Put out the wisps', 'hunt', 'outer', 2, '{"enemy":"rune-wisp","count":4}'::jsonb, '{"xp":360,"coins":70,"materials":{"rock_crystal":1}}'::jsonb, 20),
  ('hunt-golem', 'Break the golem', 'hunt', 'inner', 4, '{"enemy":"stone-golem","count":1}'::jsonb, '{"xp":700,"coins":150,"materials":{"rock_iron_nugget":3}}'::jsonb, 20),
  ('fetch-lantern', 'The lost lantern', 'fetch', 'outer', 1, '{"item":"old-lantern","chamber":"fox-den"}'::jsonb, '{"xp":350,"coins":70,"materials":{"rock_clay":2}}'::jsonb, 20),
  ('fetch-tome', 'An overdue book', 'fetch', 'inner', 3, '{"item":"sealed-tome","chamber":"library"}'::jsonb, '{"xp":650,"coins":120,"materials":{"rock_gold_nugget":1}}'::jsonb, 20),
  ('survive-circle', 'Hold the rune circle', 'survive', 'outer', 2, '{"waves":3}'::jsonb, '{"xp":400,"coins":80,"materials":{"rock_iron_nugget":2}}'::jsonb, 20),
  ('survive-sanctum', 'Sanctum watch', 'survive', 'inner', 4, '{"waves":4}'::jsonb, '{"xp":800,"coins":160,"materials":{"rock_crystal":2}}'::jsonb, 20),
  ('escort-botanist', 'The botanist''s walk', 'escort', 'outer', 2, '{"resident":"botanist","checkpoints":3}'::jsonb, '{"xp":380,"coins":75,"materials":{"wood_branch":4}}'::jsonb, 20),
  ('escort-scholar', 'Scholar to the shrine', 'escort', 'inner', 3, '{"resident":"scholar","checkpoints":4}'::jsonb, '{"xp":750,"coins":150,"materials":{"rock_gold_nugget":1,"rock_crystal":1}}'::jsonb, 20)
ON CONFLICT (key) DO UPDATE SET title = EXCLUDED.title, template = EXCLUDED.template, zone = EXCLUDED.zone, difficulty = EXCLUDED.difficulty, params = EXCLUDED.params, rewards = EXCLUDED.rewards, cooldown_hours = EXCLUDED.cooldown_hours;
-- END GENERATED COMBAT SEED

-- ─── Starter weapons (ruling): one per archetype when the ruins gate opens ───
-- The gate opens with the level-10 subclass choice inside the Oracle family
-- (rows 179, 207), so the choice grants the set; members who already chose are
-- backfilled. The gate itself is checked in web/lib/combat/service.ts.
CREATE OR REPLACE FUNCTION public.combat_choose_subclass(p_member_id UUID, p_subclass TEXT, p_subclass_family TEXT, p_key TEXT)
RETURNS TABLE (subclass TEXT, fee INTEGER, replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE p member_progression%ROWTYPE; v_family TEXT; v_fee INTEGER := 0;
BEGIN
  PERFORM public.combat_ensure(p_member_id);
  SELECT * INTO p FROM member_progression WHERE member_id = p_member_id FOR UPDATE;
  IF p.subclass IS NOT DISTINCT FROM p_subclass THEN RETURN QUERY SELECT p.subclass, 0, TRUE; RETURN; END IF;
  IF p.level < 10 THEN RAISE EXCEPTION 'level_too_low'; END IF;
  SELECT i.family INTO v_family FROM member_identity i WHERE i.member_id = p_member_id;
  IF v_family IS NULL THEN RAISE EXCEPTION 'no_family'; END IF;
  IF v_family <> p_subclass_family THEN RAISE EXCEPTION 'wrong_family'; END IF;
  IF p.subclass IS NOT NULL THEN
    v_fee := COALESCE((SELECT value FROM economy_settings WHERE key = 'subclass_respec_fee'), 250);
    PERFORM public.wallet_apply(p_member_id, 'coins', -v_fee, 'respec', 'subclass change', 'subclass:' || p_key);
  END IF;
  INSERT INTO combat_respec_log (member_id, kind, from_value, to_value, fee, idempotency_key)
  VALUES (p_member_id, 'subclass', to_jsonb(p.subclass), to_jsonb(p_subclass), v_fee, 'subclass:' || p_key);
  UPDATE member_progression SET subclass = p_subclass, subclass_chosen_at = NOW(), updated_at = NOW() WHERE member_id = p_member_id;
  INSERT INTO member_weapons (member_id, weapon_key, durability)
  SELECT p_member_id, w.key, w.max_durability FROM weapons w
   WHERE w.key IN ('sword-driftwood', 'bow-willow', 'staff-oak', 'tome-spirits', 'wraps-cloth')
  ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT p_subclass, v_fee, FALSE;
END;
$$;
INSERT INTO member_weapons (member_id, weapon_key, durability)
SELECT p.member_id, w.key, w.max_durability FROM member_progression p CROSS JOIN weapons w
 WHERE p.subclass IS NOT NULL AND w.key IN ('sword-driftwood', 'bow-willow', 'staff-oak', 'tome-spirits', 'wraps-cloth')
ON CONFLICT DO NOTHING;

-- ─── Materials into member_collections (the stock crafting spends) ──────────
-- Internal: only called by the mission and boss rewards below.
CREATE OR REPLACE FUNCTION public.combat_give_materials(p_member_id UUID, p_items JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it RECORD;
BEGIN
  FOR it IN SELECT e.key, e.value::INTEGER AS n FROM jsonb_each_text(COALESCE(p_items, '{}'::jsonb)) e LOOP
    IF it.n < 1 OR it.n > 20 OR NOT EXISTS (SELECT 1 FROM collection_species s WHERE s.key = it.key) THEN RAISE EXCEPTION 'bad_reward'; END IF;
    INSERT INTO member_collections AS mc (user_id, item_key, count, total_collected) VALUES (p_member_id, it.key, it.n, it.n)
    ON CONFLICT (user_id, item_key) DO UPDATE SET count = mc.count + it.n, total_collected = mc.total_collected + it.n, updated_at = NOW();
  END LOOP;
END;
$$;

-- Turn in a ready mission: XP, coins and materials once, keyed by the progress id.
DROP FUNCTION IF EXISTS public.combat_mission_complete(UUID, UUID);
CREATE FUNCTION public.combat_mission_complete(p_progress_id UUID, p_member_id UUID)
RETURNS TABLE (xp_awarded INTEGER, coins_awarded INTEGER, materials_awarded JSONB, replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE r mission_progress%ROWTYPE; m missions%ROWTYPE; v_xp INTEGER; v_coins INTEGER; v_items JSONB;
BEGIN
  SELECT * INTO r FROM mission_progress WHERE id = p_progress_id AND member_id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO m FROM missions WHERE key = r.mission_key;
  v_xp := (m.rewards->>'xp')::INT;
  v_coins := (m.rewards->>'coins')::INT;
  v_items := COALESCE(m.rewards->'materials', '{}'::jsonb);
  IF r.state = 'completed' THEN RETURN QUERY SELECT v_xp, v_coins, v_items, TRUE; RETURN; END IF;
  IF r.state <> 'ready' THEN RAISE EXCEPTION 'not_ready'; END IF;
  UPDATE mission_progress SET state = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = r.id;
  IF v_xp > 0 THEN PERFORM public.combat_grant_xp(p_member_id, v_xp, 'mission', m.key, 'mission:' || r.id); END IF;
  IF v_coins > 0 THEN PERFORM public.wallet_apply(p_member_id, 'coins', v_coins, 'mission', m.key, 'mission:' || r.id); END IF;
  PERFORM public.combat_give_materials(p_member_id, v_items);
  RETURN QUERY SELECT v_xp, v_coins, v_items, FALSE;
END;
$$;

-- ─── Guardian statue victory (row 21) ────────────────────────────────────────
-- The route rolls BOSS_DROPS (web/lib/combat/content.ts) and passes the result;
-- this pays it once per recorded boss kill and at most once per 20 hours
-- (kills are client-reported, ruling 3), and refuses anything off the table.
CREATE TABLE IF NOT EXISTS combat_boss_rewards (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  reward JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_combat_boss_rewards_recent ON combat_boss_rewards (member_id, created_at DESC);
ALTER TABLE combat_boss_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boss rewards readable by owner" ON combat_boss_rewards FOR SELECT USING (member_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.combat_boss_reward(p_member_id UUID, p_event_key TEXT, p_reward JSONB)
RETURNS TABLE (reward JSONB, replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE v_prior JSONB; v_coins INTEGER := COALESCE((p_reward->>'coins')::INT, 0); v_weapon TEXT := p_reward->>'weapon';
BEGIN
  PERFORM public.combat_ensure(p_member_id);
  PERFORM 1 FROM member_progression WHERE member_id = p_member_id FOR UPDATE;  -- serialise claims
  SELECT b.reward INTO v_prior FROM combat_boss_rewards b WHERE b.member_id = p_member_id AND b.event_key = p_event_key;
  IF FOUND THEN RETURN QUERY SELECT v_prior, TRUE; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM combat_kills k JOIN enemy_types e ON e.key = k.enemy_key
                  WHERE k.member_id = p_member_id AND k.event_key = p_event_key AND e.kind = 'boss') THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF EXISTS (SELECT 1 FROM combat_boss_rewards b WHERE b.member_id = p_member_id AND b.created_at > NOW() - make_interval(hours => 20)) THEN
    RAISE EXCEPTION 'boss_cooldown';
  END IF;
  IF v_coins < 0 OR v_coins > 500 OR (v_weapon IS NOT NULL AND NOT EXISTS (SELECT 1 FROM weapons w WHERE w.key = v_weapon AND w.tier >= 4)) THEN
    RAISE EXCEPTION 'bad_reward';
  END IF;
  INSERT INTO combat_boss_rewards (member_id, event_key, reward) VALUES (p_member_id, p_event_key, p_reward);
  IF v_coins > 0 THEN PERFORM public.wallet_apply(p_member_id, 'coins', v_coins, 'mission', 'guardian-statue', 'boss:' || p_event_key); END IF;
  PERFORM public.combat_give_materials(p_member_id, p_reward->'materials');
  IF v_weapon IS NOT NULL THEN
    INSERT INTO member_weapons (member_id, weapon_key, durability)
    SELECT p_member_id, w.key, w.max_durability FROM weapons w WHERE w.key = v_weapon
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN QUERY SELECT p_reward, FALSE;
END;
$$;

DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY['combat_choose_subclass(uuid, text, text, text)', 'combat_give_materials(uuid, jsonb)', 'combat_mission_complete(uuid, uuid)', 'combat_boss_reward(uuid, text, jsonb)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
