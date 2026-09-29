# Look development (row 235: sunny, not flat)

David (2026-09-26): "the main thing i need worked on is the graphics of the game and the looks direction of the game, it still looks too flat... like the new zelda game, new mario games, have this sunny game feel". He is sending example screenshots into `specs/references/look/david/`; those are the only references (never source images elsewhere). This spec prepares the instrument before they arrive, then turns each reference into settings.

## 1. Baseline and flatness diagnosis
- Capture the current game with fixed cameras and forced time/weather/season: village at day, golden hour, dawn, night, overcast; HQ interior, cafe, ruins; at the High and Light tiers. Save WebP under `specs/evidence/look/baseline/`.
- Read the render pipeline and record every value that shapes the look, with file:line: renderer (toneMapping, exposure, output colour space), sun/key light (intensity, colour, elevation), fill (ambient, hemisphere sky/ground colours and intensity, environment/IBL intensity), the key:fill ratio (CLAUDE.md known defect D3 measured 1.08:1, target about 4:1), shadows (type, softness, darkness, colour), fog/haze (colour, distance), post (grade: desaturation and black lift, D4; bloom; FXAA; pixel filter), materials (roughness/metalness/specular on terrain, dump props and the v6 characters), sky, camera FOV (D6).
- Measure from pixels on the same frames: luminance histogram, RMS contrast, mean saturation, lit-vs-shadow luminance ratio on a ground patch, share of pixels in the mid-grey band.
- Write `specs/look/baseline.md`: a ranked list of why the image reads flat, each with the measured number, the parameter, and the file:line that sets it.

## 2. Look lab (`/lab/look`, dev only)
The real village scene with one `LookPreset` object driving everything, edited from a panel:
- **Light:** sun intensity, colour temperature and elevation; fill (hemisphere sky/ground colours, intensity), live key:fill readout; rim/back light.
- **Shadows:** soft vs crisp, shadow colour/tint (cool coloured shadows), opacity.
- **Ambient occlusion:** screen-space AO from an installed library if available (`@react-three/postprocessing` is installed; check its N8AO/SSAO exports before adding anything).
- **Materials:** per class (terrain, props, foliage, water, characters): saturation, value, roughness/specular, a toy-gloss option for characters and props.
- **Post:** tone mapping (ACES, AgX, Neutral), exposure, saturation/vibrance, warm/cool grade, bloom (threshold, intensity), tilt-shift depth of field, vignette, optional outline.
- **Sky and air:** sky colours, fog colour/distance for aerial perspective.
- **Presets:** "Current" (exact current values), plus three starting directions built from general rendering knowledge (no images): "Toy diorama" (tilt-shift DOF, glossy toy materials, saturated, soft AO), "Open-air sun" (strong warm sun, blue sky fill, crisp cool shadows, AO, bloom on highlights), "Soft painterly" (lower contrast but saturated, big soft shadows, heavy aerial perspective). A/B toggle between the current and edited preset, a "copy preset JSON" button, and an FPS + draw-call readout per preset.
- Expensive effects (AO, DOF, bloom) are tagged High-only; the Light tier must stay at 30 FPS on integrated graphics.

## 3. Per-reference breakdowns (after David's screenshots arrive)
For each reference: what makes it sunny (light direction and ratio, shadow colour, saturation and value structure, material response, atmosphere, post), which lab controls reproduce it, a preset JSON, and a side-by-side of the reference next to the game with that preset. David picks; the picked preset becomes the game's day look, with golden hour, dawn, night and weather derived from it.

## 4. Apply
Replace the lighting/grade/material values in the game with the chosen preset per time of day and season, keep the quality tiers, re-shoot the baseline cameras for a before/after, and keep the applicant island on the same look.

## 5. Apply "Open-air sun" (David's pick, row 236)
Starting from the preset's exact values (`web/lib/game/lookPreset.ts`) and the baseline findings (`specs/look/baseline.md`):
1. **Day look = the preset**, with exposure nudged toward 1.05 so bright ground reaches about L* 80–85, and the key:fill ratio held near 4:1 (sky-light/IBL fill reduced, hemisphere fill blue from the sky).
2. **Put the sun where shadows read:** the baseline found the sun behind the camera (shadows cover 16% of the plaza). Move the sun's azimuth to a side-front angle relative to the fixed follow camera so every building and tree casts a visible shadow toward the viewer's side, while real sunrise/sunset timing (rows 173, 188) still drives elevation and colour.
3. **Sky and air:** saturated blue sky gradient and a blue aerial perspective with fog starting further out; sea and river saturation matched.
4. **Materials:** restore the grass texture's contrast (baseline: 38% kept at `GridTerrain.tsx:679`) with a light hue variation; a little specular/lower roughness on props, water and characters so highlights appear (target a few percent of pixels near white on a sunny frame, not 0.4%); foliage keeps a soft wrap so trees are not black on the shadow side.
5. **Derived looks:** dawn (cool-pink, long soft shadows), golden hour (warm, long shadows, stronger rim), night (blue moonlight key, warm lamp pools and windows kept), overcast/rain/fog/snow (lower ratio, softer shadows, never grey-flat), and the four seasons' tints, all as multipliers on the day preset so one preset stays the source of truth. Interiors (HQ, cafe, museum, homes) get matching warm key light and AO.
6. **Tiers:** High gets AO, bloom and soft shadows; Light keeps the same colours, ratio and sky with blob shadows and no AO/bloom, and must stay at 30 FPS on integrated graphics.
7. **Applicant island** uses the same look.
8. **Evidence:** the baseline cameras re-shot after (`specs/evidence/look/after/`) with before/after sheets per camera and time of day, the pixel measurements repeated (ratio, RMS contrast, saturation, highlight share), and FPS per tier. The lab's "Current" preset becomes the new look so further tuning keeps working in `/lab/look`.

## 6. Glints and reflections (row 237)
- **Water:** a sun glint path on the sea/river/pond that follows the real sun azimuth, and white sparkle highlights on wave crests (small, flickering, brightest near the glint path), bloom catching them on High; Light keeps a cheaper sparkle without bloom. Reuse the existing sea-glint sprite system (July: dump sparkle sprite, two counter-phase point clouds) and the water shader rather than adding a new one.
- **Glass:** building windows and glass props reflect the sky/environment and show a sun specular; night keeps the warm lit windows.
- **Metal:** lamp posts, signs, clock, railings, metal fittings and weapons get metallic response with environment reflections and a crisp sun highlight.
- **Unchanged:** characters (matte), terrain, foliage, fabrics, wood.
- **Tone mapping:** Neutral stays (row 237).
- Evidence: before/after at the look cameras (day, golden hour) plus close-ups of the glint path, a window and a lamp post; highlight share re-measured; FPS per tier.

## 7. World effects are world state; sparkle comes from optics (row 238)
David (2026-09-27): "I need you to be forward thinking when it comes to game dev for multiplayer, shouldnt do per player graphic stuff like the leaves following the character, and should be a overall world graphic... the water sparkle is nice and what i want, but I want there to be acutal logic behind it and the movement and perspective of the player determine the sparkle of the water... done tastefully and logically makes sense based on perspective and not just randomized sparkle slapped on." This reverses coordinator rulings 18 and 23 in `specs/look-development-questions.md` (the folded glint path and the sprites' own flash clocks).

### 7.1 The rule
- **What exists in the world is a function of world state only:** world position, world time, and shared state that every client already agrees on (the real London ON weather and sunrise/sunset from Open-Meteo, the season, the map). Two players standing in the same place at the same moment see the same rain streaks, falling leaves, fog banks, cloud shadows, waves and tree sway. Nothing in the world is positioned relative to "the" player.
- **What only a viewer sees is optics:** the camera, tone mapping, bloom, and which water facets mirror the sun into this particular eye. Those depend on the viewpoint because they physically do.
- **Culling is per view, existence is not.** Drawing only the part of a rain volume or a leaf field near the camera is fine; moving that volume with the player is not.
- **Randomness is a fixed property of the world,** seeded by world position or object id (the same everywhere), never `Math.random()` or a per-client clock.
- **Action effects** (a catch, a pick, a spell) are drawn from an event: actor, world position, start time, kind. They attach to whichever avatar acted, so the same effect can arrive over the network later. No change needed now beyond not adding new effects that read the local player directly.

### 7.2 One world clock
Every world animation reads one clock derived from real time (UTC), not `clock.elapsedTime`, so separate clients agree today (to their device clocks) and the multiplayer server offset slots in later in one place. It must keep float32 precision in shaders and may wrap at most once a day at a quiet hour (a visible pop at 4 a.m. Toronto is acceptable; hourly is not). Consumers: water, tree wind, cloud shadows, rain/snow, falling leaves/petals, mist, fireflies, gulls and anything else ambient that is mounted in the member or applicant island.

### 7.3 Player-following effects to convert (audited 2026-09-27)
| Effect | Today | Becomes |
|---|---|---|
| Rain and snow (`RainFX.tsx`) | 240 streaks in a 36×18×36 box centred on the player | A world rain/snow field: streak positions a periodic function of world position and world time (one world tile repeating), drawn in a window around the camera; slant from the world wind |
| Spring petals / autumn leaves (`SeasonalParticles`, `AmbienceFX.tsx`) | 130 flakes in a 52-unit box centred on the player | Shed by the actual trees: each suitable tree (from the map's props) drops a few leaves or petals from its canopy on a schedule seeded by the tree's id and world time; they drift with the world wind, land on the ground below/downwind, rest briefly and fade. No tree nearby, no leaves |
| Fog mist (`MistBanks`) | 9 sprites orbiting the player | Fog banks at world positions (over the sea, river and low ground), drifting with the world wind |
| Cloud shadows (`CloudShadows`) | World plane, but scrolled by each client's accumulated frame time | Offset from the world clock and world wind |
| Tree sway (`TreeWind`), fireflies, gulls, water | `clock.elapsedTime` per client | World clock |

`LeafGusts` (Math.random) and `LeafDrift` are not mounted in either island; leave them unless they are mounted.

### 7.4 Water sparkle from the sun, the waves and the eye
Measured 2026-09-27 for the shipped follow camera (focus + (0, 7.4, −10.8), FOV 48): with the day sun at [20, 22, −11] (behind the camera), a wave facet would have to tilt **at least 29°** to mirror the sun into any on-screen water pixel (dawn 41°, golden hour 40°, moon 31°). The island's water facets tilt at most about 9° (swell 2.2°, ripple normal 6.8°). So **physically correct sparkle never appears with the sun behind the camera**; it appears only when the sun is roughly in front of the view (azimuth within about 60° of straight ahead). Where the sun sits is David's call (row 239, pending); the model below is independent of it.
- **Real sun, no fold.** The water reflects the actual key light (sun by day, moon by night). `glintDirection`/`GLINT_FOLD` go.
- **The glare is the facet distribution.** The broad sheet is the chance that a facet at that point is tilted to mirror the sun into this eye: a lobe on the angle between the half vector (sun + view) and the mean wave normal, with a width set by how rough the water is. Calm water gives a tight, bright path; wind (the real weather) roughens it into a wider, dimmer spread.
- **Each sparkle is a facet.** Sparkle points stay at fixed world positions on the water (the existing sprite cloud, riding the swell). Each has a normal: the local wave normal (swell + ripple texture, world position, world time) plus a fixed micro-tilt for the ripples too small to model, seeded by its position. It flashes only when that normal nearly mirrors the sun into this viewer's eye (sharp lobe, tolerance no smaller than the sun's apparent size in-game). No per-sprite clocks, no time-hashed noise. It twinkles because the waves move it through alignment and because the viewer moves.
- **Only where the sun reaches:** scaled by the sun's intensity and colour for the phase and weather (none under overcast, rain, snow or fog), and dimmed under a passing cloud shadow at that point.
- **Fast chop (approved 2026-09-27):** a facet's own slope is its fixed tilt (Beckmann, RMS 0.6 roughness, cut at 0.9) plus short wind waves passing it: three trains 0.43-0.61 units long on deep-water dispersion (about 2 Hz), 0.2 roughness of slope each, a function of world position and world time only (`chopSlope`, mirrored in GLSL). A standing viewer sees flashes of about 0.2 s (was about 1.5 s) with about as many lit; the total never passes 1.5 roughness, so a sun behind the camera still lights nothing.
- **Cloud shadows:** the glare sheet and the sparkles are multiplied by the sunlight left under the cloud layer at that point: the same texture, world-clock drift and wind that `CloudShadows` draws, sampled without its drawing edge, because the clouds are over the sea too. No clouds drawn (Light tier, indoors), no dimming.
- **Tasteful:** it is sparse by construction (only aligned facets light), sits inside the glare lobe, and bloom only catches the brightest cores on High. Light draws fewer points without bloom and uses the same physics.
- **Check it the way the physics predicts:** sun behind the camera, no sparkle; sun ahead, the sparkle band centres on the mirror point and slides with the camera as the player walks; the same camera position and world time give the same sparkles on every reload.

### 7.5 Evidence
Frame sequences in `/lab/island` (and `/lab/look` with a sun-direction override) at two player positions for each converted effect, showing it stays put in the world while the player moves; sparkle with the sun behind vs ahead, calm vs windy, clear vs a passing cloud; unit tests for determinism (same world time and position, same result; player position does not enter); FPS per tier unchanged.

## 8. The real sun path (row 239)
David picked "real sun, sparkle afternoons" (2026-09-27). Measured sun over London, ON (42.98 N, 81.25 W), camera facing west: Sep 27 the sun is behind-left 9-12 h (front-lit, the approved look sits near 11:45), on the left at 13-14 h, within 60° of straight ahead from 15:00 to sunset (sparkle), setting 4° left of centre; Jun 21 ahead from 15:00, setting 33° right; Dec 21 ahead from 15:00, setting 32° left.
1. **Compass:** +z (camera forward) is west, +x (screen-left) is south, so a compass azimuth A (from north, clockwise) is world direction (x, z) = (−cos A, −sin A). Update the convention where it is written (`lib/game/defaultIsland.ts` header, `components/game/MiniMap.tsx` / `DefaultIslandMap.tsx`: the N marker moves to the right edge, the map stays camera-aligned), `lib/study/seats.ts` comment, and compass words in player-facing strings (e.g. the ruins fetch mission's "north-west corner" becomes the matching new direction). Internal kit naming in `grid.ts` (neighbour bits) is not geography; leave it.
2. **Direction:** the key light's direction is the real solar position for the current time (one small solar-position function with tests against known values), replacing each phase's fixed `elevation` and `mirror` (`lookPreset.ts` PHASE_LOOK). Phase colours, intensities, fill and grade stay per phase as today (the real sunrise/sunset clock still picks the phase). Below a few degrees of elevation the light keeps a small minimum elevation for shading so dawn and dusk never go edge-on.
3. **Everything that reads the sun follows it:** shadows (High realtime shadow camera; `StaticShadows` refresh), the environment map's sun (`envLight`), the rim light only if it would fight the sun, the sky if it draws a sun, glass/metal highlights (they already use the key light). Update at most about every half degree of sun travel (a couple of minutes), not every frame.
4. **Night:** the moon stays today's fixed key light (no moon lane while it sits behind the camera). A real moon is a later option.
5. **Previews:** `/lab/island?time=<phase>` keeps working with a representative time per phase; add `?at=HH:MM` (Toronto time, optional `&date=YYYY-MM-DD`) to force a clock time for review. `/lab/look` keeps its manual sliders.
6. **Evidence:** village frames at 09:00, 11:45, 13:00, 15:00, 17:00 and 18:30 on Sep 27, plus 17:00 on Jun 21 and Dec 21; before/after of the 11:45 frame against the approved look (should match closely); FPS unchanged.

## 9. Shadows: one logic for every asset (row 240)
David (2026-09-27): "I need you to redo the shadow logic of all the assets, because they are all over the place and inconsistent, look at the root cause, is it because the assets were using from the acnh folder inconsistent, because the orientation for the assets are sometimes upside down or not right side up."

### 9.1 Root cause (measured 2026-09-27)
- **Not orientation.** A census of all 550 GLBs (`specs/evidence/shadows/census-glb.mjs`, `census-normals.mjs`): every island asset is Y-up and rests on y≈0 (the critters' Z-up exports carry a correcting root rotation), none is mirrored, triangle winding agrees with the normals, normals point outward (canopies 90–98%, rocks 100%), and no placement in code flips anything.
- **The ACNH import is part of it.** ACNH's oak and cherry trees (`PltTreeOak3`, `PltTreeOak4`, `PltTreeOak4Sakura`, and their snow variants) ship a dedicated low-poly shadow caster: `mShadow` (a closed hull the size of the tree, 659 vertices) and `mShadowShake` (the canopy caster, with its sway pivot in the vertex colour). The visible leaf cards are not meant to cast. `scripts/extract-acnh-kit.mjs` drops both (`EFFECT_MATERIALS`), so in our game the double-sided leaf cards cast and self-shadow into dark blotches (the canopies near the camera), patched with a receive-off exception for two species only. ACNH does **not** bake shadows into every asset: of 11,234 source models only interior room shells, those oaks and two snow bushes carry `mShadow`; props and buildings are closed solids that cast with their own mesh. CLAUDE.md rule 7 and the `organize-dump.mjs` note said otherwise and were wrong.
- **Three render systems that disagree:**
  1. A directional shadow map on High, cached (`gl.shadowMap.autoUpdate = false`) and refreshed only on phase, sun, quality or loading changes (`StaticShadows`, `DefaultIslandWorld.tsx`), so anything that changes without a load keeps a stale shadow.
  2. Centred blob circles: always under bushes and flowers (opacity 0.16) on top of their real shadows, and under trees, props and landmarks on Light (0.45), pointing nowhere.
  3. Characters (player, residents, NPCs) never cast (`character/Character.tsx`) and only get a centred blob, next to props whose shadows fall away from the sun.
  On top of that, per-call-site opt-outs (`castShadow={false}` on fences, small rocks and plants, grass tufts, several ruins, home, study and workshop props), and every GLB material forced `DoubleSide` in `prepareModel`, so all thin geometry writes both faces into the shadow map.

### 9.2 The logic
One classification decides every asset's shadow role, in one place (like `lookClassFor`), not per call site:

| Class | Sun shadow (High) | Contact shadow (both tiers) | Receives |
|---|---|---|---|
| Solid: buildings, props, furniture, rocks, fences, bridges, benches, lamps, characters, enemies | casts | yes, sized to its footprint | yes |
| Foliage: tree canopies, bushes | casts through a clean caster: ACNH's `mShadow`/`mShadowShake` where the source has one, otherwise a closed low-poly hull or front faces only; leaf cards never cast | yes | canopy cards do not (no self-blotching); trunks do |
| Small: flowers, shells, pebbles, grass tufts, pickups | no | small | yes |
| None: water, effects, glass shells, sky, UI | no | no | as today |

- **Sun shadows follow the real sun (row 239)** and look the same on every object: one directional shadow map on High, fitted to the island for the current sun direction; the static world stays cached and refreshes whenever a static caster is added, removed or moved (a change counter, not only loads) and when the sun moves (the sun-path cadence). Characters and other moving things cast real sun shadows that move with them every frame without re-rendering the whole static map each frame (measure the options three r182 offers, e.g. per-light `shadow.autoUpdate`, layers, a second caster pass; pick the cheapest correct one and record its FPS cost).
- **Contact shadows** give every grounded object the soft darkening directly under it, on both tiers (the grounded ACNH look). One component and one look (the phase's shadow tint) replaces every current `BlobShadows` use (plants, Light-tier solids, character blobs). On High they sit lighter under the sun shadow so the two never double up.
- **Light tier:** contact shadows plus a cheap sun-directed shadow for tall casters (a soft shape offset and stretched along the sun direction by the object's height), so both tiers agree on direction. No shadow map.
- The approved look stays the source: shadow tint, softness and opacity per phase from `lookPreset`.
- Scope: member island, home island, ruins, applicant island (shared code). Interiors wait (row 237) but pick up the classification wherever they use `prepareModel`.

### 9.3 Evidence
Before: `specs/evidence/shadows/before/` (plaza, shore, west and east trees, north, after a walk), captured with `specs/evidence/shadows/shots.mjs` from the demo server. After: the same cameras, plus a close-up of an oak and a cherry canopy, a fence run, the player beside a lamp post at 11:45 and 17:00 (both shadows pointing the same way), the Light tier, and FPS per tier.
