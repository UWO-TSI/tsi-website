# Lane: wharf-art (the wharf and beach assets from David's references)

Worktree `.claude/worktrees/wharf-art`, branch `game/wharf-art`. Agent type `uwotsi-lane`, cut from `game/terrain-art` at ec364e38 (the first batch of new-world assets: wharf kit, palms, lamps, campfire set, forest masses; `specs/lanes/terrain-art.md` is the pattern to follow).

**David's references and notes (2026-10-26):** `specs/references/terrain/r2-2026-10-26/README.md` (his words verbatim and the reading) and the images beside it. Commit that folder with your first batch.

**Read first:** that README; `specs/lanes/terrain-art.md` (how the last lane built, registered and previewed its assets); the builders in `art/props/` (`propkit.py`, `paintkit.py`), `art/trees/`, `art/wharf/` and `art/nature/`; `web/lib/game/propModels.ts` (`SCENERY_URLS`, `NEW_LAMPS`), `defaultIsland.ts` (`PROP_FOOTPRINT`, `PROP_TOP`), `modelMaterials.ts`, `components/game/AmbientProps.tsx` (`Lanterns`), `lib/game/perf/glbStats.ts` and `budget.ts`.

**Art direction:** the references set the look; build it in our style: simpler, smoother, cartoony, subtle painted textures, low detail, performance first (low triangles, few materials, instanced repeats). David supplies every reference: never fetch art, textures or references, and never use asset libraries or generators. Search `web/public/assets/` first and reuse what already fits; only build what is missing.

**The default village is the launch fallback and stays unchanged:** new files and names only; don't overwrite a model the village draws.

**For each asset:** the builder at `art/<folder>/build_*.py`, the GLB under `web/public/assets/game/<folder>/`, a preview in `specs/evidence/wharf-art/`, registered in `SCENERY_URLS` (glowing ones in `NEW_LAMPS`, drawn by `Lanterns`) with footprints and tops where solid, a budget row if it needs one, and the propModels, modelMaterials and budget tests green.

**Reporting:** one batch per commit. After each, SendMessage "main" with the commit, each asset's name, triangles, size, preview path and any placement notes for terrain-v3, then go straight on. At the end update Status here, SendMessage "main" with the full list, and stop. Questions: one line each with your default in `specs/launch/terrain-v3-questions.md` under your lane's name; carry on with the default.

## Status

In progress. Previews in `specs/evidence/wharf-art/`.

1. **Palms, redone** (`art/trees/build_palms.py`, the frond texture repainted by `art/trees/paint_textures.py palm-fronds`): `palm-tall` (top 5.65), `palm-lean` (4.86), `palm-short` (3.32); two layers of broad fronds folded so their leaflets hang, coconuts in the gaps of the lower layer, a tapering softly ringed trunk. 1290 to 1560 tris with casters. Evidence `palms.webp`.

## Next

1. **Palms, redone** (`palm-shape.jpg` for the shape, `palm-style.jpg` for the style): broad, wide leaves in two layers, a cluster of coconuts under them, a tapering trunk with soft rings. Low detail. Replace the files of `palm-tall`, `palm-lean` and `palm-short` (only the new world uses them).
2. **The dock and wharf decor** (`dock-pillars-rope.jpg`, `dock-decor.jpg`, `dock-fish-hut.jpg`, `dock-walkways.jpg`):
   - pilings with rope lashings, round tops (a variant of `wharf-piling`, or new);
   - a rope net with floats hung between two posts;
   - a life ring, to hang on a post or lean;
   - a fishing net heap, and a net draped over crates;
   - a crate with a cloth over it, and a crate of fish on display;
   - a small hoist or crane post with a rope and hook.
   Hand lanterns come from the lane `village-art`; don't make them here.
3. **The beach** (David's note 6):
   - a sushi bar: a small beach bar exterior with a counter, stools, an awning or thatch, noren or lanterns. Nobody enters it in v1;
   - a lifeguard tower;
   - two or three surfboards that stand stuck in the sand;
   - coral: three or four low clumps for the shallow water.

## Tools and gotchas

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script> [-- args]` under `LANE=game/wharf-art /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`. Never open the Blender app, and never use the `blender` MCP tools: they drive David's visible Blender.
- **Locks:** `withlock.sh heavy <cmd>` for vitest and tsc. If swap is over 9 GB, wait before taking the Blender lock.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **node_modules:** cloned (`cp -c -R`).
- **propModels.ts:** another art lane appends to the same tables. Add your entries in one block with a comment line naming your lane, so merges stay simple.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees. Don't edit `generate.ts` or `web/data/world/` (placement is terrain-v3's job).
