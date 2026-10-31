# Lane: entry-perf

Worktree `.claude/worktrees/entry-perf`, branch `game/entry-perf`, from origin/main 82a3c70b.

## Status

Round 2 done 2026-10-30; report sent. Head: the commit that adds this status. origin/main 779bb0d9 (v1.2) merged in.
Gates on the final tree: tsc clean, eslint clean on the changed files, vitest 3730 passed, perf:check passed (v2 high
4.90 ms, lite 3.00; cafe high 1.40, lite 1.10; ruins-summoner high 2.80, lite 1.80). web/.next deleted.

Round 2, before (r2base: v1.2) and after (r2final), ms from Play (specs/evidence/entry-perf/runs/r2*):

| | none cold | none warm | campus cold | campus warm |
|---|---|---|---|---|
| Title interactive (ms) | 2480 -> 2187 | 2354 -> 2359 | 4121 -> 4055 | 2784 -> 2799 |
| First island frame | 3638 -> 3643 | 3612 -> 3380 | 9744 -> 7655 | 5882 -> 6058 |
| Can move | 3820 -> 3812 | 3792 -> 3559 | 9881 -> 7809 | 6152 -> 6339 |
| Long frames before moving | 9 (1364 ms) -> 12 (1578) | 11 (1513) -> 8 (1372) | 14 (2714) -> 14 (2676) | 15 (2628) -> 13 (2639) |
| Game files over the network, title + island (MB) | 30.2 -> 23.9 | 0.2 -> 0.0 | 26.9 -> 20.6 | 0.2 -> 0.0 |
| Island game-file requests on the network | 306 -> 24 | 299 -> 0 | 120 -> 93 | 136 -> 0 |
| Title JS before ready (KB) | 1108 -> 1138 | | 1108 -> 1138 | |

Unthrottled and warm runs are CPU-bound and move within noise; the gain is on a slow line (campus cold, -2.1 s) and
in revalidations (warm: none left). Over the wire on Vercel (brotli) the packed GLBs are 13.4 -> 10.2 MB.

The four steps, one commit each:
1. 88576ac4 versioned URLs: next.config.ts hashes public/{assets,models,audio} at production build
   (lib/assetVersions.ts) into env ASSET_VERSIONS; lib/assetUrl.ts appends ?v=<8 chars>; three's loaders go through it
   (DefaultLoadingManager.setURLModifier, lib/game/versionedLoads.ts, imported first in TitleScene and
   DefaultIslandWorld); audio, the loading still and the title prefetch call it. With v: immutable for a year; without:
   max-age=0, must-revalidate. entry-trace prints "game files without a version" (0).
2. a7e6b456 character parts once each: gltfsOf in Character.tsx (each part through useGLTF's per-file cache). entry-trace
   counts glTF parses (293 -> 273 on the island; no character file twice).
3. 2c003051 six entry PNGs to lossless WebP (6.6 -> 3.8 MB), sync-character-assets.mjs writes the character ones,
   look.ts worldWebp names them. Proof: specs/evidence/entry-perf/webp-pixels.md (decode and GPU readback, identical).
4. 11068008 entry GLBs packed losslessly by web/scripts/pack-glbs.mjs (meshopt per buffer view without quantizing or
   reordering, PNG images to WebP, each only where brotli serves it smaller): 217 of the 229 non-character entry GLBs.
   Proof: specs/evidence/entry-perf/glb-pack.md (229 of 229 identical as three loads them: data, texels, four renders
   each) and glb-spawn-before-after-diff.png. FishingRig's loader got drei's meshopt decoder; glbStats.readGlb decodes
   packed views for the asset tests.

Deleted: round 1's stale-while-revalidate header; the five world PNGs and the shop sign PNG (WebP now).

## David's decisions

- 2026-10-30: "make sure the performance to enter the game is good". This ships in v1.2. The release candidate is being built in parallel on game/release-v12 (eight lane branches merged: main quest, tutorial, daily social, volleyball, creator, rods, fishing depth, wardrobe).

## Next

Nothing open: round 2 is with the coordinator. Merge game/entry-perf; the deploy that carries step 1 must go out
before or with any later deploy that changes a game file in place.

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

- Round 2 helpers: specs/evidence/entry-perf/same-glb.mjs (GLB before/after as three loads them, headless),
  samepixels.mjs and gpupixels.mjs (image decode and WebGL readback compares). A HEAD request to play.tethos.ca was made
  once to see the CDN's encoding (brotli); don't repeat it, it's prod.

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

## Proposed, not changed (round 2)

- Quantized meshopt (gltfpack -c style) would cut the GLBs much further, but it moves vertices: not pixel-identical, so
  not done. Worth a look-at-the-game-camera review with David if more is wanted.
- Pack the character GLBs too (2.5 MB on entry; v8_clips.glb 428 -> 402 KB brotli): sync-character-assets.mjs would call
  packGlb on its copies and look.test.ts's byte-equal checks would become shipsCompressed.
- The other list loaders (ACNHBuilding, ShopDisplays, InstancedNature, GridCliffs) cache by the whole list too: a shared
  door GLB parses four times on entry. gltfsOf could move to a shared module, after checking each caller treats the
  scenes as read-only.
- The applicant island (recruitment code) still asks for bare URLs: it revalidates each file.
- Blender scripts that write into web/public overwrite a packed GLB with an unpacked one: rerun pack-glbs.mjs on it.

## Proposed, not changed (round 1)

- Lossless WebP for the big PNGs on the entry path: shop-sign-v1.png 1.74 -> 1.35 MB, hair_colour_world.png 1.61 ->
  0.88, v7_face_atlas_2_512.png 0.84 -> 0.43, outfits/designs.png 0.37 -> 0.10 (cwebp -lossless -exact). The character
  ones come from web/scripts/sync-character-assets.mjs, so the pipeline and character_catalog.json change with them.
- The entry GLBs are 25 MB raw (6.2 MB of it embedded images, 5 MB PNG): lossless WebP for the embedded images and
  meshopt geometry (the repo has @gltf-transform/cli and meshoptimizer) would cut the cold campus download most.
- Character parts: useGLTF([skin, ...parts]) caches by the whole list, so a part shared by two looks is fetched and
  parsed again per look (skin.glb three times on entry).
