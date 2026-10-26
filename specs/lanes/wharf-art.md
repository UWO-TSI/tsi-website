# Lane: wharf-art (the wharf and beach assets from David's references)

Worktree `.claude/worktrees/wharf-art`, branch `game/wharf-art`. Agent type `uwotsi-lane`, cut from `game/terrain-art` at ec364e38 (the first batch of new-world assets: wharf kit, palms, lamps, campfire set, forest masses; `specs/lanes/terrain-art.md` is the pattern to follow).

**David's references and notes (2026-10-26):** `specs/references/terrain/r2-2026-10-26/README.md` (his words verbatim and the reading) and the images beside it. Commit that folder with your first batch.

**Read first:** that README; `specs/lanes/terrain-art.md` (how the last lane built, registered and previewed its assets); the builders in `art/props/` (`propkit.py`, `paintkit.py`), `art/trees/`, `art/wharf/` and `art/nature/`; `web/lib/game/propModels.ts` (`SCENERY_URLS`, `NEW_LAMPS`), `defaultIsland.ts` (`PROP_FOOTPRINT`, `PROP_TOP`), `modelMaterials.ts`, `components/game/AmbientProps.tsx` (`Lanterns`), `lib/game/perf/glbStats.ts` and `budget.ts`.

**Art direction:** the references set the look; build it in our style: simpler, smoother, cartoony, subtle painted textures, low detail, performance first (low triangles, few materials, instanced repeats). David supplies every reference: never fetch art, textures or references, and never use asset libraries or generators. Search `web/public/assets/` first and reuse what already fits; only build what is missing.

**The default village is the launch fallback and stays unchanged:** new files and names only; don't overwrite a model the village draws.

**For each asset:** the builder at `art/<folder>/build_*.py`, the GLB under `web/public/assets/game/<folder>/`, a preview in `specs/evidence/wharf-art/`, registered in `SCENERY_URLS` (glowing ones in `NEW_LAMPS`, drawn by `Lanterns`) with footprints and tops where solid, a budget row if it needs one, and the propModels, modelMaterials and budget tests green.

**Reporting:** one batch per commit. After each, SendMessage "main" with the commit, each asset's name, triangles, size, preview path and any placement notes for terrain-v3, then go straight on. At the end update Status here, SendMessage "main" with the full list, and stop. Questions: one line each with your default in `specs/launch/terrain-v3-questions.md` under your lane's name; carry on with the default.

## David's decisions

- 2026-10-26, R2b review (via the coordinator), on the palms: "redo the pamls, i lowk like the old low poly leafs, so like go towards that directio nmore, this one has too much detail tha makes it look less like the other trees, make it different sizes, and trucks bigger, make truckes have the scale kinda thing instead of a normal cylinder". The "old low poly leafs" are the dump palms `web/public/assets/acnh/plants/tree-palm-a.glb` and `-b.glb`. On the fish market: "did you see the fishmarket reference i sent you previously, i need you to start modeling that".

## Status

In progress. Previews in `specs/evidence/wharf-art/`.

1. **Palms, redone twice** (`art/trees/build_palms.py`; the R2b redo replaced the leaflet texture, now deleted): solid low-poly fronds (an arched shell, a bare stem first, the hem cut into fingers), plain colour, in two layers; coconuts at the crown's heart, clear from the play angle; a thick trunk of overlapping scales. Four sizes: `palm-tall` (top 6.21, 1156 tris with casters), `palm-lean` (5.03, 1092), `palm-short` (3.46, 960), `palm-small` (1.95, 732, new). Evidence `palms.webp` (true scale, two camera heights).
2. **Dock and wharf decor** (`art/wharf/build_dock_decor.py`, `game/wharf/`, game units at scale 1, the deck's top at y 0): `dock-pile-rope` (960 tris; 0.9 over the deck, down to -3.4, rope lashings), `rope-net` (2040; posts at x +-1, floats on the top rope), `life-ring` (864; upright in x-y, foot at the origin, 0.93 tall), `net-heap` (1176), `crate-net` (2312), `crate-cloth` (1272), `fish-crate` (1320; tipped toward +z), `dock-hoist` (1510; jib along +x, top 2.645). Registered with footprints and tops. Evidence `dock-decor.webp`.
3. **The beach set** (`art/props/build_beach_set.py`): `sushi-bar` (`game/buildings/`, 4408 tris; a shark's head open-mouthed toward +z over its own 5.6 by 4.4 platform: thatch, teeth, eyes, a fin, the counter with sushi, three stools, shelves, a barrel, paper lanterns, a noren; top 3.41, solid), `lifeguard-tower` (`game/props/`, 2238; ladder to +z, top 3.8), `surfboard-a/b/c` (296 each, tails 0.37 into the sand), `coral-a/b/c/d` (`game/water/`, 244 to 696; not solid). Evidence `beach-set.webp`.

## Next

Done: 1 and 2 (batches bb4a1418, 80cd90bf), A (palms again, 56381235), B (the beach set). Now, in this order (R2b):

A. **Palms, again:** solid low-poly leaves like the dump palms (no fine leaflet texture), matching our other trees; several clearly different sizes; thicker trunks of overlapping scale-like bark segments, not a ringed cylinder; coconuts clearly visible. `palm-shape.jpg` / `palm-style.jpg` stay the silhouette guide.
B. **The beach set** (3 below), but the sushi bar follows `specs/references/terrain/plan-2026-10-23/wharf-sharkbar.jpg` (on main; read it from `.claude/worktrees/restart-art-cohesion/specs/references/terrain/plan-2026-10-23/`): a big fish-head shell over a bar counter with stools and hanging lanterns, our style, low detail.
C. **The fish market:** a building exterior from `wharf-fishing-hut-1.jpg` (same folder: the timber shop with the big marlin on the roof and the fish sign) and `dock-fish-hut.jpg` (fish crates on display, awning, life ring, lantern). Low detail, nobody enters it in v1, sized to stand on the wharf's deck.

The original list:

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
