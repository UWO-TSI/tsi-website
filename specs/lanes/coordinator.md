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

## Production flipped to the new world (2026-10-26 evening, David's request)

David asked for the current version on play.tethos.ca so he could test multiplayer from another computer ("nobody playing rn so its fine"). Set in Vercel Production:
- `NEXT_PUBLIC_GAME_WORLD=new`;
- `NEXT_PUBLIC_MEMBER_WORLD=open`, which opens the member world to every member early. Keep it until he says to close it again. To undo: `vercel env rm <name> production` and redeploy.

Main holds:
- R2d, R2e (with the flock fixes) and R2f;
- launch-check: gather nodes (rocks, shell dig spots) and the collections test made world-aware;
- world-fixes: the river fishes as river, and bottle spots.

Production deploy 1877dcb5 (Ready). The two-account test on play.tethos.ca against prod Fly v7 passed: day 35/36 (the miss was a real player, "Islander", in the Here count) and night 22/22. Cleanup is proven (`specs/evidence/launch-check/`).

The sushi bar is merged (e9cf4857, phase A with the ship-readiness fixes; 3450 tests green on both worlds) and deployed after the test run. Before that, it was held back: the pre-production review found a world-data merge clash with the gather nodes, a two-players-one-stool bug, a stool claim leak, eager loads and per-frame allocations. The sushi-bar lane is fixing these; then merge and deploy. The sushi bar isn't merged yet; round 3 is still running. The realtime server needs no change (v7; no protocol changes).

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
  - **perf-newworld done** (2b28dd51), merged into terrain-v3 next.
    - **Now (load 5):** v2 High 5.2 ms / 384 draws against the village's 4.9 / 374. At a quiet load, about 4.6 to 4.8 is expected.
    - **What changed:** contacts once a frame and as matrices; byte-identical textures merged across GLBs; houses merged across colourways; caster-only hulls out of the main pass; lamp pool cut to 4 lights (David's pick: 4 real lights plus ground glow).
    - **Village check:** these changes touch the village too, so terrain-v3 takes village shots after the merge.
    - **Still failing:** budget.test on the jetty and plaza tiles (terrain-v3 is fixing it), and perf:check on v2 Lite triangles (969k against 950k).
  - **Art lanes:** wharf-art2 (0ee8bd95), village-art2 (8608aec7) and the sushi-bar model (f7fbca92) are all relayed to terrain-v3.
  - **R2d built** (7aee495b on game/terrain-v3; all art merged, including wharf-art3's sell stall and perf-newworld). Review page: https://claude.ai/artifact/UdD2So4dkLxzTX2NLqy1qy (collection `approvals`, 19 items, not watched).
    - **Village check:** same by eye (`r2d/village-check/`). budget.test passes.
    - **Running now:** a perf re-measure (the perf-newworld lane, after merging 7aee495b) and a ponytail review of the whole terrain-v3 diff against main.
    - **Merge to main after:** David's R2d notes, the perf result and the review fixes.
    - **Open from the lane:**
      - the seabed's tall boulder_c rocks stick out of the wider shallows (shared code, so left alone);
      - no per-tree tint in the forest.
  - **R2d reviewed (2026-10-26).**
    - **Approved:** the arrival, the docks, the path, the shallows, the night views.
    - **Redos** (verbatim in `specs/lanes/terrain-v3.md`):
      - the fish market to the north end as the main building, the ship houses replaced by a tackle shop and a shipwright with a floating boat;
      - fewer palms on the wharf and a path to the beach;
      - waves that break on the shore;
      - crabs and shells;
      - the brick roads removed and the grass updated;
      - bigger river trees, more forest tree models with tint.
    - **Ponytail review:** merge-safe once the fixes are in.
      - **Before merge:** delete the jetty preload in Wharf.tsx (the village was downloading jetty.glb); drop the sushi glow export; ContactShadows `shown` before the multiply.
      - **Cheap extras sent too:** the merge key keeps castShadow, fireflies capped, AmbientProps per-frame allocations, SellSheet keys, mapHealth wharfDecks.
  - **R2d merged to main as 2241eca2** (via perf-newworld cde23580: the review fixes plus lamps merged across kinds).
    - **Perf, same session:** v2 High 5.6 ms / 405 draws against the village's 5.5 / 374; Lite 3.7 against 3.3.
    - **Tests:** 2213 game tests on both worlds; full suite 3432 passing. cells.test only times out under load and passes at 30 s.
    - **Next:** terrain-v3 R2e merges perf-newworld.
  - **Release candidate (done) = game/perf-newworld:** R2d 7aee495b, plus the perf re-measure, plus the review fixes. It merges to main when the perf lane reports. terrain-v3 R2e then merges it.
  - **Running:** terrain-v3 R2e (from d258b30c), wharf-art4 (tackle shop, shipwright, crab), trees-art (forest and river trees), sushi-bar phase A, perf-newworld.
  - **Music:** David's Suno "Smoky Night Groove" is going in as bar-night.mp3 through the sushi lane; the evening track is being redone.
  - **R2e reviewed (2026-10-26):** mostly approved.
    - **Redos:** palms closer to the grass; no wharf-to-beach path; the plaza's centre lit at night with the fountain; the fish market wider with a proper bursting swordfish; the shipwright as a big docked ship; the river trees remodelled.
    - **Lanes:** art-r2f (market, ship, river trees) and terrain-v3 R2f (from 4cd9604d).
    - **Merge:** R2e goes to main through perf-newworld after its re-measure. The perf lane is merging 55e48459 and trying to instance the bugs.
    - **After launch** (in `specs/launch/terrain-v3.md`): 2v2 volleyball, the shipwright's ship inside, the shop interiors, sushi phase B.
  - **Sushi bar phase A round 2** (lane restarted from 57e7f47c):
    - Japanese building and lanterns;
    - path and rocks removed;
    - chefs visibly preparing food;
    - wider view with look-around;
    - distant islands;
    - better decor.

    The server's name is still pending from David.
  - **Sushi bar phase A built** (2a7c87cb on game/sushi-bar, not merged). Review page: https://claude.ai/artifact/Xh3WqWHGxrB5z1a5xjSAKJ (collection `approvals`, 9 items).
    - **What's built:**
      - on stilts at (-47, 119.5), west beach, with a path and lanterns;
      - closed by day; open evening and night;
      - E glides into first person at 6 claimed stools;
      - the chef Bancha and a diver server (name pending from David);
      - bar-evening.mp3 (海辺の夕食) and bar-night.mp3 (Smoky Night Groove), looped by art/audio/loop_track.py.
    - **Open:** dim from afar at night; no afro or dive mask in the catalogue.
  - **Known test gap on main:** `app/api/collections/route.test.ts` fails 21 tests with NEXT_PUBLIC_GAME_WORLD=new (it posts village coordinates). It fails on main too. Fix it, and check collecting in the new world, before the switch flips.
  - **Sushi bar planned** (2026-10-26, all "Nice to have" for Oct 31): `specs/launch/sushi-bar.md`.
    - **Phase A, the place:**
      - stilts over the water on the west of the beach;
      - closed by day; open in the evening and at night;
      - E moves the camera smoothly into first person at one of 6 seats;
      - a chef and a server of our own design, in the spirit of his Dave the Diver refs;
      - music slots for his Suno tracks.

      Lane `sushi-bar` is restarted on it.
    - **Phase B (after launch):** ordering, buffs, legendary-fish dishes, the chef's fishing orders.
    - **Open with David:** the server's name, and whether "left" means west.
  - **wharf-art3** (sell stall from his FISK and Coco Loco refs, replacing `sell-barrel` under the same name) is running.
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
