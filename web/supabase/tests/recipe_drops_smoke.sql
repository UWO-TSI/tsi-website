-- Rare-catch recipe drops (20260930100000_recipe_drops). Throwaway local Postgres
-- after every migration through it, with the pre_* seeds. Never Supabase. Each
-- section fails before 20260930100000 (the column, table and functions don't exist).
-- NOW() is fixed inside a transaction, so rolls are aged by moving rolled_at back.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000007d1', 'rd-maya@x'), ('00000000-0000-4000-8000-0000000007d2', 'rd-jordan@x'),
  ('00000000-0000-4000-8000-0000000007d3', 'rd-rate@x');
UPDATE profiles SET membership = 'member', tier = 4 WHERE id::text LIKE '00000000-0000-4000-8000-0000000007d_';

-- ─── 1. Seeds: 16 bottle recipes drop, three chances, 'catch' is a source ────
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM crafting_recipes WHERE drop_rarity IS NOT NULL) = 16, 'sixteen drop recipes';
  ASSERT (SELECT count(*) FROM crafting_recipes WHERE drop_rarity IS NOT NULL AND sources <> ARRAY['bottle']) = 0, 'only bottle-only recipes drop';
  ASSERT (SELECT string_agg(id, ',' ORDER BY id) FROM crafting_recipes WHERE drop_rarity = 'epic') = 'net-dragonfly,outfit-monarch-cape,shovel-crystal', 'tier-4 tools and the cape need an epic catch';
  ASSERT (SELECT string_agg(rarity || ':' || chance, ',' ORDER BY chance) FROM recipe_drop_chances) = 'rare:0.02,epic:0.05,legendary:0.15', 'chances';
  BEGIN UPDATE crafting_recipes SET drop_rarity = 'common' WHERE id = 'net-silk'; RAISE EXCEPTION 'common drop accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'drops 1 seeds ok';
END $$;

-- ─── 2. Members can't roll a drop, grant themselves a recipe or edit the table ─
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000007d1","role":"authenticated"}';
DO $$
DECLARE M uuid := '00000000-0000-4000-8000-0000000007d1';
BEGIN
  BEGIN PERFORM crafting_catch_drop(M, 'fish_golden_koi'); RAISE EXCEPTION 'member rolled a drop';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM collections_land_drop(M, gen_random_uuid(), '{}', NULL, NULL); RAISE EXCEPTION 'member landed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM collections_harvest_drop(M, 'rock-0', '2026-09-30T12', 'rock_gold_nugget', NULL, false); RAISE EXCEPTION 'member harvested';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM crafting_learn(M, 'rod-glass', 'admin'); RAISE EXCEPTION 'member taught themselves';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO member_recipes (member_id, recipe_id, source) VALUES (M, 'rod-glass', 'catch'); RAISE EXCEPTION 'member wrote a catch recipe';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM recipe_drop_chances; RAISE EXCEPTION 'member read the chances';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE recipe_drop_chances SET chance = 1; RAISE EXCEPTION 'member raised the chances';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE crafting_recipes SET drop_rarity = 'rare' WHERE id = 'rod-tidewarden';
  ASSERT NOT FOUND, 'a T4 put a quest recipe in the drop pool';
  ASSERT NOT EXISTS (SELECT 1 FROM member_recipes WHERE member_id = M), 'nothing learned';
  RAISE NOTICE 'drops 2 members locked out ok';
END $$;
ROLLBACK;

-- ─── 3. A rare catch teaches each drop recipe once, from its rarity's pool ────
-- The chances go to 1 so every rare catch drops; the pool is what varies.
CREATE FUNCTION pg_temp.fish(m UUID, item TEXT, closed TEXT[])
RETURNS TABLE (item_key TEXT, count INTEGER, recipe_id TEXT, recipe_name TEXT)
LANGUAGE plpgsql AS $$
DECLARE rid UUID;
BEGIN
  UPDATE catch_rolls c SET rolled_at = c.rolled_at - INTERVAL '10 seconds' WHERE c.member_id = m;
  rid := collections_cast(m, item, 40, true);
  UPDATE catch_rolls c SET rolled_at = c.rolled_at - INTERVAL '5 seconds' WHERE c.id = rid;
  RETURN QUERY SELECT l.item_key, l.count, l.recipe_id, l.recipe_name FROM collections_land_drop(m, rid, closed, NULL, NULL) l;
END;
$$;

DO $$
DECLARE
  M uuid := '00000000-0000-4000-8000-0000000007d1';
  RARE text[] := ARRAY['rock_crystal', 'shell_whelk', 'flower_windflower', 'bug_mantis'];
  bottle text; r record; got text[] := '{}'; i int;
  rare_pool int := (SELECT count(*) FROM crafting_recipes WHERE drop_rarity = 'rare' AND active);
BEGIN
  UPDATE recipe_drop_chances SET chance = 1;
  -- Defence in depth: starter, shop-card and inactive recipes never drop, whatever their drop_rarity says.
  UPDATE crafting_recipes SET drop_rarity = 'rare' WHERE id IN ('acc-straw-hat', 'shovel-sturdy', 'furn-bookshelf');
  UPDATE crafting_recipes SET active = FALSE WHERE id = 'bow-yew';
  bottle := (SELECT recipe_id FROM crafting_open_bottle(M));
  ASSERT (SELECT r2.recipe_id FROM collections_harvest_drop(M, 'rock-0', 'h-common', 'rock_stone', NULL, false) r2) IS NULL, 'a common catch teaches nothing';
  FOR i IN 1 .. rare_pool + 3 LOOP
    SELECT * INTO r FROM collections_harvest_drop(M, 'node-' || i, 'h-rare', RARE[1 + i % 4], NULL, false);
    IF r.recipe_id IS NOT NULL THEN got := got || r.recipe_id; END IF;
  END LOOP;
  ASSERT cardinality(got) = (SELECT count(DISTINCT x) FROM unnest(got) x), 'no recipe dropped twice';
  ASSERT (SELECT array_agg(x ORDER BY x) FROM unnest(got) x) = (SELECT array_agg(id ORDER BY id) FROM crafting_recipes
    WHERE drop_rarity = 'rare' AND active AND NOT sources && ARRAY['starter', 'shop'] AND id IS DISTINCT FROM bottle), 'the rare pool, less the bottle''s recipe';
  ASSERT NOT bottle = ANY(got) OR bottle IS NULL, 'a known recipe never drops';
  ASSERT (SELECT count(*) FROM member_recipes WHERE member_id = M AND source = 'catch') = cardinality(got), 'each drop recorded once, as a catch';
  ASSERT NOT EXISTS (SELECT 1 FROM member_recipes WHERE member_id = M AND recipe_id IN ('acc-straw-hat', 'shovel-sturdy', 'furn-bookshelf', 'bow-yew')), 'starter, shop and inactive recipes never drop';
  -- An epic catch (fishing, the land step) reaches the epic-only ones.
  SELECT * INTO r FROM pg_temp.fish(M, 'fish_catfish', '{}');
  ASSERT r.item_key = 'fish_catfish' AND r.count = 1, 'the catch landed';
  ASSERT (SELECT drop_rarity FROM crafting_recipes WHERE id = r.recipe_id) = 'epic', 'an epic catch taught an epic recipe: ' || coalesce(r.recipe_id, 'none');
  ASSERT r.recipe_name = (SELECT display_name FROM shop_items WHERE slug = r.recipe_id), 'shown by its item name';
  -- A fresh member's rare fish teaches one too; a weapon recipe is named after the weapon.
  UPDATE crafting_recipes SET drop_rarity = NULL WHERE id <> 'sword-iron';
  SELECT * INTO r FROM pg_temp.fish('00000000-0000-4000-8000-0000000007d2', 'fish_black_bass', '{}');
  ASSERT r.recipe_id = 'sword-iron' AND r.recipe_name = (SELECT name FROM weapons WHERE key = 'sword-iron'), 'the land step teaches';
  RAISE NOTICE 'drops 3 once per recipe ok';
END $$;

-- ─── 4. The drop is the catch's: a refused land or harvest teaches nothing ────
DO $$
DECLARE
  J uuid := '00000000-0000-4000-8000-0000000007d2';
  before bigint;
  rid uuid;
BEGIN
  UPDATE recipe_drop_chances SET chance = 1;
  UPDATE crafting_recipes SET drop_rarity = 'rare' WHERE id IN ('rod-glass', 'net-silk', 'furn-wall-clock');
  before := (SELECT count(*) FROM member_recipes WHERE member_id = J);
  -- Out of season: seasonal_land refuses after collections_land recorded; all of it rolls back.
  BEGIN PERFORM pg_temp.fish(J, 'fish_giant_trevally', ARRAY['fish_giant_trevally']); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'out_of_season', 'closed: ' || SQLERRM; END;
  -- Too fast: a reel under 3 s.
  UPDATE catch_rolls c SET rolled_at = c.rolled_at - INTERVAL '10 seconds' WHERE c.member_id = J;
  rid := collections_cast(J, 'fish_black_bass', 40, true);
  BEGIN PERFORM collections_land_drop(J, rid, '{}', NULL, NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'too_fast', 'reel minimum: ' || SQLERRM; END;
  -- Over the hourly cap: three legendary koi this hour, the fourth is refused.
  UPDATE recipe_drop_chances SET chance = 0;
  PERFORM collections_harvest_drop(J, 'koi-' || i, 'h-koi', 'fish_golden_koi', 70, true) FROM generate_series(1, 3) i;
  UPDATE recipe_drop_chances SET chance = 1;
  BEGIN PERFORM collections_harvest_drop(J, 'koi-4', 'h-koi', 'fish_golden_koi', 70, true); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'rate_limited', 'cap: ' || SQLERRM; END;
  -- The same node twice in an hour.
  BEGIN PERFORM collections_harvest_drop(J, 'koi-1', 'h-koi', 'rock_crystal', NULL, false); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_harvested', 'node twice: ' || SQLERRM; END;
  ASSERT (SELECT count(*) FROM member_recipes WHERE member_id = J) = before, 'no refused catch taught a recipe';
  ASSERT NOT EXISTS (SELECT 1 FROM member_collections WHERE user_id = J AND item_key = 'fish_giant_trevally'), 'nor recorded the catch';
  ASSERT (SELECT recipe_id FROM collections_harvest_drop(J, 'rock-9', 'h-ok', 'rock_crystal', NULL, false)) IS NOT NULL, 'a recorded one does';
  RAISE NOTICE 'drops 4 refused catches teach nothing ok';
END $$;

-- ─── 5. The migration applies twice; rates over many rolls at the seeded chances ─
\ir ../migrations/20260930100000_recipe_drops.sql
DO $$
DECLARE
  R uuid := '00000000-0000-4000-8000-0000000007d3';
  k record; hits int; p numeric; n int;
BEGIN
  UPDATE recipe_drop_chances c SET chance = s.chance FROM (VALUES ('rare', 0.02), ('epic', 0.05), ('legendary', 0.15)) s (rarity, chance) WHERE c.rarity = s.rarity;
  UPDATE crafting_recipes SET drop_rarity = 'rare', active = TRUE WHERE id IN ('bow-yew', 'sword-iron', 'rod-glass');
  FOR k IN SELECT * FROM (VALUES ('rock_crystal', 6000), ('rock_gold_nugget', 4000), ('fish_golden_koi', 3000), ('rock_stone', 2000)) v (item, n) LOOP
    hits := 0;
    FOR i IN 1 .. k.n LOOP
      IF EXISTS (SELECT 1 FROM crafting_catch_drop(R, k.item)) THEN hits := hits + 1; END IF;
      DELETE FROM member_recipes WHERE member_id = R;
    END LOOP;
    p := coalesce((SELECT c.chance FROM recipe_drop_chances c JOIN collection_species s ON s.rarity = c.rarity WHERE s.key = k.item), 0);
    n := k.n;
    ASSERT (p = 0 AND hits = 0) OR (p > 0 AND abs(hits::numeric / n - p) <= 4 * sqrt(p * (1 - p) / n) + 0.002), format('%s: %s of %s at %s', k.item, hits, n, p);
    RAISE NOTICE 'drops 5 rate %: % of % (chance %)', k.item, hits, n, p;
  END LOOP;
END $$;
\echo recipe drops smoke ok
