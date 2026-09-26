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
