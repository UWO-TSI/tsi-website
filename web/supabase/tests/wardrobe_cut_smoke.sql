-- David's wardrobe cut (20261014220430_wardrobe_cut, ledger row 309). Throwaway local Postgres after every migration
-- (supabase_stub.sql first), after traditions_smoke.sql. Never Supabase. Fails before the migration: the robe, jumpsuit,
-- beanie and scarf are on sale and every new account is granted the rain-cape.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000032a0', 'cut-new@x'),
  ('00000000-0000-4000-8000-0000000032a1', 'cut-owner@x');

DO $$
DECLARE
  N uuid := '00000000-0000-4000-8000-0000000032a0';
  cut text[] := ARRAY['wear-onepiece-raincape', 'wear-onepiece-robe', 'wear-onepiece-jumpsuit', 'wear-acc-beanie', 'wear-acc-scarf'];
BEGIN
  -- The five rows stay (no deletes), retired: off sale, never a daily special, granted to no one.
  ASSERT (SELECT count(*) FROM shop_items WHERE slug = ANY (cut)) = 5, 'the cut rows stay';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug = ANY (cut) AND (active OR special_pool OR starter_qty > 0)), 'the cut rows are retired';
  -- The other starter clothes are still granted, and nothing else changed sale.
  ASSERT (SELECT count(*) FROM shop_items WHERE starter_qty > 0 AND slug LIKE 'wear-%') = 8, 'eight starter clothes';
  ASSERT (SELECT active FROM shop_items WHERE slug = 'wear-top-cardigan') AND (SELECT active FROM shop_items WHERE slug = 'wear-acc-cap'), 'kept clothes still sold';

  -- The craft-only parts keep their crafted items, recipes and the flower crown's recipe card as they were.
  ASSERT (SELECT count(*) FROM shop_items WHERE slug IN ('acc-flower-crown', 'acc-shell-necklace', 'outfit-koi-kimono', 'outfit-monarch-cape', 'outfit-silk-sweater')
          AND catalogue_ref IN ('acc_flower_crown', 'acc_shell_necklace', 'outfit_koi_kimono', 'outfit_monarch_cape', 'outfit_silk_sweater') AND NOT active) = 5,
    'the five crafted items stay, craft-only (never sold)';
  ASSERT (SELECT count(*) FROM crafting_recipes WHERE active AND output_item IN ('acc-flower-crown', 'acc-shell-necklace', 'outfit-koi-kimono', 'outfit-monarch-cape', 'outfit-silk-sweater')) = 5,
    'their recipes stay active';
  ASSERT (SELECT active FROM shop_items WHERE slug = 'card-acc-flower-crown'), 'the flower crown recipe card is still sold';

  -- A new account's starters: no rain-cape.
  ASSERT (SELECT granted FROM economy_grant_starters(N)), 'starters granted';
  ASSERT NOT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.member_id = N AND s.slug = ANY (cut)), 'no cut part granted';
  ASSERT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.member_id = N AND s.slug = 'wear-top-tee'), 'the tee still granted';
END $$;

-- An owner from before the cut keeps the row; the shop refuses another.
INSERT INTO member_inventory (member_id, item_id, qty)
SELECT '00000000-0000-4000-8000-0000000032a1', id, 1 FROM shop_items WHERE slug = 'wear-acc-beanie';
DO $$
DECLARE
  O uuid := '00000000-0000-4000-8000-0000000032a1';
BEGIN
  BEGIN
    PERFORM economy_buy(O, (SELECT id FROM shop_items WHERE slug = 'wear-acc-scarf'), 1, 80, 'cut-buy-scarf-1');
    RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'not_for_sale', 'the scarf is not for sale: ' || SQLERRM;
  END;
END $$;

-- Idempotent: the migration again changes nothing and deletes nothing.
\ir ../migrations/20261014220430_wardrobe_cut.sql
DO $$
DECLARE
  O uuid := '00000000-0000-4000-8000-0000000032a1';
BEGIN
  ASSERT EXISTS (SELECT 1 FROM member_inventory i JOIN shop_items s ON s.id = i.item_id WHERE i.member_id = O AND s.slug = 'wear-acc-beanie'), 'the owner keeps the beanie';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug IN ('wear-onepiece-raincape', 'wear-onepiece-robe', 'wear-onepiece-jumpsuit', 'wear-acc-beanie', 'wear-acc-scarf')
                     AND (active OR special_pool OR starter_qty > 0)), 'still retired after a second run';
  RAISE NOTICE 'wardrobe cut ok';
END $$;
