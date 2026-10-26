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

## Status

Head: see `git log` (the `[build] perf-newworld` commits on 76f4b591).

**Measured, apples to apples** (the measurement build, `perf-bench.mjs`, same session, 24 bots; medians):

| | High frame / CPU / draws | Lite frame / CPU / draws | Load |
|---|---|---|---|
| Village, before | 4.6 / 4.0 / 384 | 2.8 / 2.5 / 295 | 3.4-4.0 |
| New world (v2), before | 6.1 / 5.4 / 430 | 3.75 / 3.4 / 353 | 3.4-4.0 |
| Village, after | 4.55 / 4.0 / 377 | 3.2 / 2.9 / 293 | 4.6-7.7 |
| New world (v2), after | 5.05 / 4.45 / 386 | 3.75 / 3.35 / 313 | 4.6-7.7 |

The 20.7 ms of R2c doesn't reproduce: the same build measured 6.1 ms here (that run had contention).

**What cost what** (hiding a group in the running v2 scene, A/B interleaved, `attrib.mjs` in the lane's scratchpad):
- contact-shadow anchors 0.6 ms;
- the merged scenery's 60 draws 0.5;
- the lamp pool's 8 point lights 0.9 (three uploads every light's uniforms on each program switch);
- houses 0.2, trees 0.2.

**Done:**
1. Contact shadows update once a frame, not three times (N8AO renders the scene twice more). A still placement's contact stands at a matrix under its owner group, with no node of its own (786 fewer scene objects): `ContactShadows addContact(..., at)`, used by InstancedNature, MergedModels, ACNHHouses and the pumpkins.
2. MergedModels keys a texture by its image's bytes (`imageKeys`), so the art's shared rope and decor wood merge across GLBs: 13 rope draws down to 6, decor wood 8 down to 1, logs, piles and nets down to 1 each.
3. The houses are merged by look across all three colourways (`ACNHHouses`, `mergeByLook`): 39 draws down to 21. ACNHParts lost its `at` path.
4. Caster-only hulls are hidden from the frame's draw list; only the shadow passes draw them (`SunShadows frame`). That was 10 wasted draws in v2 and 8 in the village.

5. **David's call on the lamp pool:** 4 real lights (the 4 nearest lamps) plus a warm ground glow under every lamp. The pool is set to 4 here (`LampPool count`). terrain-v3 builds the glow pools and the flame flicker; this lane leaves those alone. Hiding the 8 pool lights saved about 0.9 ms; 4 saves about 0.4 to 0.45.

**perf:check, final** (SCENES=village,v2, 5 runs, load 5.0 to 5.2, against the 10-14 baseline):
- High: v2 5.2 ms (CPU 4.6, 384 draws), village 4.9 (CPU 4.3, 374).
- Lite: v2 3.5 (CPU 3.1, 313), village 2.9 (CPU 2.7, 293).
- The village reads +25% against the baseline because of the load: its draws went down (382 to 374).
- It fails only on the v2 Lite triangles: 969k against the 950k budget. That count was the same before this lane (the R2c art; terrain-v3 is rebuilding the jetty).

**Gates:** game tests green with and without `NEXT_PUBLIC_GAME_WORLD=new` (2005 of 2006; the one failure is budget.test's jetty and plaza-tiles triangles, inherited from terrain-v3, which is rebuilding them). tsc clean, eslint clean on changed files. Renders 01, 03, 04 and 18 in `specs/evidence/perf-newworld/`, matching R2c.

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
