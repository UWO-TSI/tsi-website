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

## Round 2 progress

- Step 1 done, 88576ac4: versioned URLs (lib/assetUrl.ts, lib/assetVersions.ts, lib/game/versionedLoads.ts imported
  first in TitleScene and DefaultIslandWorld; next.config.ts env ASSET_VERSIONS and the has/missing v headers).
  entry-trace prints "game files without a version" (0 on all four runs). Gates: tsc clean, eslint clean, vitest 3730
  passed. Runs r2base-* (before) and r2s1-* in specs/evidence/entry-perf/runs. Not covered: the applicant island
  (recruitment code, not touched) still asks for bare URLs, so it revalidates each file (as before round 1).

## David's decisions

- 2026-10-30: "make sure the performance to enter the game is good". This ships in v1.2. The release candidate is being built in parallel on game/release-v12 (eight lane branches merged: main quest, tutorial, daily social, volleyball, creator, rods, fishing depth, wardrobe).

## Round 2 (2026-10-30, after v1.2 shipped)

v1.2 is live (main 779bb0d9, tag v1.2) with round 1 in it. Merge origin/main first. Round 1's job text is history now; the numbers are under Status.

Do these in order. Each one is its own commit with before and after numbers from entry-trace.mjs.

1. **Content-versioned asset URLs (must land before any deploy that changes an asset in place).** Round 1's stale-while-revalidate header means a returning player can draw an old file with new code once. Give every /assets, /models and /audio URL the game requests a version from its content: a build step writes a manifest of path to short hash, and the one place URLs are built (find it, or make the loaders go through one helper) appends `?v=<hash>`. Then in next.config.ts, requests carrying `v` get `public, max-age=31536000, immutable` (a `has: [{ type: "query", key: "v" }]` rule), and requests without it go back to `public, max-age=0, must-revalidate`. Prove it: a test that every URL the entry path requests carries a v, and a check that changing one file's bytes changes only its v.
2. **Character parts loaded once each.** useGLTF([skin, ...parts]) caches by the whole list, so skin.glb is fetched and parsed three times on entry. Cache per part.
3. **Lossless WebP for the entry PNGs** (cwebp -lossless -exact): shop-sign, hair_colour_world, face_atlas_2_512, designs, and colour_atlas.png (1.9 MB, new in v1.2). The character textures come out of sync-character-assets.mjs, so change that script too. Pixel-identical: prove it with a decode-and-compare.
4. **Entry GLBs: meshopt geometry plus WebP textures inside them** (gltf-transform and meshoptimizer are already in the repo). 25 MB raw, 5 MB of it embedded PNG. The look must be identical at the game camera: before and after stills at the spawn, the wharf and HQ, plus a pixel diff. If quantization shows anywhere, keep that mesh unquantized. Keep the source GLBs reproducible: a script, not hand edits.
5. Re-measure everything on the final tree. Then `perf:check` once.

No visual change anywhere. Stop and report if any step can't stay identical.

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
