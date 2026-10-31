# Lane: entry-perf

Worktree `.claude/worktrees/entry-perf`, branch `game/entry-perf`, from origin/main 82a3c70b.

## Status

Done 2026-10-30; report sent. Head: the commit that adds this status (on top of 0a09b98a). game/release-v12 (7a009eb6) is merged in, so
the final numbers are v1.2's. Gates on the merged tree: tsc clean, eslint clean on the changed files, vitest 3728 passed.
perf:check skipped on the coordinator's word (release-v12 runs the single one after merging this branch).

Before and after, v1.2 (release-v12 alone vs release-v12 + this lane), ms from Play (`specs/evidence/entry-perf/runs/rc0-*`
and `v12-*`; the main baseline is `before-*`, main with the fixes `after2-*`):

| | none cold | none warm | campus cold | campus warm |
|---|---|---|---|---|
| Title interactive | 3224 -> 2193 | 3115 -> 2378 | 4842 -> 4176 | 3262 -> 2790 |
| Canvas | 1987 -> 1195 | 1938 -> 1180 | 2836 -> 2195 | 2293 -> 1638 |
| First island frame | 6042 -> 3688 | 5360 -> 3471 | 12962 -> 9525 | 9741 -> 5925 |
| Can move | 6163 -> 3866 | 5489 -> 3616 | 13101 -> 9714 | 9881 -> 6172 |
| Long frames before moving | 17 (1739 ms) -> 8 (1362) | 14 (1447) -> 8 (1362) | 24 (4026) -> 12 (2554) | 25 (4070) -> 12 (2493) |
| Programs linked | 254 -> 206 | 254 -> 202 | 253 -> 210 | 246 -> 202 |

What changed (one commit each): the entry trace; stale-while-revalidate on /assets, /models, /audio (next.config.ts, the
play.tethos.ca session is done with it); interiors, merch and the tool flourish preload after the first frame
(`afterEntry`, lib/game/sceneGate.ts); no scene draws behind the loading screen until the warm-up compile settles
(LoadGate `holdDraws`: programs link side by side); the world's derive in two workers and the blur's uniform-window
shortcut (same bytes); `lastCall` (lib/game/lastCall.ts) for the layout, seabed, fish and glints, which the scene
re-derived on each of its six renders before it commits; the seabed reads only each spot's roll first (same seabed);
the title prefetches only what the first frame needs that the title doesn't load itself, within 1 s of drawing.
Deleted: the manifest generator in load-trace.mjs (moved to entry-trace.mjs).

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
- Swap is nearly full. Builds and browsers one at a time; close each browser and server you start; kill only your PIDs.
- Port 3322. Never 3000, 3300 or 3301. Headless only. Never the Playwright MCP. Don't push. Don't touch prod.
- The harness: `specs/perf/entry-trace.mjs` (its header has the build recipe: `next build` with
  NEXT_PUBLIC_MEMBER_WORLD=open and a dead Supabase, then drop the dashboard from .next/server/middleware-manifest.json's
  matchers; never deploy it). Env: NET=none|campus, CACHE=cold|warm, DWELL, PROFILE=1 (main thread by half second and
  by function), SHOT=<s> (a still at the spawn), MANIFEST=1 (regenerates web/lib/game/preloadAssets.ts). The island
  marks `performance.mark("island entered")` when the loading screen lifts.
- Staging Supabase is paused (David's money call), so the runs are signed out as a returning member (a cached look in
  localStorage skips the creator). The Supabase reads on entry fail fast and supabase-js retries each twice; signed in
  they'd be single reads.
- Lamp pools differ between runs with the player's exact spot (the four nearest lamps fade by distance): compare stills
  at the spawn (SHOT), not after walking.

## Proposed, not changed

- Lossless WebP for the big PNGs on the entry path: shop-sign-v1.png 1.74 -> 1.35 MB, hair_colour_world.png 1.61 ->
  0.88, v7_face_atlas_2_512.png 0.84 -> 0.43, outfits/designs.png 0.37 -> 0.10 (cwebp -lossless -exact). The character
  ones come from web/scripts/sync-character-assets.mjs, so the pipeline and character_catalog.json change with them.
- The entry GLBs are 25 MB raw (6.2 MB of it embedded images, 5 MB PNG): lossless WebP for the embedded images and
  meshopt geometry (the repo has @gltf-transform/cli and meshoptimizer) would cut the cold campus download most.
- Character parts: useGLTF([skin, ...parts]) caches by the whole list, so a part shared by two looks is fetched and
  parsed again per look (skin.glb three times on entry).
