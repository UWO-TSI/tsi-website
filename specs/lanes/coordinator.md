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
