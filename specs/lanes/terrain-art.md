# Lane: terrain-art (the new world's 3D assets, modelled in Blender)

Worktree `.claude/worktrees/terrain-art`, branch `game/terrain-art`, cut from `game/terrain-v3` at e8df02aa. Agent type `uwotsi-lane`.

The lane `terrain-v3` (`specs/lanes/terrain-v3.md`) builds the new world's landform and places things. This lane models the new assets it needs, in Blender, headless. David's notes (2026-10-26, verbatim in `specs/lanes/terrain-v3.md` "R1c and R2 review"): "use blending for all 3d design assets" (blending is Blender), "bigger wood boards, develop proper flooring for wharf, have wood pillars to make it structurally make sense that connecs down to the water, have ladders, small wood pillar with rope fencing for some spots", "improve lighing assets", "palm tree leaves needs more work, needs to be lighter with coconuts, model in blender properly", the campfire "a little bare brain storm to fill it out", and the forest "make it look like a dense forest without actually rendering so many trees, like just low qual so it looks like dense forest that isnt opened that entire section".

**Read first:**
1. `specs/lanes/terrain-v3.md` (the reading of the notes, 1, 4, 7, 8 and 9) and `specs/launch/terrain-v3.md`.
2. The builders this lane follows: `art/props/propkit.py`, `paintkit.py`, `build_streetlamp.py`, `build_campfire.py`, `build_log_bench.py`, `build_fence.py`; `art/trees/build_conifers.py`, `greenery_kit.py`; their evidence under `specs/evidence/remodel-props/` and `remodel-trees/`.
3. How models are registered and drawn: `web/lib/game/propModels.ts` (`SCENERY_URLS`), `web/lib/game/defaultIsland.ts` (`PROP_FOOTPRINT`, `PROP_TOP`), `web/lib/game/modelMaterials.ts` (material-name classes, the lamp glass glow), `components/game/AmbientProps.tsx` (lamps), `components/game/wharf/WoodBoxes.tsx` and `lib/game/wharf.ts` (today's code-built deck boards and ladders), `lib/game/perf/glbStats.ts` and `budget.ts`.

**Art direction:** simpler, smoother, cartoony ACNH; subtle textures; performance first (low triangles, few materials, instanced repeats). Match the existing builders' look. David supplies every reference: never fetch art, textures or references. If he uploads references, the coordinator saves them under `specs/references/terrain/r2-2026-10-26/` and messages you.

**The default village is the launch fallback and stays unchanged.** New assets get new files and new names, used by the new world; don't overwrite a model the village draws.

## Status

Done, head after this file's commit (batches 5d2e432c, 6c9973aa, 5b7ef2bb, bd2293cb, ae16f45a). Not yet reviewed by David. All registered in `SCENERY_URLS` (or `NEW_LAMPS`), game units at scale 1, previews in `specs/evidence/terrain-art/`. Gates: propModels, modelMaterials and budget tests green, tsc and eslint clean.

1. **Wharf kit** (`art/wharf/build_wharf_kit.py`, `game/wharf/`): `deck-tile` (836 tris; 4 x 4, 8 boards along +z on 3 joists, top 0.01), `deck-steps` (880; 4 treads of 0.25 up +z, top 1), `wharf-piling` (220; cap 0.35 over the deck top y 0, down to -3.4, wet under y -1.08), `wharf-ladder` (480; deck edge at z 0, water toward -z), `rope-post` (310; 0.87, rope at 0.66), `rope-span` (120; x -1 to 1 between post centres, scale x). Evidence `wharf-kit.webp`.
2. **Palms** (`art/trees/build_palms.py`, frond texture `art/trees/textures/palm-fronds.png` from `paint_textures.py palm-fronds`): `palm-tall` (5.7 tall), `palm-lean`, `palm-short`, 550 to 770 visible tris, through `finish-greenery`. Evidence `palms.webp`.
3. **Lamps** (`art/props/build_new_lamps.py`): `village-lamp` (1490 tris; finial 2.67, light (0.52, 2.08, 0)) and `lantern-post` (1184; light (0.56, 1.78, 0)), as `NEW_LAMPS.village` / `.wharf`. `AmbientProps` `Lanterns` takes `lamp` and `yaws` (default: the old lamp, so the village is unchanged). Evidence `lamps.webp`.
4. **Campfire set** (`art/props/build_campfire_set.py`, reuses `build_campfire`'s log and the lamps' lantern): `stump-seat`, `firewood-stack`, `fish-rack` (scenery), `camp-lantern` (`NEW_LAMPS.camp`, light (0.3, 1.18, 0)). Evidence `campfire-set.webp`.
5. **Forest masses** (`art/trees/build_forest_masses.py`): `forest-mass-a` (round, 12 across), `-b` (16 by 9 along x), `-c` (10 across), 1600 to 2550 tris, two materials; a "forest mass" row in `perf/budget.ts`. Evidence `forest-masses.webp`.

## Next

Nothing left from the list below; wait for David's review notes. (The original list, kept for reference:)

Build in this order, one batch per commit. After each batch, SendMessage "main" with the commit, each asset's name, triangles, file size and its preview image, then go straight on.

1. **The wharf kit** (terrain-v3 needs it first):
   - a deck tile: one 4 u square of bigger wooden boards, the same footprint as today's `deck` object, plus a "steps" variant;
   - a piling: a round wooden pillar that runs from the deck's underside down into the water (tall enough for the deck's height plus the sea floor's depth there);
   - a ladder from the deck down into the water;
   - rope fencing: a short wooden post, and a rope span between two posts.
2. **Palms:** two or three palms with lighter leaves and coconuts.
3. **Lights:** a better street lamp for the new world, and a wooden lantern post for the wharf and the market. Keep the glow working (the `M_Glass` and `M_Iron` naming in `modelMaterials.ts` and `AmbientProps`), and say how terrain-v3 should switch the new world's lamps to them.
4. **The campfire set:** fill out the area round the campfire. Your call within reason, for example stump seats, a firewood stack, a lantern on a pole, a fish-drying rack. Reuse `log-bench` and `campfire` where they fit.
5. **Forest masses:** two or three low-detail clumps (several tree crowns merged into one mesh on one base, 10 to 16 u across, one or two materials), so the closed forest reads as dense from the open area while drawing only a few instanced meshes.

For each asset:
- the builder at `art/<folder>/build_*.py` (headless, `--factory-startup`) and the GLB at `web/public/assets/game/<folder>/`;
- a preview render into `specs/evidence/terrain-art/`;
- registered in `SCENERY_URLS`, with a footprint and top in `PROP_FOOTPRINT` / `PROP_TOP` where it's solid, and a material class in `modelMaterials.ts` if it needs one;
- the propModels, modelMaterials and glbStats tests green.

At the end, update this file's Status and SendMessage "main" with the full list, then stop. Placement is terrain-v3's job; don't edit `generate.ts` or `web/data/world/`.

**Questions for David:** add one line each, with your default, to `specs/launch/terrain-v3-questions.md` under "terrain-art", and carry on with the default.

## Tools and gotchas

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script> [-- args]` under `LANE=game/terrain-art /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`. Never open the Blender app, and never use the `blender` MCP tools: they drive David's visible Blender.
- **Locks:** `withlock.sh heavy <cmd>` for vitest and tsc. If swap is over 9 GB, wait before taking the Blender lock.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **node_modules:** cloned from terrain-v3 (`cp -c -R`).
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees.
- **Builders:** wharf kit and props use `art/props/propkit.py` (game coordinates); plants use `art/trees/greenery_kit.py` and end in `web/scripts/finish-greenery.mjs`. Review renders: `-- review <dir>` on the props builders, `art/trees/preview.py` for plants; combine frames with `magick ... +append` into a webp.
- `build_conifers.py` runs `main()` on import (no guard): don't import from it.
- `lookClassFor` only gives metal and glass under `/props/` (and a few other folders), so glowing lamps live in `game/props/`.

