# Sky, wind and ambient effects (lane sky-ambient, round 1)

David, 2026-11-04: "i want you to run a lane and artifact process for game skybox and ambiant, so sky wind, effects etc".

Round 1 is an audit and a set of pitches. Nothing ships: every option is a development switch (`?sky=`, `?wind=`,
`?amb=`, lib/game/skyLab.ts), off in production whatever the URL says. After David's marks the losing options and
their switches get deleted, and the pick is built properly in round 2.

Evidence: `specs/evidence/sky-ambient/r1/` (ids `sky1-*`). Boards first: `sky1-board-day.jpg`,
`sky1-board-weather.jpg`, `sky1-board-today.jpg`, `sky1-board-phone.jpg`.

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

`/lab/island?sky=A|B|C&wind=calm|breeze|storm&amb=motes,swirls&skytilt=16&skyface=sun|moon`, with `?at=HH:MM&date=`
and `?weather=`. At run time `window.__sky.set({...})`, `__sky.at("20:40", "2026-07-29")`, `__sky.view({ yaw, pitch,
zoom })`. Shots: `specs/evidence/sky-ambient/shoot.mjs` (stills) and `clip.mjs` (mp4), headless.
