-- ─── 034 Identity: world names, member badge, Oracle quiz, family, respec, settings ─
--
-- DRAFT 2026-09-24. NOT APPLIED. Spec: specs/oracle-identity.md (rows 16, 19,
-- 20, 205-207, 215, 220-223). Depends on 001 (profiles), 033 (wallet_apply).
-- Scoring happens in web/lib/oracle/engine.ts; these functions store the
-- result atomically and charge respecs through the single wallet path.
-- Members read their own rows; every write is a service-role call.

-- Public accounts (rows 74-75) vs TSI members (row 223). Existing profiles are
-- club members (grandfathered by the column default at ALTER time); new rows
-- default to 'public' and the profile-creation trigger below decides.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership TEXT NOT NULL DEFAULT 'member' CHECK (membership IN ('member', 'public'));
ALTER TABLE profiles ALTER COLUMN membership SET DEFAULT 'public';
-- Members can't grant themselves membership or a family (same pattern as 024's coins).
REVOKE UPDATE (membership, class, subclass) ON profiles FROM authenticated;

-- Emails T1/T2 mark as club members before they first sign in with Google.
CREATE TABLE IF NOT EXISTS member_email_whitelist (
  email TEXT PRIMARY KEY CHECK (email = lower(email) AND email LIKE '%@%'),
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE member_email_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Member whitelist managed by T1/T2" ON member_email_whitelist
  FOR ALL USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2))
  WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- Profile creation (replaces 003's handle_new_user; same trigger): a Google
-- sign-in is a member when its email is whitelisted or it signed up with an
-- active invite code; otherwise a public account (coordinator ruling 2026-09-26).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite TEXT := upper(trim(NEW.raw_user_meta_data->>'invite_code'));
  v_member BOOLEAN;
BEGIN
  v_member := EXISTS (SELECT 1 FROM public.member_email_whitelist w WHERE w.email = lower(NEW.email))
    OR (v_invite IS NOT NULL AND v_invite <> '' AND EXISTS (SELECT 1 FROM public.invite_codes c WHERE c.code = v_invite AND c.is_active));
  INSERT INTO public.profiles (id, email, display_name, membership)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    CASE WHEN v_member THEN 'member' ELSE 'public' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_source_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_source_check CHECK (source IN (
  'study', 'sell', 'chapter', 'quest', 'daily_gift', 'event', 'admin', 'shop', 'room', 'goal', 'refund', 'migration', 'respec'));

-- ─── World identity ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_identity (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  world_name TEXT CHECK (world_name IS NULL OR char_length(world_name) BETWEEN 3 AND 16),
  world_name_key TEXT,                     -- normalised (lib/identity/names.ts nameKey)
  name_set_at TIMESTAMPTZ,
  name_changes INTEGER NOT NULL DEFAULT 0,
  mbti_type TEXT CHECK (mbti_type IS NULL OR mbti_type ~ '^[EI][SN][TF][JP]$'),
  family TEXT CHECK (family IS NULL OR family IN ('Arcane', 'Ranger', 'Vanguard', 'Warden')),
  quiz_taken_at TIMESTAMPTZ,
  muted_until TIMESTAMPTZ,                 -- row 221: T1-T2 mute
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((world_name IS NULL) = (world_name_key IS NULL))
);
-- Case/spacing/look-alike-insensitive uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_identity_name_key ON member_identity (world_name_key) WHERE world_name_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS identity_name_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_name TEXT,
  new_name TEXT,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- admin reset when <> member
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 200),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, target_id)
);

-- Row 223: members get the nameplate glow / blue dot; public accounts don't.
CREATE OR REPLACE VIEW member_badges AS
SELECT p.id AS member_id,
       i.world_name,
       CASE WHEN p.membership = 'member' AND p.is_active THEN 'member' END AS badge,
       i.family
  FROM profiles p LEFT JOIN member_identity i ON i.member_id = p.id;
GRANT SELECT ON member_badges TO authenticated, service_role;

-- ─── Oracle quiz ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oracle_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_key TEXT NOT NULL CHECK (char_length(start_key) BETWEEN 8 AND 100),
  item_order TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  fee_paid INTEGER NOT NULL DEFAULT 0 CHECK (fee_paid >= 0),
  mbti_type TEXT CHECK (mbti_type IS NULL OR mbti_type ~ '^[EI][SN][TF][JP]$'),
  family TEXT CHECK (family IS NULL OR family IN ('Arcane', 'Ranger', 'Vanguard', 'Warden')),
  scores JSONB,
  tie_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (member_id, start_key),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oracle_one_open ON oracle_attempts (member_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS oracle_responses (
  attempt_id UUID NOT NULL REFERENCES oracle_attempts(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL CHECK (item_id ~ '^[a-z]{2}[0-9]{2}$'),
  value SMALLINT NOT NULL CHECK (value BETWEEN -2 AND 2),
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (attempt_id, item_id)
);

-- Row 206: the reveal unlocks the family's cosmetic aura; auras stay unlocked after a respec.
CREATE TABLE IF NOT EXISTS family_auras (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  family TEXT NOT NULL CHECK (family IN ('Arcane', 'Ranger', 'Vanguard', 'Warden')),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, family)
);

CREATE TABLE IF NOT EXISTS respec_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL UNIQUE REFERENCES oracle_attempts(id) ON DELETE CASCADE,
  from_family TEXT,
  to_family TEXT,
  fee INTEGER NOT NULL,
  ledger_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Account settings (row 220) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_settings (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  text_size TEXT NOT NULL DEFAULT 'default' CHECK (text_size IN ('small', 'default', 'large', 'xl')),
  high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
  key_bindings JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(key_bindings) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS: own rows readable; badges/world names public to signed-in members ─
ALTER TABLE member_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Identity readable by owner or T1/T2" ON member_identity
  FOR SELECT USING (member_id = (select auth.uid()) OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
ALTER TABLE identity_name_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Name log readable by T1/T2" ON identity_name_log
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
ALTER TABLE identity_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Identity reports readable by T1/T2" ON identity_reports
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
ALTER TABLE oracle_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Oracle attempts readable by owner" ON oracle_attempts FOR SELECT USING (member_id = (select auth.uid()));
ALTER TABLE oracle_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Oracle responses readable by owner" ON oracle_responses
  FOR SELECT USING (EXISTS (SELECT 1 FROM oracle_attempts a WHERE a.id = attempt_id AND a.member_id = (select auth.uid())));
ALTER TABLE family_auras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auras readable by authenticated" ON family_auras FOR SELECT USING ((select auth.role()) = 'authenticated');
ALTER TABLE respec_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Respec log readable by owner or T1/T2" ON respec_log
  FOR SELECT USING (member_id = (select auth.uid()) OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
ALTER TABLE member_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings readable by owner" ON member_settings FOR SELECT USING (member_id = (select auth.uid()));

-- ─── Functions ──────────────────────────────────────────────────────────────

-- Set or change a world name. The filter runs in the route; this enforces
-- uniqueness (index) and the change limit: the first name is free, then one
-- change per p_cooldown_days. Admin resets (p_actor <> p_member, T1/T2) skip the limit.
CREATE OR REPLACE FUNCTION public.identity_set_name(p_member_id UUID, p_name TEXT, p_key TEXT, p_actor_id UUID, p_cooldown_days INTEGER)
RETURNS TABLE (world_name TEXT, name_changes INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  cur member_identity%ROWTYPE;
  v_admin BOOLEAN := p_actor_id <> p_member_id;
BEGIN
  IF v_admin AND (SELECT tier FROM profiles WHERE id = p_actor_id) NOT IN (1, 2) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO member_identity (member_id) VALUES (p_member_id) ON CONFLICT DO NOTHING;
  SELECT * INTO cur FROM member_identity WHERE member_id = p_member_id FOR UPDATE;
  IF cur.world_name_key IS NOT DISTINCT FROM p_key AND cur.world_name IS NOT DISTINCT FROM p_name THEN
    RETURN QUERY SELECT cur.world_name, cur.name_changes, TRUE; RETURN;
  END IF;
  IF NOT v_admin AND cur.name_set_at IS NOT NULL AND cur.name_set_at > NOW() - make_interval(days => p_cooldown_days) THEN
    RAISE EXCEPTION 'too_soon';
  END IF;
  BEGIN
    UPDATE member_identity SET world_name = p_name, world_name_key = p_key, name_set_at = NOW(),
           name_changes = CASE WHEN cur.world_name IS NULL THEN cur.name_changes ELSE cur.name_changes + 1 END, updated_at = NOW()
     WHERE member_id = p_member_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'name_taken';
  END;
  INSERT INTO identity_name_log (member_id, old_name, new_name, changed_by) VALUES (p_member_id, cur.world_name, p_name, p_actor_id);
  RETURN QUERY SELECT p_name, (SELECT m.name_changes FROM member_identity m WHERE m.member_id = p_member_id), FALSE;
END;
$$;

-- Start (or resume) a reading. A member with a result pays the respec fee
-- through wallet_apply and must be past the cooldown. Idempotent per start key.
CREATE OR REPLACE FUNCTION public.oracle_start(p_member_id UUID, p_start_key TEXT, p_item_order TEXT[], p_fee INTEGER, p_cooldown_days INTEGER)
RETURNS TABLE (attempt_id UUID, fee_paid INTEGER, resumed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  a oracle_attempts%ROWTYPE;
  v_last TIMESTAMPTZ;
  v_fee INTEGER := 0;
  v_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO member_identity (member_id) VALUES (p_member_id) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM member_identity WHERE member_id = p_member_id FOR UPDATE;  -- serialise starts
  SELECT * INTO a FROM oracle_attempts WHERE member_id = p_member_id AND (status = 'open' OR start_key = p_start_key)
   ORDER BY (status = 'open') DESC LIMIT 1;
  IF FOUND THEN RETURN QUERY SELECT a.id, a.fee_paid, TRUE; RETURN; END IF;
  SELECT quiz_taken_at INTO v_last FROM member_identity WHERE member_id = p_member_id;
  IF v_last IS NOT NULL THEN
    IF v_last > NOW() - make_interval(days => p_cooldown_days) THEN RAISE EXCEPTION 'cooldown'; END IF;
    v_fee := p_fee;
    IF v_fee > 0 THEN
      PERFORM public.wallet_apply(p_member_id, 'coins', -v_fee, 'respec', 'oracle respec', 'respec:' || p_start_key);
    END IF;
  END IF;
  INSERT INTO oracle_attempts (id, member_id, start_key, item_order, fee_paid) VALUES (v_id, p_member_id, p_start_key, p_item_order, v_fee);
  RETURN QUERY SELECT v_id, v_fee, FALSE;
END;
$$;

-- Store a scored reading: identity family/type, profiles.class (chapter 4 reads it),
-- the family aura, and the respec log. Idempotent: a completed attempt returns as is.
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
  RETURN QUERY SELECT p_family, v_prev, v_new, FALSE;
END;
$$;

DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.identity_set_name(UUID, TEXT, TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.identity_set_name(UUID, TEXT, TEXT, UUID, INTEGER) TO service_role;
  REVOKE ALL ON FUNCTION public.oracle_start(UUID, TEXT, TEXT[], INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.oracle_start(UUID, TEXT, TEXT[], INTEGER, INTEGER) TO service_role;
  REVOKE ALL ON FUNCTION public.oracle_complete(UUID, UUID, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.oracle_complete(UUID, UUID, TEXT, TEXT, JSONB, JSONB) TO service_role;
END $$;

-- ─── Legacy class data → families (retires the 12-question and dashboard quizzes) ─
-- Two legacy vocabularies wrote profiles.class/subclass: the 9-class API map and
-- the dashboard's Warrior/Mage/Healer/Rogue map. Both subclass lists are unique
-- per MBTI type, so subclass → type → family (row 19). Class names alone are
-- ambiguous (e.g. ORACLE = INTP or INFJ), so rows without a known subclass lose
-- their legacy class and get a free new reading. Mapped members keep their
-- family and aura and may also take a free first reading of the new quiz
-- (quiz_taken_at stays NULL: the 12-question result wasn't a full reading).
DO $$
DECLARE
  map JSONB := '{
    "Mastermind":"INTJ","Sage":"INTP","Warlord":"ENTJ","Trickster":"ENTP","Mystic":"INFJ","Dreamwalker":"INFP","Herald":"ENFJ","Wanderer":"ENFP",
    "Sentinel":"ISTJ","Guardian":"ISFJ","Marshal":"ESTJ","Consul":"ESFJ","Artificer":"ISTP","Bard":"ISFP","Tinker":"ESTP","Jester":"ESFP",
    "Tactical Commander":"ENTJ","Iron Marshal":"ESTJ","Vanguard Striker":"ESTP","Battle Strategist":"ENTP","Arcane Architect":"INTJ","Lore Seeker":"INTP",
    "Oracle Sage":"INFJ","Dream Weaver":"INFP","Beacon Guide":"ENFJ","Spirit Catalyst":"ENFP","Shield Warden":"ESFJ","Sanctuary Keeper":"ISFJ",
    "Shadow Tinker":"ISTP","Wandering Artisan":"ISFP","Silent Sentinel":"ISTJ","Blaze Performer":"ESFP"}'::jsonb;
BEGIN
  CREATE TEMP TABLE legacy_family ON COMMIT DROP AS
  SELECT p.id, t.mbti,
         CASE WHEN substr(t.mbti, 2, 1) = 'N' THEN CASE WHEN substr(t.mbti, 3, 1) = 'T' THEN 'Arcane' ELSE 'Warden' END
              ELSE CASE WHEN substr(t.mbti, 4, 1) = 'J' THEN 'Ranger' ELSE 'Vanguard' END END AS family
    FROM profiles p CROSS JOIN LATERAL (SELECT map->>p.subclass AS mbti) t
   WHERE p.class IS NOT NULL AND p.class NOT IN ('Arcane', 'Ranger', 'Vanguard', 'Warden') AND t.mbti IS NOT NULL;
  INSERT INTO member_identity (member_id, mbti_type, family)
    SELECT id, mbti, family FROM legacy_family
    ON CONFLICT (member_id) DO UPDATE SET mbti_type = EXCLUDED.mbti_type, family = EXCLUDED.family;
  INSERT INTO family_auras (member_id, family) SELECT id, family FROM legacy_family ON CONFLICT DO NOTHING;
  UPDATE profiles p SET class = l.family, subclass = NULL FROM legacy_family l WHERE p.id = l.id;
  UPDATE profiles SET class = NULL, subclass = NULL
   WHERE class IS NOT NULL AND class NOT IN ('Arcane', 'Ranger', 'Vanguard', 'Warden');
END $$;
