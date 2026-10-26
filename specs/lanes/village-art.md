# Lane: village-art (the plaza, path, lamps and nature assets from David's references)

Worktree `.claude/worktrees/village-art`, branch `game/village-art`. Agent type `uwotsi-lane`, cut from `game/terrain-art` at ec364e38 (the first batch of new-world assets: wharf kit, palms, lamps, campfire set, forest masses; `specs/lanes/terrain-art.md` is the pattern to follow).

**David's references and notes (2026-10-26):** `specs/references/terrain/r2-2026-10-26/README.md` (his words verbatim and the reading) and the images beside it. Commit that folder with your first batch.

**Read first:** that README; `specs/lanes/terrain-art.md` (how the last lane built, registered and previewed its assets); the builders in `art/props/` (`propkit.py`, `paintkit.py`), `art/trees/`, `art/wharf/` and `art/nature/`; `web/lib/game/propModels.ts` (`SCENERY_URLS`, `NEW_LAMPS`), `defaultIsland.ts` (`PROP_FOOTPRINT`, `PROP_TOP`), `modelMaterials.ts`, `components/game/AmbientProps.tsx` (`Lanterns`), `lib/game/perf/glbStats.ts` and `budget.ts`.

**Art direction:** the references set the look; build it in our style: simpler, smoother, cartoony, subtle painted textures, low detail, performance first (low triangles, few materials, instanced repeats). David supplies every reference: never fetch art, textures or references, and never use asset libraries or generators. Search `web/public/assets/` first and reuse what already fits; only build what is missing.

**The default village is the launch fallback and stays unchanged:** new files and names only; don't overwrite a model the village draws.

**For each asset:** the builder at `art/<folder>/build_*.py`, the GLB under `web/public/assets/game/<folder>/`, a preview in `specs/evidence/village-art/`, registered in `SCENERY_URLS` (glowing ones in `NEW_LAMPS`, drawn by `Lanterns`) with footprints and tops where solid, a budget row if it needs one, and the propModels, modelMaterials and budget tests green.

**Reporting:** one batch per commit. After each, SendMessage "main" with the commit, each asset's name, triangles, size, preview path and any placement notes for terrain-v3, then go straight on. At the end update Status here, SendMessage "main" with the full list, and stop. Questions: one line each with your default in `specs/launch/terrain-v3-questions.md` under your lane's name; carry on with the default.

## Status

Done, head after this file's commit (batches aeab21e2, c0a0de5c, d1b3a1c3, 7780d908). Not yet reviewed by David. Everything is registered (`NEW_LAMPS` or `SCENERY_URLS`, footprints and tops in `defaultIsland`), in game units at scale 1, with previews in `specs/evidence/village-art/`. Gates: propModels, modelMaterials, budget, defaultIsland and natureLod tests green; eslint clean on the changed TS.

1. **Lamps** (`art/props/build_path_lamps.py`, `path-lamps.webp` with a night frame): `wood-post-lamp` (674 tris, light (0.8, 1.886, 0)), `branch-post-lamp` (1370, light (0.5, 1.731, 0)), `hand-lantern` (236, light (0, 0.143, 0), ring top `HAND_LANTERN_RING` 0.542), as `NEW_LAMPS.woodPost`, `.branchPost`, `.hand`. `lantern-post` is left as it is (`NEW_LAMPS.wharf`).
2. **Plaza** (`art/props/build_plaza_set.py`, `plaza-set.webp`, `plaza-pieces.webp`): `plaza-fountain` (2928 tris, 9.6 across, water is P_Glass in COLOR_0 rings, static), `bunting-string`, `banner-pole`, `flag-pole`, `wall-banner`, `fruit-stall`, `fruit-barrel`, `fruit-crate`, `flower-planter`, `flower-pot`, `round-planter`, `planter-bench`, `market-sign`. All plain colour on the P_* presets.
3. **Path and nature** (`art/props/build_path_edge.py`, `art/terrain/build_path_dirt.py`, `build_flowers.py` meadow and tallgrass; `path-edge.webp`, `path-dirt.webp`): `path-rock-slab`, `-low`, `-cluster`, `rustic-fence-a`, `-b`, `rustic-post`, `flower-meadow`, `flower-tallgrass`, and `game/terrain/path-albedo.png` (512, sRGB, drawn untinted with soil-normal; terrain-v3 hooks it in `groundTextures.ts` as a "path" texture).
4. **Forest masses remodelled** (`art/trees/build_forest_masses.py`, `forest-masses.webp`; David R2b: "the trees are all the same exact copy paste model"): the same file names a, b, c replaced, plus new d (kidney) and e (big). Every tree its own (cedar, fir, broadleaf, young, snag; height, spread, tiers, lean, shade), loose cluster in an irregular outline, 1700 to 3050 tris each, under the forest-mass budget row (unchanged). Trunks and a floor plug run 2.2 below the origin: set a mass at the lowest ground under its footprint.

## Next

Nothing left; wait for David's review notes. The list as given, all done: 1 lamps and lanterns; 2 the plaza (fountain, flags and banners, fruit stall and crates, planters, a sign board and a planter bench); 3 the path and nature (side rocks, loose fence, path dirt texture, meadow flowers and tall grass); 4 (added by the coordinator from David's R2b review) remodel the forest masses so the trees grow differently and sink into slopes.

## Tools and gotchas

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script> [-- args]` under `LANE=game/village-art /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`. Never open the Blender app, and never use the `blender` MCP tools: they drive David's visible Blender.
- **Locks:** `withlock.sh heavy <cmd>` for vitest and tsc. If swap is over 9 GB, wait before taking the Blender lock.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **node_modules:** cloned (`cp -c -R`).
- **propModels.ts:** another art lane appends to the same tables. Add your entries in one block with a comment line naming your lane, so merges stay simple.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees. Don't edit `generate.ts` or `web/data/world/` (placement is terrain-v3's job).
- **Reviews:** each props builder takes `-- review <dir>`; `build_plaza_set.py` and `build_path_edge.py` also take model names to rebuild only those. Plants: `build_flowers.py -- meadow tallgrass` and `build_forest_masses.py -- a b ...` run finish-greenery themselves.
- **propModels test:** the scenery footprint check (`/^(wharf-|rope-|firewood|fish)/`) asserts the model fits inside its footprint, so don't add pieces that overhang their solid box (awnings, round basins) to it.
