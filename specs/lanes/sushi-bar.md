# Lane: sushi-bar (the sushi bar, remodelled in the style of Bancho Sushi)

Worktree `.claude/worktrees/sushi-bar`, branch `game/sushi-bar`. Agent type `uwotsi-lane`, cut from `game/terrain-v3` at c13ea8e7 (terrain R2c, with every new-world asset so far).

**Read first:**
- `specs/lanes/terrain-v3.md`, "2026-10-26: R2c review": David's notes verbatim and the reading. This lane does the items it names for you.
- `specs/lanes/wharf-art.md` and `specs/lanes/village-art.md`: how the last art lanes built, registered and previewed their assets. Follow the same pattern: the builders in `art/`, `propkit.py`, `paintkit.py`, `SCENERY_URLS`, `NEW_LAMPS`, `PROP_FOOTPRINT`/`PROP_TOP`, the budget rows.
- The references in `specs/references/terrain/` (`plan-2026-10-23/`, `r2-2026-10-26/`).

**Art direction:** David's words are "treat each asset properly" and "visually stunning". Use our style: cartoony, smooth, subtle painted textures, low detail where it doesn't show, performance first (few materials, instanced repeats). Organic shapes, never plain spheres or boxes. Search `web/public/assets/` first. David supplies every reference: never fetch art, textures or references, and never use asset libraries or generators. The default village is the launch fallback and stays unchanged: new files and names only, or replace files only the new world uses.

**Per asset:**
- a builder in `art/`;
- the GLB in `web/public/assets/game/`;
- a preview in `specs/evidence/sushi-bar/`;
- registered, with footprints where solid;
- the propModels, modelMaterials and budget tests green.

**Reporting:** one batch per commit. After each, SendMessage "main" with:
- the commit;
- each asset's name, triangles and size;
- the preview path;
- placement notes for terrain-v3.

Then go straight on. At the end, update Status here, send the full list, and stop. Questions go in `specs/launch/terrain-v3-questions.md` under your lane, one line each with your default.

## Status

**Phase A round 2 built, 2026-10-26** (branch game/sushi-bar, f8b4b78b on 57e7f47c; terrain-v3 not merged in since e0ca3cf9). Shots `specs/evidence/sushi-bar/phase-a2/`: bar-day, bar-night, approach-day, approach-night (no sand path), chef-outside (closed), entrance (evening, close up), entry-300/900/1500 (the glide), seat-evening and seat-night with -left and -right (looking round), model-front, model-back, model-gate-night (Blender review renders).

1. **Japanese, a better model** (`art/buildings/build_sushi_bar.py`): a kawara roof (`roof`, `roof_pt`: the tiles' bed, 25 rows of round cover tiles a slope with pale end discs, the corners turned up by SORI, a stacked ridge with an onigawara at each end, dark bargeboards and eave fascia); the side walls charred-cedar boards to RAIL_Y under white plaster between dark timbers, plaster over the bottle beam; an indigo valance with white crests either side of the entrance (the red swags gone); the round front posts without rope or glass floats; the entrance under the eave (`pier`): dark posts on stone footings, a head beam, the kanban in a dark frame, a shimenawa with straw tassels and shide; the noren deep indigo with the bar's crest on the middle panel; the roof sign under a little tiled cap.
2. **Lanterns** (`chochin`): tall ribbed paper bodies, each rib its own darker glow block (`lantern-rib`, `red-rib`), black lacquer caps, tassels; a big red pair at the door; a row of eleven small red and white ones on a cord across the kitchen in front of the bottles (ROW_Y). The string lights are gone.
3. **The sand path:** its paint is gone; only its last stretch still eases the sand to the boardwalk, unpainted (`generate.ts`, `SUSHI_PATH.slice(-2)`); the lantern post and six hand lanterns still mark the way (they read well at night: approach-night). World regenerated (height.png, surface.png; world.json unchanged).
4. **The chefs at work in view:** a raised board floor behind the counter (STAFF_Y 0.3) and a work ledge behind the fish case (LEDGE_Z) with two cutting boards (BOARDS, a block of salmon and of tuna) and a geta beside each. Bancha slices at a board (`CHEF_STATIONS` Craft, `Staff` replays the Craft clip each CRAFT_S with `sushi-knife.glb` held on the hammer's grip), then sets nigiri on its geta one by one (Trace; the hours model's `prep-<board>`, shown through the mesh's draw range, cleared as he starts slicing there again), reaches to the back counter; the server plates at the far end. `OwnerClip` gained "Craft" (cafe.ts).
5. **The seated view:** `SEAT_FOV` 60 (moveFx.ts, PlayerAvatar while a seat hides you); the eye 0.4 behind the stool, a little down (seatView). Looking round (`IslandAtmosphere` SEAT_YAW 60 degrees either side, SEAT_TILT about 20 up or down from the orbit's middle pitch, eases back after SEAT_SETTLE 1.5 s; the pitch you had comes back as you get up); mouse after a click, the arrows, or two fingers. The glide now drops first (SEAT_DROP) and goes in through the noren.
6. **Islands out the window** (`sushi-bar-isles.glb`, 4.0k tris, one P_Stone draw): limestone stacks with green tops and palms, a long island far off, a palm islet; each raised to sit on the sea's horizon from the stool's eye ((d sqrt(k) - sqrt(h))², `isle_base`, mirroring curvedWorld's bend); drawn only while seated, once the camera is within ISLES_NEAR of the eye.
7. **Decor:** menu tags along the window beam, sake shelves on the right wall (big bottles with labels, tokkuri, wooden cups), a great-wave poster, a bonsai on the back counter, bamboo planters (the palms gone), two sake casks on the deck, a lucky cat on the counter's end.

**Models:** sushi-bar 15.7k tris (budget exception row in `perf/budget.ts`, 16k, 7 draws), glow 6.9k, pier 5.2k, hours 1.4k, isles 4.0k, sushi-knife 80 (three same-look parts, merged in the hand). PROP_TOP sushi-bar 5.02.

**Gates (f8b4b78b):** tsc clean; eslint clean on changed files; vitest default village all pass (3442); with `NEXT_PUBLIC_GAME_WORLD=new` all pass but `app/api/collections/route.test.ts` (21, as before: it posts village coordinates). perf:check SCENES=v2 against the 2026-10-14 baseline (before the new world): high 5.6 ms (5.4), 395 draws (254), 1.28M tris; lite 3.7 ms (3.0), 324 draws (172), 1.07M tris: FAILED on draws and triangles, the new world's own growth; this lane adds at most about 7.5k triangles and no still draws at the bar (the isles only while seated, the nigiri draws only while set). An A/B against 57e7f47c was not run.

**Open:**
- The server's name: not given yet, unnamed.
- The night view from the beach is still dim at distance (the bar's pools light its own deck and landing).
- The chef and server use existing parts only (no afro hair, no diving mask in the catalogue).
- The `?time=` clock starts every shot at much the same moment of the staff's loops; the shoot script's `wait` moves the evening seat shot into the chef's slicing. In play the loop runs on the world clock.
- The knife's grip is the hammer's (Character.tsx HELD_GRIPS); from a stool it reads as a knife raised and brought down on the fish, not a drawn slice.
- Phase B (menu, ordering, food, buffs, quests, photos) after launch.

## David's decisions

**Phase A round 2, his review of 2a7c87cb** (https://claude.ai/artifact/Xh3WqWHGxrB5z1a5xjSAKJ, 2026-10-26), verbatim:
- **spot, approach by day, day, night:** approved.
- **closed (approved):** "more japanese style, lanters better modeled, this should be japanese"
- **glide (approved):** "looks good but need to enhance the building model here"
- **approach at night (redo):** "get rid of that ugly path i the sand and the rocks"
- **seated, evening (redo):** " first person should be able to see the npcs preparing the food, the background should havethe small islets or maybe some ilands in the distance to make it look beautiful, make fov higher slightly"
- **seated, night (redo):** "reduce fov to see more, can look around, the interior needs better decore"
- **The server's name:** not given yet; keep it unnamed.

The coordinator read "fov" as: see more (wider). terrain-v3 removes the tall seabed rocks on the new world.

## Next

1. Wait for David's review of round 2 (the shots above).
2. Phase B after launch.

## Tools and gotchas

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script> [-- args]` under `sushi-bar=game/sushi-bar /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`. Never open the Blender app, and never use the `blender` MCP tools: they drive David's visible Blender.
- **Locks:** `withlock.sh heavy <cmd>` for vitest and tsc. If swap is over 9 GB, wait before taking the Blender lock. Other lanes are running (terrain-v3, perf-newworld and two more art lanes), so expect waits.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **node_modules:** cloned (`cp -c -R`).
- **propModels.ts:** other lanes append to the same tables. Add your entries in one block with a comment line naming your lane.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees.
- **Builder:** `withlock.sh blender .../Blender -b --factory-startup -P art/buildings/build_sushi_bar.py [-- review <dir>]` writes both GLBs; review renders front, back, stool view, and night (glow on, no lights).
- **Shots:** `PORT=3175 node specs/evidence/sushi-bar/shoot.mjs <dir> [view,...]` (headless, muted; `sit` stands you at the entrance and presses E, `frames` shoots the glide). Dev server on 3175 with `NEXT_PUBLIC_GAME_WORLD=new`, Supabase blanked, under the devserver lock. The bar's frame (lx, lz) is the world's (-47 - lx, 119.5 - lz).
- **World:** after editing `generate.ts`, `cd web && npx vite-node -c vitest.config.ts scripts/generate-world.ts` (about 15 s), then walk.test, generate.test, world.test, cells.test, sealed.test with `NEXT_PUBLIC_GAME_WORLD=new`.
- **Music:** `python3 art/audio/loop_track.py <export> web/public/assets/audio/music/<slot>.mp3 <bpm>` reads the export (never moves it) and writes the looped slot; list the name in `MUSIC_FILES`.
- **Builder mirrors:** `BAR_DECKS`, `ENTRY`, `HOURS_TOP`, `STAFF_Y`, `STOOLS` in `lib/game/sushiBar.ts` mirror the builder's LAND_*, WALK_*, GATE_*, HOURS_TOP, STAFF_Y, SEATS: change both together. `CHEF_STATIONS` stand where the Craft clip's blow lands on the builder's BOARDS (0.63 ahead of the feet, 0.585 over them: Workshop.tsx BENCH). The builder's EYE (the islands' raise) mirrors `seatView`'s eye.
- **The builder writes six GLBs** (sushi-bar, -glow, -pier, -hours, -isles in game/buildings; sushi-knife in game/tools). A tool GLB must be several parts of one look (heldMesh.test): the knife's three `knife_*` materials.
- **perf:check:** `measure-build.sh` rewrites and then restores game files from git: commit first. Build under `withlock.sh heavy sh specs/perf/measure-build.sh`, then `SKIP_BUILD=1 SCENES=v2 LOCK_OWNER=game/sushi-bar npm run perf:check` (it takes the devserver lock itself and deletes web/.next).
- **Shots:** `shoot.mjs` views `turn` (look round from the stool, radians, + left) and `wait` (ms more before the shot).
- **Big props and the walker's buckets:** `islandOf` buckets props by their centre (4 u buckets, +-1 searched), so a footprint half over 4 is missed at its ends: keep the core at hw 4.
