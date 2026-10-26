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

Steps 1 to 5 built; terrain-v3 placed the bar at (44, 96.5), yaw -3pi/4 (merged into this branch at 32cd7cb3). Paused 2026-10-26: David is planning the bar with the coordinator; change nothing until the plan comes. In-game shots `specs/evidence/sushi-bar/ingame/` (bar-front, bar-front-night, bar-chefs, bar-seat, bar-seat-night).

1. **The model** (f7fbca92, `art/buildings/build_sushi_bar.py`): `sushi-bar.glb` (11.3k tris, 7 materials; still, merged) and `sushi-bar-glow.glb` (3.3k tris, M_Glow palette + P_Paint; drawn by `SushiBar.tsx`). About 9.2 by 6.1, origin at the middle of the solid core, footprint [4.0, 1.5], top 4.68; guests' deck and six stools toward +z, the open window toward -z (the sea). The old shark head is deleted from `art/props/build_beach_set.py`. Preview `specs/evidence/sushi-bar/sushi-bar.webp`.
2. **Lights:** the glow model eases on at night and breathes like flame; HQ's faked pools (`hq/LampPools`, `BAR_POOLS` in `lib/game/sushiBar.ts`) light the deck, counter, kitchen, bottles and pillars; the bar's light is one of the LampPool's points (`BAR_LIGHT`); warm strips under the shelf, the counter lip and the fish case.
3. **Sitting:** the stools are seats (`barSeat`, prompt "Sit at the counter", claim key `sushi:<id>#i`); while seated the follow camera eases to `seatView` (FollowScene `seat`).
4. **Chefs:** two, the café owner's station loop (`CHEF_STATIONS`, `CHEF_LOOKS`), no names.
5. **Music:** near the bar (8 in, 10 out) the music director's "bar" slot: `bar.mp3` when it lands, else the other fallback track. Not heard (headless, muted).

**Open, seen in the in-game shots:**
- The seated view: the player's own head fills the lower left and the window shows mostly sky (the sea sits under the back counter's line). The eye needs to move up and aside, or the avatar hidden while seated, and the look lowered to the horizon.
- The chefs read from behind in `bar-chefs` (hair toward the guests): their facing (CHEF_STATIONS yaw 0 at the fish case) may need a half turn; check the rig's yaw convention.
- At night the inside is warm and bright from the pools and strips; from the beach the bar reads lit but the deck could use more spill onto the sand in front.
- `budget.test` fails on `game/props/plaza-tiles.glb` (5640 tris, another lane's), so the sushi files were checked by their numbers only (11.3k and 3.3k tris, under the 12k building row).
- `art/props/build_beach_set.py`: with the shark head removed its rng runs differently, so a rerun reshapes the corals slightly.

## Next

**Phase A of `specs/launch/sushi-bar.md`** (David's plan, 2026-10-26, verbatim there). Read the spec first. Phase B (ordering, buffs, quests) is after launch: don't build it.

1. **Move it onto stilts over the water, toward the left (west) side of the beach**, with a short boardwalk from the sand to the entrance. Add to the outside: a sign, a "today's menu" board, lanterns and a clear entrance. You own the bar's placement in `generate.ts` (the sushi-bar object only, plus its boardwalk). terrain-v3 is editing the same file, so keep your change to those objects and say so in your report.
2. **Hours:**
   - By day it's closed: shutters or a curtain down, and the chef stands outside the entrance.
   - It opens in the evening; at night the lights and music feel more like a bar.
   - Use the game's clock and the music director's slots: an evening "dinner" track and a night "bar" track.
3. **Entering:**
   - When it's open, E at the entrance moves the camera smoothly, never through a black screen, into first person at a free stool.
   - Six seats with network claims (you have `sushi:<id>#i`), so friends sit side by side. Stay as long as you like; E leaves.
   - In first person, hide your own avatar, and look level across the counter at the chef working, with the sea through the window behind him.
   - That fixes both issues from your shots: your head blocking the view, and the window showing only sky.
4. **Inside:** sake, paper lanterns, drapes, posters and the fish tank on the side, cozy and warm. Most of it exists already; fill what's missing.
5. **Staff:** a sushi chef and a server, both our own designs in the spirit of David's references (`staff-chef-ref.jpg`, `staff-server-ref.jpg`), not copies of Dave the Diver's Bancho and Dave.
   - **The chef:** a Black man, cool and focused, working behind the counter facing the guests (fix the half-turn). He talks rarely.
   - **The server:** a cheerful diver type, moving along the counter.

   Names: the chef "Bancha" as David wrote it, and the server's name left for David. Use existing outfits and parts where you can.
6. **Music:** the evening and night slots point at `bar-evening.mp3` and `bar-night.mp3`, for David's Suno tracks, and fall back to the existing tracks until those exist.
7. **Shots and report:**
   - In-game shots into `specs/evidence/sushi-bar/phase-a/`: the bar by day (closed), at evening, at night, the entry transition (2 or 3 frames), and the first-person view at night.
   - Commit, update Status, then SendMessage "main" and stop.

## Tools and gotchas

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script> [-- args]` under `sushi-bar=game/sushi-bar /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`. Never open the Blender app, and never use the `blender` MCP tools: they drive David's visible Blender.
- **Locks:** `withlock.sh heavy <cmd>` for vitest and tsc. If swap is over 9 GB, wait before taking the Blender lock. Other lanes are running (terrain-v3, perf-newworld and two more art lanes), so expect waits.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **node_modules:** cloned (`cp -c -R`).
- **propModels.ts:** other lanes append to the same tables. Add your entries in one block with a comment line naming your lane.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees.
- **Builder:** `withlock.sh blender .../Blender -b --factory-startup -P art/buildings/build_sushi_bar.py [-- review <dir>]` writes both GLBs; review renders front, back, stool view, and night (glow on, no lights).
- **Shots:** `PORT=3175 node specs/evidence/sushi-bar/shoot.mjs <dir> [view,...]` (headless, muted; `sit` presses E by a stool). Dev server on 3175 with `NEXT_PUBLIC_GAME_WORLD=new`, Supabase blanked, under the devserver lock.
- **Big props and the walker's buckets:** `islandOf` buckets props by their centre (4 u buckets, +-1 searched), so a footprint half over 4 is missed at its ends: keep the core at hw 4.
