-- ─── Classes v2, wave 0: mastery, the locked subclass, signature weapons, cosmetics ─
--
-- DRAFT 2026-10-02. NOT APPLIED. Spec: specs/classes/design-sheet.md (§1.4 mastery,
-- §1.5 signature weapons, §1.10 shop cosmetics, §1.11 the choice and the redo, the
-- LOCKED class sections and the build overrides: no loadout tables, keys are fixed
-- per class). Apply after 20261002052225_catalogue_seed.
--
-- Everything that changes today's behaviour is behind economy_settings.classes_v2
-- (0 = today's kits, the default; wave 5 turns it on): with it off, the subclass
-- change still costs the respec fee and grants the gate's starters, and ruins XP
-- trains no mastery. The repick token is granted either way (it is unused while off).
-- Rules mirrored in web/lib/combat/mastery.ts (a test keeps the curve identical).
-- Test: web/supabase/tests/classes_v2_smoke.sql.

INSERT INTO economy_settings (key, value) VALUES ('classes_v2', 0) ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.classes_v2_on() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT value FROM economy_settings WHERE key = 'classes_v2'), 0) = 1
$$;

-- ─── Mastery 1–20 per subclass (§1.4) ───────────────────────────────────────
-- Mastery XP from M to M+1 = 800 + 300·(M − 1); 66,500 to reach 20.
CREATE OR REPLACE FUNCTION public.combat_mastery_for_xp(p_xp BIGINT) RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m INTEGER := 1; need BIGINT := 0;
BEGIN
  WHILE m < 20 LOOP
    need := need + 800 + 300 * (m - 1);
    EXIT WHEN p_xp < need;
    m := m + 1;
  END LOOP;
  RETURN m;
END;
$$;

-- One row per subclass a member has played: kept when they switch away. The
-- equipped cosmetics (weapon_skin, aura, frame) per subclass; mastery cosmetics
-- are derived from the level, shop ones are owned rows in member_inventory.
CREATE TABLE IF NOT EXISTS member_subclass_mastery (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subclass TEXT NOT NULL CHECK (subclass ~ '^[a-z][a-z0-9-]{1,31}$'),
  xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  mastery INTEGER NOT NULL DEFAULT 1 CHECK (mastery BETWEEN 1 AND 20),
  cosmetics JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(cosmetics) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, subclass),
  CHECK (mastery = public.combat_mastery_for_xp(xp))
);
ALTER TABLE member_subclass_mastery ENABLE ROW LEVEL SECURITY;
-- Public with the profile (mastery, title, frame); written only by the functions below.
DROP POLICY IF EXISTS "Mastery readable by authenticated" ON member_subclass_mastery;
CREATE POLICY "Mastery readable by authenticated" ON member_subclass_mastery FOR SELECT USING ((select auth.role()) = 'authenticated');

-- Which subclass an XP grant trained (null: none, e.g. club events or the flag off).
ALTER TABLE combat_xp_ledger ADD COLUMN IF NOT EXISTS subclass TEXT;

-- As 20260926150800, and with the flag on, ruins XP (kills inside the hourly cap,
-- missions, the guardian kill) also trains the active subclass's mastery in the
-- same transaction, idempotent on the ledger key. Club events and admin grants don't.
CREATE OR REPLACE FUNCTION public.combat_grant_xp(p_member_id UUID, p_amount INTEGER, p_source TEXT, p_ref TEXT, p_key TEXT)
RETURNS TABLE (xp BIGINT, level INTEGER, levelled_up BOOLEAN, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE p member_progression%ROWTYPE; v_new BIGINT; v_sub TEXT;
BEGIN
  PERFORM public.combat_ensure(p_member_id);
  SELECT * INTO p FROM member_progression WHERE member_id = p_member_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM combat_xp_ledger l WHERE l.member_id = p_member_id AND l.idempotency_key = p_key) THEN
    RETURN QUERY SELECT p.xp, p.level, FALSE, TRUE; RETURN;
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  v_sub := CASE WHEN p_source IN ('kill', 'mission') AND public.classes_v2_on() THEN p.subclass END;
  INSERT INTO combat_xp_ledger (member_id, amount, source, ref, idempotency_key, subclass) VALUES (p_member_id, p_amount, p_source, p_ref, p_key, v_sub);
  IF v_sub IS NOT NULL THEN
    INSERT INTO member_subclass_mastery AS m (member_id, subclass, xp, mastery) VALUES (p_member_id, v_sub, p_amount, public.combat_mastery_for_xp(p_amount))
    ON CONFLICT (member_id, subclass) DO UPDATE SET xp = m.xp + EXCLUDED.xp, mastery = public.combat_mastery_for_xp(m.xp + EXCLUDED.xp), updated_at = NOW();
  END IF;
  v_new := p.xp + p_amount;
  UPDATE member_progression SET xp = v_new, level = public.combat_level_for_xp(v_new), updated_at = NOW() WHERE member_id = p_member_id;
  RETURN QUERY SELECT v_new, public.combat_level_for_xp(v_new), public.combat_level_for_xp(v_new) > p.level, FALSE;
END;
$$;

-- ─── The repick token (§1.11, row 287) ──────────────────────────────────────
-- A completed paid Oracle reading grants one ('oracle'); wave 5 gives existing
-- members one free in-family repick ('launch'). Null: none.
ALTER TABLE member_progression ADD COLUMN IF NOT EXISTS repick_source TEXT CHECK (repick_source IN ('oracle', 'launch'));

-- As 20260926150700, and a paid reading (a redo) grants the repick token to a
-- member who already has a subclass: one payment covers the reading and the change.
CREATE OR REPLACE FUNCTION public.oracle_complete(p_attempt_id UUID, p_member_id UUID, p_type TEXT, p_family TEXT, p_scores JSONB, p_tie_answers JSONB)
RETURNS TABLE (family TEXT, previous_family TEXT, aura_new BOOLEAN, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  a oracle_attempts%ROWTYPE;
  v_prev TEXT;
  v_new BOOLEAN;
BEGIN
  SELECT * INTO a FROM oracle_attempts WHERE id = p_attempt_id AND member_id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF a.status = 'completed' THEN
    RETURN QUERY SELECT a.family, (SELECT r.from_family FROM respec_log r WHERE r.attempt_id = a.id), FALSE, TRUE; RETURN;
  END IF;
  IF (SELECT count(*) FROM oracle_responses WHERE attempt_id = p_attempt_id) < array_length(a.item_order, 1) THEN
    RAISE EXCEPTION 'incomplete';
  END IF;
  SELECT i.family INTO v_prev FROM member_identity i WHERE i.member_id = p_member_id FOR UPDATE;
  UPDATE oracle_attempts SET status = 'completed', completed_at = NOW(), mbti_type = p_type, family = p_family, scores = p_scores, tie_answers = COALESCE(p_tie_answers, '{}'::jsonb)
   WHERE id = p_attempt_id;
  UPDATE member_identity SET mbti_type = p_type, family = p_family, quiz_taken_at = NOW(), updated_at = NOW() WHERE member_id = p_member_id;
  UPDATE profiles SET class = p_family WHERE id = p_member_id;
  INSERT INTO family_auras (member_id, family) VALUES (p_member_id, p_family) ON CONFLICT DO NOTHING;
  v_new := FOUND;
  IF a.fee_paid > 0 OR v_prev IS NOT NULL THEN
    INSERT INTO respec_log (member_id, attempt_id, from_family, to_family, fee, ledger_key)
    VALUES (p_member_id, p_attempt_id, v_prev, p_family, a.fee_paid, 'respec:' || a.start_key);
  END IF;
  IF a.fee_paid > 0 THEN
    UPDATE member_progression SET repick_source = 'oracle', updated_at = NOW() WHERE member_id = p_member_id AND subclass IS NOT NULL;
  END IF;
  RETURN QUERY SELECT p_family, v_prev, v_new, FALSE;
END;
$$;

-- ─── Signature weapons (§1.5) ────────────────────────────────────────────────
-- One weapon type per subclass, tiers 1–5 (rows seeded by each family wave). The
-- type list opens to a pattern so each wave can add its own (grimoire, cards, ...).
ALTER TABLE weapons ADD COLUMN IF NOT EXISTS subclass TEXT CHECK (subclass IS NULL OR subclass ~ '^[a-z][a-z0-9-]{1,31}$');
ALTER TABLE weapons DROP CONSTRAINT IF EXISTS weapons_weapon_type_check;
ALTER TABLE weapons ADD CONSTRAINT weapons_weapon_type_check CHECK (weapon_type ~ '^[a-z][a-z0-9-]{1,23}$');
CREATE UNIQUE INDEX IF NOT EXISTS idx_weapons_signature_tier ON weapons (subclass, tier) WHERE subclass IS NOT NULL;

-- Level-10 choice (as 20260926210000 with the flag off). With it on (§1.11): free
-- the first time; after that locked, and a change spends the repick token (no fee),
-- in the member's family. Mastery stays with each subclass (a row at 0 the first
-- time); the new signature weapon comes at the highest signature tier owned (tier 1
-- the first time), the old ones stay owned. The gate's starters are no longer granted.
CREATE OR REPLACE FUNCTION public.combat_choose_subclass(p_member_id UUID, p_subclass TEXT, p_subclass_family TEXT, p_key TEXT)
RETURNS TABLE (subclass TEXT, fee INTEGER, replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE p member_progression%ROWTYPE; v_family TEXT; v_fee INTEGER := 0; r combat_respec_log%ROWTYPE; v_tier INTEGER;
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
  IF NOT public.classes_v2_on() THEN
    IF p.subclass IS NOT NULL THEN
      v_fee := COALESCE((SELECT value FROM economy_settings WHERE key = 'subclass_respec_fee'), 250);
      PERFORM public.wallet_apply(p_member_id, 'coins', -v_fee, 'respec', 'subclass change', 'subclass:' || p_key);
    END IF;
    INSERT INTO member_weapons (member_id, weapon_key, durability)
    SELECT p_member_id, w.key, w.max_durability FROM weapons w
     WHERE w.key IN ('sword-driftwood', 'bow-willow', 'staff-oak', 'tome-spirits', 'wraps-cloth')
    ON CONFLICT DO NOTHING;
  ELSE
    IF p.subclass IS NOT NULL AND p.repick_source IS NULL THEN RAISE EXCEPTION 'locked'; END IF;
    INSERT INTO member_subclass_mastery (member_id, subclass) VALUES (p_member_id, p_subclass) ON CONFLICT DO NOTHING;
    SELECT COALESCE(MAX(w.tier), 1) INTO v_tier FROM member_weapons mw JOIN weapons w ON w.key = mw.weapon_key
     WHERE mw.member_id = p_member_id AND w.subclass IS NOT NULL;
    INSERT INTO member_weapons (member_id, weapon_key, durability)
    SELECT p_member_id, w.key, w.max_durability FROM weapons w
     WHERE w.subclass = p_subclass AND w.active AND w.tier <= v_tier ORDER BY w.tier DESC LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO combat_respec_log (member_id, kind, from_value, to_value, fee, idempotency_key)
  VALUES (p_member_id, 'subclass', to_jsonb(p.subclass), to_jsonb(p_subclass), v_fee, 'subclass:' || p_key);
  UPDATE member_progression SET subclass = p_subclass, subclass_chosen_at = NOW(), updated_at = NOW(),
    repick_source = CASE WHEN p.subclass IS NOT NULL AND public.classes_v2_on() THEN NULL ELSE p.repick_source END
   WHERE member_id = p_member_id;
  RETURN QUERY SELECT p_subclass, v_fee, FALSE;
END;
$$;

-- ─── Shop cosmetics (§1.10) ─────────────────────────────────────────────────
-- weapon_skin {subclass, skin}: one subclass's signature weapon, every tier (never its stats);
-- aura {ramp: [core, mid, edge]}: the active subclass's aura colours; frame {image}: the
-- nameplate frame (a 9-slice image). Coins mostly, some Gems (no rate is ever shown).
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS cosmetic JSONB;
ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_category_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_category_check CHECK (category IN (
  'avatar-outfit', 'avatar-effect', 'merch', 'profile-customization',
  'tool', 'outfit', 'hair', 'accessory', 'furniture', 'wallpaper', 'flooring',
  'weapon_skin', 'aura', 'frame'));
ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_cosmetic_shape;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_cosmetic_shape CHECK (COALESCE(
  (category = 'weapon_skin' AND cosmetic->>'subclass' ~ '^[a-z][a-z0-9-]{1,31}$')
  OR (category = 'aura' AND jsonb_typeof(cosmetic->'ramp') = 'array' AND jsonb_array_length(cosmetic->'ramp') = 3)
  OR (category = 'frame' AND jsonb_typeof(cosmetic) = 'object')
  OR category NOT IN ('weapon_skin', 'aura', 'frame'), FALSE));

-- Equip a cosmetic on one subclass's row: an owned shop item of that kind (a weapon
-- skin only for that subclass's weapon), a mastery cosmetic the row has reached
-- (bronze frame 5, weapon trim 13, silver frame 15, aura colour 17, gold frame 20),
-- or null to take it off. Returns the row's cosmetics.
CREATE OR REPLACE FUNCTION public.combat_equip_cosmetic(p_member_id UUID, p_subclass TEXT, p_kind TEXT, p_value TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m member_subclass_mastery%ROWTYPE; it shop_items%ROWTYPE; v_need INTEGER; v_out JSONB;
BEGIN
  IF p_kind NOT IN ('weapon_skin', 'aura', 'frame') THEN RAISE EXCEPTION 'bad_cosmetic'; END IF;
  SELECT * INTO m FROM member_subclass_mastery WHERE member_id = p_member_id AND subclass = p_subclass FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_value IS NULL THEN
    v_out := m.cosmetics - p_kind;
  ELSE
    IF p_value LIKE 'mastery:%' THEN
      v_need := CASE p_kind || '/' || p_value WHEN 'frame/mastery:bronze' THEN 5 WHEN 'weapon_skin/mastery:trim' THEN 13
        WHEN 'frame/mastery:silver' THEN 15 WHEN 'aura/mastery:colour' THEN 17 WHEN 'frame/mastery:gold' THEN 20 END;
      IF v_need IS NULL THEN RAISE EXCEPTION 'bad_cosmetic'; END IF;
      IF m.mastery < v_need THEN RAISE EXCEPTION 'locked'; END IF;
    ELSE
      SELECT s.* INTO it FROM shop_items s JOIN member_inventory i ON i.item_id = s.id AND i.member_id = p_member_id WHERE s.id::TEXT = p_value;
      IF NOT FOUND THEN RAISE EXCEPTION 'not_owned'; END IF;
      IF it.category <> p_kind OR (p_kind = 'weapon_skin' AND it.cosmetic->>'subclass' IS DISTINCT FROM p_subclass) THEN RAISE EXCEPTION 'bad_cosmetic'; END IF;
    END IF;
    v_out := jsonb_set(m.cosmetics, ARRAY[p_kind], to_jsonb(p_value));
  END IF;
  UPDATE member_subclass_mastery SET cosmetics = v_out, updated_at = NOW() WHERE member_id = p_member_id AND subclass = p_subclass;
  RETURN v_out;
END;
$$;

DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'classes_v2_on()', 'combat_grant_xp(uuid, integer, text, text, text)', 'oracle_complete(uuid, uuid, text, text, jsonb, jsonb)',
    'combat_choose_subclass(uuid, text, text, text)', 'combat_equip_cosmetic(uuid, text, text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
