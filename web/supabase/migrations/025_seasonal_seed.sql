-- ─── Seasonal palette seed (specs/seasonal-palettes.md) ────────────────
--
-- DRAFT 2026-07-25 — NOT YET APPLIED. Apply with the launch-window batch
-- (see specs/launch-batch.md; pairs with 024_game_coins.sql).
--
-- Seeds the five season rows so the no-code admin flow works day one:
-- flip `active` on a row → clients repaint (sky/fog/grass tint/particles)
-- on next SWR revalidation. Values mirror DEFAULT_PALETTES in
-- web/data/content-defaults.ts — keep the two in sync.
--
-- Idempotent + admin-respecting:
--  * upserts by slug WITHOUT touching `active` (an admin's current season
--    survives re-runs),
--  * activates `default` only if NO row is active (fresh DBs), honoring
--    the single-active partial index.

INSERT INTO seasonal_palettes (slug, display_name, palette, active, scheduled_start, scheduled_end)
VALUES
  ('default', 'Default',
   '{"sky":"#BFE9FA","grass":"#84CB47","accent":"#FFD166","fog":"#CDEBF7","water":"#4A90D9","building_primary":"#D4A574","building_accent":"#8B6F4E"}'::jsonb,
   FALSE, NULL, NULL),
  ('halloween', 'Halloween',
   '{"sky":"#2B1B3D","grass":"#3E2A47","accent":"#FF7518","fog":"#4A3A5C","water":"#1A1226","building_primary":"#5A2E8E","building_accent":"#0F0A1A"}'::jsonb,
   FALSE, '2026-10-01T00:00:00Z', '2026-11-07T23:59:59Z'),
  ('autumn', 'Autumn Harvest',
   '{"sky":"#D8E4EE","grass":"#9FA23F","accent":"#E07B39","fog":"#E4D9BF","water":"#4E7FA8","building_primary":"#C08A52","building_accent":"#7A5230"}'::jsonb,
   FALSE, '2026-09-15T00:00:00Z', '2026-11-30T23:59:59Z'),
  ('winter', 'Winter Frost',
   '{"sky":"#C7D8E8","grass":"#E8EEF2","accent":"#E86A6A","fog":"#DCE8F2","water":"#3A5F80","building_primary":"#B9C4CE","building_accent":"#6E7E8A"}'::jsonb,
   FALSE, '2026-12-01T00:00:00Z', '2027-02-28T23:59:59Z'),
  ('spring', 'Spring Sakura',
   '{"sky":"#CFE8F7","grass":"#8FD16A","accent":"#F5A9C4","fog":"#EBD9E4","water":"#5A9FD4","building_primary":"#D9B08C","building_accent":"#8B6F5E"}'::jsonb,
   FALSE, '2027-03-15T00:00:00Z', '2027-05-15T23:59:59Z')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  palette = EXCLUDED.palette,
  scheduled_start = EXCLUDED.scheduled_start,
  scheduled_end = EXCLUDED.scheduled_end;

-- Fresh DB only: make `default` the active season when nothing else is.
UPDATE seasonal_palettes
   SET active = TRUE
 WHERE slug = 'default'
   AND NOT EXISTS (SELECT 1 FROM seasonal_palettes WHERE active = TRUE);
