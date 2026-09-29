-- ─── 035 Combat foundation: progression, stats, gear, enemies, missions, XP ─
--
-- DRAFT 2026-09-26. NOT APPLIED. Spec: specs/combat-foundation.md (rows 8, 11,
-- 12, 17, 22-24, 31, 32, 38, 49-53, C2, C3, 179, 207, 208, 213, 228-231).
-- Depends on 001, 016, 033 (wallet_apply, economy_settings), 034 (member_identity.family).
-- Rules and numbers live in web/lib/combat/ (tests keep the XP curve and the
-- seeds identical). Every write is a service-role function; idempotent per key.

ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_source_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_source_check CHECK (source IN (
  'study', 'sell', 'chapter', 'quest', 'daily_gift', 'event', 'admin', 'shop', 'room', 'goal', 'refund', 'migration', 'respec',
  'mission', 'repair', 'stat_reset'));

INSERT INTO economy_settings (key, value) VALUES ('event_xp', 2000), ('kill_xp_per_hour_cap', 6000), ('stat_reset_fee', 200), ('subclass_respec_fee', 250)
ON CONFLICT (key) DO NOTHING;

-- ─── Progression ─────────────────────────────────────────────────────────────
-- XP to go from L to L+1 = 100·L + 25·L² (web/lib/combat/progression.ts), cap 50.
CREATE OR REPLACE FUNCTION public.combat_level_for_xp(p_xp BIGINT) RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE l INTEGER := 1; need BIGINT := 0;
BEGIN
  WHILE l < 50 LOOP
    need := need + 100 * l + 25 * l * l;
    EXIT WHEN p_xp < need;
    l := l + 1;
  END LOOP;
  RETURN l;
END;
$$;

CREATE TABLE IF NOT EXISTS member_progression (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 50),
  stats JSONB NOT NULL DEFAULT '{"might":0,"finesse":0,"arcana":0,"spirit":0,"vitality":0}'::jsonb,
  subclass TEXT,
  subclass_chosen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (level = public.combat_level_for_xp(xp)),
  CHECK (subclass IS NULL OR level >= 10)
);

CREATE TABLE IF NOT EXISTS combat_xp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL CHECK (source IN ('kill', 'mission', 'event', 'admin')),
  ref TEXT,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 6 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_combat_xp_recent ON combat_xp_ledger (member_id, source, created_at DESC);

CREATE TABLE IF NOT EXISTS combat_respec_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('stats', 'subclass')),
  from_value JSONB,
  to_value JSONB,
  fee INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, idempotency_key)
);

-- ─── Gear ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weapons (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9-]{1,48}$'),
  name TEXT NOT NULL,
  weapon_type TEXT NOT NULL CHECK (weapon_type IN ('sword', 'shield', 'bow', 'revolver', 'staff', 'tome', 'fists', 'totem')),
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
  scaling TEXT[] NOT NULL,
  max_durability INTEGER NOT NULL CHECK (max_durability > 0),
  repair_per_point INTEGER NOT NULL CHECK (repair_per_point >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS member_weapons (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weapon_key TEXT NOT NULL REFERENCES weapons(key),
  durability INTEGER NOT NULL CHECK (durability >= 0),
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, weapon_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_weapons_one_equipped ON member_weapons (member_id) WHERE equipped;

CREATE TABLE IF NOT EXISTS combat_wear_log (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  weapon_key TEXT NOT NULL,
  loss INTEGER NOT NULL,
  defeated BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, idempotency_key)
);

-- ─── Enemies and missions (content; T1/T2 editable, row 33) ─────────────────
CREATE TABLE IF NOT EXISTS enemy_types (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9-]{1,48}$'),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('normal', 'elite', 'boss')),
  zone TEXT NOT NULL CHECK (zone IN ('outer', 'inner', 'boss')),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 50),
  hp INTEGER NOT NULL CHECK (hp > 0),
  damage INTEGER NOT NULL CHECK (damage >= 0),
  defense NUMERIC(4, 2) NOT NULL CHECK (defense BETWEEN 0 AND 0.8),
  aggro_radius NUMERIC(6, 2) NOT NULL,
  attack_range NUMERIC(6, 2) NOT NULL,
  leash_radius NUMERIC(6, 2) NOT NULL,
  xp INTEGER NOT NULL CHECK (xp >= 0),
  behaviour TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS missions (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9-]{1,48}$'),
  title TEXT NOT NULL,
  template TEXT NOT NULL CHECK (template IN ('hunt', 'fetch', 'survive', 'escort')),
  zone TEXT NOT NULL CHECK (zone IN ('outer', 'inner', 'boss')),
  params JSONB NOT NULL,
  rewards JSONB NOT NULL CHECK ((rewards->>'xp')::INT >= 0 AND (rewards->>'coins')::INT >= 0),
  cooldown_hours INTEGER NOT NULL DEFAULT 20 CHECK (cooldown_hours >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mission_key TEXT NOT NULL REFERENCES missions(key),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'ready', 'completed', 'failed', 'abandoned')),
  progress JSONB NOT NULL DEFAULT '{"counter":0,"carrying":false,"seen":[]}'::jsonb,
  start_key TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (member_id, start_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_one_open ON mission_progress (member_id, mission_key) WHERE state IN ('active', 'ready');

CREATE TABLE IF NOT EXISTS combat_kills (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  enemy_key TEXT NOT NULL REFERENCES enemy_types(key),
  killed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, event_key)
);

-- ─── RLS: own rows readable; content readable; writes via functions ─────────
ALTER TABLE member_progression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Progression readable by authenticated" ON member_progression FOR SELECT USING ((select auth.role()) = 'authenticated');
ALTER TABLE combat_xp_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "XP ledger readable by owner or T1/T2" ON combat_xp_ledger
  FOR SELECT USING (member_id = (select auth.uid()) OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
ALTER TABLE combat_respec_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Combat respec log readable by owner" ON combat_respec_log FOR SELECT USING (member_id = (select auth.uid()));
ALTER TABLE member_weapons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Weapons readable by authenticated" ON member_weapons FOR SELECT USING ((select auth.role()) = 'authenticated'); -- visible on characters (row 140)
ALTER TABLE combat_wear_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wear log readable by owner" ON combat_wear_log FOR SELECT USING (member_id = (select auth.uid()));
ALTER TABLE mission_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mission progress readable by owner" ON mission_progress FOR SELECT USING (member_id = (select auth.uid()));
ALTER TABLE combat_kills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kills readable by owner" ON combat_kills FOR SELECT USING (member_id = (select auth.uid()));
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['weapons', 'enemy_types', 'missions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING ((select auth.role()) = ''authenticated'')', t || ' readable', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2)) WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2))', t || ' editable by T1/T2', t);
  END LOOP;
END $$;

-- ─── Functions ──────────────────────────────────────────────────────────────

-- Create the progression row and the starter weapons (a sword and hand wraps) once.
CREATE OR REPLACE FUNCTION public.combat_ensure(p_member_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO member_progression (member_id) VALUES (p_member_id) ON CONFLICT DO NOTHING;
  IF FOUND THEN
    INSERT INTO member_weapons (member_id, weapon_key, durability, equipped)
    SELECT p_member_id, w.key, w.max_durability, w.key = 'sword-driftwood' FROM weapons w WHERE w.key IN ('sword-driftwood', 'wraps-cloth')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.combat_grant_xp(p_member_id UUID, p_amount INTEGER, p_source TEXT, p_ref TEXT, p_key TEXT)
RETURNS TABLE (xp BIGINT, level INTEGER, levelled_up BOOLEAN, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE p member_progression%ROWTYPE; v_new BIGINT;
BEGIN
  PERFORM public.combat_ensure(p_member_id);
  SELECT * INTO p FROM member_progression WHERE member_id = p_member_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM combat_xp_ledger l WHERE l.member_id = p_member_id AND l.idempotency_key = p_key) THEN
    RETURN QUERY SELECT p.xp, p.level, FALSE, TRUE; RETURN;
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  INSERT INTO combat_xp_ledger (member_id, amount, source, ref, idempotency_key) VALUES (p_member_id, p_amount, p_source, p_ref, p_key);
  v_new := p.xp + p_amount;
  UPDATE member_progression SET xp = v_new, level = public.combat_level_for_xp(v_new), updated_at = NOW() WHERE member_id = p_member_id;
  RETURN QUERY SELECT v_new, public.combat_level_for_xp(v_new), public.combat_level_for_xp(v_new) > p.level, FALSE;
END;
$$;

-- A kill reported by the client: once per event key, XP from the enemy table,
-- capped per hour (anti-farm; combat is client-simulated in v1).
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
  RETURN QUERY SELECT * FROM public.combat_grant_xp(p_member_id, v_xp, 'kill', p_enemy_key, 'kill:' || p_event_key);
END;
$$;

-- Add-only allocation; the total can't exceed 3 points per level gained.
CREATE OR REPLACE FUNCTION public.combat_allocate(p_member_id UUID, p_stats JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p member_progression%ROWTYPE; k TEXT; v_total INTEGER := 0; v_val INTEGER;
BEGIN
  PERFORM public.combat_ensure(p_member_id);
  SELECT * INTO p FROM member_progression WHERE member_id = p_member_id FOR UPDATE;
  FOR k IN SELECT jsonb_object_keys(p_stats) LOOP
    IF k NOT IN ('might', 'finesse', 'arcana', 'spirit', 'vitality') THEN RAISE EXCEPTION 'bad_stat'; END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['might', 'finesse', 'arcana', 'spirit', 'vitality'] LOOP
    v_val := COALESCE((p_stats->>k)::INTEGER, 0);
    IF v_val < COALESCE((p.stats->>k)::INTEGER, 0) THEN RAISE EXCEPTION 'needs_reset'; END IF;
    v_total := v_total + v_val;
  END LOOP;
  IF v_total > (p.level - 1) * 3 THEN RAISE EXCEPTION 'not_enough_points'; END IF;
  UPDATE member_progression SET stats = jsonb_build_object('might', COALESCE((p_stats->>'might')::INT, 0), 'finesse', COALESCE((p_stats->>'finesse')::INT, 0),
    'arcana', COALESCE((p_stats->>'arcana')::INT, 0), 'spirit', COALESCE((p_stats->>'spirit')::INT, 0), 'vitality', COALESCE((p_stats->>'vitality')::INT, 0)), updated_at = NOW()
   WHERE member_id = p_member_id;
  RETURN (SELECT stats FROM member_progression WHERE member_id = p_member_id);
END;
$$;

-- Coin-fee stat reset at the Oracle (row 38). XP, level and gear are kept.
CREATE OR REPLACE FUNCTION public.combat_reset_stats(p_member_id UUID, p_key TEXT)
RETURNS TABLE (fee INTEGER, replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE p member_progression%ROWTYPE; v_fee INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'stat_reset_fee'), 200);
BEGIN
  PERFORM public.combat_ensure(p_member_id);
  SELECT * INTO p FROM member_progression WHERE member_id = p_member_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM combat_respec_log r WHERE r.member_id = p_member_id AND r.idempotency_key = 'stat_reset:' || p_key) THEN
    RETURN QUERY SELECT (SELECT r.fee FROM combat_respec_log r WHERE r.member_id = p_member_id AND r.idempotency_key = 'stat_reset:' || p_key), TRUE; RETURN;
  END IF;
  PERFORM public.wallet_apply(p_member_id, 'coins', -v_fee, 'stat_reset', 'stat reset', 'stat_reset:' || p_key);
  INSERT INTO combat_respec_log (member_id, kind, from_value, to_value, fee, idempotency_key)
  VALUES (p_member_id, 'stats', p.stats, '{}'::jsonb, v_fee, 'stat_reset:' || p_key);
  UPDATE member_progression SET stats = '{"might":0,"finesse":0,"arcana":0,"spirit":0,"vitality":0}'::jsonb, updated_at = NOW() WHERE member_id = p_member_id;
  RETURN QUERY SELECT v_fee, FALSE;
END;
$$;

-- Level-10 subclass choice within the Oracle family (row 207). First choice
-- free; a later change costs the subclass respec fee.
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
  RETURN QUERY SELECT p_subclass, v_fee, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.combat_mission_start(p_member_id UUID, p_mission_key TEXT, p_start_key TEXT)
RETURNS TABLE (progress_id UUID, resumed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE r mission_progress%ROWTYPE; m missions%ROWTYPE; v_last TIMESTAMPTZ;
BEGIN
  SELECT * INTO m FROM missions WHERE key = p_mission_key AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_mission'; END IF;
  PERFORM public.combat_ensure(p_member_id);
  PERFORM 1 FROM member_progression WHERE member_id = p_member_id FOR UPDATE;  -- serialise starts
  SELECT * INTO r FROM mission_progress WHERE member_id = p_member_id AND (start_key = p_start_key OR (mission_key = p_mission_key AND state IN ('active', 'ready')))
   ORDER BY (start_key = p_start_key) DESC LIMIT 1;
  IF FOUND THEN RETURN QUERY SELECT r.id, TRUE; RETURN; END IF;
  SELECT MAX(completed_at) INTO v_last FROM mission_progress WHERE member_id = p_member_id AND mission_key = p_mission_key AND state = 'completed';
  IF v_last IS NOT NULL AND v_last > NOW() - make_interval(hours => m.cooldown_hours) THEN RAISE EXCEPTION 'cooldown'; END IF;
  INSERT INTO mission_progress (member_id, mission_key, start_key) VALUES (p_member_id, p_mission_key, p_start_key) RETURNING * INTO r;
  RETURN QUERY SELECT r.id, FALSE;
END;
$$;

-- Turn in a ready mission: rewards once (XP + coins), keyed by the progress id.
CREATE OR REPLACE FUNCTION public.combat_mission_complete(p_progress_id UUID, p_member_id UUID)
RETURNS TABLE (xp_awarded INTEGER, coins_awarded INTEGER, replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE r mission_progress%ROWTYPE; m missions%ROWTYPE; v_xp INTEGER; v_coins INTEGER;
BEGIN
  SELECT * INTO r FROM mission_progress WHERE id = p_progress_id AND member_id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO m FROM missions WHERE key = r.mission_key;
  v_xp := (m.rewards->>'xp')::INT;
  v_coins := (m.rewards->>'coins')::INT;
  IF r.state = 'completed' THEN RETURN QUERY SELECT v_xp, v_coins, TRUE; RETURN; END IF;
  IF r.state <> 'ready' THEN RAISE EXCEPTION 'not_ready'; END IF;
  UPDATE mission_progress SET state = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = r.id;
  IF v_xp > 0 THEN PERFORM public.combat_grant_xp(p_member_id, v_xp, 'mission', m.key, 'mission:' || r.id); END IF;
  IF v_coins > 0 THEN PERFORM public.wallet_apply(p_member_id, 'coins', v_coins, 'mission', m.key, 'mission:' || r.id); END IF;
  RETURN QUERY SELECT v_xp, v_coins, FALSE;
END;
$$;

-- Encounter wear: 1 per landed hit, 10% of max on defeat (row 229: no coin loss). Once per key.
CREATE OR REPLACE FUNCTION public.combat_wear(p_member_id UUID, p_weapon_key TEXT, p_hits INTEGER, p_defeated BOOLEAN, p_key TEXT)
RETURNS TABLE (durability INTEGER, replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE w member_weapons%ROWTYPE; v_max INTEGER; v_loss INTEGER;
BEGIN
  SELECT * INTO w FROM member_weapons WHERE member_id = p_member_id AND weapon_key = p_weapon_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_owned'; END IF;
  IF EXISTS (SELECT 1 FROM combat_wear_log l WHERE l.member_id = p_member_id AND l.idempotency_key = p_key) THEN
    RETURN QUERY SELECT w.durability, TRUE; RETURN;
  END IF;
  IF p_hits < 0 OR p_hits > 500 THEN RAISE EXCEPTION 'bad_hits'; END IF;
  SELECT max_durability INTO v_max FROM weapons WHERE key = p_weapon_key;
  v_loss := p_hits + CASE WHEN p_defeated THEN CEIL(v_max * 0.1)::INT ELSE 0 END;
  INSERT INTO combat_wear_log (member_id, idempotency_key, weapon_key, loss, defeated) VALUES (p_member_id, p_key, p_weapon_key, v_loss, p_defeated);
  UPDATE member_weapons SET durability = GREATEST(0, w.durability - v_loss) WHERE member_id = p_member_id AND weapon_key = p_weapon_key;
  RETURN QUERY SELECT GREATEST(0, w.durability - v_loss), FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.combat_repair(p_member_id UUID, p_weapon_key TEXT, p_key TEXT)
RETURNS TABLE (durability INTEGER, cost INTEGER, replayed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE w member_weapons%ROWTYPE; d weapons%ROWTYPE; v_cost INTEGER; v_rep BOOLEAN;
BEGIN
  SELECT * INTO w FROM member_weapons WHERE member_id = p_member_id AND weapon_key = p_weapon_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_owned'; END IF;
  SELECT * INTO d FROM weapons WHERE key = p_weapon_key;
  IF EXISTS (SELECT 1 FROM wallet_ledger l WHERE l.member_id = p_member_id AND l.idempotency_key = 'repair:' || p_key) THEN
    RETURN QUERY SELECT w.durability, (SELECT -l.amount FROM wallet_ledger l WHERE l.member_id = p_member_id AND l.idempotency_key = 'repair:' || p_key), TRUE; RETURN;
  END IF;
  v_cost := (d.max_durability - w.durability) * d.repair_per_point;
  IF v_cost > 0 THEN PERFORM public.wallet_apply(p_member_id, 'coins', -v_cost, 'repair', p_weapon_key, 'repair:' || p_key); END IF;
  UPDATE member_weapons SET durability = d.max_durability WHERE member_id = p_member_id AND weapon_key = p_weapon_key;
  RETURN QUERY SELECT d.max_durability, v_cost, FALSE;
END;
$$;

-- Club-event XP hook (rows 11, 23): an IRL check-in grants event XP once.
CREATE OR REPLACE FUNCTION public.combat_event_attendance_xp() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_xp INTEGER := COALESCE((SELECT value FROM economy_settings WHERE key = 'event_xp'), 2000);
BEGIN
  IF NEW.status = 'attended' AND NEW.user_id IS NOT NULL AND v_xp > 0 AND EXISTS (SELECT 1 FROM events e WHERE e.id = NEW.event_id AND e.is_irl) THEN
    PERFORM public.combat_grant_xp(NEW.user_id, v_xp, 'event', NEW.event_id::TEXT, 'event_xp:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_event_attendance_xp ON event_attendance;
CREATE TRIGGER trg_event_attendance_xp AFTER INSERT OR UPDATE OF status ON event_attendance
  FOR EACH ROW WHEN (NEW.status = 'attended') EXECUTE FUNCTION public.combat_event_attendance_xp();

DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'combat_ensure(uuid)', 'combat_grant_xp(uuid, integer, text, text, text)', 'combat_record_kill(uuid, text, text)',
    'combat_allocate(uuid, jsonb)', 'combat_reset_stats(uuid, text)', 'combat_choose_subclass(uuid, text, text, text)',
    'combat_mission_start(uuid, text, text)', 'combat_mission_complete(uuid, uuid)', 'combat_wear(uuid, text, integer, boolean, text)',
    'combat_repair(uuid, text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

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
  ('wraps-cloth', 'Cloth hand wraps', 'fists', 1, ARRAY['might','finesse']::text[], 90, 1)
ON CONFLICT (key) DO NOTHING;
INSERT INTO enemy_types (key, name, kind, zone, level, hp, damage, defense, aggro_radius, attack_range, leash_radius, xp, behaviour) VALUES
  ('shadow-fox', 'Shadow fox', 'normal', 'outer', 4, 60, 8, 0, 7, 1.5, 21, 30, 'Telegraphed pounce; dodge sideways.'),
  ('thorn-crab', 'Thorn crab', 'normal', 'outer', 5, 90, 10, 0.3, 4, 1.2, 12, 35, 'Slow; armoured front, soft back.'),
  ('mushroom-beast', 'Mushroom beast', 'normal', 'outer', 6, 110, 9, 0.1, 5, 4, 15, 40, 'Spore cloud at range; step out of it.'),
  ('rune-wisp', 'Rune wisp', 'normal', 'inner', 9, 80, 14, 0, 9, 8, 27, 60, 'Floats; fires rune bolts from range.'),
  ('animated-book', 'Animated book', 'normal', 'inner', 10, 120, 13, 0.2, 6, 2, 18, 65, 'Snapping charge after a page flutter.'),
  ('stone-golem', 'Stone golem', 'elite', 'inner', 12, 420, 22, 0.45, 6, 2.5, 18, 220, 'Ground slam telegraph; wide recovery window.'),
  ('elder-thorn-crab', 'Elder thorn crab', 'elite', 'outer', 8, 300, 16, 0.4, 5, 1.8, 15, 160, 'Spins its shell; only the back takes full damage.'),
  ('guardian-statue', 'Guardian statue', 'boss', 'boss', 15, 2400, 30, 0.35, 14, 3, 42, 1200, 'Charge, rune projectiles and a floor sigil; long recovery after the sigil for an incantation.')
ON CONFLICT (key) DO NOTHING;
INSERT INTO missions (key, title, template, zone, params, rewards, cooldown_hours) VALUES
  ('hunt-foxes', 'Fox trouble', 'hunt', 'outer', '{"enemy":"shadow-fox","count":6}'::jsonb, '{"xp":300,"coins":60}'::jsonb, 20),
  ('hunt-crabs', 'Crab season', 'hunt', 'outer', '{"enemy":"thorn-crab","count":5}'::jsonb, '{"xp":320,"coins":60}'::jsonb, 20),
  ('hunt-wisps', 'Put out the wisps', 'hunt', 'inner', '{"enemy":"rune-wisp","count":6}'::jsonb, '{"xp":600,"coins":110}'::jsonb, 20),
  ('hunt-golem', 'Break the golem', 'hunt', 'inner', '{"enemy":"stone-golem","count":1}'::jsonb, '{"xp":700,"coins":150}'::jsonb, 20),
  ('fetch-lantern', 'The lost lantern', 'fetch', 'outer', '{"item":"old-lantern","chamber":"fox-den"}'::jsonb, '{"xp":350,"coins":70}'::jsonb, 20),
  ('fetch-tome', 'An overdue book', 'fetch', 'inner', '{"item":"sealed-tome","chamber":"library"}'::jsonb, '{"xp":650,"coins":120}'::jsonb, 20),
  ('survive-circle', 'Hold the rune circle', 'survive', 'outer', '{"waves":3}'::jsonb, '{"xp":400,"coins":80}'::jsonb, 20),
  ('survive-sanctum', 'Sanctum watch', 'survive', 'inner', '{"waves":5}'::jsonb, '{"xp":800,"coins":160}'::jsonb, 20),
  ('escort-botanist', 'The botanist''s walk', 'escort', 'outer', '{"resident":"botanist","checkpoints":3}'::jsonb, '{"xp":380,"coins":75}'::jsonb, 20),
  ('escort-scholar', 'Scholar to the shrine', 'escort', 'inner', '{"resident":"scholar","checkpoints":4}'::jsonb, '{"xp":750,"coins":150}'::jsonb, 20)
ON CONFLICT (key) DO NOTHING;
-- END GENERATED COMBAT SEED
