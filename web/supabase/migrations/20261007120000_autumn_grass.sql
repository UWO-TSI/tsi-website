-- ─── Autumn grass: an olive gold (audit 2026-10 world item 1) ────────────────
--
-- specs/polish/audit-2026-10-world.md item 1, approved by David 2026-10-07. The
-- autumn row's island_grass (#C6B46D, from 20260926150100_seasonal_seed) sat a few
-- lightness steps off the paths and the beach, so the village read as one tan
-- desert. #A4A046 keeps the paths apart at least as well as summer's grass does.
-- Only that key changes; the rest of the palette, `active` and the schedule stay.
-- Mirrors DEFAULT_PALETTES in web/data/content-defaults.ts. Idempotent.
-- Apply after 20261003190000_world_chat.

UPDATE seasonal_palettes
   SET palette = jsonb_set(palette, '{island_grass}', '"#A4A046"')
 WHERE slug = 'autumn';
