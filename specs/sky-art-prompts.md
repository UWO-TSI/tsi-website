# Sky Art Prompt Kit — v2 (2026-07-13)

> For David's AI image generation session. v2 adds the **horizon-band
> constraint** discovered when the camera-pinned dome shipped — v1 prompts
> (in chat, 2026-07-12) put visual interest too high in frame and it never
> shows on screen.

## File contract (drop-in, no code changes)

- Path: `web/public/assets/sky/sky_{time}_{weather}.webp` (png also works — update the extension in GameWorld's `skyTextures` loader if so)
- Times: `morning` `afternoon` `evening` `night`
- Weather: `sunny` `rain` (cloudy/snow welcome — the loader contract extends; ping the build agent to add the weather states)
- Format: **2048×1024 equirectangular** (2:1). Seamless left↔right edge (it wraps around the player).
- The engine adds its own drifting cloud layer, sun/moon sprites, and stars on top — bake NONE of those as hard shapes (soft painted clouds are fine).

## ⚠ THE CONSTRAINT THAT MATTERS

The in-game camera only ever shows the band around the horizon:
**all visual interest must live between 37% and 61% of image height**
(y ≈ 376–620 px of 1024). The exact horizon line is y = 512.

- Above y≈370: barely ever seen (only when a player drags the camera fully flat). Keep it a simple gradient continuation.
- y 376–512: the visible sky sliver — color transitions, painted cloud banks, sunset glow pools, star density all go HERE.
- y 512–620: visible "below-horizon" region (the world curve exposes it near the island rim). Continue the horizon tone, slightly darkened — it reads as atmosphere/sea haze.
- Below y≈650: never seen. Flat fill.

## Global style line (append to every prompt)

> "Painted skybox for a cozy low-poly 3D game in the style of Animal Crossing New Leaf, soft gradients, gentle grain-free color bands, no landscape, no ground, no birds, no lens flare, no text, equirectangular panorama 2:1, all detail concentrated in a narrow band around the vertical center of the image, simple flat gradient above and below the band"

## Per-file prompts

### sky_morning_sunny
"Soft dawn sky, pale lavender high up melting into peach and warm cream at the horizon band, a few wispy pastel clouds catching pink light just above the horizon line, serene and hopeful"

### sky_afternoon_sunny
"Clear bright blue daytime sky, saturated azure fading to pale milky blue at the horizon band, two or three soft white cumulus banks sitting low near the horizon, cheerful New Leaf noon"

### sky_evening_sunny
"Golden hour sunset sky, deep indigo high up blending through dusty rose into a glowing orange-apricot pool at the horizon band, thin violet cloud streaks lit from below, warm and nostalgic; place the brightest glow pool at 25% image width" (the sun sets due west — the engine's sun sprite lands there)

### sky_night_sunny
"Deep night sky, near-black indigo high up softening to a muted blue-violet band at the horizon, faint scattered stars concentrated in the horizon band, a subtle hint of milky-way haze crossing diagonally, calm and quiet" (engine adds twinkling stars + moon on top — keep painted stars faint)

### sky_morning_rain / sky_afternoon_rain
"Overcast rainy sky, flat gray-blue layers, darker slate high up easing into a pale silver-gray horizon band, low ragged cloud shreds in the band, soft diffuse light, no dramatic storm"

### sky_evening_rain
"Rainy dusk sky, deep gray-violet fading to a dim mauve-gray horizon band, heavy soft cloud layer, the faintest warm glow low at 25% image width where the hidden sun sets"

### sky_night_rain
"Rainy night sky, very dark charcoal-indigo, barely-lighter smoky band at the horizon, dense low cloud, no stars"

## After generating

1. Downscale/export to 2048×1024 webp (quality ~80 keeps files ≈100–300KB).
2. Drop into `web/public/assets/sky/` with the exact names — hard-refresh the game.
3. If a sky reads wrong in-game, note WHERE (too bright at zenith / band too high / horizon tone clashes with fog) — the fog color comes from the TOD palette, not the image, so horizon tones should stay near: morning #FFDDB8, afternoon #A9DCF2, evening #FFD4A8, night #2D2D6B, rain #AAB2BC.
