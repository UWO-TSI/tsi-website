# Seasonal Palettes — the monthly content cadence (principle #8)

> Written 2026-07-25 (loop wake 64). Status: system live, seasonal set seeded
> as fallbacks; admin flow works today via the seasonal_palettes table.

## How it works (all of this already exists)

- **Source of truth:** the `seasonal_palettes` table (slug, display_name,
  palette JSON, `active`, `scheduled_start/end`). `useActivePalette()`
  (lib/game/contentLoader.ts) fetches the active row via SWR and feeds
  Building tints, SeasonalProps (slug-matched garlands/props), and the
  world grade.
- **Fallbacks:** `data/content-defaults.ts` `DEFAULT_PALETTES` — used when
  the DB is unreachable (env-less dev) AND as the canonical seed values.
- **Preview without shipping:** the admin draft system (`previewDraftId`)
  overlays a draft palette; `/lab/world`'s palette buttons preview any
  DEFAULT_PALETTES entry instantly (dev-only, `setLabPalette`).
- **Seasonal props:** `SeasonalProps.tsx` regex-matches the active slug
  (e.g. `/autumn|harvest|fall|halloween/`) to hang matching garlands;
  `Building.tsx` SHOP_DECO_SEASONS swaps shop dressing by slug.

## The seasonal set (wake 64)

| Slug | Window | Feel |
|------|--------|------|
| `default` | year-round | ACNH summer green |
| `autumn` | Sep 15 – Nov 30 | golden grass, pumpkin accent, warm fog |
| `halloween` | Oct 1 – Nov 7 | purple night, jack-o-lantern orange |
| `winter` | Dec 1 – Feb 28 | snow grass, frost sky, holly-red accent |
| `spring` | Mar 15 – May 15 | fresh green, sakura-pink accent |

## How an admin flips the season (no code)

1. Insert/ensure the row in `seasonal_palettes` with the values from
   `DEFAULT_PALETTES` (one-time seed; a launch-batch migration can seed all
   five rows).
2. Set `active = true` on the season, `false` on the rest (or rely on
   `scheduled_start/end` once the scheduler respects windows).
3. Clients pick it up on next SWR revalidation — no deploy.

## Open follow-ups

- Launch-batch migration seeding the five rows (join it with 024).
- Scheduler: auto-activate by `scheduled_start/end` (currently manual
  `active` flag; a tiny cron or a `WHERE now() BETWEEN` in
  fetchActivePalette would close it).
- David's pass on the four seasonal hexsets in `/lab/world` (buttons:
  Default / Halloween / Autumn Harvest / Winter Frost / Spring Sakura).
