-- The tier-1 bug net and shovel off sale (20261017163142_catalogue_seed, row 312). Throwaway local Postgres after
-- every migration through it (supabase_stub.sql first; the smoke chain gave member e1 a bug net before it). Never
-- Supabase. Fails before it: both are on sale.
\set ON_ERROR_STOP 1
DO $$
DECLARE refused boolean := false;
BEGIN
  ASSERT NOT (SELECT active FROM shop_items WHERE slug = 'net-basic'), 'the bug net is off sale';
  ASSERT NOT (SELECT active FROM shop_items WHERE slug = 'shovel-basic'), 'the shovel is off sale';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug IN ('net-basic', 'shovel-basic')) = 2, 'retired, not deleted';
  ASSERT (SELECT bool_and(active) FROM shop_items WHERE slug IN ('net-mid', 'shovel-mid', 'rod-basic', 'rod-cedar', 'rod-glass')), 'the better tools are still sold';
  ASSERT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id
                  WHERE s.slug = 'net-basic' AND i.member_id = '00000000-0000-4000-8000-0000000000e1'), 'an owner keeps theirs';
  BEGIN
    PERFORM public.economy_buy('00000000-0000-4000-8000-0000000000e1', (SELECT id FROM shop_items WHERE slug = 'shovel-basic'), 1, 100, 'smoke-buy-shovel');
  EXCEPTION WHEN OTHERS THEN refused := SQLERRM = 'not_for_sale';
  END;
  ASSERT refused, 'the shop won''t sell the shovel';
  RAISE NOTICE 'taught tools off sale ok';
END $$;
