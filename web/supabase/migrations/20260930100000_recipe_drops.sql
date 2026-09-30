-- ─── Rare-catch recipe drops ────────────────────────────────────────────────
--
-- Ledger rows 199, 258 (specs/crafting.md, crafting-questions.md 11). Apply
-- after 20260929120000_seasonal_events. Needs 20260926160000_crafting
-- (crafting_recipes, member_recipes), 20260929100000_catch_rolls
-- (collections_harvest) and 20260929120000_seasonal_events (seasonal_land).
-- Idempotent. Test: web/supabase/tests/recipe_drops_smoke.sql.
--
-- A rare catch (the roster's rarity: rare, epic or legendary) can teach a
-- crafting recipe the member doesn't know yet, in the same transaction as the
-- catch. The land and harvest steps roll it here; nothing the client sends
-- names a recipe.
--   * crafting_recipes.drop_rarity: the least rare catch that can teach the
--     recipe (NULL: it never drops). Edited in the admin Recipes editor.
--     Starter and shop-card recipes never drop.
--   * recipe_drop_chances: the chance one catch of each rarity teaches a
--     recipe (service role only; no editor yet).
--   * crafting_catch_drop: rolls the drop and records it in member_recipes
--     (source 'catch'), once per recipe per member.
--   * collections_land_drop / collections_harvest_drop: the route's land and
--     harvest steps (seasonal_land, collections_harvest) with the drop, in one
--     transaction: a refused catch teaches nothing.

ALTER TABLE crafting_recipes ADD COLUMN IF NOT EXISTS drop_rarity TEXT CHECK (drop_rarity IN ('rare', 'epic', 'legendary'));
ALTER TABLE member_recipes DROP CONSTRAINT IF EXISTS member_recipes_source_check;
ALTER TABLE member_recipes ADD CONSTRAINT member_recipes_source_check CHECK (source IN ('shop', 'bottle', 'quest', 'admin', 'catch'));

CREATE TABLE IF NOT EXISTS recipe_drop_chances (
  rarity TEXT PRIMARY KEY CHECK (rarity IN ('rare', 'epic', 'legendary')),
  chance NUMERIC NOT NULL CHECK (chance >= 0 AND chance <= 1)
);
ALTER TABLE recipe_drop_chances ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
REVOKE ALL ON recipe_drop_chances FROM anon, authenticated;

-- One catch's drop: at the chance for the species' rarity, a random active
-- drop recipe this rarity can teach and the member lacks. Returns it, or no row.
CREATE OR REPLACE FUNCTION public.crafting_catch_drop(p_member_id UUID, p_item_key TEXT)
RETURNS TABLE (recipe_id TEXT, recipe_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_tiers TEXT[] := ARRAY['rare', 'epic', 'legendary'];
  v_rarity TEXT;
  v_chance NUMERIC;
  v_id TEXT;
BEGIN
  SELECT s.rarity, c.chance INTO v_rarity, v_chance
    FROM collection_species s JOIN recipe_drop_chances c ON c.rarity = s.rarity WHERE s.key = p_item_key;
  IF v_chance IS NULL OR random() >= v_chance THEN RETURN; END IF;
  SELECT r.id INTO v_id FROM crafting_recipes r
   WHERE r.active AND array_position(v_tiers, r.drop_rarity) <= array_position(v_tiers, v_rarity)
     AND NOT r.sources && ARRAY['starter', 'shop']
     AND NOT EXISTS (SELECT 1 FROM member_recipes m WHERE m.member_id = p_member_id AND m.recipe_id = r.id)
   ORDER BY random() LIMIT 1;
  IF v_id IS NULL THEN RETURN; END IF;
  INSERT INTO member_recipes (member_id, recipe_id, source) VALUES (p_member_id, v_id, 'catch') ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;  -- a concurrent catch taught it first
  RETURN QUERY SELECT r.id, COALESCE(s.display_name, w.name, r.id) FROM crafting_recipes r
    LEFT JOIN shop_items s ON s.slug = r.output_item LEFT JOIN weapons w ON w.key = r.output_weapon WHERE r.id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.collections_land_drop(p_member_id UUID, p_roll_id UUID, p_closed TEXT[], p_goal_id UUID, p_cycle INTEGER)
RETURNS TABLE (item_key TEXT, size_cm NUMERIC, count INTEGER, total_collected INTEGER, best_size_cm NUMERIC, new_record BOOLEAN, recipe_id TEXT, recipe_name TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT l.item_key, l.size_cm, l.count, l.total_collected, l.best_size_cm, l.new_record, d.recipe_id, d.recipe_name
    FROM public.seasonal_land(p_member_id, p_roll_id, p_closed, p_goal_id, p_cycle) l
    LEFT JOIN LATERAL public.crafting_catch_drop(p_member_id, l.item_key) d ON TRUE;
$$;

CREATE OR REPLACE FUNCTION public.collections_harvest_drop(p_member_id UUID, p_node_id TEXT, p_hour_key TEXT, p_item_key TEXT, p_size NUMERIC, p_trophy BOOLEAN)
RETURNS TABLE (count INTEGER, total_collected INTEGER, best_size_cm NUMERIC, new_record BOOLEAN, recipe_id TEXT, recipe_name TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT h.count, h.total_collected, h.best_size_cm, h.new_record, d.recipe_id, d.recipe_name
    FROM public.collections_harvest(p_member_id, p_node_id, p_hour_key, p_item_key, p_size, p_trophy) h
    LEFT JOIN LATERAL public.crafting_catch_drop(p_member_id, p_item_key) d ON TRUE;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['crafting_catch_drop(uuid, text)', 'collections_land_drop(uuid, uuid, text[], uuid, integer)', 'collections_harvest_drop(uuid, text, text, text, numeric, boolean)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- ─── Seed (web/lib/crafting/recipes.ts RECIPE_DROPS, RECIPE_DROP_CHANCE) ─────
-- BEGIN GENERATED RECIPE DROPS (web/lib/crafting/seed.ts recipeDropsSql)
UPDATE crafting_recipes r SET drop_rarity = d.rarity FROM (VALUES
  ('rod-glass', 'rare'),
  ('net-silk', 'rare'),
  ('acc-shell-necklace', 'rare'),
  ('outfit-silk-sweater', 'rare'),
  ('furn-study-desk', 'rare'),
  ('furn-bench-park', 'rare'),
  ('furn-streetlamp', 'rare'),
  ('furn-plant-monstera', 'rare'),
  ('furn-wall-clock', 'rare'),
  ('furn-wall-frame', 'rare'),
  ('furn-lounge-rug', 'rare'),
  ('sword-iron', 'rare'),
  ('bow-yew', 'rare'),
  ('net-dragonfly', 'epic'),
  ('shovel-crystal', 'epic'),
  ('outfit-monarch-cape', 'epic')
) AS d (id, rarity) WHERE r.id = d.id AND r.drop_rarity IS NULL;
INSERT INTO recipe_drop_chances (rarity, chance) VALUES ('rare', 0.02), ('epic', 0.05), ('legendary', 0.15)
ON CONFLICT (rarity) DO NOTHING;
-- END GENERATED RECIPE DROPS
