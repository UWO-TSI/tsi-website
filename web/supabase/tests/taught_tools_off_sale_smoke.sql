-- The tier-1 bug net and shovel off sale (20261017163142_catalogue_seed, row 312). Throwaway local Postgres after
-- every migration through it (supabase_stub.sql first; member e1 is pre034_seed's). Never Supabase. Fails before it:
-- both are on sale. Self-contained: section 2 sets up a member who owns the net from before, puts both back on sale
-- as they were, applies the migration over them and rolls back, so it holds in any chain.
\set ON_ERROR_STOP 1
DO $$ BEGIN
  ASSERT NOT (SELECT active FROM shop_items WHERE slug = 'net-basic'), 'the bug net is off sale';
  ASSERT NOT (SELECT active FROM shop_items WHERE slug = 'shovel-basic'), 'the shovel is off sale';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug IN ('net-basic', 'shovel-basic')) = 2, 'retired, not deleted';
  ASSERT (SELECT bool_and(active) FROM shop_items WHERE slug IN ('rod-cedar', 'rod-glass')), 'the better rods are still sold';
  -- The hollow tools (no effect behind them) are off sale too (rod-gear, 2026-10-27).
  ASSERT NOT (SELECT bool_or(active) FROM shop_items WHERE slug IN ('net-mid', 'shovel-mid', 'rod-basic')), 'the hollow tools are off sale';
  RAISE NOTICE 'taught tools 1 off sale ok';
END $$;
-- A member who bought the bug net while it was on sale keeps it, and the shop won't sell them the shovel.
BEGIN;
UPDATE shop_items SET active = TRUE WHERE slug IN ('net-basic', 'shovel-basic');
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000e1', 'net-owner@x') ON CONFLICT DO NOTHING;
INSERT INTO member_inventory (member_id, item_id, qty, slot)
  SELECT '00000000-0000-4000-8000-0000000000e1', id, 1, slot FROM shop_items WHERE slug = 'net-basic' ON CONFLICT DO NOTHING;
\ir ../migrations/20261017163142_catalogue_seed.sql
DO $$
DECLARE refused boolean := false;
BEGIN
  ASSERT NOT (SELECT bool_or(active) FROM shop_items WHERE slug IN ('net-basic', 'shovel-basic')), 'off sale again';
  -- What the catch route reads as owned gear (lib/collections/supabaseStore.ts ownedGear: inventory → shop_items, no active filter).
  ASSERT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id
                  WHERE s.slug = 'net-basic' AND i.member_id = '00000000-0000-4000-8000-0000000000e1' AND i.qty >= 1), 'an owner keeps theirs';
  BEGIN
    PERFORM public.economy_buy('00000000-0000-4000-8000-0000000000e1', (SELECT id FROM shop_items WHERE slug = 'shovel-basic'), 1, 100, 'smoke-buy-shovel');
  EXCEPTION WHEN OTHERS THEN refused := SQLERRM = 'not_for_sale';
  END;
  ASSERT refused, 'the shop won''t sell the shovel';
  RAISE NOTICE 'taught tools 2 an owner keeps theirs ok';
END $$;
ROLLBACK;
