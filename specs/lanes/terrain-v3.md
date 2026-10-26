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

**R2d reviewed 2026-10-26** (head 7aee495b). Approved:
- the arrival, the docks from the side and from above;
- the path, and the path, plaza and wharf at night;
- the shallows.

The rest are redos; his notes are below, verbatim. R2d itself merges to main through `game/perf-newworld`: the perf lane re-measures it there and the code review's fixes land there. Next is R2e (Next, below), on this branch.


**R2d built 2026-10-26, waiting on review** (head: the commit after 4ac9b07a). Merged in: village-art2 8608aec7, wharf-art2 0ee8bd95, wharf-art3 a1b8e1ff (the sell stall), sushi-bar f7fbca92 (the bar model only; the sushi-bar lane now owns the bar's placement and boardwalk in generate.ts, so don't move it), perf-newworld 2b28dd51 (its files are ours again). Renders in `specs/evidence/terrain-v3/r2d/` (00 top-down, 01 to 22), the village check in `r2d/village-check/` (v1 to v4: same as before the merges by eye).

What R2d built (David's R2c notes, the reading 1 to 14):
- **Docks** (`build_jetty.py`, `wharf.ts JETTY`, mirrored): piers at x 0, -10.5, 11, tips -3.5, -9.5, -6.5; walkway z 0.6 to 3.4 from x -14 to 14.5; platform z 9 to 13.5, 25 wide; gangways at -6, 0, 6 to `land` 16; open six-tread stairs on sloped stringers with rope rails. 9160 tris (plain boxes, six-sided piles and posts, thin ropes). `deckPieces` clear 9 round the landing, none on the edge round the ship houses and the sell stall (`sheds`).
- **Lamps:** jetty 4 posts and 3 tip lanterns. Pumpkins: the new world's lamps keep one at about 1 in 5 posts (`halloween.ts`). Every lamp breathes like a flame (`AmbientProps breath`): the 4-light `LampPool` per frame (reach 11, x2), and `LampGlow` halos (points) and ground pools (an instanced disc) from one time uniform, 4 draws. Bug spots among blooms (`kind bug, model "flowers"`, generated in `lamps()`, read by `islandNodes` spots("flowers")) at every other post: the roster's night butterflies.
- **Plaza:** buildings about 1.5 closer (`SPOT`), houses 0.84 in; brick roads as stone-paint ramps; the splat draws the stone paint with `road-brick-albedo` (crisp edge, `splatMaterial`), the dry pond repainted rock. Plaza tiles 1672 tris (inner setts lost their sides).
- **Beach:** `bed()` stretches the shelf 2.5x off the beach and lifts its first 0.6 by a third: wading about 8 u out (WADE unchanged). Palms 1.35; campfire 1.15 (`Spot.scale`, the solid scales too); beach things per parasol, the volleyball net, the sandcastle. Sushi bar at (44, 96.5) on a 0.9 pad, back to the sea, its hand lanterns gone.
- **Water:** coral reefs and clumps always a hand under the water (`CORAL_TOP`); 40 fish schools on the new world, half round the reefs (`fishSchools near`).
- **Nature:** the forest is 338 single forest trees (village-art2's, 2.15 grid, firs and young toward the edge, uniform 0.8 to 1.25); forest masses gone. Wild shrubs for every round bush (fireflies follow them). The river dressed from the ground (`riverside`): reeds, stones, lily pads (on the water: `propY`), driftwood, shrubs, boulders. Mossy boulders at the plaza, the path's bends and the river (lowest ground under them).
- **Wharf:** the fish market's deck and clear bill side; wharf-art3's sell stall at quayAt(38, 1) turned to the deck, E opens `SellSheet` (`Near "sell"`); ship houses a, d, c, b on the water's edge at z 17, 26, 63.5, 73.5, at deck height (`propY`).
- **Gates:** tsc and eslint clean; lib/game + components/game 245 files, 2006 tests green with and without the switch, budget.test included. No perf run (the perf lane's).
- **Not done / open:** no per-tree tint in the forest (instanced, no colour attribute); the water lane's tall `boulder_c` seabed rocks stand out of the now wide shallows (`seabedProps`, shared with the village, left as is); the fog's horror look is a later pass.

**R2c built 2026-10-26, waiting on review** (head: the commit after 854b65d8). All art merged: village-art 7bdb2e75 (lamps, hand lantern, plaza set, path and nature set, forest remodel) and wharf-art c951d6eb (dock decor, palms third pass, beach set, fish market). Renders in `specs/evidence/terrain-v3/r2c/` (00 top-down, 01 to 20).

What R2c built (David's R2b notes, the reading 1 to 11, and his 2026-10-26 references):
- **Docks** (`build_jetty.py`, `wharf.ts JETTY`): the platform at 1 with its three gangways, three piers out from it (x 0, -6.6, 6.6, 2 wide), each down three treads to a low level at 0.3 (`JETTY.low`, a hand over the waves) where a walkway joins all three (z 1 to 2.6); past it the fingers reach to the tip at -3.5, slips between. 19 u tip to land (was 11). The boat moors on the middle finger as before (MOORED, STEP_AT unchanged); its lines lift by `JETTY.low` (`Boat.tsx`). `DOCK.x = SHORE_X + 0.8 + JETTY.land`.
- **Water:** the smooth world's waves x1.5, swell x1.4 (`GridWorld SmoothWorld`, `SMOOTH_SEA`); the village's sea untouched.
- **Wharf:** deck squares only z 14 to 78 (`DECK_Z`), on the grassy band at their level, overhanging the water by 1 (d 1 and 5); the wharf zone's south edge widens to ease into the beach; the beach's taper into it wobbles. Rope-lashed piles (`dock-pile-rope`), rope nets, ladders with life rings on the edge (`deckPieces`); the hoist at z 54; the fish market at z 34 on the inland row, awning to the water, stalls and decor round it (`MARKET`).
- **River:** the far bank a gentle slope (`farBank`, the coast grade a field now); the invisible border runs down that bank to the sea (`FAR_BANK`, `BORDERS`), since a glide off the village could land on the low bank.
- **Beach:** wading (`defaultIsland WADE` 0.25, smooth world only: about 1.5 u out, never across the river); a ragged, patchy sand edge (`ragged` zones); the sushi bar by the wharf end, the lifeguard tower at (1, 108.5), surfboards, coral where the sea is 0.8 to 1.6 deep (`shallows`, after the ground); palms in four sizes.
- **Path:** winding (`PATH`, `onPath`), yellow dirt (`splatMaterial` reads `path-albedo.png`, two turned reads crossfaded), loose rustic fence runs and lone posts both sides all the way up (kept clear of the bends), bushes behind, edge stones, wood and branch lamp posts, hand lanterns.
- **Plaza:** houses 12% in (`HOUSE_IN`), lighter tiles (Blender rebuild), the fountain in the middle (scale 0.75), the monument in front of HQ, flags, banner poles with bunting (lifted 3.1 in `NatureModels propY`), the sign, planter benches, planters, the fruit stall with barrels and crates by the shop.
- **Night and fog** (`islandLighting smoothWorldLight`, new world only): fog 1.5x further and warmer by day, warm violet by night; lamps 2.2x at night, ambient and hemisphere lifted; 80 lamps (56 hand lanterns glow only), pools from the 8 lamps nearest you (`AmbientProps LampPool`), 8.5 u.
- **Nature:** trees (three broadleaf shapes), bushes, flowers, wild-flower patches and tall grass scattered over the green (`nature`); the five forest masses scattered, sunk to the lowest ground under each (`NatureModels propY`).
- **Perf work:** still props merged by look (`InstancedNature MergedModels`, new world only; the look keys moved there from ShopDisplays), houses instanced by colourway (`ACNHParts at`), lamp pool. v2 High 20.7 ms (CPU 16.5), 425 draws; Lite 8.4 ms (CPU 6.9), 342 draws (machine load 3; baseline 5.4 / 254 and 3.0 / 172). Over budget: see Next.
- **Gates:** with and without the switch, 48 files and 389 tests green; tsc and eslint clean.

**R2b reviewed 2026-10-26** (head a9da52b0, not merged): the map's size, the dock model and the deck's edge approved; the rest redo (notes below, verbatim). Next is R2c (Next, below), which also takes David's 2026-10-26 references (`specs/references/terrain/r2-2026-10-26/README.md`) and the art from the lanes `wharf-art` and `village-art`.

What R2b built (David's R2 notes, the reading 1 to 10 below):
- **The landform:** no stone quay; behind the deck boards a grassy band at their level (1) out to 13 u from the shore, then the climb to the village's 3 by 24 (`generate.ts` Wharf zone). The path starts on the boards at z 56 (`PATH_Z`); the "steps" square and `STAIRS` are gone. The meadow across the river is 1.5 lower (`meadowGround`, about 2 there against the village's 3).
- **The jetty** (`art/wharf/build_jetty.py`, `jetty.glb`, the kit's wood and rope): a landing at the water (top 0) where the boat moors as at the pier, stairs up to a 9 x 4 platform at 1, three gangways to the deck boards, piles, rope fencing, two ladders, a cleat. The wharf landmark's `model: "jetty"` switches it (`defaultIsland.ts isJetty`, `wharfDock` gives `y: JETTY.top`); `wharfDecks` returns each deck with its height function (stairs ramp). `DOCK` moved out to x 82.1. R2's raise plumbing is gone (Boat lines, rider, crate, dressing, `jettyY`, `ladderBoxes`), and the new world draws no finger pier or rowboats (`dressed={!dock.y}`).
- **The wharf kit** on the deck squares (`wharf.ts deckPieces`, drawn in `NatureModels sceneryOf`): a deck tile on each, two piles on every water-edge square, a ladder on every fifth, rope fencing on about half of the rest, none within 7 u of the gangways. `WoodBoxes`, `deckBoards`, `DECK` deleted.
- **Plaza:** HQ, café, shop and museum at scale 1.32 (1.15 x R2's 1.15), houses at 1.15; the floor is `plaza-tiles` (`art/props/build_plaza_tiles.py`, stone setts in rings, a prop at the plaza's centre).
- **terrain-art's assets placed:** palms (tall, lean, short) on the grassy band and the beach in place of palm-a/b; the lamps by model (`lamp` objects carry `model` village, wharf or camp and a yaw turning the arm; `DefaultIslandWorld lampSets`), two lantern posts on the jetty's platform; the campfire filled out (3 log benches as sittable `bench`es, 4 stumps, firewood stack, fish rack, 2 camp lanterns, all outside the dance ring); 23 forest masses over the whole closed forest (`forestMasses`, jittered 8 u lattice off the mountain's foot).
- **Generated kinds:** `layoutObjects` now drops every deck, prop and house before adding the generated ones (`GENERATED`), so a removed object never lingers.
- **Gates:** with and without the switch, 35 files and 290 tests green; tsc and eslint clean. No perf run (skipped by the coordinator).
- **Not verified:** the palms' sway in motion (stills only); light pools at night are faint at play distance (view 18: the glass glows, the pools are small).

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
- **Renders:** `specs/evidence/terrain-v3/r2/` (00 top-down, 01 to 11 the R1b views, 13 market, 14 the jetty and ladders, 15 the plaza's houses, 16 the campfire); R2b in `r2b/` (shoot.mjs views take `time`).
- **Gates:** with and without the switch, 37 files and 292 tests green (world, arrival with routes, barriers, drops, proposals, campfire, wharf, defaultIsland, mapHealth, villageMap, propModels, fences, residentRoutine, shadows, groundGate, wharf components). tsc and eslint clean. No perf run (one run in R3).
- **Not in R2:** fishing nets (no net model in the assets; `tool-net` is the bug net). Questions: `specs/launch/terrain-v3-questions.md` "R2".

## David's decisions

### 2026-10-26: R2d review, verbatim (https://claude.ai/artifact/UdD2So4dkLxzTX2NLqy1qy)

- **arrival (approve):** "LOOKIN MUCH BETTER NOW WERE TALKING, now start working on the small details stuff, like lighting, crates, ladder, make it organic"
- **docks (approve), docks-above (approve), path (approve), night-path (approve), night-plaza (approve):** no notes.
- **night-wharf (approve):** "looks good"
- **shallows (approve):** "looks good"
- **beach (redo):** "looking good, work on the water and foam logic a bit and have waves come up and crash on the seashore and not just hover there"
- **campfire (redo):** "more crabs shells and little critters moving around in the sand occasionally"
- **edge (redo):** "read what i said earlier, idk if these are necessary? maybe move fish building as north side main building these are removed"
- **ship-houses (redo):** "houses need better use, maybe one for selling rods/equipment , with a big rod on the roof or smth and one for building ships and instead of a building its half buildign half ship floating on the water wit ha small wood bridge extended, and it wobbles with the wave?"
- **market:** "rotate the fishmakret so it faces the right side"
- **forest (redo):** "can you model better looking low poly trees instead of copy pasting 1 model"
- **plaza (redo):** "get rid of that dirt texture it looks ugly, i think grass needs an updatem it looks ugly, doesnt fit, i want grass for feel like fass and not feel like a mess"
- **river (redo):** "trees a bit small and look like bushes, still doesnt feel natural"
- **sushi:** "sushi bar needs remodelingand placement is off, kidna in the middle of nowhere there should be a bath to the from of it kidna thing" (the sushi-bar lane owns it)
- **wharf (redo):** "less palm trees there, more on the beach, amke path connected to beach"
- **map:** no answer.

**The coordinator's reading:**
1. **Small details, organic:** on the wharf, docks and market, vary and loosen the crates, barrels, ladders and lanterns, so nothing sits in a neat row or grid, and fill the lighting gaps.
2. **The wharf's buildings:**
   - The fish market moves to the north end of the wharf as its main building, and the ship houses there (a and d) go. It faces down the wharf toward the docks, so its front, with the swordfish and the sell stall, is what you see from the docks and the walkway. That's the coordinator's reading of "faces the right side"; ask David if a render suggests otherwise.
   - The other ship houses go too. Two buildings with a purpose replace them:
     - a tackle shop for rods and equipment, with a big fishing rod on the roof;
     - a shipwright: half building, half ship floating on the water, joined by a small wooden bridge, the ship bobbing with the waves.
   - `wharf-art4` models both. Nobody enters them for launch (scenery); the shops themselves come later.
3. **The wharf's palms:** fewer on the grass band, more on the beach. A path joins the wharf to the beach.
4. **The beach's waves:** waves run up the sand and break with foam, then draw back, instead of a foam line hovering at the shore. New world only.
5. **Beach critters:** crabs that scuttle across the sand now and then, and more shells. Use the existing critter and ambient systems; `wharf-art4` models the crab if none exists.
6. **The plaza:** remove the brick roads (they read as a dirt smear). The grass needs an update: it should read as clean, lush grass, not noisy speckle. New world first; say if the change would also touch the village.
7. **The river:** bigger, natural trees along the banks, not bush-sized. `trees-art` models them.
8. **The forest:** more, better-looking low-poly tree models from `trees-art`, so it doesn't read as copy-paste. Add a per-instance tint (`InstancedMesh.instanceColor`) for subtle variation.

### 2026-10-26: R2c review, verbatim (https://claude.ai/artifact/2WJiN8D8WAQF22E9CL1pPu)

- **map (approve), edge (approve), wharf (approve):** no notes.
- **arrival (redo):** "looks good, but spread out more, bigger spread and gaps and make it more natural"
- **docks-above:** "spread out, not so univor, the horizontal docks go wider and go for longer"
- **docks (redo):** "stairs down need to be more fitting, less pumpkins, ore lighing, make the dock bigger so it feels less clutter"
- **market (redo):** "the shop should look more similar to reference, the model of the sword fish bigger and incorperated within the build, and bigger so that its like lunched out the building. i want a big barrel that you can sell outside for quick sell or go in for more details and buy shop and appraisal and stuff"
- **path (redo):** "looking a lot better, I want more brain storing to make it look better, i think the bushes are too dense and looks like a sphere from afar, i should feel more fluffy and density varies so some of it fees more organic "
- **plaza (redo):** "have brick roads to the important shops, have building come together slightly closer. remodel rocks to be more organic shape than just spheres, use blender, treat each asset properly"
- **beach (redo):** "light guard tower taller, make the shallow water area bigger and you can dip your toes in water, bigger trees. brainstorm for more beach stuff, maybe beach balls you can play with"
- **sushi (redo):** "the sushi bar needs to be a long horizontal bar, reference bancho sushi in dave the diver, it should have a long bar style, the decore is similar to wharf, its a really big open bar where you can sit down and it changes camera anger to more first person, it has festive lighting inside, it back of the bar is open window to see beatiful view in the back, 1-2 sushi npc making sushi. i will drop reference image in chat. the bar entirely needs to be re modeled in blender properly and it needs to looks visually stunning."
- **campfire (redo):** "slightly bigger camp fire 15%, have coral reeffs and fish you can see in the shallow water"
- **forest (redo):** "tree is still fucked up and weird, theres a bunch of clumps and wtv super stretched trees, i just need a low render for performance that also looks like busy forest over there but also look natural, cuz theyre not walking there its closed off"
- **river (redo):** "needs work on feeling natural, it feels so barren and unnatural right now"
- **night-wharf (redo):** "there should be different ship houses, it should be build on the side of the wharf and face inwards. the lighting in our game is still weak, should have like a glow homey feel and it should light up larger area"
- **night-path (approve):** "looks better"
- **night-plaza (redo):** "make the flag tsi logo flag. needs to work on the fog effect later cuz it looks like a horror game"
- **lights (2026-10-26, later):** "lights should breath like fire, glow should grow and shrink like real lamps, more night bugs near lamps to catch."

**The coordinator's reading:**
1. **The docks:**
   - spread out, with bigger gaps between the piers, less uniform and more natural;
   - the cross walkways wider and longer;
   - the stairs down fit the build better;
   - the whole dock bigger, so it feels less cluttered (fewer props per area);
   - fewer pumpkins: on the new world, drop the pumpkin at every lamp and keep a few.
2. **Lighting:** warm, homey glow that lights a larger area, on the wharf first and everywhere at night. Prefer cheap ground light pools and glow halos to more real lights, since perf is tight. The fog's horror look is a later pass (post-launch).
3. **Ship houses:** several different boathouses or fishing huts built along the sides of the wharf, facing in. `wharf-art2` models them.
4. **The fish market:** remodelled closer to `wharf-fishing-hut-1.jpg`, with the swordfish much bigger, built into the building and bursting out of it (`wharf-art2`). A big barrel outside is the quick sell: interacting opens the game's existing sell flow (`/api/economy/sell`, `bagStore`). The inside (buy shop, appraisal) comes after launch.
5. **The path:** fluffier bushes with varied density, not spheres (`village-art2` makes them), and more ideas to make it lovely.
6. **The plaza:** brick roads from the plaza to the important buildings (HQ, café, shop, museum, and the path to the wharf); the buildings slightly closer. Rocks remodelled as organic shapes, not spheres (`village-art2`).
7. **The beach:**
   - the lifeguard tower taller (`wharf-art2`);
   - a bigger shallow wading area;
   - bigger palms;
   - more beach things, with beach balls first. Whether you can play with them depends on what the game already has; otherwise they're scenery for now and play comes later.
8. **The sushi bar:** a full redo as a long, open bar in the style of Bancho Sushi in Dave the Diver. David is sending references. It's its own lane, so leave the current one where it is.
9. **The campfire:** 15% bigger. Coral reefs and fish you can see in the shallow water.
10. **The forest:** a closed, busy, natural forest that's cheap to draw, with no clumps or stretched trees. Drop the forest masses. Instead, use many single low-poly trees from a few variants (the existing `.lod1` trees and cedars, plus any `village-art2` adds), instanced, so it's one draw per variant. Give each tree its own uniform scale, turn and slight tint, set each at its own ground height, and pack them densely.
11. **The river:** natural, not barren: reeds, stones, bushes, flowers and trees along the banks, and lily pads (`village-art2` makes the missing pieces).
12. **The plaza flags:** the TSI logo (`web/public/assets/branding/tethos-mark.svg`) on them (`village-art2`).
13. **Lights breathe:** every lamp's light and glow breathes like a flame, a soft, slow, uneven flicker in intensity and halo size, each lamp out of phase. Cheap: one time uniform in the shader, or one per-frame update over the few real lights; no per-lamp React state or per-lamp work each frame.
14. **Night bugs at the lamps:** more moth-type bugs to catch near the lamps on the new world, from the existing bug system's species and spawn rules (no new system); if spots are placed by hand, add them for the lamps in the world data the way the system expects.

### 2026-10-26: R2b review, verbatim (https://claude.ai/artifact/TE3dCaECrP8qUTBTHyxUZz)

- **map (approve):** "size looks good"
- **arrival (redo):** "dock needs improvement, the boat dock is too small, needs to be longer, and more branches, currently 1 branch, should have multiple docks erected from wharf, im thinking 3 and the kinda connect on sea level, if you get what i mean, so like 3 branches that kinda also connect for boats to park and stuff. water needs to be more wavy "
- **dock (approve):** "dock looking much better"
- **edge (approve):** no note.
- **wharf (redo):** "again tranition between grassy area sand and dock needs to be worked on. should not be hovering over sand"
- **market (redo):** "did you see the fishmarket reference i sent you previously, i need you to start modeling that "
- **night (redo):** "more lighting and stronger is needed, it looks too dark and spooky and ominous, it should be viby"
- **path (redo):** "dirt needs to be more yellow and organic, small rocks pebbles imperfaction, fencing need to run up higher, bushes around fencing, and more lamps for lighting"
- **plaza:** "looking better, tile color could be slightly lighter, houses could come together a bit closer. the distance fog making it kinda spooky instead of the vibe i was thining"
- **beach (redo):** "redo the pamls, i lowk like the old low poly leafs, so like go towards that directio nmore, this one has too much detail tha makes it look less like the other trees, make it different sizes, and trucks bigger, make truckes have the scale kinda thing instead of a normal cylinder. grash and beach blen can be worked on"
- **campfire (redo):** "good for now , more floor lantersn and stuff"
- **forest (redo):** "trees are hovering near the cliff and the trees are paced odd, the trees are all the same exact copy paste model so it looks so unnatural, this tree needs multiple versions and remodeled because it should grow differengly, "
- **river (redo):** "much better, make the other side more gradual insteaad of looking like a cliff"

**The coordinator's reading:**
1. **The docks:** three piers out from the wharf, longer than today's, joined near their outer ends by a walkway at sea level, so the water between them forms slips where boats park. Same wood and build as the approved dock (`build_jetty.py`). The arrival boat moors in one slip; the arrival route and the tutorial crate still work.
2. **The water:** more wavy, for the new world.
3. **Wharf transitions:** the deck never hovers over sand. It meets the water on pilings, and where grass, sand and deck meet (the wharf's south end into the beach) they blend naturally.
4. **The fish market:** a building on the wharf from his earlier references (`specs/references/terrain/plan-2026-10-23/wharf-fishing-hut-1.jpg`, the marlin shop) and `dock-fish-hut.jpg`; `wharf-art` models it.
5. **Night:** more lamps and stronger, warmer light, with bigger, brighter pools. A lively night, not dark or spooky.
6. **The path:** more yellow, organic dirt with pebbles, small rocks and imperfections; the fencing runs further up the path, with bushes round it; more lamps.
7. **The plaza:** slightly lighter tiles; the houses a bit closer together; the distance fog lighter and warmer, so it isn't spooky.
8. **The palms:** `wharf-art` redoes them toward the old low-poly leaves, in different sizes, with thicker scaly trunks. The grass and sand blend still needs work.
9. **The campfire:** more floor lanterns and dressing.
10. **The forest:** grounded, with nothing hovering near the cliffs, and natural spacing. `village-art` remodels the masses with varied trees, so no copy-paste.
11. **The river:** the far bank a gentle slope, not a cliff.

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

**R2e: David's R2d notes** (the reading above, 1 to 8). New world only; the village stays unchanged.

1. **Layout and look first,** with no new art needed:
   - the fish market to the north end, facing down the wharf (2), with ship houses a and d removed;
   - the palms moved and the wharf-to-beach path (3);
   - the shore waves (4);
   - the brick roads removed and the grass updated (6);
   - the organic small details (1).
2. **Then the art,** when the coordinator says to merge it:
   - `wharf-art4`: the tackle shop, the shipwright and its floating ship (bobbing is yours: a cheap shader or a single per-frame transform), and the crab;
   - `trees-art`: forest and river trees, with the per-instance tint.
3. **Merges:**
   - `game/perf-newworld`, when told: it holds R2d with the perf re-measure and the code review's fixes.
   - The sushi bar is the sushi-bar lane's job; don't move it.
4. **Renders** into `specs/evidence/terrain-v3/r2e/`: the redone views plus a night wharf. SendMessage "main" with the images and a one-line fact for each. Update Status, then stop.

## Tools and gotchas

- **node_modules:** the worktree had none; cloned from `perf-v1` (same lockfile) with `cp -c -R .claude/worktrees/perf-v1/web/node_modules web/` (APFS clone, 9 s).
- **Locks:** `LANE=game/terrain-v3 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>` for vitest, tsc, builds and perf. The dev server takes the devserver lock by hand (queue line, mkdir, owner file), on port 3171. Never use port 3000.
- **R1b dark band:** a zone seam with no zone on top falls to the plan's base ground. The main island's ground is the village's 3, so seams stay level.
- **Object key order:** objects the generator writes must list their keys in the order `format.ts` reads them back (id, kind, x, z, yaw, scale, model), and leave out a zero yaw. Otherwise `world.test` ("same bytes") fails.
- **Border toast check:** with `at=0,24`, camera yaw pi, hold W; the toast shows at about z 15.
- **Jetty frame:** dock frame x across (+x the boat side), z inland, the landing's tip at -3.5. `JETTY` in `wharf.ts` mirrors `build_jetty.py` (rects and piles); rebuild the model and edit both together. The gangways' walk rects run to z 9.2, past the boards' edge, because the coast drops to 0.5 right at the shoreline.
- **Spawn:** at `SHORE_X - 6` on the boards; nearer the gangways the residents' plaza ring lands on a deck and walk.test fails.
- **Blender:** `LANE=game/terrain-v3 withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_jetty.py -- review <dir>` (review images land as `<name>.0.png`, `.1.png`).
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
- **Frustum culling:** never cull by a model's own bounds: the curved world bends far things down into view (`modelMaterials prepareModel` sets `frustumCulled = false`); merged and instanced meshes keep that.
- **Perf runs:** build with `withlock.sh heavy sh specs/perf/measure-build.sh` (under 10 min) as its own call, then `SKIP_BUILD=1 KEEP_BUILD=1 SCENES=v2 LOCK_OWNER=game/terrain-v3 npm run perf:check` (it takes the devserver lock itself; release yours first). Draw breakdown: serve the build (`next start -p 3158`, Supabase blanked) under the devserver lock, then `PORT=3158 TIER=high node specs/perf/draw-breakdown.mjs "fixture=v2&bots=24" <out.json>`.
- **Don't chain** the generator and a shoot in one call: the generator can take 15 minutes when the machine is busy (usually 12 s).
- **cells.test** takes 5 to 10 s on its fishing sample under load (the classifier's first call, same on the old world); run it with `--testTimeout=30000` on a busy machine.
- **Village check:** `VILLAGE=1 PORT=3171 node specs/evidence/terrain-v3/shoot.mjs <dir>` with the dev server run without the switch shoots the village's four check views. For a before set, `git archive <sha> web | tar -x -C <scratch>` and clone node_modules into it (no new worktree).
- **Generated bug spots:** `bug` isn't a generated kind (hand-placed ones survive); the lamps' (`bug-lamp-*`) are all dropped and rebuilt each run.
- **Ship houses and lily pads** stand off the ground on purpose: walk.test skips them (and the water's coral, reeds and stones).
- **Lamps:** every lamp is generated (`lamps()`), and the generated kinds now include lamp, tree, flower, bush and fence: anything of those kinds in world.json is rebuilt each run.
