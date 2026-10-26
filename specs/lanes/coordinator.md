# Coordinator handoff

For the next coordinator session. Start fresh from this file, `STATE.md` and the lane files beside it. Don't start from old chat history.

## Who does what

- **The coordinator:**
  - runs the lanes as background agents, one worktree each, under `.claude/worktrees/`;
  - publishes every visual change to David as a review page with Approve/Redo and a note per item;
  - reads his decisions back;
  - merges approved work into `feat/game-default-island` and pushes it to main;
  - applies prod migrations.
- **Lanes:** never push and never talk to David.
- **Restarting lanes:** done automatically, fresh from their file in `specs/lanes/`, when a lane has run for hours, its context is huge, or it's idle after a review (David, 2026-10-18).

## Helpers

All in `~/.claude/jobs/62203045/tmp/`, which survives reboots.

- `push-main.sh`: fetches, refuses if origin moved, runs tsc if `web/` TS changed, then pushes feat and main.
- `build-approvals.py out.html "Title" items.json`:
  - each item is `{id, label, facts, img}`, where `img` is a local webp, png or jpg path;
  - it uses `approve-template.html` and stores decisions in the `approvals` collection;
  - publish with `capabilities: {"db": {}}`, then read the decisions with ArtifactData `list approvals`.
- `prod-dump.sh <label>`, `prod-query.sh <sql>` and `verify.sql` are for prod migrations. The procedure is in `STATE.md` and the memory files.
- `withlock.sh heavy|blender|devserver <cmd>` (set `LANE=game/<lane>`): takes a lock, waiting while swap is high and another lock is held. It lives in `~/.claude/jobs/62203045/tmp/`, the same folder as the helpers above, and is referenced from `specs/lane-rules.md`.

## Now (2026-10-25): v1 launches on the NEW world (row 318)

Read `specs/launch/v1-new-world.md` first, then `specs/launch/terrain-v3.md`. The launch is Oct 31, go/no-go Oct 28, and the village stays as the fallback behind the world switch (`NEXT_PUBLIC_GAME_WORLD=new`, merged; realtime v7 deployed).

- **David answered the terrain plan** (all 11 sections, 2026-10-23): https://claude.ai/artifact/J6fE1DjDqxt732R8JPvpxs, collection `sections`. His answers, verbatim, and the build are in `specs/launch/terrain-v3.md`; his 20 references are in `specs/references/terrain/plan-2026-10-23/`. Open on Oct 31: the wharf, the west beach and the village. Everything else stays visible but closed naturally (broken bridges, landslides, a guard). He said cut nothing, so the work is ordered, not cut.
- **Lane `terrain-v3`** (`game/terrain-v3`), running: ponytail fixes done, now R1c then R2, one review for both.
  - **R1** (e8675d5e): David redid every item on 2026-10-24.
  - **R1b merged** (cbf729af, with the ponytail fixes 2e9ae1bf): David approved it 2026-10-25 ("terrain approved read feedback") with notes on the review page https://claude.ai/artifact/GEg5mHuG6ACN95UdZiLJou (collection `approvals`). It holds:
    - a compact map; deck 1, quay 2, village 3; a bigger plaza with the buildings moved; the mountain moved in;
    - the meadow at village level behind an invisible border that reads "This area is releasing soon." (`barriers.ts` model `border`, `BorderNotice.tsx`, drop feature `meadow`).
  - **R1c** (David's R1b notes, verbatim with my reading in `specs/lanes/terrain-v3.md`): the map very slightly longer (he clarified "the cut" is the horizontal band taken out to shorten it); one bigger islet with small ones close by; the wharf half to two thirds as deep and slightly shorter; the path way shorter so the village sits by the wharf; the beach tapering into the wharf; a more gradual forest.
  - **R2** straight after, on the R1c ground: plank flooring and the fish market, the jetty at 1 with ladders, stairs, fences, lamps, houses in the plaza gaps, the campfire, chairs and palms, broken bridges and rockfall, the lighthouse.
  - **R1c + R2** (e11d0444, not merged) reviewed 2026-10-26 on https://claude.ai/artifact/5mbexjtNp5WJrTsWibqmmJ: map, houses, meadow, mountain, north approved; 11 redos. His notes verbatim and my reading are in `specs/lanes/terrain-v3.md`. Main points: the wharf as a built deck (bigger boards, pilings into the water, ladders, rope fencing in places), the dock wider with three entrances and a lower boat level, grass at the boards' level behind them (no stone step), plaza buildings 15% bigger on a tiled floor, the far river bank 1 to 2 u lower, the campfire filled out, the forest dense but cheap, and every new 3D asset modelled in Blender.
  - **Two lanes now:** `terrain-v3` (R2b landform and layout, then R3 and the perf run) and `terrain-art` (`game/terrain-art`, cut from e8df02aa; the Blender assets: wharf kit, palms, lamps, campfire set, forest masses; `specs/lanes/terrain-art.md`). When terrain-art reports a batch, tell terrain-v3 to `git merge game/terrain-art` at that commit.
  - **References (2026-10-26):** David sent 16 pictures and notes in chat, not on the upload page. They're saved with his words verbatim and my reading in `specs/references/terrain/r2-2026-10-26/README.md`. They cover:
    - the plaza: a fountain, flags and banners, lively stalls;
    - the path: curving yellow dirt, loose fencing, rocks, bushes, lamps and hand lanterns;
    - the palms;
    - the lamps;
    - the dock decor;
    - the beach: a sushi bar, a lifeguard tower, surfboards, coral, a wadeable shore, a wavy sand-to-grass edge;
    - nature everywhere, lush.
  - **Two more art lanes**, cut from game/terrain-art ec364e38:
    - `wharf-art`: palms redone, dock decor, the beach set;
    - `village-art`: lamps and hand lanterns, the fountain, the plaza decor, the path and nature pieces.

    terrain-v3 stops after its R2b renders. Its next round (R2c) starts fresh with these notes and merges all the art branches.
  - **R2b built** (a9da52b0 on game/terrain-v3, includes terrain-art ec364e38): grass band at the boards' level, the new Blender dock (three gangways, boat landing at 0), deck tiles with pilings, the tiled plaza, buildings 1.32 and houses 1.15, the river bank 1.5 lower, the campfire set, 23 forest masses. Review page: https://claude.ai/artifact/TE3dCaECrP8qUTBTHyxUZz (collection `approvals`, 13 items, not watched). No perf run yet; it adds draws.
  - **R2b reviewed 2026-10-26:**
    - **Approved:** the map's size, the dock model, the deck's edge.
    - **Redos** (verbatim in `specs/lanes/terrain-v3.md`):
      - three docks joined at sea level;
      - wavier water;
      - no deck hovering over sand;
      - the fish market modelled (his earlier `wharf-fishing-hut-1.jpg`);
      - night brighter and warmer, not spooky;
      - the path yellower with pebbles, fencing further up with bushes, more lamps;
      - plaza tiles lighter, houses closer, the fog less spooky;
      - palms back toward the old low-poly leaves, with scaly trunks;
      - more lanterns at the campfire;
      - forest trees varied and grounded;
      - the river's far bank gentle.
  - **R2c running** (terrain-v3, fresh from 4403efa4): those notes plus the 2026-10-26 references, merging wharf-art and village-art as their batches land, with the perf run this round.
    - **wharf-art's queue:** dock decor, palms again, the beach set with the sushi bar from `wharf-sharkbar.jpg`, the fish market.
    - **village-art's queue:** the path and nature set, then forest masses remodelled.
    - **When either reports a batch:** tell terrain-v3 to merge it.
  - **R2c built** (76f4b591 on game/terrain-v3; all art merged: village-art 7bdb2e75, wharf-art c951d6eb). Review page: https://claude.ai/artifact/2WJiN8D8WAQF22E9CL1pPu (collection `approvals`, 17 items). Not merged.
  - **Perf fails, the launch blocker.** v2 High is 20.7 ms (CPU 16.5) with 425 draws, against a budget of 4.8 ms and 222, and a village baseline of 5.4 ms and 254. Lite is 8.4 ms with 342 draws. Both were measured at load 3.
    - The lane `perf-newworld` (game/perf-newworld, cut from 76f4b591, `specs/lanes/perf-newworld.md`) is cutting it.
    - David's R2c notes go to terrain-v3 on its own branch.
    - Merge order: perf into terrain-v3, then one ponytail review of the whole terrain-v3 diff, then merge to main.
  - **Perf, measured side by side:** v2 High 6.1 ms and 430 draws against the village's 4.6 ms and 384. Lite 3.75 ms against 2.8. The 20.7 ms was load. perf-newworld keeps cutting.
  - **R2c reviewed 2026-10-26:**
    - **Approved:** the map, the water edge, the wharf, the path at night.
    - **Redos:** verbatim in `specs/lanes/terrain-v3.md`. Sushi bar refs are in `specs/references/terrain/sushi-bar-2026-10-26/`.
  - **Five lanes now:**
    - **terrain-v3 R2d** (from c13ea8e7):
      - docks spread out and bigger, fewer pumpkins, warmer and wider light;
      - brick roads, buildings closer;
      - bigger wading area and palms, the campfire 1.15, fish in the shallows;
      - the forest as instanced single trees;
      - the quick-sell barrel on the existing sell flow.
    - **perf-newworld.**
    - **wharf-art2:** fish market remodel and sell barrel, ship houses, taller lifeguard tower, beach things, coral reefs.
    - **village-art2:** organic rocks, fluffy bushes, TSI flag, brick texture, river dressing, forest trees.
    - **sushi-bar:** Bancho-style long bar, its lights, seating with a close camera, chef NPCs, music.

    All are cut from terrain-v3. Relay each art batch to terrain-v3, and merge perf into terrain-v3 when it's done.
  - **Sushi bar paused for planning** (David, 2026-10-26: "Plan it with me first"). It's built up to 145642d5 on game/sushi-bar, not merged:
    - the model, its glow and lights;
    - stool seating with the close camera;
    - two chefs;
    - a "bar" music slot.

    The lane is taking in-game shots, then stopping. Plan page: https://claude.ai/artifact/QddVeVSPgcEZRZEBgYJAjm (collection `sections`, 6 sections, uploads on). Read his answers there, then restart the lane from them.
  - **After launch (David's words):** the fish market inside (buy shop, appraisal) and the fog's horror look.
  - **Post-launch:** the building redesign (he wants less medieval, more fun; it "needs more planning"), the lighting pass and the dungeon lamps. Logged in `specs/launch/terrain-v3.md`.
- **HQ round 4 merged** (71135930, David approved all four items 2026-10-23), with the ponytail cleanup. Later items are logged as A14. `hq-notice-board.glb` is no longer rendered but is still in the propModels table; delete both together after launch.
- **Upper-floor fix merged** (72a9b9c5). Remote players in rooms stand at the height they sent, with no realtime deploy needed.
- **Still open:** the shop is offline for multiplayer (`netReady = inside !== "shop"`, DefaultIslandWorld.tsx:722), so players in the shop vanish for others.
- **Waiting on David:**
  - the speed-test quiet window (script on `game/perf-v1`: `specs/perf/window-ab.sh`);
  - the editor session after R2 (resident anchors, gather and bug spots, mailbox, boards);
  - the play-through with a friend;
  - the MacBook Air check.

## Merge check: ponytail

Before merging a lane branch that adds more than about 300 lines of code, run a read-only ponytail review of its diff. Use an Explore agent: `git diff main...<branch> -- web realtime`, judged against `~/.claude/skills/ponytail/SKILL.md`. It looks for:
- duplicates of existing code;
- dead code left behind;
- unrequested abstractions;
- new dependencies.

Fix what's cheap before the merge, and log the rest in the current ponytail audit (`specs/ponytail-audit-*.md`). The codebase audit runs as its own lane (`specs/lanes/ponytail.md`).

## Waiting on David

- **Merch:** close-ups of the lanyard's snap hook (face-on and side-on) and the D-ring, and a recording of the keychain click.
- **Yearly flag designs:** for the HQ banners.
- **Stock limits** for the merch, if any.
- **The Roblox Studio attachment values,** from the Lua script; the hats are estimates until then.
- **Photos of real tees and prints** for the shop pegboard's stand-ins.
- **Writing only he does:** Bram's and Wren's lines, and the Founder's plaque text.
- **Building exteriors:** remodelled later. HQ's outside stays as it is for now.
- **Profile customisation price:** 5,000 gems, flagged as high.

## Queued after today

- Fallen leaf piles under trees.
- One combined perf:check on a quiet machine, then a baseline refresh.
- The MacBook Air speed check, at the very end.

## Standing rules (short)

The full set is in `CLAUDE.md`, `specs/lane-rules.md` and the memory files.

- Never reveal the gem rate anywhere public. The repo is public; specs carry gem prices only.
- Never open windows, apps or tabs on David's screen. Never use the Playwright MCP.
- David supplies every art reference.
- Real names never show.
- Never edit applied migrations.
- Stop for anything destructive, costing money or irreversible. Otherwise merge and deploy verified, approved work without asking.
- No idle polling.
