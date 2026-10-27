# Loading: baseline (before), 2026-10-27

Lane `loading` step 1 (`specs/lanes/loading.md`). Main at 1d9a951e plus the trace script only.

## How it was measured

- **Build:** the measurement build (`specs/perf/measure-build.sh`: a production `next build` with the game's dev gates
  lifted for `?arrival=1` and `window.__arrival`/`__perf`), built with `NEXT_PUBLIC_GAME_WORLD=new` and
  `NEXT_PUBLIC_MEMBER_WORLD=open`, served by `next start -p 3151`. Supabase points at a dead local port, so the visit is
  signed out; for the run the dashboard's middleware matcher was dropped from the built `middleware-manifest.json` (the
  signed-out redirect would otherwise send it back to the title). Never deployed.
- **Browser:** headless Chromium (Playwright 1.5x, new headless), muted, ANGLE on Metal (Apple M4), 1280 x 800 at DPR 1.
- **Script:** `specs/perf/load-trace.mjs`. Title page (`/student`) for 10 s, then `/student/dashboard?arrival=1` as
  `/student/go` sends a member there: the loading screen, the arrival (Yes in the water after 3 s, the crossing watched,
  the walk-along left after 4 s), then 60 s of walking. Per frame: its length and the WebGL calls inside it (program
  compile and link, texture upload, buffer upload); every program linked with the light and shadow state baked into it;
  the long-animation-frame entries; the resource timings.
- **Lines:** fast = 100 Mbps down, 15 ms; slow = 12 Mbps down, 60 ms (CDP throttling). Cold = a fresh browser; warm =
  the same browser after one untimed pass (title, island, up to Yes in the water).
- **Caveats:** one run per row (each is about 2.5 minutes); the Mac mini is shared (load 4 to 5, other lanes building,
  swap 10 GB), so single numbers move by several seconds between runs (three unthrottled cold runs put "world ready" at
  17.9, 32.8 and 37.4 s). `next start` serves HTTP/1.1 (six connections a host), so the 300+ small requests cost more
  round trips here than on Vercel's HTTP/2. Public files are served `Cache-Control: public, max-age=0`, so a warm
  visit still revalidates every model (a 304 each). Raw runs: `scratchpad/runs/before-*.{md,json}` (not committed;
  JSON is gitignored).

## Title page

| | fast, cold | slow, cold | fast, warm | slow, warm |
|---|---|---|---|---|
| Title drawn ("title ready") | 1.8 s | 2.5 s | 2.0 s | 6.2 s |
| Bytes over the wire | 17.6 MB | 17.6 MB | 0 | 2.2 MB |
| Its own models / textures finish | 1.9 / 2.3 s | 10.2 / 12.4 s | | |
| Frames over 50 ms in 12 s | 9 (worst 403 ms) | 63 (worst 1334 ms) | 0 | 43 |

The title already downloads 93 models and 31 textures (the village it shows), but of the 435 files the island then
asks for, 310 (20.7 MB) are ones the title never loads: the characters (68 files, 6.9 MB, including a 4.3 MB hair
texture), the HQ and shop interiors (4.3 MB), the wharf and boats, props, plants. And none of the island's 47 own code
chunks (1.1 MB).

## Let's Play to walking (the island page, ms from its navigation)

| | fast, cold | slow, cold | fast, warm | slow, warm |
|---|---|---|---|---|
| Loading screen up | 0.1 s | 0.3 s | 0.3 s | 0.3 s |
| World code and data in, canvas up | 0.8 s | 5.6 s | 0.6 s | 7.1 s |
| "Lighting the lamps" (all loads done the first time) | 2.4 s | 15.0 s | 2.6 s | 10.8 s |
| **World ready (loading screen lifts, the arrival starts)** | **20.0 s** | **17.7 s** | **7.6 s** | **18.7 s** |
| Bytes over the wire | 21.7 MB | 24.4 MB | 3.8 MB (audio) | 2.6 MB |
| Files | 539 | 527 | 527 | 529 |
| Models: files, last one in | 333, 28.5 s | 321, 26.1 s | 321, 15.6 s | 321, 24.8 s |
| Textures: files, last one in | 40, 68 s | 41, 60 s | 39, 49 s | 42, 61 s |
| Code: chunks, last one in | 73 (1.1 MB), 3.5 s | 73, 15.1 s | 73 cached, 3.7 s | 73 cached, 11.4 s |

What the loading time is made of (fast, cold):

| Part | Time | What |
|---|---|---|
| Code chunks | 0 to 3.5 s | 73 chunks, 1.1 MB (26 already cached by the title); the canvas mounts at 0.8 s |
| World generation | about 0.4 s | the new world's height and surface images (200 KB) fetched and decoded before the island mounts |
| Models and textures | 0.2 to 28.5 s, in waves | requests start in bursts at 0, 2 to 3, 9, 13, 19 to 20 and 28 s: each wave waits for the main thread to mount what the last one brought (React suspense waterfalls). 333 model requests, 18 MB of bodies |
| Shader compiles | about 5 s | 139 programs linked behind the loading screen, one frame of 5.1 s; the GPU process compiles more in the background (frames at ~100 ms with almost no script time) |
| Main thread between waves | most of the rest | React's scheduler tasks of 300 to 600 ms each as suspended models resolve and mount (the scene sits under one Suspense boundary, so each retry renders it again) |
| Audio | after the arrival | music and ambience (1.5 to 4 MB) start at the walk-along, not in the loading time |

The network is not what makes it slow: on the 12 Mbps line the island was ready no later than on the 100 Mbps one.
A warm browser (fast, warm: 7.6 s) is quicker mostly because Chrome's GPU program cache already holds the compiled
shaders and nothing is downloaded; on the slow line the warm visit still revalidates 321 models one by one.

### The main thread while loading, profiled

A fifth run (fast, cold, `next build --no-mangling` so the profile has names; 0.5 ms CPU samples), page start to world
ready (6.7 s that run: the Metal shader cache was warm from the earlier runs, which is also why it was the quickest):

| Self time | Function | What it is |
|---|---|---|
| 967 ms | `getProgramInfoLog` (from three's `onFirstUse`) | waiting on shader links the first time each material draws |
| 618 + 188 + 127 + 61 + 54 ms | `blurCells`, `deriveShape`, `at`, `valueNoise`, `cellLerp` (`lib/game/grid.ts`) | the new world's terrain shape derived from the shipped map, one 1.15 s frame |
| 111 + 53 ms | `dt1d`, `squaredDistanceTransform` | the shore distance field, one 0.48 s frame |
| 208 ms | `seabedProps` (`water/Seabed.tsx`'s memo) | computed again in 6 frames (70 to 150 ms each) as the scene re-renders under suspense |
| 212 ms | garbage collection | |
| 176 ms | `texSubImage2D` | texture uploads |
| 39 + 35 + 14 ms | turbopack `instantiateModule`, `heightField`/`decodePng`, `classifyWater` | the island's code evaluated, the world's images decoded, the water classified |

In play: one 195 ms frame at the first campfire in reach, all of it `new AudioContext()` inside `AudioManager.setLoop`
(opening the audio device the first time a loop layer plays).

## Long frames (over 50 ms) through the arrival and the first minute

| Phase | fast, cold | slow, cold | fast, warm | slow, warm |
|---|---|---|---|---|
| Loading screen (behind the card) | 54, worst 5101 ms (5.1 s in shader compile) | 89, worst 2597 | 20, worst 1875 | 36, worst 6296 (3.4 s compile) |
| Aboard Bram's boat (creator canvas opens) | 42 of 49 frames, worst 279 ms, ~100 ms each | 23, worst 153 | 2, worst 153 | 17, worst 257 |
| The reflection creator | 37 of 38 frames ~100 ms | 20, ~100 ms | 0 | 35 of 35 ~100 ms |
| Clearing (Yes) | 19 of 23, worst 106 | 2, worst 792 (597 compile) | 2, worst 730 (594 compile) | 18 of 19 ~100 ms |
| **The crossing** | **155, worst 2822 ms (2.6 s compile)** | 175, worst 120 | 1, worst 70 | **226, worst 2594 ms (4.2 s compile)** |
| **The landing** | **3 of 3, worst 1905 ms (1.6 s compile)** | 11 of 12, worst 405 (388 compile) | 0 | 0 |
| Walk-along with Bram | 44 of 52 ~100 ms | 41 of 46 ~100 ms | 0 | 23 |
| First minute of play | 4 of 8279, worst 2139 ms | 2, worst 326 | 1, worst 500 | 3, worst 433 |

What causes them:

1. **The crossing and the landing recompile the island's shaders.** The program links through the crossing show why:
   61 of the 75 programs linked there are the same materials again with **three directional lights instead of two**.
   `IslandAtmosphere` mounts the rim light only when the phase has one (`{light.rim && <directionalLight>}`); the
   crossing is held at dawn's golden light, which has a rim, so a light appears, every lit material's program changes,
   and the scene relinks: 2.6 to 4.2 s of frozen and stuttering frames as the drone shot opens. Back in real time on the
   dock the light goes again (another 0.4 to 1.9 s at the landing). The same happens in play at every real dawn and
   dusk. (The other 14 links in the crossing are things first seen there: the boat at sea, the crates, Bram.)
2. **Shaders compile on first sight.** The warm-up renders 14 frames of what the camera sees, so anything outside that
   view compiles the first time it comes into view: the 2.1 s frame in the first minute of play, the crossing's boat and
   crates. A warm browser (GPU program cache) hides most of it, which is why "fast, warm" is smooth.
3. **~100 ms frames with almost no script.** Through aboard, the creator, the clearing and the walk-along, frames sit
   at ~100 ms while the long-animation-frame entries show 20 to 30 ms of script: the rest is the GPU process (its
   background shader compiles, the creator's second WebGL context and its 1024 px reflection target, the thumbnail
   baker's `readPixels`). They vanish in the warm-browser run.
4. **The creator's character loads late.** Its textures (a 4.3 MB hair colour map and the 1 MB face atlas) are first
   requested when the arrival starts, after the loading screen has lifted: 0.5 s of texture upload in the aboard beat.
5. **The title page itself stutters on a slow line** (63 long frames, worst 1.3 s) while its own 17 MB stream in.

## Not measured

- Not on David's machine or Windows (D3D shader compiles are slower than Metal's): the M4 here is the fast case.
- The signed-in path (`/student/go` redirect, the arrival flag and look from the database): the run is signed out with
  `?arrival=1`.
- Phones: they get the companion, not the island.
