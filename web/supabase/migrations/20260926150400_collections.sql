-- ─── 031 Collections: species roster, catch records, museum, trophies, showcase ─
--
-- DRAFT 2026-09-24. NOT APPLIED. Ledger rows 66, 67, 128, 129, 196, 201-204.
-- Depends on 001 (profiles), 023 (member_collections, applied).
--
-- Reuses member_collections (023) for discovery + stock instead of a second
-- tracker: a row = discovered; `count` stays the sellable stock; this adds a
-- lifetime total and the personal size record (catch card, row 196).
-- Writes go through /api/collections/* with the service role.

-- ─── Species roster (content; admin-editable like the 014 content tables) ─────
CREATE TABLE IF NOT EXISTS collection_species (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{1,64}$'),
  category TEXT NOT NULL CHECK (category IN ('fish', 'sea', 'bug', 'fruit', 'nature', 'mineral')),
  sub TEXT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  biome TEXT NOT NULL,
  tool TEXT NOT NULL CHECK (tool IN ('rod', 'net', 'hand', 'shovel')),
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  size_min_cm NUMERIC(7, 1),
  size_max_cm NUMERIC(7, 1),
  start_hour INTEGER CHECK (start_hour BETWEEN 0 AND 23),
  end_hour INTEGER CHECK (end_hour BETWEEN 0 AND 24),
  rain_any_hour BOOLEAN NOT NULL DEFAULT FALSE,
  weather TEXT[] NOT NULL DEFAULT '{}',   -- empty = any
  months INTEGER[] NOT NULL DEFAULT '{}', -- empty = all year
  one_liner TEXT NOT NULL DEFAULT '' CHECK (char_length(one_liner) <= 160),
  icon TEXT,
  model TEXT,
  asset_ready BOOLEAN NOT NULL DEFAULT TRUE,
  donatable BOOLEAN NOT NULL DEFAULT FALSE,
  wing TEXT CHECK (wing IN ('aquarium', 'insect_hall', 'nature_room')),
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK ((size_min_cm IS NULL) = (size_max_cm IS NULL) AND (size_min_cm IS NULL OR size_max_cm >= size_min_cm)),
  CHECK ((start_hour IS NULL) = (end_hour IS NULL)),
  CHECK (NOT donatable OR wing IS NOT NULL)
);
ALTER TABLE collection_species ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Species readable when active" ON collection_species
  FOR SELECT USING ((select auth.role()) = 'authenticated' AND active = TRUE);
CREATE POLICY "Species readable by T1/T2 (all rows)" ON collection_species
  FOR SELECT USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
CREATE POLICY "Species writable by T1/T2" ON collection_species
  FOR ALL USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2))
  WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

-- ─── Personal records on the existing collection rows ───────────────────────
ALTER TABLE member_collections
  ADD COLUMN IF NOT EXISTS total_collected INTEGER NOT NULL DEFAULT 0 CHECK (total_collected >= 0),
  ADD COLUMN IF NOT EXISTS best_size_cm NUMERIC(7, 1),
  ADD COLUMN IF NOT EXISTS best_size_at TIMESTAMPTZ;
UPDATE member_collections SET total_collected = GREATEST(total_collected, count);

-- ─── This week's best per member and species (HQ trophy case, row 204) ───────
CREATE TABLE IF NOT EXISTS weekly_catch_bests (
  week_start DATE NOT NULL,           -- Monday, America/Toronto
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL REFERENCES collection_species(key) ON DELETE CASCADE,
  size_cm NUMERIC(7, 1) NOT NULL,
  caught_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (week_start, user_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_weekly_catch_bests_week ON weekly_catch_bests (week_start);
ALTER TABLE weekly_catch_bests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Weekly bests readable by authenticated" ON weekly_catch_bests
  FOR SELECT USING ((select auth.role()) = 'authenticated');

-- ─── Club museum: one specimen per species, first donor credited (rows 67, 202) ─
CREATE TABLE IF NOT EXISTS museum_donations (
  species_key TEXT PRIMARY KEY REFERENCES collection_species(key) ON DELETE CASCADE,
  donor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  size_cm NUMERIC(7, 1),
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 100),
  donated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (donor_id, idempotency_key)
);
ALTER TABLE museum_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Museum readable by authenticated" ON museum_donations
  FOR SELECT USING ((select auth.role()) = 'authenticated');

-- ─── Profile showcase: 3 chosen items (row 204) ─────────────────────────────
CREATE TABLE IF NOT EXISTS member_showcase (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
  item_key TEXT NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 64),
  PRIMARY KEY (member_id, slot)
);
ALTER TABLE member_showcase ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Showcase readable by authenticated" ON member_showcase
  FOR SELECT USING ((select auth.role()) = 'authenticated');

-- ─── Atomic writes (service role only) ──────────────────────────────────────

-- One catch/pick: stock +1, lifetime +1, personal best, and this week's best.
-- Size is already clamped to the species range by the route.
CREATE OR REPLACE FUNCTION public.collections_record_catch(p_member_id UUID, p_item_key TEXT, p_size NUMERIC, p_trophy BOOLEAN)
RETURNS TABLE (count INTEGER, total_collected INTEGER, best_size_cm NUMERIC, new_record BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_old NUMERIC;
  v_row member_collections%ROWTYPE;
BEGIN
  SELECT mc.best_size_cm INTO v_old FROM member_collections mc WHERE mc.user_id = p_member_id AND mc.item_key = p_item_key FOR UPDATE;
  INSERT INTO member_collections AS mc (user_id, item_key, count, total_collected, best_size_cm, best_size_at)
  VALUES (p_member_id, p_item_key, 1, 1, p_size, CASE WHEN p_size IS NULL THEN NULL ELSE NOW() END)
  ON CONFLICT (user_id, item_key) DO UPDATE SET
    count = mc.count + 1,
    total_collected = mc.total_collected + 1,
    best_size_cm = CASE WHEN EXCLUDED.best_size_cm IS NOT NULL AND (mc.best_size_cm IS NULL OR EXCLUDED.best_size_cm > mc.best_size_cm) THEN EXCLUDED.best_size_cm ELSE mc.best_size_cm END,
    best_size_at = CASE WHEN EXCLUDED.best_size_cm IS NOT NULL AND (mc.best_size_cm IS NULL OR EXCLUDED.best_size_cm > mc.best_size_cm) THEN NOW() ELSE mc.best_size_at END,
    updated_at = NOW()
  RETURNING mc.* INTO v_row;
  IF p_trophy AND p_size IS NOT NULL THEN
    INSERT INTO weekly_catch_bests AS w (week_start, user_id, item_key, size_cm)
    VALUES (date_trunc('week', NOW() AT TIME ZONE 'America/Toronto')::DATE, p_member_id, p_item_key, p_size)
    ON CONFLICT (week_start, user_id, item_key) DO UPDATE SET size_cm = EXCLUDED.size_cm, caught_at = NOW()
      WHERE EXCLUDED.size_cm > w.size_cm;
  END IF;
  RETURN QUERY SELECT v_row.count, v_row.total_collected, v_row.best_size_cm,
    (p_size IS NOT NULL AND (v_old IS NULL OR p_size > v_old));
END;
$$;

-- Donate one specimen. Replays return replayed=true; a second donor of the
-- same species gets 'already_donated' and keeps their specimen (the unique
-- violation aborts the whole call, including the stock decrement).
CREATE OR REPLACE FUNCTION public.museum_donate(p_member_id UUID, p_species_key TEXT, p_idempotency_key TEXT, p_size NUMERIC)
RETURNS TABLE (replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF EXISTS (SELECT 1 FROM museum_donations WHERE donor_id = p_member_id AND idempotency_key = p_idempotency_key) THEN
    RETURN QUERY SELECT TRUE; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM collection_species WHERE key = p_species_key AND donatable AND active) THEN
    RAISE EXCEPTION 'not_donatable';
  END IF;
  IF EXISTS (SELECT 1 FROM museum_donations WHERE species_key = p_species_key) THEN
    RAISE EXCEPTION 'already_donated';
  END IF;
  UPDATE member_collections SET count = count - 1, updated_at = NOW()
   WHERE user_id = p_member_id AND item_key = p_species_key AND count >= 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_owned'; END IF;
  BEGIN
    INSERT INTO museum_donations (species_key, donor_id, size_cm, idempotency_key)
    VALUES (p_species_key, p_member_id, p_size, p_idempotency_key);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_donated';
  END;
  RETURN QUERY SELECT FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.collections_record_catch(UUID, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collections_record_catch(UUID, TEXT, NUMERIC, BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION public.museum_donate(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.museum_donate(UUID, TEXT, TEXT, NUMERIC) TO service_role;

-- ─── Seed: launch roster (web/lib/collections/roster.ts) ────────────────────
-- BEGIN GENERATED ROSTER (web/scripts/gen-seeds.mjs)
INSERT INTO collection_species (key, category, sub, name, biome, tool, rarity, size_min_cm, size_max_cm, start_hour, end_hour,
  rain_any_hour, weather, months, one_liner, icon, model, asset_ready, donatable, wing, position) VALUES
  ('fish_dace', 'fish', NULL, 'Dace', 'river', 'rod', 'common', 10, 18, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'A dependable little river fish.', '/assets/acnh/icons/fish_dace.png', NULL, TRUE, TRUE, 'aquarium', 1),
  ('fish_pale_chub', 'fish', NULL, 'Pale Chub', 'river', 'rod', 'common', 8, 14, 6, 18, FALSE, '{}'::text[], '{}'::int[], 'Pale, quick and everywhere in daylight.', '/assets/acnh/icons/fish_pale_chub.png', NULL, TRUE, TRUE, 'aquarium', 2),
  ('fish_loach', 'fish', NULL, 'Loach', 'river', 'rod', 'common', 12, 20, NULL, NULL, FALSE, '{}'::text[], ARRAY[3,4,5]::int[], 'Whiskers first, then the rest of it.', '/assets/acnh/icons/fish_loach.png', NULL, TRUE, TRUE, 'aquarium', 3),
  ('fish_freshwater_goby', 'fish', NULL, 'Freshwater Goby', 'river', 'rod', 'common', 10, 15, 20, 4, FALSE, '{}'::text[], '{}'::int[], 'Comes out when the lamps come on.', '/assets/acnh/icons/fish_freshwater_goby.png', NULL, TRUE, TRUE, 'aquarium', 4),
  ('fish_sweetfish', 'fish', NULL, 'Sweetfish', 'river', 'rod', 'uncommon', 18, 30, NULL, NULL, FALSE, '{}'::text[], ARRAY[7,8,9]::int[], 'Smells faintly of melon. Really.', '/assets/acnh/icons/fish_sweetfish.png', NULL, TRUE, TRUE, 'aquarium', 5),
  ('fish_salmon', 'fish', NULL, 'Salmon', 'river', 'rod', 'uncommon', 50, 80, NULL, NULL, FALSE, '{}'::text[], ARRAY[9,10,11]::int[], 'Headed upstream, like the rest of us in October.', '/assets/acnh/icons/fish_salmon.png', NULL, TRUE, TRUE, 'aquarium', 6),
  ('fish_rainbow_trout', 'fish', NULL, 'Rainbow Trout', 'river', 'rod', 'uncommon', 30, 50, 5, 19, FALSE, '{}'::text[], ARRAY[3,4,5,6,9,10,11]::int[], 'Every colour, all at once.', '/assets/acnh/icons/fish_rainbow_trout.png', NULL, TRUE, TRUE, 'aquarium', 7),
  ('fish_yamame_trout', 'fish', NULL, 'Yamame Trout', 'river', 'rod', 'uncommon', 20, 35, NULL, NULL, FALSE, '{}'::text[], ARRAY[3,4,5,6,9,10,11]::int[], 'Spotted along the flanks like river pebbles.', '/assets/acnh/icons/fish_yamame_trout.png', NULL, TRUE, TRUE, 'aquarium', 8),
  ('fish_black_bass', 'fish', NULL, 'Black Bass', 'river', 'rod', 'rare', 30, 55, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'Put up a real fight.', '/assets/acnh/icons/fish_black_bass.png', NULL, TRUE, TRUE, 'aquarium', 9),
  ('fish_pike', 'fish', NULL, 'Pike', 'river', 'rod', 'rare', 50, 90, NULL, NULL, FALSE, '{}'::text[], ARRAY[9,10,11,12]::int[], 'All teeth and patience.', '/assets/acnh/icons/fish_pike.png', NULL, TRUE, TRUE, 'aquarium', 10),
  ('fish_snakehead', 'fish', NULL, 'Snakehead', 'river', 'rod', 'rare', 40, 90, 9, 16, FALSE, '{}'::text[], '{}'::int[], 'Breathes air when it feels like it.', '/assets/acnh/icons/fish_snakehead.png', NULL, TRUE, TRUE, 'aquarium', 11),
  ('fish_catfish', 'fish', NULL, 'Catfish', 'river', 'rod', 'epic', 50, 110, 20, 4, TRUE, '{}'::text[], '{}'::int[], 'Whiskers the size of a bookmark.', '/assets/acnh/icons/fish_catfish.png', NULL, TRUE, TRUE, 'aquarium', 12),
  ('fish_king_salmon', 'fish', NULL, 'King Salmon', 'river', 'rod', 'epic', 70, 120, NULL, NULL, FALSE, '{}'::text[], ARRAY[9]::int[], 'The heaviest thing in the river in September.', '/assets/acnh/icons/fish_king_salmon.png', NULL, TRUE, TRUE, 'aquarium', 13),
  ('fish_bitterling', 'fish', NULL, 'Bitterling', 'pond', 'rod', 'common', 5, 10, NULL, NULL, FALSE, '{}'::text[], ARRAY[11,12,1,2,3]::int[], 'Small and a little shiny.', '/assets/acnh/icons/fish_bitterling.png', NULL, TRUE, TRUE, 'aquarium', 14),
  ('fish_killifish', 'fish', NULL, 'Killifish', 'pond', 'rod', 'common', 3, 5, 6, 20, FALSE, '{}'::text[], ARRAY[4,5,6,7,8]::int[], 'Tiny, but it counts.', '/assets/acnh/icons/fish_killifish.png', NULL, TRUE, TRUE, 'aquarium', 15),
  ('fish_tadpole', 'fish', NULL, 'Tadpole', 'pond', 'rod', 'common', 3, 5, NULL, NULL, FALSE, '{}'::text[], ARRAY[3,4,5,6,7]::int[], 'Will be a frog by next month.', '/assets/acnh/icons/fish_tadpole.png', NULL, TRUE, TRUE, 'aquarium', 16),
  ('fish_frog', 'fish', NULL, 'Frog', 'pond', 'rod', 'common', 5, 10, NULL, NULL, FALSE, '{}'::text[], ARRAY[5,6,7,8]::int[], 'Not technically a fish. Donate it anyway.', '/assets/acnh/icons/fish_frog.png', NULL, TRUE, TRUE, 'aquarium', 17),
  ('fish_crucian_carp', 'fish', NULL, 'Crucian Carp', 'pond', 'rod', 'uncommon', 15, 30, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'A pond regular.', '/assets/acnh/icons/fish_crucian_carp.png', NULL, TRUE, TRUE, 'aquarium', 18),
  ('fish_goldfish', 'fish', NULL, 'Goldfish', 'pond', 'rod', 'uncommon', 8, 15, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'Someone''s old pet, living its best life.', '/assets/acnh/icons/fish_goldfish.png', NULL, TRUE, TRUE, 'aquarium', 19),
  ('fish_carp', 'fish', NULL, 'Carp', 'pond', 'rod', 'uncommon', 35, 70, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'Big, calm, unbothered.', '/assets/acnh/icons/fish_carp.png', NULL, TRUE, TRUE, 'aquarium', 20),
  ('fish_bluegill', 'fish', NULL, 'Bluegill', 'pond', 'rod', 'uncommon', 12, 22, 9, 16, FALSE, '{}'::text[], '{}'::int[], 'Blue cheeks, bright afternoons.', '/assets/acnh/icons/fish_bluegill.png', NULL, TRUE, TRUE, 'aquarium', 21),
  ('fish_snapping_turtle', 'fish', NULL, 'Snapping Turtle', 'pond', 'rod', 'rare', 20, 35, 20, 4, FALSE, '{}'::text[], ARRAY[4,5,6,7,8,9,10]::int[], 'Keep fingers clear.', '/assets/acnh/icons/fish_snapping_turtle.png', NULL, TRUE, TRUE, 'aquarium', 22),
  ('fish_golden_koi', 'fish', NULL, 'Golden Koi', 'pond', 'rod', 'legendary', 60, 95, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'The pond''s quiet celebrity.', '/assets/acnh/icons/fish_golden_koi.png', NULL, TRUE, TRUE, 'aquarium', 23),
  ('fish_char', 'fish', NULL, 'Char', 'cliff_pool', 'rod', 'rare', 40, 60, NULL, NULL, FALSE, '{}'::text[], ARRAY[3,4,5,6,9,10,11]::int[], 'Cold water, clear head.', '/assets/acnh/icons/fish_char.png', NULL, TRUE, TRUE, 'aquarium', 24),
  ('fish_gar', 'fish', NULL, 'Gar', 'cliff_pool', 'rod', 'epic', 90, 150, 16, 9, TRUE, '{}'::text[], ARRAY[6,7,8,9]::int[], 'Older than the dinosaurs, and looks it.', '/assets/acnh/icons/fish_gar.png', NULL, TRUE, TRUE, 'aquarium', 25),
  ('fish_golden_trout', 'fish', NULL, 'Golden Trout', 'cliff_pool', 'rod', 'legendary', 40, 60, NULL, NULL, FALSE, '{}'::text[], ARRAY[3,4,5,9,10,11]::int[], 'Glows like the last hour of daylight.', '/assets/acnh/icons/fish_golden_trout.png', NULL, TRUE, TRUE, 'aquarium', 26),
  ('fish_stringfish', 'fish', NULL, 'Stringfish', 'cliff_pool', 'rod', 'legendary', 80, 130, 21, 4, TRUE, '{}'::text[], ARRAY[12,1,2,3]::int[], 'Long, pale and very rare.', '/assets/acnh/icons/fish_stringfish.png', NULL, TRUE, TRUE, 'aquarium', 27),
  ('fish_anchovy', 'fish', NULL, 'Anchovy', 'sea', 'rod', 'common', 10, 15, 6, 18, FALSE, '{}'::text[], '{}'::int[], 'Comes in a crowd.', '/assets/acnh/icons/fish_anchovy.png', NULL, TRUE, TRUE, 'aquarium', 28),
  ('fish_horse_mackerel', 'fish', NULL, 'Horse Mackerel', 'sea', 'rod', 'common', 20, 40, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'The pier''s bread and butter.', '/assets/acnh/icons/fish_horse_mackerel.png', NULL, TRUE, TRUE, 'aquarium', 29),
  ('fish_sea_bass', 'fish', NULL, 'Sea Bass', 'sea', 'rod', 'common', 50, 90, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'No, it''s at least a C+.', '/assets/acnh/icons/fish_sea_bass.png', NULL, TRUE, TRUE, 'aquarium', 30),
  ('fish_squid', 'fish', NULL, 'Squid', 'sea', 'rod', 'common', 20, 40, NULL, NULL, FALSE, '{}'::text[], ARRAY[12,1,2,3,4,5,6,7,8]::int[], 'Eight arms, zero regrets.', '/assets/acnh/icons/fish_squid.png', NULL, TRUE, TRUE, 'aquarium', 31),
  ('fish_olive_flounder', 'fish', NULL, 'Olive Flounder', 'sea', 'rod', 'uncommon', 40, 80, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'Both eyes on one side, always watching.', '/assets/acnh/icons/fish_olive_flounder.png', NULL, TRUE, TRUE, 'aquarium', 32),
  ('fish_red_snapper', 'fish', NULL, 'Red Snapper', 'sea', 'rod', 'uncommon', 30, 60, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'The colour of a good sunset.', '/assets/acnh/icons/fish_red_snapper.png', NULL, TRUE, TRUE, 'aquarium', 33),
  ('fish_blowfish', 'fish', NULL, 'Blowfish', 'sea', 'rod', 'uncommon', 20, 40, 20, 4, FALSE, '{}'::text[], ARRAY[11,12,1,2]::int[], 'Please don''t squeeze it.', '/assets/acnh/icons/fish_blowfish.png', NULL, TRUE, TRUE, 'aquarium', 34),
  ('fish_barred_knifejaw', 'fish', NULL, 'Barred Knifejaw', 'sea', 'rod', 'uncommon', 30, 50, NULL, NULL, FALSE, '{}'::text[], ARRAY[3,4,5,6,7,8,9,10,11]::int[], 'Striped like a club hoodie.', '/assets/acnh/icons/fish_barred_knifejaw.png', NULL, TRUE, TRUE, 'aquarium', 35),
  ('fish_ray', 'fish', NULL, 'Ray', 'sea', 'rod', 'rare', 100, 200, 6, 18, FALSE, '{}'::text[], ARRAY[8,9,10,11]::int[], 'Glides like it has somewhere to be.', '/assets/acnh/icons/fish_ray.png', NULL, TRUE, TRUE, 'aquarium', 36),
  ('fish_mahi_mahi', 'fish', NULL, 'Mahi-mahi', 'sea', 'rod', 'rare', 80, 140, NULL, NULL, FALSE, '{}'::text[], ARRAY[6,7,8,9]::int[], 'So good they named it twice.', '/assets/acnh/icons/fish_mahi_mahi.png', NULL, TRUE, TRUE, 'aquarium', 37),
  ('fish_football_fish', 'fish', NULL, 'Football Fish', 'sea', 'rod', 'rare', 30, 60, 20, 4, FALSE, '{}'::text[], ARRAY[11,12,1,2,3]::int[], 'Brings its own lamp.', '/assets/acnh/icons/fish_football_fish.png', NULL, TRUE, TRUE, 'aquarium', 38),
  ('fish_tuna', 'fish', NULL, 'Tuna', 'sea', 'rod', 'epic', 150, 250, NULL, NULL, FALSE, '{}'::text[], ARRAY[11,12,1,2,3,4]::int[], 'Built like a torpedo.', '/assets/acnh/icons/fish_tuna.png', NULL, TRUE, TRUE, 'aquarium', 39),
  ('fish_coelacanth', 'fish', NULL, 'Coelacanth', 'sea', 'rod', 'legendary', 120, 180, 20, 4, FALSE, ARRAY['rain']::text[], '{}'::int[], 'A living fossil that only shows up on rainy nights.', '/assets/acnh/icons/fish_coelacanth.png', NULL, TRUE, TRUE, 'aquarium', 40),
  ('sea_scallop', 'sea', NULL, 'Scallop', 'sea', 'rod', 'common', 8, 14, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/sea_scallop.png', NULL, TRUE, TRUE, 'aquarium', 41),
  ('sea_sweet_shrimp', 'sea', NULL, 'Sweet Shrimp', 'sea', 'rod', 'common', 5, 9, 16, 9, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/sea_sweet_shrimp.png', NULL, TRUE, TRUE, 'aquarium', 42),
  ('sea_sea_star', 'sea', NULL, 'Sea Star', 'sea', 'rod', 'common', 8, 15, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/sea_sea_star.png', NULL, TRUE, TRUE, 'aquarium', 43),
  ('sea_barnacle', 'sea', NULL, 'Acorn Barnacle', 'sea', 'rod', 'common', 2, 4, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/sea_barnacle.png', NULL, TRUE, TRUE, 'aquarium', 44),
  ('sea_dungeness_crab', 'sea', NULL, 'Dungeness Crab', 'sea', 'rod', 'uncommon', 15, 25, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/sea_dungeness_crab.png', NULL, TRUE, TRUE, 'aquarium', 45),
  ('sea_garden_eel', 'sea', NULL, 'Garden Eel', 'sea', 'rod', 'uncommon', 30, 40, 6, 18, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/sea_garden_eel.png', NULL, TRUE, TRUE, 'aquarium', 46),
  ('sea_firefly_squid', 'sea', NULL, 'Firefly Squid', 'sea', 'rod', 'uncommon', 5, 8, 21, 4, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/sea_firefly_squid.png', NULL, TRUE, TRUE, 'aquarium', 47),
  ('sea_abalone', 'sea', NULL, 'Abalone', 'sea', 'rod', 'rare', 12, 20, 16, 9, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/sea_abalone.png', NULL, TRUE, TRUE, 'aquarium', 48),
  ('sea_pearl_oyster', 'sea', NULL, 'Pearl Oyster', 'sea', 'rod', 'rare', 7, 12, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/sea_pearl_oyster.png', NULL, TRUE, TRUE, 'aquarium', 49),
  ('sea_giant_isopod', 'sea', NULL, 'Giant Isopod', 'sea', 'rod', 'epic', 20, 40, 20, 4, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/sea_giant_isopod.png', NULL, TRUE, TRUE, 'aquarium', 50),
  ('shore_gazami_crab', 'sea', NULL, 'Gazami Crab', 'beach', 'hand', 'common', 10, 20, 6, 18, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/shore_gazami_crab.png', NULL, TRUE, TRUE, 'aquarium', 51),
  ('shore_hermit_crab', 'sea', NULL, 'Hermit Crab', 'beach', 'hand', 'common', 3, 8, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/shore_hermit_crab.png', NULL, TRUE, TRUE, 'aquarium', 52),
  ('bug_common_butterfly', 'bug', NULL, 'Common Butterfly', 'flowers', 'net', 'common', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[4,5,6,7,8,9]::int[], '', '/assets/acnh/icons/bug_common_butterfly.png', NULL, TRUE, TRUE, 'insect_hall', 53),
  ('bug_agrias_butterfly', 'bug', NULL, 'Agrias Butterfly', 'flowers', 'net', 'rare', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[5,6,7,8]::int[], '', '/assets/acnh/icons/bug_agrias_butterfly.png', NULL, TRUE, TRUE, 'insect_hall', 54),
  ('bug_emperor_butterfly', 'bug', NULL, 'Emperor Butterfly', 'flowers', 'net', 'rare', NULL, NULL, 17, 4, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/bug_emperor_butterfly.png', NULL, TRUE, TRUE, 'insect_hall', 55),
  ('bug_monarch_butterfly', 'bug', NULL, 'Monarch Butterfly', 'flowers', 'net', 'uncommon', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[8,9,10]::int[], '', '/assets/acnh/icons/bug_monarch_butterfly.png', NULL, TRUE, TRUE, 'insect_hall', 56),
  ('bug_tiger_butterfly', 'bug', NULL, 'Tiger Butterfly', 'flowers', 'net', 'common', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[5,6,7,8]::int[], '', '/assets/acnh/icons/bug_tiger_butterfly.png', NULL, TRUE, TRUE, 'insect_hall', 57),
  ('bug_peacock_butterfly', 'bug', NULL, 'Peacock Butterfly', 'flowers', 'net', 'uncommon', NULL, NULL, 20, 4, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/bug_peacock_butterfly.png', NULL, TRUE, TRUE, 'insect_hall', 58),
  ('bug_darner_dragonfly', 'bug', NULL, 'Darner Dragonfly', 'water_edge', 'net', 'uncommon', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[6,7,8,9]::int[], '', '/assets/acnh/icons/bug_darner_dragonfly.png', NULL, TRUE, TRUE, 'insect_hall', 59),
  ('bug_red_dragonfly', 'bug', NULL, 'Red Dragonfly', 'water_edge', 'net', 'common', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[9,10]::int[], '', '/assets/acnh/icons/bug_red_dragonfly.png', NULL, TRUE, TRUE, 'insect_hall', 60),
  ('bug_ladybug', 'bug', NULL, 'Ladybug', 'flowers', 'net', 'common', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[4,5,6,10]::int[], '', '/assets/acnh/icons/bug_ladybug.png', NULL, TRUE, TRUE, 'insect_hall', 61),
  ('bug_brown_cicada', 'bug', NULL, 'Brown Cicada', 'trees', 'net', 'uncommon', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[7,8]::int[], '', '/assets/acnh/icons/bug_brown_cicada.png', NULL, TRUE, TRUE, 'insect_hall', 62),
  ('bug_firefly', 'bug', NULL, 'Firefly', 'water_edge', 'net', 'uncommon', NULL, NULL, 19, 4, FALSE, '{}'::text[], ARRAY[6,7]::int[], '', '/assets/acnh/icons/bug_firefly.png', NULL, TRUE, TRUE, 'insect_hall', 63),
  ('bug_mantis', 'bug', NULL, 'Mantis', 'flowers', 'net', 'rare', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[8,9,10,11]::int[], '', '/assets/acnh/icons/bug_mantis.png', NULL, TRUE, TRUE, 'insect_hall', 64),
  ('bug_grasshopper', 'bug', NULL, 'Grasshopper', 'ground', 'net', 'common', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[7,8,9]::int[], '', '/assets/acnh/icons/bug_grasshopper.png', NULL, TRUE, TRUE, 'insect_hall', 65),
  ('bug_honeybee', 'bug', NULL, 'Honeybee', 'flowers', 'net', 'common', NULL, NULL, 6, 18, FALSE, '{}'::text[], ARRAY[3,4,5,6,7]::int[], '', NULL, NULL, FALSE, TRUE, 'insect_hall', 66),
  ('bug_stag_beetle', 'bug', NULL, 'Stag Beetle', 'trees', 'net', 'rare', NULL, NULL, 17, 8, FALSE, '{}'::text[], ARRAY[7,8]::int[], '', NULL, NULL, FALSE, TRUE, 'insect_hall', 67),
  ('bug_rhinoceros_beetle', 'bug', NULL, 'Rhinoceros Beetle', 'trees', 'net', 'epic', NULL, NULL, 23, 8, FALSE, '{}'::text[], ARRAY[7,8]::int[], '', NULL, NULL, FALSE, TRUE, 'insect_hall', 68),
  ('bug_walking_stick', 'bug', NULL, 'Walking Stick', 'trees', 'net', 'uncommon', NULL, NULL, 4, 19, FALSE, '{}'::text[], ARRAY[7,8,9,10,11]::int[], '', NULL, NULL, FALSE, TRUE, 'insect_hall', 69),
  ('bug_snail', 'bug', NULL, 'Snail', 'ground', 'net', 'common', NULL, NULL, NULL, NULL, FALSE, ARRAY['rain']::text[], '{}'::int[], '', NULL, NULL, FALSE, TRUE, 'insect_hall', 70),
  ('bug_cricket', 'bug', NULL, 'Cricket', 'ground', 'net', 'common', NULL, NULL, 17, 8, FALSE, '{}'::text[], ARRAY[9,10,11]::int[], '', NULL, NULL, FALSE, TRUE, 'insect_hall', 71),
  ('bug_bagworm', 'bug', NULL, 'Bagworm', 'trees', 'net', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[1,2,3,11,12]::int[], '', NULL, NULL, FALSE, TRUE, 'insect_hall', 72),
  ('apple', 'fruit', NULL, 'Apple', 'trees', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/apple.png', NULL, TRUE, FALSE, NULL, 73),
  ('peach', 'fruit', NULL, 'Peach', 'trees', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', '/assets/acnh/icons/peach.png', NULL, TRUE, FALSE, NULL, 74),
  ('fruit_pear', 'fruit', NULL, 'Pear', 'trees', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[8,9,10]::int[], '', NULL, NULL, FALSE, FALSE, NULL, 75),
  ('fruit_orange', 'fruit', NULL, 'Orange', 'trees', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, NULL, FALSE, FALSE, NULL, 76),
  ('fruit_cherry', 'fruit', NULL, 'Cherry', 'trees', 'hand', 'uncommon', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[6,7]::int[], '', NULL, NULL, FALSE, FALSE, NULL, 77),
  ('fruit_coconut', 'fruit', NULL, 'Coconut', 'beach', 'hand', 'uncommon', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, NULL, FALSE, FALSE, NULL, 78),
  ('fruit_blackberry', 'fruit', NULL, 'Blackberry', 'bush', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[7,8,9]::int[], '', NULL, NULL, FALSE, FALSE, NULL, 79),
  ('fruit_blueberry', 'fruit', NULL, 'Blueberry', 'bush', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[7,8]::int[], '', NULL, NULL, FALSE, FALSE, NULL, 80),
  ('flower_cosmos', 'nature', 'flower', 'Pink Cosmos', 'flowers', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[6,7,8,9,10]::int[], '', '/assets/acnh/icons/flower_cosmos.png', NULL, TRUE, TRUE, 'nature_room', 81),
  ('flower_lily', 'nature', 'flower', 'White Lily', 'flowers', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[5,6,7,8]::int[], '', '/assets/acnh/icons/flower_lily.png', NULL, TRUE, TRUE, 'nature_room', 82),
  ('flower_hyacinth', 'nature', 'flower', 'Blue Hyacinth', 'flowers', 'hand', 'uncommon', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[3,4,5]::int[], '', '/assets/acnh/icons/flower_hyacinth.png', NULL, TRUE, TRUE, 'nature_room', 83),
  ('flower_mum', 'nature', 'flower', 'Yellow Mum', 'flowers', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[9,10,11]::int[], '', '/assets/acnh/icons/flower_mum.png', NULL, TRUE, TRUE, 'nature_room', 84),
  ('flower_rose', 'nature', 'flower', 'Red Rose', 'flowers', 'hand', 'uncommon', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[5,6,7,8,9]::int[], '', '/assets/acnh/icons/flower_rose.png', NULL, TRUE, TRUE, 'nature_room', 85),
  ('flower_tulip', 'nature', 'flower', 'Orange Tulip', 'flowers', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[4,5]::int[], '', '/assets/acnh/icons/flower_tulip.png', NULL, TRUE, TRUE, 'nature_room', 86),
  ('flower_pansy', 'nature', 'flower', 'Purple Pansy', 'flowers', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[3,4,5,9,10]::int[], '', '/assets/acnh/icons/flower_pansy.png', NULL, TRUE, TRUE, 'nature_room', 87),
  ('flower_windflower', 'nature', 'flower', 'Windflower', 'flowers', 'hand', 'rare', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[3,4,10,11]::int[], '', '/assets/acnh/icons/flower_windflower.png', NULL, TRUE, TRUE, 'nature_room', 88),
  ('shell_asari', 'nature', 'shell', 'Asari Clam', 'beach', 'shovel', 'common', 3, 6, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, '/assets/acnh/props/shell-asari.glb', TRUE, TRUE, 'nature_room', 89),
  ('shell_scallop', 'nature', 'shell', 'Scallop Shell', 'beach', 'hand', 'common', 6, 12, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, '/assets/acnh/props/shell-scallop.glb', TRUE, TRUE, 'nature_room', 90),
  ('shell_turban', 'nature', 'shell', 'Turban Shell', 'beach', 'hand', 'uncommon', 5, 10, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, '/assets/acnh/props/shell-turban.glb', TRUE, TRUE, 'nature_room', 91),
  ('shell_whelk', 'nature', 'shell', 'Whelk Shell', 'beach', 'hand', 'rare', 8, 16, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, '/assets/acnh/props/shell-whelk.glb', TRUE, TRUE, 'nature_room', 92),
  ('mushroom_round', 'nature', 'mushroom', 'Round Mushroom', 'woods', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[9,10,11]::int[], '', NULL, NULL, FALSE, TRUE, 'nature_room', 93),
  ('mushroom_flat', 'nature', 'mushroom', 'Flat Mushroom', 'woods', 'hand', 'uncommon', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[9,10,11]::int[], '', NULL, NULL, FALSE, TRUE, 'nature_room', 94),
  ('mushroom_skinny', 'nature', 'mushroom', 'Skinny Mushroom', 'woods', 'hand', 'rare', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], ARRAY[11]::int[], '', NULL, NULL, FALSE, TRUE, 'nature_room', 95),
  ('rock_stone', 'mineral', NULL, 'Stone', 'rocks', 'shovel', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, NULL, FALSE, FALSE, NULL, 96),
  ('rock_clay', 'mineral', NULL, 'Clay', 'rocks', 'shovel', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, NULL, FALSE, FALSE, NULL, 97),
  ('rock_iron_nugget', 'mineral', NULL, 'Iron Nugget', 'rocks', 'shovel', 'uncommon', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, NULL, FALSE, FALSE, NULL, 98),
  ('rock_gold_nugget', 'mineral', NULL, 'Gold Nugget', 'rocks', 'shovel', 'epic', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, NULL, FALSE, FALSE, NULL, 99),
  ('rock_crystal', 'mineral', NULL, 'Crystal', 'rocks', 'shovel', 'rare', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], '', NULL, NULL, FALSE, FALSE, NULL, 100)
ON CONFLICT (key) DO NOTHING;
-- END GENERATED ROSTER
