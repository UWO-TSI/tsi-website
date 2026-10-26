# Lane: wharf-art2 (the wharf and beach assets from David's R2c notes)

Worktree `.claude/worktrees/wharf-art2`, branch `game/wharf-art2`. Agent type `uwotsi-lane`, cut from `game/terrain-v3` at c13ea8e7 (terrain R2c, with every new-world asset so far).

**Read first:**
- `specs/lanes/terrain-v3.md`, "2026-10-26: R2c review": David's notes verbatim and the reading. This lane does the items it names for you.
- `specs/lanes/wharf-art.md` and `specs/lanes/village-art.md`: how the last art lanes built, registered and previewed their assets. Follow the same pattern: the builders in `art/`, `propkit.py`, `paintkit.py`, `SCENERY_URLS`, `NEW_LAMPS`, `PROP_FOOTPRINT`/`PROP_TOP`, the budget rows.
- The references in `specs/references/terrain/` (`plan-2026-10-23/`, `r2-2026-10-26/`).

**Art direction:** David's words are "treat each asset properly" and "visually stunning". Use our style: cartoony, smooth, subtle painted textures, low detail where it doesn't show, performance first (few materials, instanced repeats). Organic shapes, never plain spheres or boxes. Search `web/public/assets/` first. David supplies every reference: never fetch art, textures or references, and never use asset libraries or generators. The default village is the launch fallback and stays unchanged: new files and names only, or replace files only the new world uses.

**Per asset:**
- a builder in `art/`;
- the GLB in `web/public/assets/game/`;
- a preview in `specs/evidence/wharf-art2/`;
- registered, with footprints where solid;
- the propModels, modelMaterials and budget tests green.

**Reporting:** one batch per commit. After each, SendMessage "main" with:
- the commit;
- each asset's name, triangles and size;
- the preview path;
- placement notes for terrain-v3.

Then go straight on. At the end, update Status here, send the full list, and stop. Questions go in `specs/launch/terrain-v3-questions.md` under your lane, one line each with your default.

## Status

Previews in `specs/evidence/wharf-art2/`. Placement is terrain-v3's. The budget test's two failures (`plaza-tiles`, `jetty`) came with the branch, not from this lane.

1. **Fish market and sell barrel** (`art/buildings/build_fish_market.py`): `fish-market` remodelled (11,892 tris, 868 KB; footprint [3.1, 3.6], top 10.569); `sell-barrel` new (`game/wharf/`, 2,162 tris, 150 KB; footprint [0.66, 0.78], top 3.394).
2. **Ship houses** (`art/wharf/build_ship_houses.py`, `game/wharf/`): origin on the deck's top at the floor's middle, door +z (inland), the back half over the sea on piles to -3.4. `ship-house-a` red boathouse (6,548 tris, 468 KB; [2.1, 2.3], top 4.48), `-b` stilt house with a balcony off +x (8,644, 608 KB; [2.4, 2.0], 4.13), `-c` net loft (6,454, 484 KB; [1.9, 2.0], 6.28), `-d` shack with a front porch (3,992, 276 KB; [2.1, 2.1], 3.178).
3. **Lifeguard tower, taller** (`art/props/build_beach_set.py lifeguard_tower`, replaced): the deck at 2.7 (was 1.8), legs splayed wider and braced in two tiers with a ring beam, a longer ladder to z 1.85. 2,766 tris, 180 KB; footprint [1.02, 1.02], top 4.7. The rest of the beach set rebuilds byte-identical.
4. **Beach things** (`art/props/build_beach_things.py`, `game/props/`): `beach-ball-a/b/c` (224 tris each, 13 KB, not solid; the game has no kickable or throwable ball yet, and the dump's `beach-ball.glb` is unused), `beach-towel-a/b` (168, 8 KB, not solid), `beach-lounger` (1,520, 90 KB; [0.34, 0.95], top 0.948), `sandcastle` (1,820, 95 KB; [0.55, 0.5], 0.78), `beach-cooler` (416, 23 KB; [0.33, 0.22], 0.486), `volleyball-net` (960, 69 KB; [2.62, 0.08], 2.14).

## Next

1. **The fish market, remodelled** closer to `plan-2026-10-23/wharf-fishing-hut-1.jpg`: "the model of the sword fish bigger and incorperated within the build, and bigger so that its like lunched out the building". Replace `fish-market` (only the new world uses it). Also a big sell barrel to stand outside it (`sell-barrel`): it's the quick-sell spot, so make it read as one (a sign or a scale).
2. **Ship houses:** three or four different boathouses or fishing huts in the wharf's style (`dock-fish-hut.jpg`, `wharf-fishing-hut-1.jpg`), built to stand along the sides of the wharf, half on piles, fronts facing in. Nobody enters them in v1. Say each one's footprint and front.
3. **The lifeguard tower, taller** (about 1.5x the platform height; replace `lifeguard-tower`).
4. **More beach things** ("brainstorm for more beach stuff, maybe beach balls you can play with"): beach balls (two or three colours, round and light), towels, loungers, a sandcastle, a cooler, a volleyball net, or whatever else fits. Check whether the game already has a kickable or throwable ball, and say so in your report.
5. **Coral reefs** for the shallows: bigger reef clusters built from the existing coral, plus a small school-of-fish piece if the existing `water/fish.glb` doesn't cover it.

## Tools and gotchas

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script> [-- args]` under `wharf-art2=game/wharf-art2 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`. Never open the Blender app, and never use the `blender` MCP tools: they drive David's visible Blender.
- **Locks:** `withlock.sh heavy <cmd>` for vitest and tsc. If swap is over 9 GB, wait before taking the Blender lock. Other lanes are running (terrain-v3, perf-newworld and two more art lanes), so expect waits.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **node_modules:** cloned (`cp -c -R`).
- **propModels.ts:** other lanes append to the same tables. Add your entries in one block with a comment line naming your lane.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees.
