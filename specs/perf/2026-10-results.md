# Performance pass results, October 2026

The pass David asked for (ledger row 300): smoother combat with mobs and ults, and many characters on screen, without
anything looking worse up close. The baseline and its method are `specs/perf/2026-10-baseline.md`; this is the same
bench after the pass, on `game/perf`.

## What changed

| Commit | What | Where |
|---|---|---|
| ff06742c | **Character LOD 1.** Every catalogue part and the base skin decimated in Blender headless on the same 22-bone rig and weights (`art/characters/build_lod.py`): per piece the lightest of 50/65/80% that stays within 12 mm of the full shape and keeps its layering (nothing sinks more than 3 mm into what it lies on or rises 3 mm through what lies on it), otherwise kept whole. The v7 head, its painted face, prints, glasses and layered tops stay whole. 38.9k → 32.8k triangles over the catalogue (49 of 69 GLBs lighter). **Detail by distance and drawn size** (`lib/game/character/lod.ts`): within 21 u of the camera (the follow camera's widest distance) nothing changes, for anyone; past it, a character drawn under 72 px uses LOD 1, under 48 px past 28 u its mixer steps at 30 Hz, under 28 px past 40 u at 15 Hz, and only a speck under 10 px past 40 u drops its sun shadow (its contact shadow stays); out of view past 21 u, 5 Hz and no sun shadow. 15% hysteresis on every line. (The first cut dropped the shadow at 28 px; the far screenshot showed it, so 4f1b1f65 moved the line to specks.) Everyone on the rig: you (only when the camera is far out, never at play distance), other players (on top of their Full/Reduced/Hidden tiers), residents, patrons, the owner, the escort, clones; not the creator. | `Character.tsx`, `lod.ts`, `look.ts`, `SunShadows.tsx` (`shadowCulled`), `sync-character-assets.mjs` |
| 6e25cea3 | **Shared skeleton work.** Bone matrices are relative to the body (detached binding, the bind folded in), so a pose is uploaded only when it changed: a character that walks without its pose changing that frame, or whose mixer steps at 30 or 15 Hz, skips the 22 matrix products and the bone texture upload. Afterimages keep their world pose; raycasts (clicking a resident) still meet the mesh in its own space. | `Character.tsx` |
| ab65f4cc | **Combat.** The two pooled FX point lights stay in the scene at a constant count, dark when idle (a light appearing changed the light count of every lit material and recompiled the scene: the first-ult stall). `UltWarmup` compiles every material in the ruins, shown or hidden (`compileAsync`, parallel linking), and uploads every texture behind the gate's fade. Empty instanced meshes are hidden (408 in the scene graph → about 130). No per-frame allocations left in the effects loop, the wisps, the totems, enemy posing, the respawn loop and the ult's screen spots (one layout read a frame instead of three). Mobs were already instanced (one draw per part per type) and the particles already pooled within §1.7's budgets: unchanged. | `CombatFx.tsx`, `EncounterRender.tsx`, `RuinsScene.tsx`, `UltWarmup.tsx` |
| 0a78e817 | **High's AO passes without the repeat work.** N8AO (High only) renders the scene twice more each frame for transparency-aware AO. Those renders now skip the scene's matrix walk (nothing moves after the composer's own render) and the shadow maps draw once a frame; the pass no longer walks the scene every frame to re-detect transparency. The image is the same. | `PostFX.tsx`, `SunShadows.tsx` |
| 7337054e, 672c3d77, 4f1b1f65 | **Adaptive quality** (`lib/game/perf/governor.ts`): under 45 FPS for 3 s steps down one level, least visible first: characters past 21 u reaching their lighter tiers sooner, combat particles at 60%, then the canvas at 85% resolution. Over 57 FPS for 8 s steps back up (the wait doubles after a step it had to undo). If every level is on and the frame is no faster than with none (a busy CPU, which these knobs don't relieve), the detail comes back and it waits a minute. It only takes away from what the settings and tier give, never writes a setting, and starts each scene from the settings. | `QualityGovernor.tsx`, `governor.ts`, knobs in `Character`, `CombatFx` |

Shadow map size is not a knob: halving the moving casters' map mid-session drew character shadows in the wrong place
in testing, and that map has an older problem (below), so 4f1b1f65 took it out. Post-processing: at the members' defaults (pixel finish on, bloom off) the only post cost was the AO's extra renders,
made cheaper above; nothing else in the chain has samples to trade without a visible change, so the governor doesn't
touch it.

## Numbers

Same machine, bench and scenes as the baseline (Mac mini M4, Chrome for Testing 147, 1280 × 800 at DPR 1, the pixel
finish on). The machine was shared with other agents (load average 4.6–10), so before and after were run
**interleaved** (`specs/perf/ab.sh`: the two production measurement builds served in turn, round by round) and each
value is the mean over the rounds. Raw rows: `specs/perf/runs/ab-*.jsonl`. These tables are the after build at 672c3d77 (before the
far-shadow and governor adjustment and the forage merge); the final commit is confirmed further down. The uncapped
tables' hitch columns include GPU back-pressure that never happens at the display's pace: read hitches from the
display-pace tables.

### Production, High, uncapped (what a frame costs)

| Scene | FPS | 1% low | Median ms | p95 ms | Worst ms | First ult ms | Second ult ms | Frame CPU ms | Draw calls | Skeleton uploads | Mixers | JS heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| village | 118.7 → **158.1** | 75.8 → **108.3** | 8 → **6.3** | 11.1 → **7.8** | 22.1 → **10.4** | – → **–** | – → **–** | 6.6 → **5.2** | 450.5 → **453** | 35 → **18** | 16 → **14** | 196 → **225** |
| cafe | 260.8 → **319.9** | 112.3 → **122.7** | 3.5 → **3** | 7.3 → **6** | 10.7 → **9.8** | – → **–** | – → **–** | 2.1 → **2.1** | 143 → **144** | 8.5 → **8.5** | 8.5 → **8.5** | 117 → **126** |
| ruins-summoner (Shadow Garden) | 134.4 → **183.8** | 13.4 → **24.3** | 6.1 → **4.7** | 12.1 → **9** | 151.7 → **87.9** | 151.7 → **87.9** | 94.1 → **29.3** | 5 → **3.5** | 410 → **416.5** | 4 → **1** | 2 → **1** | 134 → **126.5** |
| ruins-illusionist (The Joker) | 137.1 → **166** | 22.8 → **33.5** | 6.7 → **5.2** | 10.4 → **10.1** | 191.1 → **83.8** | 31.8 → **65** | 17.6 → **20.2** | 5.5 → **4** | 398.5 → **390.5** | 7 → **3** | 4.5 → **3** | 109 → **133** |
| ruins-elementalist (Cataclysm) | 169.8 → **170.7** | 27.8 → **31.2** | 5 → **4.8** | 9.6 → **10.6** | 208.6 → **105.2** | 17.1 → **16.5** | 208.6 → **46.7** | 4 → **3.6** | 343.5 → **350** | 2 → **1** | 2 → **1** | 103 → **99** |
| ruins-marksman (Thousand Arrows) | 152.9 → **175.2** | 21.5 → **27.1** | 5.8 → **4.8** | 9.8 → **9.6** | 204.6 → **113.3** | 17 → **113.3** | 43.3 → **53.2** | 4.5 → **3.6** | 323.5 → **323** | 2 → **1** | 2 → **1** | 122.5 → **113** |

2 round(s) each, interleaved.

### Production, High, at the display's pace (what a player feels: hitches and 1% lows)

| Scene | FPS | 1% low | Median ms | p95 ms | Worst ms | First ult ms | Second ult ms | Frame CPU ms | Draw calls | Skeleton uploads | Mixers | JS heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| village | 141.6 → **144** | 84.9 → **115.2** | 6.9 → **6.9** | 8.6 → **8.4** | 18.3 → **8.8** | – → **–** | – → **–** | 5.7 → **4.6** | 451.5 → **454** | 35 → **18** | 15.5 → **14** | 189.5 → **232** |
| cafe | 144 → **144** | 114.9 → **114.7** | 6.9 → **6.9** | 8.3 → **8.4** | 8.8 → **8.8** | – → **–** | – → **–** | 1.3 → **1.2** | 136.5 → **135** | 6.5 → **6** | 6.5 → **6** | 125 → **130.5** |
| ruins-summoner (Shadow Garden) | 113.4 → **122.8** | 18.9 → **38.5** | 7 → **7** | 14.2 → **14.1** | 156.5 → **36.3** | 156.5 → **35** | 42.2 → **25.2** | 4.8 → **3.4** | 421.5 → **418** | 4 → **1** | 2 → **1** | 111 → **114.5** |
| ruins-illusionist (The Joker) | 115.1 → **131.6** | 24 → **56.8** | 7 → **7** | 14 → **13.9** | 145.6 → **31.2** | 24.3 → **15.1** | 15.1 → **11.4** | 5.2 → **3.3** | 382 → **403.5** | 6.5 → **3.5** | 5 → **4** | 114 → **123.5** |
| ruins-elementalist (Cataclysm) | 117 → **131.9** | 24.6 → **58.1** | 7 → **7** | 14.1 → **13.8** | 152.2 → **27.4** | 15.3 → **14.4** | 152.2 → **18** | 4.2 → **2.7** | 350 → **337.5** | 2 → **1** | 2 → **1** | 107.5 → **103.5** |
| ruins-marksman (Thousand Arrows) | 118.2 → **125.8** | 28.7 → **55.5** | 7 → **7** | 14.1 → **13.9** | 143.1 → **31.3** | 143.1 → **14.7** | 21.5 → **20.4** | 4.5 → **3.1** | 322.5 → **321** | 2 → **1** | 2 → **1** | 113.5 → **102.5** |

2 round(s) each, interleaved.

### Production, Lite, uncapped

| Scene | FPS | 1% low | Median ms | p95 ms | Worst ms | First ult ms | Second ult ms | Frame CPU ms | Draw calls | Skeleton uploads | Mixers | JS heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| village | 261.6 → **278.7** | 172.3 → **173.8** | 3.7 → **3.5** | 4.7 → **4.5** | 7.1 → **7.9** | – → **–** | – → **–** | 3.2 → **2.9** | 320 → **325** | 20 → **14** | 11 → **10** | 198 → **230** |
| cafe | 574.3 → **601.5** | 193.6 → **186** | 1.7 → **1.7** | 3.5 → **3.2** | 7.5 → **9.9** | – → **–** | – → **–** | 1.1 → **1.1** | 100 → **103** | 6 → **7** | 6 → **7** | 108 → **118** |
| ruins-summoner (Shadow Garden) | 281.4 → **341** | 29.6 → **30.6** | 3 → **2.3** | 6.1 → **5.6** | 127.6 → **130.6** | 127.6 → **130.6** | 11.3 → **24.3** | 2.4 → **1.9** | 238 → **238** | 1 → **1** | 2 → **1** | 97 → **100** |
| ruins-illusionist (The Joker) | 267.4 → **381.6** | 59.8 → **50.6** | 3.7 → **2.2** | 5.4 → **5** | 72.7 → **93.1** | 72.7 → **93.1** | 16.6 → **10.5** | 3.1 → **1.7** | 223 → **234** | 3 → **3** | 4 → **3** | 121 → **108** |

1 round(s) each, interleaved.

### Production, Lite, at the display's pace

| Scene | FPS | 1% low | Median ms | p95 ms | Worst ms | First ult ms | Second ult ms | Frame CPU ms | Draw calls | Skeleton uploads | Mixers | JS heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ruins-summoner (Shadow Garden) | 142.8 → **143.2** | 72.6 → **82.7** | 6.9 → **6.9** | 8.3 → **8.6** | 27.8 → **27.5** | 27.8 → **27.5** | 8.8 → **15.2** | 2.3 → **2.1** | 241 → **246** | 1 → **1** | 2 → **1** | 104 → **109** |
| ruins-illusionist (The Joker) | 143.2 → **143.8** | 82.8 → **109.1** | 6.9 → **6.9** | 8.3 → **8.4** | 29.2 → **13.9** | 8.7 → **8.8** | 8.6 → **8.7** | 2.7 → **2** | 225 → **233** | 3 → **3** | 5 → **3** | 103 → **110** |
| ruins-elementalist (Cataclysm) | 142.2 → **143.8** | 58.7 → **109.3** | 6.9 → **6.9** | 8.3 → **8.3** | 76.4 → **13.9** | 8.7 → **8.7** | 8.7 → **8.7** | 1.8 → **1.7** | 197 → **202** | 1 → **1** | 2 → **1** | 106 → **100** |
| ruins-marksman (Thousand Arrows) | 143.3 → **143.8** | 87.6 → **109.1** | 6.9 → **6.9** | 8.3 → **8.3** | 27.8 → **13.9** | 8.8 → **8.7** | 13.9 → **8.7** | 2.1 → **1.8** | 189 → **190** | 1 → **1** | 2 → **1** | 126 → **134** |

1 round(s) each, interleaved.

### Confirmation at the final commit (4f1b1f65, after the forage merge)

The after build here also carries the forage pass merged from `feat/game-default-island` (more for every frame to do:
16 more draw calls in the village); the before build is the baseline. One interleaved round, a calmer machine than
the runs above (`runs/ab-final-*.jsonl`):

| Scene | FPS | 1% low | Median ms | p95 ms | Worst ms | First ult ms | Second ult ms | Frame CPU ms | Draw calls | Skeleton uploads | Mixers | JS heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| village | 182.3 → **196.3** | 119.3 → **127.9** | 5.3 → **4.9** | 7 → **6.5** | 10 → **8.7** | – → **–** | – → **–** | 4.5 → **4.2** | 450 → **466** | 35 → **18** | 15 → **14** | 188 → **245** |
| ruins-summoner (Shadow Garden) | 159.6 → **186.2** | 16.1 → **22.1** | 5.2 → **4.4** | 9.8 → **9.3** | 143.5 → **99.6** | 143.5 → **79** | 81.5 → **11.3** | 4.3 → **3.5** | 415 → **417** | 4 → **1** | 2 → **1** | 115 → **118** |
| ruins-marksman (Thousand Arrows) | 174 → **201.2** | 22.2 → **25.5** | 5 → **4.2** | 8.9 → **8.8** | 186.9 → **96.3** | 18.3 → **96.3** | 59 → **75.7** | 4 → **3** | 326 → **327** | 2 → **1** | 2 → **1** | 96 → **116** |

1 round(s) each, interleaved.

At the display's pace:

| Scene | FPS | 1% low | Median ms | p95 ms | Worst ms | First ult ms | Second ult ms | Frame CPU ms | Draw calls | Skeleton uploads | Mixers | JS heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ruins-summoner (Shadow Garden) | 124.1 → **139.7** | 23.2 → **54.1** | 7 → **6.9** | 13.9 → **8.1** | 138.9 → **34.8** | 138.9 → **34.7** | 34.7 → **13.2** | 4 → **2.8** | 434 → **415** | 4 → **1** | 2 → **1** | 100 → **113** |
| ruins-elementalist (Cataclysm) | 137.3 → **143.8** | 37.2 → **110.7** | 6.9 → **6.9** | 8.3 → **7.8** | 125 → **14** | 14 → **8.7** | 125 → **8.7** | 3.3 → **2.4** | 340 → **335** | 2 → **1** | 2 → **1** | 92 → **136** |

1 round(s) each, interleaved.

### Step by step (development build, `specs/perf/runs/steps-dev-*.jsonl`)

One run per commit, the same session, the village (uncapped) and Shadow Garden (uncapped and at the display's pace):

| Commit | Village FPS | Village frame CPU ms | Mixers | Skeleton uploads | Characters on LOD 1 / throttled | Shadow Garden FPS | Shadow Garden worst frame (vsync) | 1% low (vsync) |
|---|---|---|---|---|---|---|---|---|
| a327fac6 baseline | 142.2 | 5.8 | 23 | 45 | – | 151.7 | 140.3 ms | 20.9 |
| ff06742c LOD | 150.4 | 5.3 | 18 | 44 | 13 / 6 | 151.7 | 131.9 ms | 21.2 |
| 6e25cea3 pose uploads | 147.0 | 5.3 | 18 | 22 | 11 / 6 | 153.5 | 138.9 ms | 20.9 |
| ab65f4cc combat | 146.1 | 5.4 | 19 | 23 | 11 / 5 | 164.2 | 41.7 ms | 39.2 |
| 0a78e817 AO passes | 163.7 | 4.7 | 19 | 23 | 11 / 5 | 181.3 | 41.7 ms | 43.8 |
| 672c3d77 governor | 163.5 | 4.7 | 20 | 24 | 11 / 4 | 180.4 | 34.7 ms | 44.2 |

### Reading them

- **Combat hitches are gone.** At the display's pace every heavy ult's worst frame went from 143–157 ms to 27–36 ms
  (Shadow Garden 156 → 35 ms on its first cast), and the fights' 1% lows doubled (19–29 → 38–58 FPS). Cataclysm's
  finisher stall (152 ms, the second FX light appearing ~5 s in) is gone too. What's left over 20 ms is the first frame
  of a big ult's burst, not a compile. On Lite there were no light changes to begin with; its remaining 77 ms Cataclysm
  frame went to 14 ms (the warm-up).
- **Frames are cheaper.** Uncapped on High: the village 119 → 158 FPS (frame CPU 6.6 → 5.2 ms), Shadow Garden 134 → 184,
  The Joker 137 → 166, Thousand Arrows 153 → 175; the café 261 → 320. Most of it is the AO passes and the combat changes;
  Lite gains less (no AO): its fights 267–281 → 341–382 FPS.
- **Characters:** skeleton uploads halved (35 → 18 a frame in the village) and mixer steps fell (16 → 14 there; 23 → 19
  on the development run with more residents out), 7–13 characters on LOD 1 and 2–6 throttled at any moment with 24
  bots. With 16–23 animated characters this was never the biggest cost on this machine (baseline item 5); it scales
  with crowds and matters more on weaker CPUs and GPUs.
- **Draw calls barely moved.** The empty instanced meshes were already being culled (their bounding spheres were
  empty), so hiding them saves scene-graph work, not draws. The calls that remain are the world's (baseline: 400–500
  draws with a material change on each, CLAUDE.md "Live-scene budget"), out of this pass's scope.
- **Adaptive quality** never engaged here (the M4 holds 120+ FPS). Under a 6× CPU slowdown (`specs/perf/governor-demo.mjs`,
  `runs/governor-demo.txt`, run with the four-level version) it stepped down a level every 3 s, found the frame no
  faster with every level on (the CPU, not the GPU, was the limit), gave all the detail back at 17 s and held; after the
  slowdown lifted it stayed at the settings. On a GPU-bound machine (a weak integrated GPU, a 4K window) the canvas
  resolution is the step that relieves it.
- **Memory:** the JS heap in the village is 30–40 MB higher (the LOD GLBs and one merged LOD geometry per look shown);
  the ruins are unchanged. The LOD assets add 2.6 MB on disk, loaded only for parts in view, after the character shows.

## Nothing changes up close

The same views on the before and after production builds (`specs/perf/shots.mjs`, High, the pixel finish on, 1280 ×
800), cropped and enlarged. Differences are animation phase, the residents' routines and the live clock.

- `specs/evidence/perf/near-before-after.webp`: eight characters round you at play distance. Identical: full mesh,
  every frame, sun shadows.
- `specs/evidence/perf/far-before-after.webp`: the camera pulled out to 3× (about 39 u), every character past the LOD
  lines: LOD 1 and a slower mixer, shadows kept. No visible difference at that size.
- `specs/evidence/perf/ruins-before-after.webp`: the pack round you before a cast. Identical (mobs and the HUD are
  untouched; the FX lights are dark until an effect lights them, as before).
- `specs/evidence/perf/lod1-up-close.webp`: development only, `?charlod=1`: every character forced to LOD 1 at play
  distance, where the game never draws it, next to the full meshes. Even here the difference is a few facets in the
  hair and sleeves.
- `specs/evidence/perf/lod-compare.webp`: every decimated GLB, full and LOD 1 side by side, rendered large in Blender
  (`art/characters/render_lod.py`).

## Trade-offs and notes

- **Far characters** (past 21 u and under 72 drawn pixels) draw LOD 1: hair locks and clothes carry 0–35% fewer
  triangles, within 12 mm of the full shape (about half a pixel at that size). Past 28 u and under 48 px their walk
  steps at 30 Hz, past 40 u and under 28 px at 15 Hz; only specks (under 10 px past 40 u) lose their sun shadow.
  Nothing within the follow camera's widest distance changes, so you, whoever you stand with and every room look as
  before.
- **The LOD is conservative:** pieces that couldn't be decimated without changing shape or layering stay whole (20 of
  69 GLBs, among them glasses, scarves, prints, the striped top and most shoes). The triangle saving is 16%, not 50%;
  triangles weren't the bottleneck.
- **When the character remodel lands** (ledger row 301), re-run `build_lod.py`, `render_lod.py` (review the sheet) and
  `sync-character-assets.mjs`; `look.test.ts` fails if a part ships without its LOD.
- **The bench's uncapped hitch columns** include GPU back-pressure (the main thread blocked in a GL call while the GPU
  queue drains) that never happens at the display's pace; read hitches from the vsync tables.
- **Not done:** the world's own draw calls (batching the 400–500 draws), the SunShadows scene walk (2–4%), the
  movement collision lookups (`solidTop`, 1.5% in the village) and N8AO's own per-frame scene walks to save and
  restore visibility. These are the next targets on a weaker machine.

## Found along the way (not changed here)

- **Standing characters lose their sun shadow after the static map re-captures.** SunShadows bakes the world into the
  key light's cached map and draws characters and enemies into a second map every frame. In testing, once the cached
  map re-captured (here forced by hiding and showing one tree; in play the sun path moves the key light every couple
  of minutes), the characters standing near you had no sun shadow any more, while walking residents kept theirs. The
  shadows seen before that come from the first capture. Reproduced on the baseline (a327fac6, main plus the probe), so
  it predates this pass, and it confused the first tests of the LOD swap and of a shadow-size knob (both looked like
  they lost shadows; both were this). Worth its own look at SunShadows and LOOK_LIGHTS_CHUNK's second map; repro:
  `/lab/island?crowd=8`, then toggle `visible` on any mesh whose `userData.sunCaster` is "static".
- **Draw calls:** the world draws 320–470 a frame with a material change on most; batching them is the next big win on
  a weaker machine, and out of this pass's scope.

## Reproduce

```
sh specs/perf/measure-build.sh                     # a production build with the dev gates lifted (under the heavy lock)
sh specs/perf/ab.sh 2 village,cafe,ruins-summoner specs/perf/runs/ab-x   # needs .perf-builds/.next-before and .next-after
UNCAPPED=0 HITCH=1 PORT=3149 node specs/perf/perf-bench.mjs ruins-summoner   # long frames broken down by function
PORT=3149 node specs/perf/shots.mjs <dir> <label> near,far,ruins
```
