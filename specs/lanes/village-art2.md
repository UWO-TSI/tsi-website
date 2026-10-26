# Lane: village-art2 (the village, path, river and forest assets from David's R2c notes)

Worktree `.claude/worktrees/village-art2`, branch `game/village-art2`. Agent type `uwotsi-lane`, cut from `game/terrain-v3` at c13ea8e7 (terrain R2c, with every new-world asset so far).

**Read first:**
- `specs/lanes/terrain-v3.md`, "2026-10-26: R2c review": David's notes verbatim and the reading. This lane does the items it names for you.
- `specs/lanes/wharf-art.md` and `specs/lanes/village-art.md`: how the last art lanes built, registered and previewed their assets. Follow the same pattern: the builders in `art/`, `propkit.py`, `paintkit.py`, `SCENERY_URLS`, `NEW_LAMPS`, `PROP_FOOTPRINT`/`PROP_TOP`, the budget rows.
- The references in `specs/references/terrain/` (`plan-2026-10-23/`, `r2-2026-10-26/`).

**Art direction:** David's words are "treat each asset properly" and "visually stunning". Use our style: cartoony, smooth, subtle painted textures, low detail where it doesn't show, performance first (few materials, instanced repeats). Organic shapes, never plain spheres or boxes. Search `web/public/assets/` first. David supplies every reference: never fetch art, textures or references, and never use asset libraries or generators. The default village is the launch fallback and stays unchanged: new files and names only, or replace files only the new world uses.

**Per asset:**
- a builder in `art/`;
- the GLB in `web/public/assets/game/`;
- a preview in `specs/evidence/village-art2/`;
- registered, with footprints where solid;
- the propModels, modelMaterials and budget tests green.

**Reporting:** one batch per commit. After each, SendMessage "main" with:
- the commit;
- each asset's name, triangles and size;
- the preview path;
- placement notes for terrain-v3.

Then go straight on. At the end, update Status here, send the full list, and stop. Questions go in `specs/launch/terrain-v3-questions.md` under your lane, one line each with your default.

## Status

Done, head after this file's commit (batches 89b6b805, 51a7601f, 996bbcb2, 756cba39, d20ac6a9, ad3aa13e). Not yet reviewed by David. Everything is in game units at scale 1, registered in `SCENERY_URLS` (footprints and tops in `defaultIsland` where solid), with previews in `specs/evidence/village-art2/`. Gates: propModels, modelMaterials and natureLod tests green; budget.test fails only on `game/props/plaza-tiles.glb` (and `game/wharf/jetty.glb` in the first runs), both already on the branch and not this lane's. eslint is clean on the changed TS.

1. **Stones** (`art/props/build_stones.py`, `stones.webp`): chiselled hulls with bevelled edges, layered slabs, moss on the faces that look up, P_Stone in colour. Replaced `path-rock-slab` (260 tris), `-low` (320), `-cluster` (368), and added `moss-boulder-a` (1144, solid) and `-b` (1506, solid). The old blob rocks are gone from `build_path_edge.py`.
2. **Shrubs** (`art/trees/build_shrubs.py`, `shrubs.webp`): `shrub-a` to `-f` in `game/plants/`, 314 to 1070 tris, lobes of leaf cards of varied density on the summer atlas plus twigs, not solid. New budget row "shrub".
3. **The TSI flag** (`build_plaza_set.py`, `tsi-flag.webp`): `flag-pole` and `banner-pole` rebuilt with the island flag's green, the white TSI mark (sharp rasterises `branding/tethos-mark.svg`) and gold hems on a 256 px linen. Same names and tops. Static, like the old flag.
4. **Brick road** (`art/terrain/build_road_brick.py`, `road-brick.webp`): `game/terrain/road-brick-albedo.png` (512) and `road-brick-normal.png` (256). Hook: like `pathTexture` in `splatMaterial.ts`, a tile of 2 u, one read (no turned second read), on the stone (A) weight or a new paint kind.
5. **River dressing** (`art/props/build_river_set.py`, `river-set.webp`): `reeds-a/b/c` (game/plants, new budget row "reeds"), `lily-pads-a/b` (game/water, float at y 0), `river-stones-a`, `river-stones-b` (solid), `driftwood-a/b`.
6. **Forest trees** (`art/trees/build_forest_trees.py`, `forest-trees.webp`): `forest-tree-cedar/fir/broadleaf/young`, 110 to 220 tris each, from the masses' own tree makers (`build_forest_masses.py`'s main is now guarded). The village `.lod1` trees are squat leaf-card trees near 1000 tris, too heavy and too short for a packed forest.

## Next

Nothing left; wait for David's review notes. The list as given, all done:

1. **Rocks, remodelled organic** ("remodel rocks to be more organic shape than just spheres, use blender, treat each asset properly"): irregular, faceted, layered stones in several sizes, mossy where they face up. Replace `path-rock-slab`, `path-rock-low` and `path-rock-cluster`, and add a couple of bigger boulders.
2. **Bushes, fluffy with varied density** ("the bushes are too dense and looks like a sphere from afar, i should feel more fluffy and density varies"): four to six bush variants, irregular, lumpy and leafy, some sparse and some full, different sizes, never a ball. New names, for the new world.
3. **The TSI flag:** the plaza's flags carry the TSI logo (`web/public/assets/branding/tethos-mark.svg`) on a cloth that waves if the current flag does. A banner version too.
4. **Brick road:** a brick paving texture for the roads from the plaza to the important buildings (tiling, painted, warm), and an edging if it helps. Say how terrain-v3 hooks it, the same way `path-albedo.png` is hooked in `splatMaterial.ts`.
5. **River dressing** ("it feels so barren and unnatural"): reeds and cattails, lily pads, river stones and driftwood.
6. **Forest trees:** terrain-v3 is moving the closed forest to many single instanced low-poly trees. Check the existing `.lod1` trees and cedars in `game/plants/`. If they aren't enough for a natural, busy forest, add three or four very low-poly trees: different shapes and heights, natural proportions, never stretched.

## Tools and gotchas

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script> [-- args]` under `village-art2=game/village-art2 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`. Never open the Blender app, and never use the `blender` MCP tools: they drive David's visible Blender.
- **Locks:** `withlock.sh heavy <cmd>` for vitest and tsc. If swap is over 9 GB, wait before taking the Blender lock. Other lanes are running (terrain-v3, perf-newworld and two more art lanes), so expect waits.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **node_modules:** cloned (`cp -c -R`).
- **propModels.ts:** other lanes append to the same tables. Add your entries in one block with a comment line naming your lane.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees.
- **Builders:** `build_stones.py`, `build_river_set.py` and `build_plaza_set.py` take model names to rebuild only those, and `review <dir>`. `build_shrubs.py` and `build_forest_trees.py` run finish-greenery themselves. `art/trees/preview.py -- <dir> <size> <glb>...` renders any GLB.
- **Bounds:** the GLB accessor min/max is what propModels.test measures for `PROP_TOP`; read it straight from the GLB's JSON rather than from Blender's bound_box.
