# Lane: perf-tris (the new world's triangles back under budget, without changing the look)

Worktree `.claude/worktrees/perf-tris`, branch `game/perf-tris`, cut from main at 2e7bd27f. Agent type `uwotsi-lane`.

**The problem (coordinator, 2026-10-28):** `SCENES=v2 RUNS=1 npm run perf:check` on main (2e7bd27f), headless:
- High: 405 draws, 1,369,097 triangles (budget 1,200,000).
- Lite: 340 draws, 1,169,345 triangles (budget 950,000).
- perf-newworld left Lite at 969k triangles (its Pass 3, `specs/lanes/perf-newworld.md`), so about 200k came in after it. Draws (about 400) match where perf-newworld left them, so draws are not the target here.
- Frame times from headless runs are noise at this machine's load (spread 157%), so judge by triangles and draws, which are deterministic. `specs/perf/baseline.json`'s v2 rows are the village's old numbers, not a new-world baseline.

**Steps:**
1. **Attribute.** Find what added triangles since perf-newworld Pass 3, by merge (likely candidates: grass-wind, reflection-waves, remodel step 1's cart, lighthouse, fence and 81 fish, wharf-art, terrain-v3's later rounds) and by object group in the v2 scene, per tier. Write the table into Status before changing anything.
2. **Cut without changing the look:** LOD distances and LOD2 on Lite, instancing or merging, dropping hidden or underground faces, decimating far meshes that read the same, culling by the curved world's sink distance (nothing past about 80 u shows). Each cut gets a before and after render at the same camera.
3. **Look changes need David.** If a target can't be reached without a visible change, stop at the best no-look-change result and list each further step with what it would cost in look. Don't make those changes.
4. **New world only.** The village stays unchanged.

**Gates:** tsc; vitest with and without `NEXT_PUBLIC_GAME_WORLD=new` (budget.test included); eslint on changed files; one `SCENES=v2 RUNS=1 npm run perf:check` at the end (run it bare: it takes the heavy and devserver locks itself). Renders in `specs/evidence/perf-tris/`.

**Report:** commit, update Status here, SendMessage "main" with the attribution table, the before and after triangles and draws per tier, what changed, and the renders. Then stop.

**Rules:**
- Headless only: no visible windows, no `open`, never the Playwright MCP, the claude-in-chrome tools or the blender MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`.
- Locks: `LANE=game/perf-tris /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`, retried in a background loop while it exits 75. Keep each devserver hold to one short batch. There is no queue file; never create one. perf:check takes its own locks, so never wrap it in withlock.
- Kill only processes you started. Never touch port 3000. Delete web/.next when done with a server.
- Git: commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees.
- No fetched art, assets or generators. Writing: no em dashes.

## Status

**Step 1, attribution (done).** Measured, not assumed: a per-draw triangle tally (`tri-breakdown.mjs`, the draw breakdown with each draw's triangles from `gl.info`) on two measurement builds, same bench view (`/lab/island?fixture=v2&bots=24`, the bench camera), headless.
- Before: 2b28dd51 (perf-newworld Pass 1, R2c): High 1,208,805, Lite 969,628, which is the 969k the coordinator quoted. perf-newworld's Pass 3 reported draws and frame times only, no triangles.
- After: main 2e7bd27f (this branch at 1a28ece9): High 1,375,048, Lite 1,166,551 (perf:check read 1,369,097 and 1,169,345).
- Nearly every triangle is the main view (Lite all of it; High 20k in the shadow passes, plus the water drawn twice by N8AO's transparency pass).

By group, Lite (High is the same but for the lines noted):

| Group | Before | After | Change |
|---|---|---|---|
| merged scenery (props, wharf, buildings, reefs: one mesh per look across the whole world, all drawn) | 183,951 | 369,793 | +185,842 |
| forest and river trees | 57,424 | 132,068 | +74,644 |
| reeds | 0 | 43,554 | +43,554 |
| shrubs (the wild shrubs; the old bushes before) | 53,284 | 76,428 | +23,144 |
| critters and fish | 14,040 | 24,822 | +10,782 |
| flowers | 77,774 | 40,736 | -37,038 |
| pumpkins | 42,490 | 9,712 | -32,778 |
| characters (High: -52,777) | 50,330 | 25,738 | -24,592 |
| jetty (rebuilt, now merged) | 33,428 | 9,160 | -24,268 |
| single-draw props (old ACNH props, now merged or gone) | 28,095 | 5,606 | -22,489 |
| water, terrain, grass, seabed, lamps, fruit, other | | | about +1,000 |
| **total** | **969,628** | **1,166,551** | **+196,923** |

By merge (the merged scenery's whole-world triangles by the merge that added each model; the trees, reeds and shrubs are village-art2 batches 2, 5 and 6):
- **terrain-v3 R2d** (2241eca2, via perf-newworld): the forest trees (+75k), reeds (+44k), wild shrubs (+23k net of the bushes they replaced) and 20 new still models (93k: moss boulders, river stones, coral reefs and the rest).
- **terrain-v3 R2e** (90bfa9e5): 4 new still models, 43k (the shells: sand dollars, starfish, conch, and the beach parasols).
- **terrain-v3 R2f** (004a0ef5): the shipwright's ship, 11.7k; the river trees remade a little heavier.
- **sushi-bar** (e9cf4857): the bar 11k to 25k, the pier 5k, glow and hours (about +12k at the bench view, as its lane measured).
- **remodel step 1 and round 3** (e694d5f0, 350a4900): the cart, lighthouse and market barrels, about 17k, less the ACNH lighthouse and barrels they replaced.
- **grass-wind, reflection-waves, wardrobe, fit-editor, loading, collision:** no triangle change.

The cause underneath: the merged scenery is one mesh per look across the whole world and the instanced nature holds every placement, both never culled (the curved world turned three's culling off), so every prop and tree added anywhere on the island draws from everywhere.

**Step 2, the cut (done, no look change).** Head: see `git log` (`[build] perf-tris` commits on 2e7bd27f). The new world now draws only what the bent view can see, using the existing `CurvedCull` (the frustum with the bend's drop allowed for, the camera's far plane at 120 u, a one-frame margin), as GridTerrain and GridCliffs already did:
- **Merged scenery** (`MergedModels cull`, `mergeByLook(..., { view: 32 })`): the view is joined per look per 32 u block and each block culled. The casting parts get a whole-world caster copy that draws only in the shadow passes (`"caster"`, SunShadows `casterOnly`), so a culled block keeps its shadow and the cached static shadow map never re-renders for the cull.
- **Instanced nature** (`InstancedModels cull`, `CulledGLB`): each placement drawn only while its bounding sphere can be in view, at its LOD level for the trees. A casting sub-mesh hands its casting to a twin holding every placement (shadow passes only); the caster hulls already were that. Crown tints are repacked with their placements.
- **Water blocks** 128 u down to 64 u (`WATER_BLOCK_CHUNKS` 2), already culled per block.
- New world only: DefaultIslandWorld passes `cull` only when `v.terrain`. The village and applicant island build exactly as before.
- Bench switch `?fxoff=viewCull` (`lib/game/perf/fxBench.ts`) draws everything, as before the cull.

**Numbers** (triangles and draws are deterministic; the bench view, 24 bots):

| | High tris | High draws | Lite tris | Lite draws |
|---|---|---|---|---|
| main 2e7bd27f (coordinator's perf:check) | 1,369,097 | 405 | 1,169,345 | 340 |
| this branch, `?fxoff=viewCull` (everything drawn) | 1,342,454 | 509 | 1,152,865 | 435 |
| **this branch (perf:check, the gate)** | **773,698** | **345** | **581,529** | **281** |
| budget | 1,200,000 | 760 | 950,000 | 560 |

- Lite by group at the bench view: merged scenery 370k to 104k, forest and river trees 132k to 1k, shrubs 76k to 2k, reeds 44k to 0, flowers 41k to 2k, water 103k to 89k. Lamps (40k), fruit (44k), terrain (64k, already culled) unchanged.
- perf:check (`SCENES=v2 RUNS=1`, load 6.5, spread 64 to 70%) passes on triangles and fails only on frame time and CPU (High 21.1 ms, Lite 9.7 ms): noise at this load, as the coordinator noted (its own main run had a 157% spread). Not judged here.
- **Renders** `specs/evidence/perf-tris/*.webp`: left everything drawn (`?fxoff=viewCull`), right culled; the same page and camera, 600 ms apart, High with shadows. Views 00-bench (the perf bench view), 01, 03, 04, 06, 09, 10, 18 (night), 24, 27 from terrain-v3's shoot list. The only pixel differences are things that move between the two shots (water, swash, grass and palm sway, walkers, a talk bubble). The night view was shot off, on, off, on to rule out the lamps easing in.

**Gates:** tsc clean; vitest with `NEXT_PUBLIC_GAME_WORLD=new` 3506 passed (budget.test included); vitest default 3505 passed with one timeout (`derive.test.ts`, 30 s on a load of 27; it passes alone); eslint clean on the changed files. New test `components/game/InstancedNature.test.ts` (the merge's view blocks and caster copy).

**Not verified:** frame time (the machine's load made it noise); the cull's own per-frame CPU (about a thousand sphere tests a frame, measured only as part of the noisy frame); a real GPU other than the Mac mini's ANGLE on Metal.

**Look changes for David:** none needed; both tiers are under budget with no visible change.

## Tools and gotchas

- `tri-breakdown.mjs` (lane scratchpad): `specs/perf/draw-breakdown.mjs` plus each draw's triangles (the `gl.info` delta around `renderBufferDirect`), longer parent chains and the camera. Worth folding into draw-breakdown.mjs if another triangle lane comes.
- The draw breakdown names merged meshes by material only (`- | P_Stone`): count models with a census (`sceneryOf` on the world, GLB triangles per url) to say what is in a look.
- On High the water draws twice: N8AO's transparency pass re-renders every transparent object (PostFX `settleTransparency`).
- Headless page loads right after a server start can sit past 240 s at high load; curl the lab page first.
- `withlock.sh` waits on all locks while swap is over 9 GB; a `timeout` round it does not stop it cleanly (kill your own PIDs).
- Merge base for attribution: 2b28dd51 (Pass 1 of perf-newworld) is the 969k reading; Pass 3 recorded no triangles.
