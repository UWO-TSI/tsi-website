-- ─── Ownership: what the shop sells is owned, with free starters ────────────
--
-- DRAFT 2026-09-26. NOT APPLIED. Spec: specs/polish-ownership.md (coordinator
-- ruling on audit item 22, end of specs/cleanup-and-game-security-questions.md).
-- Apply after every 20260926* game draft: needs 20260926150600 (shop_items,
-- member_inventory), 20260926151200 (the guard below replaces its version) and
-- 20260926170000 (avatar_config). Deploy with the code that writes
-- avatar_config through the service role (PATCH /api/profile).
--
--   * shop_items gains every wearable character part (catalogue_ref = part id),
--     six hair dyes (catalogue_ref = 'hair:<palette index>') and the homes pieces
--     the shop lacked. The old outfit/hair/accessory rows have no character part
--     and go off sale (owners keep them).
--   * starter_qty marks the free starters: base tee and shorts, 2 more tops and
--     bottoms, the hooded rain-cape, 2 shoes, the starter room (bed, lamp,
--     shelf, closet) and a 10-piece furniture pack. Starter clothes are never
--     sold. economy_grant_starters gives them once per account, whatever the
--     retries (starter_grants is the once).
--   * profiles.avatar_config becomes server-only: before this a member could
--     PATCH any part or dye straight through PostgREST. PATCH /api/profile now
--     checks the look against member_inventory and writes it as service_role.
--
-- Test: web/supabase/tests/ownership_smoke.sql.

ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS starter_qty INTEGER NOT NULL DEFAULT 0 CHECK (starter_qty BETWEEN 0 AND 20);

-- One row per account that has had its starters. No policies: service role only.
CREATE TABLE IF NOT EXISTS starter_grants (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE starter_grants ENABLE ROW LEVEL SECURITY;

-- The marker insert serialises concurrent calls: a second call waits on the
-- first's row, then sees the conflict and grants nothing.
CREATE OR REPLACE FUNCTION public.economy_grant_starters(p_member_id UUID)
RETURNS TABLE (granted BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO starter_grants (member_id) VALUES (p_member_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE; RETURN; END IF;
  INSERT INTO member_inventory (member_id, item_id, qty, slot)
  SELECT p_member_id, s.id, s.starter_qty, s.slot FROM shop_items s WHERE s.starter_qty > 0
  ON CONFLICT (member_id, item_id) DO UPDATE SET qty = member_inventory.qty + EXCLUDED.qty;
  RETURN QUERY SELECT TRUE;
END;
$$;

DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.economy_grant_starters(UUID) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.economy_grant_starters(UUID) TO service_role;
END $$;

-- ─── Catalogue (web/lib/wallet/catalogue.ts OWNERSHIP_ITEMS, RETIRED, STARTER_REFS) ─
-- BEGIN GENERATED OWNERSHIP SEED (web/scripts/gen-seeds.mjs)
INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, position, active) VALUES
  ('wear-top-tee', 'Base tee', 'outfit', '', 150, NULL, NULL, NULL, FALSE, FALSE, NULL, 'top_tee', 200, FALSE),
  ('wear-top-hoodie', 'Hoodie', 'outfit', '', 150, NULL, NULL, NULL, FALSE, FALSE, NULL, 'top_hoodie', 201, FALSE),
  ('wear-top-cardigan', 'Cardigan', 'outfit', '', 150, NULL, NULL, NULL, TRUE, FALSE, NULL, 'top_cardigan', 202, TRUE),
  ('wear-top-stripe-ls', 'Striped long-sleeve', 'outfit', '', 150, NULL, NULL, NULL, FALSE, FALSE, NULL, 'top_stripe_ls', 203, FALSE),
  ('wear-top-collar-shirt', 'Collared shirt', 'outfit', '', 150, NULL, NULL, NULL, TRUE, FALSE, NULL, 'top_collar_shirt', 204, TRUE),
  ('wear-top-sweater-vest', 'Sweater vest over tee', 'outfit', '', 150, NULL, NULL, NULL, TRUE, FALSE, NULL, 'top_sweater_vest', 205, TRUE),
  ('wear-top-tsi-crew', 'TSI crewneck', 'outfit', '', 150, NULL, NULL, NULL, TRUE, FALSE, NULL, 'top_tsi_crew', 206, TRUE),
  ('wear-top-raincoat', 'Raincoat', 'outfit', '', 150, NULL, NULL, NULL, TRUE, FALSE, NULL, 'top_raincoat', 207, TRUE),
  ('wear-bottom-shorts', 'Base shorts', 'outfit', '', 140, NULL, NULL, NULL, FALSE, FALSE, NULL, 'bottom_shorts', 208, FALSE),
  ('wear-bottom-trousers', 'Long trousers', 'outfit', '', 140, NULL, NULL, NULL, FALSE, FALSE, NULL, 'bottom_trousers', 209, FALSE),
  ('wear-bottom-pleated-skirt', 'Pleated skirt', 'outfit', '', 140, NULL, NULL, NULL, TRUE, FALSE, NULL, 'bottom_pleated_skirt', 210, TRUE),
  ('wear-bottom-overall-shorts', 'Overall shorts', 'outfit', '', 140, NULL, NULL, NULL, TRUE, FALSE, NULL, 'bottom_overall_shorts', 211, TRUE),
  ('wear-bottom-joggers', 'Jogger pants', 'outfit', '', 140, NULL, NULL, NULL, FALSE, FALSE, NULL, 'bottom_joggers', 212, FALSE),
  ('wear-bottom-long-skirt', 'Long skirt', 'outfit', '', 140, NULL, NULL, NULL, TRUE, FALSE, NULL, 'bottom_long_skirt', 213, TRUE),
  ('wear-onepiece-raincape', 'Hooded rain-cape dress', 'outfit', '', 180, NULL, NULL, NULL, FALSE, FALSE, NULL, 'onepiece_raincape', 214, FALSE),
  ('wear-onepiece-sundress', 'Sundress', 'outfit', '', 180, NULL, NULL, NULL, TRUE, FALSE, NULL, 'onepiece_sundress', 215, TRUE),
  ('wear-onepiece-robe', 'Robe', 'outfit', '', 180, NULL, NULL, NULL, TRUE, FALSE, NULL, 'onepiece_robe', 216, TRUE),
  ('wear-onepiece-jumpsuit', 'Jumpsuit', 'outfit', '', 180, NULL, NULL, NULL, TRUE, FALSE, NULL, 'onepiece_jumpsuit', 217, TRUE),
  ('wear-shoes-slipon', 'Yellow slip-ons', 'outfit', '', 110, NULL, NULL, NULL, FALSE, FALSE, NULL, 'shoes_slipon', 218, FALSE),
  ('wear-shoes-sneakers', 'Sneakers', 'outfit', '', 110, NULL, NULL, NULL, FALSE, FALSE, NULL, 'shoes_sneakers', 219, FALSE),
  ('wear-shoes-boots', 'Boots', 'outfit', '', 110, NULL, NULL, NULL, TRUE, FALSE, NULL, 'shoes_boots', 220, TRUE),
  ('wear-shoes-sandals', 'Sandals', 'outfit', '', 110, NULL, NULL, NULL, TRUE, FALSE, NULL, 'shoes_sandals', 221, TRUE),
  ('wear-shoes-loafers', 'Loafers', 'outfit', '', 110, NULL, NULL, NULL, TRUE, FALSE, NULL, 'shoes_loafers', 222, TRUE),
  ('wear-shoes-rainboots', 'Rain boots', 'outfit', '', 110, NULL, NULL, NULL, TRUE, FALSE, NULL, 'shoes_rainboots', 223, TRUE),
  ('wear-acc-glasses-round', 'Round glasses', 'accessory', '', 80, NULL, NULL, NULL, TRUE, FALSE, NULL, 'acc_glasses_round', 224, TRUE),
  ('wear-acc-glasses-square', 'Square glasses', 'accessory', '', 80, NULL, NULL, NULL, TRUE, FALSE, NULL, 'acc_glasses_square', 225, TRUE),
  ('wear-acc-beanie', 'Beanie', 'accessory', '', 80, NULL, NULL, NULL, TRUE, FALSE, NULL, 'acc_beanie', 226, TRUE),
  ('wear-acc-sunhat', 'Sun hat', 'accessory', '', 80, NULL, NULL, NULL, TRUE, FALSE, NULL, 'acc_sunhat', 227, TRUE),
  ('wear-acc-cap', 'Cap', 'accessory', '', 80, NULL, NULL, NULL, TRUE, FALSE, NULL, 'acc_cap', 228, TRUE),
  ('wear-acc-backpack', 'Backpack', 'accessory', '', 80, NULL, NULL, NULL, TRUE, FALSE, NULL, 'acc_backpack', 229, TRUE),
  ('wear-acc-shoulder-bag', 'Shoulder bag', 'accessory', '', 80, NULL, NULL, NULL, TRUE, FALSE, NULL, 'acc_shoulder_bag', 230, TRUE),
  ('wear-acc-scarf', 'Scarf', 'accessory', '', 80, NULL, NULL, NULL, TRUE, FALSE, NULL, 'acc_scarf', 231, TRUE),
  ('dye-wheat-blonde', 'Wheat blonde hair dye', 'hair', '', 140, NULL, NULL, NULL, TRUE, FALSE, NULL, 'hair:6', 232, TRUE),
  ('dye-copper', 'Copper hair dye', 'hair', '', 140, NULL, NULL, NULL, TRUE, FALSE, NULL, 'hair:7', 233, TRUE),
  ('dye-rust-red', 'Rust red hair dye', 'hair', '', 140, NULL, NULL, NULL, TRUE, FALSE, NULL, 'hair:8', 234, TRUE),
  ('dye-silver', 'Silver hair dye', 'hair', '', 140, NULL, NULL, NULL, TRUE, FALSE, NULL, 'hair:9', 235, TRUE),
  ('dye-blossom-pink', 'Blossom pink hair dye', 'hair', '', 140, NULL, NULL, NULL, TRUE, FALSE, NULL, 'hair:10', 236, TRUE),
  ('dye-sea-blue', 'Sea blue hair dye', 'hair', '', 140, NULL, NULL, NULL, TRUE, FALSE, NULL, 'hair:11', 237, TRUE),
  ('furn-home-bed', 'Country bed', 'furniture', '', 140, NULL, NULL, NULL, TRUE, TRUE, NULL, 'home-bed', 238, TRUE),
  ('furn-closet', 'Closet', 'furniture', '', 140, NULL, NULL, NULL, TRUE, TRUE, NULL, 'closet', 239, TRUE),
  ('furn-lounge-table', 'Low table', 'furniture', '', 140, NULL, NULL, NULL, TRUE, TRUE, NULL, 'lounge-table', 240, TRUE),
  ('furn-reading-table', 'Small table', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'reading-table', 241, TRUE),
  ('furn-wooden-chest', 'Wooden chest', 'furniture', '', 140, NULL, NULL, NULL, TRUE, TRUE, NULL, 'wooden-chest', 242, TRUE),
  ('furn-color-box-shelf', 'Colour-box shelf', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'color-box-shelf', 243, TRUE),
  ('furn-counter-register', 'Counter', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'counter-register', 244, TRUE),
  ('furn-barrel', 'Barrel', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'barrel', 245, TRUE),
  ('furn-plant-yucca', 'Yucca', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'plant-yucca', 246, TRUE),
  ('furn-antique-clock', 'Grandfather clock', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'antique-clock', 247, TRUE),
  ('furn-altar', 'Stone altar', 'furniture', '', 220, NULL, NULL, NULL, TRUE, TRUE, NULL, 'altar', 248, TRUE),
  ('furn-remains-pillar', 'Ruin pillar', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'remains-pillar', 249, TRUE),
  ('furn-shopping-cart', 'Shopping cart', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'shopping-cart', 250, TRUE),
  ('furn-windmill-retro', 'Retro windmill', 'furniture', '', 220, NULL, NULL, NULL, TRUE, TRUE, NULL, 'windmill-retro', 251, TRUE),
  ('furn-gold-hha-trophy', 'Gold trophy', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'gold-hha-trophy', 252, TRUE),
  ('furn-candle', 'Candle', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'candle', 253, TRUE),
  ('furn-yellow-message-mat', 'Welcome mat', 'furniture', '', 90, NULL, NULL, NULL, TRUE, TRUE, NULL, 'yellow-message-mat', 254, TRUE),
  ('furn-acorn-rug', 'Acorn rug', 'furniture', '', 150, NULL, NULL, NULL, TRUE, TRUE, NULL, 'acorn-rug', 255, TRUE),
  ('furn-wall-driedflower', 'Dried flowers', 'furniture', '', 140, NULL, NULL, NULL, TRUE, TRUE, NULL, 'wall-driedflower', 256, TRUE),
  ('furn-bulletinboard', 'Bulletin board', 'furniture', '', 140, NULL, NULL, NULL, TRUE, TRUE, NULL, 'bulletinboard', 257, TRUE),
  ('furn-bench-wood', 'Log bench', 'furniture', '', 140, NULL, NULL, NULL, TRUE, TRUE, NULL, 'bench-wood', 258, TRUE),
  ('furn-fence-country-a', 'Fence', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'fence-country-a', 259, TRUE),
  ('furn-stone-lantern', 'Stone lantern', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'stone-lantern', 260, TRUE),
  ('furn-beach-parasol', 'Parasol', 'furniture', '', 220, NULL, NULL, NULL, TRUE, TRUE, NULL, 'beach-parasol', 261, TRUE),
  ('furn-beach-bed', 'Beach chair', 'furniture', '', 140, NULL, NULL, NULL, TRUE, TRUE, NULL, 'beach-bed', 262, TRUE),
  ('furn-bush-azalea', 'Azalea bush', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'bush-azalea', 263, TRUE),
  ('furn-flower-tulip', 'Tulips', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'flower-tulip', 264, TRUE),
  ('furn-flower-rose', 'Roses', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'flower-rose', 265, TRUE),
  ('furn-tree-hardwood-a', 'Tree', 'furniture', '', 100, NULL, NULL, NULL, TRUE, TRUE, NULL, 'tree-hardwood-a', 266, TRUE)
ON CONFLICT (slug) DO NOTHING;
UPDATE shop_items SET active = FALSE WHERE slug IN ('outfit-sage-overalls', 'outfit-cream-knit', 'outfit-wharf-raincoat', 'outfit-club-tee', 'hair-chestnut', 'hair-sea-glass', 'hair-sunset', 'acc-straw-hat', 'acc-round-glasses', 'acc-bandana');
UPDATE shop_items s SET starter_qty = v.qty FROM (VALUES
  ('furn-study-chair', 1),
  ('furn-bookshelf', 1),
  ('furn-floor-lamp', 1),
  ('furn-wall-frame', 1),
  ('wear-top-tee', 1),
  ('wear-top-hoodie', 1),
  ('wear-top-stripe-ls', 1),
  ('wear-bottom-shorts', 1),
  ('wear-bottom-trousers', 1),
  ('wear-bottom-joggers', 1),
  ('wear-onepiece-raincape', 1),
  ('wear-shoes-slipon', 1),
  ('wear-shoes-sneakers', 1),
  ('furn-home-bed', 1),
  ('furn-closet', 1),
  ('furn-lounge-table', 1),
  ('furn-reading-table', 1),
  ('furn-wooden-chest', 1),
  ('furn-plant-yucca', 1),
  ('furn-candle', 1),
  ('furn-yellow-message-mat', 1),
  ('furn-bench-wood', 1),
  ('furn-flower-tulip', 1)
) AS v (slug, qty) WHERE s.slug = v.slug;
-- END GENERATED OWNERSHIP SEED

-- ─── profiles.avatar_config is server-only ──────────────────────────────────
-- Same function as 20260926151200 without 'avatar_config' in the allowlist.
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  editable constant text[] := array[
    'display_name', 'bio', 'year', 'program', 'hometown', 'birthday', 'phone',
    'preferred_email', 'github_username', 'instagram', 'linkedin', 'discord_tag',
    'favourite_music', 'dream_retirement', 'spirit_animal', 'fun_fact',
    'avatar_url', 'skills', 'social_links', 'active_theme',
    'preferences', 'onboarding_step', 'onboarding_completed', 'last_seen_at',
    'updated_at'
  ];
  changed text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  select string_agg(n.key, ', ' order by n.key) into changed
  from jsonb_each(to_jsonb(new)) n
  where n.key <> all (editable)
    and n.value is distinct from (to_jsonb(old) -> n.key);

  if changed is not null then
    raise exception 'profiles: % can only be changed by the server', changed
      using errcode = '42501';
  end if;
  return new;
end;
$$;
