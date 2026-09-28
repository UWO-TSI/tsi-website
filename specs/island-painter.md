# Island painter: David paints the real village (rows 241, 246)

David (2026-09-28): "the island is poorly designed and i will design the island with the island painter feature in the lab, it should be bigger, more organic, things less cramped." He places everything himself (row 246). This spec prepares the painter so that what he paints is exactly what the game loads.

## Where it stands (survey 2026-09-28)
- `/lab/map` edits `web/data/island-map.json`, the retired 128×128 legacy island. No game scene draws it.
- The member island is built in code (`createDefaultIsland()`, `lib/game/defaultIsland.ts:87-151`): a 64×64 ellipse plus rectangles, with the sea as River cells inside the grid.
- Every building, tree, bush, flower, prop, the wharf, bridge, study tables, resident anchors, spawns, doors, prompts, bug/firefly anchors and puddles are hard-coded world coordinates (`defaultIsland.ts`, `DefaultIslandWorld.tsx`, `islandNodes.ts`, `lib/content/residents.ts`, `lib/study/seats.ts`, `progressionBridge.ts`).
- The painter's markers are planning notes nothing reads; it has no organic tools; its canvas is rotated 180° from the game view; its sea (Void) is not the member island's sea (River).
- Size assumptions are scattered: shadow extent ±26, cloud plane [46,38], fog, overview camera, minimap viewBox, glint radius 90, the ellipse-based sea/pond test, the beach ring, literal bug and puddle spots.

## Deliverable
1. **One village map file** `web/data/village-map.json`, in the existing document format extended with an object layer. `island-map.json` stays as David's preserved legacy draft. `createDefaultIsland` loads the village file. The first version is today's code-built island exported into it, so nothing changes visually until David paints (prove it with a frame diff).
2. **The painter opens the village file by default** (legacy file still openable), supports sizes from 64 up to 256 cells per side, shows world coordinates under the cursor, and has a **game-view orientation** (camera forward, west, at the top; north marker on the right, matching the minimap).
3. **One sea convention** shared by painter, terrain, ocean, glints and fishing; sea, pond and river are classified from water connectivity, not the ellipse.
4. **Organic tools:** smooth, grow and shrink brushes; a noise/jitter brush for coastlines; lasso fill; a coastline generator (port `coast.ts` harmonics) as a starting shape. Existing tools stay.
5. **Object layer** (reuse `lib/homes/catalogue.ts`, `lib/homes/layout.ts` and `home/PlacementLayer.tsx` patterns): every object has a stable id, kind/model, position, rotation and scale where it makes sense. Kinds: the landmarks (HQ, shop, oracle, café, museum, fitting room, mission board, notice/catch boards, monument, mailbox), wharf, bridges, trees/bushes/flowers (with seed), rocks, benches (their seats), lamps, fences, study tables, resident anchors (keep the existing keys; saved schedules reference them), named spawns and door/prompt points, puddles, bug/firefly anchors. Place, move, rotate, delete; footprint overlap warnings. ACNH grid law still holds (buildings on integer cells with a 1-tile gap, cliffs 1.5u, ramps).
6. **The game reads everything from the file**: landmarks, nature, props, wharf deck and pier, bridge, study tables, resident anchors, spawns, doors and prompts, quest markers, forage and bug nodes, puddles, collision. Tests pinned to today's coordinates read from the file.
7. **Size-dependent systems follow the map's bounds**: shadow extent and target, cloud plane, fog and far plane, overview camera, minimap viewBox and clip, glint radius and density, beach ring from shore cells.
8. **Walk the draft before exporting**: `/lab/island?draft=1` loads the painter's current draft so David can walk it in 3D. Export stays clipboard JSON (no disk write path, by design); the coordinator commits David's export.
9. **Health panel = tests**: add the flat-share rule, landmarks on dry land, approachable and reachable from spawn, and a fishable sea. The panel's "healthy" must mean the suite stays green.
10. **Performance**: instance nature and props, build the island and its height field once, and show the `map-budget` numbers live in the painter so David sees the cost of size as he paints.

## Evidence
Painter screenshots of each new tool and the object layer; frame diff of today's island loaded from the file vs the code-built one (≈0); a quick bigger draft (e.g. 96×96) walked in `/lab/island?draft=1`; budget numbers for 64/96/128.

Row 156 ("the old 256×256 draft and /lab/map drawing are not the target") is superseded by rows 241 and 246.
