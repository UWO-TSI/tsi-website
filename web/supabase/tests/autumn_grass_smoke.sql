-- Autumn grass (20261007120000_autumn_grass, audit 2026-10 world item 1). Throwaway local Postgres after every
-- migration (supabase_stub.sql first), after world_chat_smoke.sql. Never Supabase. Fails before the migration: the
-- autumn row's island_grass is still the seed's #C6B46D.
\set ON_ERROR_STOP 1
DO $$
BEGIN
  ASSERT (SELECT palette->>'island_grass' FROM seasonal_palettes WHERE slug = 'autumn') = '#A4A046', 'autumn grass is the olive gold';
  -- Only island_grass moved: the rest of the seeded autumn palette is as seeded.
  ASSERT (SELECT palette - 'island_grass' FROM seasonal_palettes WHERE slug = 'autumn')
       = '{"sky":"#D8E4EE","grass":"#9FA23F","accent":"#E07B39","fog":"#E4D9BF","water":"#4E7FA8","building_primary":"#C08A52","building_accent":"#7A5230","leaf":"#FF9A3C"}'::jsonb,
         'rest of the autumn palette untouched';
  ASSERT (SELECT NOT active AND scheduled_start = '2026-09-15T00:00:00Z' AND scheduled_end = '2026-11-30T23:59:59Z'
            FROM seasonal_palettes WHERE slug = 'autumn'), 'autumn active flag and schedule untouched';
  -- The other seasons keep their own grass.
  ASSERT (SELECT jsonb_object_agg(slug, palette->>'island_grass') FROM seasonal_palettes WHERE slug IN ('winter', 'spring', 'summer'))
       = '{"winter":"#C9D6CB","spring":"#A9C271","summer":"#91B47F"}'::jsonb, 'other seasons untouched';
  RAISE NOTICE 'autumn grass ok';
END $$;
