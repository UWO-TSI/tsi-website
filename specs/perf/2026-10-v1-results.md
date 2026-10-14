# v1 performance pass, October 2026

`specs/v1-drop.md` §8: school laptops. 60 FPS on Apple silicon, 30+ FPS on Lite for older Intel and Windows laptops with
integrated graphics, 24 players nearby, nothing visibly worse up close. The known fixes were `effects-cost.md`'s (the
models in players' hands, the fishing rig, the leaf) and the v2 world's draw calls (`budget.md`: 697, 50% over the
village). Branch `game/v1-perf`.

## What changed

| Commit | What |
|---|---|
| 4efc6a7a, 8ca70e91 | **Held items as one mesh per look class** (`lib/game/character/heldMesh.ts`). A tool's, weapon's or front-held item's parts are merged once per GLB and shared by every copy, each part's base colour baked into its vertex colour (COLOR_0 × base, its four components kept, so the merged mesh uses the parts' own shader program). Parts of one look class (props, metal, glass) with the same shading merge; a glowing part keeps its own material (the tier-5 breathing is unchanged); `OffHand` stays its own node. Tools 68 → 16 parts over the catalogue (one each), weapons 516 → 297. Painted weapons (yours, classes v2) stay as authored. **Held-item shadows:** another player's item casts its sun shadow only at Full within `HELD_SHADOW_RANGE` (10 u, 1 u hysteresis) of you (`motion.itemShadow`, Character `remote`); yours always. |
| 234c99ff | **Fishing rig:** another player's rod mounts no rig until remote casts are sent (no bobber, line, rings or `<Html>`; their rod shows alone, as it always did). The bobber is one mesh and casts no shadow. The bite's "!" is a label in the world's label layout (`labelLayout.ts`, nudged clear of a nameplate), not a drei `<Html>` with its own React root projected every frame. |
| 3357a9ff | **Leaf glider** one mesh; another player's leaf casts no sun shadow (yours does). **Afterimages:** another player's dash afterimage is the body alone, from the LOD 1 mesh once loaded. **Face shadow:** the face, a shell over a closed head (checked on v7 and v8: every ray hitting the face first meets skin behind it), no longer casts: one shadow draw less per Full character. |
| e981a1d3, 53b89345, 4e08d123 | **The ground and the cliff kit by block** (`components/game/grid/terrainBlocks.ts`, `cliffBlocks.ts`). GridTerrain merges its per-chunk layers into blocks of 4 × 4 chunks per layer (the water's surface, bed and fringe, broad and light, 8 × 8). GridCliffs bakes every kit placement into world space and merges it per shared material per block: it was one InstancedMesh per kit file and sub-mesh, never culled (270 of the v2 world's 700 calls). The kit's grass top keeps the ground's world UVs as an attribute (the island grass shader's instancing branch did it in the shader). **Cull by block** (`lib/game/curvedCull.ts`): each frustum plane is tested on the block's box as three would; the bend only lowers points, so only the top plane allows for the most it can lower the box: nothing the curved world brings into view is culled (tested against every bent point of a sweep of boxes), with a one-frame camera margin. A culled block whose material nothing has drawn yet is shown once at load, so its shader never compiles mid-walk. |
| 5a070228 | **Streetlamps** as one instanced model (`Lanterns`): a draw per sub-mesh for all of them; each lamp keeps its own pool of light, the globes ease together as before. The v2 world's 11 lamps: 56 → 5 calls. |
| 065ed246 | **Lite thins the flowing grass with distance:** every tuft within 30 u of the camera, falling to a quarter past 45 u (each tuft's own hash says which, so the same ones stay as you walk); the instances are rewritten when the camera has moved 2 u. High draws them all. |
| 8a31c3b4, 24abee4d | **Lite's render scale:** without the pixel finish a game canvas renders at most 1 device pixel per CSS pixel on Lite (`tierDpr`: the island up to 1.5 on High, the character creator and the arrival's reflection up to 2). The pixel finish stays the default on every tier, at 0.5. `lib/game/qualityTier.ts` lists everything Lite turns off. |
| 71805a25, f8900dbc | **No shader compiles mid-play** (found by the A/B: 75–110 ms frames): a held item casts for its first three frames whoever holds it, so the shadow pass's shader compiles when it comes out; the leaping fish (AmbientFauna) draw once behind the camera at load until their program, look patch included, is compiled. The bench's probe (`progprobe`, every program linked after the scene settles, 12 s in v2 with 24 bots): 0 on High and Lite. |

## Numbers

Mac mini M4, Chrome for Testing, 1280 × 800 at DPR 1, the pixel finish on, uncapped, 24 bots (`perf-bench.mjs`), the
measurement build (`measure-build.sh`).

### perf:check (the gate), against the baseline (53c23490)

The branch at 24abee4d (main 1f86a994 merged in), 3 runs each, load 3.1–3.9: **passed on both tiers**. `main` is
ff4016a9's own perf:check (High only), the same day at load 3.2–3.6.

| Scene | Tier | Frame ms: baseline / main / branch | Frame CPU ms | Draw calls: baseline / main / branch | Triangles: branch |
|---|---|---|---|---|---|
| Village | High | 4.0 / 4.2 / **3.9** | 3.4 / 3.6 / **3.4** | 464 / 464 / **391** | 503k (the water pass and the hairs: 491k on main 754c4a01) |
| v2 world | High | 5.5 / 5.6 / **5.1** | 4.9 / 5.0 / **4.6** | 697 / 698 / **252** | 1.08M |
| Café | High | 2.1 / 2.2 / **2.0** | 1.2 / 0.5 / **1.1** | 139 / 134 / **146** | 73k |
| Ruins (Shadow Garden) | High | 3.1 / 3.2 / **2.7** | 2.5 / 2.6 / **2.1** | 417 / 416 / **304** | 230k |
| Village | Lite | 2.2 / – / **2.3** | 1.9 / – / **2.0** | 336 / – / **300** | 357k |
| v2 world | Lite | 3.0 / – / **3.0** | 2.7 / – / **2.7** | 487 / – / **174** | 829k |
| Café | Lite | 1.4 / – / **1.5** | 0.7 / – / **0.8** | 105 / – / **111** | 70k |
| Ruins (Shadow Garden) | Lite | 1.9 / – / **1.8** | 1.5 / – / **1.4** | 236 / – / **165** | 169k |

On Lite the M4 is not the machine Lite is for: without shadows and AO, two thirds fewer calls cost it almost nothing
measurable at these frame times (the village and café moves are within the run spread, 0–26%); on a slow machine they
do (below). The shader probe on the same build: 0 programs compiled after the scene settles, on High and on Lite.

### Before and after, interleaved (main 754c4a01 against the branch at the same merge, one round)

| Scene | Tier | Frame ms | Frame CPU ms | Draw calls | Triangles |
|---|---|---|---|---|---|
| Village | High | 4.4 → 4.6 | 3.8 → 4.0 | 489 → 393 | 491k → 508k |
| v2 world | High | 6.1 → 5.2 | 5.4 → 4.6 | 728 → 252 | 1.10M → 1.08M |
| Village | Lite | 2.4 → 2.4 | 2.1 → 2.2 | 350 → 298 | 343k → 359k |
| v2 world | Lite | 3.2 → 2.9 | 2.9 → 2.4 | 510 → 175 | 833k → 829k |

One round is soft for the village (its frame moved ±0.5 ms between rounds all day); the three-run gate above is the
figure to trust. The village's triangles rise a few percent: a block draws whole while any of it shows.

### Where the v2 world's calls went (High, every pass, `draw-breakdown.mjs`; before 7ddc8de4, after f8900dbc)

| | Before | After |
|---|---|---|
| Cliff kit (drape 136, grass top 68, rock 34, proc grass 32) | 270 | 19 (4 materials × the blocks in view, the drape twice as a two-sided see-through) |
| Ground chunks (water 78, fringe 56, bed 46, grass 16, soil 12, sand 10) | 218 | 49 |
| Streetlamps | 56 | 6 |
| Everything else (buildings, props, characters, grass, post, shadows) | 158 | 186 (the water pass's seabed and water life came in between) |
| **Total** | **702** | **260** |

### Carried effects (fx-bench, 24 players on High, main ff4016a9's water merge against the branch)

Each effect forced on every player in view, measured against every effect off (`fx-bench.mjs`, `REPS=2`); main's
runs were on a busier machine (load 5.4–9.2 against 2.7–4.7), so its times are soft and its draws are not:

| Effect | Draws: main → branch | Triangles | Main thread ms: main → branch | What changed |
|---|---|---|---|---|
| Held tool | +68 → **+19** | 5.3k → 5.0k | +0.21 → **+0.13** | one mesh; shadow within 10 u |
| Weapon in hand | +84 → **+49** | 6.0k → 6.0k | +0.45 → +0.46 | a mesh per look class and glow; shadow within 10 u (weapons are hidden in v1) |
| Rod, idle | +69 → **+16** | 4.7k → 4.7k | +0.67 → **+0.08** | one mesh, no rig on other players |
| Rod with a cast (forced) | +201 → **+19** | 10.9k → 4.7k | +0.81 → **+0.15** | no rig on other players until casts replicate |
| Leaf glider | +64 → **+21** | 5.5k → 5.5k | +0.39 → **+0.27** | one mesh, no shadow on other players' |
| Dash afterimages | +12 → **+7** | 18.6k → **12.9k** | +0.12 → **+0.08** | other players': the body alone, at LOD 1 |
| Character sun shadows | +22 → **+11** | 37k → 32k | −0.03 → +0.03 | the face no longer casts |
| Group dance (new on main) | +1 | ~0.1k | 0.00 → +0.04 | priced, nothing to fix: +1 draw and +0.05–0.07 ms (±0.03–0.05) at 12 and at 24 |

Against `budget.md`'s shares (2 draws per player in view, 0.25 ms): the held tool, the rod and the cast are now within
it (19 draws for 21 players in view); the leaf is within on draws and at its line on time; the weapon is still over
on draws (2.3 a player) and time, and is hidden until combat ships in v3.

## Lite on a slow machine

`lite-sim.mjs`: the main thread slowed 4× by CDP throttling (an older Intel laptop's core is about 3–4× slower than an
M4's), the GPU's share grown by drawing about 5.6× the pixels (the pixel finish off at 1920 × 1200), adaptive quality
held at the settings, uncapped. Main 754c4a01 against the branch:

| Scene, Lite | Frame ms (FPS) | Frame CPU ms | GPU ms | Draws |
|---|---|---|---|---|
| v2 world, 4× CPU | 14.4 (68) → **5.9 (158)** | 12.5 → 5.0 | 4.7 → 4.1 | 509 → 174 |
| v2 world, 4× CPU, 1920 × 1200 without the pixel finish | 15.3 (64) → **8.0 (125)**, p95 31 → 10 | 13.2 → 6.5 | 12.4 → 14.5 | 509 → 173 |
| Village, 4× CPU | 11.1 (84) → **10.9 (86)** | 9.2 → 9.0 | 2.3 → 2.3 | 354 → 299 |

On Lite the busy scenes are CPU-bound even at 4× (the GPU is 2–5 ms at the default pixel finish): an Iris Xe class GPU,
2–2.5× slower than the M4's, lands at 5–11 ms. Lite holds 30+ FPS with headroom in both worlds; the v2 world, which
was the heavier of the two, is now the lighter. The village's main thread is the bots' own simulation and the
characters (the loopback's 24 bots step their movement on the page's thread, which real players don't).

**What Lite turns off** (`qualityTier.ts`): the sun's shadow maps and ambient occlusion; bloom, tilt-shift and FXAA;
the sky dome (the flat gradient), cloud shadows, seasonal leaf fall; wind on trees and grass; half the water's glints,
8 fireflies (High: two a bush), lighter fog banks, fewer critters; other players at 8 Full and 16 drawn (High: 12 and
24); the flowing grass thinned with distance (new); and, without the pixel finish, the canvas capped at 1 device pixel
(new). The pixel finish stays the default.

## Nothing visibly worse up close

Before and after on the same views (main against the branch, High unless noted): `specs/evidence/v1-perf/`.

- `held-close.webp`, `weapon-close.webp`, `leaf-close.webp`: twelve players in a block 3.5–10 u in front of you,
  the camera at 0.45 zoom: the nets, shovels, rods, weapons and leaves are the same colours and shapes. Other players'
  leaves no longer cast a shadow (as asked).
- `v2-cliff-close.webp`, `v2-near.webp`: the cliff kit, its grass top (the same world UVs), the drape, the water, the
  ground: identical.
- `village-night.webp`: the instanced streetlamps lit, their pools of light: identical.
- `bite.webp`: the bite's "!" over your head, now from the label layout (sitting just above your name tag).
- `lite-*.webp`: Lite, the v2 world near and wide and the village, main against the branch.

## Trade-offs

- **Other players' held items** cast their sun shadow only within 10 u (yours always); their leaves never; their
  afterimages are the body alone at LOD 1 for a fifth of a second at 17% opacity.
- **Other players' rods** show no cast until remote casts are sent: that was already so (no remote cast is
  networked); when casts replicate, mount the rig for them (Character `remote` is the switch) and it costs the
  bobber's one draw and the line.
- **Weapons** stay a mesh per look class and per glow (3.3 a weapon on average, from 5.8): metal and glass are shaded
  differently by LookMaterials, and the glows breathe. Weapons are hidden in v1 (combat is v3).
- **Blocks draw whole:** a block in view draws all its chunks, so the village draws ~4% more triangles than with
  per-chunk culling; the v2 world's are flat because the bend-aware cull is otherwise as tight as three's.
- **GPU memory:** unchanged in kind (the blocks hold the same geometry as the chunks did, uploaded when first in view).

## Found along the way

- The café draws a few more calls than ff4016a9's perf:check (134 → 147): not this branch's. Its breakdown is the
  same 153 calls on main ccb2c818 and on the branch (`draw-breakdown.mjs`); the new calls came with main (the
  head-fit hairs or the water pass).
- The leaping fish's first-leap compile predates this pass (AmbientFauna); fixed here at the coordinator's request.

## Reproduce

```
sh specs/perf/measure-build.sh                                  # under the heavy lock
cd web && SKIP_BUILD=1 KEEP_BUILD=1 LOCK_OWNER=<branch> npm run perf:check
PORT=3158 TIER=high node specs/perf/draw-breakdown.mjs "fixture=v2&bots=24" /tmp/v2.json
PORT=3158 node specs/perf/lite-sim.mjs after /tmp/sim.jsonl v2:lite:4:1:1280x800,village:lite:4:1:1280x800
N=24 REPS=2 PORT=3158 node specs/perf/fx-bench.mjs /tmp/fx.jsonl held,weapon,rod,fishing,leaf,ghost,shadows,dance
```
