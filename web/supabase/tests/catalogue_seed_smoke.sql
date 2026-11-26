-- Row 260: every fish the reel lands is on the roster (20260930142943_catalogue_seed).
-- Throwaway local Postgres after every migration, with the pre_* seeds. Never
-- Supabase. Fails before 20260930142943 (the reel's other fish had no species row,
-- so no tourney entry and no drop). NOW() is fixed in a transaction, so the roll is
-- aged by moving rolled_at back.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000008e1', 'cs-maya@x');
UPDATE profiles SET membership = 'member', tier = 4 WHERE id = '00000000-0000-4000-8000-0000000008e1';

DO $$
DECLARE
  M uuid := '00000000-0000-4000-8000-0000000008e1';
  T uuid := (SELECT id FROM club_goals WHERE slug = 'fall-fishing-tourney');
  r record; rid uuid;
BEGIN
  -- 85 since 20261125191541 (the fish list's first four Meshy fish).
  ASSERT (SELECT count(*) FROM collection_species WHERE category = 'fish' AND donatable AND wing = 'aquarium') = 85, '85 fish in the journal and aquarium';
  ASSERT (SELECT count(*) FROM collection_species WHERE key IN ('fish_common_shiner', 'fish_brown_trout', 'fish_paddlefish', 'fish_muskellunge') AND biome = 'river' AND asset_ready) = 4, 'the four new river fish';
  ASSERT (SELECT rarity FROM collection_species WHERE key = 'fish_muskellunge') = 'epic' AND (SELECT start_hour FROM collection_species WHERE key = 'fish_brown_trout') = 18 AND (SELECT rarity FROM collection_species WHERE key = 'fish_brown_trout') = 'uncommon' AND (SELECT size_max_cm FROM collection_species WHERE key = 'fish_muskellunge') = 180, 'new fish rows as the list (20261126073423: the trout uncommon, the muskie 110 to 180 cm)';
  -- A former filler fish (rare) lands with its size, weekly trophy, tourney entry and a recipe.
  UPDATE recipe_drop_chances SET chance = 1;
  rid := collections_cast(M, 'fish_piranha', 31.5, true);
  UPDATE catch_rolls c SET rolled_at = c.rolled_at - INTERVAL '5 seconds' WHERE c.id = rid;
  SELECT * INTO r FROM collections_land_drop(M, rid, '{}', T, 2026);
  ASSERT r.item_key = 'fish_piranha' AND r.best_size_cm = 31.5 AND r.new_record, 'size recorded';
  ASSERT EXISTS (SELECT 1 FROM weekly_catch_bests WHERE user_id = M AND item_key = 'fish_piranha' AND size_cm = 31.5), 'weekly trophy';
  ASSERT EXISTS (SELECT 1 FROM tourney_entries WHERE member_id = M AND category = 'fish' AND item_key = 'fish_piranha' AND size_cm = 31.5), 'tourney entry';
  ASSERT (SELECT drop_rarity FROM crafting_recipes WHERE id = r.recipe_id) = 'rare', 'a rare drop: ' || coalesce(r.recipe_id, 'none');
  RAISE NOTICE 'catalogue seed ok';
END $$;
