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

**Phase A built, 2026-10-26** (branch game/sushi-bar; terrain-v3 merged in at e0ca3cf9). Shots `specs/evidence/sushi-bar/phase-a/`: bar-day (closed, blinds down), bar-evening, bar-night, approach-day and approach-night (the path from the beach), chef-outside (closed, the chef on the landing), entry-0/500/1000/1500 then entry (the glide in from the entrance), seat-evening and seat-night (first person).

1. **Where:** on stilts off the beach's west end, `SUSHI = [-47, 119.5]`, yaw pi (`generate.ts`: the bar, its pier object `sushi-bar-pier` at the same origin, `SUSHI_PATH` and its lanterns; the old sand pad zone removed; world regenerated). Its window looks south to the open sea, its pier runs north to the sand (land end z 107.5). The water under its guests' deck is too deep to wade, so the way in is the entrance (walk.test checks it).
2. **The path (David, R2d: "there should be a path to the front of it"):** a dirt path (a ramp, Paint.Path, half 1.1) off the beach's main stretch west of the volleyball net, between the parasols and the palms, down to the boardwalk's end at its height; a wharf lantern post where it starts, six hand lanterns along it (`lamps()`, ids `lamp-sushi-*`).
3. **Models** (`art/buildings/build_sushi_bar.py`): `sushi-bar.glb` 11.5k tris (lower back counter and sill so the sea shows over them from a stool, a lower fish case, a duckboard for the staff, posters, today's menu easel moved out to the landing); `sushi-bar-pier.glb` 4.7k (piles and braces, the landing, the boardwalk sloping 0.4 to the sand, rope rails, four lantern posts, the entrance gate with the bar's board); `sushi-bar-hours.glb` 620 (`shutters`: bamboo blinds over the front and sides; `noren`: the entrance curtain); `sushi-bar-glow.glb` 4.9k (six more lanterns outside). All under the 12k building row; budget.test green.
4. **Decks** (`defaultIsland.ts barDecks`, `sushiBar.ts BAR_DECKS`): the bar's floor at `BAR_Y` 0.7 (its origin), the landing (x +-1.4) and the boardwalk (x +-0.8, falling 0.4); the jetty's deck code and the bar's share `localDecks`.
5. **Hours** (`barOpen`: evening and night): by day the blinds are down and the chef stands on the landing (Phase B gives him quests); from the evening the blinds roll up (`SushiBar.tsx hang`, about `HOURS_TOP`), the noren is hung, the lights come on (a little dimmer in the evening), the chef and the server work behind the counter.
6. **Entering:** E at the entrance (`ENTRY`, range 1.5) while it's open: `barSeat` gives the next free stool in `SEAT_ORDER` (2, 3, 1, 4, 0, 5: each new guest sits beside the last), claim key `sushi:<id>#i`. The seat detail carries `hide` (PlayerAvatar hides your own avatar) and `exit` (getting up puts you on the landing facing out). The prompt reads "Enter the sushi bar", seated "Leave the bar"; E or moving gets you up. The follow camera glides from the view as it was to the first-person eye over 1.8 s (smootherstep), and back out (`IslandAtmosphere SEAT_GLIDE`; no black screen, the occluder cut off while seated).
7. **First person:** `seatView`: eye 1.7 over the floor, 0.3 behind the stool's middle, looking across the counter to the chef with the sea in a band over the back counter. (The curved world drops the far sea about 10 degrees under a seated eye, which is why the back counter and sill went down to 0.7.)
8. **Staff:** chef "Bancha" (our design: dark skin, full hair `hair_fluffy_boy`, gold shades, white shirt, indigo trousers, deadpan; no afro part exists in the catalogue); the server (navy raincoat as a diving suit, yellow rain boots as fins, open smile, blush; no diving mask part exists). His name is David's call. The old "facing away" was the chef's face hidden behind the fish case: fixed by the duckboard (`STAFF_Y`) and the lower case.
9. **Music:** slots `bar-evening` and `bar-night` (`musicSchedule.ts`), both files in: David's Suno tracks "海辺の夕食" and "Smoky Night Groove", looped on bar lines by `art/audio/loop_track.py` (one-beat crossfade of the next bar into the start, 3 ms edge fades), -14.9 LUFS, about -1 dBTP, 128 kbps. Sources and prompts in the music README. Not heard (headless, muted).

**Gates (head of this lane):** tsc clean; eslint clean on changed files; vitest default village 3441 passed; with `NEXT_PUBLIC_GAME_WORLD=new` all pass but `app/api/collections/route.test.ts` (21: it posts village coordinates; nothing on its path changed in this lane, not rerun on the merge base); budget.test green. The old `integration.test` regex for the bench claims was fixed for the stool line.

**Open:**
- David to confirm "left" (west) and the spot; the night view from the beach is dim at distance (the bar's pools light its own deck and landing).
- The chef and server use existing parts only: no afro hair, no diving mask in the catalogue. A dedicated hair or mask would be new character art.
- The music element's loop (`audio.ts`, an HTMLAudioElement) is not sample-exact; the files are made to wrap cleanly but the browser may leave a few ms.
- The evening seated view sometimes shows the chef at a back-counter station, his back to you (his loop).
- Phase B (menu, ordering, food, buffs, quests, photos) after launch.

## Next

**Phase A round 2: David's review of 2a7c87cb** (https://claude.ai/artifact/Xh3WqWHGxrB5z1a5xjSAKJ, 2026-10-26), verbatim:
- **spot, approach by day, day, night:** approved.
- **closed (approved):** "more japanese style, lanters better modeled, this should be japanese"
- **glide (approved):** "looks good but need to enhance the building model here"
- **approach at night (redo):** "get rid of that ugly path i the sand and the rocks"
- **seated, evening (redo):** " first person should be able to see the npcs preparing the food, the background should havethe small islets or maybe some ilands in the distance to make it look beautiful, make fov higher slightly"
- **seated, night (redo):** "reduce fov to see more, can look around, the interior needs better decore"
- **The server's name:** not given yet; keep it unnamed.

**The coordinator's reading:**
1. **Japanese, and a better model:**
   - the building reads clearly Japanese: a tiled or cedar-shingle roof with upturned eaves, wooden lattice and shoji panels, a proper noren, rope (shimenawa) or a wooden sign plaque;
   - the lanterns modelled properly: red and white chochin with ribs and black caps, and a pair of big ones at the entrance;
   - more care on the building as a whole. It's the bar's face from the glide and the beach.
2. **The sand path:** remove the dirt path in the sand. You can keep a few lanterns marking the way, if they look good without the path. terrain-v3 removes the tall seabed rocks on the new world.
3. **The seated view:**
   - **The chefs:** you see them preparing food. Their upper bodies and hands are at work over a cutting board in clear view, not hidden behind the fish case. Give them a visible prep loop: slicing, plating.
   - **The view:** "see more", so a wider field of view than now. David wrote both "fov higher" and "reduce fov to see more"; the intent is to see more.
   - **Looking around:** a limited range while seated, by mouse or drag, about 60 degrees each side and some up and down. It eases back to centre.
   - **Islands in the distance:** small islands through the window, so the view is beautiful. The curved world sinks far things, so use cheap backdrop islands placed or raised to sit on the horizon from the seat, drawn only when seated if that's cheapest.
4. **The interior's decor:** richer and cozier. Sake shelves, posters, a hanging lantern row, plants, the fish tank, menu tags on the wall, a lucky cat.

Then shots into `specs/evidence/sushi-bar/phase-a2/`:
- the bar by day and at night;
- the entrance close up;
- the glide (3 frames);
- the seated view at evening and at night, looking centre, left and right.

Gates as before (with and without the switch, tsc, eslint, budget.test). Commit, update Status, SendMessage "main", stop.

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
- **Builder mirrors:** `BAR_DECKS`, `ENTRY`, `HOURS_TOP`, `STAFF_Y`, `STOOLS` in `lib/game/sushiBar.ts` mirror the builder's LAND_*, WALK_*, GATE_*, HOURS_TOP, STAFF_Y, SEATS: change both together.
- **Big props and the walker's buckets:** `islandOf` buckets props by their centre (4 u buckets, +-1 searched), so a footprint half over 4 is missed at its ends: keep the core at hw 4.
