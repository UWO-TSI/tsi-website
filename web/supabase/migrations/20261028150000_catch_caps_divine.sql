-- The hourly catch caps by rarity for the rarity ladder (20261027140000_rarity_ladder): divine and contraband were
-- missing from collections_record_catch's CASE and fell through to the common cap (60 an hour), while the code says 3
-- (lib/collections/memoryStore.ts CAP). Legendary, divine and contraband are 3 an hour, epic 6, rare 12, uncommon 30,
-- anything else 60. 'seaking' stays for any row from before the rename. The rest of the function is
-- 20261003054110_backpack's, unchanged. Idempotent.

CREATE OR REPLACE FUNCTION public.collections_record_catch(p_member_id UUID, p_item_key TEXT, p_size NUMERIC, p_trophy BOOLEAN)
RETURNS TABLE (count INTEGER, total_collected INTEGER, best_size_cm NUMERIC, new_record BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_old NUMERIC;
  v_row member_collections%ROWTYPE;
  v_hour TIMESTAMPTZ := date_trunc('hour', NOW());
  v_rarity TEXT;
BEGIN
  PERFORM public.bag_check(p_member_id, 'bag', p_item_key, 1);
  SELECT s.rarity INTO v_rarity FROM collection_species s WHERE s.key = p_item_key;
  IF v_rarity IS NULL AND to_regclass('public.fish_prices') IS NOT NULL THEN
    EXECUTE 'SELECT rarity FROM public.fish_prices WHERE item_key = $1' INTO v_rarity USING p_item_key;
  END IF;
  DELETE FROM collection_catch_hours h WHERE h.user_id = p_member_id AND h.hour < v_hour;
  INSERT INTO collection_catch_hours AS h (user_id, hour, item_key, n) VALUES (p_member_id, v_hour, p_item_key, 1)
  ON CONFLICT (user_id, hour, item_key) DO UPDATE SET n = h.n + 1
    WHERE h.n < CASE WHEN v_rarity IN ('legendary', 'divine', 'contraband', 'seaking') THEN 3 WHEN v_rarity = 'epic' THEN 6
                     WHEN v_rarity = 'rare' THEN 12 WHEN v_rarity = 'uncommon' THEN 30 ELSE 60 END;
  IF NOT FOUND OR (SELECT sum(h.n) FROM collection_catch_hours h WHERE h.user_id = p_member_id AND h.hour = v_hour) > 200 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT mc.best_size_cm INTO v_old FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key FOR UPDATE;
  INSERT INTO member_collections AS mc (user_id, item_key, count, total_collected, best_size_cm, best_size_at)
  VALUES (p_member_id, p_item_key, 1, 1, p_size, CASE WHEN p_size IS NULL THEN NULL ELSE NOW() END)
  ON CONFLICT (user_id, item_key) DO UPDATE SET
    count = mc.count + 1,
    total_collected = mc.total_collected + 1,
    best_size_cm = CASE WHEN EXCLUDED.best_size_cm IS NOT NULL AND (mc.best_size_cm IS NULL OR EXCLUDED.best_size_cm > mc.best_size_cm) THEN EXCLUDED.best_size_cm ELSE mc.best_size_cm END,
    best_size_at = CASE WHEN EXCLUDED.best_size_cm IS NOT NULL AND (mc.best_size_cm IS NULL OR EXCLUDED.best_size_cm > mc.best_size_cm) THEN NOW() ELSE mc.best_size_at END,
    updated_at = NOW()
  RETURNING mc.* INTO v_row;
  IF p_trophy AND p_size IS NOT NULL THEN
    INSERT INTO weekly_catch_bests AS w (week_start, user_id, item_key, size_cm)
    VALUES (date_trunc('week', NOW() AT TIME ZONE 'America/Toronto')::DATE, p_member_id, p_item_key, p_size)
    ON CONFLICT (week_start, user_id, item_key) DO UPDATE SET size_cm = EXCLUDED.size_cm, caught_at = NOW()
      WHERE EXCLUDED.size_cm > w.size_cm;
  END IF;
  RETURN QUERY SELECT v_row.count, v_row.total_collected, v_row.best_size_cm,
    (p_size IS NOT NULL AND (v_old IS NULL OR p_size > v_old));
END;
$$;
