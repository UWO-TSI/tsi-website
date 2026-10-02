-- Row 281: every item's icon (20261002052225_catalogue_seed: the roster's icons and the shop's sprite_url). Throwaway
-- local Postgres after every migration, with the pre_* seeds. Never Supabase. Fails before the migration.
\set ON_ERROR_STOP 1
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM collection_species WHERE icon IS NULL OR icon NOT LIKE '/assets/icons/%') = 0, 'every species has a rendered icon';
  ASSERT (SELECT icon FROM collection_species WHERE key = 'rock_crystal') = '/assets/icons/rock_crystal.webp', 'a rock without a model before';
  -- Every catalogue row (the pre-launch portal rows the TS never listed keep theirs empty).
  ASSERT (SELECT count(*) FROM shop_items WHERE sprite_url IS NULL AND slug NOT IN ('tsi-hoodie', 'glitch-aura', 'founder-badge')) = 0, 'every shop row has its icon';
  ASSERT (SELECT sprite_url FROM shop_items WHERE slug = 'rod-glass') = '/assets/icons/rod_glass.webp', 'a rod is its tool''s icon';
  ASSERT (SELECT sprite_url FROM shop_items WHERE slug = 'card-furn-bookshelf') = '/assets/icons/recipe_card.webp', 'every recipe card shares one';
  -- An icon an admin set by hand stays when the seed runs again.
  UPDATE shop_items SET sprite_url = 'https://example.org/custom.png' WHERE slug = 'merch-tote';
  UPDATE shop_items s SET sprite_url = v.url FROM (VALUES ('merch-tote', '/assets/icons/merch-tote.webp')) AS v (slug, url)
   WHERE s.slug = v.slug AND s.sprite_url IS DISTINCT FROM v.url AND (s.sprite_url IS NULL OR s.sprite_url LIKE '/assets/icons/%');
  ASSERT (SELECT sprite_url FROM shop_items WHERE slug = 'merch-tote') = 'https://example.org/custom.png', 'an admin icon kept';
  RAISE NOTICE 'item icons ok';
END $$;
