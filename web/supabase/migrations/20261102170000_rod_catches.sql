-- ─── The per-rod catch tracker and the Training rod's trade (rod-gear rounds 4 and 6) ─────────
--
-- David, 2026-11-02: "do a fish caught tracker for all rods so yo know how many fish you caught with a certain rod",
-- and the Training rod: "easter egg to unlock and not a common rod you can buy".
--   * a cast records the held rod (catch_rolls.rod_key; the route checked the member owns it, lib/game/tools.ts);
--   * landing it counts one for that rod (rod_catches), in collections_land's transaction, so a refused land
--     (the hourly caps, a full bag, out of season) counts nothing;
--   * the rod seller's quest (David 2026-11-04): with 35 fish landed on the Flimsy rod, rod_training_trade puts the
--     Training rod in the inventory in the Flimsy's place (owning it retires the starter, lib/game/rods.ts ownsRod;
--     TRAINING.quest: rods.test.ts keeps the numbers equal). Its shop row is seeded off sale by the catalogue seed
--     (lib/wallet/catalogue.ts FOUND_ONLY). A rod's awakenings are worked out in code from these counts.
-- rod_catches is readable by its owner only; nothing but these service-role functions writes it.
-- Test: web/supabase/tests/rod_catches_smoke.sql.

ALTER TABLE catch_rolls ADD COLUMN IF NOT EXISTS rod_key TEXT;

CREATE TABLE IF NOT EXISTS rod_catches (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rod_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, rod_key)
);
ALTER TABLE rod_catches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rod catches readable by owner" ON rod_catches;
CREATE POLICY "Rod catches readable by owner" ON rod_catches FOR SELECT USING (member_id = (select auth.uid()));
REVOKE ALL ON rod_catches FROM anon, authenticated;
GRANT SELECT ON rod_catches TO authenticated;

-- A fishing cast (20261003054110_backpack's, plus the rod). p_rod defaults to NULL so a call without it still works
-- while the code deploys.
DROP FUNCTION IF EXISTS public.collections_cast(UUID, TEXT, NUMERIC, BOOLEAN);
CREATE OR REPLACE FUNCTION public.collections_cast(p_member_id UUID, p_item_key TEXT, p_size NUMERIC, p_trophy BOOLEAN, p_rod TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('catch_rolls:' || p_member_id::text));
  IF EXISTS (SELECT 1 FROM catch_rolls c WHERE c.member_id = p_member_id AND c.node_id IS NULL AND c.rolled_at > NOW() - INTERVAL '4 seconds') THEN
    RAISE EXCEPTION 'too_fast';
  END IF;
  PERFORM public.bag_check(p_member_id, 'bag', p_item_key, 1);
  DELETE FROM catch_rolls c WHERE c.member_id = p_member_id AND c.rolled_at < NOW() - INTERVAL '1 day';
  INSERT INTO catch_rolls (member_id, item_key, size_cm, trophy, rod_key) VALUES (p_member_id, p_item_key, p_size, p_trophy, p_rod) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The reel was won (20260929100000_catch_rolls's, plus the count).
CREATE OR REPLACE FUNCTION public.collections_land(p_member_id UUID, p_roll_id UUID)
RETURNS TABLE (item_key TEXT, size_cm NUMERIC, count INTEGER, total_collected INTEGER, best_size_cm NUMERIC, new_record BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r catch_rolls%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('catch_rolls:' || p_member_id::text));
  SELECT * INTO r FROM catch_rolls c WHERE c.id = p_roll_id AND c.member_id = p_member_id AND c.node_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_roll'; END IF;
  IF r.landed_at IS NOT NULL THEN RAISE EXCEPTION 'already_landed'; END IF;
  IF r.rolled_at < NOW() - INTERVAL '3 minutes'
     OR EXISTS (SELECT 1 FROM catch_rolls c WHERE c.member_id = p_member_id AND c.node_id IS NULL AND c.rolled_at > r.rolled_at) THEN
    RAISE EXCEPTION 'roll_expired';
  END IF;
  IF r.rolled_at > NOW() - INTERVAL '3 seconds' THEN RAISE EXCEPTION 'too_fast'; END IF;
  UPDATE catch_rolls c SET landed_at = NOW() WHERE c.id = r.id;
  IF r.rod_key IS NOT NULL THEN
    INSERT INTO rod_catches AS k (member_id, rod_key, count) VALUES (p_member_id, r.rod_key, 1)
    ON CONFLICT (member_id, rod_key) DO UPDATE SET count = k.count + 1, updated_at = NOW();
  END IF;
  RETURN QUERY SELECT r.item_key, r.size_cm, k.count, k.total_collected, k.best_size_cm, k.new_record
    FROM public.collections_record_catch(p_member_id, r.item_key, r.size_cm, r.trophy) k;
END;
$$;

-- The rod seller's trade: the Flimsy rod for the Training rod, once (TRUE: traded now; FALSE: it was already yours).
CREATE OR REPLACE FUNCTION public.rod_training_trade(p_member_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item UUID; v_slot TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('rod_trade:' || p_member_id::text));
  IF COALESCE((SELECT k.count FROM rod_catches k WHERE k.member_id = p_member_id AND k.rod_key = 'rod_flimsy'), 0) < 35 THEN
    RAISE EXCEPTION 'not_ready';
  END IF;
  SELECT s.id, s.slot INTO v_item, v_slot FROM shop_items s WHERE s.catalogue_ref = 'rod_training';
  IF v_item IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF EXISTS (SELECT 1 FROM member_inventory i WHERE i.member_id = p_member_id AND i.item_id = v_item) THEN RETURN FALSE; END IF;
  INSERT INTO member_inventory (member_id, item_id, qty, slot) VALUES (p_member_id, v_item, 1, v_slot);
  RETURN TRUE;
END;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['collections_cast(uuid, text, numeric, boolean, text)', 'collections_land(uuid, uuid)', 'rod_training_trade(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
