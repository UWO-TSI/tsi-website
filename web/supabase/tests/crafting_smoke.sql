-- Local smoke test for draft 20260926160000_crafting (after every game draft and
-- the 029-035 smokes, same throwaway cluster). Never run against Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000e1', 'crafter@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE r record; D uuid := '00000000-0000-4000-8000-0000000000e1'; card uuid; rod uuid;
  need jsonb := (SELECT ingredients FROM crafting_recipes WHERE id = 'rod-lighthouse');
BEGIN
  ASSERT (SELECT count(*) FROM crafting_recipes) >= 28, 'crafting seeded';
  ASSERT (SELECT NOT active FROM shop_items WHERE slug = 'rod-lighthouse'), 'crafting rod 4 not on sale';
  INSERT INTO member_collections (user_id, item_key, count)
  SELECT D, e.key, e.value::int FROM jsonb_each_text(need) e;

  -- unlearned: refused, nothing taken, the key stays usable
  BEGIN PERFORM crafting_craft(D, 'rod-lighthouse', 'craft-0001'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_learned', 'crafting unlearned: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = D AND item_key = 'wood_branch') = 6, 'crafting unlearned takes nothing';
  ASSERT NOT EXISTS (SELECT 1 FROM craft_log WHERE member_id = D), 'crafting unlearned logs nothing';
  SELECT * INTO r FROM crafting_learn(D, 'rod-lighthouse', 'quest');
  ASSERT r.learned, 'crafting learn';
  SELECT * INTO r FROM crafting_learn(D, 'rod-lighthouse', 'quest');
  ASSERT NOT r.learned, 'crafting learn once';
  BEGIN PERFORM crafting_learn(D, 'net-silk', 'bottle'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_source', 'crafting learn source: ' || SQLERRM; END;

  -- insufficient: all or nothing
  UPDATE member_collections SET count = 0 WHERE user_id = D AND item_key = 'sea_pearl_oyster';
  BEGIN PERFORM crafting_craft(D, 'rod-lighthouse', 'craft-0002'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'crafting insufficient: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = D AND item_key = 'wood_branch') = 6, 'crafting insufficient takes nothing';

  -- craft, double submit, key reuse, one rod per member
  UPDATE member_collections SET count = 1 WHERE user_id = D AND item_key = 'sea_pearl_oyster';
  SELECT * INTO r FROM crafting_craft(D, 'rod-lighthouse', 'craft-0001');
  ASSERT r.output = 'rod-lighthouse' AND r.qty = 1 AND NOT r.replayed, 'crafting craft';
  SELECT * INTO r FROM crafting_craft(D, 'rod-lighthouse', 'craft-0001');
  ASSERT r.replayed, 'crafting replay';
  ASSERT (SELECT sum(count) FROM member_collections WHERE user_id = D AND item_key IN (SELECT jsonb_object_keys(need))) = 0, 'crafting debited once';
  ASSERT (SELECT i.qty FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.member_id = D AND s.slug = 'rod-lighthouse') = 1, 'crafting credited once';
  BEGIN PERFORM crafting_craft(D, 'furn-campfire', 'craft-0001'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'key_reused', 'crafting key reuse: ' || SQLERRM; END;
  UPDATE member_collections mc SET count = e.value::int FROM jsonb_each_text(need) e WHERE mc.user_id = D AND mc.item_key = e.key;
  BEGIN PERFORM crafting_craft(D, 'rod-lighthouse', 'craft-0003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_owned', 'crafting owned: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = D AND item_key = 'wood_branch') = 6, 'crafting owned takes nothing';

  -- starter recipe, stackable output
  UPDATE member_collections SET count = 20 WHERE user_id = D AND item_key = 'wood_branch';
  PERFORM crafting_craft(D, 'furn-study-chair', 'craft-0004');
  PERFORM crafting_craft(D, 'furn-study-chair', 'craft-0005');
  ASSERT (SELECT i.qty FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.member_id = D AND s.slug = 'furn-study-chair') = 2, 'crafting stackable';

  -- combat gear lands in member_weapons at full durability
  UPDATE member_collections SET count = 4 WHERE user_id = D AND item_key = 'rock_iron_nugget';
  PERFORM crafting_learn(D, 'sword-iron', 'admin');
  PERFORM crafting_craft(D, 'sword-iron', 'craft-0006');
  ASSERT (SELECT w.durability = wd.max_durability FROM member_weapons w JOIN weapons wd ON wd.key = w.weapon_key WHERE w.member_id = D AND w.weapon_key = 'sword-iron'), 'crafting weapon';

  -- one bottle a Toronto day, a recipe the member lacked
  SELECT * INTO r FROM crafting_open_bottle(D);
  ASSERT NOT r.replayed AND r.recipe_id NOT IN ('rod-lighthouse', 'sword-iron'), 'crafting bottle';
  ASSERT (SELECT 'bottle' = ANY(sources) FROM crafting_recipes WHERE id = r.recipe_id), 'crafting bottle recipe';
  ASSERT (SELECT bottle_day FROM member_recipes WHERE member_id = D AND recipe_id = r.recipe_id) = (NOW() AT TIME ZONE 'America/Toronto')::DATE, 'crafting bottle day';
  ASSERT (SELECT recipe_id FROM crafting_open_bottle(D) WHERE replayed) = r.recipe_id, 'crafting bottle once a day';

  -- buying a recipe card teaches it; craft-only items can't be bought
  PERFORM wallet_apply(D, 'coins', 1000, 'admin', 'smoke', 'smoke:crafting');
  SELECT id INTO card FROM shop_items WHERE slug = 'card-furn-bookshelf';
  PERFORM economy_buy(D, card, 1, 300, 'buy-card-01');
  ASSERT (SELECT source FROM member_recipes WHERE member_id = D AND recipe_id = 'furn-bookshelf') = 'shop', 'crafting card teaches';
  SELECT id INTO rod FROM shop_items WHERE slug = 'rod-tidewarden';
  BEGIN PERFORM economy_buy(D, rod, 1, 6000, 'buy-rod-5'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_for_sale', 'crafting rod 5 craft-only: ' || SQLERRM; END;

  ASSERT NOT has_function_privilege('authenticated', 'crafting_craft(uuid, text, text)', 'EXECUTE'), 'crafting craft service-only';
  ASSERT NOT has_function_privilege('authenticated', 'crafting_learn(uuid, text, text)', 'EXECUTE'), 'crafting learn service-only';
  ASSERT NOT has_function_privilege('authenticated', 'crafting_open_bottle(uuid)', 'EXECUTE'), 'crafting bottle service-only';
  RAISE NOTICE 'crafting ok';
END $$;

-- Members read their recipes and never write them.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM member_recipes) >= 3, 'crafting own recipes readable';
  INSERT INTO member_recipes (member_id, recipe_id, source) VALUES ('00000000-0000-4000-8000-0000000000e1', 'rod-tidewarden', 'quest');
  RAISE EXCEPTION 'crafting member_recipes self-insert was allowed';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'crafting recipes not self-writable ok';
END $$;
ROLLBACK;
