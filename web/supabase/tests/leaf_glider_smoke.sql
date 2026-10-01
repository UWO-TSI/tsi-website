-- Row 245: the leaf glider is a craft-only tool (20261001041452_leaf_glider_seed). Throwaway local
-- Postgres after every migration, with the pre_* seeds. Never Supabase. Fails before the migration
-- (no glider row, no recipe).
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000009e1', 'glider@x');

DO $$
DECLARE
  M uuid := '00000000-0000-4000-8000-0000000009e1';
  g uuid := (SELECT id FROM shop_items WHERE slug = 'glider-leaf');
  need jsonb := (SELECT ingredients FROM crafting_recipes WHERE id = 'glider-leaf');
  r record;
BEGIN
  ASSERT g IS NOT NULL AND (SELECT catalogue_ref FROM shop_items WHERE id = g) = 'glider_leaf', 'glider in the catalogue';
  ASSERT (SELECT NOT active AND category = 'tool' AND slot IS NULL FROM shop_items WHERE id = g), 'glider never on sale, no slot';
  ASSERT (SELECT sources = ARRAY['quest','bottle'] FROM crafting_recipes WHERE id = 'glider-leaf'), 'learned like rods 4-5';
  -- Not for sale, whatever the coins.
  PERFORM wallet_apply(M, 'coins', 100000, 'admin', 'smoke', 'glider:fund');
  BEGIN PERFORM economy_buy(M, g, 1, 3000, 'glider-buy'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_for_sale', 'glider buy: ' || SQLERRM; END;
  -- Learned and crafted: owned once.
  INSERT INTO member_collections (user_id, item_key, count) SELECT M, e.key, 2 * e.value::int FROM jsonb_each_text(need) e;
  PERFORM crafting_learn(M, 'glider-leaf', 'quest');
  SELECT * INTO r FROM crafting_craft(M, 'glider-leaf', 'glider-craft-1');
  ASSERT r.output = 'glider-leaf' AND r.qty = 1, 'glider crafted';
  ASSERT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.member_id = M AND s.catalogue_ref = 'glider_leaf'), 'glider owned';
  BEGIN PERFORM crafting_craft(M, 'glider-leaf', 'glider-craft-2'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_owned', 'one glider: ' || SQLERRM; END;
  RAISE NOTICE 'leaf glider ok';
END $$;
