# Polish audit: the outdoor world (2026-10-07, read-only)

**Scope:** the village and the home island outdoors, played signed out on `/lab/island?collections=demo`, at `main` e6964304.

**Out of scope:** foraging, tree shake, digging, crafting, the museum and the shop (that pass is merging).

**The bar:** `specs/polish/README.md`.

**Not raised again** (already settled or waiting on David):
- lamp placement (rows 163, 246);
- the sound source;
- the resident roster and names (decision 2);
- the currency's name ("TC");
- the pixel filter default;
- fish shadows;
- swimming (row 267);
- the café interior.

Paths are relative to `web/` unless they start with `specs/`. Evidence is in `specs/evidence/audit-2026-10/world/` (WebP; sheets number their frames in the top-left corner).

## How it was played
- Headless Chromium on SwiftShader, muted. It ran at about 5 FPS at 1440×900 and 12 FPS at 640×400.
- The quality probe was pinned to High (`tsi.liteMode.v1=false`). Most detail shots turn the pixel filter off. Members get the pixel filter by default, which halves the canvas resolution.
- Checked at dawn (07:25), day (13:00), evening (18:40) and night (22:30), in autumn (today's real season), summer and winter, in rain and in snow, with `?bots=12`, and on the home island.
- Exercised:
  - walk, run, jump, dash and slide;
  - running into the sea;
  - sitting on and leaving a bench;
  - the tool wheel and taking out the rod;
  - casting and waiting for a bite;
  - talking to a resident;
  - the boat home.
- The HUD was checked at 1440×900, 1280×720 and on touch phones at 390×844 and 844×390.

**Not exercised:**
- **Glide.** The leaf glider is craft-only and signed-out demos don't own it, and the village has no cliff: the map has one level-1 terrace and no level 2.
- **Pointer-lock mouse-look.** Headless can't lock the pointer, so every desktop shot shows the full HUD that appears whenever the mouse isn't captured.

**Console:** clean apart from:
- the expected 503s (Supabase is blanked);
- two 404 audio probes (item 19);
- a `logo-dark.svg` preload warning from the site shell.

## Ranked punch list

### 1. Autumn turns the whole village into sand, and the paths disappear (S)
- **What I saw:** today (October), all the grass is the colour of the dirt paths and nearly the colour of the beach. The plaza, paths, lawns and shore read as one tan desert, and the worn paths that the terrain pass (rows 262–263) made visible can no longer be seen. The same view with `?season=summer` reads correctly. The home island has the same problem.
- **Evidence:** `01-autumn-ground-vs-summer.webp` (left: autumn, today; right: summer).
- **Cause:**
  - The autumn fallback `island_grass: "#C6B46D"` (`data/content-defaults.ts:74`) and the production seed row (`supabase/migrations/20260926150100_seasonal_seed.sql:26`) sit next to soil `#e6c69b` and sand `#f5e6c7` (`lib/game/islandLighting.ts:18`).
  - These are a few lightness steps apart with almost the same hue.
- **Smallest fix:**
  - Retune autumn `island_grass` to a darker, greener gold that keeps the path contrast summer has (about #A8A852 to #B0A94E; check that the path-to-grass contrast at least matches summer's).
  - Update the fallback, and the production row through the palette editor (principle 8) or a new migration.
  - Optionally give `ISLAND_TERRAIN.soil` a warmer, darker autumn lean so the path still separates.
  - Check spring and winter the same way.

### 2. Nameplates, landmark tags and speech bubbles pile up, and show through walls (M)
- **What I saw:**
  - With 12 bots, five players' plates stacked into one unreadable block over the plaza (Marlow 02, Minnow 04, Driftwood 11, Bramble 05, Thistle 01).
  - The plate of a player behind the café floats on the café's wall.
  - Landmark tags ("Oracle temple", "Shop", "Ruins gate", "Museum · Closed", "HQ") show from anywhere on the island, through buildings, shrinking to specks in the sky.
  - Residents' speech bubbles land on top of the "Click to look around" hint and on other plates (night, Nell).
- **Evidence:**
  - `05-nameplate-pileup.webp`
  - `10-labels-through-walls.webp`
  - `15-bubble-and-hint-collide.webp`
- **Cause:**
  - Remote plates are positioned by projection only, with no overlap pass and no occlusion (`components/game/net/Nameplates.tsx`).
  - The landmark tags are a drei `<Html>` per landmark with no distance limit or occlusion (`components/game/DefaultIslandWorld.tsx:489-491`, the HQ tag at `:1012`).
  - Resident labels are separate `<Html>` elements (`components/game/NPC.tsx:460`).
- **Smallest fix:**
  - One screen-space label layout each frame: sort by depth; nudge an overlapping plate up, or fade the farther one to a dot; hide a plate whose line of sight is blocked by a building occluder (`lib/game/occluders.ts` `lineBlocked`).
  - Show landmark tags only within about 8u, fading by distance.
  - Keep bubbles clear of the look hint (or move the hint, see item 7).

### 3. Residents and players sit through each other on benches (M)
- **What I saw:**
  - **bench-0:** at 18:40 with bots, Wren sat at (-6.00, -8.00) while the bot Marlow 08 sat at (-6.42, -8.00) and Nettle 07 next to them, so three bodies interpenetrate on one log.
  - **bench-1:** the residents' evening seats are at (5, 5.1) and (5, 4.5), while the bots' seats are at (5, 4.92) and (5, 4.08).
- **Evidence:** `06-bench-overcrowd.webp`
- **Cause:** two seat models that don't know about each other:
  - Residents use three seats at `[-0.6, 0, 0.6]` (`lib/game/residentRoutine.ts:44-45`, `benchStop` `:294-316`).
  - Players and bots use two claimed slots at `±0.42` (`BENCH_SLOTS`, `lib/game/defaultIsland.ts:170`; `lib/net/botBrain.ts`).
  - Neither checks the other.
- **Smallest fix:**
  - Residents sit only on the same two slots.
  - A seated or approaching player (local, remote or bot) takes precedence: the resident picks the other slot or another bench, client-side, as café patrons already yield (`liveRemotes`).
  - `benchSeat` treats a seated resident as taken.

### 4. Two residents stand in exactly the same spot (S)
- **What I saw:** at 13:00 Mayor Eliza and Wren were both idle at (-6.649, 2.648), one body inside the other (read from `window.__residents()`). At 07:25 Odile stood at the same point.
- **Evidence:** `07-stacked-residents.webp`
- **Cause:**
  - `anchorStop` tries ring slot `(slot + k) % RING_SLOTS` (`lib/game/residentRoutine.ts:321-331`, `RING_SLOTS = 6` at `:263`).
  - When a slot doesn't fit the nav grid, it falls through to the next one without knowing another resident already took it.
  - Ten residents share six slots through their sorted index (`components/game/NPC.tsx:376-380`).
- **Smallest fix:**
  - Reserve anchor slots across residents per phase, as `residentSeats` does for benches.
  - Grow the ring (or add a second ring) when there are more residents than slots.
  - Add a test that no two residents' stops are within 0.5u at any time of day.

### 5. The notice board and the catch board face the HQ wall (S)
- **What I saw:**
  - From the plaza both boards are blank dark-green slabs.
  - Their pinned notices face the HQ door, about a metre from the wall, and can only be read from behind them.
- **Evidence:** `02-boards-face-the-wall.webp` (left: from the plaza; right: the notices seen from the HQ side).
- **Cause:** `bulletin-board.glb` is placed with no rotation (`components/game/DefaultIslandWorld.tsx:485-486`). The mission board right below it does take a yaw (`:487`).
- **Smallest fix:** turn both boards to face the plaza (rotation π, or a yaw from the map object if David wants to set it in the painter).

### 6. The bridge has no river under it, and you can walk into its rails (S, plus a repaint by David)
- **What I saw:**
  - The river stops in rounded ends on both sides of the plaza bridge.
  - The bridge model sits on a plank floor with torn, sand-coloured edges, which reads as a patch of wood on dry ground with two beams on it.
  - Standing at the deck's edge puts the character inside the side rail.
- **Evidence:** `03-bridge-on-wood-cells.webp`, `22-bridge-rail-clip.webp`
- **Cause:**
  - The six cells under `bridge-0` (x −1..1, z 0..1 in `data/village-map.json`) are painted Wood (4), not River (6). The organic contour then rounds the river off, and the Wood surface draws its own planks under the model.
  - The walk rectangle `BRIDGE_DECK_HALF = [1.9, 1.2]` (`lib/game/defaultIsland.ts:66`) plus the body radius reaches the rails, which sit at ±1.45.
- **Smallest fix:**
  - **David** repaints those cells as River in `/lab/map` (agents don't paint, row 247).
  - **Code:** narrow the deck's half width to about 1.0, or make the rails solid.
  - **Painter health check:** a bridge must stand over river or water cells.

### 7. Talking, the greeting and the boat trip bring the full HUD in (S)
- **What I saw:**
  - The moment you talk to a resident, the bag, collection, map, objective, heading and people button slide in around the dialogue box.
  - During the boat trip, the heading, bag, collection, the top cluster and "Click to look around" stay on screen over the sail.
- **Evidence:** `09-talk-full-hud.webp`, `17-trip-keeps-hud.webp`
- **Cause:**
  - `fullHud()` shows everything whenever the mouse isn't captured (`lib/game/hudPrefs.ts:13-15`).
  - Talking and the greeting release the cursor (`holdCursor("talk" | "greeting")`, `components/game/DefaultIslandWorld.tsx:932`), so every conversation counts as the pause view.
  - The trip hides only the minimap (`holdObjective`).
- **Smallest fix:**
  - Pass a `cinematic` flag (talking, the greeting, `trip.active`) into `fullHud` and the heading, and hide everything except the dialogue or the Skip button.
  - Keep the full HUD for sheets and the real pause view.

### 8. The backs of the buildings are blank boxes (L)
- **What I saw:** with the orbit camera you can walk round every building, and:
  - the HQ's back is a flat brown wall with a plain grey slab for the clock tower;
  - the shop's back is a plain yellow box;
  - the museum chalet's back is a bare gable with no windows, trim or door.

  The trees got full crowns for exactly this reason (row 284).
- **Evidence:** `04-blank-building-backs.webp`
- **Cause:** the ACNH building GLBs (`components/game/ACNHBuilding.tsx`, the chalet parts) are front-only shells, built for the fixed west camera.
- **Smallest fix:**
  - Remodel the backs and sides in Blender, as the tree pass did (`art/trees/build_trees.py` pattern): windows, a back door or vents, trim and roof underside; matte; report the triangle counts.
  - Start with the HQ and the shop, the two most often walked round.

### 9. A tree's canopy hides your head when you stand on the camera side of its trunk (M)
- **What I saw:**
  - Standing at (13.1, −12) beside the oak at (14, −12), the canopy covers the player's head and nameplate, and the cutout never opens.
  - On the far side of the same tree the dithered cut opens correctly.
- **Evidence:** `08-canopy-hides-player.webp` (left: near side, no cut; right: far side, cut working).
- **Likely cause:**
  - The line-of-sight test aims at the chest (`components/game/IslandAtmosphere.tsx:205-207`), and the cut only removes fragments nearer than the chest's view depth.
  - The leaves around a head standing inside the canopy box (`treeOccluder`, `lib/game/occluders.ts:57`) fail one of the two tests.
- **Smallest fix:**
  - Test the head point as well as the chest.
  - For a tree whose canopy box contains the player, cut every canopy fragment within the circle regardless of depth, keeping the floor rule.

### 10. Rain and snow fall from a blue sky, with sun shadows (M)
- **What I saw:**
  - In rain the sky stays light blue (sampled at rgb 143/180/221; clear is 82/172/243).
  - Trees and characters still cast directional sun shadows.
  - The ground isn't darker or wetter.
  - Snow looks good on buildings and trees, but has the same sunny sky.
- **Evidence:** `11-rain-blue-sky.webp`
- **Cause:** `WEATHER_MOD.rain` is mild (`lib/game/islandLighting.ts:141-147`): desat 0.45, dim 0.9, sun 0.45, shadow intensity 0.5. There is no overcast layer and no wet ground response.
- **Smallest fix:**
  - Make rain overcast: desat about 0.8, dim about 0.75, sun about 0.25, shadow intensity about 0.15.
  - Darken and slightly gloss the terrain under rain through the terrain material's shared uniform (`TERRAIN_GRASS`/`TERRAIN_SNOW` pattern).
  - Snow is lighter: overcast sky, softer shadows.
  - Show David a before and after, since this touches the approved look (rows 236–239).

### 11. On phones the HUD covers a third of the screen and spills off in landscape (M)
- **What I saw:**
  - **390×844:** the heading, 4 top buttons, the clock, the Bag and Collection pills, the Map pill, the objective, the stick, Slide, Dash, Jump, the hand button and the hint pill are all permanent. The heading "Tethos Island" is drawn over the "Catch board" world tag.
  - **844×390:** the stick and action buttons run off the bottom, and the hint is gone.
- **Evidence:** `14-phone-hud.webp`
- **Caveat:** the dev-only lab nav (40px) pushes the page down. Re-check landscape on `/student/dashboard`.
- **Cause:** touch always means the full HUD (`lib/game/hudPrefs.ts:14`). Bag, Collection and Map are separate large pills (`components/game/DefaultIslandWorld.module.css`, `.bagButtons` and `.minimap`).
- **Smallest fix:**
  - On a coarse pointer, fold Bag, Collection and Map into one menu button.
  - Let the heading flash and fade as it does on desktop.
  - Size the stick and buttons from the short side for a landscape height under 430px.

### 12. At night the village has one resident (S, data)
- **What I saw:** at 22:30, 9 of 10 residents are hidden indoors, and only Nell sits on bench-1. With no players online the village is empty (principle 2).
- **Evidence:** `16-night-one-resident.webp` (the night scene). The resident list was read from `__residents()`; all but Nell show `hidden:true`.
- **Cause:** most routines send everyone home at night (`lib/content/residentRoster.ts` schedules; `lib/game/residentRoutine.ts` `homeStop`).
- **Smallest fix:** give three or four residents night stops in lit places that already exist:
  - the HQ porch (its lamps);
  - bench-1 by lamp-0;
  - the wharf (its lanterns);
  - a stroll on the beach.

  Stagger who goes home and when, so it thins out rather than emptying at a phase edge.

### 13. Grey stair-step teeth along every shoreline (M)
- **What I saw:** just past the organic sand edge, a row of small grey square notches follows the cell grid along the waterline, on the village coast and around the home island.
- **Evidence:** `13-coast-teeth.webp`
- **Likely cause:** something cell-shaped under the shallow water shows through it where the derived contour pulls inside the cell edge: a per-cell bed or bank piece (`components/game/grid/GridTerrain.tsx` around `:430-480`, the bed under water cells) or the coast's underside.
- **Smallest fix:**
  - Find the mesh with a wireframe or layer toggle in `/lab/island`.
  - Clip or bend it to the same contour as the sand (`terrainOf`), or sink it below the shallow-water ramp.
  - This is the "fix the model, not a cover layer" rule.

### 14. Residents crowd the player and the camera line (M)
- **What I saw:**
  - Residents walk up to within about 0.5u of the player and stop there.
  - Juniper repeatedly ended up between the camera and the player, her bubble covering the player completely (the fishing shot).
  - At spawn she is often half a step away.
- **Evidence:** `19-fishing-hint-and-crowding.webp` (frame 1: Juniper between the camera and the player, her bubble over them), `01` and `09` (Juniper beside the player).
- **Cause:** routines are pure world state ("Nothing here reads a player", `lib/game/residentRoutine.ts:10`), and the client draws them wherever the routine says (`components/game/NPC.tsx`).
- **Smallest fix:**
  - Client-side only, so the shared routine stays shared: hold a resident's stop or path point at least about 1.2u from any player and out of the camera-to-player corridor (the same yield the café patrons use).
  - Never let one stand still within that radius unless talking.

### 15. No footprints in snow (S–M)
- **What I saw:** with `?season=winter&weather=snow`, after 2.5s of walking there were no prints behind the player or behind Juniper, only the snow puff. Living-village deliverable 6 promises fading prints.
- **Evidence:** `12-snow-no-prints.webp`
- **Cause:** not found. Prints come from `components/game/WeatherGround.tsx:80-130` (shown when `look.snow >= 0.5`, the trail stepped by `lib/game/weatherGround.ts` `stepTrail`). Check whether the trail ever stamps at low frame rates, and whether the print material shows on the snow-tinted ground (the print colour is "the blue of snow in shadow", so it may be invisible on a flat, unshadowed ground).
- **Smallest fix:** debug the stamp count first. Then darken the print's dent enough to read on lit snow.

### 16. River and shore foam glows at dusk and night (S)
- **What I saw:** at 18:40 the river's foam collar is the brightest thing in the shot. At 22:30 it is still a pale line round the dark river.
- **Evidence:** `18-river-foam-evening-night.webp`
- **Cause:** the foam is mixed in after the water's lighting at a fixed per-phase colour (`lib/game/waterShader.ts:409-415`; night `foamColor 0x8babc2`, `lib/game/islandLighting.ts:78`), so shadow and dusk don't dim it.
- **Smallest fix:** multiply the foam by the scene's sun-plus-ambient term (or take it from the lit water colour), and lower the evening and night foam values.

### 17. Sitting down still says "Sit on the bench" (S)
- **What I saw:** once seated, the prompt still reads "E Sit on the bench". Pressing E stands you up.
- **Evidence:** `21-seated-prompt-says-sit.webp`
- **Cause:** one label for both states (`NEAR_LABELS.bench`, `components/game/DefaultIslandWorld.tsx:187`).
- **Smallest fix:** "Stand up" while seated (the same for the bed).

### 18. "Watch for the bite" is unreadable on sand (S)
- **What I saw:** the line under "Waiting for a bite…" is white text on light sand, which you can barely see.
- **Evidence:** `19-fishing-hint-and-crowding.webp` (frame 0)
- **Cause:** `components/game/FishingOverlay.tsx:500` renders without the cream card or a text shadow.
- **Smallest fix:** put it inside the cream card, or give it the heading's paper text shadow.

### 19. Every load asks for audio files that don't exist (S)
- **What I saw:**
  - 404s for `/audio/ambient/day-autumn.ogg` and `/assets/audio/music/10-autumn.mp3`.
  - An `[audio] Could not decode` warning on each load.
- **Cause:** `ambientCandidates` probes `${phase}-${weather}` and `${phase}-${season}` names (`lib/game/audio.ts:474-481`), and the music schedule probes month-and-season names, without a manifest of what's on disk.
- **Smallest fix:** list the variants that exist in `MANIFEST` and only request those. This is independent of the sound-source decision.

### 20. Residents say "Morning!" in the evening (S, content)
- **What I saw:** at 18:40 Wren's line was "Morning! The notice board has something new, I think. Probably."
- **Evidence:** `06-bench-overcrowd.webp`
- **Cause:** chatter lines aren't tagged by time of day (`lib/content/residentRoster.ts:132`).
- **Smallest fix:**
  - Allow an optional `phases` tag per line and filter by the world phase.
  - Until then, drop the greeting word from untagged lines.
  - Fold this into David's roster review (decision 2).

### 21. Walking into the sea: a dead stop with no response (S)
- **What I saw:**
  - Holding forward into the water stops you dead at the waterline (the sim reads `vx = vz = 0`), with no lean, push or turn.
  - A dash into it throws a sand puff and nothing else.
  - The jump into the shallows splashes nicely.
- **Evidence:** `23-run-into-water-wall.webp`
- **Cause:** water is a wall on foot (`lib/game/movement/sim.ts:13-14`), and no event is emitted at a wet wall (the `bonk` event exists for solids).
- **Smallest fix:**
  - Emit a soft `bonk` or "shore" event when input pushes into wet ground.
  - Play a small brace or lean-back pose, with a ripple at the toes.
  - It never moves you; it only acknowledges the input.

### 22. The house's lanterns look lit at noon on the home island (S, verify)
- **What I saw:** at 13:00 both porch lanterns on the house are bright white-yellow, the same as at dusk.
- **Evidence:** `25-home-lanterns-noon.webp`
- **Cause:** not confirmed. It could be the lantern glass's own emissive texture rather than `windowLit`. The village's porch lamps ease correctly (`FadeLight`).
- **Smallest fix:** drive the home house's lantern emissive from `windowLit(light)`, as the village buildings are driven.

### 23. Below about 6 FPS the player's pose alternates every frame (low, verify)
- **What I saw:**
  - At 5 FPS the idle player alternated between upright and bowed (top of the head showing) on every rendered frame, while standing still, with steady sim state.
  - At 12 FPS it didn't happen.
- **Evidence:** `20-low-fps-pose-flicker.webp`
- **Likely cause:** a spring integrated with `dt` capped at 0.1 (`components/game/PlayerAvatar.tsx`, the squash/rise/lean block near `:620-640`) overshoots at that step.
- **Smallest fix:** substep the cosmetic springs to at most 1/30 s, or use exact exponential damping. This matters for weak laptops and phones under load.

## What held up well
- Dawn, day, evening and night lighting blend and read nicely (`24-dawn-evening-night.webp`).
- Building windows glow at night.
- The boat trip is smooth and load-aware.
- Sitting, the tool wheel (`26-wheel-and-held.webp`), casting with a bobber and line, and the talk camera with the cream dialogue box all work.
- Snow dresses buildings and trees convincingly.
- Bots read as the same kind of character as you: same rig, phone icon, class line, sitting.
- The occluder cut works in the common case (far side of trees, building corners).
- No React or WebGL errors were seen.

## Fix groups (no shared files)

### Group A: HUD, labels and prompts (items 2, 5, 7, 11, 17, 18)
**Files:**
- `lib/game/hudPrefs.ts`
- `components/game/DefaultIslandWorld.tsx`
- `components/game/DefaultIslandWorld.module.css`
- `components/game/net/Nameplates.tsx`
- `components/game/net/net.module.css`
- `components/game/FishingOverlay.tsx`
- `components/game/TopCluster.tsx` / `.module.css` (touch folding)
- a new `lib/game/labelLayout.ts` (the shared declutter pass)

**Notes:**
- The board rotation (item 5) lives in `DefaultIslandWorld.tsx`, so it rides with this group.
- Group A publishes the `labelLayout` API. Group C then registers the residents' labels from `NPC.tsx`, so group C merges after A or wires it in a follow-up.

### Group B: world look, weather, water and coast (items 1, 10, 13, 15, 16, 19)
**Files:**
- `data/content-defaults.ts`
- a new migration for the autumn palette row (or the palette editor)
- `lib/game/islandLighting.ts`
- `lib/game/waterShader.ts`
- `components/game/grid/GridTerrain.tsx`
- `components/game/grid/terrainMaterials.ts`
- `components/game/WeatherGround.tsx`
- `lib/game/weatherGround.ts`
- `lib/game/audio.ts`

**Note:** items 1 and 10 need David's eye on a before and after.

### Group C: residents, seats and the bridge walk (items 3, 4, 6 code half, 12, 14, 20)
**Files:**
- `lib/game/residentRoutine.ts`
- `components/game/NPC.tsx`
- `lib/content/residentRoster.ts`
- `lib/game/defaultIsland.ts` (`BENCH_SLOTS`, `benchSeat`, `BRIDGE_DECK_HALF`)
- `lib/net/botBrain.ts`
- `lib/game/mapHealth.ts` (the bridge-over-water check)

**Note:** the bridge repaint is David's (row 247).

### Group D: camera cut, player feel and building backs (items 8, 9, 21, 22, 23)
**Files:**
- `components/game/IslandAtmosphere.tsx`
- `lib/game/occluders.ts`
- `components/game/PlayerAvatar.tsx`
- `lib/game/movement/sim.ts`
- `components/game/home/HomeIslandScene.tsx`
- `components/game/ACNHBuilding.tsx`
- new Blender sources under `art/buildings/` and their GLBs in `public/assets/`

**Note:** the building backs (item 8, L) can split off as their own art agent. It doesn't touch the code files above.

## For David
- **Repaint** the six Wood cells under the plaza bridge as River (x −1..1, z 0..1) so water runs under it (item 6).
- **Approve the look** of the autumn palette and the overcast rain before they ship (items 1, 10).
- **Resident lines** become time-aware as part of the roster review (item 20, decision 2).
