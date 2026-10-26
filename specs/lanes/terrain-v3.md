# Lane: terrain-v3 (the new world rebuilt from David's plan, row 318)

Worktree `.claude/worktrees/terrain-v3`, branch `game/terrain-v3`, cut from main. Agent type `uwotsi-lane`.

**Read first, in order:**
1. `specs/launch/terrain-v3.md`: the build, the rounds and David's answers verbatim. It's the spec.
2. `specs/world-editor.md` "Decisions" and "Data format".
3. `specs/terrain-law.md`, only the parts on water and the coast.
4. The `CODEMAP.md` rows "World, terrain, grid" and "World switch".

Then look at the references in `specs/references/terrain/plan-2026-10-23/` and the drawing `specs/references/terrain/terrainv1.png`.

**Code to start from:**
- `web/lib/game/world/convert.ts` (the wharf quay, pads, coast and grades);
- `format.ts` (writing the files);
- `terrain.ts`, `sealed.test.ts` and `walk.test.ts`;
- `web/scripts/convert-world.ts`;
- `web/lib/game/arrival/routes/new.ts`.

## Status

**R1c and R2 reviewed 2026-10-26** (head e11d0444, not merged): map, houses, meadow, mountain and north approved; the rest redo (notes below, verbatim). Next is R2b (Next, below), in parallel with the lane `terrain-art` (`specs/lanes/terrain-art.md`), which models the new 3D assets in Blender.

What R1c and R2 built:

**R1c and R2 are built and waiting on one review** (2026-10-25). R2 909dd199, on d08623f4 (R1c) and 2e9ae1bf (the ponytail fixes, merged to main as cbf729af). The R2 code review (merge-safe) fixes are in the commit after 507e2deb:
- the arrival's fish crate stands on the raised jetty (`Crates` takes the deck's height), one `CRATE_URL` in propModels.ts;
- deck board tops a hair (0.01) over the ground, so feet and props stand on them; the ground under the boards is painted dark earth (a "shape" zone, d < 7.8) so the gaps read dark, and the stone path now starts at the stairs;
- treads sample the ground at their middles; `hash01` replaces the sine hash; `LADDERS` no longer exported; path fences have their own id counter (the old ids were dropped from world.json once);
- `DefaultIslandWorld` uses `layout.dock`; `Wharf` computes `deckY` once; the palm list is typed as const.
- Views 01, 13 and 14 in `r2/` reshot after the board change.

R1c (David's R1b notes, the reading below 1 to 7):
- **Map 10 u longer:** the main island's north radii grow up to 10 and the mountain sits at (0, -47) (`MT.to`), a little north and east of R1b's, so its cliffs still show behind the café from the plaza (view 07).
- **Islets:** one bigger islet at (26, 184), 38 x 18, and five small ones close beside it to the east (x 80 to 105, z 168 to 197). The lighthouse islet is unchanged.
- **The wharf:** two thirds of R1b's depth: deck 0 to 9 u in from the shore, the step to the quay at 9 to 10, the quay to 16, the climb to the village's 3 from 16 to 24. It runs z 10 to 90 (was 6 to 94).
- **The village:** the plaza moved to (30, 50), right at the top of the wharf's climb; HQ, café, shop and museum keep their places round it. The village zone is clipped 20 u in from the shore (`westOfQuay - 20`). The house and lot marks moved with it.
- **The beach:** keeps its shape; it tapers to nothing at x 60 where it meets the wharf (`0.4 * (60 - x)`).
- **The forest:** edge 6 and two tiers 9 u apart (was edge 3, 5 apart): a gradual rise.

R2 (on the R1c ground):
- **New object kinds** (appended to `OBJECT_KINDS`): `prop` (solid scenery, `model` from `propModels.ts SCENERY_URLS` or the dump's props, sized by `scale`; footprints and tops in `defaultIsland.ts PROP_FOOTPRINT/PROP_TOP`, walked by `propsOf`) and `deck` (a 4 u square of deck boards; model "steps" climbs its ground in treads). `/lab/map` has styles for both.
- **Deck boards:** 39 squares over the deck band and the stairs square where the path climbs to the quay (`STAIRS`), drawn as one instanced mesh of wooden boxes (`components/game/wharf/WoodBoxes.tsx`, `lib/game/wharf.ts deckBoards`).
- **The jetty at 1:** `defaultIsland.ts jettyY` (the ground at the jetty's land end, to the quarter unit; DECK_Y on the cell worlds, so the village and applicant island are unchanged) and `wharfDock`. `Dock.y` lifts the pier and the finger pier in `Wharf.tsx`, the boat's lines in `Boat.tsx` and the rider on the pier in `useTripBoat.ts`; the walker stands on the jetty at it. Ladders (`LADDERS`, `ladderBoxes`) hang off the jetty's -x side, the finger's end and its seaward face.
- **The fish market** (`MARKET`): 7 market-cart stalls, barrels, crates and 2 shop carts on the deck, north and south of the path; 2 more deck lamps.
- **The path:** straight up the climb at z 56 between joined fences (x 50 to 57); lamps beside it.
- **Houses:** 8 chalets (`HOUSES`, the `house` kind, doors closed) round the plaza; House 1 to 6 marks sit on the first six.
- **Beach:** the campfire at (14, 104), 7 palms on the dry sand at its back, 3 parasols.
- **Lighthouse** on its islet (prop, scale 0.2).
- **Closures:** rockslide on the mountain way north of the café, two forest-edge segments on the forest way north of the wharf, an unbuilt bridge on the river's village bank (the washed-out crossing) and one on the meadow's coast toward the north island. The invisible border is unchanged.
- **Renders:** `specs/evidence/terrain-v3/r2/` (00 top-down, 01 to 11 the R1b views, 13 market, 14 the jetty and ladders, 15 the plaza's houses, 16 the campfire).
- **Gates:** with and without the switch, 37 files and 292 tests green (world, arrival with routes, barriers, drops, proposals, campfire, wharf, defaultIsland, mapHealth, villageMap, propModels, fences, residentRoutine, shadows, groundGate, wharf components). tsc and eslint clean. No perf run (one run in R3).
- **Not in R2:** fishing nets (no net model in the assets; `tool-net` is the bug net). Questions: `specs/launch/terrain-v3-questions.md` "R2".

## David's decisions

### 2026-10-26: R1c and R2 review, verbatim (https://claude.ai/artifact/5mbexjtNp5WJrTsWibqmmJ)

- **map (approve):** "looks good fro now"
- **arrival (redo):** "bigger wood boards, develop proper flooring for wharf, have wood pillars to make it structurally make sense that connecs down to the water, have ladders, small wood pillar with rope fencing for some spots, have 3 entrance to actual doc"
- **wharf (redo):** "the transition from board to rock is too sudden, plan to make it more natural by making it same level and grassy for palm trees and stuff"
- **market (redo):** "improve lighing assets, use blending for all 3d design assets"
- **jetty (redo):** "make the actual doc thing widider and also have a lower level as well for boat docking naturally out"
- **path (redo):** "can create new flow terrain asset that makes the path more natural i will provide refence images"
- **plaza (redo):** "looks good, increase building sizes by 15%, have floor be tiles"
- **houses (approve):** no note.
- **hq (redo):** "have proper decore, ask for reference image for what plaza should look like"
- **beach (redo):** "palm tree leaves needs more work, needs to be lighter with coconuts, model in blender properly"
- **campfire (redo):** "a little bare brain storm to fill it out"
- **mountain (approve), meadow (approve), north (approve):** no notes.
- **forest (redo):** "yea but make it look like a dense forest without actually rendering so many trees, like just low qual so it looks like dense forest that isnt opened that entire section"
- **river (redo):** "good ideas, the island on the otherside needs to be slighly shorter by 1-2 blocks, "

**The coordinator's reading** ("blending" is Blender):
1. **The wharf floor:** a proper built deck: bigger boards; wooden pillars under its water edge going down into the water, so it reads as a structure; ladders down to the water; short wooden posts with rope fencing along some stretches of the edge, not all of it.
2. **The dock (the jetty):** wider, with three ways onto it from the deck, and a lower level stepping out from it at the water where boats dock.
3. **Behind the boards:** no sudden step from boards to stone. The ground behind the boards is at the boards' level and grassy, with room for palms and other dressing; the climb to the village starts behind it.
4. **Every new 3D asset is modelled in Blender** (headless), not built from code boxes; that includes the deck boards, pillars, ladders and rope fencing. The lamps ("lighting assets") get better models. The `terrain-art` lane makes these; this lane places and wires them.
5. **The plaza:** buildings (HQ, café, shop, museum and the houses round it) 15% bigger; the plaza's floor tiled. Its decor waits for David's plaza references.
6. **The path:** a new, more natural flowing path. Waits for David's references.
7. **The beach's palms:** lighter leaves with coconuts, modelled properly in Blender (`terrain-art`).
8. **The campfire:** fill out the area round it (log benches, stumps, firewood, a lantern and the like).
9. **The forest:** the whole closed forest section reads as a dense forest without rendering many trees: cheap, low-detail tree masses (`terrain-art` makes them), instanced.
10. **The river:** keep the washed-out bridge; the far bank (the meadow side) 1 to 2 u lower.
11. **Approved as is:** the map, the houses, the meadow, the mountain, the north island.

References: David was asked for plaza and path pictures (optional: palms, lamps, the wharf's structure, the campfire, the forest) on https://claude.ai/artifact/XgY2yxq2rJKjm3CupjT2Ju. The coordinator saves them under `specs/references/terrain/r2-2026-10-26/` and messages you.

### 2026-10-25: R1b review, verbatim (https://claude.ai/artifact/GEg5mHuG6ACN95UdZiLJou)

David's message: "terrain approved read feedback".

- **map (redo):** "make the cut smaller so less of the island is cut, thye islets should be 1 bigger with a bunch of small close togetherpl". Asked which cut, he said: "you made a horizontal cut  to make the map shorter, i want you to make it very slightly longer".
- **arrival (redo):** "place but make the flooring like plankes around the water,male the village closer so its in vlew, the wharf a like tooo big now maybe in thems of height like 2/3 or half of what so theres enough to have buildings on the side but not so big the villlage is out of view"
- **wharf-long (redo):** "slightly slightly shorter"
- **path:** "again the path should be way shorter so that the village is next to the wharf"
- **plaza, hq:** no note.
- **beach:** "look good, a little long i was thinking of tapering it off naturally when it transitions to wharf"
- **mountain:** "looks good, eventually need to edit it but it looks good so far"
- **meadow (approve):** "good for now"
- **toast (approve):** no note.
- **forest (redo):** "more gradual"
- **river (approve):** "its fine for now"
- **north (approve):** "good for now"

**The coordinator's reading:**
1. **Map length (z, north to south):** R1b took a horizontal band out to shorten the map. Put a little of it back: very slightly longer, about 10 u, not back to R1's length. The mountain's cliffs must still show behind the café from the plaza.
2. **Islets:** replace the scattered islets with one bigger islet and a cluster of small ones close beside it. The lighthouse islet stays.
3. **The wharf's depth (x, from the water inland):** about half to two thirds of R1b's. Keep enough room for wharf buildings along its sides, but the village must be in view from the jetty (view 01). Keep the heights: deck 1, quay 2, village 3.
4. **The path:** way shorter. The village sits right next to the wharf; it follows from 3. The plaza layout (HQ back, café right, shop left, museum further out) moves with the village and keeps its shape.
5. **The wharf's length along the water (z):** slightly shorter.
6. **The beach:** keep its shape, a little shorter, tapering off naturally where it meets the wharf.
7. **The forest:** a more gradual transition from the wharf and village up to its cliffs.
8. **Approved as is:** the meadow and its border, the toast's wording, the river, the north island, the mountain (redesign later).
9. **The R1b questions:** every default stands. R2 raises the jetty to 1 with ladders; the deck area gets wooden planks ("make the flooring like plankes around the water") and the fish market; the mountain stays as the base for its redesign; the wording stays.

### 2026-10-24: R1 review, verbatim (https://claude.ai/artifact/U9bsDg9XdmeZo3iuwUZiHv)

- **map (redo):** "village should be 2,3 wharf is 1, and wharf needs to be bigger, the step should go up later so push the stairs to the left more and expand the wharf so more wharf buildings, also the deck board area needs to be way bigger. i want you make the meadow area the same level and not sudden raise so it looks natural, but just put invisible boarders for now that says release soon"
- **wharf (redo):** "quay needs to be a 2 with larger deck board to fit the fishing market, and larger deck"
- **path (redo):** "the elevation to island is too high keep village 2,3"
- **plaza (redo):** "I wan you to make plaza bigger, and have the buildings set around the plaza naturally, buildings can be side by side"
- **hq (redo):** no note.
- **beach (redo):** "remove that patch of grass, and have the beach shape redone and slightly smaller and smoothed out, there shuold pla places where palm tree can grow"
- **mountain from the village:** "I want you to make the map shorter and have the mountain and allat moved closer, "
- **mountain from the meadow:** "mountain will be redone in next version focus on main island and vilage for now"
- **forest (redo):** "cliffs further out, rightnow it doesnt look natural the transirtion"
- **north (redo):** "remove that straight thing" (the long narrow spit reaching toward the island in view 08)
- **river:** "fine for now"
- **slide (redo):** "I want you to make the village area bigger and enlarge and shrink the other parts, like make meadow and forest and hills shorter, make north island smaller and bring mountains closer"

**The coordinator's reading** (heights are in u above the sea, as the review page gave them):
1. **Heights:**
   - the wharf's deck boards at 1;
   - the stone quay at 2;
   - the village at 2 to 3.
   The climb from the quay is gentle and starts further inland. The stairs move to the LEFT as seen arriving from the jetty (view 01).
2. **The wharf, much bigger:**
   - a far larger deck-board area, room for the fish market's stalls and more wharf buildings;
   - a larger quay.
3. **The village and plaza, bigger:**
   - the buildings sit around the plaza naturally and can stand side by side: HQ at the back centre, the café right, the shop left, the museum further out, per the plan;
   - move the existing landmarks in this round.
4. **A shorter, more compact map:**
   - the mountain and the rest come closer to the village; it should show from the village (the bend hides anything past about 80 u);
   - the village area grows;
   - the meadow, forest and hills get lower and smaller;
   - the north island gets smaller, and the straight spit toward it goes.
   Keep the grid size unless shrinking it is clearly simpler; say which in the report.
5. **The meadow:**
   - at the village's level, a natural continuation with no sudden rise;
   - closed for now by an invisible border that tells the player it's releasing soon. This overrides the spec's "no invisible walls" for the meadow.
   - Reuse any existing barrier, toast or opening-soon message; the seal test must count the border.
6. **The forest:** its cliffs further out, with a natural transition, not the abrupt wall by the jetty.
7. **The beach:**
   - no grass patch;
   - reshaped, slightly smaller and smoothed;
   - spots where palm trees can grow.
8. **The mountain:** only moved closer now. Its redesign is a later version, so focus on the main island and the village.
9. **The river:** fine for now.

### 2026-10-23

The plan page answers, verbatim in the spec. The drawing is a guide to where things go, not a shape to trace. Open on Oct 31: the wharf, the west beach and the village. Close the rest naturally (broken bridges, landslides, a guard). Cut nothing; order the work instead.

## Next

1. **R2b, landform and layout** (the reading above, 2, 3, 5, 10):
   - behind the boards: the grassy band at the boards' level, the climb to the village behind it, no stone step;
   - the dock wider, three ways onto it from the deck, and a lower boat level stepping out at the water. You own the dock's model (Blender, headless, under `art/`) and its walk surfaces, since they are tied to `wharf.ts`, `jettyY`, the boat trip and the arrival route; the routes test and the tutorial crate must still work;
   - the plaza's buildings and houses at 1.15 scale, pads grown to match, doors and entries still working; the plaza floor tiled (use an existing tile or paving texture if the repo has one; otherwise add a question with your default);
   - the meadow bank across the river 1 to 2 u lower.
2. **Wire `terrain-art`'s assets as they land.** The coordinator tells you when to `git merge game/terrain-art` (it branches from your e11d0444). Then: the bigger deck boards replacing the code boxes, pillars along the deck's water edge, ladders, rope fencing on some stretches, palms on the grassy band, the campfire area filled out, and the forest masses over the whole closed forest. Don't add `propModels.ts` entries for that lane's models; it registers them. Until they land, do step 1 and leave placeholders out.
3. **Skip** the path's redesign and the plaza's decor until the coordinator sends David's references.
4. **Review:** render `specs/evidence/terrain-v3/r2b/` (the top-down map, views 01 to 03, 04 the plaza, 06 the beach, 09 the forest, 10 the river, 13 the market, 14 the dock, 16 the campfire, plus a close view of the deck's edge with pillars and rope fencing), then SendMessage "main" with the images and a one-line fact for each.
5. **Then R3 straight on** without waiting: light trees and bushes in the village, trees on the meadow and the north island, rock on the cliffs; and the one perf run (`SCENES=v2`) at the end, against the new world's High budget (4.8 ms, 222 draws). Report it and stop.

**Questions for David** go in `specs/launch/terrain-v3-questions.md`, one line each with your default. Carry on with your default meanwhile, unless the answer would change the landform.

## Tools and gotchas

- **node_modules:** the worktree had none; cloned from `perf-v1` (same lockfile) with `cp -c -R .claude/worktrees/perf-v1/web/node_modules web/` (APFS clone, 9 s).
- **Locks:** `LANE=game/terrain-v3 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>` for vitest, tsc, builds and perf. The dev server takes the devserver lock by hand (queue line, mkdir, owner file), on port 3171. Never use port 3000.
- **R1b dark band:** a zone seam with no zone on top falls to the plan's base ground. The main island's ground is the village's 3, so seams stay level.
- **Object key order:** objects the generator writes must list their keys in the order `format.ts` reads them back (id, kind, x, z, yaw, scale, model), and leave out a zero yaw. Otherwise `world.test` ("same bytes") fails.
- **Border toast check:** with `at=0,24`, camera yaw pi, hold W; the toast shows at about z 15.
- **Views:** dev server `cd web && NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= NEXT_PUBLIC_GAME_WORLD=new npx next dev -p 3171`, then `PORT=3171 node specs/evidence/terrain-v3/shoot.mjs <dir> [view,...]` (headless, muted; `/lab/island?fixture=v2&at=x,z`, camera yaw 0 looks toward +z, 90 toward +x). `at=` stands you anywhere, closed zones too, so keep review spots in the open area unless the view is of a closed zone.
- **Curved world:** the bend drops far things by 0.0032 d^2 (30 u at 100 u), so nothing more than about 80 u away shows from the open area.
- **Annotations:** a land zone owns a cell only where the ground stands within 1.5 u of its own height, so a cliff's foot or a coast's last slope isn't counted as the closed zone above it (otherwise the seal test flags the foot).
- **Village is dead level** (no noise): neighbouring building pads level to their own centres, so any noise makes two pads disagree (walk.test "flat pad").
- **softMin power:** the coast's soft minimum at power 4 lowered the plateau 0.04 even 30 u from the sea; the generator uses power 12.
- **Sealed zones:** `cd web && NEXT_PUBLIC_GAME_WORLD=new npx vitest run lib/game/world/sealed.test.ts` prints the leaks.
- **After any world change:** the generator writes `cells.json` itself; after a merge, `cd web && npx vite-node -c vitest.config.ts scripts/world-cells.ts`, then `cells.test.ts`.
- **Assets:** only those already in `web/public/assets/`. Never fetch art or references.
- **Scenery in the generator:** `scenery()` in generate.ts builds every R2 object; `layoutObjects` replaces any earlier copy by kind and id, so a rerun is idempotent. Place along the wharf with `quayAt(z, d)` (d in from the shore, and the yaw that turns local z inland).
- **Model sizes:** `prop` footprints are in the model's own units (bounds measured from the GLB). The ACNH furniture is at about 10x (barrel scale 0.07, lighthouse 0.2); market-cart at 0.55 is a 4 u stall.
- **View spots:** keep the camera clear of houses (view 04 moved to (44, 53) for that). Ladders read only from close (view 14).
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`.
