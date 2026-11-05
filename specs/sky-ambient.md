# Sky, wind and ambient effects (lane sky-ambient)

David, 2026-11-04: "i want you to run a lane and artifact process for game skybox and ambiant, so sky wind, effects etc".

Round 1 is an audit and a set of pitches. Nothing ships: every option is a development switch (`?sky=`, `?wind=`,
`?amb=`, lib/game/skyLab.ts), off in production whatever the URL says. After David's marks the losing options and
their switches get deleted, and the pick is built properly in round 2.

Evidence: `specs/evidence/sky-ambient/r1/` (ids `sky1-*`). Boards first: `sky1-board-day.jpg`,
`sky1-board-weather.jpg`, `sky1-board-today.jpg`, `sky1-board-phone.jpg`.

## R2. Round 2: the sky built properly (2026-11-05)

David, round 1: "i want you take the sky design seriously because thats where the feeling comes from and the
lighting", "use proper sky box and design techniques", "all the clounds are ugly and need proper redesign", "the stars
should be shiny with subtle sparkling animation", "moon has to be responsive to moon cycle", "wind swirls too bold,
less opacity and faster and better placement logics"; on the title: the lights "isnt a hard cut off, rather the glow
fades very softly so it doesnt look like yellow circles". C's direction stands. Nothing ships until David marks it.
Evidence `specs/evidence/sky-ambient/r2/` (ids `sky2-*`), boards first: `sky2-board-day.jpg`, `sky2-board-weather.jpg`,
`sky2-board-moon.jpg`, `sky2-board-phone.jpg`.

### What was blurry

Three things: the clouds and stars were painted sheets (1024 and 2048 px) stretched over an overhead projection, so
they magnified into mush at the game's half-resolution pixel finish; the sky stopped at true horizontal while the
curved world bends the sea some twenty degrees below it, so a flat band of fog colour filled the gap (round 1's
"cream"); and every colour was a phase table's flat gradient. The new sky uses no picture at all.

### How it is built (L/atmosphere.ts, L/skyShader.ts, C/SkyDome.tsx)

| Piece | Technique |
|---|---|
| The air | Earth's atmosphere by single scattering (Rayleigh, Mie, ozone; Bruneton's and Hillaire's constants, ozone doubled for C's violet twilight), integrated per vertex of a dome whose rings crowd the horizon, phase functions per pixel, plus a skylight term so twilight and the Earth's shadow stay blue. The real sun's height and bearing over London, Ontario make the blue noon, the gold and rose low sun, the Earth's shadow with the belt of Venus at dusk, the violet twilight. An exposure that half adapts as the sky darkens, a white balance and saturation fitted so noon lands on the look's picked #4a9de0 / #bfe0f2 (tested), a soft clip under white |
| The skyline | The dome bends down with the world (curvedWorld) as far as the sea reaches, so the sky meets the sea: no fog band |
| The light | The light's sky colours (the background, the fog, the water's mirror, the environment light, the Light tier's gradient) come from the same atmosphere for the real sun (lookPreset `realSky`), so the island and the dome agree all day; the key and fill stay the phase table's |
| Sun | A disc 2.3° across, limb darkened, its edge a pixel wide, its colour the sun through the air (white to orange) |
| Moon | Meeus's lunar theory (place, rising, phase; tested on the 2024-04-08 eclipse and the 2024-09-18 full moon). Drawn as a sphere the real sun lights, so the phase and the tilt of the terminator are the calendar's; maria; a quiet dark limb with earthshine; a pale disc by day. It scatters light into the air by its phase (a full moon makes a blue night, a new moon a dark one), washes out the faint stars, and sets the night key's strength (`moonKey`: 0.45 with no moon to 1 for a high full moon) |
| Stars | Hashed on the celestial sphere turned by the sidereal time (the sky wheels round the pole star, tested), two layers: many faint, a few bright with a soft four-point sparkle along the screen that slowly breathes; each twinkles on its own beat, more near the skyline; a gaussian a pixel wide at any resolution; the Milky Way along the real galactic plane with dust lanes; about five shooting stars a minute round the whole sky (one or two in a view); the title's `uStarry` kept |
| Cumulus | Analytic: one cloud or none per 2 km square, a cluster of six balls cut flat at a 1.5 km floor, traced per pixel (walk the squares the ray crosses, ray-ball tests), the balls' normals blended into one soft body with creases between lobes, a little cauliflower texture, self shadow toward the sun, the sun's light through the air (gold to rose, and still on them for a degree after sunset), the sky's light from above and the skyline's below, a silver lining toward the light, haze with distance, a pixel-wide soft silhouette. Fair-weather clouds thin out after dark |
| Cirrus, overcast | Cirrus streaks 7 km up that stay lit about three degrees past sunset; a mottled grey deck and greyed, darkened cumulus under overcast, the sun's direct light taken away (rain is grey, snow paler, fog a hazy sky) |
| Weather | Cover, size, grey, cirrus, haze and drift per weather, eased (never switched) |

### Lights, swirls

- **Lamp and firefly glow** (fixed in the world, so the title gets it): the shared glow (lib/game/glow.ts `softGlow`) is a
  hot core with a long tail that reaches nothing at its rim with no slope left, 128 px and dithered; the lamp halos are
  camera-facing quads lifted toward the camera past the lamp's head (the glass never cuts them), white-hot at the core,
  amber outside, a little taller than wide, breathing with the flame; the ground pools and the fireflies use the same
  soft glow (the fireflies' painted ring sprite is gone).
- **Wind swirls**, windy days only (AmbienceFX `WindSwirls`, worldFx `swirlSpots`, `swirlAge`): over the tree crowns,
  along the shoreline and across open ground, each spot its own swirl now and then on the world clock (every client
  sees the same), none within 7 of the camera; 0.42 opacity fading down the tail (round 1: 0.75), 2.2 s each (round 1:
  3.4 s), a stroke about two pixels wide at any distance.

### Cards (evidence under `r2/`)

| Card | Shows | Evidence |
|---|---|---|
| sky2-day | Dawn to night on the beach (the sky view toward the sun, the island view, the play view) | `sky2-board-day.jpg`, `sky2-day-desktop-clear-*`, `sky2-clip-day-desktop.mp4` (the whole day in 22 s), `sky2-clip-golden-desktop.mp4`, `sky2-clip-sunset-desktop.mp4` |
| sky2-clouds | The new cumulus by day, gold and rose at the low sun, grey at night | the day board, `sky2-crisp-clouds-desktop.jpg` (a 2× crop), the golden and sunset clips |
| sky2-night | Stars, sparkle, the Milky Way, a shooting star, a full moon night and a new moon night | `sky2-day-desktop-clear-night-*`, `sky2-crisp-stars-desktop.jpg`, `sky2-clip-night-desktop.mp4`, `sky2-clip-night-new-desktop.mp4` |
| sky2-moon | The moon through July and August 2026: crescent, first quarter, gibbous, full, waning, new | `sky2-board-moon.jpg`, `sky2-moon-desktop-clear-*`, `sky2-crisp-moon-desktop.jpg` |
| sky2-weather | Rain, snow, fog and wind at midday, sunset and night | `sky2-board-weather.jpg`, `sky2-weather-desktop-*`, `sky2-clip-rain-desktop.mp4`, `sky2-clip-snow-desktop.mp4`, `sky2-clip-fog-desktop.mp4` |
| sky2-wind | The swirls on a windy day over the meadow's trees and along the shore | `sky2-clip-wind-desktop.mp4`, `sky2-clip-wind-shore-desktop.mp4`, `sky2-clip-wind-phone.mp4` |
| sky2-glow | The plaza's lamps and the fireflies at dusk and night | `sky2-lamps-desktop-clear-*`, `sky2-glow-crop-desktop.jpg`, `sky2-glow-crop2-desktop.jpg`, `sky2-clip-lamps-desktop.mp4`, `sky2-clip-lamps-phone.mp4` |
| sky2-phone | The day on a phone, sky and play views, and rain and wind | `sky2-board-phone.jpg`, `sky2-phone-phone-*`, `sky2-phoneweather-*`, `sky2-clip-{day,sunset,night,lamps,wind}-phone.mp4` |

Every clip has a `-poster.jpg`.

### Cost (back to back against main a8a03985, v2, 24 bots, measurement builds)

| | High: frame / p95 / CPU ms | High: draws / triangles | Lite: frame / p95 / CPU ms | Lite: draws / triangles |
|---|---|---|---|---|
| This branch | 4.70 / 7.20 / 4.10 | 357 / 746.8k | 2.90 / 5.40 / 2.60 | 284 / 556.1k |
| main | 4.80 / 7.20 / 4.20 | 358 / 743.4k | 2.90 / 5.40 / 2.70 | 282 / 556.5k |

The dome's own share (world bench `domeOff`, measured on main before building and again after): nothing measurable
at the follow camera on either; with sky in view about 0.1 ms GPU with the pixel finish (main about 0) and about
0.3 ms at full resolution (main about 0). One draw, 5,952 triangles (main 3,072). About 50 MB less video memory (the
COZY sheets and the star sheet deleted). Load average 3.5 to 7 through the runs: not a quiet machine.
`specs/perf/effects-cost.md` "The sky", raw runs in `r2/cost/`.

### Deleted

The COZY Luxury dome and its seven sibling cloud shaders (`lib/game/skyVariants.ts`), the 20 painted layers in
`public/assets/sky/layers/` (5 MB on disk), `scripts/preview-sky.mjs`, the tune bench's sky specimen and the `sky` block
of `lib/game/tuning.ts`, round 1's `?sky=A|B|C` directions and their shader block, `skyLab.moonPhase` (now
`atmosphere.moonPosition`), the lab's swirls (now `WindSwirls`), the fireflies' painted glow sprite.

### Questions for David (round 2)

| Question | Pick |
|---|---|
| The night's key light: only its strength follows the moon (built), or its direction too (shadows swing with the real moon, a moonless night lit from overhead)? | Strength only |
| Fair-weather cumulus thin out after dark, as real ones do: keep? | Keep |
| The moon is drawn about four times its real size so it reads at the pixel finish: bigger, smaller? | As built |
| `?time=dawn` previews 45 minutes before sunrise, which is now the blue hour, not pink: move the preview nearer sunrise? | Move it to 20 minutes before |
| Shooting stars about five a minute round the sky (one or two in a view): right? | Yes |
| The twilight's violet comes from doubling the ozone (C's palette): keep, or the measured ozone (a bluer twilight)? | Keep |
| Round 1's approved motes (golden hour) and the one shared wind module are not in the game yet: round 3? | Round 3 |
| Ambient sound beds (round 1, question 8): still open | CC0 or synthesised, round 3 |

### Not verified

A real phone's GPU (the phone shots are headless Chrome at 390 × 844 on the Mac mini); the Light tier's gradient and
the applicant island (both take the new sky colours through `lookToLight`; neither was shot); the title screen itself
(title-r2's staged scenes are not merged here; it shares `SkyDome`, `uStarry` and `LampGlow`); swirls across two clients
(deterministic by the world clock, unit tested); the moon's place beyond the tests (about a degree).

### Merging with title-r2

`lib/game/skyShader.ts` conflicts (title-r2 edits the old file): take this branch's file whole; it keeps
`skyUniforms.uStarry` with the same meaning (stars brighter and twinkling more, clouds thinned 60%), so the title's
`TitleScene.tsx` needs no change. `components/game/AmbientProps.tsx`: both sides add imports (title-r2 `NEW_LAMPS`,
this branch `curvedWorld`) and edit different functions (title-r2 `Lanterns` and `lampParts`, this branch `LampGlow`).

## 1. What the player sees of the sky today

This matters more than any shader: **at the follow camera's default tilt there is no sky in frame at all**
(`sky1-today-*-game.jpg`). At the orbit's lowest tilt (pitch 0.35) it is a thin band at the top, about 10 to 15% of the
frame (`*-play.jpg`); on a phone in portrait about the same. The sky fills the frame only on the title screen, in photo
mode, on a hill looking out, and in the water's reflection. Every sky shot in this round tilts the view up
(`?skytilt=`, dev only) so the sky can be judged at all.

A second finding: **at golden hour, sunset and dusk the sky washes out to a flat cream** (`sky1-board-today.jpg`). The
phase's sky colours are pale already, and the grade and tone mapping lift what is left toward white: measured, the lower
half of today's golden sky sits at about (245, 227, 207) whatever the dome draws. Any direction that wants colour at
the low sun has to keep its values well under white.

## 2. Audit

C = `web/components/game/`, L = `web/lib/game/`. Costs from `specs/perf/effects-cost.md` and this round's bench.

### Sky

| Piece | File | What it does now | Stand-in or gap | Cost |
|---|---|---|---|---|
| Dome | C/SkyDome.tsx, L/skyShader.ts | A camera-pinned sphere (r 110, 48 × 32) drawn first, so its shader runs on every pixel. Gradient from the phase light's `skyTop` to `sky`, stars by how dark the zenith is | No sun disc, no moon, no sun-side glow; the gradient only knows the phase, not where the sun is | 1 draw; "nothing measurable" (effects-cost.md) |
| Clouds | L/skyVariants.ts (`luxury`), `public/assets/sky/layers/` | COZY's Luxury shader rebuilt for three.js (David owns the licence): five painted 1024 sheets on an overhead sheet projection, weather remixes the coverage (SkyDome `weightsFor`) | Reads well by day; at night the same sheets turn into large flat blue-grey blots (`sky1-day-*-today-night-sky.jpg`); at low sun they vanish into the cream | 5 textures, about 28 MB of video memory |
| Stars | `stars.webp` (2048) | One texture, faded in by zenith darkness, no twinkle in the game | The title (game/title-r2, not merged yet) adds `uStarry` twinkle on the same shader; the game should share it | 22 MB of video memory for a sparse star field |
| Light tier | C/IslandAtmosphere.tsx `SkyGradient` | A flat 2D gradient, no clouds | Intended | 0 |
| Sun and moon in the light | L/lookPreset.ts, L/sunPath.ts | The key is the real sun over London, Ontario (row 239), clamped to 12°; at night a moon key fixed at 40° | Neither is drawn in the sky. `moon.webp` and `galaxy.webp` ship but nothing uses them (the moon file is a crater sheet, not a disc) | 0 |
| Weather engine | L/weatherSystem.ts | A COZY-style blended weather engine | Dormant: nothing renders from it; only its hash helpers are imported. The sky reads `IslandWeather` (five states) through `weightsFor` | 0 |

### Weather

| Piece | File | What it does now | Stand-in or gap | Cost |
|---|---|---|---|---|
| States | L/islandWeather.ts, L/useIslandConditions.ts | Open-Meteo for London, Ontario mapped to clear, rain, snow, fog, wind; seeded fallback; 20-minute ease between hours; `?weather=` | Rain, snow and fog all read as the same bright white overcast (`sky1-board-weather.jpg`): no grey or moody sky | 0 |
| Rain and snow | C/RainFX.tsx | One instanced draw of streaks or flakes on a 36 u world tile, slanted by the world wind | Thin in stills; fine in motion (`sky1-clip-rain-desktop.mp4`, `sky1-clip-snow-desktop.mp4`) | 1 draw |
| Splashes, rings, snow prints | C/WeatherGround.tsx, C/Puddles.tsx | Rain splashes and puddle rings from the painted pack; footprints in snow; puddles as one instanced draw | Good | 1 to 2 draws |
| Mist | C/AmbienceFX.tsx `MistBanks` | Banks drifting with the wind, fog only | Good | a few quads |
| Cloud shadows | C/AmbienceFX.tsx `CloudShadows` | A canvas texture of blobs scrolled along `WIND_DIR` at a constant speed (High only) | Its speed and direction never follow the weather or the dome's clouds | 1 draw |

### Wind

There is no one wind. Each consumer has its own:

| Consumer | File | Direction | Strength | Gusts |
|---|---|---|---|---|
| Grass (the new world's meadow) | C/grid/GrassField.tsx | `WIND_DIR` (fixed) | `windScale` 1, 2.2 on a windy day, 0 on Light | Bands of noise rolling downwind (the best wind in the game) |
| Trees, bushes, plants | L/modelMaterials.ts `addTreeSway`, `TREE_WIND` | None: each crown circles in its own phase | 0.035, 0.14 on a windy day, 0 on Light | None |
| Rain slant, shed leaves, mist | L/worldFx.ts `worldWind` | `WIND_DIR` | Per weather: clear 0.8, fog 0.25, rain 2.6, snow 1.1, wind 3.4 | None |
| Dome clouds | L/skyShader.ts `uvAt` | Each layer's own fixed drift | `sky.wind` 0.84, × 2.2 on a windy day | None |
| Cloud shadows | C/AmbienceFX.tsx | `WIND_DIR` | `CLOUD_SPEED` constant | None |
| Sea | L/waterShader.ts, L/waves.ts | Three fixed chop directions | Fixed; weather only switches the glint off | None |
| Seabed plants, the fitting-room curtain | C/water/Seabed.tsx, C/FittingRoom.tsx | Own | Own | None |
| Flags, cloth outdoors | none | | | |

### Ambient life and effects

| Piece | File | What it does now | Notes |
|---|---|---|---|
| Fireflies | C/AmbientLife.tsx, L/fireflySwarm.ts | Night swarm round anchors, one instanced draw for bodies and one for glows | Good |
| Gulls, butterflies, dragonflies, crabs, leaping fish | C/AmbientFauna.tsx, L/ambientFauna.ts | World state by season, hour and weather, instanced per species | Good. `C/Seagulls.tsx` (the older A6 set, partly primitives) is still used by the applicant island |
| Shed petals and leaves | C/AmbienceFX.tsx `TreeLeaves`, L/worldFx.ts | Spring petals and autumn leaves from trees that shed, High only, not in rain or snow | Nothing in summer or winter (snow covers winter) |
| Catchable bugs | C/Critters.tsx, C/peaceful/VillageLife.tsx | Gameplay, not ambience | Out of scope |
| Particle kit | L/fx/ | Pools and painted pack for combat, fishing and movement | Reused, not changed |

### Ambient sound (listed, not built)

Only music: `public/audio/ambient/{dawn,day,dusk,night}.ogg` (the Ninja Adventure pack) by phase, and two applicant
tracks (L/audio.ts). There is no wind, wave, bird, rain or night-insect bed.

## 3. Sky directions

All three are one shader block (`SKY_LAB` 1, 2, 3 in L/skyShader.ts) on the same dome, through the day and in each
weather. All three add the real sun as a disc (hidden under overcast), the moon by its real phase (low on the night
key's azimuth so a raised view sees it), the title's star twinkle, and a shooting star now and then (every 20 s or so
for the shots; the proposal is once or twice a minute).

| | A. Painted, finished | B. Toon | C. Storybook |
|---|---|---|---|
| Idea | Today's painted COZY clouds and gradient, finished: the sun and its halo, the moon, a soft glow toward the low sun, twinkling stars | Cartoon sky: the gradient in soft steps, crisp puffy clouds cut from noise (lit side toward the sun, cool underneath), a flat sun with a ring | A richer palette by the sun's height: a deeper noon blue; at the low sun a violet zenith over an orange and rose skyline, the rose band opposite (the belt of Venus), clouds lit gold and pink with lavender undersides; a galaxy band at night |
| Day | Like today | Big white puffs, the clearest cartoon read | Bluer, a little richer |
| Golden hour to dusk | A warm disc in a still pale sky | Pale; the steps show | The best: colour where today has cream |
| Night | The moon and twinkle over today's blotchy clouds | Fewer, darker puffs; the moon leads | Moon, twinkle, galaxy band |
| Weather | Today's overcast; disc and moon hidden | Puffs thicken and grey; storm bellies darken | Palette fades to today's overcast under cloud |
| Evidence | `sky1-day-desktop-clear-A-*`, `sky1-clip-night-A-desktop.mp4` | `sky1-day-desktop-clear-B-*`, `sky1-clip-night-B-*.mp4` | `sky1-day-desktop-clear-C-*`, `sky1-clip-sunset-C-desktop.mp4`, `sky1-clip-night-C-desktop.mp4` |
| Draws | 0 more | 0 more | 0 more |
| Frame (world bench, v2, High, 24 bots) | −0.07 ms (noise) | +0.02 ms (noise), GPU +0.01 | +0.02 ms (noise), GPU 0.00 |
| Video memory | 0 more | could drop the five Luxury sheets: −28 MB | +22 MB for the galaxy at 2048 (should ship at 512: +1.4 MB) |
| Risk | Low; least change | The stepped gradient and crisp puffs are the biggest style change; the steps band at the pixel finish | The dome's colours drift from the phase light's fog and water colours unless the preset takes them over |

**Pick: C, the storybook**, because the low sun is exactly when today's sky fails and when the thin band of sky a
player sees is most worth looking at; it changes nothing by day that a player would miss, and its night is the
fullest. To ship it the phase light (lookPreset `skyTop`, `sky`, the fog) takes C's low-sun colours, so the fog, the
water's mirror and the dome agree. If David prefers puffier cartoon clouds, B's clouds can sit under C's palette; that
is a fourth option to shoot only if he asks.

## 4. One shared wind

The pitch (`?wind=calm|breeze|storm`, L/skyLab.ts `sharedWindAt`): one direction (today's `WIND_DIR`, veering ±13°
over minutes), one strength by level, and slow gusts from three swells on the world clock (`gustAt`, so every client
sees the same gust). The strength drives the grass (sway and direction), the trees (their sway, plus a lean downwind
with the gusts: `TREE_LEAN`, compiled into the sway shader only on a `?wind=` load), the dome clouds' speed, the motes
and the swirls.

Measured motion in the clips (mean frame difference, 10 fps): grass 1.9 calm, 2.8 breeze, 3.3 storm (today 2.7 clear,
3.2 windy); palm 1.5, 2.2, 2.7 (today 2.3, 2.8). Clips: `sky1-clip-wind-calm-desktop.mp4`,
`sky1-clip-wind-breeze-desktop.mp4`, `sky1-clip-wind-storm-desktop.mp4` and `-phone.mp4`, against
`sky1-clip-wind-today-desktop.mp4` and `sky1-clip-wind-today-windy-desktop.mp4`.

Cost: 0 draws; storm +0.03 ms frame, main thread +0.07 (noise). **Recommended** as the base of round 2: one module
replacing `WIND_DIR`, `WIND_SPEED`, `TREE_WIND`'s two amplitudes, `CLOUD_SPEED` and the dome's drift, with levels by
weather (clear a breeze, fog calm, rain and snow a stiff breeze, wind the storm); the rain slant, the shed leaves, the
mist and the cloud shadows read it too, and the sea's chop could take its direction. Light keeps the wind off as today.

## 5. Ambient effects

Built for the pitch (`?amb=`), each one draw:

| Effect | What | Cost (world bench) | Evidence | Pick |
|---|---|---|---|---|
| Shooting stars and twinkle | In the dome shader, night only, never under cloud | 0 draws | `sky1-clip-night-*.mp4` (each desktop clip catches one) | Yes, with the sky |
| Wind swirls | White curls riding the gusts, how many by the wind's strength; none when calm | +1 draw, 512 triangles, +0.03 ms frame (noise) | `sky1-clip-wind-breeze-desktop.mp4`, `sky1-clip-wind-storm-*.mp4` | Yes, windy days and storms only |
| Light motes | 160 pollen and dust specks drifting downwind round the view, brighter toward the sun | +1 draw, 0.00 ms frame, GPU +0.03 ms (noise) | `sky1-clip-motes-desktop.mp4` (golden hour), `sky1-clip-motes-noon-desktop.mp4` | Yes, at golden hour (by day they barely show, and against a bright sky they vanish) |

Listed, not built (cheap where marked):

- **Rainbow** after rain as the weather clears: in the dome shader, 0 draws. Cheap and very cozy.
- **Summer fluff** (dandelion seeds): the motes, white and larger, in summer; spring and autumn already shed petals and leaves.
- **Birds crossing the sky**: a far flock in the sky band by day, one instanced draw. Gulls already work the sea.
- **Sea spray at the rocks and the shore break**: a small pool at the foam line, one draw.
- **A grey rain sky**: darker overcast and lower cloud for rain (a weather look, 0 draws; see questions).
- **Winter aurora** on clear winter nights: in the dome, 0 draws.
- Exist already and stay: fireflies, butterflies, dragonflies, crabs, leaping fish, shed petals and leaves, rain splashes and puddle rings, mist banks, snow prints.
- Not recommended: god rays and heat shimmer (post effects, real GPU cost at full screen).
- **Ambient sound** (list only): a wind bed scaled by the shared wind, waves by distance to the shore, birds by day and season, a rain loop, night insects; CC0 or synthesised, logged in `web/public/audio/sfx/SOURCES.md`.

## 6. Cost check

`perf:check` on the touched scene (v2, the new world), this branch then main (f3d24212) back to back on the same
machine, measurement builds of each:

| | High: frame / p95 / CPU ms | High: draws / triangles | Lite: frame / p95 / CPU ms | Lite: draws / triangles |
|---|---|---|---|---|
| This branch | 4.80 / 7.30 / 4.20 | 355 / 741.8k | 3.00 / 5.40 / 2.70 | 280 / 557.9k |
| main | 4.80 / 7.30 / 4.20 | 357 / 746.1k | 3.00 / 5.50 / 2.70 | 280 / 559.2k |

The shipped path is unchanged (the switches are off), as expected. The options' own costs are from the world bench
(`specs/perf/world-bench.mjs`, `VARIANTS=sky`, v2, High, 24 bots, 3 valid pairs each, load 3 to 5): every option is
within the bench's noise (±0.2 ms frame, ±6 draws from the bots moving); the particle pitches add their one draw each.

## 7. Questions for David

1. Which sky: A, B or C (or C's colours with B's clouds)?
2. The default camera shows no sky. Should the follow view show more of it (a lower minimum tilt, or a higher look
   point), or is the sky for the title, photo mode and the hills?
3. Rain: keep today's soft bright overcast, or a greyer, moodier rain sky?
4. The moon: its real phase from the calendar (some nights a thin crescent or none), or always a friendly full or
   half moon? Low enough that the play view catches it?
5. Shooting stars: how often (the shots use about every 20 s; proposal once or twice a minute)?
6. The wind swirls are a cartoon device (curls of white): do they fit, on windy days only?
7. References: `specs/references/acnh/` has almost no sky in frame. For the sky at sunset, night and in rain, which
   shots should round 2 match?
8. Ambient sound beds (wind, waves, birds, rain, insects): wanted, and CC0 or synthesised?

## 8. How to see them (dev server)

Round 2: `/lab/island?skytilt=16&skyface=sun|moon&wind=calm|breeze|storm&amb=motes`, with `?at=HH:MM&date=` and
`?weather=` (the swirls come with `?weather=wind`). Round 1's `?sky=A|B|C` is gone. At run time `window.__sky.set({...})`,
`__sky.at("20:40", "2026-07-29")`, `__sky.view({ yaw, pitch, zoom })`. Shots: `specs/evidence/sky-ambient/shoot.mjs`
(stills, `PLAN=day|weather|phone|phoneweather|moon|lamps`) and `clip.mjs` (mp4), headless.
