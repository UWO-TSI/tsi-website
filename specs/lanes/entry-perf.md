# Lane: entry-perf

Worktree `.claude/worktrees/entry-perf`, branch `game/entry-perf`, from origin/main 82a3c70b.

## Status

Started 2026-10-30. Nothing measured yet.

## David's decisions

- 2026-10-30: "make sure the performance to enter the game is good". This ships in v1.2. The release candidate is being built in parallel on game/release-v12 (eight lane branches merged: main quest, tutorial, daily social, volleyball, creator, rods, fishing depth, wardrobe).

## The job

Make entering the game fast, measured, from a member opening the game URL to walking on the island.

### 1. Measure (baseline)

Use a local **production** build (`npm run build` under the heavy lock, then `npx next start -p 3322`), headless Chromium under the devserver lock. Dev server timings don't count.

If the member world needs a signed-in session in a production build, point the build at the staging Supabase (`reference_tethos_staging`: staging ref jjiyeroyralfbluowbjq, its keys in the keychain; never print them) and create a test account at the start of the run and delete it at the end of the same run. Never use prod for this.

Record, cold cache and warm cache, with no throttle and with a "laptop on campus wifi" profile (CDP: 20 Mbps down, 40 ms RTT, CPU 2x):

- the title screen's first paint and when it's interactive;
- the click on play to the first island frame, and to the first frame you can move in;
- bytes and request count before each of those, split by JS, GLB, textures (KTX2, PNG, WebP), audio, fonts and API calls;
- long tasks over 50 ms and their sources, shader compile time (the warm-up), and the Supabase round trips on the path (a waterfall of sequential calls counts);
- the JS heap and GPU memory once the island is in.

Also fetch the public assets on the live site (uwotsi.com) once to read their real sizes, compression and cache headers. Read only; no signing in on prod.

### 2. Fix the biggest costs, in order

Fix what the numbers show. The usual suspects, to confirm or rule out:

- code that isn't needed to enter: lab, editors, admin, combat, volleyball, sushi, catalogue editors, overlays nobody opens on entry. `next/dynamic` them so they load when opened;
- GLBs and textures loaded at entry that aren't on screen, or not compressed (meshopt or Draco geometry, KTX2 textures, the gltf-transform pipeline if the repo has one; check CODEMAP before adding a tool);
- assets of the retired village or the archive still in the entry path;
- requests that could start during the title or the loading screen but start after;
- sequential Supabase calls that could run in parallel or be one RPC;
- audio decoded before it's needed;
- cache headers on `/assets/*`, `/models/*` and `/audio/*` (immutable with hashed names, or at least long max-age). `next.config.ts` belongs to the play.tethos.ca session: propose a header change in your report instead of editing it.

No visual change. Same models, same look. A smaller LOD or a compressed texture is fine only if it's indistinguishable at the game's camera; show a before and after shot for each one.

### 3. Prove it

Re-measure with the same harness and report before and after for every metric. When the coordinator tells you game/release-v12 is ready, merge it into your branch and measure again, so the final numbers are v1.2's. Keep the harness script in the repo (specs/perf/ next to perf-check.mjs) so it can be rerun.

Then run `perf:check` once at the end, since you change what loads.

## Report

Message the coordinator ("main") with the baseline numbers once you have them, then at the end: the head SHA, a before and after table, what changed, the deletions, and anything you propose but didn't change.

## Tools and gotchas

- withlock: `LANE=game/entry-perf /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`; exit 75 means retry. Never create a queue file.
- Swap is nearly full (14.6 of 15.3 GB). Builds and browsers one at a time; close each browser and server you start; kill only your PIDs.
- Port 3322. Never 3000, 3300 or 3301.
- Headless only. Never the Playwright MCP.
- Don't push. Don't touch prod.
