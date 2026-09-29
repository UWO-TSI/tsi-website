-- ─── Server-authoritative catch rolls ────────────────────────────────────────
--
-- Roadmap row "Server-authoritative catch rolls". Apply after 20260927090000.
-- The server rolls every catch (web/lib/collections/rolls.ts) and records it
-- here; the client only asks for a roll at a place. Before this, the client
-- reported the species and size and only collections_record_catch's hourly
-- caps bounded it. Those caps stay: every catch below goes through it.
--   * a fishing cast is rolled and kept until the reel is won, then landed once:
--     casts at least 4 s apart, landed 3 s to 3 min after the roll, only the
--     member's latest cast (a newer cast voids the older one);
--   * a forage node or bug spot is harvested once per member per Toronto hour.
-- All three functions are service-role only. Test: web/supabase/tests/catch_rolls_smoke.sql.

CREATE TABLE IF NOT EXISTS catch_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  node_id TEXT,  -- null for a fishing cast
  hour_key TEXT, -- Toronto "YYYY-MM-DDTHH" of a harvest
  item_key TEXT NOT NULL,
  size_cm NUMERIC,
  trophy BOOLEAN NOT NULL DEFAULT FALSE,
  rolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  landed_at TIMESTAMPTZ,
  CHECK ((node_id IS NULL) = (hour_key IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catch_rolls_one_harvest ON catch_rolls (member_id, node_id, hour_key) WHERE node_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catch_rolls_member ON catch_rolls (member_id, rolled_at DESC);
ALTER TABLE catch_rolls ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
REVOKE ALL ON catch_rolls FROM anon, authenticated;

-- A fishing cast: refused within 4 s of the member's previous cast. Returns the roll id.
CREATE OR REPLACE FUNCTION public.collections_cast(p_member_id UUID, p_item_key TEXT, p_size NUMERIC, p_trophy BOOLEAN)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('catch_rolls:' || p_member_id::text));
  IF EXISTS (SELECT 1 FROM catch_rolls c WHERE c.member_id = p_member_id AND c.node_id IS NULL AND c.rolled_at > NOW() - INTERVAL '4 seconds') THEN
    RAISE EXCEPTION 'too_fast';
  END IF;
  DELETE FROM catch_rolls c WHERE c.member_id = p_member_id AND c.rolled_at < NOW() - INTERVAL '1 day';
  INSERT INTO catch_rolls (member_id, item_key, size_cm, trophy) VALUES (p_member_id, p_item_key, p_size, p_trophy) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The reel was won: record the member's latest cast once, 3 s to 3 min after it was rolled.
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
  RETURN QUERY SELECT r.item_key, r.size_cm, k.count, k.total_collected, k.best_size_cm, k.new_record
    FROM public.collections_record_catch(p_member_id, r.item_key, r.size_cm, r.trophy) k;
END;
$$;

-- A forage node or bug spot: once per member, node and hour (a capped catch leaves it unharvested).
CREATE OR REPLACE FUNCTION public.collections_harvest(p_member_id UUID, p_node_id TEXT, p_hour_key TEXT, p_item_key TEXT, p_size NUMERIC, p_trophy BOOLEAN)
RETURNS TABLE (count INTEGER, total_collected INTEGER, best_size_cm NUMERIC, new_record BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM catch_rolls c WHERE c.member_id = p_member_id AND c.rolled_at < NOW() - INTERVAL '1 day';
  INSERT INTO catch_rolls (member_id, node_id, hour_key, item_key, size_cm, trophy, landed_at)
  VALUES (p_member_id, p_node_id, p_hour_key, p_item_key, p_size, p_trophy, NOW())
  ON CONFLICT (member_id, node_id, hour_key) WHERE node_id IS NOT NULL DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'already_harvested'; END IF;
  RETURN QUERY SELECT * FROM public.collections_record_catch(p_member_id, p_item_key, p_size, p_trophy);
END;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['collections_cast(uuid, text, numeric, boolean)', 'collections_land(uuid, uuid)', 'collections_harvest(uuid, text, text, text, numeric, boolean)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
