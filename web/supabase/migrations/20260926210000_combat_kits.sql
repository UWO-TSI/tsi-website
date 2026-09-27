-- ─── Combat content B: loadouts, Transmuter traits, subclass choice replay ───
--
-- DRAFT 2026-09-26. NOT APPLIED. Spec: specs/combat-content.md Part B (rows
-- 20, 38, 40, 41, 50, 207). Apply after 20260926190000_combat_content.
-- Kit data lives in web/lib/combat/kits.ts; the service checks a loadout
-- against the member's kit before this stores it.
-- Test: web/supabase/tests/combat_kits_smoke.sql.

-- Four equipped abilities (row 50) and the Transmuter's traits: trait key → qualifying defeats (rows 40, 41).
ALTER TABLE member_progression ADD COLUMN IF NOT EXISTS loadout TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(loadout) <= 4);
ALTER TABLE member_progression ADD COLUMN IF NOT EXISTS traits JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(traits) = 'object');
ALTER TABLE enemy_types ADD COLUMN IF NOT EXISTS trait TEXT CHECK (trait ~ '^[a-z-]{1,40}$');

-- BEGIN TRAITS (web/lib/combat/kits.ts TRAITS; service.test.ts keeps them equal)
UPDATE enemy_types e SET trait = v.trait FROM (VALUES
  ('shadow-fox', 'fox-stride'),
  ('thorn-crab', 'crab-shell'),
  ('elder-thorn-crab', 'crab-shell'),
  ('mushroom-beast', 'spore-sac'),
  ('rune-wisp', 'wisp-core'),
  ('animated-book', 'page-storm'),
  ('stone-golem', 'golem-fist')
) v(key, trait) WHERE e.key = v.key;
-- END TRAITS

-- Row 50: the loadout is chosen at the Oracle outside combat. Idempotent (a set).
CREATE OR REPLACE FUNCTION public.combat_set_loadout(p_member_id UUID, p_loadout TEXT[])
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v TEXT[];
BEGIN
  IF cardinality(p_loadout) NOT BETWEEN 1 AND 4 OR EXISTS (SELECT 1 FROM unnest(p_loadout) x WHERE x !~ '^[a-z0-9.-]{1,40}$')
     OR (SELECT count(DISTINCT x) FROM unnest(p_loadout) x) <> cardinality(p_loadout) THEN
    RAISE EXCEPTION 'bad_loadout';
  END IF;
  PERFORM public.combat_ensure(p_member_id);
  UPDATE member_progression SET loadout = p_loadout, updated_at = NOW() WHERE member_id = p_member_id AND subclass IS NOT NULL RETURNING loadout INTO v;
  IF v IS NULL THEN RAISE EXCEPTION 'no_subclass'; END IF;
  RETURN v;
END;
$$;

-- A kill (as 20260926150800), and for a Transmuter the defeat counts toward the
-- species' trait: the first one teaches it (row 40), later ones train it (row 41).
-- Only a newly recorded kill counts, never a replay.
CREATE OR REPLACE FUNCTION public.combat_record_kill(p_member_id UUID, p_enemy_key TEXT, p_event_key TEXT)
RETURNS TABLE (xp BIGINT, level INTEGER, levelled_up BOOLEAN, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE v_xp INTEGER; v_cap INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'kill_xp_per_hour_cap'), 6000);
BEGIN
  IF EXISTS (SELECT 1 FROM combat_kills k WHERE k.member_id = p_member_id AND k.event_key = p_event_key) THEN
    RETURN QUERY SELECT g.xp, g.level, FALSE, TRUE FROM public.combat_grant_xp(p_member_id, 1, 'kill', p_enemy_key, 'kill:' || p_event_key) g; RETURN;
  END IF;
  SELECT e.xp INTO v_xp FROM enemy_types e WHERE e.key = p_enemy_key AND e.active;
  IF v_xp IS NULL THEN RAISE EXCEPTION 'unknown_enemy'; END IF;
  IF (SELECT COALESCE(SUM(amount), 0) FROM combat_xp_ledger l WHERE l.member_id = p_member_id AND l.source = 'kill' AND l.created_at > NOW() - interval '1 hour') + v_xp > v_cap THEN
    RAISE EXCEPTION 'kill_xp_cap';
  END IF;
  INSERT INTO combat_kills (member_id, event_key, enemy_key) VALUES (p_member_id, p_event_key, p_enemy_key);
  UPDATE member_progression p SET traits = jsonb_set(p.traits, ARRAY[t.trait], to_jsonb(COALESCE((p.traits->>t.trait)::INTEGER, 0) + 1)), updated_at = NOW()
    FROM enemy_types t WHERE p.member_id = p_member_id AND p.subclass = 'transmuter' AND t.key = p_enemy_key AND t.trait IS NOT NULL;
  RETURN QUERY SELECT * FROM public.combat_grant_xp(p_member_id, v_xp, 'kill', p_enemy_key, 'kill:' || p_event_key);
END;
$$;

-- Level-10 subclass choice (as 20260926190000, starters when the gate opens),
-- now replayed by its key first: a retried change after a later one answers
-- with the first result instead of failing on the key.
CREATE OR REPLACE FUNCTION public.combat_choose_subclass(p_member_id UUID, p_subclass TEXT, p_subclass_family TEXT, p_key TEXT)
RETURNS TABLE (subclass TEXT, fee INTEGER, replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE p member_progression%ROWTYPE; v_family TEXT; v_fee INTEGER := 0; r combat_respec_log%ROWTYPE;
BEGIN
  PERFORM public.combat_ensure(p_member_id);
  SELECT * INTO p FROM member_progression WHERE member_id = p_member_id FOR UPDATE;
  SELECT * INTO r FROM combat_respec_log l WHERE l.member_id = p_member_id AND l.idempotency_key = 'subclass:' || p_key;
  IF FOUND THEN RETURN QUERY SELECT r.to_value #>> '{}', r.fee, TRUE; RETURN; END IF;
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

DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY['combat_set_loadout(uuid, text[])', 'combat_record_kill(uuid, text, text)', 'combat_choose_subclass(uuid, text, text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
