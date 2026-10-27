-- Per-species sell prices (20261027180000_species_sell_price). Throwaway local Postgres after every migration, with
-- the pre_* seeds. Never Supabase. Fails before the migration: no collection_species.sell_price.
\set ON_ERROR_STOP 1
-- Earlier smokes in the chain re-run older migrations that define economy_sell: apply this one again (it is idempotent).
\ir ../migrations/20261027180000_species_sell_price.sql
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000005a1', 'price-1@x')
ON CONFLICT DO NOTHING;
DO $$
DECLARE M uuid := '00000000-0000-4000-8000-0000000005a1';
BEGIN
  INSERT INTO member_collections (user_id, item_key, count) VALUES (M, 'fish_golden_koi', 3);
  ASSERT (SELECT sell_price FROM collection_species WHERE key = 'fish_golden_koi') IS NULL, 'no own price: the seed sets none';
  ASSERT (SELECT paid FROM economy_sell(M, 'fish_golden_koi', 1, 'smoke-price-01')) = 600, 'no own price: legendary fish, 600';
  UPDATE collection_species SET sell_price = 777 WHERE key = 'fish_golden_koi';
  ASSERT (SELECT paid FROM economy_sell(M, 'fish_golden_koi', 2, 'smoke-price-02')) = 1554, 'its own price, per item';
  ASSERT (SELECT paid FROM economy_sell(M, 'fish_golden_koi', 2, 'smoke-price-02')) = 1554, 'a replay pays nothing new';
  BEGIN UPDATE collection_species SET sell_price = 0 WHERE key = 'fish_golden_koi'; RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE collection_species SET sell_price = NULL WHERE sell_price IS NOT NULL;
  RAISE NOTICE 'species sell price smoke ok';
END $$;
