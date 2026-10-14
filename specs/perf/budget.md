# Performance budget

The ceilings every visual change is held to (process: `README.md`). The numbers live in code,
`web/lib/game/perf/budget.ts`, so the checks read the same ones this page explains: `budget.test.ts` in the normal
gate (assets, particle pools, lights, LOD coverage, network) and `npm run perf:check` (the scenes, against
`baseline.json`).

## Where the numbers come from

- **Reference machine:** the Mac mini M4 (10-core CPU, 10-core GPU, 16 GB), Chrome for Testing 147, 1280 × 800 at
  DPR 1, the pixel finish on (the canvas at half resolution), uncapped. Every figure below is that machine's.
- **Member floor:** 60 FPS at the display's pace (16.7 ms a frame) on an M1 / Iris Xe class laptop, which is about
  1.6× slower than the M4 on one CPU core and 2–2.5× slower on the GPU. On the M4 the busy scenes are **CPU-bound** (the
  main thread's work per frame is about the whole uncapped frame: `effects-cost.md`), so the binding number is main-thread
  time: **at most ~6 ms a frame (5–6 ms of frame CPU) on the M4 on High** leaves the floor machine at ~10–14 ms, with
  room for the frame's other costs (compositing, GC, a busy laptop). Lite is what the weakest machines run: 4 ms.
- **Measured:** the scene bench (`perf-bench.mjs`: the first pass, `2026-10-results.md`, and `baseline.json`), the
  effect bench (`fx-bench.mjs`) and the world bench (`world-bench.mjs`), both in `effects-cost.md`.
- **The currency is draw calls.** Each draw costs the main thread about 5 µs on the M4 (three.js's state changes and
  uniform uploads, a material change on most) and about as much GPU time, so 100 more draws is about 0.5 ms of frame
  here and 0.8–1 ms on the floor machine. Triangles are nearly free at these counts on the M4 at the default settings
  (the v2 world's 1.04M only show once the pixel finish is off at 1920 × 1200). Budgets count draws first.

## Headroom for 40 players

A shard holds 40 (`specs/multiplayer.md`). The render caps already bound what more players cost: on High the nearest
12 in view are Full, the next 12 Reduced (no shadow, no effects, the mixer at 15 Hz), the rest hidden and only
interpolated (0.08 µs each a frame: `effects-cost.md`); on Lite 8 and 16. The benches' 24 bots put 21 in the village
(12 Full and 9 Reduced; the rest study in the café), so a full shard adds at most 3 drawn (Reduced) players on High and
16 hidden ones:

| | Measured, village, 24 bots in view (merged build) | Per drawn player | A full shard of 40 adds |
|---|---|---|---|
| Draw calls (every pass) | 426 with every effect off, 474 with the bots' own effects (464 at the spawn without the block) | ~1.8 with effects off; ~4 with a held item and the shadow | ~12 draws (3 Reduced players carrying something) |
| Main thread | 3.9 ms off, 4.3 ms with their effects | ~0.02 ms; ~0.05 with effects | ~0.15 ms, and 1 µs of interpolation |
| JS heap | 223 MB | ~5 MB (the look's merged meshes, its mixer, the loopback's bot) | ~80 MB |

So 40 players is about 3% more frame than 24 here; the budgets below leave ~20% over today's draws for content and the
shard, under the floor machine's ceiling.

## Scenes (`SCENE_BUDGET`)

Uncapped on the reference machine; the perf:check scenes. "Today" is `baseline.json` (53c23490, the merged build:
main street, terrain v2, sky dome, flowing grass; median of 3 runs, load 3.7–5).

| Scene | Tier | Budget: frame / p95 / frame CPU ms | Budget: draws / triangles | Today: frame / p95 / CPU ms | Today: draws / triangles |
|---|---|---|---|---|---|
| Village, 24 players | High | 6 / 9 / 5 | 560 / 560k | 4.0 / 5.0 / 3.4 | 464 / 422k |
| Village, 24 players | Lite | 4 / 6 / 3.5 | 420 / 420k | 2.2 / 3.3 / 1.9 | 336 / 327k |
| v2 world draft, 24 players | High | 6.5 / 10 / 6 | 760 / 1.2M | 5.5 / 6.7 / 4.9 | **697 / 1.04M** |
| v2 world draft, 24 players | Lite | 4 / 6 / 3.5 | 560 / 950k | 3.0 / 3.6 / 2.7 | 487 / 819k |
| Café, 24 bots | High | 4 / 6 / 2.5 | 180 / 110k | 2.1 / 3.2 / 1.2 | 139 / 70k |
| Café, 24 bots | Lite | 2.5 / 4.5 / 1.5 | 140 / 90k | 1.4 / 2.5 / 0.7 | 105 / 68k |
| Ruins fight, Shadow Garden | High | 5 / 10 / 4 (ult hitch 40 at the display's pace) | 480 / 280k | 3.1 / 5.1 / 2.5 | 417 / 228k |
| Ruins fight, Shadow Garden | Lite | 3.5 / 7 / 2.5 (ult hitch 33) | 290 / 210k | 1.9 / 4.4 / 1.5 | 236 / 166k |

The v2 world is a sizing draft, and already 50% over the village's draws with the same players: its budget holds it
where it is, not where a shipped island should be. Before it ships it needs the world's draw calls batched
(`2026-10-results.md`, "Not done"), and then its budget comes down to the village's. The ruins have no other players
yet (party play is next, `specs/multiplayer.md` §11): their budget leaves ~60 draws for a party of 4. Ult hitches are
measured at the display's pace (`perf-bench.mjs` `UNCAPPED=0`), not by perf:check.

## One character (`CHARACTER_BUDGET`)

| Tier | When | Triangles (whole look) | Draws | Shadow draws | Materials | Bones | Mixer |
|---|---|---|---|---|---|---|---|
| Full | within 21 u, or a Full remote (nearest 12 / 8) | 7,800 | 3 (body, face, print) | 2 | 1 (shared) | 22 | every frame |
| LOD 1 | past 21 u and under 72 px | 5,100 | 3 | 2 | 1 | 22 | 30 Hz past 28 u, 15 Hz past 40 u |
| LOD 2 | past 40 u and under 28 px | 4,000 | 3 | 2 | 1 | 22 | 15 Hz |
| Reduced remote | the next 12 / 8 (drawn at LOD 1 or 2 by distance) | 5,100 | 3 | 0 | 1 | 22 | 15 Hz |

**Head-roblox (2026-10-14, `specs/characters/head-roblox.md` §7):** the hair is David's 21 Roblox hairstyles, whole at
Full (David: "hair should look good close up"), so the heaviest wearable look (every accessory slot filled) is 7,700
triangles at Full, 5,014 at LOD 1 and 3,958 at LOD 2 (was ~5,070 and ~4,030 with the decimated styles). LOD 2 is the
hair only (about 1,100 a style; David: "lower poly like 2400 triangles for hair when far"); every other part draws its
LOD 1 there. `budget.test.ts` computes all three; a whole hairstyle replaces the bangs and the back. The base is the
catalogue's clip base (`base/v8_clips.glb` since the head fit: the same 1,264 triangles of skin and face). Held items are budgeted as
effects (below). The multiplayer spec's targets stay: at most 0.12 ms of CPU per Full remote and 3 ms for 24 drawn, at
most +5 draws per drawn remote on High and +3 on Lite (`PER_PLAYER`).

## Effects on characters (`EFFECT_BUDGET`)

An effect's **share**: what it may add when every player in view shows it. Draws per player in view for anything a
player carries (its scene draw on every drawn player, and its shadow on the Full ones: 2 when the item is one mesh);
main-thread time for everyone in view (12 Full and 9 Reduced at 24 players on High). No effect adds a light, ever (a
light appearing recompiles every lit material: the first-ult stall of `2026-10-baseline.md`).

| Effect | Draws per player | CPU ms (all in view) | Particles | Measured, 24 players on High (`effects-cost.md`) |
|---|---|---|---|---|
| Subclass aura | 2 an aura (8 at most) | 0.15 | 11 | 2 an aura, +0.04 ms: within |
| Family aura | 2 an aura (8 at most) | 0.1 | 7 | 1.9 an aura, +0.05 ms: within |
| Step dust and prints | shared pool: 2 in all | 0.15 | 12 a step | +2, +0.20 ms (±0.20): within |
| Movement juice | shared pool | 0.2 | 24 an event | +1, +0.06 ms: within |
| Dash afterimages | 2 while dashing | 0.15 | – | ~1, +0.08 ms: within (19k triangles) |
| Leaf glider | 2 | 0.25 | – | **3.0, +0.33 ms: over** |
| Held tool | 2 | 0.25 | – | **3.0, +0.39 ms: over** |
| Weapon in hand | 2 | 0.25 | – | **3.9, +0.48 ms: over** |
| Rod, idle rig | 2 | 0.25 | – | **3.2, +0.35 ms: over** |
| Fishing rig, line and cast | 4 | 0.3 | 20 | **9.5, +0.89 ms: over** |
| Nameplates and label layout | 0 (DOM, 12 pooled) | 0.25 | – | 0, not measurable: within |
| Character sun shadows | 2 (Full only) | 0.25 | – | 1.9 a Full player, +0.19 ms (±0.27): within |
| Emote one-shots | 0 | 0.15 | – | not measurable: within |
| Remote interpolation | 0 | 0.1 (40 players) | – | 0.08 µs a player: within |

Every particle pool is registered with its cap (`PARTICLE_POOLS`): the movement juice 384 and prints 160 (one pool a
scene, shared by every avatar), the glow layer 160, combat 768 glow + 256 ink + 16 decals, the mobs 360, the candles
48. One movement event throws at most 24 (the heaviest, a heavy landing on grass, throws 19); a combat recipe stays in
its tier (`fx/combat.ts FX_BUDGET`: 60 / 120 / 300 particles, 2 lights only for an ult, kept lit at a constant count).

## Assets (`ASSET_CATEGORIES`)

By folder under `web/public/assets`; every GLB is parsed (`glbStats.ts`). Primitives are draws: each is a draw call
wherever its node is drawn, and another in the shadow pass if it casts.

| Category | Folders | Triangles | Primitives | Materials | Largest texture | Bones |
|---|---|---|---|---|---|---|
| Full hair | `characters/v6/hair/full` | 4,400 | 1 | 1 | none | 22 |
| LOD 1 hairstyle | `characters/v6/lod1/hair/full` | 2,400 | 1 | 1 | none | 22 |
| LOD 2 hairstyle | `characters/v6/lod2` | 1,200 | 1 | 1 | none | 22 |
| Hair | `characters/v6/hair` | 1,200 | 1 | 1 | none | 22 |
| Accessory | `characters/v6/accessories` | 1,200 | 4 | 4 | 128 | 22 |
| Outfit | `characters/v6/outfits` | 300 | 4 | 4 | 128 | 22 |
| Character LOD 1 part | `characters/v6/lod1` | 1,200 (and ≤ its full part) | 4 | 4 | 256 | 22 |
| Character base | `characters/v6/base` | 2,000 | 8 | 6 | 1,024 (the face atlas) | 22 |
| Weapon | `game/weapons` | 1,000 | 8 | 8 | 256 | – |
| Tool | `game/tools` | 600 | 5 | 5 | 256 | – |
| Effect | `game/props` | 3,000 | 6 | 6 | 512 | – |
| Enemy | `game/enemies` | 1,500 | 16 (instanced: one draw per part per type) | 8 | 512 | – |
| Building | `acnh/buildings`, `buildings`, `game/buildings`, `game/wharf` | 12,000 | 10 | 10 | 1,024 | – |
| Seabed and water life (v1 water, 2026-10-13) | `game/water` | 1,200 (the whole set) | 10 (one instanced draw each) | 6 | 256 | – |
| Interior room | `game/cafe`, `game/interiors` | 12,000 | 24 | 24 | 1,024 | – |

**Full hair** (head-roblox, `specs/characters/head-roblox.md`): a whole hairstyle (David's set) replaces the bangs and the
back together (`look.ts wornParts`). It is the original Roblox mesh (Roblox caps an accessory at 4,000 triangles) plus
its under-cap, so it is held to 4,400; its LOD 1 to 2,400 and its LOD 2 to 1,200. Like every hair piece it is one
primitive in one material: a second colour, a cap and the under-cap are mask channels in the shared hair atlas and a UV
marker, never another material, so a full hairstyle costs the same draws as any other (none: it merges into the body).
David's 21 run 929-4,315 at Full, 929-2,156 at LOD 1 and 929-1,100 at LOD 2; their web copies are meshopt-compressed.

Shipped before the budget and over it, each capped where it is today (`ASSET_EXCEPTIONS`; shrink, never raise): seven
weapons with 9–12 parts (the twin tantos at 12, the shields, the hand wraps, the tier-4 and 5 tooth charms), the café
room (34,170 triangles, 48 primitives, 33 materials), the interiors' kit (35 primitives) and the café's exterior (34
primitives, 25 materials: the most draws of any building in the village). The test fails on any new asset over its
category and on an exception that is no longer needed.

## Network, per player (`NETWORK_BUDGET`)

From `specs/multiplayer.md` §4.3 (pose packets at 10 Hz on the ground, 15 while a move is set, one more per event at
most every 30 ms; msgpack arrays of about 30–40 bytes):

| | Budget | Measured (12 bots, 60 s, `budget.test.ts`) |
|---|---|---|
| Up, per player | 600 B/s, 16 packets a second | at most 272 B/s and 9.9 packets a second (a bot dashing and gliding) |
| Down, per client, a full shard | 16 KB/s | 39 × 272 B/s = 10.6 KB/s at the busiest |

Slow state (held items, seats, study) is a few messages a minute and not budgeted.
