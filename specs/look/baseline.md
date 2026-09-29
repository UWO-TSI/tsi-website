# Look baseline and flatness diagnosis (row 235, look-development.md §1)

Branch `game/look-lab`, 2026-09-26. Captures: `specs/evidence/look/baseline/` (WebP), produced by
`specs/evidence/look/shots.mjs baseline` and measured by `specs/evidence/look/measure.py`
(raw numbers in `specs/evidence/look/baseline/measure.json`). Headed Chromium on this M4 Mac mini,
1280×720 canvas at DPR 1, smooth mode (pixel filter off), `?season=summer`, signed out, dev build.
The baseline frames are `/lab/look?ab=A`, i.e. the game with no preset; the lab rig's material patch is
identity there (see "Lab parity" at the end). Directions and their captures: `specs/look/presets.md`.

Fixed cameras (the only ones used): **V1** plaza (follow camera, player at 0,−1), **V2** village overview,
**V3** shore (player at 6,−16), and the default cameras of **HQ**, **café** and **ruins**. Conditions: day,
evening (golden hour), dawn, night, overcast (= `weather=rain`, see questions §2), at High and Light.

## Why it reads flat (ranked)

Ranked by how much of the flat read each one explains, judged from the numbers below and from reading
the frames side by side. "Lit:shadow" is the linear-luminance ratio of the same grass pixels with and
without the key light's cast shadow (same frame, shadow opacity 0), so it measures the light, not the
albedo.

1. **The fill is as strong as the key.** On flat ground the key delivers 2.04 and the fill 1.44
   (key:fill **1.42:1**). The IBL alone is 54% of the fill (`environment.intensity` 0.38,
   `islandLighting.ts:74`), the hemisphere 35% (0.72, `islandLighting.ts:72`), ambient 11% (0.22,
   `islandLighting.ts:72`), and shadow opacity 0.85 (`islandLighting.ts:26`) lets another 15% of the key
   into every shadow. Measured lit:shadow on grass is **1.92:1** in V1, 1.90 in V2, 1.71 on the shore:
   under one stop, where a sunny exterior sits at 3-5:1. The D3 target (about 4:1 key:fill) was never
   reached; the applicant port of 09-16 kept the same budget. The result: a clear day and rain are
   nearly the same picture. RMS contrast is 0.198 clear vs 0.184 rain (+8%), mean saturation 0.368 vs
   0.323.
2. **The sky and the air are grey-cyan, not blue.** Background and fog are `#c7e0df` (HSV saturation
   0.11) at `islandLighting.ts:71`, flat, with no gradient (`IslandAtmosphere.tsx:68`). The sky strip at
   the top of V1 averages saturation **0.20** (0.16 in the overview). Fog starts 22 u from the camera,
   9 u past the player (`islandLighting.ts:73`), and greys by 18% with distance (`aerialFog.ts:25`), so
   the clubhouse, the temple and the sea already sit in milky air. Every direction preset with a blue
   gradient measures 0.55-0.62 on the same strip and reads sunnier before anything else changes.
3. **Shadows are weak, grey and mostly out of sight.** The sun is behind the camera on the left,
   34° off the view axis (`islandLighting.ts:71`), so cast shadows fall away from the viewer: they
   cover **16%** of V1, 6.8% of the overview and 9.5% of the shore. Where they land they are nearly
   neutral: per-channel lit:shadow R 2.32, G 1.87, B 1.87, so a shadow is only slightly bluer than lit
   grass, because the key `#fff5df` and the fill `#c4deef` are both near-white (saturation 0.13 and
   0.18). The Light tier has no shadow map at all, and dropping every cast shadow moves whole-frame RMS
   contrast from 0.198 (High) to only 0.195 (Light).
4. **Nothing catches the sun.** 0.4% of V1 pixels are above L* 90 and there are no specular glints on
   land. Everything is matte: terrain roughness 0.92-0.95 (`terrainMaterials.ts:246`,
   `GridTerrain.tsx:730`), characters 0.85 (`Character.tsx:27`), dump props median 0.85; bloom is off
   by default (`graphicsSettingsStore.ts:16`). With no highlights and no deep shadows the tones pile into
   L* 50-90: **71%** of V1 (histogram below), median L* 68, p95 only 85.
5. **The biggest surfaces have the least detail.** Grass is the largest area in every village frame,
   and its texture carries 38% of its own contrast (`mix(…, 0.38)`, `GridTerrain.tsx:679`). Lit-grass
   luminance varies by a coefficient of variation of only **0.105**, at saturation 0.336 (the tint
   `#91b47f`, `islandLighting.ts:15`, is itself saturation 0.30). Soil keeps 18% of its detail
   (`GridTerrain.tsx:700`), sand is compressed (`GridTerrain.tsx:715`), and the oak leaf atlas is
   compressed to 0.065 + 0.9·x (`modelMaterials.ts:129`). Large fields of one mid value.

Not the cause any more: the grade. Desaturation 0.035, black lift 0.25 (0.0125 absolute), contrast 1,
Neutral tone mapping at exposure 1 are all within a few percent of identity (`islandLighting.ts:16`,
`PostFX.tsx:130-135,168`); the D4 retune landed. Also minor for flatness, though real for readability:
the wide FOV 48 (D6, `DefaultIslandWorld.tsx:603`) and the default pixel filter (DPR 0.5,
`graphicsSettingsStore.ts:16`) shrink and soften detail without changing tone.

Evening and dawn are the counter-example inside the game: a lower, more side-on sun (evening from
(−22, 16, −12), dawn from (22, 13, −10)) throws long visible shadows across the plaza and lawns, and
those frames look more modelled than noon despite lower RMS contrast (0.188-0.192), because the shadow
shapes carry the form. They are still grey (sky `#ddd5cc` and `#dcd3dc`).

## Measurements

Full numbers per frame in `specs/evidence/look/baseline/measure.json`.

| Frame | RMS contrast | Mean sat. | Mid-band (L* 35-65) | Highlights (L* > 90) | L* p5 / p50 / p95 | Stops p5-p95 | Lit-grass CV / sat. | Top-strip sat. | Cast-shadow share | Lit:shadow on grass (R/G/B) |
|---|---|---|---|---|---|---|---|---|---|---|
| H-V1-day | 0.198 | 0.368 | 32% | 0.4% | 20.8 / 68.2 / 85.3 | 4.39 | 0.105 / 0.336 | 0.197 | 16.0% | **1.92** (2.32/1.87/1.87) |
| H-V1-evening | 0.188 | 0.375 | 62% | 0.3% | 20.1 / 57.0 / 84.1 | 4.42 | 0.083 / 0.371 | 0.078 | – | – |
| H-V1-dawn | 0.192 | 0.36 | 61% | 0.3% | 16.3 / 51.1 / 84.2 | 4.9 | 0.277 / 0.251 | 0.113 | – | – |
| H-V1-night | 0.102 | 0.531 | 5% | 0.1% | 5.6 / 26.2 / 37.8 | 4.0 | 0.223 / 0.147 | 0.695 | – | – |
| H-V1-overcast | 0.184 | 0.323 | 59% | 0.2% | 16.6 / 55.2 / 80.4 | 4.69 | 0.175 / 0.298 | 0.118 | – | – |
| H-V2-day | 0.191 | 0.341 | 28% | 0.2% | 28.4 / 69.6 / 87.2 | 3.65 | 0.094 / 0.336 | 0.162 | 6.8% | **1.90** (2.31/1.86/1.87) |
| H-V2-overcast | 0.183 | 0.284 | 44% | 0.0% | 21.2 / 60.8 / 80.4 | 4.12 | 0.17 / 0.302 | 0.083 | – | – |
| H-V3-day | 0.203 | 0.335 | 27% | 0.2% | 26.2 / 69.6 / 87.6 | 3.88 | 0.122 / 0.312 | 0.182 | 9.5% | **1.71** (1.98/1.69/1.67) |
| H-hq-day | 0.176 | 0.578 | 47% | 0.4% | 4.8 / 35.6 / 61.8 | 5.83 | 0.225 / 0.844 | 0.341 | – | – |
| H-cafe-day | 0.183 | 0.729 | 41% | 0.3% | 7.5 / 33.6 / 65.6 | 5.39 | 0.088 / 0.565 | 0.403 | – | – |
| H-ruins-day | 0.148 | 0.299 | 51% | 0.3% | 37.8 / 63.2 / 85.3 | 2.74 | 0.123 / 0.357 | 0.159 | – | – |
| L-V1-day | 0.195 | 0.369 | 29% | 0.5% | 22.0 / 68.5 / 85.3 | 4.24 | 0.104 / 0.343 | 0.197 | 0% (no shadow map) | – |
| L-V2-day | 0.189 | 0.343 | 27% | 0.2% | 28.5 / 69.6 / 87.5 | 3.65 | 0.114 / 0.342 | 0.162 | 0% | – |
| L-V1-overcast | 0.183 | 0.323 | 59% | 0.2% | 17.2 / 55.3 / 80.4 | 4.61 | 0.152 / 0.3 | 0.118 | 0% | – |

Definitions (`measure.py`): RMS contrast = standard deviation of sRGB luma (0-1); saturation = HSV S;
lit grass = green-dominant pixels above L* 55 (HQ/café "grass" are green furnishings, ignore those
columns); top strip = top 10% of rows (the sky band in V1/V2); cast-shadow share = pixels at least 15%
brighter with the shadow removed. The interiors and the ruins are dim or unshadowed by design and are
there for the per-scene record, not the diagnosis.

L* histogram, % of pixels per bin 0-10 … 90-100:
- H-V1-day: 0.2, 4.2, 6.4, 7.6, 10.3, 13.7, **27.0, 17.1, 13.0**, 0.4
- H-V1-overcast: 0.3, 7.6, 9.5, 8.7, 12.2, **31.4**, 14.3, 4.1, 11.7, 0.2
- H-V2-day: 0.3, 1.6, 3.9, 3.5, 4.8, 16.4, 24.1, 10.2, **35.0**, 0.2

Frame rate at V1 day (uncapped, this M4, dev build): High 429 FPS · 358 draws, Light 503 FPS · 358 draws.

## Render-value inventory (village, day, as shipped)

Line numbers are on this branch.

| Stage | Value | Where |
|---|---|---|
| Tone mapping | Khronos Neutral, applied by the composer's last effect (the Canvas sets `NeutralToneMapping` but the EffectComposer switches renderer tone mapping off) | `PostFX.tsx:168`, `DefaultIslandWorld.tsx:604` |
| Exposure | 1.0 (`grade.exposure` → `gl.toneMappingExposure`) | `islandLighting.ts:16`, `grading.ts:26`, `PostFX.tsx:135` |
| Output colour space | sRGB | `DefaultIslandWorld.tsx:604` |
| Resolution / AA | DPR [1, 1.5] smooth, **0.5 with the pixel filter, which is on by default**; canvas MSAA off; FXAA only on High in smooth mode | `DefaultIslandWorld.tsx:602`, `graphicsSettingsStore.ts:16`, `DefaultIslandWorld.tsx:619` |
| Camera | FOV **48°**; follow offset (0, +7.4, −10.8) → 34.4° pitch, 13.1 u from the focus; top ray 10° below the horizon | `DefaultIslandWorld.tsx:603`, `IslandAtmosphere.tsx:99` |
| Curved world | bend 0.0032·z² + 0.0011·x² (view space) | `curvedWorld.ts:63-64` |
| Key (sun) | `#fff5df`, intensity 2.8, position (−12, 24, −14): elevation 52.5°, azimuth from **behind the camera**, 34° off the view axis | `islandLighting.ts:71` |
| Fill: ambient | 0.22 × `#c4deef` | `islandLighting.ts:72`, `IslandAtmosphere.tsx:70` |
| Fill: hemisphere | 0.72, sky `#c4deef`, ground `#a7b68a` | `islandLighting.ts:72`, `IslandAtmosphere.tsx:71` |
| Fill: environment (IBL) | 0.38 × a 64×32 painted equirect (top `#a3d3e7`, horizon `#c7e0df`, ground `#a7b68a`, sun blob `#fff5df`), PMREM | `islandLighting.ts:74`, `envLight.ts:50-111` |
| Key:fill | key 2.04 vs fill 1.44 (ambient 0.15 + hemisphere 0.51 + IBL 0.78) on flat ground = **1.42:1**; lit:shadow 1.99:1 (linear, analytic; `keyFill()` in `lookPreset.ts`) | derived |
| Shadows (High) | PCF, 2048², ortho ±26 × ±24, radius 3, **opacity 0.85**, neutral (no tint), cached (re-baked on phase/sun change) | `DefaultIslandWorld.tsx:603`, `IslandAtmosphere.tsx:73-75`, `islandLighting.ts:26`, `DefaultIslandWorld.tsx:142-158` |
| Shadows (Light) | no shadow map; blob shadows at 0.45 under trees/props/landmarks, 0.16 under plants | `DefaultIslandWorld.tsx:251-252` |
| Cloud shade | drifting texture, opacity 0.12 by day, High only | `AmbienceFX.tsx:78`, `IslandAtmosphere.tsx:77` |
| Fog / haze | linear fog, colour = sky `#c7e0df`, near 22, far 70 (overview +28/+15); aerial desaturation 0.18 × fog factor | `islandLighting.ts:71,73`, `IslandAtmosphere.tsx:69`, `aerialFog.ts:25` |
| Grade | pastel pass: desat 0.035, warm cast (1.005, 1, 0.989), black lift (0.0125, 0.0105, 0.008), contrast 1, vibrance 0, vignette 0.1 (offset 0.32) | `islandLighting.ts:16`, `PostFX.tsx:130-135`, `PostFX.tsx:147-148` |
| Bloom | off by default; when on: mipmap, threshold 1, intensity 0.22 | `graphicsSettingsStore.ts:16`, `DefaultIslandWorld.tsx:619` |
| Sky | flat background `#c7e0df` (a pale grey-cyan, HSV s 0.11); no gradient, no sun disc | `islandLighting.ts:71`, `IslandAtmosphere.tsx:68` |
| Terrain materials | MeshStandard, roughness 0.92–0.95, metalness 0; grass `#91b47f` × mix(0.9/0.96/0.88, texture, **0.38**) so the grass texture carries 38% of its own contrast; grass normal 0.38; sand 0.84 + (luma − 0.4)·0.32; soil detail mix 0.18 | `islandLighting.ts:15`, `terrainMaterials.ts:246`, `GridTerrain.tsx:665,679,700,715,730` |
| Props (dump GLBs) | 175 live materials, 77 textured; authored roughness min 0.30 / median 0.85 / max 1; metalness median 0 (a few at 1) | measured in the lab (`materialSummary()`) |
| Foliage | 154 live materials; roughness median **0.5** (min 0.5, max 0.9); oak leaf tint `#9bc87e` × 1.6 over a contrast-compressed atlas (0.065 + 0.9·x); trunk `#b88c58` × 1.7 | `modelMaterials.ts:42-43,129,134` |
| Characters (v6) | vertex-colour MeshStandard, roughness 0.85, metalness 0; face 0.85 | `Character.tsx:27,40` |
| Water | unlit MeshBasic cel shader (fog + tone map still apply); deep `#398d9f`, mid `#78bdbe`, shallow `#c4ddd0`, glare 0.2, sun glint 0.7 | `terrainMaterials.ts:279`, `waterShader.ts`, `islandLighting.ts:19-22` |

## Lab parity

The baseline was shot in `/lab/look` with slot A (no preset). There the rig's material patch runs with
identity uniforms (saturation 1, value 1, black shadow tint: `mix(black, 1, s) = s`), so the math is
the stock shader's. Checked on pixels: the Current preset in slot B against these A frames differs by a
mean 0.81/255 per channel, below the 1.06/255 between two A frames taken seconds apart (NPCs, water,
cloud shade and wind move), with identical tone statistics. Next step: `specs/look/presets.md`.
