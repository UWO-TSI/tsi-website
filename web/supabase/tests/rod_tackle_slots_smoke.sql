-- Rod add-on slots (20261028155000_rod_tackle_slots) and the seed after it (20261029020457_catalogue_seed). Throwaway
-- local Postgres after every migration, with the pre_* seeds. Never Supabase. Fails before the migration: the shop's
-- slot check refuses 'bobber' and 'bait'.
\set ON_ERROR_STOP 1
DO $$
BEGIN
  ASSERT (SELECT slot FROM shop_items WHERE slug = 'bobber-lucky') = 'bobber', 'the lucky bobber fits the bobber slot';
  ASSERT (SELECT slot FROM shop_items WHERE slug = 'bait-sweet') = 'bait', 'the sweet bait fits the bait slot';
  ASSERT (SELECT description FROM shop_items WHERE slug = 'bobber-lucky') LIKE '%+20 luck%', 'stats are out of 100';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE active AND slot = 'rod' AND catalogue_ref IN ('rod_lighthouse', 'rod_tidewarden')), 'the shop sells no workbench rod';
  BEGIN UPDATE shop_items SET slot = 'reel' WHERE slug = 'bait-sweet'; RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'rod tackle slots smoke ok';
END $$;
