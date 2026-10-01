# Natural terrain within the grid (rows 262, 263)

David (2026-09-30): "develop terrain toolbrush, so theres land drawing logic, and it doesnt look chunky and looks like steps, instead the inciment in width or length naturally smoothes out like a natural island, same thing with terrain path blending, beach sand blending, also in height, what does cliffs look like and what does natural mountain slopes look like. so within the bounds of the blocked terrain structure develop natural looking terrain blending logic." He then picked: **cliffs + natural slopes**, a **strongly organic** coast, a **sloping beach with wet sand**, and **soft natural path edges**.

Cells and levels stay the data model (the painter writes cells; the game loads `web/data/village-map.json`). Everything natural is derived from them, consistently for the mesh, walking, the shore field, fishing and the health checks. Agents build tools and rendering only; David paints the island (row 247).

## Why it looks blocky today (survey 2026-09-30)
1. The coast outline is a 3×3 per-cell rule (`easedCellOutline`, `grid.ts:1368`): bays stay square, off-45° edges step, no larger-scale contour.
2. Every ground normal is straight up (`GridTerrain.tsx:169`), so slopes light as flat.
3. The beach is a flat sheet 0.078u above the water: no slope in, no wet band, no fringe; the parallel sand ring repeats the steps.
4. Surface blends follow the stepped outline: a 0.3-tile inward fade with no noise; stone/wood/brick hard-edged; the road kit unused; tufts ignore edges.
5. Brushes are binary per cell (4-neighbour grow/shrink make diamonds) and the 2D preview shows squares.
6. Height has no slope class: health caps and a fixed blur make hills read as terraces or cliffs.

## Deliverable
1. **Strongly organic coast.** A smooth contour derived from the land mask at sub-cell resolution (for example a blurred mask and its iso-contour), with rounded bays and points, free to drift a cell or more from the painted squares where that reads more natural, but stable (small edits make small changes) and deterministic. One function feeds the grass mesh, the shore distance field, walking (`isGroundAtWorld`), fishing/water classification and `mapHealth`.
2. **Sloping beach + wet sand.** Sand next to the sea slopes down under the waterline over about a cell or two (from the shore distance), with a darker wet band where the waves reach and the foam on the slope; grass meets sand with an uneven natural edge (noise), no parallel stair lines.
3. **Soft natural path edges.** Soil and sand paths fade into grass with a worn, uneven edge (noise in the blend weights, optionally a few edge pebbles or grass tufts concentrated along edges); stone, brick and wood get crisp but rounded borders that follow the smoothed outline. Consider one blend-weight texture per chunk over many transparent overlays if it is simpler and cheaper.
4. **Cliffs vs natural slopes.** Two height brushes in the painter: **Cliff** keeps the ACNH kit (2-level faces, grass lip; fix the kit grass to take the palette colour), crossed by ramps or the movement mantle; **Slope** builds gradual hills and mountains that rise over several cells, walkable, smooth (not terraced), with real normals from the height field and rockier ground where steep. Decide the minimal data rule (e.g. 1-level steps between neighbours are slope and blend wide, 2+ are cliffs) and only add a per-cell flag if a rule cannot express it. Loosen the health rules for hills (update `mapHealth.ts` and its tests together, keep "health = tests").
5. **Brushes that produce natural shapes.** Euclidean grow/shrink (round, no diamonds), a blur-and-threshold smooth brush, the Slope and Cliff brushes, soft-edged land/sea painting; the painter's 2D preview draws the same derived contour, blends and height shading the game uses (so David sees the natural result while painting), and stays fast on a 256×256 map.
6. **Movement and gameplay stay consistent:** the movement sim's `{ top, wet }` world, fishing spots, forage/bug nodes and the object layer's dry-land checks all use the new contour and heights.
7. **Docs:** update CLAUDE.md's grid-law section (rules 1b/3b) to describe slopes and the organic coast, and `specs/island-painter.md`.

## Evidence
Before/after of today's island (same cameras); a synthetic test map (a fixture, never shipped in `web/data/`) showing a cliff ring, a natural hill/mountain, a sloping beach with wet sand, soil and stone paths, a bay and a point; the painter showing the natural preview while painting; FPS and budget numbers unchanged within reason.
