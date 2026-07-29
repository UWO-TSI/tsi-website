# Sky panorama generation prompts

> For `web/public/assets/sky/`. The eight files currently there are 2048x1024
> placeholders baked from the TOD palette, 7-13KB each, i.e. flat gradients.
> Anything painted is an upgrade.

## The contract the code enforces

`GameWorld.tsx:284` loads exactly these, and nothing else:

| File | Notes |
|---|---|
| `sky_morning_sunny.webp` | |
| `sky_afternoon_sunny.webp` | |
| `sky_evening_sunny.webp` | |
| `sky_night_sunny.webp` | |
| `sky_morning_rain.webp` | |
| `sky_afternoon_rain.webp` | |
| `sky_evening_rain.webp` | |
| `sky_night_rain.webp` | |
| `clouds.webp` | separate drifting shell, needs ALPHA, tiles horizontally |

- **2048 x 1024, exactly 2:1, equirectangular.** Mapped onto a camera-pinned
  dome, so the projection matters.
- **Left and right edges must join.** I fix small seams in script; don't fight it.
- **NO SUN AND NO MOON.** `sun.png` and `moon.png` are separate ACNH sprites
  drawn on top. A sun painted into the panorama gives you two suns.
- No ground, no islands, no mountains, no birds, no text, no watermark, no frame.
- The bottom half sits below the horizon and is buried in fog. Only the top
  half is ever seen. Do not spend detail down there.
- `cloudy` weather reuses the `sunny` set, so those four carry double duty.

## Colours, taken from `TOD_KEYS` (GameWorld.tsx:196)

These are the actual scene lighting values. A sky that fights them will look wrong
no matter how good the painting is.

| Phase | Sky base | Key light | Read |
|---|---|---|---|
| morning | `#63C2F7` rising from `#FFB878` at the horizon | `#FFE7C4` cream | fresh, cool above / peach below |
| afternoon | `#4FB6F5` | `#FFF7E4` cream | bright, high, open |
| evening | `#FF9966` into `#E87A5A` | `#FFA35C` orange | golden, saturated, low |
| night | `#1A1A40` | none, ambient `#334466` | deep indigo, not black |

## Workflow that actually produces a coherent set

Generate **`afternoon_sunny` first** and treat it as the master. Then produce the
other seven as image-to-image variations OF THAT IMAGE, changing only the light.

This is the whole trick. The dome CROSSFADES between phases, so if the cloud
shapes move between morning and afternoon you see clouds morph mid-transition.
Eight independently generated skies will not cut together. Same cloud layout,
same horizon height, relit four times.

---

## Base style block (prepend to every prompt)

```
Equirectangular 360 degree sky panorama, 2:1 aspect ratio, seamless horizontal wrap.
Art style: Animal Crossing New Horizons, cozy stylised Nintendo game art, flat cel
shading, hand-painted gouache look, soft clean gradients, chunky simplified cloud
shapes with clearly defined soft edges. Pastel base with saturated accents. NOT
photorealistic, no photographic cloud detail, no HDR, no lens flare.
Sky only. No sun, no moon, no stars unless stated, no ground, no horizon landmarks,
no birds, no aircraft, no text, no watermark, no border.
Horizon line across the vertical centre; upper half carries all the detail.
```

---

## The eight

### 1. `sky_afternoon_sunny` — MASTER, generate this one first

```
Bright mid-afternoon summer sky. Clear saturated azure #4FB6F5 at the zenith
easing to a paler cyan-white #A9DCF2 at the horizon. Scattered rounded cumulus
clouds in the upper third, warm cream-white #FFF7E4 on their tops, soft
blue-grey undersides. Clouds are chunky and simplified with clean edges, widely
spaced, plenty of open sky between them. Cheerful, open, high summer.
```

### 2. `sky_morning_sunny`

```
Early morning sky. Cool cyan #63C2F7 at the zenith washing down into a warm
peach #FFB878 band along the horizon. Same cloud layout as the reference image,
now lit from low and to one side: cream #FFE7C4 highlights on the underside of
each cloud, cool lavender-grey shadow on top. Soft, fresh, low-angle light.
```

### 3. `sky_evening_sunny`

```
Golden hour sky. Warm orange #FF9966 across the lower half deepening to
terracotta #E87A5A near the horizon, cooling to a dusty blue-violet at the
zenith. Same cloud layout as the reference image, undersides blazing amber
#FFA35C, tops in cool violet shadow. Rich, saturated, warm, nostalgic.
```

### 4. `sky_night_sunny`

```
Clear night sky. Deep indigo #1A1A40 at the zenith lifting to a dusty
blue #334466 at the horizon. Same cloud layout as the reference image but very
dark and low contrast, clouds only just readable as slightly lighter indigo
shapes. Scattered small soft stars in the upper half, sparse, not a dense star
field, no Milky Way. Calm, quiet, deep.
```

### 5. `sky_afternoon_rain`

```
Overcast rainy afternoon. Flat desaturated blue-grey #7E93A6, very little
variation from zenith to horizon. The cloud layout from the reference image has
thickened and merged into a continuous soft ceiling, cool grey with faint
lighter breaks. Low contrast, diffuse, no visible sun position. Heavy and still.
```

### 6. `sky_morning_rain`

```
Overcast rainy morning. Cool grey-blue #8399AB with a muted, dirtied peach
#C9A48E glow low at the horizon, the sunrise mostly smothered. Cloud ceiling
thick and continuous, softly layered, slightly lighter toward the horizon.
Damp, early, subdued.
```

### 7. `sky_evening_rain`

```
Overcast rainy dusk. Dark warm grey-brown #6B5F5C across most of the frame with
one muted amber break #B58363 low near the horizon where the sunset is trying to
get through. Thick heavy cloud ceiling, moody, low contrast. Melancholy but warm.
```

### 8. `sky_night_rain`

```
Overcast rainy night. Near-black indigo #14162E, almost featureless, very slightly
lighter toward the horizon. Thick cloud ceiling with no breaks. NO STARS, none
visible through the cloud. Extremely low contrast, heavy, enclosed.
```

---

## The cloud shell: `clouds.webp`

A separate layer that drifts independently of the dome for parallax, so it is
**not** a sky. It needs real alpha.

```
Equirectangular cloud layer, 2:1 aspect ratio, seamless horizontal wrap.
TRANSPARENT BACKGROUND, PNG with alpha. Only clouds, no sky colour behind them.
Art style: Animal Crossing New Horizons, flat cel shaded, hand-painted, chunky
rounded simplified cumulus with clean soft edges, pure white to cream #FFF7E4
with soft pale blue-grey undersides. Clouds concentrated in the upper third,
widely spaced with large gaps of full transparency between them. No sun, no
moon, no ground, no text.
```

Deliver as PNG with alpha; I convert to WebP.

---

## When they land

Drop them in `web/public/assets/sky/` with those exact filenames and I will:

1. wrap-blend the left/right seam so the join is invisible
2. correct equirect pole stretch if the generator ignored it
3. convert to WebP and check the total budget (the eight should come in under
   ~1.2MB combined; they are 7-13KB of gradient today)
4. re-check the crossfade across a full day cycle
