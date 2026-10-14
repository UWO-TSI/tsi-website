# What each character effect costs

David, 2026-10-08: "for character effects, i want you to let me know if having them decrease performance". This is the
answer, per effect, measured on the other players at 1, 12 and 24 in the village, and (after the 2026-10-13 merge of
`feat/game-default-island` at 8a8d0bea) what the cinematic pass's sky dome and flowing grass, the terrain v2 world
and the title screen cost. Nothing about any look changed in this pass: every effect draws as it did; the cheaper
versions are proposals for David.

> **v1 pass (2026-10-14, `2026-10-v1-results.md`):** the four effects over their share below were fixed as proposed
> here: held items merged per look class with shadows only from Full players within 10 u (a tool +68 → +19 draws at 24
> players), no fishing rig on other players until casts replicate (+201 → +19), the leaf one mesh with no shadow on
> other players' (+64 → +21), other players' afterimages the body alone at LOD 1, and no face shadow. The weapon is
> still over (+84 → +49: a mesh per look class and glow) and hidden until v3. The tables below are the October
> measurement, kept as it was.

## Headline

**On the reference Mac mini (M4) a crowded village is limited by the main thread, and the main thread's cost is draw
calls: about 5 µs each here (and about as much GPU time). The effects that cost are the models in players' hands,
drawn part by part on everyone in view; the particle, aura and overlay effects cost close to nothing. The sky dome and
the flowing grass cost nothing measurable at the default settings; the v2 world's own size is the next thing to
watch.**

24 players on High, 12 of them Full (merged build, a quiet machine):

| Effect | Cost (24 players) | Over its share? | Cheaper version (same look up close) |
|---|---|---|---|
| **Fishing rig, line and cast** | **+200 draws, +0.89 ms** main thread, +0.84 ms GPU. The rod alone (rig idle): +67 draws, +0.35 ms; the cast adds the bobber's 5 parts and their shadows and the line: ~11 draws per angler | **Yes: 2.4× its draws, 3× its CPU** | Don't mount a remote's rig until remote casts are sent (no remote shows a cast today); the bite's "!" as a slot in the pooled nameplate layer, not a drei `<Html>` per rig; the rod's and the bobber's parts baked into one mesh each (vertex colours, as the clothes are), and no sun shadow from the bobber. About 200 → 70 draws |
| **Weapon in hand** | **+83 draws, +0.48 ms**, +0.39 ms GPU (3.9 a player in view; up to 12 parts a weapon) | **Yes: 2× its draws, 1.9× its CPU** | Merge each weapon's parts into one mesh at load; the sun shadow only from a Full player's in-hand weapon within ~10 u, never from one on the back. About 83 → 33 draws (−0.25 ms) |
| **Held tool** | **+64 draws, +0.39 ms**, +0.50 ms GPU (3.0 a player) | **Yes: 1.5× its draws, 1.6× its CPU** | The same merge (rods, nets and shovels are 3–5 parts), the same shadow rule. About 64 → 33 |
| **Leaf glider** | **+63 draws, +0.33 ms**, +0.37 ms GPU (3.0 a player, while gliding) | **Yes: 1.5× its draws, 1.3× its CPU** | The leaf's 3 parts in one mesh; a remote's leaf casts no sun shadow (yours keeps it). About 63 → 21 |
| Dash afterimages | +12 draws, **+19k triangles** while dashing; +0.08 ms | Within (the triangle cost is the largest of any effect) | On other players: the body only (not the face), from the LOD 1 mesh, none past ~10 u. About 19k → 8k triangles |
| Character sun shadows | +23 draws, +39k triangles (2 a Full player: body and face); +0.19 ms (±0.27) | Within | The face never needs to cast (its shadow falls inside the head's): −1 draw a player; cast from LOD 1 past ~10 u |
| Subclass aura | +16 draws for 8 auras (2 each: the scene and the ambient occlusion's transparency pass), +0.04 ms | Within | All auras in one instanced draw (8 × 11 motes), all family motes in one points draw, both kept out of the AO's transparency pass: 16 → 2 |
| Family aura | +15 draws for 8 auras, +0.05 ms | Within | As above |
| Step dust and prints | +2 draws (the scene's shared pools), +0.20 ms (±0.20) | Within | – |
| Movement juice (jump, land, dash, slide, glide, splash) | +1 draw, +0.3k triangles, +0.06 ms | Within | – |
| Nameplates and the label layout | 0 draws, nothing measurable (12 pooled plates) | Within | – |
| Emote one-shots | 0 draws, nothing measurable | Within | – |
| Remote interpolation | 0 draws; **0.08 µs a player a frame** (microbenchmark; 3 µs for a shard of 40) | Within | – |
| Everything the bots do on their own ("natural") | +48 draws, +40k triangles, **+0.41 ms** | – | – |
| Every effect forced at once ("stacked") | **+280 draws, +77k triangles, +1.40 ms** main thread, +1.68 ms GPU: 36% on top of the base's 3.9 ms | – | – |

"Share" is the effect's line in the budget (`budget.md`, `EFFECT_BUDGET`): 2 draws per player in view for what a player
carries (its scene draw and, on Full players, its shadow) and 0.25 ms of main thread for everyone in view (auras 2 an
aura; the shared pools and the DOM overlays 0 draws). Four effects are over it, all for one reason: **models held in
the hand are drawn part by part on every player in view, and each part again in the sun's shadow map on the Full
ones**. A 12-part weapon is 24 draws on each Full player holding it. The cheaper versions above together would take
the stacked case from +280 to about +150 draws (−0.65 ms on this machine, about −1 ms on an M1 or Iris Xe laptop).

## World costs: the sky dome, the flowing grass, the v2 world, the title

`world-bench.mjs`: each change against the world as shipped (24 bots in view), bracketed the same way, High.

| Scene | As shipped | Sky dome → the old gradient | Grass 13 → 6 tufts per 100 cells (before the cinematic pass) | Grass → none |
|---|---|---|---|---|
| Village, 1280 × 800, pixel finish (the default) | 4.2 ms frame, 4.4 ms main thread, 466 draws, 434k triangles | −6 draws, −5k triangles; frame +0.02 (±0.13), GPU +0.09 | −6 draws, −6k triangles; frame −0.10 (±0.08) | −5 draws, −7k triangles; frame 0.00 (±0.07) |
| v2 world, 1280 × 800, pixel finish | 5.5 ms frame, 5.6 ms main thread, **696 draws, 1.04M triangles** | −2 draws, −5k triangles; frame −0.05 (±0.28) | **−147k triangles**; frame −0.08 (±0.12) | −9 draws, **−267k triangles**; frame −0.05 (±0.25) |
| Village, 1920 × 1200, no pixel finish (GPU-heavy) | 9.5 ms frame (GPU-bound: 4.8 ms main thread) | −5 draws; frame +0.12 (±0.22), GPU +0.38 | frame −0.05 (±0.07) | frame −0.05 (±0.12), GPU +0.17 |
| v2 world, 1920 × 1200, no pixel finish | **17.1 ms frame, p95 34.9 ms** (GPU-bound: 6.4 ms main thread) | frame +0.77 (±1.02), GPU +1.41 | −146k triangles; frame −0.18 (±0.67) | **−269k triangles, frame −0.40 (±0.25)**, GPU −0.26 |
| Village on Lite (no dome on Lite) | 2.3 ms frame, 339 draws | no change (Lite draws the gradient) | −6 draws, −6k triangles; frame −0.05 (±0.12) | −9 draws, −8k triangles; frame 0.00 (±0.08) |
| Title screen (`/student`, its own canvas, 0.65 pixel scale) | **2.5 ms frame, p95 3.5 ms, 1.8 ms main thread** | – | – | – |

- **The sky dome costs nothing measurable.** It is one sphere (3k triangles, about 5 draws over the passes) and its
  fragment shader runs on the pixel-finish canvas (half resolution). Switching it back to the gradient was, if
  anything, slower at full resolution (+0.4 to +1.4 ms of GPU, inside the spread): the dome replaced a full-screen
  gradient, not nothing. Nothing to do.
- **The flowing grass costs nothing measurable in the village** (a few thousand triangles, its wind in the vertex
  shader). **In the v2 world it is 267k triangles, a quarter of that world's 1.04M**, because the grass is per grass
  cell and v2 (384 × 552 cells) has many times the village's; at full resolution that is ~0.4 ms of frame. Not a problem on the M4 at the default
  settings; on a weaker GPU it is the first thing the v2 world should trade. Cheaper version when it matters: tufts by
  distance (full density within ~30 u of the camera, a quarter past it: the far ones are a pixel or two), or the
  governor's lowest step thinning them.
- **The v2 world itself is the cost to watch**: 696 draws (+49% on the village) and 1.04M triangles with the same 24
  players; 5.5 ms a frame at the default settings, but 17 ms with a 35 ms 95th percentile at 1920 × 1200 without the
  pixel finish, where the village is 9.5 ms. It is a sizing draft, not the shipped island; when it becomes one, it
  needs the world's draw calls batched (the next step `2026-10-results.md` already names) before it adds anything.
  It is now a perf:check scene, so its regressions are caught from here on.
- **The title screen** is light (2.5 ms) and has no probe; it is not in perf:check (its files belong to the play
  subdomain session).

## The v1 land pass: the grass field, the rocks, the light, the title (2026-10-14)

`game/v1-land` (specs/v1-drop.md §8b/§8c). Three measurements, all on the M4 with 24 bots:

**The lane against main** (`ab.sh`, interleaved, 2 rounds, load 3.4–7.2: soft), main 754c4a01 → v1-land fbef77ac, so
only this lane differs:

| Scene | Frame ms | Frame CPU ms | Draws | Triangles |
|---|---|---|---|---|
| Village, High | 4.5, 5.1 → 5.2, 5.1 | 3.9, 4.4 → 4.5, 4.3 | 489 → 481–484 | 492k → 522–525k |
| v2 world, High | 7.0, 6.9 → 7.4, 6.8 | 6.4, 6.2 → 6.8, 6.1 | 728–730 → 732 | **1.10M → 930k** |
| Village, Lite | 2.8, 2.8 → 2.9, 2.5 | 2.4, 2.4 → 2.6, 2.2 | 351 → 348 | 344k → 344–346k |
| v2 world, Lite | 3.8, 3.1 → 3.7, 3.2 | 3.5, 2.9 → 3.4, 3.0 | 509 → 510 | **833k → 634k** |

Lite is unchanged within the noise; High is about +0.15–0.3 ms of frame on these busy runs. Draws are flat (the old
tufts' 3 draws for the field's 2 and the boulders' 6). The v2 world sheds about 170k triangles on High and 200k on
Lite: the field costs the same whatever the island's size, where the tufts were per grass cell.

**Each piece** (`world-bench.mjs`, the piece off against the build as shipped, 3 valid pairs each, load 2.6–3.7):

| Piece | Village, High | v2 world, High | Village, Lite | v2 world, Lite |
|---|---|---|---|---|
| Grass field (`grass0`) | 0.00 ms (±0.08), 2 draws, 42k tris, GPU 0.06 | **0.15 ms** (±0.07), 3 draws, 40k tris, **GPU 0.59** | 0.10 ms (±0.05), 8k tris | 0.10 ms (±0.05), 8k tris |
| Cliff-foot boulders (`rocksOff`) | none (no cliffs) | 0.05 ms (±0.10), 8 draws, 61k tris | none | 0.10 ms (±0.05), 6 draws, 60k tris |

The title: **2.8 ms frame, p95 3.7 ms, 1.8 ms main thread** (was 2.5 / 3.5 / 1.8): the tilt-shift's two passes and
the close lawn. The light and haze are constants in shaders that already ran (a warmer and cooler colour, AO's radius,
a few ALU in the fog chunk): no separate switch, inside the lane's A/B above.

**perf:check** on the final merged tree (ea7f6adb, main ccb2c818 merged; 2026-10-14 05:37, load 3.2–3.8) against the 10-13 baseline
held every SCENE_BUDGET (village High 518k of 560k triangles, ruins High 267k of 280k, ruins Lite 206k of 210k after
the rocks were rebuilt lighter) and flagged frame time over 10% on v2 High (6.3 vs 5.5 ms) and village Lite (2.6 vs
2.2). Those include every lane merged since the baseline (water's own A/B: v2 High 5.6 → 5.95 ms); the lane's own
share is the A/B above. The baseline wants `perf:check -- --update` on main once the v1 lanes are in.

**The gate** (after these runs): the blade field and the cliff-foot boulders draw only in a world that passes its
obstacle list (the village, the v2 world, the title). The applicant island (live for recruits), the ruins and the home
island keep main's tufts and no boulders (GridWorld `grassLayer`), so the ruins rows above (field and boulders) are
now back to main's; the village and v2 rows are unchanged.

The grass's GPU share on the v2 world (0.6 ms at 1280 × 800 with the pixel finish) is its fragment overdraw: the first
thing to trade on a weak GPU is High's near layer (2 cards → 1, about −0.3 ms GPU) or `grass.density`.

## The smooth world's terrain (world editor, 2026-10-14)

`game/world-editor` (specs/world-editor.md). The v2 world's ground is now the smooth heightfield, which replaces the cell
terrain, the cliff kit and the cliff-foot boulders for that world only. These are headless runs (`HEADLESS=1`, the
agents' browser rule on the shared Mac mini) of the measurement build at da8a7bc9, 24 bots, 3 runs per tier, load
4–6, so the numbers are soft. The cell draft is benched in the same build as `v2cells` (`?fixture=v2-cells`), so the
swap is priced like for like. Compare headless with headless: the same build's village reads 5.2 ms on High against
main's headed 3.9.

| Scene | Tier | Median frame ms | p95 ms | Frame CPU ms | Draws | Triangles | Spread | SCENE_BUDGET v2 (frame / p95 / CPU / draws / tris) |
|---|---|---|---|---|---|---|---|---|
| v2 smooth | High | **5.70** | 9.10 | 5.10 | **208** | **613k** | 25% | 6.5 / 10 / 6 / 760 / 1.2M: within |
| v2 cells (before) | High | 8.50 | 11.70 | 7.80 | 252 | 912k | 35% | over on this busy machine (headed baseline 5.4 / 6.8 / 5.0) |
| village | High | 5.20 | 6.60 | 4.40 | 381 | 537k | 29% | 6 / 9 / 5 / 560 / 560k: within (unchanged path) |
| v2 smooth | Lite | **2.80** | 3.40 | 2.60 | **147** | **327k** | 0% | 4 / 6 / 3.5 / 560 / 950k: within |
| v2 cells (before) | Lite | 2.90 | 3.30 | 2.70 | 173 | 629k | 0% | within |
| village | Lite | 2.30 | 3.40 | 2.00 | 288 | 353k | 0% | 4 / 6 / 3.5 / 420 / 420k: within (identical to main's 2.3 / 288 / 354k) |

In each High run the smooth world was faster than its cell draft (4.8 vs 8.5, 6.2 vs 8.8, 5.7 vs 5.8 ms), with 45 fewer
draws and 300k fewer triangles. On Lite they tie on frame time, with 26 fewer draws and 300k fewer triangles.

**Each piece** (draws and triangles from a `renderBufferDirect` tally over 30 frames at the spawn, the scene pass; CPU
in Node on the M4 from the same code the game runs):

| Piece | High | Lite | CPU |
|---|---|---|---|
| Ground chunks (32 × 32 cells, 4 levels of detail, skirts) | 17 draws, 79k tris | 17 draws, 79k tris | 0.02 ms a frame (level choice and culling); first build of what's in view 29 ms spread over the first frames, 6 chunks a frame at most; worst frame flying across the island 0.85 ms |
| Water over the land's dips (a quad a cell, 128-cell blocks) | 10 draws, 219k tris | 5 draws, 110k tris | built once at load, 48 ms with the view |
| Splat material (paint, rock by slope, wet band, seabed fog) | in the chunks' draws | same | 4 reads of an 850k-texel RGBA paint map a pixel; no texture else |
| Shore field (the water's colour and foam, from the heights) | none | none | 238 ms once at load (the cell world baked its own from the cells) |
| Loading the files | none | none | 23 ms to decode the two PNGs, 5 ms for the derived cell map, 58 ms for the village |
| Grass blades | 2 draws, 40k tris | 1 draw, 8k tris | unchanged from the v1 land pass (its sampler now reads the paint) |
| Cell terrain before (ground, overlays, rock, water, bed, fringe) | 45 draws, 557k tris | 27 draws, 403k tris | none now on v2 |
| Cliff kit and boulders before | 19 + 8 draws | 13 + 6 draws | none now on v2 |

The water is the heaviest piece in triangles (a quad per wet cell in view, as the cell world drew it). If a weak GPU
needs it, the first trade is merging open-water cells far from any shore into bigger quads, but the swell is per
vertex, so keep cell-sized quads along the shore and the map's edge.

**The editor** (`/lab/world`, dev only, no budget beyond staying smooth): a brush frame rewrites only the chunks it
touches. Radius 5 costs 1.05 ms and radius 20 costs 2.8 ms a frame (the stroke and the rewrite), and the shore field's
re-bake for the stroke's region when it ends costs 2–4.5 ms. Headless at 60 Hz it held 60 FPS throughout, worst frame
17.7 ms. The HUD shows the worst frame and the edit time live.

## Look fixes from playtest round 1: wide shallows, far sparkles, the kept face (2026-10-14)

`game/look-fixes` (specs/playtest-round1.md). One `perf:check` (headless, the measurement build at 106c0690, 3 runs a
tier, load 3.9-4.3; split by tier only to keep each call under ten minutes), against the 10-14 baseline (8809c517,
headed): every scene passed and held SCENE_BUDGET.

| Scene | Tier | Median frame ms | p95 ms | Frame CPU ms | Draws | Triangles | SCENE_BUDGET |
|---|---|---|---|---|---|---|---|
| village | High | 3.90 (3.90) | 4.90 (4.90) | 3.40 (3.40) | 382 (382) | **556k** (538k, +3.4%) | 560k: **4k of headroom** |
| village | Lite | 2.30 (2.30) | 3.40 (3.40) | 2.10 (2.00) | 284 (288) | 359k (354k) | 420k: within |
| v2 | High | 3.70 (5.40) | 4.80 (6.80) | 3.20 (5.00) | 206 (254) | 608k (912k) | within |
| v2 | Lite | 2.70 (3.00) | 3.40 (3.70) | 2.40 (2.80) | 144 (172) | 328k (629k) | within |

The v2 rows' drop against the baseline is the world editor's smooth terrain (merged after it), not this lane.

**Each piece:**

| Piece | Cost |
|---|---|
| Wide shallows, village (seabed.ts setShoal) | No new draws. The seabed's props follow the depth, so more of them grow on the wider shelf: 618 -> 901 instances on High (seagrass 84 -> 404; rocks breaking the surface, with foam collars, 12 -> 24, still inside the 32 foam-ring slots), 145 -> 295 on Lite. In the same dev session at the bench's framing (world only): draws 328 -> 332, triangles 486k -> 509k. The bake at load: 2-3.5 ms -> 8-14 ms (the open-water max filter, once a field). Fish: 12 schools, 92 -> 97 fish. |
| Wide shallows, v2 (convert.ts shelf, height.png regenerated) | Geometry only: the same mesh, its seabed heights changed. Dev session, the bench's framing: draws 230 -> 226, triangles 656k -> 660k (its props follow the depth too). |
| Sparkle fold fade (waterShader.ts WATER_FOLD) | About a dozen ALU in the sprites' vertex shader (one view-matrix column, two normalizes, a dot, a smoothstep), on the glint points only; sprites past the fold are now size 0. Nothing measurable. |
| Sparkle fog (GridOcean GLINT_FOG) | Replaces the fog chunk's mix with a multiply in the sprites' fragment shader: free. It is what removed the band of pale dots under the horizon (dot pixels in the 30 rows under the horizon on the 16:30 low shot: 922 -> 56 at zoom 1.6, 836 -> 3 at zoom 1). |
| Kept face (face.ts FaceAnimator.keep) | One boolean a frame: none. |

The village's High triangles are the one to watch: 556k of 560k. If the next look change needs room, the cheapest
trade is the seagrass on the shelf (`seabedProps.ts` seagrass_a's depth floor 0.14 -> 0.35 keeps the sandy band
bare, 404 -> 265 plants, on the order of 8k triangles back).

Evidence: `specs/evidence/look-fixes/` (shallows before and after on both worlds, from the game camera, from above
and at each wharf, and as depth maps; the 16:30 sparkle shots; the emote faces).

## How it was measured

- **Builds:** the measurement build (`measure-build.sh`: production `next build`, the development gates lifted). The
  24-player numbers on High and Lite, and every world number, are on the merged build (53c23490: main street, terrain
  v2, sky dome, flowing grass, title). The 1- and 12-player numbers are on the build before the merge (25cdd73d,
  778e14ea): the character effects' code didn't change in the merge (only the face atlas's second page), and the
  pre-merge 24-player run (`runs/fx-high-n24.jsonl`, `runs/fx-lite-n24.jsonl`, on a busier machine) agrees with the
  merged one on every draw count and within its spread on time.
- **Browser:** Chrome for Testing 147 (Playwright), headed with the real GPU (ANGLE on Metal), `--window-position=2400,0`,
  `--mute-audio`, never brought to the front, 1280 × 800 at DPR 1 unless noted, uncapped (`--disable-gpu-vsync
  --disable-frame-rate-limit`) so a frame's time is what it costs. High (shadows, AO) unless noted, the pixel finish on.
- **Scene:** the village, `?bots=N` (the loopback: N players with the real movement kit and their own cards), at the
  spawn. For the effects, the other players stand in a block in front of you (`lib/game/perf/fxBench.ts` `formation`:
  rows of six, 1.5 u apart, 3.5–10 u out), their own animation playing on the spot, so the same players are in view at
  the same distances for every sample. With 24 bots, 21 are in the village (the rest study in the café): 12 Full and 9
  Reduced on High, 8 and 8 on Lite; with 12, 10 in view, 8 Full (two rest on phones, Reduced at most); with 1, 1 Full.
  You are put back on your spot before every sample.
- **Switches** (`lib/game/perf/fxBench.ts`, development only; production reads every effect as on): the base is every
  effect off (`?fxoff=all`). Each effect is then **forced on every player in view** where it can be (what players carry
  shows on every drawn player, Full and Reduced; one-shots, auras and casts only on Full ones, as in play): an aura on
  everyone (the subclass one at mastery 20, its heaviest), an afterimage every 0.4 s, an emote every 3 s, a movement
  event every 0.5 s cycling take-off, landing, dash, slide, glide and splash, a tool, a weapon, a rod or a rod with a
  cast in every hand, the leaf open. What follows the players' own play (dust, plates, shadows, interpolation) is just
  switched on. "natural" is every effect on and nothing forced.
- **Pairs:** each effect is measured between two base samples (4 s each, after 1.5 s to settle) and the median over 4
  rounds is taken (3 on Lite). A pair counts only when its two bases agree within 20% and sit within 1.5× the quietest
  base (`fx-bench.mjs`; a foreground game, Blender or a build could triple the frame for a while on the first,
  pre-merge runs); rejected pairs were retried (0–2 per run on the merged build).
- **Measures:** draw calls and triangles over every pass (`components/game/PerfProbe.tsx`); main-thread time per frame
  from the DevTools Performance domain in thread time (script, style, layout: it sees the DOM plates the probe can't);
  frame CPU (the probe: first frame callback to the end of the render); GPU time per frame
  (`EXT_disjoint_timer_query_webgl2`, which this Chrome exposes); the renderer's geometries, textures and programs; the
  JS heap. Tables: `node specs/perf/fx-table.mjs specs/perf/runs/fx-*.jsonl` (and the `world-*.jsonl` rows).

### How far to trust each number

| Measure | Trust | Why |
|---|---|---|
| Draws, triangles, geometries, programs | **High** | Counted, not timed; they move by a draw or two as the players' clips change. |
| Main thread and frame CPU | **Medium-high on the merged runs** (load 3.3–4.9, spreads ±0.05–0.2 ms): differences over ~0.15 ms are real. **Medium on the pre-merge 1- and 12-player runs** (load 5–20: Roblox in the foreground, Blender, builds; spreads up to ±0.47): read those under ~0.3 ms as "not measurable". | Medians of bracketed pairs; the ± is half the spread of the frame-time differences; thread time, so being descheduled doesn't count, but a busy machine still slows the thread. |
| GPU time | **Medium on the quiet merged runs, low before** | The timer measures elapsed GPU time, which includes other apps' GPU work and overlapping frames (the base read 4.5 ms of GPU against a 3.7 ms frame). On the quiet runs the deltas track the draws (about 5 µs a draw); on the busy runs they were noise. |
| Uncapped frame time | As the main thread at 1280 × 800 (the village is CPU-bound: main thread 3.9 ms, frame 3.7 ms); GPU-bound at 1920 × 1200 without the pixel finish | |
| JS heap | **Low** per effect (±10–15 MB of garbage-collection noise); **medium** per player | From the bases: 118 MB with 1 player, 167 with 12, 223 with 24 (about 5 MB a player, the loopback's own bots included) and 7.5 renderer geometries a player. |

## Per effect, at 1, 12 and 24 players (High)

Each cell: draws / triangles / main-thread ms (± half the spread), the effect on minus the base; at 24 also the GPU ms.

| Effect | 1 player (1 Full) | 12 players (8 Full) | 24 players (12 Full) |
|---|---|---|---|
| Subclass aura | +2 / 0k / -0.01 (±0.35) | +17 / +0.3k / +0.03 (±0.35) | +16 / +0.4k / +0.04 (±0.17) / GPU +0.13 |
| Family aura | +2 / 0k / +0.04 (±0.17) | +17 / 0k / -0.24 (±0.33) | +15 / 0k / +0.05 (±0.05) / GPU +0.10 |
| Step dust and prints | +1 / 0k / +0.10 (±0.20) | 0 / 0k / -0.06 (±0.20) | +2 / 0k / +0.20 (±0.20) / GPU +0.32 |
| Movement juice | +2 / 0k / +0.05 (±0.30) | +1 / +0.2k / -0.16 (±0.42) | +1 / +0.3k / +0.06 (±0.15) / GPU +0.05 |
| Dash afterimages | +1 / 0k / +0.20 (±0.25) | +8 / +13.5k / +0.08 (±0.47) | +12 / +19.4k / +0.08 (±0.05) / GPU +0.06 |
| Leaf glider | +3 / +0.3k / +0.06 (±0.18) | +29 / +2.6k / +0.22 (±0.10) | +63 / +5.5k / +0.33 (±0.03) / GPU +0.37 |
| Held tool | +1 / 0k / +0.13 (±0.15) | +24 / +1.8k / +0.25 (±0.28) | +64 / +5.2k / +0.39 (±0.07) / GPU +0.50 |
| Weapon in hand | +2 / +0.2k / +0.05 (±0.08) | +35 / +2.3k / +0.37 (±0.30) | +83 / +6.0k / +0.48 (±0.12) / GPU +0.39 |
| Rod, rig idle | – | – | +67 / +4.6k / +0.35 (±0.12) / GPU +0.46 |
| Fishing rig, line and cast | +16 / +0.8k / +0.16 (±0.10) | +113 / +5.8k / +0.69 (±0.35) | +200 / +10.8k / +0.89 (±0.22) / GPU +0.84 |
| Nameplates and label layout | 0 / 0k / -0.01 (±0.40) | +1 / 0k / +0.09 (±0.12) | 0 / 0k / -0.05 (±0.10) / GPU +0.02 |
| Character sun shadows | +2 / +3.8k / +0.07 (±0.17) | +17 / +27.0k / -0.01 (±0.22) | +23 / +38.7k / +0.19 (±0.27) / GPU +0.09 |
| Emote one-shots | 0 / 0k / -0.04 (±0.12) | 0 / 0k / +0.10 (±0.30) | +2 / 0k / +0.03 (±0.15) / GPU +0.04 |
| Remote interpolation | 0 / 0k / +0.06 (±0.17) | -1 / 0k / +0.14 (±0.20) | 0 / 0k / +0.01 (±0.07) / GPU +0.05 |
| Natural (the bots' own) | +5 / +3.9k / +0.03 (±0.30) | +29 / +27.2k / +0.20 (±0.22) | +48 / +39.9k / +0.41 (±0.05) / GPU +0.49 |
| Stacked (all forced) | +17 / +4.9k / +0.01 (±0.27) | +158 / +49.9k / +0.69 (±0.20) | +280 / +76.6k / +1.40 (±0.15) / GPU +1.68 |

The base itself (every effect off): with 1 player 390 draws and 4.3 ms of main thread; with 12, 401 and 5.2 ms (busy
machine); with 24 on the merged build, 426 draws, 406k triangles, 3.9 ms of main thread and a 3.7 ms frame. Each drawn
player adds about 1.8 draws with every effect off.

Per item, the cost depends on the model: weapons are 3–12 parts (the twin tantos 12, most 4–6), tools 3–5, the leaf
3, the bobber 5. At 1 player the weapon and the tool happened to be light ones; at 12 and 24 the mix averages 3.5–3.9
draws a player for a weapon and 2.4–3.0 for a tool.

## Lite, 24 players (8 Full, 8 Reduced)

Lite draws no sun shadow maps and no ambient occlusion: the base is 331 draws, 2.3 ms of main thread, a 2.2 ms frame.
Its users are the weaker machines, where each draw costs more.

| Effect | Draws | Triangles | Main thread ms (±) | Per player in view (16) |
|---|---|---|---|---|
| Subclass aura | +9 | +0.2k | +0.07 (±0.05) | 1 an aura (no AO pass) |
| Family aura | +9 | 0k | +0.04 (±0.00) | 1 an aura |
| Step dust and prints | +1 | 0k | -0.02 (±0.07) | – |
| Movement juice | +1 | +0.1k | +0.02 (±0.05) | – |
| Dash afterimages | +8 | +13.3k | +0.19 (±0.05) | ~1 a Full player |
| Leaf glider | +48 | +4.2k | +0.35 (±0.10) | 3.0 |
| Held tool | +49 | +3.7k | +0.24 (±0.05) | 3.1 |
| Weapon in hand | +61 | +4.2k | +0.33 (±0.23) | 3.8 |
| Rod, rig idle | +48 | +3.0k | +0.30 (±0.25) | 3.0 |
| Fishing rig, line and cast | +97 | +5.6k | +0.46 (±0.10) | 6.1 |
| Nameplates | -1 | 0k | +0.10 (±0.05) | – |
| Character sun shadows | -1 | 0k | -0.01 (±0.05) | none on Lite |
| Emote one-shots | +1 | 0k | +0.03 (±0.02) | – |
| Remote interpolation | -1 | 0k | -0.02 (±0.07) | – |
| Natural (the bots' own) | +11 | +0.5k | +0.27 (±0.20) | – |
| Stacked (all forced) | +126 | +22k | +0.83 (±0.08) | – |

The same four are over their share on Lite, and by more relative to the frame: the stacked effects add 36% to Lite's
main thread (0.83 of 2.3 ms), as on High (1.40 of 3.9 ms). With no shadow pass a held item costs its parts: 3–3.8
draws a player.

## Notes on each effect

- **Auras.** Eight at most (the nearest Full players who show their class), each its own draw; the motes are
  transparent, so High's ambient occlusion draws them a second time in its transparency pass. The subclass aura's
  11 quads and the family aura's 7 points cost nothing else measurable. Programs: +1 (the aura material compiles once).
- **Dust, prints, juice.** One particle system a scene, shared by every avatar (384 particles and 160 prints, two
  draws whoever throws): forced on all Full players they add the system's draws once and a few hundred triangles. The
  pool's fixed size is its own budget (a crowd's dust takes turns in the ring, it never grows).
- **Afterimages.** Each dash freezes a copy of the body and the face (two skinned meshes, drawn blended for 0.2 s; two
  copies kept per player, used in turn). The draws are few, but each copy is the whole look (~3–4k triangles): 19k
  extra triangles on average while 12 players dash every 0.4 s.
- **Leaf, tools, weapons.** Drawn part by part on every player in view (Full and Reduced), each part again in the
  moving casters' shadow map on Full ones. That is the whole cost: their per-frame code (placing the item in the hand)
  is small next to the draws.
- **Fishing.** A rod in hand mounts the whole rig: the rod's parts, the bobber (hidden until a cast), a line ribbon, a
  drei `<Html>` for the bite's "!" (its own React root, projected every frame) and the water rings. The rod with its
  idle rig is +67 draws at 24 (3.2 a player, about the same as a tool); a cast adds the bobber's 5 parts and their
  shadows and the line, ~11 draws an angler. Remote casts are not sent yet (`specs/multiplayer.md` follow-up): today
  other players show only the rod and the idle rig, so the cast's 133 draws arrive the day casts replicate. That is
  the moment to land the cheaper version.
- **Plates.** One pooled DOM layer of 12 paper tags laid out after the frame (`lib/game/labelLayout.ts`), moved only
  when they move half a pixel: no draws, and no style or layout time the DevTools domain could see.
- **Shadows.** The Full players' bodies and faces in the sun's moving-caster map: 2 draws and ~3.2k triangles each.
  Reduced and hidden players cast none already.
- **Emotes.** A one-shot clip on the mixer the player already steps: nothing measurable.
- **Interpolation.** Sampling a player's ring of poses (cubic Hermite, the events since last frame) is 0.08 µs in
  Node's V8 (`lib/net/interp.ts`, 24 players × 20,000 frames); every player in view is sampled every frame, drawn or
  not. The loopback's bots also step their own movement on the page's main thread (36 ms a second for 24, about
  0.18 ms a frame): a cost of the bench, in every sample alike, that real players don't put on you.
- **Walk-along v2 and the reflection creator (game/tutorial-v2, 2026-10-14).** No new GPU effect. Bram's "!" and the
  quest tracker are DOM (the "!" toggled through `hidden` from the frame loop, the tracker re-rendered only when a step
  changes). The face shader draws one slot fewer (eyebrows removed). The creator's new framing is the same scene and
  passes: 16 draws a frame in its canvas, 16.7 ms a frame headless at 1440x900, as before. The route's crate is the
  one crate model the pier already drew.
