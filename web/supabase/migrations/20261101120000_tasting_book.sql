-- The tasting book (game/tasting-book; David, fishing r4 review 2026-11-01: "the tasting book should be impliment ed and
-- one per fish kinda thing and they can either turn into meal that gets buff and a stamp or in the aquarium").
-- * tasting_book: one slot per member per rod species, filled once: 'cooked' (Bancha made it into a nigiri: its stamp)
--   or 'aquarium' (given to HQ's tank). Owner reads; nobody writes but tasting_serve.
-- * tasting_serve: the member brings one unlocked fish of a rod species (collections_take_one: it leaves the bag).
--   'cook' pays the fee (a 'shop' debit) and sets the meal buff (member_buffs, the last meal replaces it); the slot is
--   stamped the first time only, a cook again is just the meal. 'aquarium' fills an empty slot only (already_in_book).
--   A newly filled slot can complete a milestone, paid once as a 'quest' credit in the same transaction: the book's
--   count reaching one of p_marks (pays the matching p_mark_pay), and the slot's water (collection_species.biome) full
--   (p_full_pay). The server prices the fee, the buff and the milestones (lib/wallet/catalogue.ts TASTING); this
--   bounds them. Once per key (tasting_serves). Service role only.
-- * HQ's tank shows the club's gifts: the service reads every 'aquarium' slot (lib/wallet/service.ts tastingView).

CREATE TABLE IF NOT EXISTS tasting_book (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  species_key TEXT NOT NULL REFERENCES collection_species(key) ON DELETE CASCADE,
  way TEXT NOT NULL CHECK (way IN ('cooked', 'aquarium')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, species_key)
);
CREATE INDEX IF NOT EXISTS idx_tasting_book_aquarium ON tasting_book (created_at DESC) WHERE way = 'aquarium';
ALTER TABLE tasting_book ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tasting book readable by owner" ON tasting_book;
CREATE POLICY "Tasting book readable by owner" ON tasting_book FOR SELECT USING ((select auth.uid()) = member_id);
REVOKE INSERT, UPDATE, DELETE ON tasting_book FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS tasting_serves (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 6 AND 200),
  species_key TEXT NOT NULL,
  way TEXT NOT NULL CHECK (way IN ('cook', 'aquarium')),
  paid INTEGER NOT NULL CHECK (paid >= 0),
  remaining INTEGER NOT NULL,
  stamped BOOLEAN NOT NULL,
  earned INTEGER NOT NULL CHECK (earned >= 0),
  marks TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, idempotency_key)
);
ALTER TABLE tasting_serves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tasting serves readable by owner" ON tasting_serves;
CREATE POLICY "Tasting serves readable by owner" ON tasting_serves FOR SELECT USING ((select auth.uid()) = member_id);
REVOKE INSERT, UPDATE, DELETE ON tasting_serves FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasting_serve(p_member_id UUID, p_species_key TEXT, p_way TEXT, p_fee INTEGER, p_luck NUMERIC, p_size NUMERIC,
  p_until TIMESTAMPTZ, p_marks INTEGER[], p_mark_pay INTEGER[], p_full_pay INTEGER, p_idempotency_key TEXT)
RETURNS TABLE (balance INTEGER, remaining INTEGER, paid INTEGER, stamped BOOLEAN, earned INTEGER, marks TEXT[], replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_bal INTEGER;
  v_have INTEGER;
  v_new BOOLEAN := FALSE;
  v_biome TEXT;
  v_count INTEGER;
  v_earned INTEGER := 0;
  v_marks TEXT[] := '{}';
  s tasting_serves%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_member_id::TEXT || ':tasting'));
  SELECT * INTO s FROM tasting_serves t WHERE t.member_id = p_member_id AND t.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id;
    RETURN QUERY SELECT COALESCE(v_bal, 0), s.remaining, s.paid, s.stamped, s.earned, s.marks, TRUE; RETURN;
  END IF;
  IF p_way NOT IN ('cook', 'aquarium') OR p_fee < 0 OR p_fee > 500 OR p_full_pay < 0 OR p_full_pay > 5000
     OR p_marks IS NULL OR p_mark_pay IS NULL OR cardinality(p_marks) <> cardinality(p_mark_pay) OR cardinality(p_marks) > 5
     OR EXISTS (SELECT 1 FROM unnest(p_marks) n WHERE n < 1 OR n > 500) OR EXISTS (SELECT 1 FROM unnest(p_mark_pay) c WHERE c < 0 OR c > 5000) THEN
    RAISE EXCEPTION 'bad_qty';
  END IF;
  -- Only what a rod brings in has a slot.
  SELECT sp.biome INTO v_biome FROM collection_species sp WHERE sp.key = p_species_key AND sp.tool = 'rod' AND sp.active;
  IF v_biome IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p_way = 'aquarium' AND EXISTS (SELECT 1 FROM tasting_book b WHERE b.member_id = p_member_id AND b.species_key = p_species_key) THEN
    RAISE EXCEPTION 'already_in_book';
  END IF;
  v_have := public.collections_take_one(p_member_id, p_species_key);
  IF p_way = 'cook' THEN
    SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', -p_fee, 'shop', 'tasting:' || p_species_key, 'tasting:' || p_idempotency_key) a;
    INSERT INTO member_buffs (member_id, source, luck, size, until) VALUES (p_member_id, 'tasting', p_luck, p_size, p_until)
    ON CONFLICT (member_id) DO UPDATE SET source = EXCLUDED.source, luck = EXCLUDED.luck, size = EXCLUDED.size, until = EXCLUDED.until;
  ELSE
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id;
  END IF;
  INSERT INTO tasting_book (member_id, species_key, way) VALUES (p_member_id, p_species_key, CASE WHEN p_way = 'cook' THEN 'cooked' ELSE 'aquarium' END)
  ON CONFLICT (member_id, species_key) DO NOTHING;
  v_new := FOUND;
  IF v_new THEN
    -- Slots fill one at a time, so the count passes each mark once.
    SELECT count(*) INTO v_count FROM tasting_book b WHERE b.member_id = p_member_id;
    FOR i IN 1 .. cardinality(p_marks) LOOP
      IF v_count = p_marks[i] THEN v_earned := v_earned + p_mark_pay[i]; v_marks := v_marks || ('count:' || v_count); END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM collection_species sp WHERE sp.tool = 'rod' AND sp.active AND sp.biome = v_biome
                   AND NOT EXISTS (SELECT 1 FROM tasting_book b WHERE b.member_id = p_member_id AND b.species_key = sp.key)) THEN
      v_earned := v_earned + p_full_pay; v_marks := v_marks || ('water:' || v_biome);
    END IF;
    IF v_earned > 0 THEN
      SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', v_earned, 'quest', 'tasting:' || array_to_string(v_marks, ','), 'tasting_mark:' || p_idempotency_key) a;
    END IF;
  END IF;
  INSERT INTO tasting_serves (member_id, idempotency_key, species_key, way, paid, remaining, stamped, earned, marks)
  VALUES (p_member_id, p_idempotency_key, p_species_key, p_way, CASE WHEN p_way = 'cook' THEN p_fee ELSE 0 END, v_have, v_new AND p_way = 'cook', v_earned, v_marks);
  RETURN QUERY SELECT COALESCE(v_bal, 0), v_have, CASE WHEN p_way = 'cook' THEN p_fee ELSE 0 END, v_new AND p_way = 'cook', v_earned, v_marks, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.tasting_serve(uuid, text, text, integer, numeric, numeric, timestamptz, integer[], integer[], integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasting_serve(uuid, text, text, integer, numeric, numeric, timestamptz, integer[], integer[], integer, text) TO service_role;
