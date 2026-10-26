# Lane: perf-newworld (bring the new world back under budget for the Oct 28 go/no-go)

Worktree `.claude/worktrees/perf-newworld`, branch `game/perf-newworld`, cut from `game/terrain-v3` at 76f4b591 (terrain R2c: all the new art placed). Agent type `uwotsi-lane`.

**The problem:** after R2c the new world (`SCENES=v2`) measures High 20.7 ms frame (CPU 16.5 ms) and 425 draws, and Lite 8.4 ms and 342 draws, at a machine load of about 3. The village baseline is 5.4 ms and 254 draws (Lite 3.0 and 172). The budget is High at most about 6 ms of main thread on the Mac mini M4, with the new world's line at 4.8 ms and 222 draws (`specs/perf/budget.md`, `web/lib/game/perf/budget.ts`). The launch go/no-go is Oct 28, and the village is the fallback if the new world can't make it.

**What terrain-v3 already did** (`specs/lanes/terrain-v3.md`, Status "Perf work" and the gotchas):
- the still props merged by look (`InstancedNature MergedModels`, new world only);
- the houses instanced by colourway (`ACNHParts at`);
- lamp pools only on the 8 lamps nearest you.

**Its breakdown:**
- scenery sets about 150 draws, 13 of them rope materials, one per GLB's own rope texture;
- houses about 40;
- lamps 21;
- terrain 20;
- the bench's bots 41;
- trees about 25.

The CPU profile shows no single hog; the time goes on three.js's per-draw work and matrix updates. Frustum culling alone doesn't help, because the curved world bends far things into view. But the bend also sinks far things (0.0032 d², so nothing past about 80 u from the player shows), which a distance or chunk cull can use.

## Next

1. **Measure first, apples to apples:** the village (`SCENES=village` or the baseline scene) and the new world in the same session at the same load, so the gap is real and not the load's. Note the load.
2. **Find the cost:** the draw breakdown (`specs/perf/draw-breakdown.mjs`) and a CPU profile. Check:
   - matrix updates on static objects (`matrixAutoUpdate`, `matrixWorldAutoUpdate`);
   - the shadow pass's draws and casters;
   - the number of point lights and their shader cost;
   - the Halloween layer's 80 pumpkins (one at every lamp);
   - anything per frame that scales with object count.
3. **Cut, biggest first,** keeping the look David approved. Candidates:
   - static objects frozen;
   - spatial chunks of merged statics, culled by bent distance;
   - one shared rope (and wood) image across the art so merges collapse (rebuild the GLBs from their `art/` builders, headless, and keep each model's look);
   - each chalet's parts merged by material;
   - lamp bodies merged, glass kept apart;
   - fewer shadow casters for small props;
   - pumpkins capped on the new world.
4. **Targets:** High within the budget line (4.8 ms, 222 draws), or at least at the village's baseline (5.4 ms, 254 draws). Lite within its line. Report where it lands if it can't reach that, with what each further step would cost in look.
5. **Gates:**
   - tests with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc and eslint;
   - the default village unchanged, and its perf not worse;
   - renders of 01, 03, 04 and 18 from `specs/evidence/terrain-v3/r2c/`, reshot into `specs/evidence/perf-newworld/` to show the look held.
6. **Report:** commit, update Status here, SendMessage "main" with the before and after table (frame, CPU and draws per tier, with the load), what changed and the renders. Then stop.

**David's terrain notes may arrive during this lane** and go to the lane terrain-v3 on its own branch. Don't change layout (`generate.ts`'s placement, `web/data/world/`) beyond what perf needs; say so if a cut needs it.

## Tools and gotchas

- **Perf runs** (from terrain-v3's gotchas):
  - build with `LANE=game/perf-newworld /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy sh specs/perf/measure-build.sh` as its own call;
  - then `SKIP_BUILD=1 KEEP_BUILD=1 SCENES=v2 LOCK_OWNER=game/perf-newworld npm run perf:check`, which takes the devserver lock itself;
  - draw breakdown: serve the build (`next start -p 3158`, Supabase blanked) under the devserver lock, then `PORT=3158 TIER=high node specs/perf/draw-breakdown.mjs "fixture=v2&bots=24" <out.json>`.

  See `specs/perf/README.md`.
- **Views:** dev server on port 3171 with `NEXT_PUBLIC_GAME_WORLD=new`, Supabase blanked; `PORT=3171 node specs/evidence/terrain-v3/shoot.mjs <dir> [views]`.
- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>` under `withlock.sh blender`. Never open the Blender app; never the `blender` MCP tools.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000. Kill only processes you started.
- **cells.test** can time out at 5 s on a busy machine; run it with `--testTimeout=30000`.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees.
