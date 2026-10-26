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

Not started.

## Next

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
