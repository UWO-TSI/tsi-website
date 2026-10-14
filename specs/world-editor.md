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

## Open questions for David (ask as they come up; don't block on them)

- The island size: keep 384 × 552, or let him resize it in the editor.
- Whether the village (default island) later moves to the same editor and format.
- The surface paint list beyond grass, sand, path and rock (flowers, snow, mud).
