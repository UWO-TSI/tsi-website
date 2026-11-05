# Lane: sky-ambient (the sky, the wind and the island's ambient effects)

Worktree `.claude/worktrees/sky-ambient`, branch `game/sky-ambient`, cut from origin/main f3d24212. Agent type `uwotsi-lane`. Dev port 3480.

## Round 3: David's sky round 2 review (2026-11-05, verbatim; https://claude.ai/artifact/Ui1UYHzRuhoTiUYCefzJJR)

Approved: sky2-moon, sky2-phone.
- sky2-clouds (redo): "cloud needs remodeling and retexture"
- sky2-cost (redo): "performance not as good"
- sky2-day (redo): "clouds model look horrible, i wanna know whats the best way for good looking clouds without sacrificing too much performance, before it was a 2d cloud incorperated in the sky, is there anyway to have the cloud feel 3d and react the lighting while not ruining the performance"
- sky2-glow (approve): "a lot better"
- sky2-golden (redo), no note (the clouds are in every golden-hour shot)
- sky2-night (redo): "looks a lot betterm but the perspective of the sky look slightly weird idk how to explain it, and is it possibe to have the pixel pass be less strong on the sky, or do you think we should keep it the same in order to perserve simplicity and perforamnce"
- sky2-questions (approve): "clouds redone and reimagined which direction to go 3d or 2d art or alternative,"
- sky2-weather (redo): "cloud needs redone, rain snow fog looks good"
- sky2-wind (redo): "its so random rn and it doesnt have like any proper logic behind it, it shouldnt feel just slapped on, so more faint, and have different types of animation, cuz they are all just swirels and it should blow the same way as the wind and squire like like 2 second and 0.3 opacity"

Build:
1. Clouds, reimagined. Pitch at least three directions side by side, each with clips at day, golden hour, sunset and in weather, plus its cost with the sky in view:
   - (a) 2D clouds in the sky, round 1's direction done crisp under the pixel pass, shaded by the sun so they read as lit volumes;
   - (b) stylised 3D cloud models with real lighting;
   - (c) an alternative, for example clouds built in headless Blender and rendered to lit sprites for several sun angles, or a cheap 2.5D noise layer in the sky shader.
   - Answer David's question in a sentence: the best way to get good-looking clouds that feel 3D and react to the light without hurting performance. Give a pick.
   - Never fetch art or textures. David supplies references; ask for them on the questions card if they'd help.
2. Performance ("performance not as good"):
   - Measure where David would notice it: with the sky in view, at the title camera and at the follow camera, on high and lite, on the GPU (not software rendering), against main.
   - Find what got slower and fix it.
   - Check that the recorded clips play smoothly; a choppy clip reads as a slow game.
3. Night:
   - Find what makes the sky's perspective look off (the dome's projection, star size or spacing toward the horizon, the horizon's height against the sea, the Milky Way's curve) and fix it.
   - David asked about a lighter pixel pass on the sky. The coordinator's answer: it's possible at almost no cost, because the post pass can tell sky pixels apart by depth. Show the current strength and a lighter sky side by side, and give a pick.
4. Wind:
   - Tie the effects to the shared wind (its direction and strength), and place them by a rule: where wind would show. They must never look random.
   - Use several kinds of animation, not only swirls: for example streaks, gusts over grass, blown leaves.
   - Each lasts about 2 s at about 0.3 opacity.
5. Approved and kept:
   - The soft glow ("a lot better").
   - Rain, snow and fog ("rain snow fog looks good").
   - The sky2-questions picks: night light follows moon strength only; fair-weather clouds thin after dark; the moon as built; the dawn preview 20 min before sunrise; about five shooting stars a minute; the ozone kept.
   - Also from those picks: round 1's golden-hour motes, the shared wind, and ambient sound (CC0 or synthesised, listed in SOURCES.md) come in this round.

## Round 2: David's round 1 review (2026-11-04, verbatim; https://claude.ai/artifact/MPx8YzktucAxuzvvRQyUor)

Approved: sky1-motes, sky1-today, sky1-weather-1, sky1-weather-2, sky1-wind-today, sky1-wind.
- sky1-audit (approve): "from the gameplay you get to see quite a bit of sky,"
- sky1-cost (approve): "C"
- sky1-day (redo): "i dont like any of them they are blurry and stuff i want you take the sky design seriously because thats where the feeling comes from and the lighting, and the stars should be shiny with subtle sparkling animation"
- sky1-night-1 (redo)
- sky1-night-2 (redo): "all the clounds are ugly and need proper redesign"
- sky1-phone (redo)
- sky1-questions (redo): "C"
- sky1-storm (redo): "wind swirls too bold, less opacity and faster and better placement logics"
- sky1-sunset (redo)
- sky1-weather (redo): "i want you to properly redesign the sky use proper sky box and design techniques, if you need anything let me know but use the proper technologies for the sky, moon has to be responsive to moon cycle"

Read: sky C's direction (sky1-cost and sky1-questions both "C"), but none of round 1's skies passes as built ("blurry"). The camera is fine as it is (sky1-audit: "from the gameplay you get to see quite a bit of sky"). The other round 1 calls stand: a little greyer rain, the moon's real phase, shooting stars once or twice a minute, swirls on windy days only, ambient sound synthesised or CC0. David may send sky references; ask the coordinator to forward any.

Build (a review page again, nothing ships until David marks it):
1. **A proper sky**, treated as where the feeling and the lighting come from: a real sky dome with proper techniques (an analytic atmosphere such as Preetham or Hosek-Wilkie, or a baked cubemap from a physically based model, with a sun and a moon in it), crisp at every resolution, no blur. Whatever three.js tool fits (its Sky shader is a starting point), measured against main. Ship no third-party images: build it in shaders, or paint and bake textures in headless Blender.
2. **Clouds redesigned from scratch** ("all the clouds are ugly and need proper redesign"): pick a real technique (layered noise clouds in the sky shader, billboard or mesh clouds lit by the sun, or a raymarched layer if it stays cheap) and show the day, golden hour, sunset and night.
3. **Stars** shiny, with a subtle sparkle animation. **The moon** follows the real lunar cycle (phase from the date, some nights none) and lights the night to match.
4. **Wind swirls** fainter (less opacity), faster, and placed better (where wind reads: open ground, the shore, treetops, not on the camera).
5. **The lights' glow** (from the title round 4 review, which uses the same lamps): the lamps and fireflies glow as soft light that wraps their source and fades with no hard edge, not yellow spheres. Fix it in the world, so the title gets it too.
6. Show the full day (dawn, midday, golden hour, sunset, dusk, night) and the weathers, desktop and phone, with clips, plus cost against main (draws, triangles, frame time).

## David's call (2026-11-04, verbatim)

"i want you to run a lane and artifact process for game skybox and ambiant, so sky wind, effects etc"

## Round 1: what's there, then pitches for David's pick (nothing ships)

1. **Read what exists first** (CODEMAP rows "Rendering look", "Time, weather, season", "Nature, grass, FX"): the sky (`SkyDome.tsx`, `skyShader.ts`, `IslandAtmosphere.tsx`: dome, gradient, sun and moon, clouds, stars, how it moves through `worldClock` and the sun path, how weather changes it), the weather (`weatherSystem`, `islandWeather`, `RainFX`, `WeatherGround`, `?weather=rain|snow|fog|wind`), the wind (grass `grassField`, trees and bushes in `InstancedNature`, flags, cloth, water chop: is there one shared wind, its direction and strength, gusts), and the ambient effects (`AmbientLife`, `fireflySwarm`, `ambientFauna`, `Critters`, `Seagulls`, `lib/game/fx/`, puddles). Also ambient sound (wind, waves, birds, rain) if any: list it, don't build it. Write down for each: the file, what it does now, what's a stand-in, and what it costs. David's look references are in `specs/references/acnh/` and `look/` (the art direction: simple, smooth, cartoony, ACNH-like, subtle texture; performance first). The title-r2 branch gave the title screen its own star twinkle (`uStarry`, title only): keep the game's sky consistent with it.
2. **Shoot today:** headless shots of the island with plenty of sky in frame (two or three angles) at dawn, midday, golden hour, sunset, dusk and night, and in each weather; a few-second clip (mp4) of the wind on grass and trees, and of each weather moving. Use `?time=` / `?weather=` and the dev hooks.
3. **Pitch, built just far enough to shoot (behind dev-only switches):**
   - **Sky:** two or three directions (for example a painted cartoon gradient with soft stylised clouds that drift, a richer sunset and dusk, a night sky with a moon, twinkling stars and the odd shooting star), each through the day and in weather.
   - **Wind:** one shared wind (direction, strength, slow gusts) driving grass, trees, bushes, flags and loose particles together, stronger on `?weather=wind` and storms; show it calm, breezy and stormy.
   - **Ambient effects:** a short menu of cheap effects that fit the island (drifting leaves or petals by season, pollen and dust motes in sunbeams, sea spray and foam at the shore, birds crossing the sky, butterflies, the fireflies at night, rain splashes and mist): build the few you recommend, list the rest.
   Each option with its cost (draws, triangles, frame time; one perf:check on the scene you touched at the end, compared with main back to back). Recommend one per area.
4. **No fetched art.** If a direction needs a reference, say what to ask David for. No paid generation (no ElevenLabs, no Meshy).
5. **Output:** `specs/sky-ambient.md` (the audit table, the options, the costs, questions for David), evidence under `specs/evidence/sky-ambient/r1/` with ids `sky1-*` (stills and short mp4 clips, day and night, desktop and phone), and a report. The coordinator puts it on a review page. After David's marks, the losing options and their switches get deleted.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never ports 3000, 3300, 3301, 3390.
- Locks: `LANE=game/sky-ambient /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 means retry.
- If `web/node_modules` is missing: `cd web && npm ci --legacy-peer-deps` under the heavy lock.
- Commit `[build]`, never push, never bare `git stash`. No em dashes. Ponytail (`specs/lane-rules.md`). Never write the gem-to-money rate. Real names never show in game.

## Status

Round 2 built, awaiting David's marks (head: the last `[build]` commit on `game/sky-ambient`; the report has the SHA).
Nothing ships until he marks it. Spec `specs/sky-ambient.md` §R2 (what was blurry, the techniques, cards sky2-day,
-clouds, -night, -moon, -weather, -wind, -glow, -phone, cost, questions, not verified, merging with title-r2).
- The sky: `lib/game/atmosphere.ts` (single scattering, grade, moon by Meeus, star frame; tests), `lib/game/skyShader.ts`
  (dome: per-vertex air, sun, moon sphere, stars, Milky Way, meteors, ball-cluster cumulus, cirrus, overcast deck,
  bent with the world, at the far plane), `components/game/SkyDome.tsx` (per frame: sun, moon, stars, weather ease,
  drift; every 0.5 s the exposure and the clouds' light). The light's sky colours come from it (`lookPreset realSky`,
  `moonKey` for the night key's strength; `useIslandConditions` gives `moon` and `skyAt`; `sunPath skyInstant`).
- Glow: `lib/game/glow.ts softGlow` and the 128 px dithered texture; `AmbientProps LampGlow` halos as lifted billboards;
  fireflies on the soft glow.
- Swirls: `AmbienceFX WindSwirls`, `worldFx swirlSpots`/`swirlAge` (tests), mounted on `?weather=wind` days.
- Deleted: COZY dome and `skyVariants.ts`, `public/assets/sky/layers/`, `scripts/preview-sky.mjs`, the tune bench's sky,
  `tuning.sky`, `?sky=A|B|C`, the lab swirls.
- Evidence `specs/evidence/sky-ambient/r2/` (74 stills with 4 boards and 5 crops, 16 clips each with a poster, `cost/`).
- Gates: tsc clean; vitest 400 files / 3765 tests passed, with and without NEXT_PUBLIC_GAME_WORLD=new; eslint clean on
  the touched files. perf:check back to back with main a8a03985: High 4.70 / 7.20 / 4.10 vs 4.80 / 7.20 / 4.20 ms,
  357 vs 358 draws; Lite 2.90 vs 2.90 ms, 284 vs 282 draws.

## Next

1. Wait for David's marks (the coordinator relays them here, verbatim, under David's decisions).
2. On merge with title-r2: take this branch's `lib/game/skyShader.ts` whole (it keeps `skyUniforms.uStarry`).
3. Round 3 candidates (from the questions): the motes at golden hour, the one shared wind module (lane file round 1
   Next 2), the dawn preview nearer sunrise, ambient sound beds.

## Tools and gotchas

- Round 2 shots: `PORT=3480 PLAN=day|weather|phone|phoneweather|moon|lamps node specs/evidence/sky-ambient/shoot.mjs
  <out>` (lamps: `SPOT=40,52 LAMP_YAW=-1.57`); clips `CLIPS="day night:phone ..." node .../clip.mjs <out>` (`day` is a
  lapse of the world clock, 05:30 to 23:50; it records for about 55 s: speed it to 22 s with ffmpeg `setpts`).
  Boards: `python3 specs/evidence/sky-ambient/board.py <out.jpg> <cols> <cell_w> <files...>`.
- A held dev server for iterating: `LANE=game/sky-ambient withlock.sh devserver specs/evidence/sky-ambient/serve.sh
  $PWD/web dev 3480 sleep 1500` in the background, then shoot against it; end it by killing its `sleep` (it frees the
  lock). With swap over 9 GB the heavy lock waits for it: no tsc or vitest while it runs.
- `lib/game/atmosphere.ts` has no imports, so node runs it directly: a CPU panorama of the sky (radiance through
  `skyExposure` and `gradeSky`) is the fastest way to tune colours before a browser.
- A GLSL error leaves the sky a flat colour (the background) and the shoot prints nothing: functions must be declared
  before they are used. The dome's own mesh is wound the other way from SphereGeometry: it draws DoubleSide.
- The dome sits at the far plane (`z = w * 0.999999`) with renderOrder 1000; anything opaque drawn later still covers it.

- Shots: `PORT=3480 PLAN=today|day|weather|phone|phoneplay|test node specs/evidence/sky-ambient/shoot.mjs <out>`
  (one load per weather and size; sky, clock and view switch at run time); clips: `CLIPS="name[:phone] ..." node
  specs/evidence/sky-ambient/clip.mjs <out>`. Both against `next dev -p 3480` with Supabase blanked, under the
  devserver lock; a wrapper that starts the server, waits for /lab/island, runs the shoot and kills the process tree
  worked well (pass absolute script paths: the wrapper runs from web/).
- The page keeps a 40 px strip above the canvas (desktop and phone): the scripts crop it.
- The default follow camera shows no sky; tilt the view (`?skytilt=`) for any sky shot.
- The dome's `vDir` is interpolated across its faces: renormalise it per pixel for anything round (a sun drawn from
  the raw varying comes out as a polygon).
- `#if SKY_LAB == 2` with SKY_LAB undefined is a GLSL error: nest it inside `#ifdef SKY_LAB`.
- Low-sun skies clip to cream through the grade and tone map: keep sky values well under white.
- Cost the options with `VARIANTS=sky node specs/perf/world-bench.mjs` on a measurement build (`next start -p 3158`).
- A main measurement build for back-to-back checks: a temporary detached worktree at origin/main with
  `cp -Rc web/node_modules` (APFS clone), `sh specs/perf/measure-build.sh` under the heavy lock, then
  `SKIP_BUILD=1 SCENES=v2 LOCK_OWNER=game/sky-ambient npm run perf:check`.
