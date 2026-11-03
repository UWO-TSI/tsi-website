-- The tasting book (game/tasting-book; David, fishing r4 review 2026-11-01: "the tasting book should be impliment ed and
-- one per fish kinda thing and they can either turn into meal that gets buff and a stamp or in the aquarium"; round 2,
-- 2026-11-02: "cooking fee like 100 ... a perm small like 1% buff for fishing for new species and it can unlcok dishes
-- taht are temp big buff but require ingredients and expensive. the fee for cooking scales with new fish unlock"; round 3,
-- 2026-11-03: "key fish, tank is the route for milestones and unlocks and cooking is solely for bonuses, no").
-- * tasting_book: one slot per member per rod species, filled once: 'cooked' (Bancha cooked it: its stamp) or
--   'aquarium' (given to HQ's tank). Owner reads; nobody writes but tasting_serve. The permanent fishing buff is no column:
--   the server's casts add the luck of the member's cooked slots (lib/wallet/rules.ts bookLuck, read by
--   lib/collections/supabaseStore.ts buff), so it can never drift from the stamps.
-- * tasting_serve: the member brings one unlocked fish of a rod species whose slot is empty (already_in_book otherwise;
--   collections_take_one: it leaves the bag). 'cook' pays p_fee plus p_fee_step for each species cooked before (a 'shop'
--   debit, summed here under the member's lock) and stamps the slot, and that is all a cook gives; 'aquarium' fills it
--   free. Only a gift can complete a milestone, paid once as a 'quest' credit in the same transaction: the fish in the
--   tank reaching one of p_marks (pays the matching p_mark_pay), and every fish of the slot's water
--   (collection_species.biome) in the tank (p_full_pay). Once per key (tasting_serves). The server prices it all
--   (lib/wallet/catalogue.ts TASTING); this bounds it. Service role only.
-- * tasting_dish: a dish the book taught (TASTING.dishes): not_learned until its key fish p_unlock is in the tank; one of each
--   p_ingredients entry leaves the bag (a key twice is two), p_price coins are paid ('shop'), and the dish's buff
--   replaces the meal buff (member_buffs), like sushi_order. Once per key, in sushi_orders. Service role only.
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

-- Round 1's signature, in case a local or staging copy ran it (prod never did).
DROP FUNCTION IF EXISTS public.tasting_serve(uuid, text, text, integer, numeric, numeric, timestamptz, integer[], integer[], integer, text);
CREATE OR REPLACE FUNCTION public.tasting_serve(p_member_id UUID, p_species_key TEXT, p_way TEXT, p_fee INTEGER, p_fee_step INTEGER,
  p_marks INTEGER[], p_mark_pay INTEGER[], p_full_pay INTEGER, p_idempotency_key TEXT)
RETURNS TABLE (balance INTEGER, remaining INTEGER, paid INTEGER, stamped BOOLEAN, earned INTEGER, marks TEXT[], replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_bal INTEGER;
  v_have INTEGER;
  v_fee INTEGER := 0;
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
  IF p_way NOT IN ('cook', 'aquarium') OR p_fee < 1 OR p_fee > 500 OR p_fee_step < 0 OR p_fee_step > 50 OR p_full_pay < 0 OR p_full_pay > 5000
     OR p_marks IS NULL OR p_mark_pay IS NULL OR cardinality(p_marks) <> cardinality(p_mark_pay) OR cardinality(p_marks) > 5
     OR EXISTS (SELECT 1 FROM unnest(p_marks) n WHERE n < 1 OR n > 500) OR EXISTS (SELECT 1 FROM unnest(p_mark_pay) c WHERE c < 0 OR c > 5000) THEN
    RAISE EXCEPTION 'bad_qty';
  END IF;
  -- Only what a rod brings in has a slot, and a slot fills once.
  SELECT sp.biome INTO v_biome FROM collection_species sp WHERE sp.key = p_species_key AND sp.tool = 'rod' AND sp.active;
  IF v_biome IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF EXISTS (SELECT 1 FROM tasting_book b WHERE b.member_id = p_member_id AND b.species_key = p_species_key) THEN
    RAISE EXCEPTION 'already_in_book';
  END IF;
  v_have := public.collections_take_one(p_member_id, p_species_key);
  IF p_way = 'cook' THEN
    v_fee := p_fee + p_fee_step * (SELECT count(*) FROM tasting_book b WHERE b.member_id = p_member_id AND b.way = 'cooked')::INTEGER;
    SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', -v_fee, 'shop', 'tasting:' || p_species_key, 'tasting:' || p_idempotency_key) a;
  ELSE
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id;
  END IF;
  INSERT INTO tasting_book (member_id, species_key, way) VALUES (p_member_id, p_species_key, CASE WHEN p_way = 'cook' THEN 'cooked' ELSE 'aquarium' END);
  -- The milestones are the tank's: gifts fill one at a time, so its count passes each mark once.
  IF p_way = 'aquarium' THEN
    SELECT count(*) INTO v_count FROM tasting_book b WHERE b.member_id = p_member_id AND b.way = 'aquarium';
    FOR i IN 1 .. cardinality(p_marks) LOOP
      IF v_count = p_marks[i] THEN v_earned := v_earned + p_mark_pay[i]; v_marks := v_marks || ('count:' || v_count); END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM collection_species sp WHERE sp.tool = 'rod' AND sp.active AND sp.biome = v_biome
                   AND NOT EXISTS (SELECT 1 FROM tasting_book b WHERE b.member_id = p_member_id AND b.species_key = sp.key AND b.way = 'aquarium')) THEN
      v_earned := v_earned + p_full_pay; v_marks := v_marks || ('water:' || v_biome);
    END IF;
  END IF;
  IF v_earned > 0 THEN
    SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', v_earned, 'quest', 'tasting:' || array_to_string(v_marks, ','), 'tasting_mark:' || p_idempotency_key) a;
  END IF;
  INSERT INTO tasting_serves (member_id, idempotency_key, species_key, way, paid, remaining, stamped, earned, marks)
  VALUES (p_member_id, p_idempotency_key, p_species_key, p_way, v_fee, v_have, p_way = 'cook', v_earned, v_marks);
  RETURN QUERY SELECT COALESCE(v_bal, 0), v_have, v_fee, p_way = 'cook', v_earned, v_marks, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.tasting_dish(p_member_id UUID, p_dish TEXT, p_price INTEGER, p_unlock TEXT, p_ingredients TEXT[],
  p_luck NUMERIC, p_size NUMERIC, p_until TIMESTAMPTZ, p_idempotency_key TEXT)
RETURNS TABLE (balance INTEGER, paid INTEGER, source TEXT, luck NUMERIC, size NUMERIC, until TIMESTAMPTZ, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_bal INTEGER;
  k TEXT;
  o sushi_orders%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_member_id::TEXT || ':sushi:' || p_idempotency_key));
  SELECT * INTO o FROM sushi_orders s WHERE s.member_id = p_member_id AND s.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    SELECT w.coins INTO v_bal FROM wallets w WHERE w.member_id = p_member_id;
    RETURN QUERY SELECT COALESCE(v_bal, 0), o.paid, o.dish, o.luck, o.size, o.until, TRUE; RETURN;
  END IF;
  IF p_price < 1 OR p_price > 5000 OR p_ingredients IS NULL OR cardinality(p_ingredients) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'bad_qty'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tasting_book b WHERE b.member_id = p_member_id AND b.species_key = p_unlock AND b.way = 'aquarium') THEN
    RAISE EXCEPTION 'not_learned';
  END IF;
  FOREACH k IN ARRAY p_ingredients LOOP PERFORM public.collections_take_one(p_member_id, k); END LOOP;
  SELECT a.balance INTO v_bal FROM public.wallet_apply(p_member_id, 'coins', -p_price, 'shop', 'dish:' || p_dish, 'dish:' || p_idempotency_key) a;
  INSERT INTO member_buffs (member_id, source, luck, size, until) VALUES (p_member_id, p_dish, p_luck, p_size, p_until)
  ON CONFLICT (member_id) DO UPDATE SET source = EXCLUDED.source, luck = EXCLUDED.luck, size = EXCLUDED.size, until = EXCLUDED.until;
  INSERT INTO sushi_orders (member_id, idempotency_key, dish, paid, fish_key, luck, size, until)
  VALUES (p_member_id, p_idempotency_key, p_dish, p_price, array_to_string(p_ingredients, ','), p_luck, p_size, p_until);
  RETURN QUERY SELECT COALESCE(v_bal, 0), p_price, p_dish, p_luck, p_size, p_until, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.tasting_serve(uuid, text, text, integer, integer, integer[], integer[], integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasting_serve(uuid, text, text, integer, integer, integer[], integer[], integer, text) TO service_role;
REVOKE ALL ON FUNCTION public.tasting_dish(uuid, text, integer, text, text[], numeric, numeric, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasting_dish(uuid, text, integer, text, text[], numeric, numeric, timestamptz, text) TO service_role;
