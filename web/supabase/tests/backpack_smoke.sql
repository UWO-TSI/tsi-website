-- The backpack and the home storage chest (20261003054110_backpack, rows 279–283). Throwaway local Postgres after
-- every migration, with the pre_* seeds. Never Supabase. Fails before the migration: no bag functions, no
-- member_storage, and a full bag still takes every pickup. NOW() is fixed in a transaction, so a roll is aged by
-- moving rolled_at back.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000000ba1', 'bag-1@x'), ('00000000-0000-4000-8000-000000000ba2', 'bag-2@x'),
  ('00000000-0000-4000-8000-000000000ba3', 'bag-3@x'), ('00000000-0000-4000-8000-000000000ba4', 'bag-4@x');

-- A bag of exactly twenty slots: nineteen fish and a partial stack of 29 branches.
CREATE FUNCTION pg_temp.fill(m uuid) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO member_collections (user_id, item_key, count, total_collected)
  SELECT m, key, 1, 1 FROM (SELECT key FROM collection_species WHERE category = 'fish' AND active ORDER BY position LIMIT 19) f
  UNION ALL SELECT m, 'wood_branch', 29, 29
  ON CONFLICT (user_id, item_key) DO UPDATE SET count = EXCLUDED.count;
$$;

-- ─── 1. Members read their own chest; every write is the service role's ──────
INSERT INTO member_storage (member_id, item_key, count) VALUES ('00000000-0000-4000-8000-000000000ba4', 'rock_stone', 3);
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000ba1","role":"authenticated"}';
DO $$
DECLARE M uuid := '00000000-0000-4000-8000-000000000ba1';
BEGIN
  BEGIN PERFORM storage_move(M, 'wood_branch', 1, 'bag', 'smoke-0001'); RAISE EXCEPTION 'member moved';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM storage_store_materials(M, 'smoke-0002'); RAISE EXCEPTION 'member stored';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM collections_drop(M, 'wood_branch', 1, 'smoke-0003'); RAISE EXCEPTION 'member dropped';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM collections_set_lock(M, 'wood_branch', true); RAISE EXCEPTION 'member locked';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM bag_check(M, 'bag', 'wood_branch', 1); RAISE EXCEPTION 'member checked';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO member_storage (member_id, item_key, count) VALUES (M, 'rock_gold_nugget', 99); RAISE EXCEPTION 'member wrote the chest';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE member_collections SET locked = TRUE WHERE user_id = M; RAISE EXCEPTION 'member wrote a lock';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM bag_log; RAISE EXCEPTION 'member read the log';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ASSERT NOT EXISTS (SELECT 1 FROM member_storage), 'someone else''s chest is hidden';
  RAISE NOTICE 'backpack 1 members locked out ok';
END $$;
ROLLBACK;

-- ─── 2. Stacks, slots and sizes (web/lib/collections/bag.ts) ─────────────────
DO $$
DECLARE M uuid := '00000000-0000-4000-8000-000000000ba1'; c record;
BEGIN
  ASSERT (SELECT array_agg(bag_stack(x) ORDER BY o) FROM unnest(ARRAY['mineral', 'fruit', 'nature', 'fish', 'sea', 'bug', NULL]) WITH ORDINALITY u(x, o))
    = ARRAY[30, 30, 10, 1, 1, 1, 1], 'stacks: materials and fruit 30, nature 10, a slot per fish, sea creature and bug';
  INSERT INTO member_collections (user_id, item_key, count) VALUES (M, 'wood_branch', 45), (M, 'apple', 3), (M, 'flower_rose', 11), (M, 'fish_dace', 2), (M, 'rock_stone', 0);
  ASSERT bag_slots(M, 'bag') = 7, 'slots: 2 + 1 + 2 + 2, none for nothing';
  ASSERT bag_slots(M, 'bag', 'wood_branch', 15) = 7 AND bag_slots(M, 'bag', 'wood_branch', 16) = 8 AND bag_slots(M, 'bag', 'bug_mantis', 1) = 8, 'as if one more';
  ASSERT bag_capacity(M) = 20 AND bag_capacity(M, 'chest') = 200, 'a new member''s bag and chest';
  DELETE FROM member_collections WHERE user_id = M;
  RAISE NOTICE 'backpack 2 stack maths ok';
END $$;

-- ─── 3. A full bag refuses the pickup on each route; the item stays in the world ─
DO $$
DECLARE M uuid := '00000000-0000-4000-8000-000000000ba1'; rid uuid; r record; one_fish text;
BEGIN
  PERFORM pg_temp.fill(M);
  one_fish := (SELECT key FROM collection_species WHERE category = 'fish' AND active ORDER BY position LIMIT 1);
  ASSERT bag_slots(M, 'bag') = 20, 'exactly full';
  -- Harvest: a stone needs a slot; the node stays unharvested and nothing is recorded.
  BEGIN PERFORM collections_harvest_drop(M, 'rock-0', '2026-10-03T12', 'rock_stone', NULL, false); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bag_full', 'harvest: ' || SQLERRM; END;
  ASSERT NOT EXISTS (SELECT 1 FROM catch_rolls WHERE member_id = M), 'the node is still there';
  ASSERT NOT EXISTS (SELECT 1 FROM member_collections WHERE user_id = M AND item_key = 'rock_stone'), 'nothing recorded';
  ASSERT NOT EXISTS (SELECT 1 FROM collection_catch_hours WHERE user_id = M), 'the hourly cap untouched';
  -- ... but the 30th branch tops its stack up, and the 31st doesn't fit.
  PERFORM collections_harvest_drop(M, 'branch-0', '2026-10-03T12', 'wood_branch', NULL, false);
  ASSERT (SELECT count FROM member_collections WHERE user_id = M AND item_key = 'wood_branch') = 30, 'the partial stack topped up';
  BEGIN PERFORM collections_harvest_drop(M, 'branch-1', '2026-10-03T12', 'wood_branch', NULL, false); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bag_full', 'the 31st branch: ' || SQLERRM; END;
  -- Cast: no slot for a fish, no bite.
  BEGIN PERFORM collections_cast(M, 'fish_dace', 12, true); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bag_full', 'cast: ' || SQLERRM; END;
  ASSERT NOT EXISTS (SELECT 1 FROM catch_rolls WHERE member_id = M AND node_id IS NULL), 'no roll waiting';
  -- Land: room at the cast, the bag filled before the reel was won; the roll waits for room.
  UPDATE member_collections SET count = 0 WHERE user_id = M AND item_key = one_fish;
  rid := collections_cast(M, 'fish_dace', 12, true);
  UPDATE catch_rolls c SET rolled_at = c.rolled_at - INTERVAL '5 seconds' WHERE c.id = rid;
  INSERT INTO member_collections (user_id, item_key, count) VALUES (M, 'apple', 1);
  BEGIN PERFORM collections_land_drop(M, rid, '{}', NULL, NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bag_full', 'land: ' || SQLERRM; END;
  ASSERT (SELECT landed_at FROM catch_rolls WHERE id = rid) IS NULL, 'the roll is not landed';
  UPDATE member_collections SET count = 0 WHERE user_id = M AND item_key = 'apple';
  SELECT * INTO r FROM collections_land_drop(M, rid, '{}', NULL, NULL);
  ASSERT r.item_key = 'fish_dace' AND bag_slots(M, 'bag') = 20, 'landed once there was room';
  -- Crafting only takes from the bag: a full bag still crafts (gear, wearables and furniture take no slot, row 280).
  UPDATE member_collections SET count = 30 WHERE user_id = M AND item_key = 'wood_branch';
  PERFORM crafting_craft(M, 'acc-straw-hat', 'smoke-craft-01');
  ASSERT (SELECT count FROM member_collections WHERE user_id = M AND item_key = 'wood_branch') = 27, 'crafted at a full bag';
  RAISE NOTICE 'backpack 3 full refusals ok';
END $$;

-- ─── 4. Members over capacity keep everything and pick nothing up until they're back under ─
DO $$
DECLARE M uuid := '00000000-0000-4000-8000-000000000ba2'; before jsonb;
BEGIN
  PERFORM pg_temp.fill(M);
  INSERT INTO member_collections (user_id, item_key, count) VALUES (M, 'apple', 4), (M, 'bug_mantis', 1), (M, 'bug_firefly', 1);
  ASSERT bag_slots(M, 'bag') = 23, 'over by three, as before the cap';
  before := (SELECT jsonb_object_agg(item_key, count) FROM member_collections WHERE user_id = M);
  BEGIN PERFORM collections_harvest_drop(M, 'fruit-0', '2026-10-03T12', 'apple', NULL, false); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bag_full', 'not even the apples'' partial stack: ' || SQLERRM; END;
  ASSERT (SELECT jsonb_object_agg(item_key, count) FROM member_collections WHERE user_id = M) = before, 'kept everything';
  -- Into the chest: back to exactly full, and the partial stack takes one again.
  PERFORM storage_move(M, 'bug_mantis', 1, 'chest', 'smoke-over-01');
  PERFORM storage_move(M, 'bug_firefly', 1, 'chest', 'smoke-over-02');
  PERFORM storage_move(M, 'apple', 4, 'chest', 'smoke-over-03');
  PERFORM collections_harvest_drop(M, 'branch-0', '2026-10-03T12', 'wood_branch', NULL, false);
  ASSERT (SELECT count FROM member_collections WHERE user_id = M AND item_key = 'wood_branch') = 30, 'picked up again';
  RAISE NOTICE 'backpack 4 over capacity ok';
END $$;

-- ─── 5. Pocket upgrades: 30 bought or crafted, 40 crafted ─────────────────────
DO $$
DECLARE M uuid := '00000000-0000-4000-8000-000000000ba3'; it shop_items%ROWTYPE;
BEGIN
  SELECT * INTO it FROM shop_items WHERE slug = 'bag-30';
  ASSERT it.active AND it.price_coins = 1500 AND it.catalogue_ref = 'bag:30' AND it.category = 'tool' AND NOT it.stackable, 'the Roomier pocket is on sale';
  ASSERT (SELECT NOT active AND catalogue_ref = 'bag:40' FROM shop_items WHERE slug = 'bag-40'), 'the Roomiest pocket is crafted only';
  ASSERT (SELECT sources = ARRAY['starter'] AND ingredients = '{"bug_bagworm":4,"wood_branch":6}' FROM crafting_recipes WHERE id = 'bag-30'), 'everyone knows the 30';
  ASSERT (SELECT sources = ARRAY['bottle'] FROM crafting_recipes WHERE id = 'bag-40'), 'the 40 comes from the bottle (and an epic catch: section 8, the drops smoke resets them)';
  PERFORM pg_temp.fill(M);
  PERFORM wallet_apply(M, 'coins', 1500, 'admin', 'smoke', 'smoke-pocket-coins');
  PERFORM economy_buy(M, it.id, 1, 1500, 'smoke-pocket-buy');
  ASSERT bag_capacity(M) = 30, 'bought: 30 slots';
  PERFORM collections_harvest_drop(M, 'rock-0', '2026-10-03T12', 'rock_stone', NULL, false);
  INSERT INTO member_collections (user_id, item_key, count) VALUES (M, 'bug_bagworm', 6), (M, 'rock_gold_nugget', 1), (M, 'flower_windflower', 2);
  PERFORM crafting_learn(M, 'bag-40', 'admin');
  PERFORM crafting_craft(M, 'bag-40', 'smoke-pocket-craft');
  ASSERT bag_capacity(M) = 40, 'crafted: 40 slots';
  RAISE NOTICE 'backpack 5 upgrades ok';
END $$;

-- ─── 6. Locks and drops ───────────────────────────────────────────────────────
DO $$
DECLARE M uuid := '00000000-0000-4000-8000-000000000ba4'; r record;
BEGIN
  INSERT INTO member_collections (user_id, item_key, count) VALUES (M, 'fish_golden_koi', 1), (M, 'apple', 5);
  PERFORM collections_set_lock(M, 'fish_golden_koi', true);
  BEGIN PERFORM economy_sell(M, 'fish_golden_koi', 1, 'smoke-sell-01'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'selling skips a locked one: ' || SQLERRM; END;
  BEGIN PERFORM collections_drop(M, 'fish_golden_koi', 1, 'smoke-drop-01'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'so does dropping: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = M AND item_key = 'fish_golden_koi') = 1, 'the koi kept';
  BEGIN PERFORM collections_set_lock(M, 'fish_coelacanth', true); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_owned', 'nothing to lock: ' || SQLERRM; END;
  PERFORM collections_set_lock(M, 'fish_golden_koi', false);
  ASSERT (SELECT paid FROM economy_sell(M, 'fish_golden_koi', 1, 'smoke-sell-02')) = 600, 'unlocked, it sells';
  -- A drop happens once per key.
  SELECT * INTO r FROM collections_drop(M, 'apple', 2, 'smoke-drop-02');
  ASSERT r.count = 3 AND NOT r.replayed, 'dropped two';
  SELECT * INTO r FROM collections_drop(M, 'apple', 2, 'smoke-drop-02');
  ASSERT r.count = 3 AND r.replayed, 'the retry drops nothing more';
  BEGIN PERFORM collections_drop(M, 'apple', 1, 'smoke-drop-02'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'key_reused', 'a key for another drop: ' || SQLERRM; END;
  BEGIN PERFORM collections_drop(M, 'apple', 4, 'smoke-drop-03'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'more than you have: ' || SQLERRM; END;
  ASSERT NOT EXISTS (SELECT 1 FROM bag_log WHERE member_id = M AND idempotency_key = 'smoke-drop-03'), 'a refused drop logs nothing';
  RAISE NOTICE 'backpack 6 locks and drops ok';
END $$;

-- ─── 7. The chest: moves once per key, both sizes held, store all materials ──
DO $$
DECLARE M uuid := '00000000-0000-4000-8000-000000000ba4'; r record;
BEGIN
  INSERT INTO member_collections (user_id, item_key, count, total_collected) VALUES (M, 'wood_branch', 45, 45), (M, 'rock_stone', 7, 7), (M, 'rock_gold_nugget', 1, 1)
  ON CONFLICT (user_id, item_key) DO UPDATE SET count = EXCLUDED.count, total_collected = EXCLUDED.total_collected;
  ASSERT NOT (SELECT replayed FROM storage_move(M, 'wood_branch', 30, 'chest', 'smoke-move-01')), 'stored';
  ASSERT (SELECT replayed FROM storage_move(M, 'wood_branch', 30, 'chest', 'smoke-move-01')), 'the retry replays';
  ASSERT (SELECT count FROM member_storage WHERE member_id = M AND item_key = 'wood_branch') = 30
     AND (SELECT count FROM member_collections WHERE user_id = M AND item_key = 'wood_branch') = 15, 'moved once';
  BEGIN PERFORM storage_move(M, 'wood_branch', 30, 'bag', 'smoke-move-01'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'key_reused', 'a key for another move: ' || SQLERRM; END;
  BEGIN PERFORM storage_move(M, 'wood_branch', 31, 'bag', 'smoke-move-02'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'more than the chest has: ' || SQLERRM; END;
  PERFORM storage_move(M, 'wood_branch', 10, 'bag', 'smoke-move-03');
  ASSERT (SELECT total_collected FROM member_collections WHERE user_id = M AND item_key = 'wood_branch') = 45, 'a move isn''t a catch';
  -- The bag's size holds on the way out of the chest; the chest's on the way in.
  PERFORM pg_temp.fill('00000000-0000-4000-8000-000000000ba1');
  INSERT INTO member_storage (member_id, item_key, count) VALUES ('00000000-0000-4000-8000-000000000ba1', 'apple', 3);
  BEGIN PERFORM storage_move('00000000-0000-4000-8000-000000000ba1', 'apple', 3, 'bag', 'smoke-move-04'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bag_full', 'take into a full bag: ' || SQLERRM; END;
  -- A chest of exactly 200: 198 fish, a stack of branches and one of stones. A stone tops its stack up; an apple needs a slot.
  INSERT INTO member_storage (member_id, item_key, count) VALUES (M, 'fish_dace', 198);
  ASSERT bag_slots(M, 'chest') = 200, 'the chest is full';
  BEGIN PERFORM storage_move(M, 'apple', 1, 'chest', 'smoke-move-05'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'storage_full', 'store into a full chest: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = M AND item_key = 'apple') = 3, 'the apple stays in the bag';
  PERFORM storage_move(M, 'rock_stone', 1, 'chest', 'smoke-move-06');
  DELETE FROM member_storage WHERE member_id = M AND item_key = 'fish_dace';
  -- Store all materials: every unlocked material, once per key; fish, fruit and a locked one stay.
  PERFORM collections_set_lock(M, 'rock_gold_nugget', true);
  SELECT * INTO r FROM storage_store_materials(M, 'smoke-store-01');
  ASSERT r.moved = 25 + 6 AND NOT r.replayed, 'the branches and the stones';
  INSERT INTO member_collections (user_id, item_key, count) VALUES (M, 'rock_clay', 2);
  SELECT * INTO r FROM storage_store_materials(M, 'smoke-store-01');
  ASSERT r.moved = 31 AND r.replayed, 'the retry replays';
  ASSERT (SELECT jsonb_object_agg(item_key, count) FROM member_collections WHERE user_id = M AND count > 0)
    = '{"apple": 3, "rock_clay": 2, "rock_gold_nugget": 1}'::jsonb, 'the clay came later, the nugget is locked';
  ASSERT (SELECT count FROM member_storage WHERE member_id = M AND item_key = 'wood_branch') = 45
     AND (SELECT count FROM member_storage WHERE member_id = M AND item_key = 'rock_stone') = 3 + 1 + 6, 'everything arrived';
  RAISE NOTICE 'backpack 7 chest ok';
END $$;

-- ─── 8. The migration applies twice ──────────────────────────────────────────
\ir ../migrations/20261003054110_backpack.sql
DO $$ BEGIN
  ASSERT bag_capacity('00000000-0000-4000-8000-000000000ba3') = 40, 'still 40';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug IN ('bag-30', 'bag-40')) = 2, 'one row each';
  ASSERT (SELECT drop_rarity FROM crafting_recipes WHERE id = 'bag-40') = 'epic', 'an epic catch can teach the 40';
  RAISE NOTICE 'backpack smoke ok';
END $$;
