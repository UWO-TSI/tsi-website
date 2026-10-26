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

Wait for the coordinator's plan (David is planning the bar with them). The original list:

**References:** `specs/references/terrain/sushi-bar-2026-10-26/` (README with David's words, `bar-day.jpg`, `bar-evening.jpg`) and the earlier `plan-2026-10-23/wharf-sharkbar.jpg`. David's words: "a long horizontal bar ... really big open bar where you can sit down and it changes camera anger to more first person, it has festive lighting inside, it back of the bar is open window to see beatiful view in the back, 1-2 sushi npc making sushi ... re modeled in blender properly and it needs to looks visually stunning", and "good decore, speaker with music, lights and fishtank".

1. **The model** (replace `sushi-bar`, only the new world uses it):
   - a long, open bar on the beach by the wharf, in the wharf's wood and rope;
   - a long counter with stools along it;
   - sake bottles along the top beam;
   - speakers at the corners;
   - a wide open window behind the bar framing the sea;
   - round paper lanterns and string lights, red drapes, a big fan;
   - a neon sign (no real brand names; your own wording or a symbol);
   - a fish tank;
   - a menu board.

   Visually stunning, but within budget. Report its footprint and front early (one message), so terrain-v3 can make room on the beach.
2. **Its lights:** the lanterns and neon glow at night (`NEW_LAMPS` or emissive, cheaply), so it reads festive.
3. **Sitting:** the stools are seats. Reuse the café's seating (`components/game/study/StudySeats.tsx`, `interiorShared.tsx`). When a player sits, the camera moves to a lower, closer, almost first-person view across the counter toward the window. Reuse any seat-camera code first.
4. **Chefs:** one or two sushi chef NPCs behind the counter, working (an idle or prep loop). Use the existing NPC or resident system (`components/game/NPC.tsx`) and existing outfits; no real names.
5. **Music:** soft music from the speakers when you're near or seated (`web/public/assets/audio/music/`, the game's existing audio code), respecting the game's sound settings.
6. **Placement:** terrain-v3 places the model. You may set it on the beach yourself in `generate.ts` only if terrain-v3 has said it's done; otherwise give the position you want.

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
