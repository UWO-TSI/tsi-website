# Lane: village-art (the plaza, path, lamps and nature assets from David's references)

Worktree `.claude/worktrees/village-art`, branch `game/village-art`. Agent type `uwotsi-lane`, cut from `game/terrain-art` at ec364e38 (the first batch of new-world assets: wharf kit, palms, lamps, campfire set, forest masses; `specs/lanes/terrain-art.md` is the pattern to follow).

**David's references and notes (2026-10-26):** `specs/references/terrain/r2-2026-10-26/README.md` (his words verbatim and the reading) and the images beside it. Commit that folder with your first batch.

**Read first:** that README; `specs/lanes/terrain-art.md` (how the last lane built, registered and previewed its assets); the builders in `art/props/` (`propkit.py`, `paintkit.py`), `art/trees/`, `art/wharf/` and `art/nature/`; `web/lib/game/propModels.ts` (`SCENERY_URLS`, `NEW_LAMPS`), `defaultIsland.ts` (`PROP_FOOTPRINT`, `PROP_TOP`), `modelMaterials.ts`, `components/game/AmbientProps.tsx` (`Lanterns`), `lib/game/perf/glbStats.ts` and `budget.ts`.

**Art direction:** the references set the look; build it in our style: simpler, smoother, cartoony, subtle painted textures, low detail, performance first (low triangles, few materials, instanced repeats). David supplies every reference: never fetch art, textures or references, and never use asset libraries or generators. Search `web/public/assets/` first and reuse what already fits; only build what is missing.

**The default village is the launch fallback and stays unchanged:** new files and names only; don't overwrite a model the village draws.

**For each asset:** the builder at `art/<folder>/build_*.py`, the GLB under `web/public/assets/game/<folder>/`, a preview in `specs/evidence/village-art/`, registered in `SCENERY_URLS` (glowing ones in `NEW_LAMPS`, drawn by `Lanterns`) with footprints and tops where solid, a budget row if it needs one, and the propModels, modelMaterials and budget tests green.

**Reporting:** one batch per commit. After each, SendMessage "main" with the commit, each asset's name, triangles, size, preview path and any placement notes for terrain-v3, then go straight on. At the end update Status here, SendMessage "main" with the full list, and stop. Questions: one line each with your default in `specs/launch/terrain-v3-questions.md` under your lane's name; carry on with the default.

## Status

Not started.

## Next

1. **Lamps and lanterns** (`lamp-wood-post.jpg`, `lamp-branch-post.jpg`, `lantern.jpg`): a wooden post lamp with an angled brace and an iron collar; a branch post with a rope lashing on a small stone plinth; and a hand lantern (the iron lantern, warm glass) that stands on the ground or hangs from a hook, for the path and the dock. All glow (`NEW_LAMPS`, the `M_Glass`/`M_Iron` naming). Warm light, lovely at night. Rework `lantern-post` toward the first if that is simpler than a new one.
2. **The plaza** (`plaza-fountain.jpg`, `plaza-vibe.jpg`):
   - a water fountain for the plaza's middle: a round basin with a tiered centre, as wide as the plaza can hold (the plaza's radius is about 12 u). Say how the water should draw (reuse the game's water look if there is one for small pools);
   - flags, banners and bunting strings, to hang between posts and buildings;
   - a fruit stall, fruit barrels and fruit crates; flower planters and pots;
   - one or two more lively pieces of your choice in the same spirit (a sign board, a bench with a planter).
3. **The path and nature** (`path.jpg`, `nature-feel.jpg`):
   - natural side rocks for the path's edges (two or three shapes, mossy);
   - a loose rustic fence: posts and rails with gaps, leaning a little, in short runs (check `fence-post` and `fence-rail` first);
   - a yellowish dirt texture for the path, painted for the terrain (say where terrain-v3 should hook it);
   - check the existing bushes, flowers and trees in `web/public/assets/game/plants/` and `web/public/assets/nature/`, and only add what's missing for a lush `nature-feel` look (for example grass tufts or small wild-flower clumps).

## Tools and gotchas

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script> [-- args]` under `LANE=game/village-art /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`. Never open the Blender app, and never use the `blender` MCP tools: they drive David's visible Blender.
- **Locks:** `withlock.sh heavy <cmd>` for vitest and tsc. If swap is over 9 GB, wait before taking the Blender lock.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **node_modules:** cloned (`cp -c -R`).
- **propModels.ts:** another art lane appends to the same tables. Add your entries in one block with a comment line naming your lane, so merges stay simple.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees. Don't edit `generate.ts` or `web/data/world/` (placement is terrain-v3's job).
