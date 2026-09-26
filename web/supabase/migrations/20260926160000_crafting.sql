-- ─── Crafting: recipes, learning, the workbench ─────────────────────────────
--
-- DRAFT 2026-09-26. NOT APPLIED. Spec: specs/crafting.md (rows 58, 60, 62,
-- 63, 94, 129, 193, 198, 199). Apply after every 20260926150x/151x game draft.
-- Depends on 023 + 20260926150400 (member_collections, collection_species),
-- 20260926150600 (shop_items, member_inventory), 20260926150800 (weapons,
-- member_weapons).
--
-- Reliable crafting (row 63): learn a recipe, gather its ingredients, craft at
-- a workbench. Ingredients come out of member_collections (the same stock the
-- wharf buys), outputs go into member_inventory (or member_weapons for combat
-- gear). Every write is a service-role function; members only read their rows.
-- Test: web/supabase/tests/crafting_smoke.sql.

-- ─── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crafting_recipes (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,48}$'),
  output_item TEXT REFERENCES shop_items(slug) ON UPDATE CASCADE,
  output_weapon TEXT REFERENCES weapons(key),
  output_qty INTEGER NOT NULL DEFAULT 1 CHECK (output_qty BETWEEN 1 AND 20),
  ingredients JSONB NOT NULL CHECK (jsonb_typeof(ingredients) = 'object' AND ingredients <> '{}'::jsonb), -- item_key → count
  sources TEXT[] NOT NULL CHECK (sources <@ ARRAY['starter', 'shop', 'bottle', 'quest']::text[]),         -- starter = known by everyone
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK ((output_item IS NULL) <> (output_weapon IS NULL))
);
ALTER TABLE crafting_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipes readable by authenticated" ON crafting_recipes FOR SELECT USING ((select auth.role()) = 'authenticated');
CREATE POLICY "Recipes writable by T1/T2" ON crafting_recipes
  FOR ALL USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2))
  WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

CREATE TABLE IF NOT EXISTS member_recipes (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL REFERENCES crafting_recipes(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('shop', 'bottle', 'quest', 'admin')),
  bottle_day DATE, -- Toronto day of the beach bottle that taught it: one bottle a day
  learned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, recipe_id),
  CHECK ((source = 'bottle') = (bottle_day IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_recipes_bottle_day ON member_recipes (member_id, bottle_day) WHERE bottle_day IS NOT NULL;
ALTER TABLE member_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipes known readable by owner or T1/T2" ON member_recipes
  FOR SELECT USING (member_id = (select auth.uid()) OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

CREATE TABLE IF NOT EXISTS craft_log (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 6 AND 200),
  recipe_id TEXT NOT NULL REFERENCES crafting_recipes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, idempotency_key)
);
ALTER TABLE craft_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Craft log readable by owner" ON craft_log FOR SELECT USING (member_id = (select auth.uid()));

-- ─── Functions (service role only) ──────────────────────────────────────────

-- Craft once per key: learned check, every ingredient debited, output credited,
-- all in one transaction. The log row goes in first so a concurrent retry with
-- the same key waits on it and then replays; any failure rolls the row back.
CREATE OR REPLACE FUNCTION public.crafting_craft(p_member_id UUID, p_recipe_id TEXT, p_idempotency_key TEXT)
RETURNS TABLE (output TEXT, qty INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  r crafting_recipes%ROWTYPE;
  it shop_items%ROWTYPE;
  ing RECORD;
  v_prior TEXT;
BEGIN
  INSERT INTO craft_log (member_id, idempotency_key, recipe_id) VALUES (p_member_id, p_idempotency_key, p_recipe_id)
  ON CONFLICT (member_id, idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT l.recipe_id INTO v_prior FROM craft_log l WHERE l.member_id = p_member_id AND l.idempotency_key = p_idempotency_key;
    IF v_prior <> p_recipe_id THEN RAISE EXCEPTION 'key_reused'; END IF;
    SELECT * INTO r FROM crafting_recipes WHERE id = p_recipe_id;
    RETURN QUERY SELECT COALESCE(r.output_item, r.output_weapon), r.output_qty, TRUE; RETURN;
  END IF;
  SELECT * INTO r FROM crafting_recipes WHERE id = p_recipe_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT ('starter' = ANY(r.sources) OR EXISTS (SELECT 1 FROM member_recipes m WHERE m.member_id = p_member_id AND m.recipe_id = r.id)) THEN
    RAISE EXCEPTION 'not_learned';
  END IF;
  -- Row locks serialise two crafts racing for the same stock.
  FOR ing IN SELECT e.key, e.value::INTEGER AS n FROM jsonb_each_text(r.ingredients) e LOOP
    UPDATE member_collections mc SET count = mc.count - ing.n, updated_at = NOW()
     WHERE mc.user_id = p_member_id AND mc.item_key = ing.key AND mc.count >= ing.n;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_items'; END IF;
  END LOOP;
  IF r.output_item IS NOT NULL THEN
    SELECT * INTO it FROM shop_items WHERE slug = r.output_item;
    IF it.stackable THEN
      INSERT INTO member_inventory (member_id, item_id, qty, slot) VALUES (p_member_id, it.id, r.output_qty, it.slot)
      ON CONFLICT (member_id, item_id) DO UPDATE SET qty = member_inventory.qty + EXCLUDED.qty;
    ELSE
      INSERT INTO member_inventory (member_id, item_id, qty, slot) VALUES (p_member_id, it.id, 1, it.slot) ON CONFLICT DO NOTHING;
      IF NOT FOUND THEN RAISE EXCEPTION 'already_owned'; END IF;
    END IF;
  ELSE
    INSERT INTO member_weapons (member_id, weapon_key, durability)
    SELECT p_member_id, w.key, w.max_durability FROM weapons w WHERE w.key = r.output_weapon
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN RAISE EXCEPTION 'already_owned'; END IF;
  END IF;
  RETURN QUERY SELECT COALESCE(r.output_item, r.output_weapon), r.output_qty, FALSE;
END;
$$;

-- Server-side learning hook (resident quests, admin grants). Idempotent.
CREATE OR REPLACE FUNCTION public.crafting_learn(p_member_id UUID, p_recipe_id TEXT, p_source TEXT)
RETURNS TABLE (learned BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF p_source NOT IN ('quest', 'admin') THEN RAISE EXCEPTION 'bad_source'; END IF;
  IF NOT EXISTS (SELECT 1 FROM crafting_recipes WHERE id = p_recipe_id AND active) THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO member_recipes (member_id, recipe_id, source) VALUES (p_member_id, p_recipe_id, p_source) ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT FOUND;
END;
$$;

-- Today's message bottle (one per Toronto day): a bottle recipe the member
-- lacks, picked the same way on every retry that day.
CREATE OR REPLACE FUNCTION public.crafting_open_bottle(p_member_id UUID)
RETURNS TABLE (recipe_id TEXT, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_day DATE := (NOW() AT TIME ZONE 'America/Toronto')::DATE;
  v_id TEXT;
BEGIN
  SELECT m.recipe_id INTO v_id FROM member_recipes m WHERE m.member_id = p_member_id AND m.bottle_day = v_day;
  IF FOUND THEN RETURN QUERY SELECT v_id, TRUE; RETURN; END IF;
  SELECT r.id INTO v_id FROM crafting_recipes r
   WHERE r.active AND 'bottle' = ANY(r.sources) AND NOT 'starter' = ANY(r.sources)
     AND NOT EXISTS (SELECT 1 FROM member_recipes m WHERE m.member_id = p_member_id AND m.recipe_id = r.id)
   ORDER BY md5(p_member_id::TEXT || v_day::TEXT || r.id) LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'nothing_left'; END IF;
  BEGIN
    INSERT INTO member_recipes (member_id, recipe_id, source, bottle_day) VALUES (p_member_id, v_id, 'bottle', v_day);
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent open won the day; return what it learned.
    SELECT m.recipe_id INTO v_id FROM member_recipes m WHERE m.member_id = p_member_id AND m.bottle_day = v_day;
    RETURN QUERY SELECT v_id, TRUE; RETURN;
  END;
  RETURN QUERY SELECT v_id, FALSE;
END;
$$;

-- Buying a recipe card in the shop teaches it (row 199): the purchase and the
-- lesson are one transaction (economy_buy's insert fires this).
CREATE OR REPLACE FUNCTION public.crafting_learn_from_card() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO member_recipes (member_id, recipe_id, source)
  SELECT NEW.member_id, r.id, 'shop' FROM shop_items s JOIN crafting_recipes r ON 'recipe:' || r.id = s.catalogue_ref
   WHERE s.id = NEW.item_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_member_inventory_recipe_card ON member_inventory;
CREATE TRIGGER trg_member_inventory_recipe_card AFTER INSERT ON member_inventory
  FOR EACH ROW EXECUTE FUNCTION public.crafting_learn_from_card();

DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.crafting_craft(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.crafting_craft(UUID, TEXT, TEXT) TO service_role;
  REVOKE ALL ON FUNCTION public.crafting_learn(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.crafting_learn(UUID, TEXT, TEXT) TO service_role;
  REVOKE ALL ON FUNCTION public.crafting_open_bottle(UUID) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.crafting_open_bottle(UUID) TO service_role;
  REVOKE ALL ON FUNCTION public.crafting_learn_from_card() FROM PUBLIC, anon, authenticated;
END $$;

-- ─── Seed (web/lib/crafting/recipes.ts) ─────────────────────────────────────
-- BEGIN GENERATED CRAFTING SEED (web/scripts/gen-crafting-seed.mjs)
INSERT INTO collection_species (key, category, sub, name, biome, tool, rarity, size_min_cm, size_max_cm, start_hour, end_hour,
  rain_any_hour, weather, months, one_liner, icon, model, asset_ready, donatable, wing, position) VALUES
  ('wood_branch', 'mineral', 'wood', 'Tree branch', 'trees', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'Shake a tree and one usually falls out.', NULL, NULL, FALSE, FALSE, NULL, 101)
ON CONFLICT (key) DO NOTHING;
INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, position, active) VALUES
  ('rod-lighthouse', 'Lighthouse rod', 'tool', 'Tier 4. Legendary fish will bite.', 3000, NULL, 'premium', 'rod', FALSE, FALSE, NULL, 'rod_lighthouse', 101, FALSE),
  ('rod-tidewarden', 'Tidewarden rod', 'tool', 'Tier 5. The widest bite window on the island.', 6000, NULL, 'premium', 'rod', FALSE, FALSE, NULL, 'rod_tidewarden', 102, FALSE),
  ('net-silk', 'Silk net', 'tool', 'Tier 3. Crafted at a workbench.', 1200, NULL, 'premium', 'net', FALSE, FALSE, NULL, NULL, 103, FALSE),
  ('net-dragonfly', 'Dragonfly net', 'tool', 'Tier 4. Crafted at a workbench.', 3000, NULL, 'premium', 'net', FALSE, FALSE, NULL, NULL, 104, FALSE),
  ('net-emperor', 'Emperor net', 'tool', 'Tier 5. Crafted at a workbench.', 6000, NULL, 'premium', 'net', FALSE, FALSE, NULL, NULL, 105, FALSE),
  ('shovel-sturdy', 'Sturdy shovel', 'tool', 'Tier 3. Crafted at a workbench.', 1200, NULL, 'premium', 'shovel', FALSE, FALSE, NULL, NULL, 106, FALSE),
  ('shovel-crystal', 'Crystal shovel', 'tool', 'Tier 4. Crafted at a workbench.', 3000, NULL, 'premium', 'shovel', FALSE, FALSE, NULL, NULL, 107, FALSE),
  ('shovel-gold', 'Golden shovel', 'tool', 'Tier 5. Crafted at a workbench.', 6000, NULL, 'premium', 'shovel', FALSE, FALSE, NULL, NULL, 108, FALSE),
  ('acc-flower-crown', 'Flower crown', 'accessory', '', 200, NULL, NULL, 'accessory', FALSE, FALSE, NULL, NULL, 109, FALSE),
  ('acc-shell-necklace', 'Shell necklace', 'accessory', '', 250, NULL, NULL, 'accessory', FALSE, FALSE, NULL, NULL, 110, FALSE),
  ('acc-crystal-circlet', 'Crystal circlet', 'accessory', 'Rare. Catches the lamplight.', 2000, NULL, NULL, 'accessory', FALSE, FALSE, NULL, NULL, 111, FALSE),
  ('outfit-silk-sweater', 'Silk sweater', 'outfit', '', 300, NULL, NULL, 'outfit', FALSE, FALSE, NULL, NULL, 112, FALSE),
  ('outfit-monarch-cape', 'Monarch cape', 'outfit', 'Rare. Orange and black, like October.', 1500, NULL, NULL, 'outfit', FALSE, FALSE, NULL, NULL, 113, FALSE),
  ('outfit-koi-kimono', 'Koi kimono', 'outfit', 'Rare. Woven around a golden koi scale.', 4000, NULL, NULL, 'outfit', FALSE, FALSE, NULL, NULL, 114, FALSE),
  ('card-shovel-sturdy', 'Sturdy shovel recipe', 'tool', 'Recipe card. Buying it teaches you the recipe.', 300, NULL, NULL, NULL, FALSE, FALSE, NULL, 'recipe:shovel-sturdy', 115, TRUE),
  ('card-acc-flower-crown', 'Flower crown recipe', 'tool', 'Recipe card. Buying it teaches you the recipe.', 300, NULL, NULL, NULL, FALSE, FALSE, NULL, 'recipe:acc-flower-crown', 116, TRUE),
  ('card-furn-bookshelf', 'Bookshelf recipe', 'tool', 'Recipe card. Buying it teaches you the recipe.', 300, NULL, NULL, NULL, FALSE, FALSE, NULL, 'recipe:furn-bookshelf', 117, TRUE),
  ('card-furn-floor-lamp', 'Floor lamp recipe', 'tool', 'Recipe card. Buying it teaches you the recipe.', 300, NULL, NULL, NULL, FALSE, FALSE, NULL, 'recipe:furn-floor-lamp', 118, TRUE)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO crafting_recipes (id, output_item, output_weapon, output_qty, ingredients, sources, position) VALUES
  ('rod-glass', 'rod-glass', NULL, 1, '{"wood_branch":4,"rock_crystal":1,"rock_clay":2}'::jsonb, ARRAY['bottle']::text[], 1),
  ('rod-lighthouse', 'rod-lighthouse', NULL, 1, '{"wood_branch":6,"rock_iron_nugget":3,"sea_pearl_oyster":1,"fish_black_bass":1}'::jsonb, ARRAY['quest','bottle']::text[], 2),
  ('rod-tidewarden', 'rod-tidewarden', NULL, 1, '{"wood_branch":8,"rock_gold_nugget":1,"rock_crystal":2,"fish_tuna":1,"sea_giant_isopod":1}'::jsonb, ARRAY['quest','bottle']::text[], 3),
  ('net-silk', 'net-silk', NULL, 1, '{"wood_branch":4,"bug_bagworm":3}'::jsonb, ARRAY['bottle']::text[], 4),
  ('net-dragonfly', 'net-dragonfly', NULL, 1, '{"wood_branch":5,"rock_iron_nugget":2,"bug_darner_dragonfly":2}'::jsonb, ARRAY['bottle']::text[], 5),
  ('net-emperor', 'net-emperor', NULL, 1, '{"wood_branch":6,"rock_gold_nugget":1,"bug_emperor_butterfly":1,"bug_rhinoceros_beetle":1}'::jsonb, ARRAY['quest','bottle']::text[], 6),
  ('shovel-sturdy', 'shovel-sturdy', NULL, 1, '{"wood_branch":2,"rock_iron_nugget":3,"rock_stone":2}'::jsonb, ARRAY['shop']::text[], 7),
  ('shovel-crystal', 'shovel-crystal', NULL, 1, '{"wood_branch":3,"rock_iron_nugget":3,"rock_crystal":2}'::jsonb, ARRAY['bottle']::text[], 8),
  ('shovel-gold', 'shovel-gold', NULL, 1, '{"wood_branch":3,"rock_iron_nugget":4,"rock_gold_nugget":2}'::jsonb, ARRAY['quest','bottle']::text[], 9),
  ('acc-straw-hat', 'acc-straw-hat', NULL, 1, '{"wood_branch":3}'::jsonb, ARRAY['starter']::text[], 10),
  ('acc-flower-crown', 'acc-flower-crown', NULL, 1, '{"flower_cosmos":2,"flower_lily":2,"flower_rose":1}'::jsonb, ARRAY['shop']::text[], 11),
  ('acc-shell-necklace', 'acc-shell-necklace', NULL, 1, '{"shell_scallop":2,"shell_turban":1,"shell_whelk":1}'::jsonb, ARRAY['bottle']::text[], 12),
  ('outfit-silk-sweater', 'outfit-silk-sweater', NULL, 1, '{"bug_bagworm":4,"flower_lily":2}'::jsonb, ARRAY['bottle']::text[], 13),
  ('outfit-monarch-cape', 'outfit-monarch-cape', NULL, 1, '{"bug_monarch_butterfly":2,"bug_bagworm":3,"flower_mum":2}'::jsonb, ARRAY['bottle']::text[], 14),
  ('outfit-koi-kimono', 'outfit-koi-kimono', NULL, 1, '{"fish_golden_koi":1,"bug_bagworm":4,"flower_rose":3}'::jsonb, ARRAY['quest','bottle']::text[], 15),
  ('acc-crystal-circlet', 'acc-crystal-circlet', NULL, 1, '{"rock_crystal":2,"rock_gold_nugget":1}'::jsonb, ARRAY['quest','bottle']::text[], 16),
  ('furn-campfire', 'furn-campfire', NULL, 1, '{"wood_branch":5,"rock_stone":3}'::jsonb, ARRAY['starter']::text[], 17),
  ('furn-study-chair', 'furn-study-chair', NULL, 1, '{"wood_branch":4}'::jsonb, ARRAY['starter']::text[], 18),
  ('furn-bookshelf', 'furn-bookshelf', NULL, 1, '{"wood_branch":8}'::jsonb, ARRAY['shop']::text[], 19),
  ('furn-floor-lamp', 'furn-floor-lamp', NULL, 1, '{"wood_branch":2,"rock_iron_nugget":2,"bug_firefly":1}'::jsonb, ARRAY['shop']::text[], 20),
  ('furn-study-desk', 'furn-study-desk', NULL, 1, '{"wood_branch":6,"rock_iron_nugget":1}'::jsonb, ARRAY['bottle']::text[], 21),
  ('furn-bench-park', 'furn-bench-park', NULL, 1, '{"wood_branch":6,"rock_iron_nugget":2}'::jsonb, ARRAY['bottle']::text[], 22),
  ('furn-streetlamp', 'furn-streetlamp', NULL, 1, '{"rock_iron_nugget":4,"rock_stone":2,"bug_firefly":1}'::jsonb, ARRAY['bottle']::text[], 23),
  ('furn-plant-monstera', 'furn-plant-monstera', NULL, 1, '{"rock_clay":3,"wood_branch":1}'::jsonb, ARRAY['bottle']::text[], 24),
  ('furn-wall-clock', 'furn-wall-clock', NULL, 1, '{"wood_branch":3,"rock_iron_nugget":1}'::jsonb, ARRAY['bottle']::text[], 25),
  ('furn-wall-frame', 'furn-wall-frame', NULL, 1, '{"wood_branch":2,"flower_pansy":1}'::jsonb, ARRAY['bottle']::text[], 26),
  ('furn-lounge-rug', 'furn-lounge-rug', NULL, 1, '{"bug_bagworm":3,"flower_hyacinth":2}'::jsonb, ARRAY['bottle']::text[], 27),
  ('sword-iron', NULL, 'sword-iron', 1, '{"rock_iron_nugget":4,"wood_branch":2}'::jsonb, ARRAY['bottle']::text[], 28),
  ('bow-yew', NULL, 'bow-yew', 1, '{"wood_branch":6,"bug_bagworm":2}'::jsonb, ARRAY['bottle']::text[], 29),
  ('revolver-brass', NULL, 'revolver-brass', 1, '{"rock_iron_nugget":3,"rock_gold_nugget":1}'::jsonb, ARRAY['quest','bottle']::text[], 30),
  ('staff-rune', NULL, 'staff-rune', 1, '{"wood_branch":4,"rock_crystal":2,"fish_football_fish":1}'::jsonb, ARRAY['quest','bottle']::text[], 31)
ON CONFLICT (id) DO NOTHING;
-- END GENERATED CRAFTING SEED
