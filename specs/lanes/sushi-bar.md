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

**Ship-readiness done, 2026-10-26** (head: the commit after 39cfad42 that updates this file; main 1877dcb5 merged at ac6abd64). The review's seven items:

1. **Merge:** origin/main merged; `generate.ts` merged clean (main's `gatherSpots` with its SUSHI 7 m keep-out, the bar's new SUSHI); `world.json` regenerated with `scripts/generate-world.ts` (gather spots identical to main's). Every gather node is on dry ground and reachable (reach lattice, 44 to 49 points within 1.5 m each); the nearest to the bar, gather-shell-0 and gather-bottle-0, are 17.9 m and 17.7 m from it. walk, sealed, cells, generate, world and `app/api/collections/route.test.ts` pass with and without the switch.
2. **Stool clashes:** `barSeat(..., taken, outranked)`: on a stool another's claim outranks (active.ts `remoteSeatOutranks`: a remote in view holding your key whose uid sorts before yours, `chatStore().selfUid`), it returns the next free stool with `clash: true`, or your own stool (which gets you up) when none is free; DefaultIslandWorld dispatches it at once. Tests in sushiBar.test and active.test.
3. **Seat claim leak:** sender.ts clears `sitKey` on `tsi:sit-here` and `tsi:stand` (benches share it). Test in sender.test (fails without the fix).
4. **Loads from afar:** the isles are their own component (`Isles`), mounted in their own Suspense only while seated; the staff mount only within 40 m (unmount past 44), and the carried geta is cleared when the server unmounts.
5. **Allocations:** `barSeat` returns null beyond `BAR_REACH` 8 before anything else; `stoolAt`, the entrance check and `servedAt` are loops on a reused local point; SushiBar's frame has no closures: the geta instances are written only when the served set changes or one is carried, the prep counts only on change, the seated view only when the stool changes, the pools' gain without traverse.
6. **Sunk seated guests:** PlayerAvatar's seat lift is from the floor the avatar is drawn at (`WATER_DROP` under the ground over water: measured at a stool, ground = top = -1.375, wet). No puff and no sit note for a hidden avatar. Also: a remote stool sitter's nameplate hung at the sea floor (Nameplates `plateY` seated used groundY alone): a seat lift above a bench's (SIT_DROP 0.34) now raises it; bench plates unchanged.
7. **Overview while seated:** IslandAtmosphere blends the overview after the seat's view, so it wins.

Dev only, for the evidence: `?bots=N&botbar=1` sits the first two bots side by side at the bar (botBrain `sitBar`, the same lift as PlayerAvatar; loopback `bar`, netStore). shoot.mjs views `pair-outside`, `pair-seat` (bots; you take the next stool beside them), `seat-overview`, option `bots`, `overview`; it logs `window.__net.remotes()` for bot views.

Shots `specs/evidence/sushi-bar/ship/`: bar-night, seat-night, pair-outside (two bots seated side by side, plates over their heads), pair-seat (seated beside them, the isles out the window), seat-overview.

**Gates (39cfad42):** tsc clean; eslint clean on all 29 TS files changed against main; vitest 3450 pass with and without `NEXT_PUBLIC_GAME_WORLD=new` (budget.test included). Perf A/B against main 1877dcb5, `specs/perf/ab.sh` 2 interleaved rounds, v2: high 5.0 to 5.1 ms median vs 4.9 to 5.0, 428 to 431 draws vs 418, 1.405M tris vs 1.389M; lite 3.3 to 3.4 ms vs 3.2 to 3.3, 358 to 360 draws vs 349 to 351, 1.189M vs 1.175M. That is the whole lane against main (main has only round 1's bar).

**Open after ship:**
- A remote stool sitter's click target (RemoteAvatar's hit capsule, on the anchor at the sea floor) stays below the deck: clicking them for their card misses.
- The local avatar's own nameplate and head anchor when seated still use the ground (hidden on stools, so unseen).
- The server's name; the chef's head hides some of his hands from the middle stools; served geta in a fixed stool order; phase B.


**Phase A round 3 built, 2026-10-26** (branch game/sushi-bar; game/terrain-v3 be72c7e1 merged in first at 605b0d5c, then c463da70 and b9f9ead9). Shots `specs/evidence/sushi-bar/phase-a3/`: bar-day, bar-night and approach-night (both with `?tradition=none`), entrance (the roof's corners and their lanterns), seat-evening with -left and -right, seat-night with -left and -right (traditions off), food (seated, a served geta before you); Blender renders model-corner (a roof corner close up), model-food (the served geta close up), model-case, model-isles, model-front; the staff's clips staff-slice-shape and staff-serve (the knife in hand while slicing), and staff-at-work (24 seated frames 1.6 s apart).

1. **The roof** (`roof_pt`, `corner`): the corners turn up further and sooner (SORI 0.62 from SORI_FROM 2.4, kicked out a little), the tile bed finer toward the ends; the ridge sweeps up at its ends (RIDGE_CURL) under a golden shachihoko each (`shachihoko`, P_Metal: head down on the ridge facing out, arched body, tail fanned high, crest, fins, eyes, barbels); a red lantern hangs under each of the four roof corners on an iron hook (glow model, `CORNERS`).
2. **The beach lanterns are gone** (generate.ts: the lantern post and six hand lanterns; SUSHI_WAY keeps only the unpainted ease of the sand down to the boardwalk). The pier's own lantern posts stay.
3. **Night without Halloween:** night shots take `?tradition=none` (dev only, useTraditions parseTraditionOverride; shoot.mjs `calm`). What Halloween adds on a fog night (lib/game/halloween.ts fogNightLight, Halloween.tsx): the fog colour pulled 60% toward #3d4a5e, fog near x0.45 and far x0.6 (it closes in), the moon colder and x0.85, and low mist banks (MistBanks, opacity 0.3); players keep it unchanged.
4. **Close-up quality** (`art/buildings/sushi_food.py`, used by the builder): nigiri (rice pillow, a draped slice with thickness: tuna, salmon with white fat lines, shrimp with red bands and a tail, tamago with its nori band), maki showing rice and filling, ginger, wasabi, the geta; the fish case remade (steel tray, crushed ice, slanted glass, hinoki ends, a serving shelf over its back half, saku of tuna, salmon and yellowtail, a sea bream, cooked shrimp, shiso, lemon); the boards (a saku with three slices cut, knife marks), the rice tub with copper hoops, the hand-water bowl, a cloth; at each place a yunomi, a soy dish, chopsticks on a rest and a menu stand; sake bottles with shoulders, foil caps, labels and marks; menu tags with dark rims, ink strokes and red seals on cords; a calico lucky cat on a cushion with a koban; the fish tank (rock arch, brain and branching coral, weed, bubbles, fish with tails and fins); bamboo with nodes and leaf sprays.
5. **Cooking movements** (`build_clips.py -- staff` writes `base/v8_staff.glb` and the catalogue's `staff` section, synced by sync-character-assets; Character `clips` loads it like the verb library): SushiSlice (the left hand steadies the block, the knife drawn back its whole length through it, lifted, the slice laid aside: the knife's own grip, Character USE_GRIPS SushiSlice, solved by `art/buildings/render_sushi_staff.py`), SushiShape (rice from the tub at his right, pressed twice in his cupped hand, a slice laid on and pinched, set on the geta at his left), SushiServe (a two-handed reach across the counter). The choreography is all on the world clock (lib/game/sushiBar.ts): the chef slices then makes four nigiri at each board in turn (CHEF_STATIONS, CHEF_LOOP 31.3 s; `prepAt` shows them one by one on prep-<board>); the server's round of three chef loops (`SERVER`) takes each full geta while the chef is at his other board, carries it along a lane at the back of the kitchen (HoldFront), slides it onto the shelf before a stool (`servedAt`; middle stools first), eaten after EAT_S 40 s. Served and carried geta are one instanced model (`sushi-bar-geta.glb`, 1.5k tris, 3 draws while any shows). The chefs stand at the ledge now (AT_BOARD -0.02), the boards, tubs and geta placed to their reach.
6. **The islands** (`isles`, `stack`): limestone stacks in five fluted tiers, undercut at the waterline, ledges with trees, green tops with a palm; a long island with a lighthouse; a sandy islet with a stilt hut and palms; a red torii on its rock.
7. **Phase B's chef quests**: a TODO line in specs/launch/sushi-bar.md, no code.

**Models:** sushi-bar 24.9k tris (budget row raised to 25k: the close view), glow 8.3k (+1.4k: corner lanterns), pier 5.2k, hours 2.75k (prep nigiri, prep-geta-<i>), isles 7.6k (only while seated), geta 1.5k (instanced), sushi-knife 80. PROP_TOP sushi-bar 6.543 (the ridge fish).

**Gates (b9f9ead9):** tsc clean; eslint clean on changed files; vitest default village 3444 pass; with `NEXT_PUBLIC_GAME_WORLD=new` all pass but `app/api/collections/route.test.ts` (21, as before). perf:check SCENES=v2, A/B against 605b0d5c (terrain-v3 merged, before round 3), TOLERANCE 10 so no reruns: high 5.2 ms vs 5.1, 404 draws vs 402, 1.399M tris vs 1.390M; lite 3.4 ms vs 3.3, 333 vs 331, 1.184M vs 1.172M. Both still over the 2026-10-14 baseline on draws and triangles (the new world's own growth).

**Open:**
- The server's name: still pending from David.
- The chef's big head hides some of his hands from the middle stools when he leans in; his hands read best from the stools beside his board.
- The served geta goes to stools in a fixed order on the world clock, not to whoever sits (ordering is phase B).
- terrain-v3's worktree left a `next start -p 3158` running (pid 51415) with no lock; this lane's perf check ran on port 3177 to avoid it.
- Phase B (menu, ordering, buffs, quests from the chef, photos) after launch.

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

Nothing until the coordinator's merge and David's review. Then the open items above, or phase B when David starts it.

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
- **Shots:** `shoot.mjs` views `turn` (look round from the stool, radians, + left), `tilt` (+ down), `wait` (ms more before the shot), `served` (wait for a served geta before that stool: the round's numbers are copied from sushiBar.ts SERVER, update them if the stations change), `calm` (`?tradition=none`, the night without Halloween's fog).
- **Staff clips:** `Blender -b --factory-startup -P art/characters/base/build_clips.py -- staff` writes art/characters/base/v8_staff.glb and the catalogue's `staff` section; then `node web/scripts/sync-character-assets.mjs` (it also rewrites decal_tsi_mark.png and hair_colour_world.png byte-wise: check them out again). `render_sushi_staff.py -- <dir>` solves the knife's grip (GRIPS) and renders the clips. Their names are in clips.ts VillageClip and FAMILY; cafe.ts OwnerClip; loops held as poses.
- **The builder and the food:** `art/buildings/sushi_food.py` (nigiri, maki, geta, saku, tableware); a nigiri's pieces on a prep geta must all be one kind (setOut's draw range assumes equal pieces). The builder writes seven GLBs now (sushi-bar-geta too). Don't reuse SHELF_Y (the bottle shelf): the serving shelf is SERVE_*.
- **perf:check:** deletes web/.next when it ends, so each run needs its own measure-build; TOLERANCE=10 skips the reruns; PORT other than 3158 if another lane's `next start` holds it.
- **Stool sitters to test against:** `?bots=2&botbar=1` (dev) seats two bots at the bar; `window.__net.remotes()` lists them with their tier and y.
- **perf A/B:** build HEAD with measure-build.sh, move web/.next to `.perf-builds/.next-after`, `git checkout --detach origin/main`, build again to `.next-before`, check the branch out again, then `PORT=3177 TIER=high sh specs/perf/ab.sh 2 v2 .perf-builds/high` under the devserver lock (OUT is relative to the worktree root). Delete `.perf-builds` after.
- **Big props and the walker's buckets:** `islandOf` buckets props by their centre (4 u buckets, +-1 searched), so a footprint half over 4 is missed at its ends: keep the core at hw 4.
