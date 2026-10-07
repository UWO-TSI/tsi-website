# Performance baseline, October 2026

Before the performance pass (David: "run the models in the game low weight ... make the game play more smoother, cuz
currently it's starting to get laggy for combat and mobs and stuff. I don't wanna sacrifice looks but improve
performance"). Measured on `game/perf` at 54de1695 (main c4059215 plus the probe), 2026-10-07.

## How

- **Machine:** Apple Mac mini, M4 (integrated GPU), 16 GB, macOS 26.6.2. Chrome for Testing 147 (Playwright), headed,
  ANGLE on Metal, 1280 × 800 at device pixel ratio 1, off to the side of the display (never brought to the front),
  muted. Other agents' builds and browsers were running: the 1-minute load average was 4.8–7.1 throughout.
- **Bench:** `specs/perf/perf-bench.mjs`. Each scene opens on a fresh page, waits for the world to settle (3 quiet
  seconds, then 4 more for shaders and the shadow bake), then samples every frame for 8 s. The probe
  (`components/game/PerfProbe.tsx`, development builds and the measurement build) records per frame: draw calls and
  triangles over every pass, character mixers stepped, skeletons uploaded, how many times the scene was rendered, and
  the main thread's time from the first frame callback to the end of the scene render ("frame CPU").
- **Two clocks:** the frame-rate rows run uncapped (`--disable-gpu-vsync --disable-frame-rate-limit`) so FPS shows what
  a frame costs rather than the display's 144 Hz; the hitch rows (`vsync`) run at the display's pace, as a member plays.
- **Builds:** `prod` is a production `next build` with the development gates lifted for the bench
  (`specs/perf/measure-build.sh`: optimised React and three, the lab's scenes and hooks); `dev` is `next dev`.
- **Scenes:**
  - **Ruins fight** (`/lab/island?ruins=1&combat=demo&classes=v2&mastery=20`): K5's pack of 17 (five foxes, three crabs,
    three mushrooms, three wisps, three pollen sprites) at 30× health hunting you, you can't fall, the kit's keys 1–5
    and the basic on a loop, the ult at 1 s and again at 6 s. The four heaviest ults: Shadow Garden (Summoner), The
    Joker (Illusionist), Cataclysm (Elementalist), Thousand Arrows (Marksman).
  - **Village** with `?bots=24` (the loopback: 24 players walking, resting on benches, a few in the café), the
    residents, standing at the spawn.
  - **Café** (`?cafe=inside&bots=24`): the patrons, the owner, the café's bots.
- **Tiers:** High (the members' default where the probe allows it: shadow maps, AO, wind sway) and Lite. The pixel
  finish on (the default: the canvas at half resolution).
- **Raw rows:** `specs/perf/runs/before-*.jsonl` (each with its CPU profile's top self time).

## Numbers

Production build, uncapped:

| Scene | Tier | Build | FPS | 1% low | Median ms | p95 ms | Worst ms | First ult ms | Second ult ms | Draw calls | Triangles | Scene renders | Skinned meshes | Mixers / frame | Skeletons / frame | Frame CPU ms (p95) | JS heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| village | high | prod | 158.2 | 109.4 | 6.2 | 7.6 | 15.6 | – | – | 456 | 414k | – | 52 | 16 | 35 | 5.2 (6.2) | 211 |
| cafe | high | prod | 322.5 | 125.4 | 2.7 | 6.6 | 9.4 | – | – | 139 | 67k | – | 14 | 7 | 7 | 2.3 (6.1) | 109 |
| ruins-summoner (Shadow Garden) | high | prod | 149.3 | 15.2 | 5.6 | 10.3 | 148.8 | 148.8 | 111.7 | 425 | 225k | – | 6 | 2 | 4 | 4.6 (8.8) | 100 |
| ruins-illusionist (The Joker) | high | prod | 157.7 | 25.5 | 6 | 8.2 | 164.9 | 59.7 | 12.6 | 393 | 215k | – | 10 | 5 | 7 | 5 (6.8) | 106 |
| ruins-elementalist (Cataclysm) | high | prod | 166.8 | 26.1 | 5 | 10.7 | 201.6 | 15.7 | 201.6 | 329 | 194k | – | 2 | 2 | 2 | 4 (9.3) | 98 |
| ruins-marksman (Thousand Arrows) | high | prod | 169 | 23.6 | 5.2 | 8.9 | 216 | 27.7 | 25.1 | 331 | 193k | – | 2 | 2 | 2 | 4.1 (7.5) | 116 |
| village | lite | prod | 251.4 | 160.5 | 3.9 | 5 | 8.8 | – | – | 325 | 318k | – | 42 | 11 | 19 | 3.3 (4) | 202 |
| cafe | lite | prod | 615.1 | 244.9 | 1.6 | 3 | 6.5 | – | – | 100 | 61k | – | 12 | 6 | 6 | 0.9 (2.6) | 85 |
| ruins-summoner (Shadow Garden) | lite | prod | 307.5 | 28.9 | 2.8 | 4.8 | 182.5 | 108.2 | 10.7 | 238 | 161k | – | 6 | 2 | 1 | 2.3 (3.7) | 96 |
| ruins-illusionist (The Joker) | lite | prod | 281 | 49.6 | 3.4 | 5.4 | 73.8 | 55.1 | 12.9 | 218 | 151k | – | 10 | 4 | 3 | 2.8 (4.3) | 106 |

Development build (uncapped, then at the display's pace for the hitches):

| Scene | Tier | Build | FPS | 1% low | Median ms | p95 ms | Worst ms | First ult ms | Second ult ms | Draw calls | Triangles | Scene renders | Skinned meshes | Mixers / frame | Skeletons / frame | Frame CPU ms (p95) | JS heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| village | high | dev | 145.5 | 89.6 | 6.8 | 8.8 | 13.4 | – | – | 468 | 447k | 3 | 63 | 23 | 44 | 5.7 (7.4) | 260 |
| cafe | high | dev | 297.2 | 112.1 | 3.1 | 6.7 | 10.5 | – | – | 140 | 68k | 3 | 15 | 7 | 7 | 1.2 (5) | 163 |
| ruins-summoner (Shadow Garden) | high | dev | 130.1 | 7.5 | 5.9 | 10.8 | 527.9 | 527.9 | 219 | 424 | 224k | 3 | 6 | 2 | 4 | 4.8 (8) | 191 |
| ruins-illusionist (The Joker) | high | dev | 152.2 | 22.8 | 6 | 9.8 | 199 | 58.4 | 14.2 | 399 | 216k | 3 | 10 | 4 | 6 | 4.9 (7.1) | 194 |
| ruins-elementalist (Cataclysm) | high | dev | 161 | 24.8 | 5 | 10.9 | 200.9 | 16.2 | 200.9 | 344 | 194k | 3 | 2 | 2 | 2 | 4 (9.3) | 141 |
| ruins-marksman (Thousand Arrows) | high | dev | 162.7 | 22.4 | 5.4 | 9.2 | 195.7 | 16.8 | 15.6 | 320 | 192k | 3 | 2 | 2 | 2 | 4.3 (7.1) | 199 |
| village | high | dev, vsync | 114.4 | 47.6 | 7 | 14.4 | 28 | – | – | 474 | 456k | 3 | 65 | 23 | 46 | 6.3 (7.9) | 254 |
| cafe | high | dev, vsync | 144 | 114.7 | 6.9 | 8.6 | 8.8 | – | – | 138 | 67k | 3 | 14 | 7 | 7 | 1.3 (1.6) | 129 |
| ruins-summoner (Shadow Garden) | high | dev, vsync | 116.1 | 19.7 | 7 | 14.2 | 138.9 | 138.9 | 41.3 | 422 | 225k | 3 | 6 | 2 | 4 | 4.8 (6.3) | 122 |
| ruins-illusionist (The Joker) | high | dev, vsync | 116.1 | 22.7 | 7 | 14 | 152.9 | 35.4 | 15.1 | 400 | 216k | 3 | 10 | 4 | 6 | 5.9 (7.2) | 147 |
| ruins-elementalist (Cataclysm) | high | dev, vsync | 115.9 | 24.1 | 7 | 14 | 159.8 | 20.9 | 159.8 | 339 | 194k | 3 | 2 | 2 | 2 | 4.7 (5.5) | 186 |
| ruins-marksman (Thousand Arrows) | high | dev, vsync | 118.6 | 26.4 | 7 | 14 | 145.8 | 145.8 | 20.5 | 327 | 192k | 3 | 2 | 2 | 2 | 4.8 (5.8) | 126 |

"First ult" and "Second ult" are the longest frame in the 1.5 s after each F press. "Scene renders" is how many times
the scene was drawn in one frame (the probe could count it only after the production build was made).

## Where the time goes

CPU profiles (`PROFILE=1`, 200 µs samples, self time) and the long frames broken down by function (`HITCH=1`, 100 µs
samples over the measured pass):

1. **High renders the whole scene three times a frame.** The ambient occlusion pass (N8AO, High only) switches itself to
   "transparency aware" as soon as the scene holds one transparent material (it always does), and then every frame
   renders the scene twice more, once for transparent objects that write depth and once for those that don't. Each of
   those `renderer.render` calls walks the scene graph again for world matrices and redraws the moving casters' shadow
   map (SunShadows sets the shadow map to update on every render); N8AO also walks the scene five more times a frame
   and builds a Map of every object to remember its visibility. Scene-graph work is the largest single block:
   `updateMatrixWorld` + `multiplyMatrices` + `traverse` + `projectObject` are 23% of the village's frame time (dev) and
   17% (prod); skeletons are uploaded twice per character per frame (35–46 a frame for 16–23 animated characters). Lite
   has no AO: the village's median frame is 3.9 ms on Lite against 6.2 ms on High.
2. **Every first ult stalls 125–180 ms on shader compiles.** Every long frame in the fights is `getProgramInfoLog`
   (waiting on a program link) under `replaceLightNums`: the combat effects' two pooled point lights are hidden until an
   ult or a heavy hit lights one, and a light appearing changes the light count of every lit material in the scene, so
   all of them recompile at once. The second cast is cheap because the programs are cached; a later effect that lights
   the second light (Cataclysm's finisher, ~5 s after the cast) stalls again. Effects that wait hidden (the Warden's
   beasts and trees, the Joker's mirror, the FX meshes) also compile on first use.
3. **The ruins draw 408 instanced meshes,** one per model part per enemy type plus another set per ally model (summons,
   shades, the Warden's beasts): almost all of them empty in any fight, and each still costs a draw call and a shadow
   pass draw (an instanced mesh with no instances is drawn with zero instances, not skipped). 320–425 draw calls in the
   ruins, with `renderBufferDirect`, `uniformMatrix4fv`, `bindVertexArray` and `bufferSubData` the top GL costs.
4. **SunShadows walks the whole scene every frame** to sort its casters (`visit`: 1–4%).
5. **Characters cost the same at any distance:** the full ~3–4k-triangle mesh, a mixer step every frame, the sun shadow,
   for a resident 40 m away the same as for you. With 16–23 animated characters in the village the character code
   itself (`Puppet.update`) is ~2% of the frame; their draws, shadow draws and skeleton uploads add to items 1 and 4.
6. **Layout reads in combat:** `getBoundingClientRect` every frame from the ult's screen spots (`toScreen`, once per
   point) and the damage numbers: 2–3.6% of the fight's frame.
7. **The café is cheap** (2.7 ms median, 139 draws): its time is GPU-side driver calls (`drawElements`, uniforms).

Not costs: the combat simulation (K5: under 0.2 ms at the 99th percentile), mob meshes (already instanced, one draw
per part per type), combat particles (pooled typed arrays, nothing allocated per frame).

## What this pass will do about it

In order of what they buy: render the extra AO passes without the matrix walk and the shadow redraw (same image);
keep the FX lights at a constant count and compile and upload everything hidden behind the ruins gate's fade; skip
empty instanced meshes; character LOD by drawn size (a lighter mesh, a slower mixer and no sun shadow only when small,
nothing up close); adaptive quality that steps down invisible-first when the frame rate stays low.
