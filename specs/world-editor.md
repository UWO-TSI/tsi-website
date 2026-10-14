# World editor: smooth terrain, edited in 3D (row 308)

Decided with David on 2026-10-14, after he walked the terrain v2 world and said it looks bad: "terrain is not natural, mountains have holes, land is jagged and depth is not natural, I want a minecraft esque terrain editor for the map development."

## Decisions

1. **Edit in 3D, over the real game render.** What David sees while editing is what ships. An overhead view toggles on for layout.
2. **Minecraft creative-mode controls**:
   - Fly anywhere: WASD, Space up, Shift down, mouse look under pointer lock.
   - Aim a crosshair at the ground. Left-click lowers or removes; right-click raises or places.
   - Number keys 1 to 9 pick from a hotbar of tools and objects. Scroll sets the brush size; Shift plus scroll sets the strength.
   - The land itself stays smooth. It is not voxel blocks.
3. **Smooth sculpted terrain.** A heightfield replaces the grid of level steps.
   - Brushes: raise, lower, smooth, flatten, and level to a sampled height. All have a soft falloff.
   - Steep slopes turn to rock on their own. There are no stacked boxes or slab walls.
4. **Fix what David saw**:
   - no holes in mountains;
   - no jagged, stair-stepped land edges;
   - natural depth: hills fall off naturally, and the shore shelves gently into the water.
5. **Start by converting the current v2 world** (`web/data/world-map.json`, 384 × 552 cells, 1 u tiles, level step 0.75):
   - Keep the coast, rivers, village layout, building spots, annotations and objects. The v1 proposals (barriers, campfire, rocks) carry over.
   - Smooth it, then David sculpts from there.
6. **Ownership.** This coordinator session owns the editor, `/lab/map` and the world map files from now on. The painter session on David's other device stops; David stops it there.
7. **Timeline.**
   - v1 launches Oct 31 on the current village, which is finished and fast.
   - The new world follows in November. The Oct 24 checkpoint no longer gates launch on the new world.
8. **Look later.**
   - The editor ships with plain placeholder materials (grass, sand, dirt path, rock).
   - The look pass comes after, from references and texture packs David supplies. Never source references ourselves.
9. **The coast at the wharf vs at beaches** (David, 2026-10-14).
   - **At the wharf** the land stands higher than the water: a raised bank or quay edge, so the dock and pier make sense and boats moor alongside. The jetty deck sits at that bank height over water deep enough for boats. No sloping beach under the pier.
   - **At beaches** the land meets the water at sea level and eases in: a gentle shelf from dry sand into shallows.
   - Built into the conversion: the wharf zone (the `wharf` landmark, its jetty, finger pier and moorings, plus a radius) gets the bank and a short steep drop to deep water; every other sand coast keeps the gentle shelf. In the editor, flatten and level (with the hard edge) make it easy to raise a bank like that; paint can mark it as stone, or a timber edge later.
10. **Minecraft creative mode, cells and brushes, buildings and roads** (David, 2026-10-14: "I want the minecraft creative mode esque editor so i can increase each cell or brush mode i can increase height and place buildings and lay down road and stuff").
    - **Two terrain modes**, toggled with B and shown on the HUD.
      - **Cell mode** snaps to the 1 u grid. Left-click lowers and right-click raises the targeted cell (or an N × N square, with scroll for N) by one step, like breaking and placing blocks. Hold and drag to keep going. The step is configurable, defaulting to the old 0.75 level step. The raised square has a slight edge rounding, so the result isn't jagged slabs. A cell reads as the samples it covers.
      - **Brush mode** is the soft round raise, lower, smooth, flatten and level.
    - **Buildings** sit in the hotbar palette: the museum, HQ, shop, café, Oracle temple, houses and the other existing building models. Placing one shows a ghost with its footprint; a click places it, R rotates it, and it flattens its own pad. Placed buildings can be selected, moved, rotated and deleted.
    - **Roads:** a road tool you drag, or click point to point. It paints the path surface at a set width and grades the ground under it smoothly, with no steps and gentle ramps on slopes. Bridges stay objects for now.
    - **Hotbar:** Minecraft-like, slots 1–9 plus a palette (E opens it, as the creative inventory does) to choose what goes in each slot.

## v0: a usable editor (one lane)

1. **Terrain data.**
   - A heightfield (float heights per vertex) plus a surface paint map (grass, sand, path, rock, at least) and the object list.
   - Storage that round-trips losslessly and commits sanely: for example, a 16-bit PNG heightmap, an 8-bit surface PNG and JSON. Document the format.
   - A loader that the game, the editor and the tests all share.
2. **Conversion.** A script turns `world-map.json` into the heightfield format: smooth the level steps, keep cliffs that read as cliffs only where they're meant to be, and shelve the coast under water. Keep the old file until David accepts the new one.
3. **Renderer.**
   - Chunked heightfield mesh with smooth normals and LOD.
   - Rock blended on by slope; surface paint splatted.
   - Water at sea level, with the water lane's depth colour reading the real seabed.
   - No gaps between chunks or LODs.
   - It replaces GridTerrain, GridCliffs and the cliff blocks for this world only. Every other world (village, applicant island, ruins, home) renders exactly as on main.
4. **Gameplay on the heightfield.**
   - The walker samples height smoothly, and slopes too steep block walking.
   - Buildings get flat pads.
   - Every object sits on the surface. Barriers, grass `clear` lists, the campfire and resident routes keep working.
5. **Editor at `/lab/world`** (dev only; 404 in production):
   - the fly camera and crosshair, with a brush ring drawn on the ground;
   - the hotbar tools: raise, lower, smooth, flatten, level (sample a height with middle-click or Alt), paint surface, place object (a palette of the existing object kinds and models), and select, move, rotate, scale and delete objects;
   - undo and redo (Ctrl+Z, Ctrl+Shift+Z);
   - the overhead toggle;
   - save, which writes the files through a dev-only API route;
   - "walk it", which drops into play at the camera.
   - `/lab/map` either links to it or retires. Keep `/lab/map` working for the village until the new editor covers the village too.
6. **Performance.**
   - The new world must stay within its SCENE_BUDGET on High and Lite. Price the terrain in `specs/perf/effects-cost.md`.
   - The editor itself has no budget beyond staying smooth while brushing on the Mac mini.
7. **Evidence.** Before and after shots at the spawn, the plaza, the mountain and the coast. Show the holes and jagged edges gone and a brush stroke in progress.

## Data format (built 2026-10-14, `game/world-editor`)

Three files in `web/data/world/`. One loader reads them for the game, the editor, the dev save route, the conversion script and the tests: `decodeWorld` / `encodeWorld` in `web/lib/game/world/format.ts` (the browser fetches the images in `world/load.ts`; Node reads them in `world/disk.ts`). The old `web/data/world-map.json` stays until David accepts the new world.

| File | What it holds |
|---|---|
| `world.json` | The document: `format: "tethos-world"`, `version: 1`; the grid (`width` × `depth` cells of 1 u, `originX`/`originZ` the centre of cell (0, 0), as in `world-map.json`); `resolution` (samples per unit, 2); `heightRange` (the heightmap's 0 and 65535 in world units, `[-12, 36]`); `seaLevel` (the still water, −0.078, where the old sea and rivers sat); `surfaces` (the paint names by id); the two image file names; then `annotations` and `objects`, one per line, in the village file's object vocabulary (`lib/game/villageMap.ts`). |
| `height.png` | 16-bit greyscale, (width·2 + 1) × (depth·2 + 1) samples, a sample every half unit, row 0 at the low z edge, sample (0, 0) on the map's outer corner (originX − 0.5, originZ − 0.5). Value q is the height `heightRange[0] + q·(heightRange[1] − heightRange[0])/65535`: a step of 0.73 mm. |
| `surface.png` | 8-bit indexed, the same grid: each pixel a paint id (0 grass, 1 sand, 2 path, 3 rock, 4 stone; append only). The palette is only how it previews, so the file reads as a colour map in a diff viewer. |

- **Lossless.** Heights are quantised to the 16-bit step on save and read back to exactly the value they stand for, so load → save is byte-identical and save → load → save is stable (`format.test.ts`, and `world.test.ts` on the committed files). The PNG writer is deterministic (per-row minimum-sum filter, zlib level 9), so an unchanged save leaves git clean.
- **Commits sanely.** About 290 KB of heights, 7 KB of paint and 215 KB of JSON (most of it the annotations' cell lists) for the 384 × 552 world. Both images preview in a diff viewer.
- **The ground is the mesh's.** Each quad of samples is two triangles split from its (i, k) corner to its (i + 1, k + 1) corner. `terrainHeight` interpolates on those same triangles, so walking, placement and the drawn surface agree exactly at full detail (`world/terrain.ts`).
- **The old systems' view.** Fishing water, forage and bug nodes, the glide guide and the campfire's sand still read cells. `cellMapOf` derives a cell map: water where a cell's centre is under the sea, a level of `round(h / 0.75)`, a surface from the paint. Walking and drawing never read it. The water (its colour, the seabed props, the fish) reads the real seabed (`seabed.ts setWaterSource`).

## Conversion (built 2026-10-14)

`cd web && npx vite-node -c vitest.config.ts scripts/convert-world.ts` turns `web/data/world-map.json` into `web/data/world/` in about 3 s (`lib/game/world/convert.ts`). Running it again overwrites David's sculpting, so it is only for a fresh start.

- **Coast, rivers, bays, islets:** the grid's own organic coast (`shoreSdf`). Every old sea-level water cell centre stays under the sea and every land cell centre stays dry (tested on all 212k cells).
- **Heights:** the level map as a stack of tiers. Each tier's outline is rounded in plan, every cell centre held on its own side so one-cell trail steps survive. It rises 0.75 u over ±1.6 u where the old map had a one-level step (a walkable slope, under 0.8 grade) and over ±0.35 u where it had a kit cliff (a rock face). Where several tiers stacked into one wall, the face leans back to grade 3 at most. Steep ground ends up only where the old map drew cliffs (tested: under 2% strays more than 4 cells from an old kit cliff).
- **Naturalize pass** (coordinator, 2026-10-14, after the first mountain shots still read as long, straight, flat-topped walls). This applies to the cliff bands only; slopes stay as they are. Each band's outline wanders up to about ±3 u along its length (two octaves of low-frequency noise), each face's steepness varies ±55% (never down to walkable), every cliff step rounds over at its top and foot, and steep ground gets rock relief (±0.16 u). The layout and the band heights stay. The editor's roughen and erode brushes do the same by hand.
- **Coast profile:** land meets the sea exactly on the shoreline. A beach shelves at 0.12 grade, a grass bank at 0.35, a cliff coast at 2.5. Under water the seabed shelves gently (0.45 deep two units out, where the old bed was 1.2) down to the open sea's floor at 4.2.
- **Paint:** the grid's organic overlays (paths, beach, plaza stone), sand under water. Rock comes from slope in the renderer.
- **Pads:** every building with a footprint stands on ground levelled to its centre over the footprint plus a cell, easing back over 2.5 u.
- **Objects and annotations** are copied unchanged. The proposals stay in `web/data/proposals/`; the editor shows them for David to accept.
- **Elevated water** (the peak waterfall): water is at sea level in v0. The fall's channel (26 cells) is rock, and its level-1 pond (81 cells) is a sea-level pond.

## Renderer and gameplay (built 2026-10-14)

- **Gate.** `GridWorld` draws the heightfield only for a village with `terrain` (`lib/game/world/village.ts villageOfWorld`), which only the editor's files produce. `/lab/island?fixture=v2` loads them (`?fixture=v2-cells` is the old cell draft). Every other world stays on the cell path, unchanged (`components/game/grid/groundGate.test.ts`).
- **Ground.** Chunks of 32 × 32 cells, each at one of four levels of detail by camera distance (every 1st, 2nd, 4th or 8th sample; hand-overs at 56, 112 and 224 u with 8 u of hysteresis). Normals come from the full-detail ground. Skirts hang twice each edge's worst level-of-detail error below it, so no level pairing leaves a gap (`world/mesh.test.ts`, every pair). Chunks are culled for the curved world. A chunk lying entirely at the open sea's floor is not drawn.
- **Material.** One placeholder splat (`components/game/world/splatMaterial.ts`): grass (the season's colour), sand, path, rock and stone from the paint map, read as a 2 × 2 box so outlines curve, with a noisy worn edge. Rock comes in by slope from 0.6 grade and is solid by 1.0, the walking limit. Sand and grass darken just above the sea (the wet band). The seabed fogs into the water's colour by its real depth.
- **Water.** A quad per cell at sea level wherever the ground dips under it, in blocks of 128 cells. Its colour reads a shore field baked from the heights (distance to the drawn shoreline, the seabed's real depth). The seabed props and the fish read the same seabed.
- **Grass.** The blade field grows where the paint is grass, never on steep rock or under the sea, and stays clear of solids (`terrainGrassSampler`).
- **Walking.** The walker stands on the mesh's own triangles and walks the jetty at its deck height. A step up onto ground steeper than 45° (`MAX_CLIMB`) is refused for the player and for residents' paths, and no jump starts on steep ground, so cliffs can't be hopped. The movement sim gained two optional world queries (`climb`, `steep`) that only the smooth world answers. Buildings stand on flat pads. Objects, barriers, the campfire and residents' stops stand on the surface (`world/walk.test.ts`).
- **Houses.** A new object kind, `house` (the chalet in brown, red or yellow), drawn by the game and solid like a building. It appears only where a map places one.

## Editor (built 2026-10-14): `/lab/world`

Dev only (404 in production). It loads and saves `web/data/world/` through `/api/lab/world`, which decodes a save in full before writing anything. The view is the game's own terrain, water, grass, buildings, nature and props. The world is drawn flat (no curved-world bend) so the crosshair and the overhead view are exact; `/lab/island?fixture=v2` shows it bent.

| Control | Does |
|---|---|
| Click the view | Fly (pointer lock); Esc lets go |
| WASD, Space, Shift, hold Q | Fly; up; down; faster (not Ctrl: Ctrl+W closes the tab) |
| Left click (hold) | Lower, dig, cut, paint grass, remove an object, end a road |
| Right click (hold) | Raise, fill, paint, place, lay a road point (or drag one), drag the selection |
| 1–9 | Hotbar slot |
| E | Palette: choose what the slot holds (terrain tools, paints, roads, buildings and houses, nature, props, markers, select) |
| B | Cell mode ⇄ brush mode (on the HUD) |
| Scroll | Brush size; in cell mode, the N × N square |
| Shift + scroll | Strength; in cell mode, the step (0.75 by default) |
| H | Hard edge ⇄ soft (a bank, a quay) |
| Alt + click, middle click | Sample the height the level tool uses |
| R, Shift + R | Turn the placement ghost or the selection by 15° |
| + / − | Scale the selection |
| Delete, Backspace, X | Delete the selection |
| Ctrl+Z, Ctrl+Shift+Z (Ctrl+Y) | Undo, redo (a stroke at a time, 200 deep) |
| O, Tab | Overhead view (WASD pans, Space and Shift change the height) |
| Ctrl+S | Save to `web/data/world/` |
| P | Walk it: the game, at the camera, with what is on screen (saved or not) |
| ? | The controls |

- **Brush mode:** raise, lower, smooth, flatten (to the height where the stroke began), level (to a sampled height), roughen (small natural noise) and erode (softens edges, pulls material downslope). Each has a soft or hard edge. Flatten and level cut with the left button and fill with the right.
- **Cell mode:** raise, lower, flatten and level act on whole cells. A press sets the N × N square a step up or down onto the step grid, holding steps again every 0.35 s, and dragging carries that level on. Squares get a rounded lip, and squares at one level side by side merge flat. Paint in cell mode paints whole cells.
- **Buildings** (HQ, shop, café, museum, Oracle temple, monument, the boards, the mailbox and three house colours): a ghost shows the model and its footprint, snapped so the footprint's edges sit on cell edges. A placed or moved building flattens its pad. A landmark already on the map moves rather than duplicating.
- **Roads:** right-click point to point, or drag. The road paints the path (or stone) 2.4 u wide and grades the ground under it to a smooth profile, level across and no steeper than 0.18, easing into the land over a 1.6 u shoulder.
- **Proposals:** pending ones (`web/data/proposals/`) are listed with Accept (undoable).
- **Cost while brushing:** only the touched chunks are rewritten in place, along with the paint rows and the water blocks. The shore field is re-baked for the stroke's region when it ends, and the grass refills four times a second. A radius-20 brush costs about 3 ms a frame on the Mac mini (stroke and chunk rewrite together).

## Open questions for David (ask as they come up; don't block on them)

- The island size: keep 384 × 552, or let him resize it in the editor.
- Whether the village (default island) later moves to the same editor and format.
- The surface paint list beyond grass, sand, path and rock (flowers, snow, mud).
