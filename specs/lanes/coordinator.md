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

## Editors published (2026-10-27 evening)

- **Residents:** https://claude.ai/artifact/QtZYAgMFEbFg4YNpVcBYwU (game/npc-editor cd1c64eb, collection `residents`). Apply: `cd web && node scripts/apply-residents.mjs <export.json>`. It writes the TS, runs gen-seeds (a new migration for npc_personas) and lists old-name strings to reword by hand. Looks come only from `RESIDENT_LOOKS` in code.
- **Catalogue:** https://claude.ai/artifact/5XzAaR5Wipoe2ZN2Hby3FG (game/catalogue-editor 49d0a386, collection `species`). Apply: `cd web && node scripts/apply-species.mjs <export.json> [--dry]`. It needs migration `20261027180000_species_sell_price.sql` on prod (sell_price column plus economy_sell) when the branch merges. The branch also makes fishing read the roster (the duplicate fish data is deleted).
- Face Fit's check showed burst-save count flakes under swap after npc-editor moved its frame code (frame.tsx). Rerun when the machine is quiet, before republishing Face Fit from that branch.

## V1 gameplay lanes (2026-10-27, from David's picks)

David picked almost everything for the next launch and moved the date off Oct 31 (new date unknown; asked). His notes verbatim, my readings and the workstreams are in `specs/launch/v1-gameplay.md`. Five lanes, cut from local main 10b5a7b1 or later:
- `tutorial-v2`: builds the shared guide arrow first;
- `main-quest`: the quest dropdown and chapters 1 to 6;
- `rod-gear`: the rarity ladder first, then 5 rods, add-ons and the hex radar;
- `fishing-depth`: the pond first, then requests, records, the now board and sushi phase B;
- `daily-social`: dash first, then the 7-day bonus, friendship, the monument, campfire hour and fishing together.

Shared owners: the arrow (tutorial-v2), the tracker and dropdown (main-quest), the rarity (rod-gear). When an owner reports its commit, merge it into the lanes that need it.

Remodel round 2 reviewed: barrel, rocks, crawlers, close-ups and fish icons approved (with an orientation check on the fish); the flyers redone in round 3, back on the old models until then.

## Planning and editors (2026-10-27 afternoon)

- **V1 gameplay plan** for David to pick (Launch / Soon after / Later / No + notes): https://claude.ai/artifact/UAh1iey4axcvavuPXLdZe4, collection `picks`, own ideas in `notes/david`. 29 ideas in 6 sections: the first ten minutes, a main quest (chapters 2 to 7: Odile's net, Pim's shovel, Bram's rod challenge, fill the museum, the pickaxe, the fishing boat), fishing depth (pond fix, daily requests, records, tourney), daily reasons, together, and hollow-feature fixes. Built from an inventory of the game (no personal quest after chapter 1; pond fish unreachable; glider/dash never unlock; shop items that do nothing).
- **Lanes running:**
  - `catalogue-editor`: species editor page;
  - `npc-editor`: resident editor page. Its new-world places fix is cherry-picked to local main (844dcad4);
  - `wardrobe-b3`: offered() rule, Tousled spikes removal, prices plus seed, monocle, under-cap;
  - `remodel`: round 2;
  - `reflection-waves`: round 4 (drop skins 10 and 11, perf A/B).
- **Local main ahead of origin, not pushed** (David stopped my last push): the grass merge (71a43b41, all approved) and the places fix (844dcad4). Push when David says.
- **TSI zip hoodie review:** https://claude.ai/artifact/TiHe1w3zCSdHEtQkt3F89M (game/clothing-v2 aafbe9fe).

## David's fit values (2026-10-27 afternoon)

David finished Face Fit ("face and hair scales done"). I exported 53 docs from the `fit` collection and saved 47 to `game/fit-editor`: `specs/evidence/fit-editor/export/fit-export-2026-10-27.json`.
- **Dropped because removed:** hair_fluffy_crop, hair_long_windswept, hair_space_buns, hair_messy_braid, acc_cross_bandage. The moody face had no doc.
- **Dropped to reset:** hair_tousled_spikes, which wardrobe-b3 is re-placing at import. Any other hair whose placement that fix moves must be dropped too, and David re-fits it.
- **To ship:**
  1. wardrobe-b3 finishes: the Tousled spikes placement, the removals (4 hairs, moody, cross bandage), the monocle re-import and the under-cap cut.
  2. Merge it into game/fit-editor and run `node web/scripts/apply-fit.mjs <export>` there.
  3. David prices batch 3 on the shelf page; unpriced items count as free.
  4. Merge fit-editor (which carries b3) to main with the seed migration for the new prices.

## Batch 3, clothes, loading screen (2026-10-27, morning)

- **wardrobe-b3** done (head 7aa2cd79): hair-32 to hair-46, face-26 to face-32, acc-25 to acc-27; review https://claude.ai/artifact/K6PaZcMX5AbUntBhzUZAaJ. An item with a key and no price counts as free, so merge b3 only after its prices are applied.
- **Shelf page** republished as "Wardrobe Shelf" on the same URL https://claude.ai/artifact/EyLDXZLTsdRVTYZeABzy3h: collections `hairs` (batch 3), `faces`, `accessories` (32 on sale, plus the three new ones), note `notes/david-b3`. Defaults when he picks a price: hair 350 coins or 200 Gems, faces 250 or 100, accessories 150 or 100.
- **Face Fit** v2 includes batch 3: game/fit-editor merged game/wardrobe-b3 (face.test.ts conflict resolved: both describes kept), rebuilt, check.mjs PASS, published on the same URL.
- **clothing-v2** round 1 review: https://claude.ai/artifact/G5RvBxgazEZwSirknQaBDt (head 459ce35a). Item `shape` asks whether to restyle the silhouettes.
- **loading** screen review: https://claude.ai/artifact/9QsGi2EJnicwiskGHsUygx (game/loading 614d8616 and ff626290; everything else from the lane is on main at 50e949e1).

## Review pages and state (2026-10-27, early morning)

- **Waiting for David:**
  - reflection-waves round 2: https://claude.ai/artifact/Sc2JrcPsEPotE4VA2zHizU (items `r2-*`; `r2-lightness` is his call on lifting hair lightness, which would change every hair);
  - grass-wind: https://claude.ai/artifact/3e5WRNPQaogvYPqq1pW2K2 (head d79889da);
  - remodel round 1: https://claude.ai/artifact/4uk78WkbWRFyBRc3HD4WTL (head 2349d362; each model can be dropped from the REMODELLED list in `lib/game/world/active.ts`).
- **Face Fit editor:** https://claude.ai/artifact/D1gkmSBHBGspFPH5to9yA8 (db collection `fit`), built from game/fit-editor eedf4d89 (GLBs as `.glb.json`). Apply: export `fit`, then `node web/scripts/apply-fit.mjs <export.json>` in web/. The runtime field isn't on main yet: merge game/fit-editor with the first applied values. Rebuild it with batch 3 when wardrobe-b3 lands.
- **Merged and live:** collision (plus the campfire), hair-shelf (seed 20261027054753 applied), hq-alice (20261027063439 applied), net-identity, launch-check run 3 (all final checks passed). The loading steps 2 to 4 are merged locally (74d00e9a) and wait on the full vitest before pushing.
- **Asked David:** the four invisible plaza benches (bench-0 to 3): real benches or remove the seats? And the first wave in the mist (redo with no note).
- **Perf baseline:** the Oct 14 perf:check baseline predates terrain v3, so every check fails against it. Refresh it in one combined run after the merges.

## Later the same night (2026-10-27)

- **reflection-waves round 1 reviewed** (https://claude.ai/artifact/Sc2JrcPsEPotE4VA2zHizU): desktop, phone and small waves approved; the wave approved with a note (the look changes along the wave's path, not in one frame); the first wave in the mist redo with no note (asked David why); the hair colours redo (blond less like skin, add ginger, keep the dyes' indices). Round 2 running on the same lane.
- **hair-shelf** (light): David's picks: Baby sprout, Layered shag, Swept fringe and V-kei to 350 coins; Messy with headset, Fluffy boy and Wavy half-up removed. Nobody owns or wears them in prod. It writes a catalogue seed migration for me to apply.
- **wardrobe-b3**: David's batch 3 (hair #28 to #42, faces #26 to #32, face accessories #25 to #27, unpacked from his zips into the worktree's `art/.../source/david-b3/`). Our own names, no prices yet.
- **fit-editor**: a per-item height field in the catalogue and an editor page bundled from the game's own character code, published by me as an artifact with `db` (collection `fit`), plus `web/scripts/apply-fit.mjs`. Rebuild it with b3 when that lands.
- **After b3:** extend the hair shelf page (https://claude.ai/artifact/EyLDXZLTsdRVTYZeABzy3h) with the new hairstyles, the faces and all the accessories.
- **hq-alice** (light): the HQ lead Wren is renamed Alice wherever players see it; ids stay `wren`; a migration for the prod rows.
- **remodel** (overnight): ACNH-dump and old models remodelled in Blender, the fish tweaked, before and after shots for a review page in the morning. David allowed Pinterest references for this pass only (headless; images kept out of the repo).

## David's production notes (2026-10-26 night) and the six lanes

David played production from another computer and sent eight notes (verbatim in each lane file). Lanes cut from 1d9a951e, all `uwotsi-lane`:
- `net-identity`: everyone shows as "Islander" in the default look. Prod has 0 rows in `member_identity` (329 profiles, 40 with a saved look), so no world name has ever saved. Launch blocker.
- `collision`: falling off the wharf deck near its ledge; hitboxes that don't match objects and buildings. The wharf fix ships first.
- `reflection-waves`: the arrival's reflection creator: a foam wave rolling past instead of the ripple, small natural waves, no colour wheel there, "That's me" instead of "Yes". Review before merge.
- `grass-wind`: longer blades, wind travelling in waves, colour from the ground; new world only, no extra triangles. Review before merge.
- `loading`: measure, preload from the title page, cutscenes preloaded and smooth, lag spikes, then a new loading screen (review).
- `clothing-v2`: universal garment models that fit, designs as paint; round 1 the starter set. Review before merge.

Hair shelf page (David picks free vs coins vs Gems per hairstyle): https://claude.ai/artifact/EyLDXZLTsdRVTYZeABzy3h, collection `hairs` (doc per hair id, `{mode}`), note in `notes/david`. Today 20 free, 5 priced (`specs/wardrobe/batch2-pricing.json`). Apply his picks there and in the catalogue keys when he's done.

## Production flipped to the new world (2026-10-26 evening, David's request)

David asked for the current version on play.tethos.ca so he could test multiplayer from another computer ("nobody playing rn so its fine"). Set in Vercel Production:
- `NEXT_PUBLIC_GAME_WORLD=new`;
- `NEXT_PUBLIC_MEMBER_WORLD=open`, which opens the member world to every member early. Keep it until he says to close it again. To undo: `vercel env rm <name> production` and redeploy.

Main holds:
- R2d, R2e (with the flock fixes) and R2f;
- launch-check: gather nodes (rocks, shell dig spots) and the collections test made world-aware;
- world-fixes: the river fishes as river, and bottle spots.

Production deploy 1877dcb5 (Ready). The two-account test on play.tethos.ca against prod Fly v7 passed: day 35/36 (the miss was a real player, "Islander", in the Here count) and night 22/22. Cleanup is proven (`specs/evidence/launch-check/`).

**Run 2 on production 2fe3e3b8 (with the sushi bar):**
- Core multiplayer, flow 4 and the shovel passed. The one miss: no buried shell came up, which is the hour's roll.
- Sushi bar 11/11: two real clients pressed E together and got different stools; tags at stool height; E stands them up.
- **Open:** a fire-bench sit misfired 2 of 5 times at night. It may be a resident holding the slot; unproven. Look at it in the seat code if David sees it.
- **Unpushed:** the merge of launch-check run 2 (test-only) sits on local main, held so there's no deploy while David plays. Push it with the next change.

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

## Locks (2026-10-27, learned the hard way)

- `withlock.sh` is the only lock mechanism. There is no devserver queue: a queue file some lanes waited on (and withlock never read) starved them for two hours, so it was deleted. Never recreate one.
- `push-main.sh` takes the heavy lock itself. Run it bare, never inside `withlock.sh heavy`, or it waits on its own lock forever (that held the heavy lock for 40 minutes).
- Retry loops over withlock must check the exit code (75 means it gave up); a `| tail` hides it.

## 2026-10-28 morning: reviews open for David (collection `approvals` unless noted)

| Review | URL | Lane head | Merge needs |
|---|---|---|---|
| Tutorial v2 | https://claude.ai/artifact/NTJjmvqTjX6aHRj9MBJkwD | game/tutorial-v2 fb5991d9 | lines.ts conflict with main-quest (keep Juno's farewell line) |
| Loading pick (approve one of logo, boat, island) | https://claude.ai/artifact/NMFDnVSQxLHpyAQgaz1YDg | game/loading 14a42936 | lane deletes the two unpicked looks and the ?loading switch |
| Rods and gear | https://claude.ai/artifact/NAXEqzpmfNnEASvNPoWCgS | game/rod-gear e35dd842 | migrations 20261027140000, 183120, 183200, 183713 in order |
| Fishing depth | https://claude.ai/artifact/2t3rTrcf8YC4GGENxfW3kJ | game/fishing-depth 3f2a49a9 | migration 20261027181000 |
| Wardrobe fixes (under-cap, monocle) | https://claude.ai/artifact/WqPLxThgbBjhKEecgogW92 | game/wardrobe-b3 d9e8298c | none; asks whether to cut Sponge twists and Freeform afro skin-tone edges |
| Catalogue editor v2 (collection `species`) | https://claude.ai/artifact/5XzAaR5Wipoe2ZN2Hby3FG | game/catalogue-editor f5186814 | migration 20261027185416 after the rod-gear ones; apply-species.mjs for his edits |
| Daily and social | https://claude.ai/artifact/68SEdjVRvruZzvgDmHTFVG | game/daily-social 6f3b4ac7 | migrations 20261027182444, 190000, 190100, 20261028112843 in order |
| Clothing round 2 + TSI zip hoodie gate | https://claude.ai/artifact/VhBnp5Ua6w82U8ervpzxiG | game/clothing-v2 da63d1d3 | round 1 and the hoodie (aafbe9fe) already approved; merge all together |
| Remodel round 3 (wings, sea creatures, benches) | https://claude.ai/artifact/9ffhKczMau3xoH8KkxMiwp | game/remodel 1453dd9c | none; benches keep the map's yaw (bench-0 across the path) |
| Main quest (new-world shots; village pinned unchanged) | https://claude.ai/artifact/6DLtytETjRJVtM1HzXytPf | game/main-quest 907873f4 | migrations 20261028144337_main_quest then a regenerated catalogue seed; settle-in gets world village; npc-editor republish for Juno after merge |
| Fish bite tiers (the "!" and sound per tier) | https://claude.ai/artifact/PVrjtdUz6pwD7TWp9pyQDo | game/fish-tiers 1f75ee3e (catalogue-editor merged; lane still on the two-client raid run and perf:check) | migration 20261028150000_catch_caps_divine (cap CASE only, checked against backpack's body; smoke in the chain); no fish is legendary or divine after the catalogue pass; page asks if epic gets the gold "!"; realtime needs a Fly deploy before NEXT_PUBLIC_FISH_BOSSES is ever on |
| Residents editor (collection `residents`) | https://claude.ai/artifact/QtZYAgMFEbFg4YNpVcBYwU | npc-editor 2a67bfb0 (main merged) | republish once main-quest (Juno) merges |

Shipped 2026-10-27/28: batch 3 wardrobe (seed 20261027165850 applied), remodel round 3 step 1 (2e7bd27f). perf-tris (a017efae): new world High 774k triangles / 345 draws, Lite 582k / 281, under budget; `?fxoff=viewCull` turns the cull off. perf-check's lock owner must not need a space (fixed in fce65d21).

## 2026-10-28 afternoon: David's decisions read back

- Fish bite tiers: all three approved, no notes; HOOK_TIER unchanged. Merge game/fish-tiers after its raid run and perf:check. Its next item is the fishing UI/bar redo plus juice (David's tutorial "catch" note).
- Remodel round 3: all approved except plaza-bench-after ("make sure the bench location and orientation is fitting"). The remodel lane is fixing only the benches, then merge.
- Main quest: round 2 running (agent a0d703c666d998bba). Pickaxe parked for the cave update; the museum drive must always be completable; dig marks fainter; buried loot table (relics, coins, ores, rare gems, very rare broken sudo) with shovel tiers; chapter 1 levels you to 2 with an unlocks overlay; quest bar/dropdown same width; arrow icon instead of "Show the way". The village cards were proof shots: drop them.
- Tutorial v2: David's 2026-10-27 notes were never relayed; round 3 is running now (agent a868e7cdc49823714). Selling is back (Bram gives his rod after the sale); keyboard tour; coin/gem fly-ins; ID-card register using profiles.birthday; lore before TSI; phone changes held.
- Bug-catching minigame (David's note on Odile's net): queued as its own lane after these.
- Open question to David: the lore line "the island was found by David" vs the no-real-names rule; the lane writes "the Founder" (lore canon) until he answers.
- Removed the play worktree and feat/play-subdomain (local and origin): merged 2026-10-03, nothing left on it.

## 2026-10-28: the village is retired

David: "why are we using the old island for some of these artifcats, it should not be used or archived". The rule "the default village world stays unchanged" is gone: new world only, one vitest run with NEXT_PUBLIC_GAME_WORLD=new, and no village shots on any review page. Production already sets NEXT_PUBLIC_GAME_WORLD and NEXT_PUBLIC_MEMBER_WORLD (since 2026-10-26; STATE.md was stale).
- game/village-archive (agent abf7673402b328ef0): makes the new world the only member world and moves the village to archive/village/. It also drops the flag and the village gates, fixes the docs and rules, and resets the perf baseline to the new world. It sends a file map before deleting anything.
- game/daily-social reshoot (agent a90eef0da524e761a): its review page was all village. It's making every feature work in the new world and reshooting with new ids (nw-...). The old page https://claude.ai/artifact/68SEdjVRvruZzvgDmHTFVG is superseded.
- Loading pick: the "island" look renders the village HQ with "Unpacking the village...". If David picks it, it gets rebuilt on the new world.
- Merge plan: settle the main-quest `world` column (village side) with the archive lane at merge.
- Merge plan additions:
  - Merge game/npc-editor (apply-residents.mjs is only there). Then apply David's Residents editor look edits (marlo, mayor, sushi-chef, wren; export the `residents` collection) on the combined tree, before the final gen-seeds.
  - daily-social's 20261028112843 seed now has a residents block with the new curator and marlo lines, guarded by their old seeded values. Prod still matched the old seed on 2026-10-28, checked read-only.
  - The archive lane owns the pond-to-beach and path-to-plaza schedule remap. Main only had the same-name landmark fallback, so pond stops were being skipped.
- Remodel benches: game/remodel b8939161. Review https://claude.ai/artifact/4kbPArCyyejQoEfdR3nxsc (ids r3b-*). Once approved, all of round 3 merges.
- daily-social 02617517: gen-seeds supports `guarded` seeds, and the residents seed is one. resident_lines_smoke.sql includes `20261028112843_catalogue_seed.sql` by name; if the final regenerate renames that seed, update that one line.
- 2026-10-28 codebase review (David asked, ponytail): four read-only agents (assets, dead code, UI, docs). Their findings go into the design bible's UI and Art chapters and a cleanup plan. specs/design-bible.md is new: Models chapter, ledger row 319, pointer in CLAUDE.md. The archive lane uses row 320.

## 2026-10-28 ~16:00: David's decisions on the open pages (verbatim notes are in each page's `approvals` collection)

- **Merged locally:** game/remodel b8939161 (all of round 3 approved, benches included) is merge d3af4f3d; gates and push pending.
- **Loading:** island approved ("this one is good"); logo and boat redo, meaning not picked. Next round: keep the island, delete the logo and boat looks and the ?loading switch, rebuild the island backdrop on the new world (it showed the village HQ), and drop the "Unpacking the village..." copy. Coordinate with village-archive, which is moving TitleScene to the new world.
- **Rods and gear (redo round 2, queued):**
  - shelf: tier is shown as a rarity outline on the shop tabs (common grey, uncommon green, rare blue, epic purple, legendary yellow, divine holo);
  - sell rods up to rare only for now;
  - hook caps: a rare rod hooks up to epic, an epic rod up to legendary, a legendary rod up to divine;
  - flimsy is common and lighthouse is rare;
  - the radar is redone: bigger, minimal, lighter, less bold, icons at the corners with hover names and plain explanations, graded out of 100, linear shift animation when parts are added, the current build's main and base colours at low opacity behind;
  - bait and bobber slots sit bottom right of the rod square, on your own rods only (not in the shop), and they appear on the rod model;
  - the bobber and bait are remodelled in Blender, HD for the shop and LP on the rod, with a base bobber built for variants and the lucky bobber as a four-leaf clover; the bobber's radar shows only the bobber;
  - divine badge text is white; GUI tiles approved; the phone layout card is a redo.
- **Fishing depth (redo round 2, queued):**
  - the bar menu is a paper restaurant menu with detailed food models: pick it up in first person, hover a dish to see what it does;
  - the board UI is fully redone as a time graphic of what's available, icons with hover;
  - the tackle shop goes near the fish shop as a gacha: one coin roll and one gem roll, 1 to 10 pulls, seasonal crazy bait and rods;
  - chef's order UI redone;
  - the market: one place to quick-sell, one to enter fish for a monthly leaderboard, and a separate board for daily and weekly fishing tasks that you claim when done (no hand-over);
  - collection-season approved.
- **Clothing round 2:**
  - approved: tops (reweighted), shoes, all in-game views, the TSI crew close-up;
  - redo: the long dresses clip through the body and two skirts flicker when sitting; the one-pieces are remodelled properly in Blender, with references found online and shown to David first;
  - new ask: "start worrying and developing clothing model for classes and armour related soon for differnt class".
- **Daily and social:** notes relayed to the running lane (half hearts, monument UI, a visible streak reward track of about 1500 coins and 25 gems plus a wheel box, a gentle campfire notice, dash approved).
- **Wardrobe fixes:** no decision yet.
- **Bible:** UI chapter written (row 320). Clean flat is the one base; paper only for paper things; tokens only; one kit; one showroom. Every lane brief points to it. The village-archive row is 321.
- **Queued lanes, held while swap is about 10.8 of 11.3 GB:** rod-gear r2, fishing-depth r2, clothing r3, loading r2. Later: bug-catching minigame, class and armour clothing (needs David's class direction).
- **Kit piece owners (one owner per piece across lanes):**
  - main-quest: the flat reward pop (RewardCard converted) and the rarity tokens (`--ui-rarity-*`, `--ui-holo` in the theme files). Rod-gear's `--gui-rarity-divine` folds into them at merge.
  - daily-social: HeartMeter, RewardTrack, PrizeWheel.
  - tutorial: the keyboard overlay, the icon fly-in and the ID card.
  - fish-tiers: the fishing bar and meter, plus a new member fishing overlay. FishingOverlay.tsx stays as is for the applicant island only.
- fish-tiers: the approved SHA comes after its perf:check commit (80395fe4 plus the numbers). The cream UI attempt is parked on game/fish-tiers-ui-r1; never merge it.
- Dead-code review: the archive lane also takes every retired map (/lab/map whole, island-map.json, world-map.json and the v2 convert chain, the proposals) and re-points four tests at the live world. Dash and glider were locked forever (no caller of unlockMove): the tutorial dock beat and daily-social's "dash for everyone" fix dash.
- QuestCheck (the quest-complete check-mark moment, `tsi:quest-complete`) belongs to tutorial-v2. main-quest fires the event on chapter completion; check the sequence after both merge.
- Open question for David: HQ has no job board or past-projects display, though his farewell note assumes both. Add them as HQ stations? Until he answers, Alice names the notice board, the trophy case and the Founder's desk.

## 2026-10-28 codebase review: cleanup plan

The four reports (assets, dead code, UI, docs) are summarised here; the full text is in this session's transcript.

1. **game/village-archive (running):** the village plus every retired map (/lab/map, island-map.json, world-map.json and the v2 convert chain, proposals), the title moved to the new world, four tests re-pointed, and the perf baseline set on the new world.
2. **cleanup lane (after village-archive merges, light):**
   - Code safe to delete, about 2,950 lines:
     - author-elevation.mjs, preview-map, coast.ts, /lab/icon and _render-icons, WharfShackInterior, npc chatClient, mobilePresence, convert-world.ts;
     - preview-sky and preview-variants, extract-fantasy-sky, the three fbx-to-glb copies, /dev/playground;
     - the dead helpers isTreat, SHOP_FLOORS, swellFade, PER_PLAYER and ?rain=1.
   - art/characters/base v3, v4, v5, ref_girl, base_body and turntable builders and outputs, plus v7 locks.py and hair_styles.py: 4,324 lines, 15.1 MB.
   - Unreferenced game assets, 15.9 MB: acnh/fall, acnh/river, acnh road glbs, unused terrain/road pngs, cliff 5-a-0 and 6-a-0, 7 unused acnh buildings, 9 furniture, 22 props, 4 plants, 113 dump icons (check prod rows first), public/assets/buildings, nature except grass-tufts, the prototype and npc pngs, v7_clips.glb, the old sky webps and layers, kunai, road-brick-normal, 3 cut-part icons.
   - After the archive: point the fish catalogues at /assets/game/remodel/fish, then delete acnh/fish (16 MB), the stranded village assets, and the preloaded-but-never-drawn fountain, fence-log-a, stump and lighthouse.
   - About 140 docs to archive/: the 45 already marked superseded in INDEX, 61 answered *-questions.md files, done plans, and 31 lane files of finished lanes. Fix the CODEMAP, terrain-law and lore links.
   - Out of scope (marketing): public/cards (10.2 MB), webcons2.png, globe.glb, components/ui/Lanyard and PixelLogoCarousel.
3. **ui-unify lane (Opus, after the current UI-touching lanes merge):** move the ~14 cream menus and the HUD onto the flat kit per the bible's UI chapter. That covers:
   - moving Button, Keycap and Dialogue from components/recruit/ui into components/gui (recruitment keeps re-exports);
   - one /lab/gui showroom with the flat kit;
   - the 484 hex values and 138 rgb() calls onto `--ui-*` tokens (worst: DefaultIslandWorld.module.css 219, FishingOverlay inline);
   - deleting the old sage-HUD rules and the dead ThemeToggle;
   - one name tag, one bubble, one progress and one keycap component.
4. **David's calls, asked 2026-10-28:** the dump rule (dump is interim, never the close-up copy); whether the re-finished dump fish count as ours; combat parked or archived; delete the NPC AI chat; delete 7 sky variants and 3 look presets; HQ job board and projects wall; references for the bobber, bait and five dishes.
- main-quest r2 code is at 4bb98992 (shots pending):
  - migrations 20261028153805_main_quest_r2, then 20261028194150_catalogue_seed (regenerate on the combined tree at merge);
  - flat kit pieces RewardPop (RewardCard renders it) and BigMoment (the level-up card);
  - pickaxe parked behind the drop flag `cave`.
  At merge, fold BigMoment and tutorial-v2's moments.tsx (QuestCheck) into one file in components/gui/flat.
- **Shipped 2026-10-28 afternoon:**
  - remodel round 3: deploy uwotsi-9lz2udslo, Ready.
  - fish-tiers e6ab258e, with catalogue-editor round 2 and the rarity ladder: merge 9d825100, main = de87c07f. Prod dump prod-before-fish-tiers-20261028-1610.dump. Applied 20261027140000, 180000, 183120, 185416 and 20261028150000, logged in migrations.log. Checked: sell_price column, ladder through contraband, 0 legendary species, divine cap; verify shows 0 tables without RLS and the usual definers. Deploy uwotsi-3jtxoql5m was queued at push; confirm Ready.
- **New-world fixes lane (queued, after village-archive merges).** These are tests the archive lane re-pointed at the live world, now skipped with `new world:` notes:
  - Halloween: pumpkins stand by only 7 of 59 lamps. Halloween is Oct 31, so this goes first.
  - residentRoutine: 7 walks pass through a solid, and the night owl's bench isn't under a lamp.
  - ambientFauna: no leaping fish in open sea, a butterfly patch check fails, gull circles fail camera reach.
  - The ?bots loopback breaks the room bounds; the bench seat lift is 0.359 vs 0.344; seated count is 0.
  - Outdoor study tables (study:plaza-picnic, study:pier-bench) don't exist on the new world: study-0..3 have no model, so no outdoor seats. **A production gap.**
- Merge hazard: game/main-quest's residentRoster uses `GAME_WORLD` and `residentsHere(personas, world = GAME_WORLD)`. After the archive it is always newWorldPersona, and the NEW_WORLD_ONLY village filter is dead. daily-social touches residentRoster lines next to the archive's schedule edits.
- fish-tiers UI redo: head 908b5218, not merged.
  - Built: the flat MemberFishing overlay, kit reel.tsx, and the shared hooks in lib. The applicant FishingOverlay is refactored onto those hooks and must look the same.
  - The lab-page evidence wasn't good enough for David. A fresh light agent (af33246c7568c65a4) is shooting in the world, before and after against main, plus an applicant-unchanged check, after merging origin/main.
  - Its rarity edges use `--gui-rarity-*` and `--gui-holo`. At merge, switch them to main-quest's `--ui-rarity-*` and `--ui-holo`.
- perf note: fish-tiers' perf:check "fail" (1.38M triangles, 413 draws) ran on a branch without perf-tris, against the 10-14 baseline. Main has perf-tris (774k, 345). The archive lane resets the baseline on the new world.
- daily-social redo built (after 55a95486), shots partly done. Its migrations changed (all unapplied):
  - welcome_week: welcome_gems column; the track pays 200/300/0/400/0/600/0 coins and 0/0/5/0/10/0/10 gems through wallet_apply earn_streak; the day-7 pool adds rod-cedar, net-mid and shovel-mid.
  - resident_friendship: level 0..10 in half hearts, last_gift_day, resident_friend_talk recreated (+½ once a day), resident_friend_move (internal), resident_friend_gift (deltas -2/0/1/2, one gift a day).
  - The 112843 seed drops welcome_day_coins.
  - Kit: HeartMeter, RewardTrack, PrizeWheel, GoalMeter and CountUp in flat/rewards.tsx; --ui-heart; quiet toasts with `{ quiet: true }`.
- **Main quest round 2 review:** https://claude.ai/artifact/4f81ZjsmkJmoFty3FbHf2i (ids r2-*), game/main-quest cb43bd44. Migrations in order: 20261028144337_main_quest, 20261028144350_catalogue_seed, 20261028153805_main_quest_r2, 20261028194150_catalogue_seed (regenerate the seed on the combined tree). The old main-quest page (6DLtytETjRJVtM1HzXytPf) is superseded. Open questions on the page: the broken sudo as divine, the gem odds, and a bigger level-up card. The HUD coin chip, minimap and clock are still cream (UI pass).
- perf baseline: every lane's perf:check compares against the 10-14 village baseline, so they all "fail". The archive lane resets it on the new world; ignore those fails until then.
- **Fishing UI review:** https://claude.ai/artifact/QdLFdL5cMp5s8q7AUxVa8K (ids fui-*), game/fish-tiers d8f45b67 (main merged at f26f7763). The meter is horizontal and no longer covers the avatar; one chip morphs from waiting to the hook; the applicant island is checked unchanged (0 differing pixels with a fake clock). At merge, switch its `--gui-rarity-*` and `--gui-holo` to `--ui-rarity-*` and `--ui-holo`. No migrations.
- **Daily and social (new world) review:** https://claude.ai/artifact/Prtn3zvCmWnx6zwufpArpY (ids nw-*), game/daily-social e4a75f28. It supersedes 68SEdjVRvruZzvgDmHTFVG. Migrations in order: 20261027182444_catalogue_seed, 20261027190000_welcome_week, 20261027190100_resident_friendship, 20261028112843_catalogue_seed. resident_lines_smoke includes 112843 by name.
- **village-archive done:** game/village-archive ef90c927 (main de87c07f merged).
  - Title pick: https://claude.ai/artifact/QER69PS5FSvw8LC6MFNM8n (ids title-a, title-b). A is in code. If David picks B, set the four SHOTS rows in components/title/shots.ts to { x: 5.26, z: -13.6, yaw: -16.6, eye: 1.3, pitch: -1, fov: 38 }, keeping night's drift 0.8.
  - Gates: tsc 0; vitest 3469 passed, 2 failed (seedMigrations: regenerate the seed at merge); npm run build ok with no flag; the applicant island proven unchanged.
  - Bundle: title +114 KB (the world document), applicant -3 KB.
  - Perf baseline: new v2 rows on the new world (High 4.8 ms, 359 draws, 757k triangles; Lite 2.9 ms, 289 draws, 567k).
  - The code half is ready now. Merge it first in the batch, then rebase the others on it: main-quest's GAME_WORLD import breaks; daily-social conflicts in residentRoster; loading's TitleScene fix.
- **Tutorial round 3 review:** https://claude.ai/artifact/XU4bt3kUVfuJSeDjLKjmB3 (ids v3-*), game/tutorial-v2 4fee5d2b. It supersedes NTJjmvqTjX6aHRj9MBJkwD.
  - PATCH /api/profile now accepts birthday (validated, private; no new column). clothing-v2 also edits /api/profile (members_only), so expect a conflict.
  - Kit: Spotlight, KeyBoard, FlyIn, QuestCheck and PrintedCard in flat/moments.tsx, plus the paper tokens --ui-paper, --ui-paper-edge, --ui-paper-ink and --ui-stamp. Fold main-quest's BigMoment in at merge.
  - It deleted RegisterCard, MerchCard and UiTour. hq/lines.ts conflicts with main-quest: keep both sides.
  - Questions for David on the page: the Founder vs his name, spirit animal as the ID's extra field, and the ID card's size.
- **Running (2026-10-28 evening):**
  - newworld-fixes (agent affc0c80e899a0fb5), branch from game/village-archive ef90c927. Halloween pumpkins first (its shots may ship alone), then study seats, resident routes, the bench-0 footprint, fauna and bots.
  - rod-gear r2 (agent ac1556f3ada427b05): rarity outlines, sells up to rare, hook caps by rod rarity, a new radar, own-rod bait and bobber slots, the bobber-only detail. The bobber and bait models wait for David's references.
  - fishing-depth r2 (agent a3ab7400befe17b10): the paper menu picked up in first person, the chef order, the board as a time graphic by the fish shop, the tackle gacha (coin and gem, 1 or 10 pulls, odds shown), the market's three places, the tasks board with claims. The food and prize models wait for references.
  Both copy main-quest's `--ui-rarity-*` tokens verbatim.
- **Still queued:** loading r2 (island picked; rebuild it on the new world; coordinate with the archive's TitleScene); clothing r3 (dress clipping and skirt flicker on sitting; one-piece remodel with online references, shown first); the cleanup lane after the archive merges; ui-unify after the current UI lanes merge; the bug minigame; class and armour clothing.
- **Halloween pumpkins review:** https://claude.ai/artifact/Jrsb19bGJouYHrHtmDwXZd (ids hw-*), game/newworld-fixes f2921d8f (only lib/game/halloween.ts and its test; on top of village-archive). To ship before Oct 31 without the archive: cherry-pick halloween.ts onto main. Its test assumes the new world as the default, so on main run it under the new world or ship it with the archive merge.
- **newworld-fixes done:** game/newworld-fixes ed6064aa, 6 commits on village-archive ef90c927. All 12 `new world:` skips are green.
  - The six fixes: the Halloween posts (f2921d8f); study seats study:plaza-picnic and study:pier-bench (study-1..3 removed); resident nav sampling at 0.1 with rim probes, and only lamps that cast light count; the bench-0 model; butterfly radius 3.5; the island `top` over deep water is the sea surface.
  - That last one changes every player's fall into the sea, so I asked for sea-fall before and after strips before merging. The study seats and the night owl's shots are in the evidence for a review page.
  - Merge order: village-archive (after David's title pick), then newworld-fixes. Regenerate the seed once on the combined tree.
- fishing-depth r2 at 8fef03e5 (shots pending).
  - Migrations:
    - 20261028160000_fishing_tasks_sushi (renamed from 181000; task claims, chef order fills, monthly entries);
    - 20261028161000_tackle_rolls (17 off-sale prize rows plus tackle_roll). It widens shop_items_slot_check exactly as rod-gear's rod_tackle_slots does; at merge, check that the two constraint rewrites are identical, or keep one.
  - New APIs /api/economy/{tasks,chef,tackle} and /api/collections/monthly replace requests and records.
  - Before merging, check that the gacha RNG runs in the API route (service role), never taken from the client.
- **New-world fixes review:** https://claude.ai/artifact/K38ZoQPTqe9HBFwbcRDLw3 (ids nf-*), game/newworld-fixes 7cfc3230; the sea fall is verified with strips. It merges right after village-archive.
- **Rods round 2 review:** https://claude.ai/artifact/2SriizfPH8naxzxb1SdFmn (ids r2-*; the old page NAXEqzpmfNnEASvNPoWCgS is superseded), game/rod-gear 10f7cdd4.
  - Migrations: 20261028155000_rod_tackle_slots, then a seed (regenerate on the combined tree).
  - Hook rule: rod rarity +1, on the page as a table.
  - Gaps: the world float still uses the generic bobber; a Flimsy-only member has no rod view with slots.
  - Themes carry main-quest's rarity block byte for byte, plus `--ui-chart`.
- **Fishing round 2 review:** https://claude.ai/artifact/NrKj4D61QuTHsCNccw2j34 (ids r2-*; the old page 2t3rTrcf8YC4GGENxfW3kJ is superseded), game/fishing-depth c7ed2b70.
  - Migrations: 20261028160000_fishing_tasks_sushi, then 20261028161000_tackle_rolls.
  - Gacha RNG checked: the client sends counter, pulls and key; the server uses secureRandom; tackle_roll is service_role only and grants off-sale prize rows only.
  - The full vitest wasn't rerun after the "Fish of the month" rename, so run it at merge.
  - Prices and odds are the lane's placeholders; David sets them.
- **Lanes:** none running now (2026-10-28 late). Queued: loading r2, clothing r3, cleanup (after the archive merge), ui-unify, bug minigame, class and armour clothing.
- **Started (late 2026-10-28):**
  - loading r2 (agent adc0836dc7276280b): merges game/village-archive, keeps only the island look, rebuilds its backdrop on the new world, moves to the flat kit. Merge after the archive.
  - clothing r3 (agent abde6917a32fb9fcd): fixes the long dresses clipping and the two skirts flickering on sit. It then finds online references for the one-pieces (David asked) and stops for David's pick before modelling.
- **Loading r2 review:** https://claude.ai/artifact/TU1hFR6cYz9jeA6ZyPCnAW (ids r2-*), game/loading 59ef45b9 (includes main de87c07f and village-archive ef90c927).
- **title-perf (agent started):** game/title-perf, on game/loading. It fixes two regressions from the archive's title move: the title streams 503 models (113 long frames), and a 482 ms first-sight shader compile in play. No look change.
- **Merge order for this stack:** village-archive (after the title pick), newworld-fixes, loading, title-perf. Regenerate the seed once at the end.
- **title-perf done:** game/title-perf 0f470315 (the fix is 226ae4f4).
  - The title lights 7 of 59 lamps (titleView plus the lit prop on Lanterns); the warm-up compiles the fading two-pass programs.
  - Results: title long frames 143 → 6; median frame 6.9 ms; world ready fast 8.6 → 7.5 s; first-minute play spikes 0; perf:check passes.
  - Pixel diff at most 2/255, so no review page needed.
  - Play already caps lamps at 4 nearest (LampPool).
  - Open: about 40 never-drawn module preloads on the title; PMREM relinks on phase change (under 50 ms).
- **Sushi menu references** from David (2026-10-28, "heres the inspo i want for the sushi menu"): a folded teahouse menu and tea banners, saved at specs/references/sushi-menu/ in the fishing-depth worktree. The fishing-depth lane is redoing the menu to that look (r3-menu evidence). The dish models still need their own references.
- **Sushi menu review:** https://claude.ai/artifact/TKM4GzggbcRfrMZD55hR7m (ids r3-*), game/fishing-depth bc1c7750.
  - It supersedes the r2-menu card on the fishing round 2 page.
  - Kit: flat/paper.tsx (FoldedMenu, InkTitle, Hanko, InkArt, PanelSection, TrayDish); the washi texture is ours (art/ui/washi.py).
  - Question on the page (r3-font): add a display face for the menu only (mincho or brush, a vertical 寿司)? Nunito stays everywhere else.
- **Tutorial r3 decisions (2026-10-29):**
  - Approved: arrow, wharf, barrel, currency, hudfly, lore, farewell.
  - Approved with notes: sights (inline 2D icons for words like fish and bug, coloured, with a wiggle); checkin (a unique personal QR plus Apple Wallet: answer feasibility first).
  - Redo: dock (tutorial dressing, cleared for good after HQ), id (the card is the overlay, headshot, hover tilt, confirm below), keys (no card, a smaller bare keyboard, each press pops its HUD piece in), kit.
  - Round 4 lane started.
- **David's tutorial test server:** dev on port 3300, bound to 0.0.0.0, from worktree tutorial-test (detached at 4fee5d2b, frozen), Supabase blanked (signed out, nothing saves). PID in scratchpad/tutorial-test-dev.pid. URL: http://localhost:3300/lab/island?arrival=1, or http://10.0.0.251:3300/lab/island?arrival=1 on the LAN. Kill it when David is done.
- **David's tutorial playtest notes (2026-10-29, about 1:15 AM), routed:**
  - To tutorial r4: the ID asks things that matter (no spirit animal); the coin and gem slots show and fade with the quest line hidden; the "great way to level up" copy; the box-hop and Esc misses; the "look around" farewell cut for now; continuous camera moves between buildings; step back when too close to an NPC; one prompt only; the reel teaching card when the bar appears; the barrel and crates by the fish market removed; signed-out dev selling works.
  - To fish-tiers (playtest round, fresh agent): cast toward the cursor (centre in a locked camera); no how-to text on the reel panel; the tool wheel in a locked camera picks by mouse direction (the emote wheel too).
  - To creator-polish (new lane, branch from main de87c07f): a calmer reflection with live surface texture; hair and part changes dissolve with the wave.
- **Clothing round 3 review:** https://claude.ai/artifact/MWutWWDXbjtnvhvq3SSoa9. It covers the skirt fix (ab54415e) and the 11 one-piece reference images for David to pick, with sources in specs/references/onepieces/*/sources.md. The images stay out of git (third-party; public repo). game/clothing-v2 is at 9da62224 and the lane has stopped.
- **river-softlock (agent started):** game/river-softlock on newworld-fixes 7cfc3230.
  - Bug: a dash-slide crosses the river into an unreleased region, then the player drowns and respawns there (soft lock).
  - Fix: every movement mode respects the release barriers, and the respawn or last-safe point is always released and reachable.
  - Merges after newworld-fixes.
- Machine at about 01:30: swap at 11.6 of 12.3 GB with David playtesting (Dia) and the 3300 server up. No new lanes until something finishes.
- **Clothing round 3 called off** (David, 2026-10-29): "i give up on clothing round 3 its not worth the time rn, try to reuse as much as acnh clothing model and logic and replicate as closely as possble, remove those random ass kid photos".
  - The kid photos are deleted (ef4e29cd), and the page now carries only the skirt fix.
  - New direction for clothing: reuse and replicate the ACNH clothing models and logic. Our ACNH dump has no character or clothing models (only buildings, furniture, props, fish, plants and terrain), so this needs David to supply them; asked.
  - Merge plan: game/clothing-v2 merges with rounds 1 and 2 plus the skirt fix (the one-pieces as they are) once David approves the skirt page.
- **Fishing UI review decisions (2026-10-29):**
  - Approved: hook, landing, epic card.
  - Redo, relayed to the fish-tiers playtest agent:
    - waiting state with one chip only;
    - the reel bar's colours not yellow or black, sleeker, no text, and juicy while reeling;
    - new-species cards get suspense by rarity plus confetti; repeats get none;
    - the slip state, same notes.

## 2026-10-29 early: David's decisions, all pages except wardrobe fixes

- **Halloween:** all approved; it ships with the newworld-fixes merge.
- **Title:** A approved; B and the old title dropped. Follow-up: "the left side needs to be remade so that its more of a game title screen and less of a student portal screen".
- **Loading:** all approved.
- **New-world fixes:** night owl and sea fall approved. The quay study table becomes a plain bench; the plaza picnic is removed. Both sent to the river-softlock agent.
- **Rods r2:**
  - Approved: slot-open, bag strip, radar, radar hover and strip, badges, phone, flimsy.
  - Approved with notes: shelf (outline slightly bigger); lighthouse (the model needs a light on top); bait and bobber (remodel).
  - Redo:
    - bag-rod: line not black, thinner and subtler, the overlay a slightly different colour; the bobber on the rod is too big.
    - shop-glass: move the title, text and graph up to leave space above purchase.
    - hook-rule (new roster): common Precision, Training (and Flimsy); uncommon Glass, Lighthouse; rare Tidewarden, Riptide, Titanium; epic Tempest. Models get cooler and more abstract with rarity; epic and legendary barely look like rods and have aura effects.
- **Fishing r2:**
  - Approved: chef, tasks, claim, showroom. The showroom note: refine for clarity, and asks about signs per water type; I recommended signs.
  - Redo:
    - board: add season and conditions.
    - board-world: remodel the catch board bigger, somewhere sensible and easy to see.
    - market: quick sell shows the price per fish and basic details, and must be instant.
    - gacha: a big animation, as its own project. A hook pulls a chest from the deep, slow-mo bottom-up camera, splash; the coin roll is a wooden crate, the gem roll a treasure box, and a legendary makes the water sparkle gold. Built in its own environment. The UI shows the seasonal special rods.
    - menu: superseded by the sushi page.
- **Sushi menu:**
  - Approved: the font (add a display face), lift, turning, spread 2, hover, picked.
  - Redo:
    - cover: another refinement pass, and poetic copy that doesn't sound like Claude.
    - spread 1: dishes as a simple food photo with the price and stats beside it; start the HQ 3D dish models; propose a sushi game mechanic beyond vibes and buffs.
- **Main quest r2:**
  - Approved: line, dropdown, dirt mark.
  - Redo:
    - arrow: centred and smaller.
    - sand mark: like the dirt one.
    - reward pops: "combination, not so flat but keep the old vibe but new color"; no cm on the broken sudo.
  - Level-up note, now in the bible: health, stamina and XP bars in the HUD; a level-up when XP fills.
- **Daily and social:**
  - Approved: friends, kit, campfire, dash.
  - Redo:
    - friends-talk: half a heart needs a full chat, not just the first talk; RAG LLM residents later.
    - monument: needs a real model that makes sense, and the 4 guide fence poles removed.
    - streak: the day-7 gift icon becomes a real rare-gear icon that shakes now and then.
- **Clothing r3:** David: "not even worth the effort... focus on the actual game aspect first". Merge clothing-v2 as is (rounds 1 and 2, the hoodie, the skirt fix); no more clothing work for now.
- **Bible amended:** UI rule 1 (flat with warmth, the old vibe in the new palette) and rule 8 (health, stamina and XP bars in the HUD).
- **Merge now:** village-archive, loading, title-perf, clothing-v2. Then newworld-fixes and river-softlock once the river agent finishes (Halloween before Oct 31).
- **Rod references** (David, 2026-10-29), saved in the rod-gear worktree at specs/references/rods/ with a README: rare Frog, epic Tornado, legendary Celestial, divine Apollo (a flaming harp), divine Chang'e (moon and rabbit). The names are placeholders.
- **Meshy:** David: "I NEED YOU TO CONNECT TO MESHY.AI and use meshy as part of your modeling pipeline". It's in the bible's Models rule 3 and lane-rules.
  - API: POST https://api.meshy.ai/openapi/v1/image-to-3d (image_url as a data URI, target_formats glb), poll GET /openapi/v1/image-to-3d/:id. Multi-image, remesh and retexture endpoints exist.
  - The key goes in the keychain as "Meshy API"; it isn't there yet, and David is adding it.
  - Rods r3 waits on the key and a free lane.
- **Creator polish review:** https://claude.ai/artifact/KkE3ppKZjP7o2yP6kxg8Rx (ids cp-*), game/creator-polish 3aa33c58 (from main de87c07f; no migrations).
- **Shipped 2026-10-29 ~02:10:**
  - the village archive stack (village-archive ef90c927, loading 59ef45b9, title-perf 0f470315), plus clothing-v2 ef4e29cd and the guarded residents seed;
  - prod dump prod-before-archive-stack-20261029-0206.dump; applied 20261029055353_catalogue_seed (guarded schedules, no pond or path left); verify clean;
  - deploy uwotsi-n346qmvqg queued at push; confirm Ready.
  Next in this stack: newworld-fixes plus river-softlock (Halloween), after the river agent's study items.
- **Tutorial round 4 review:** https://claude.ai/artifact/VwAEKpT7DJAERc2yACCb3z (ids v4-*), game/tutorial-v2 1fc48ea3.
  - The full vitest wasn't rerun after the integration regex fix, so run it at merge.
  - David's test server (3300, worktree tutorial-test) is moved to 1fc48ea3; HQ saves are tsi.hq.v4.
  - MemberFishing must dispatch tsi:fish-hooked, tsi:fish-caught, tsi:fish-escaped and tsi:fish-end, label its reel panel [aria-label="Fishing reel"], and build its reel with createFishingReel (reelAssist.floor). Wire this at merge, or have the fish-tiers agent do it.
  - The deploy from 3074f1e0 (uwotsi-n346qmvqg) is still to be confirmed Ready.
- **Started:** main-quest r3 (agent a9480728300cbc27c), daily-social r3 (agent aa9470efccfdc282e). David is playing tutorial r4 himself on 3300; his notes are pending.
- **Shipped 2026-10-29 ~02:30:**
  - the new-world fixes (Halloween, residents, fauna, bots, sea fall) and the river soft lock with the study bench (river-softlock 0a77c16a);
  - prod dump prod-before-newworld-fixes-20261029-0227.dump; applied 20261029010000_study_outdoor_bench and 20261029062423_catalogue_seed; verify clean.
- **More rod references** (David, 2026-10-29): Beach ball rod (uncommon; unlocked by winning the beach volleyball minigame 5 in a row, or ranked; the minigame doesn't exist yet) and a Halloween-exclusive limited legendary named "Lantern of the Hollow" (David picked it; this year or next year still to be decided). Both are in the rod-gear references README.
- **Fishing UI round 2 review:** https://claude.ai/artifact/6BQnwE1Bp3uEzeQvrB53cM (ids fui2-*), game/fish-tiers 8a8312da.
  - MemberFishing sends the tutorial's reel events; reelAssist is byte-identical to tutorial-v2.
  - At merge, run the full vitest (the last full run was 44eb2079) and switch --gui-rarity and --gui-holo to --ui-rarity and --ui-holo.
  - Not verified: a real pointer lock, and sound.
- **daily-social r3:** f1db3589. The friends-talk and streak redos are done and the rope poles removed.
  - Migrations re-timestamped: 20261029062500_welcome_week, 20261029062600_resident_friendship, 20261029062659_catalogue_seed (regenerate the seed at merge).
  - The monument model waits for David's go on the Lantern Cairn direction; the agent has stopped. The review page comes once the monument exists, or earlier with the r3 items if David wants it.
- **Beach volleyball lane started** (game/volleyball from main f0be2c5e).
  - David's design is verbatim in the lane prompt and in specs/minigames/beach-volleyball.md once written. It's 2v2, with ranking and a leaderboard.
  - Phase 1: a solo-playable 2v2 against bots in its own arena at /lab/volleyball. Phase 2: multiplayer rooms (needs a Fly deploy). Phase 3: ranked play, the leaderboard, and the Beach ball rod for 5 ranked wins in a row.
  - Right click on the ground defaults to "Call it" (Mine!), with a tip as the alternative, for David to pick.
  - The court's island spot is for David to pick from 2 or 3 proposals.
- **Fishing UI round 2 decisions:**
  - Approved: aim, aim-sand, catch, catch-epic, juice, suspense, suspense-epic, wheel.
  - Redo: before-after ("should still have the ??? and sea tag", given to a light agent); meter and before-after both raise "how to make this mini game more fun rather than repetitive" (ideas sent to David).
  - Merge fish-tiers once the tag fix lands.
- **Volleyball:** David confirmed right click on the ground is Call it (relayed).
- **Volleyball plan change** (David): the court sits at the island's existing volleyball-net (-4, 103.5). The net is remodelled bigger from the existing model, at real proportions. The match starts with E at the net. Players in the match get the full view; passersby get a light one (static court, synced avatars, a low-rate ball, no particles, HUD or AI), measured with perf:check. Relayed to the lane.
- **Tutorial r4 decisions:**
  - Approved: dock, esc, glide, hop, props, reel, sell, small; id with a note (the card shows before the printer line).
  - Redo:
    - keys: back to round 3's keyboard card with less text and a lighter look; drop the bare keyboard;
    - currency: no wallet slot existed;
    - sights: the shop sells in-game items and real merch; the cafe is "study with friends, get rewarded"; keyword icons on every line;
    - kit.
  - Bible rule 8b added: two HUD layers, and the wallet's one slot top right under the time in the Esc 1 view.
  - Tutorial r5 lane started; main-quest told about 8b.
- **tutorial r5** code at 20a6e3eb, shots pending.
  - WalletSlot and HudWallet in TopCluster under the time; the old coins chip removed; hudStore gains gems.
  - Merge with main-quest r3: TopCluster.tsx and its module.css, hudStore.ts and hudPrefs.ts (the FLASH_MS line) conflict lightly. Main-quest's XP chip removal and the tutorial's coin chip removal both apply.
- **Main quest r3 review:** https://claude.ai/artifact/G6Zne7fKcCCaVBUfBcum6G (ids r3-*), game/main-quest 0bf9fa66.
  - Migrations: 20261028144337_main_quest, 20261028153805_main_quest_r2, 20261029064914_catalogue_seed (regenerate at merge).
  - Stamina is in MOVE_TUNING in movement/sim.ts. HudBars sit top left; the old level chip is removed from TopCluster.
  - Conflicts with tutorial r5 in TopCluster, hudStore and hudPrefs: keep both removals.
- **Shipping:** fish-tiers 4b84c125 (the member fishing UI plus playtest fixes) merged. No migrations. Gates: vitest 3517, tsc clean, seeds up to date. Note: its rarity edges still use --gui-rarity-* until main-quest's --ui-rarity-* lands; switch them then.
- **Tutorial r5 review:** https://claude.ai/artifact/GbbF8C1nVDqkyqcSP5UV2w (ids v5-*), game/tutorial-v2 d0346e6e (main and the archive merged).
  - David's test server is moved to d0346e6e.
  - Keyword icons are now the default for every talk line, through a dictionary; there's no *star* markup.
  - Merge conflicts with main-quest r3 (TopCluster, hudStore, hudPrefs, themes): keep both sides.
- **Volleyball phase 1 review:** https://claude.ai/artifact/QfKHX4FBzbjH9pcBc9ZBdC (ids p1-*), game/volleyball c2669f17 (from main f0be2c5e; no migrations).
  - The court is at (-7.5, 103.8), turned a quarter; the shells and gather-shell-2 moved off it.
  - Six questions for David are on the page (the ball refs, animations, residents on the court, sharing the PowerMeter, the match length, casual rewards).
  - perf:check passed (a passerby gets +0 ms; a player in a match gets +1.2 ms).
- **David's volleyball test server:** port 3301, bound to 0.0.0.0, worktree volleyball-test (detached at c2669f17), Supabase blanked. PID in scratchpad/volleyball-test-dev.pid. URLs: /lab/island?at=-7.5,107 (walk to the net, press E) and /lab/volleyball. Kill it, and 3300, when David is done.
- **Volleyball phase 1 decisions (David played it: "the controlsl dont even work properly"):**
  - Approved: island-match.
  - Redo, everything else:
    - controls;
    - feel: a slow-mo ball that speeds up, higher and floatier jumps, squish on every hit;
    - the camera zoom-in and a bigger field;
    - the serve: a triangle meter, rewarded max power, direction from where you click in the ring, a curve contact UI;
    - an action bar with icons that switches in the air;
    - VFX;
    - net remodel; the beach ball from his reference;
    - a leaderboard board and a spectator bench; spectators see a cheap default loop; residents off the court.
  - Answers: one set to 21; a casual win pays chill coins; ranked later pays better rewards, gems and the limited rod.
  - Two lanes:
    - vb-anim (game/vb-anim): Blender clips in vb_clips.glb plus the clips.ts contract;
    - volleyball r2 (game/volleyball): everything else, built against the clip names.
- **Volleyball net and ball page:** https://claude.ai/artifact/BQqmpEUmv69QDGQbUEpmth (ids vb-net-concept, vb-ball). The final net modelling waits for David's go.
  - Casual reward: 15 coins a win, 5 paid wins a day, a server ticket check; migration 20261030120000_volleyball_casual.
  - The decorative beach balls move to the new LP ball.
- **Volleyball:** David approved the net concept (go relayed).
  - Effects plan page: https://claude.ai/artifact/DR29UeZaYKrVSZSrXZ9hPk (ids fx-*; 15 effects plus the performance rule). The VFX build waits for his picks.
  - His ask: "hella effects... bump set spike effect, slide, when ball gets blocked, when it hits the groud it shakes abit and kinda exploads".
- **Volleyball effects approved.** Every contact gets four timing grades (perfect, good, early, late). Each effect is built and checked one by one with its own strip. Sound effects are synthesised or CC0 only, logged in web/public/audio/sfx/SOURCES.md; that rule is now in lane-rules (David 2026-10-30). Music and voice still need David.
- **vb-anim done:** game/vb-anim 73b7739d (16 clips in vb_clips.glb, 463 KB, plus the clips.ts contract and a Character.tsx clip-replay fix). The volleyball lane merges it itself.
  - Animations review page: https://claude.ai/artifact/8EEip8ZMwLPfu6xFxEKMbc (ids are the clip names), so David can redo moves before integration.
  - Limit: the head is 42% of the height, so arms can't go overhead.
- **Volleyball round 2 review:** https://claude.ai/artifact/4hADsrK2pAmYcMVRgEvFDK (29 cards with sound previews), game/volleyball 71b13c9c.
  - Test server 3301 (volleyball-test, detached at 71b13c9c).
  - Migration 20261030120000_volleyball_casual.
  - perf:check v2 failed under load (high 5.40 ms, lite 3.40 ms). Rerun it on a quiet machine before merging.
  - It changed the arrival routes (Bram's beach stop moved off the court), so expect a conflict with tutorial-v2's routes/new.ts at merge.
- **v1.2 release (David, 2026-10-30):** "push all currents update and make sure everything works, v1.2, also ... make sure the performance to enter the game is good". Then: "fix the music, theres liek 3 overlapping music".
  - Three lanes from origin/main 82a3c70b:
    - release-v12 (game/release-v12, port 3320): merges main-quest, tutorial-v2, daily-social, volleyball, creator-polish, rod-gear, fishing-depth, wardrobe-b3 in that order; re-timestamps the unapplied migrations after 20261029062423; restores the applied rarity_ladder rod-gear edited and moves its change to a new migration; one fresh catalogue seed; gates, smoke, one perf:check.
    - music-one (game/music-one, port 3321): one music bed at a time. The ambient channel plays CC0 Ninja Adventure music and the music channel falls back to the applicant's Stream Cafe tracks, both at once, plus the campfire loops.
    - entry-perf (game/entry-perf, port 3322): measures entry on a production build, then fixes and re-measures on v1.2.
  - Prod has no contraband shop rows (224 null, 1 rare, 1 epic, 1 legendary), so the shop_items rarity check without contraband applies cleanly.
  - Then: merge music-one and entry-perf into release-v12, prod dump, apply the migrations in order, verify, push, tag v1.2, confirm Ready, smoke prod, kill 3300 and 3301.
- **v1.2 scope check (David: "make sure everythign works well and new v2 has all changes made you can open browser to test if yo wish"):** every branch ahead of main was checked. Added as merge 9: game/npc-editor 2a67bfb0, plus David's Residents editor look edits (marlo, mayor, sushi-chef, wren). They were exported from collection `residents` to scratchpad/residents-export/residents-export.json and sent to release-v12, to apply before the one final gen-seeds. Superseded and left out:
  - creator-water (its gunwale and boat work is already in main);
  - fish-tiers-ui-r1 (the rejected cream round);
  - perf-v1, asset-audit and asset-thumbs (tools and audits);
  - avatar-v8, classes-launch-tuning, apply-world and director-developer-recruitment (old).
  Testing stays headless, even with David's go to open a browser.
- **v1.2 shipped (2026-10-30 ~21:00):**
  - release-v12 242a0d94 merged as 2e7d7de8: the nine branches, npc-editor and the resident looks, music-one and entry-perf (bee6b4db).
  - Gates: tsc clean; vitest 3728; eslint 0 errors; seeds up to date; build passes. perf:check passed: v2 high 5.00 ms (baseline 4.80), lite 3.00 (2.90). Smoke green.
  - Prod dump prod-before-v1.2-20261030-2057.dump; contraband shop rows 0.
  - Applied, in order: 20261030010000_main_quest, 010100_main_quest_r2, 010200_welcome_week, 010300_resident_friendship, 010400_volleyball_casual, 010500_shop_items_no_contraband, 010600_rod_tackle_slots, 010700_fishing_tasks_sushi, 010800_tackle_rolls, 20261030231818_catalogue_seed.
  - Verify clean: RLS on every table, the same 5 user-callable definers, every new table and function present.
  - Tag v1.2.
  - Entry, Play to move (none cold 6.2 s to 3.9 s, campus cold 13.1 s to 9.7 s, campus warm 9.9 s to 6.2 s).
  - Cache: next.config sends stale-while-revalidate on /assets, /models and /audio. Before the next deploy that changes an asset in place, content-versioned asset URLs must land (entry-perf r2), or a returning player gets the old file once.
  - Entry-perf r2 proposals:
    - lossless WebP for the entry PNGs (about 2.2 MB);
    - meshopt and WebP in the entry GLBs (25 MB raw);
    - cache the character parts per part (skin.glb loads 3 times);
    - colour_atlas.png is 1.9 MB on entry.
  - For David:
    - Juno's gift tastes (proposed: loves fish, likes mineral, hates fruit);
    - the tackle door opens the counter, then Browse rods into the rod shop;
    - the menu paper is a shade lighter;
    - sushi-chef skin 10 was applied as 9.
  - Music: the Ambience slider is idle on the member island. A bug from before v1.2: spawning right at the sushi bar drops its override.
- **v1.2 live check (2026-10-30 ~21:10, play.tethos.ca, deploy of eb1d06f3; headers serve stale-while-revalidate):**
  - Three throwaway accounts through specs/evidence/launch-v1/two-account.mjs. It now uses the shared sb-tethos-auth cookie on tethos.ca hosts, and flow 4 follows v1.2's first-find.
  - Passed:
    - routes: all 200, and the dashboard serves the island;
    - the arrival: the creator, Bram's walk-along, recorded as arrived and taught, realtime Here (1);
    - day: tags, presence, chat both ways, friends, emotes, dance sync, report, mute and unmute live;
    - flow 4: Bram's 30 coins once, a cast and land with the starter rod, the first-find donation (100 coins once, Juno's letter), the second donation refused (409).
  - first-find's claim_plot answers "That isn't open yet" on the new world.
  - Cleanup: users deleted, 172 columns scanned, nothing left.
  - Test servers 3300 and 3301 stopped. Worktrees tutorial-test, volleyball-test, music-one and release-v12 removed.
- **Entry-perf r2 step 1 shipped (main 3590501b, ~21:35):** content-versioned game file URLs.
  - A file with `?v=` is served immutable for a year; a bare file revalidates (round 1's stale-while-revalidate is gone).
  - Live: the arrival passes on play.tethos.ca with a throwaway account (deleted, nothing left), and the spawn still matches.
  - Steps 2 to 5 are running in game/entry-perf: per-part character caching, lossless WebP, meshopt GLBs, the final measure.
- **Entry-perf r2 merged (49f3a243):**
  - What it does:
    - each character part loads once;
    - six entry PNGs are lossless WebP (6.6 MB to 3.8 MB);
    - 217 entry GLBs are packed with lossless meshopt (13.4 MB to 10.2 MB brotli), done by web/scripts/pack-glbs.mjs.
  - Campus cold, Play to move: 9.9 s to 7.8 s. A warm entry sends no game-file requests.
  - Proof: pixel-identical; perf:check passed; packed fish caught live on the member reel with identical meshes.
  - Lane-rules: rerun pack-glbs.mjs after every Blender export.
  - Proposed, not done: quantized meshopt (needs David's eye), packing the character GLBs (2.5 MB), and gltfsOf for ACNHBuilding (the shop door is parsed 4x).
- **Entry-perf r2 live (main 42a3bd3f):** the arrival passed on play.tethos.ca with a throwaway account, and the creator and spawn render the same with the WebP textures and packed GLBs (accounts deleted, nothing left). The entry-perf worktree is removed.
- **Title wording (David, 2026-10-31: "for the game, dont do like say student portal"):** 25d37655 renames the title wordmark to Tethos / ISLAND, the tab to Tethos Island, and the member-facing "portal" copy (settings hint, announcements note, admin heading "Club tools"). Live and shot headless. The marketing nav and footer links and the applicant pages still say portal (out of scope).
- **Development resumed (David, 2026-11-01: "resume development what do you need from me").** Unread decisions found: volleyball r2 (all 29 cards, 2026-10-30) and creator polish (dissolve rejected: "a more chill subtle hair change"). Main quest r3, tutorial r5 and the animations page have no decisions yet. Five lanes started from origin/main:
  - volleyball r3 (game/volleyball, `uwotsi-lane`): David's round 2 notes, verbatim in its lane file.
  - fishing-depth r4 (game/fishing-depth, `uwotsi-lane`): board season and conditions, the bigger catch board, instant quick sell, the sushi cover and spread 1, sushi mechanic proposals. The gacha chest animation is its own lane later.
  - title-r2 (game/title-r2, `uwotsi-lane`): the title's left side as a game title screen, three directions for David.
  - polish (game/polish, `uwotsi-lane`): the creator's calmer hair change, the rod bag and shop fixes, the Lighthouse rod's lamp.
  - fixes (game/fixes, `uwotsi-lane-light`): sushi bar music on spawn, the idle Ambience slider, shared GLTF parses, packed character GLBs.
  - Waiting on the Meshy key: the new rod roster, the bait and bobber remodels, the sushi dish models, the gacha chests.
- **Meshy pipeline (David, 2026-11-01: "add meshy.ai as apart of your modeling pipeline, and edits are done on blender"):** 887445b5 on main. `art/meshy/meshy.mjs` (image, multi-image or text to 3D, key from the keychain, raw output in the untracked art/meshy/raw/, credits in art/meshy/log.md) and `art/meshy/clean.py` (scale, pivot, facing, merged mesh, sized textures, HD and LP; tested on house-common.glb). Design bible Models rule 3, lane-rules and CODEMAP say every edit after a generation is Blender. The key is still missing ("Meshy API"); the four Opus lanes were told.
- **Title-r2 review:** https://claude.ai/artifact/4Jp1L8AExKJUB3a6EMvuoq (ids title-now, title-a, title-b, title-c, title-forms; collection `approvals`), game/title-r2 122adbf0 (from f9cebe44; main not merged). Dev switch `?titleStyle=a|b|c`. After the pick: delete the other two and the switch, reshoot, gates. Not watched (the 25-watch limit): read the collection when David says he's done.
- **Polish review:** https://claude.ai/artifact/5zkui4Z6BnxXpxi3uPq5UG (ids pol-*; collection `approvals`), game/polish dd33a5d2 (from f9cebe44; main not merged). The creator's soft hair cross-fade, the bag rod line and bobber, the teal build shape, shop spacing, the 2.5 px outline, the Lighthouse lamp (rod-4.glb 361 to 565 tris, left unpacked like the other rods). Not watched; read the collection when David says he's done.
- **Volleyball r3 review:** https://claude.ai/artifact/33uq4E6vA6ue4tDoc7iMrb (27 cards, ids p3-*, sound previews; collection `approvals`), game/volleyball d60d77e6 (origin/main 887445b5 merged). No migration. perf:check v2 failed under load (high 5.20 ms +8.3%, lite 3.40 ms +17.2%, the same lite as r2; draws flat): rerun on a quiet machine before merging. Not verified: sounds by ear, podium with a signed-in look, E at the board, sitting on bench 2. Not watched.
- **Fixes merged and pushed (main 3f9f2b4d):** sushi bar music on spawn (barEarshot), the idle Ambience slider removed, shared lib/game/gltfsOf.ts (door 4x to 1, 276 parses to 267), character GLBs packed losslessly by sync-character-assets (41 files, about 80 KB brotli; identical). Gates: tsc clean, build ok, vitest 3732 passed with 1 load timeout (shoreField village, passes alone in 4.3 s). Live on play.tethos.ca: routes all 200, the arrival (creator with the packed characters, Bram, recorded, Here (1)) passed; throwaway accounts deleted, 172 columns scanned, nothing left (scratchpad/v12-prod4).
- **Fishing r4 review:** https://claude.ai/artifact/M1Fmq25P845oHtfemUPxy5 (ids f4-*; collection `approvals`), game/fishing-depth 0db249b4 (on 887445b5; no migrations). The catch board is at spot B; the cover uses line 1; the signs are a mock; three sushi mechanic proposals (f4-mechanic). perf:check v2 failed under load (high 5.3, lite 3.4, draws +2.5%): with volleyball's, run one combined check on a quiet machine and refresh the 2026-10-14 baseline if main alone shows the same. Not watched.
- **All five lanes reported; none running.** Waiting on David: title-r2 (4Jp1L8AExKJUB3a6EMvuoq), polish (5zkui4Z6BnxXpxi3uPq5UG), volleyball r3 (33uq4E6vA6ue4tDoc7iMrb), fishing r4 (M1Fmq25P845oHtfemUPxy5), main quest r3 and tutorial r5 (no marks yet), and the Meshy key.
- **David's marks read (2026-11-01 evening, "feedback given"):** polish all approved (pol-lighthouse: "this rod when held also shines light and gives character glow halo like holding a lantern"); volleyball r3 mostly approved, redos on the callout text, impact frames, three sounds and the podium; fishing r4 redos on the catch board (seasons not months, colour chips, new spot right of the stands and left of the fish shop, remodel), showroom captions out, cover line 3, signs approved to build, sell instant, dish models via Meshy; f4-mechanic: build the tasting book (a fish becomes a meal with buff and stamp, or goes to the aquarium), dinner service next launch. Title-r2, main quest r3, tutorial r5 and animations still unmarked. Verbatim notes are in each lane file.
- **Polish merge held back:** the full vitest run failed two tests on the new lamp (heldMesh: rod-4 2 meshes, budget: 6 primitives and 6 materials over the tool's 5). The local merge was undone; the fix is polish r2's item 0, and the lane messages "main" with the SHA, then the coordinator merges round 1.
- **Four lanes running (2026-11-01 evening), all `uwotsi-lane`:** polish r2 (rod-4 fix, lantern glow, interact glow and ring), volleyball r4 (game/volleyball), fishing-depth r5 (game/fishing-depth), tasting-book (new, game/tasting-book from fishing-depth 0db249b4, port 3476, will need a prod migration). Before merging volleyball or fishing: one perf:check on a quiet machine.
- **Polish round 1 live (main 4fb4b8cc, polish 5b58b09a):** gates tsc clean, build ok, vitest 3732 passed with the known shoreField village load timeout (passes alone). Live on play.tethos.ca: routes all 200, the arrival (creator, Bram, recorded, Here (1)); throwaway accounts deleted, 172 columns scanned, nothing left (scratchpad/v13-prod5). The lamp glass is plain amber until polish r2's held lantern.
- **Title: David picked C** (2026-11-01, in chat: "i already chose C"; the page's `approvals` was empty, so his marks there didn't save). title-r2 lane (`uwotsi-lane-light`) deletes A, B and the switch, reshoots, gates. The flat sign-in form is still open.
- **Title C live (main 98e42ab8, title-r2 aeff3471):** the lane's gates on the identical tree (tsc clean, build ok, vitest 3732 with the known shoreField timeout). Live check passed (routes 200, arrival, Here (1)); accounts deleted, nothing left (scratchpad/v14-prod6).
- **David playtesting (2026-11-01 night)** on a local signed-out server: `.claude/worktrees/playtest` (detached at 4fb4b8cc), `next dev -p 3390 -H 0.0.0.0`, Supabase blanked, http://localhost:3390/lab/island?arrival=1. Kill it (the node on :3390) when he's done, then remove the worktree. Signed out, progression is the static previewState, so the first catch never ticks (his "stuck" at Juno). Offered a throwaway prod account; no answer yet.
- **More lanes (same night):** tutorial-v2 r6 (his playtest notes, the round 5 marks, the bug "It got away" toast), main-quest r4 (vitals, XP ring, level up, sand), vb-anim r2 (dramatic dive, movement with weight, proportion preview only; owns vb_clips.glb). Queued: the dug-up treasure list (rarity and purpose first, models after his OK).
- **Tasting book review:** https://claude.ai/artifact/EiDyNe9y7NbVrF5CkHCeyS (ids tb-*, tb-numbers and tb-questions are tables; collection `approvals`; not watched). game/tasting-book 006725bc, on top of game/fishing-depth: merge fishing-depth first. Migration `20261101120000_tasting_book.sql` (tasting_book, tasting_serves with RLS owner-read and writes revoked; `tasting_serve` definer, service_role only, so the verify baseline's 5 user-callable definers stay 5): apply to prod at the merge. The builder's lede bug (pages since title-r2 showed `" + sys.argv[4] + "`) is fixed in title-r2/build.py.
- **Treasure lane started** (game/treasure from 98e42ab8, port 3478): round 1 is the list only (`specs/treasure.md`), for a review page.
- **Volleyball r4 review:** https://claude.ai/artifact/KxJpWfHN8dd5rddG1Lrajm (16 cards, ids p4-*, sounds; collection `approvals`; not watched). game/volleyball fa080668 (origin/main 3f9f2b4d merged). perf:check v2 failed under load again (high 5.70 +18.8%, lite 3.80 +31%, load 5.5 to 7.5; draws flat, the v2 scene has no match): the quiet-machine rerun before merging still stands. Full vitest not rerun after one test fix (88 volleyball tests pass). Out and Tape moved under the score with Net (Out was approved in r3; flagged on the card).
- **Treasure r1 review:** https://claude.ai/artifact/M11g6fDwzN2UzVCrr2VLnw (ids tr-*, all tables; collection `approvals`; not watched). game/treasure dad21a37 (`specs/treasure.md`, docs only). 28 finds; 21 Blender-only can start without the Meshy key, 7 wait for it. tr-questions holds my picks on nine calls (Founder keepsakes unsellable, Sudo shown as Divine, a finds wing when the museum opens, fixed share per rarity, recipes may use finds, geode stays a museum piece, event finds kept, home shelf later, references only from David or text prompts: never fetched).
- **Tutorial r6 review:** https://claude.ai/artifact/FLaWaoHYevUpA14EKAkENX (13 cards, ids t6-*; collection `approvals`; not watched). game/tutorial-v2 5bf9a946 (from origin/main 4fb4b8cc). Gates: tsc clean, full vitest 3737 passed, eslint clean; no perf (camera and UI only). Migration `20261101230000_profile_pronouns.sql` (profiles.pronouns text, 24 chars max): apply to prod at the merge. Playtest server stopped 23:35 (idle an hour, swap at 12.9 of 13.3 GB); the playtest worktree is kept for a restart.
- **Fishing r5 review:** https://claude.ai/artifact/QGHxuaAFtRLX9Yun6rx6Uq (18 cards, ids f5-*, f5-seasons is the season-change table; collection `approvals`; not watched). game/fishing-depth 34a84a7d (main not merged this round). Migration `20261102031338_catalogue_seed.sql` (fish rows in whole seasons): apply at the merge, after or with the tasting book's. perf:check v2 failed under load (high 6.4 +33%, lite 3.9 +34.5%, draws 382 +6.4%, about 10 new draws from the board and signs): the quiet-machine rerun before merging still stands. The tasting book (006725bc) sits on 0db249b4, so it needs fishing-depth's r5 merged into it before its own merge.
- **Polish r2 review:** https://claude.ai/artifact/AdBQ3wtaW2xWdv5JxpXdDA (13 cards, ids pol2-*; collection `approvals`; not watched). game/polish 9046635a. Lantern (LanternGlow.tsx, two additive draws per holder, no light) and the interact ring (InteractRing.tsx, one shared ring and glow, `RING` table per Near). perf:check v2 failed under load (high 6.5 vs 4.8, lite 4.0 vs 2.9; draws within tolerance; neither effect draws in the bench). Quiet-machine perf rerun owed for polish, volleyball and fishing together.
- **Main quest r4 review:** https://claude.ai/artifact/BNWtSh7obrfHW7S5EAZ39E (11 cards, ids mq4-*; mq4-bible asks to update bible UI 8b; collection `approvals`; not watched). game/main-quest 9f2d48eb, no new migrations (the lane file's "unapplied r3 migrations" are stale names: they went to prod as 20261030010000/010100 on 2026-10-30). perf:check v2 failed under load (high 6.7, lite 3.7). Full vitest 3733 with 2 failures: shoreField (load) and `lib/study/study.test.ts` "demo scenarios land in the phase they claim", which fails on main too in the first minutes of a week (the "ended" demo session started last week, so this week's minutes are 0). Pin its clock when convenient.
- **David's marks on all seven pages read (2026-11-02 ~00:30).** Verbatim notes are in each lane file's new round. Tutorial r6 merged locally (766a7f9d) and in its gates; apply `20261101230000_profile_pronouns.sql` to prod BEFORE pushing (the profile reads select pronouns). Six fresh lanes from their lane files: volleyball r5 (text tag redesign, character-only white flash on dive, spike frame without lines), polish r3 (clear small lantern, thin white ring, no ring on benches, people, small things), fishing-depth r6 (icon-only board rotated 90, moving fish, signs out, biome on the reel and a HUD tag, coin fly to the wallet), main-quest r5 (vitals, low-health vignette, level up without the white card, phone HUD, bible 8b), tasting-book r2 (permanent 1% per first cook with a cap, fee from 100 scaling, dishes with ingredients), treasure r2 (list rewrite: crafting materials per class, Fallen Star series, Contraband, geode tiers, 1 in 600). tutorial-v2 r7 notes committed (7131a47c); spawn after the r6 push.
- **Open with David:** "i need you to expand this fishing catagory" (asked what "this" is).
- **Tutorial r6 live push (main 1ae98ff6):** pronouns migration applied to prod first (dump pre-pronouns, apply [], verify baseline unchanged, logged), the study test pinned to a mid-week clock. Live check running (scratchpad/v15-prod7). Spawn tutorial-v2 r7 from its lane file (7131a47c) when a lane slot frees.
- **Tool pipeline (David, 2026-11-02):** profile collages of our rods, style text, ElevenLabs image turnaround (GPT image model), Meshy multi-image, Blender edits; pitch every concept batch as an artifact before Meshy, for rods, new fish (fish-list lane) and new gear (treasure lane). Lane tool-pipeline (game/tool-pipeline from 1ae98ff6) does the collages, style sheets and prompts; the coordinator runs the ElevenLabs step. ElevenLabs MCP OAuth link sent to David (scope includes image_video_generation); Meshy key still missing. Memory: feedback_tool_version_pipeline.
- **ElevenLabs connected (2026-11-02):** MCP creative tools, default image model gpt-image-2.5-sunburst ("GPT image 2.5"), references via asset upload on a flow. Spends David's credits: estimate_only before batches, never re-call to retry. **Meshy paused** (David: "dont use meshy as for now, just try to replicant the same output through using blender and modeling it from the multi angle designs"); the keychain "Meshy API" item holds an invalid 10-character value (401). Lanes told: tool-pipeline, treasure, fish-list.
- **Treasure r2 review:** https://claude.ai/artifact/XMRD15iGrcSYQDzXcUT51Q (ids tr2-*, tables; collection `approvals`; not watched). game/treasure 458c9a4d. 41 finds; Contraband conflicts with the staff-only tier in web/lib/rarity.ts (no drop may grant it, enforced by rarity.test.ts): option A widens it (my pick), B makes it a category with the Sudo shown as Divine.
- **Fish list r1 review:** https://claude.ai/artifact/DLfnEVT1VFBPamnBsD25Fz (ids fl-*, tables; collection `approvals`; not watched). game/fish-list af6dfd24 (`specs/fish-list.md`, docs only, on top of fishing-depth). 91 fish today, 24 new, six legendary and Divine creatures (Imugi, Megabyte, Kraken, Ness; Leviathan, Longwang), 47 materials with a part per subclass. Odds from the game's own fishPoolFor. Found: the shut pond makes the Golden Koi uncatchable (Koi kimono recipe blocked); the starter rod gets nothing from a max cast; cliff pool fish bite in the river while the tasting book says "Opens later". The builder (title-r2/build.py) now wraps tables in a horizontal scroller.
- **Tutorial r6 live:** live check passed on play.tethos.ca after 1ae98ff6 (routes 200 incl. /api/profile with pronouns, arrival, Here (1)); accounts deleted, nothing left (scratchpad/v15-prod7). tutorial-v2 r7 lane started.
- **Rod pitch:** https://claude.ai/artifact/XqZK2hk32ydhYjbKFhhwFJ (ids rod-*; David writes the take number in the note; collection `approvals`; not watched). ElevenLabs flow uEdL9XS2ujph5Vym47E9 ("Tethos rod concepts"), gpt-image-2.5-sunburst, 3:1 2K high, wired to our rod collage. Six rods: Carrot 4 takes, Precision 2, Training 3, Riptide 4, Titanium 3, Tempest 3 (four failed: the plan's credits ran out, about 316 left of 51,736; this batch cost about 8,540). Full sheets in scratchpad/rodgen/sheets/ (about 1.4 MB each, keep out of git; only picks go to art/pipeline/concepts/ as webp). Fish and gear concepts need more ElevenLabs credits: David's call. tool-pipeline r1 done (6b8d73ab): profile.py, collage.py, blueprint.py, the style sheets and prompts for rods, fish and gear.
- **Animation r2 review:** https://claude.ai/artifact/M1HTvLzLz4uKK69HniV1G5 (ids an2-*; collection `approvals`; not watched). game/vb-anim 573d1cea. New vb_dive (contact hand higher, y 0.378 to 0.513; match.ts HAND.dig is generated from it, so merge vb-anim before or with volleyball and regenerate), IK Walk and Run, Dash, rebaked slides, `leanStep` in juice.ts, gentle pushes on six vb clips, the proportion preview (/lab/avatar &bones=). Clips swapped into v8_clips.glb by web/scripts/swap-glb-clips.mjs (keeps meshes and hidden-cut marks), hidden_cut bodycut re-run. perf:check v2 failed under load (+42/+45% frame, draws and tris flat). Skirt drape not re-fitted against the new run.
- **Tasting book r2 review:** https://claude.ai/artifact/R5ytwGPwnom5jxWo6e5rPb (ids tb2-*; collection `approvals`; not watched). game/tasting-book 90f6b6b4 (fishing-depth 34a84a7d merged in at ebe2457d). Migration renamed and rewritten in place: `20261102120000_tasting_book.sql` (after fishing's 20261102031338 seed); `tasting_serve` (new signature, fee computed server-side, refuses filled slots) and `tasting_dish` (not_learned until the key fish is cooked; ingredients, coins and buff in one transaction), both service role only. The permanent bonus is derived from stamps (`bookLuck` in rules.ts), no column. Fee 100 + 5 per species cooked; bonus +1% each to 20, then +0.5%, cap +40%. One dish built (Snapper chazuke), four proposed.
- **Polish r3 review:** https://claude.ai/artifact/5abM7CNG3eqEsXY3qHGFgR (ids pol3-*; collection `approvals`; not watched). game/polish 020c16e0. Lantern a small warm-white tip light (halo a fifth of r2, no haze); ring a thin white line (opacity 0.22, glow 0.05, `--ui-card`); RING table drops benches, stools, mailbox, lantern pickup, cocoa, picnic. vitest 3733, tsc and eslint clean; no perf run (owed with volleyball and fishing on a quiet machine).
- **Main quest r5 review:** https://claude.ai/artifact/LXxnPfXbcf6wQZmxAgwbZH (ids mq5-*; mq5-vitals note says "bare" or "card"; collection `approvals`; not watched). game/main-quest 935f1ca2. The lane found round 4's commit 2c0e4fc2 had inlined `process.env.NODE_ENV` as ("development" as string) in 46 files (dev-only code would have run in prod); fixed on the branch, never on main. Before merging main-quest: `git grep '("development" as string)' -- web` must be empty. Low-health vignette and desaturation ride the existing PostFX grade pass (two uniforms), no new pass. Phone camera 1.3x further back on every touch screen (tablets too). Bible UI 8 and 8b updated; the ledger row is the coordinator's to number.
- **Volleyball r5 review:** https://claude.ai/artifact/Wx6Sm6NVC5gC2eo73tdGsS (ids p5-*; p5-calltag note says A, B or C; collection `approvals`; not watched). game/volleyball 20b2b1fa (origin/main not merged since 3f9f2b4d). CallTag kit piece in three looks (Chip in game until the pick), block tag back with a slam, dive = 8 white frames on the character only (PlayerAvatar body group named `player-body`), perfect spike one frame without lines (dev switch for lines). vitest 3748, tsc and eslint clean, 29/29 real-input. After the pick: delete the two unused looks and both dev switches.
- **Fishing r6 review:** https://claude.ai/artifact/MjtzeKrEZESrahRE1YLo9S (ids f6-*; collection `approvals`; not watched). game/fishing-depth fc380862 (main not merged since 887445b5). Icon-only board turned 90 toward the wharf (from the stall you now see its side; flagged), roof fish sway, sell-bin fish in their own sell-fish.glb flop, water signs removed, biome tag on the reel bar and in the HUD left of the time (top right), coin fly (3 to 12 coins to the sheet's wallet or the HUD wallet, rising synthesised coin sound logged CC0). r5 seed migration still unapplied. Not shot: the board face on phone.
- **Tutorial r7 review:** https://claude.ai/artifact/CZ2GaCgveWyeVh13EewDS8 (ids t7-*; collection `approvals`; not watched). game/tutorial-v2 a2d4fe6d (origin/main 1ae98ff6 merged), no migration (the ID show-off reuses the showcase table's first slot; old slots 2 and 3 cleared on save; the three-slot sheet and the companion's showcase button deleted). Signed-out quest runs on an in-memory copy of the quest logic in dev and tests only (same no-server check as the dev fish sale).
- **All lanes reported (2026-11-02 ~03:00).** Nothing running. 10 review pages open (see above). Next: one perf:check on main while the machine is quiet, to tell load from regression for the r4 to r6 failures.
- **perf:check on main alone (2026-11-02 ~02:10, no lanes running, load 5.3 to 5.6 from other apps on the GPU):** v2 high 6.60 ms (+37.5% on the 2026-10-14 baseline, over the 6.5 budget), lite 3.60 (+24.1%); draws 364/288 and triangles flat. The lanes' r4 to r6 numbers (high 5.7 to 6.7, lite 3.7 to 4.0) are the same as main's, so none of them is a branch regression. Not refreshing the baseline under this load. For merges: run main and the branch back to back under the same load and compare the two, not the old baseline.
- **Rod pitch marks read (2026-11-02):** Carrot approved (thicker, uncommon), Precision approved, Training approved (easter-egg common, never sold, stats like uncommon to rare, upgrade potential, plus a per-rod catch tracker for all rods); Tempest, Titanium, Riptide redo ("not cool"); epic rods must "look epic ... more exaggerated with effects and get like default idle animatinos"; Tidewarden "not even epic"; Cedar gets leaves; Glass cooler or uncommon. David sent two new references (Tempest, Titanium), saved untracked beside his Oct 29 set in rod-gear/specs/references/rods/ (README updated). Two lanes: tool-pipeline r2 (models, effects, idle animations, pitch evidence; Blender only) and rod-gear r4 (roster entries, Training unlock and stats, catch tracker, maybe a migration).
- **Rod data review:** https://claude.ai/artifact/LNrapLgneyk16D14xRTVsi (ids rg4-*; collection `approvals`; not watched). game/rod-gear 5d96e4c1 (being re-timestamped: its rod_catches migration collided with tasting-book's 20261102120000; asked for 20261102170000_rod_catches and 20261102170100_catalogue_seed). rod_catches adds catch_rolls.rod_key and a rod_catches table, changes the cast and land functions (land counts per rod and grants the Training rod at the 50th Flimsy fish). **Apply rod_catches before the code deploys** (the new cast sends the rod; old code still works on the new function). Training rod: found at 50 Flimsy fish, +5 all stats at 25/75/150, never sold. Stand-in models until tool-pipeline r2's land.
- **rod-gear re-timestamped (ae9ba966):** `20261102170000_rod_catches.sql`, `20261102170100_catalogue_seed.sql`. Apply order at the merge: rod_catches before the code deploys, then the seed. Main's SQL smoke chain (specs/evidence/launch-fixes/sql-smoke.sh) was missing the applied pronouns migration: added on the coordinator branch. `world_chat_smoke` fails on main's own chain at its "the rest" check (pre-existing, not from any lane): open item.
- **Rod models review:** https://claude.ai/artifact/LFoFkQq2pABPtHPEZS4A7L (ids rm2-*; rm2-titanium note says epic or rare; rm2-glass Redo "uncommon" keeps the old Glass, which is at 576859f6; collection `approvals`; not watched). game/tool-pipeline ca59bb39 (polish 020c16e0 merged in, so polish must merge first). Nine rods in tools/ (Cedar, Glass, Tidewarden replace rod-2/3/5 in place; new rod-carrot/precision/training/riptide/tempest/titanium), effects in props/rodfx-*.glb via RodAura.tsx (Tempest 5 draws, Titanium 5, Tidewarden 4, Riptide 1). perf:check with Tempest held: high 7.0 (+46%), lite 3.8, draws +5; machine loaded; compare back to back with main at merge. rod-gear must wire the six new files and mount RodAura in the shop's RodStage.
- **TSI Game vault (David, 2026-11-03):** a separate Obsidian vault at `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/TSI Game/` (hub "Tethos Island"), built by a background agent with `~/Developer/claudebrain-tools/sync_tsi_game.py`. Standing rule (lane-rules "The game vault", memory feedback_tsi_game_vault): every review page, set of marks, reference, concept and asset gets a tagged, linked note there; chats summarized per day. The coordinator files them as they happen, using the vault's `Templates/`.
- **TSI Game vault built (2026-11-03):** 161 MB; 24 day summaries (306 of David's messages, 67 pasted images recovered), 127 review notes (107 pages with marks, 989 cards, read from approvals and older collections: picks, sections, decisions, results, pricing, notes), 12 reference sets, 22 system notes, 19 people, Timeline, Decisions (1,289 lines), 542 assets copied (icons, sfx, music) and 1,508 catalogue entries, 175 canon docs. Refresh: `python3 -I ~/Developer/claudebrain-tools/sync_tsi_game.py` (marks from saved copies in `~/Developer/claudebrain-tools/data/tsi_game/`, refreshed by a Claude session before a sync). Found: contradictions in David's decisions (shovel odds, rod rarities, gem sources) listed as open questions in the system notes; the Sudo canon spec (docs/sudos-canon) is gone from the repo.
- **Title note found late:** title-c's note ("take the option a diamond dot, the sign in ui needs to be simplified and to make cleaner") saved 2026-11-02 02:37 UTC, after the 11-01 read. title-r2 r3 lane started (aadabfbf).
- **Marks read on all open pages (2026-11-03):** polish r3 and animation r2 fully approved: merged locally (f8a08069, 380a5762), gates and one perf:check running (compare to main's 6.60/3.60 under the same load). Next rounds written into nine lane files: volleyball r6 (Chip only, spike lines fewer and shorter), fishing-depth r7 (place name in the biome tag under the time, tag heights, board to the barrels' spot, fix the laggy reel), tasting-book r3 (key fish only, aquarium earns milestones and unlocks, cooking only the bonus, buffs in the six stat names, faint buff icon on the right, calmer phone), main-quest r6 (keep the vitals card with room for a third bar, the reveal centred on the unlocks), tutorial-v2 r8 (Settings back in the Esc bar and a simpler bar, no ID show-off, HUD and map previews point at the real UI, old wheel preview above the keyboard card), tool-pipeline r3 (Cedar foliage like a cedar tree), rod-gear r5 (Training level UI compact, wire the new models and RodAura in the shop), fish-list r2, treasure r3. fish-list and treasure started; the code lanes start after the merge's perf run. Not marked yet: Tempest, Titanium, Tidewarden, Riptide (rod models), most rod data cards, title r3.
- **Treasure r3 review:** https://claude.ai/artifact/DPY2vfZ3eKuRUV71i6zTcY (ids tr3-*; game/treasure 6e7518d6; filed in the vault).
- **Polish r2+r3 and vb-anim r2 pushed (2026-11-03):** gates tsc clean, build ok, vitest 3735 with 5 load timeouts (loopback, shoreField, budget network, cells, walk) that pass alone (39/39). perf:check under load 8 to 24 (Roblox and another session's headless browsers): high 7.6, lite 5.0, but draws 360/285 and triangles flat versus main's 364/288, so no added render cost; frame times not comparable at that load.
- **Fish list r2 review:** https://claude.ai/artifact/Q4u9e7MMD9CumnCqUEEcdu (ids fl2-*; game/fish-list af89ab07; filed in the vault).
- **Polish r2+r3 and vb-anim r2 live (main b56f3c36):** live check passed (routes 200, arrival with the new walk, Here (1)); accounts deleted, nothing left (scratchpad/v16-prod8).
- **Volleyball r3 to r6 merged and pushed (main 18362223)** (Chip tags, 12 short spike lines; every earlier card approved), plus a 20 s timeout on the slow shoreField village test. Live check running (scratchpad/v17-prod9).
- **Rod data r5 review:** https://claude.ai/artifact/1sHjWWpEULGjw1m2rTgeF9 (ids rg5-*; supersedes the unmarked rg4 cards). game/rod-gear 6ba4e7ac (tool-pipeline merged in). Riptide, Tempest, Titanium have models but no roster entries: asked on rg5-epics.
- **Volleyball live (main 18362223):** live check passed (routes 200, arrival, Here (1)); accounts deleted, nothing left (scratchpad/v17-prod9).
- **Weekly usage limit hit (2026-11-03 evening), reset 2026-11-04:** five lanes stopped mid-round (fishing r7, main-quest r6, tasting-book r3, tutorial-v2 r8, tool-pipeline r3) and were resumed by message; no locks or dev servers were left behind.
- **Cedar r3 (tool-pipeline 12e77616)** added to the rod models page as card rm3-cedar (republished, same URL, marks kept).
- **Main quest r6 review:** https://claude.ai/artifact/VKAEfjZnWuPR6QStdT9H2A (ids mq6-*; game/main-quest 061f5e0d; vitest 3745 clean; filed in the vault). Its lane file still calls the round 3 migrations unapplied: they are applied (20261030010000/010100).
- **Tasting book r3 review:** https://claude.ai/artifact/9TZdz2Gtq8aNbN1AiqVaJQ (ids tb3-*; game/tasting-book d65a27f0; migration changed in place, unapplied; filed in the vault).
- **Tutorial r8 review:** https://claude.ai/artifact/B7SrDpE4EsdadjUSnXKYes (ids t8-*; game/tutorial-v2 1c6f8205; vitest had 7 load timeouts at load 30 to 56, two still slow alone: shoreField village (now 20 s on main) and world/generate 'is the same twice'; showcase API left unused; filed in the vault).
- **Fishing r7 review:** https://claude.ai/artifact/4iTHWu7zSStkHNk8K66tb6 (ids f7-*; game/fishing-depth b0a08b8f, origin/main 18362223 merged; filed in the vault). The reel fix (interpolated bar every frame; click setup and follow camera no longer re-render the island) is a candidate to ship ahead of the rest once David approves f7-reel. Board and barrels moved in both world.json and the generator. "Meadow" vs David's "plains" asked.
- **All lanes reported (2026-11-04).** Nothing running. Open review pages: title r3, treasure r3, fish list r2, rod models (Cedar r3 and the four epic and rare rods), rod data r5, main quest r6, tasting book r3, tutorial r8, fishing r7.
- **Marks read on 8 of 9 pages (2026-11-04 ~13:00):** fishing r7 not marked. Filed in the vault (each review note's marks table, Reviews.md counts, marks copied to claudebrain-tools/data/tsi_game/approvals). David answered two rod questions: the Training rod has three awakenings (50, 250, 1000 fish to rare, epic, legendary stats), hidden; epic and up show a fish-caught bar. Seven lanes started: tutorial-v2 r9 (in-game phone replaces the Esc bar, no Tethos Island title, H and M pieces fly in), tasting-book r4 (menu on the counter, no Menu or Leave buttons, Lasts: Permanent, tank give at HQ, luck cap +20%; migration changed in place), main-quest r7 (Level up centred, stamina ")" arc at 25% and under, vitals reimagined), rod-gear r6 (awakenings, the 35-fish trade quest, stats rescaled, passives, prices, rod box arrows, Riptide/Titanium/Tempest on the roster; both migrations changed in place), fish-list r3 (done, c499ac90, spec only: drops 60/70/80, reel tasks that move out of the bar; two open questions in its section 12), treasure r4 (star names, Rusted and Sturdy shovels plus options, archaeology dig pitches), title-r2 r4 (staged night scenes, moving; David is sending a scene reference: forward it to the lane). tool-pipeline holds: Tempest, Tidewarden and Riptide wait for David's references, Titanium's aura is redone with them; Cedar r3 (rm3-cedar) unmarked.
- **Title r3 + r4a merged (908d1664):** flat simpler sign-in, option A's diamond, teal Sign in, Apply to TSI off the title, flat Settings (FlatToggle, FlatSlider). Gates: tsc 0, vitest 3755 passed, build ok. No migration.
- **Treasure r4 review:** https://claude.ai/artifact/R2wR6DoWzbc1CD6QJ3GdBd (ids tr4-*; game/treasure 864ef91d; spec and pitch only, /lab/dig mock page; filed in the vault). The spec still carries round 3 questions 5 and 6 (Maker's Driver, selling) as open: they are answered (nobody's; crafting only); fix that line next round.
- **Title r3 + r4a live (main f3d24212):** live check passed (routes 200, arrival, Here (1)); accounts deleted, nothing left (scratchpad/v18-prod10).
- **Main quest r7 review:** https://claude.ai/artifact/W9eXPZWT3w3xfwpfp1eqiE (ids mq7-*; game/main-quest c189026e; vitest 3760 clean; env grep empty; three vitals looks behind a dev-only `?vitals=` switch, Capsule default; after David's pick delete the other two; filed in the vault).
- **Tutorial r9 review:** https://claude.ai/artifact/99FLDZKNXT2AG9KJ9uBn4M (ids t9-*; game/tutorial-v2 598cf8b2; vitest 3757 with keys.test.ts fixed (it used Y as its free key), 116 related tests rerun clean; filed in the vault). The phone is bible UI rule 8d: **the ledger row is the coordinator's** (record it at merge). Risk noted in its lane file: an account that already bound Y fails the duplicate-key check and reads as defaults. Main-quest and tutorial both touch the HUD and lab/gui: expect conflicts at merge.
- **Tasting book r4 review:** https://claude.ai/artifact/M4Z2KdpsLFTQwTuTgakqiY (ids tb4-*; game/tasting-book 96d877f0, origin/main 18362223 merged in; vitest 3774 clean; SQL smokes pass; migration changed in place (full-water check counts cooked slots), unapplied; filed in the vault). The counter menu is a stand-in card: its model goes through Blender (Meshy paused), not "until a Meshy model exists" as the lane wrote.
- **Phone model (David, 2026-11-04):** "phone model, make it 3d blender with a slide up animation", with a slider-phone reference (third-party, Pochacco stickers: never modelled). Saved untracked at tutorial-v2/specs/references/phone/ and in the vault (References/Phone references). tutorial-v2 r10 started on 58e4167c (Blender model, slide-up, the app grid on its screen, cheapest 3D-reading build). Round 9's page is still unmarked: forward its marks to the lane if they arrive mid-round.
- **Rod data r6 review:** https://claude.ai/artifact/YSyC1PSg7s3yeftBuVcdJu (ids rg6-*; game/rod-gear c3d825ca, origin/main 18362223 merged in; vitest 3787 with one real failure fixed after the run (toolWheel.test.ts, Training now tier 1; passes alone 15/15; **rerun the full suite at merge**); SQL smoke clean except main's pre-existing world_chat; both migrations changed in place: `rod_training_trade(uuid)` service role only, land no longer grants; filed in the vault). Not built: Tempest's source, the aura per awakening, the rod seller's name. The quest and a real awakening were not run on the island.
- **Title r4 review:** https://claude.ai/artifact/QnVxdw2Md7ZF9sPoGjoti4 (ids title4-*; game/title-r2 2ad83248 (4b c5e58a73 the scene); live scene, `?scene=1|2|3`, posters in public/assets/title; vitest 3759 clean; filed in the vault). David's scene reference never arrived: when it does, forward it to a title-r2 lane to reframe TITLE_SETS, posters and clips. lampParts is now shared with DefaultIslandWorld. Dev server only: run the production build at merge.
- **sky-ambient lane (David, 2026-11-04):** "i want you to run a lane and artifact process for game skybox and ambiant, so sky wind, effects etc". New worktree .claude/worktrees/sky-ambient, branch game/sky-ambient from origin/main f3d24212, dev port 3480. Round 1 started (e65f7093): audit sky, weather, wind, ambient effects (and list ambient sound); shoot them through the day and in each weather; pitch 2 or 3 sky directions, one shared wind, a menu of ambient effects behind dev switches, with costs; spec `specs/sky-ambient.md`; ids sky1-*. Coordinator publishes the review page.
