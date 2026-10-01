# Island painter: David paints the real village (rows 241, 246, 247)

> **David, 2026-09-28: "dont make the island ill make it".** Agents build the tool and the loader only. No agent authors, paints or rearranges any island layout; today's island is exported unchanged as the baseline until David's own design replaces it.

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
4. **Organic tools:** smooth, grow and shrink brushes; a noise/jitter brush for coastlines; lasso fill. Existing tools stay. No auto-generated coastlines or layouts (row 247).
5. **Object layer** (reuse `lib/homes/catalogue.ts`, `lib/homes/layout.ts` and `home/PlacementLayer.tsx` patterns): every object has a stable id, kind/model, position, rotation and scale where it makes sense. Kinds: the landmarks (HQ, shop, oracle, café, museum, fitting room, mission board, notice/catch boards, monument, mailbox), wharf, bridges, trees/bushes/flowers (with seed), rocks, benches (their seats), lamps, fences, study tables, resident anchors (keep the existing keys; saved schedules reference them), named spawns and door/prompt points, puddles, bug/firefly anchors. Place, move, rotate, delete; footprint overlap warnings. ACNH grid law still holds (buildings on integer cells with a 1-tile gap, cliffs 1.5u, ramps).
6. **The game reads everything from the file**: landmarks, nature, props, wharf deck and pier, bridge, study tables, resident anchors, spawns, doors and prompts, quest markers, forage and bug nodes, puddles, collision. Tests pinned to today's coordinates read from the file.
7. **Size-dependent systems follow the map's bounds**: shadow extent and target, cloud plane, fog and far plane, overview camera, minimap viewBox and clip, glint radius and density, beach ring from shore cells.
8. **Walk the draft before exporting**: `/lab/island?draft=1` loads the painter's current draft so David can walk it in 3D. Export stays clipboard JSON (no disk write path, by design); the coordinator commits David's export.
9. **Health panel = tests**: add the flat-share rule, landmarks on dry land, approachable and reachable from spawn, and a fishable sea. The panel's "healthy" must mean the suite stays green.
10. **Performance**: instance nature and props, build the island and its height field once, and show the `map-budget` numbers live in the painter so David sees the cost of size as he paints.

## Evidence
Painter screenshots of each new tool and the object layer; frame diff of today's island loaded from the file vs the code-built one (≈0); walk-the-draft shown with today's island or a tiny synthetic fixture (no designed layout); budget numbers for 64/96/128.

Row 156 ("the old 256×256 draft and /lab/map drawing are not the target") is superseded by rows 241 and 246.

## Natural terrain (rows 262, 263; specs/terrain-blending.md)
What the painter draws and what its brushes make, since 2026-09-30. Cells and levels are still all it writes; the game derives everything natural from them, and the painter shows that same derivation.

- **The preview is the game's terrain.** The map is drawn from `terrainOf` (lib/game/grid.ts): the organic coast, sand and soil fading into grass over worn edges, stone/wood/brick with crisp rounded borders, the wet band on the beach, stony ground where it is steep, and hill shading off the height field (the orange half-step lines are gone; slopes show as shading). Cliff edges stay as dark lines, missing kit pieces as red cells. One pixel per lattice sample (4 per cell). Edits mark the cells they touched and a repaint re-derives and redraws only those (`refreshTerrain`); a 256×256 map paints at 16–33 ms a frame (specs/evidence/terrain/painter-timing.txt).
- **grow / shrink** threshold a Gaussian blur of the stroke's snapshot, so an edge moves by its curvature: a straight coast or plateau edge a cell per stroke, a corner less, a notch more. Repeated strokes round off (no diamonds). Small islets grow too (the threshold is relative to the local peak).
- **smooth** keeps what half the blur has: notches fill, spikes and stray cells go, straight and 45° coasts stay where they are.
- **slope** builds a hill: the brush rises a level per stroke and the ground around it follows at a level per 2.5 cells, down to sea level at the coast; every step is one level, so it is walkable and never a kit cliff. Alt digs instead. Drag for a ridge.
- **cliff** stands the brush one kit cliff (2 levels) above where the stroke began, flat on top. Alt cuts one down. Cross it with ramps; "faces too tall" in health and the legalise button cover a tier painted over lower ground.
- **land / sea** with a round brush are soft: the dab adds a soft disc to the land around it, so it melts into a nearby coast instead of leaving a seam. Rect, line, fill and lasso still paint exact cells.
- `/lab/map?fixture=terrain` opens the synthetic test island (lib/game/fixtures/terrainFixture.ts: a cliff ring with a ramp, a steep mountain and a gentle hill, a beach, paths, a bay and a point) for trying the brushes; `/lab/island?fixture=terrain` walks it. Neither is ever the shipped island.
