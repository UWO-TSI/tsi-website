# Homes spec (personal island, starter house, decorating)

Owner: island agent (world + interior + placement UI), systems agent later for persistence. Decisions: ledger rows 68–71, 82, 115, 116, 117, 187, 95, 101, 70. Ledger wins over older specs and CLAUDE.md.

## What it is

Every account owns a small personal island with a house. First version: a fixed natural island (no terrain reshaping), one starter room (bed, lamp, one shelf) and a mailbox outside. Players decorate the house interior on a floor grid (snap, 90° rotation, wall items on walls, wallpaper/flooring swaps) and place furniture, paths, plants and outdoor decorations on the island with the same snapping. Extra rooms are bought one at a time up to a cap (coins + materials; ~500 coins per room). Furniture comes from the ACNH furniture dump already in the repo. Live visits are the next update; for now the island is single-player, reached from the wharf stub or the HQ "your plot" prompt (chapter 1 claims the plot).

## Fixed decisions

| Topic | Decision | Row |
|---|---|---|
| Ownership | Personal island + house per account, decorate, invite later | 68, 69 |
| Terrain | Fixed natural island; reshaping later | 70 |
| Guests | Need owner permission to harvest/edit (future) | 71 |
| Start | Free starter island + small house; expansions cost coins + materials | 82 |
| Rooms | Buy extra rooms one at a time, cap TBD (assume 4), no floors | 115 |
| Catalogue | ACNH furniture dump now; Blender originals later | 116 |
| Controls | Grid snap, 90° rotation, wall/floor items, wallpaper/flooring | 117 |
| Starter contents | Bed, lamp, one shelf inside; mailbox outside | 187 |
| Mailbox | Letters only (progression spec) | 95 |
| Price anchor | ~500 coins + materials per room | 127 |

## Deliverables (island agent)

1. **Personal island scene**: a small fixed island (about 1/4 of the village core) built with the same terrain/water/lighting systems, reached by a "Go home" action at the wharf stub and returned from by a boat/sign prompt. House exterior from the dump (a small ACNH house model), mailbox, a path, a few plants. Uses the same real time, seasons and weather.
2. **House interior**: reuse the existing interior system (HQ interior / interiorShared) for a single room; wallpaper and flooring swaps from dump materials; starter bed, lamp, shelf placed.
3. **Placement mode**: enter "decorate" (key or prompt); pick an item from a sheet (inventory stub: a fixed catalogue of ~30 dump pieces for now); place on the floor grid with snap and 90° rotation; wall items snap to walls; remove/pick up; outdoor placement on the island grid with the same code. Persist to a local store (localStorage via the existing settings-store pattern) with a typed layout document, so the systems agent can swap in Supabase persistence later; export the layout type in `web/lib/homes/`.
4. **Room expansion stub**: a "buy room" prompt at a door that shows the price and, with a `?rooms=` dev override, adds a second room connected by a door. No real wallet yet.
5. Screenshots (prefix H-) of: island arrival, interior default, decorating a room, outdoor placement, a second room. tsc, focused lint, tests (layout serialisation, snap/rotation/collision), no git writes.

## Out of scope

Live visits, wallet deduction, real inventory, Blender furniture, terrain editing, guest permissions.

## Questions

`specs/homes-questions.md`.
