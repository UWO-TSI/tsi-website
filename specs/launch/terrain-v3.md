# Terrain v3: the world rebuilt from David's plan (row 318)

David answered the World Terrain Plan on 2026-10-23 (https://claude.ai/artifact/J6fE1DjDqxt732R8JPvpxs, db collection `sections`). This file turns his answers into the build. His words are quoted verbatim at the bottom and win over anything above them.

Read with `specs/launch/v1-new-world.md` (the launch gap analysis), `specs/world-editor.md` (the smooth world, its files and the editor) and `specs/terrain-law.md`.

## What went wrong last time

The v2 world was traced from his drawing (`specs/references/terrain/terrainv1.png`), so rough brush edges became patchy coasts, blobs and odd steps. David: "the map levels arent what i want ... things are not naturally generated and my vision for certain areas arent accurate".

**The rule now:** the drawing sets only *where* each zone roughly sits. The current world already maps it (the village around cells 180 to 190 x 320 to 350, the mountain east, the north island over the strait). Each zone's *shape and height* come from his answers, built as smooth designed landforms, never traced pixels.

## How to build it

- **One deterministic generator** writes `web/data/world/` (height.png, surface.png, world.json) from a zone plan: soft shapes with a height profile, a shape kind and a noise setting per zone, blended into one heightfield, with an organic coast around their union. A note from David is then an edit to the plan and a rerun.
- **Reuse before building.** `lib/game/world/convert.ts` already has the wharf quay, building pads, beach and bank grades, seabed shelf and the coast SDF. `format.ts` writes the files. Use them; don't write a second copy.
- **Same grid:** 384 x 552 cells, resolution 2, origin and sea level unchanged. Size stays "About the same" ("should take longer, its fine" to walk).
- **No elevated water yet:** water sits at sea level only (convert.ts note). A pond up on the mountain is rock or dry until elevated water exists; that's fine at launch because the mountain is closed.
- **Once David sculpts in the editor,** never regenerate over his work: regional passes only.

## Zones (from his picks and answers)

| Zone | Height | Shape | Plants | Vs drawing | On Oct 31 |
|---|---|---|---|---|---|
| Wharf | Low | Terraced steps | Light | Rethink it | Open |
| Village | Middle | Flat | Light | Keep where drawn | Open |
| Beach (west) | Sea level | Flat | Light | Keep where drawn | Open |
| Meadow | Middle | Gentle rolling | Light | Move freely | Visible, closed |
| Mountain | Highest point | Cliffs and rock | Light | Move freely | Visible, closed |
| Rivers and falls | Highest point | Cliffs and rock | Light | Rethink it | Visible, closed |
| Forest and ruins | High | Hilly | Dense | Rethink it | Visible, closed |
| North island | Middle | Hilly | Medium | Rethink it | Visible, closed |
| Islets | Low | Hilly | Light | (not picked) | Visible, closed |

- **Whole map:** Hypixel Skyblock is the model. It should be lively at the key spots (town, ruins) and spacious elsewhere, with room for hidden quests and easter eggs. Reference: `plan-2026-10-23/whole-island.jpg`: stylised stacked cliffs, grass tops, sand paths.
- **Wharf:**
  - a busy fishing port by day and cozy lanterns by night;
  - the quay stands above the sea and overhangs the water a little, with ladders down and a ship dock area;
  - terraced steps up to the village;
  - a fish market right outside, fishing huts along the side, and a night bar (sushi and drinks);
  - planks, boats, nets, barrels, lanterns and lamps;
  - glowing jellyfish in the water at night;
  - **lighthouse islet:** smaller and further off shore than the drawn islet, to one side.
- **Path from the wharf to the village:**
  - a noticeable stone path, with stairs where it climbs;
  - fences along the sides, bushes and lamps.
- **Village:**
  - **Layout:** around a central plaza, scattered outwards. HQ at the back centre, the café to the right, the shop to the left, the museum a bit further out. Resident houses fill the gaps, and the buildings layer so the town reads as grown, not placed.
  - **Feel:** cozy and cohesive, with buildings close together and decor tying them into one community.
  - **Waterfall:** maybe a waterfall in the plaza.
  - **Campfire:** moves to the beach.
  - **Building style:** a building set in the spirit of the wharf references' fun houses, with the ACNH vibe ("do not take references too literarly").
- **Beach:**
  - wide yellow sand, palms and beach chairs;
  - sunny and relaxing;
  - the campfire (bonfire) goes here, plus fishing events and shell picking.
- **Meadow:**
  - farm fields and rolling meadow with a slight rise and some trees;
  - wilderness and room to explore, the side-quest area, emptiness that balances the map;
  - "needs more thinking".
- **Mountain:**
  - **Look:** grand and exaggerated. Very high peaks, layered cliffs, majestic from below.
  - **Waterfalls:** a big waterfall with mist.
  - **Temples:** Asian-inspired temples growing on the sides and around the falls.
  - **The climb:** an obby, with a winding trail, carved stairs, a suspension bridge and parkour.
  - **Summit:** the Oracle shrine, where you get your role and the glider, then glide down.
  - **Cave:** in the middle section, easier to reach, for pond and cave fishing (mining and fighting later).
- **Rivers and falls:**
  - **Upper waterfall:** a small top fall, for looks only.
  - **Main waterfall:** pours over a cliff from mountain layer 2 to layer 1, into a pond that drains back into the mountain through a cave opening.
  - **Crossings:** bridges for big crossings, stepping stones for shallow ones.
- **Forest and ruins:**
  - **Trees and terrain:** tall, thick cedar-like trees with god rays, a small trail, wilderness. The land is hilly and bent.
  - **Camera:** David asks how a dense forest works in third person. Answer him with a test view.
  - **Ruins:** leftover portal-ruin walls overgrown with vines. Mobs live here and sudos are caught here.
  - **Main buildings:** a castle, ponyglyphs, and a broken portal to the sudo portal he's building.
- **North island:**
  - far enough that nobody thinks of jumping;
  - bigger, longer bridges, closed at launch;
  - its purpose is undecided.
- **Islets:** small, pretty from afar; boats open them later.

## Launch scope (Oct 31)

- **Open:** the wharf, the west beach and the village.
- **Closed naturally**, in David's words: "think of natural ways to clsoe, broken bridge, a guard keeping you out, no foot access because of a land slide kinda thing":
  - broken bridges to the north island;
  - landslide rockfall across the mountain trail and the forest way;
  - for the meadow edge, propose landslide, terrain or a river with a washed-out bridge;
  - a guard is welcome where an existing NPC or resident figure can stand with one line. If none exists, ask; don't build a new NPC system.
  - No invisible walls. `sealed.test.ts` must pass with the switch on.
- **Cut first if time runs short:** "none". So order the work, don't cut it. The go/no-go on Oct 28 is the safety net: if the new world isn't ready, the village ships and the new world follows.

## Order of work

Three review rounds. The coordinator publishes each as an approve/redo page; a round's renders are a headless top-down map with zone labels plus about 8 in-game views (arrival at the wharf, the path up, the plaza, HQ, the beach, the mountain seen from the village, the forest edge, the north strait).

**R1, the whole landform (target Oct 24):**
- every zone's shape and height;
- the coast, the strait to the north island, the islets and the lighthouse islet;
- the open area's levels: wharf terraces, village plateau, beach;
- the mountain's layered cliffs.

No objects moved yet. Get David's notes before R2.

**R2, the open area and the closures (target Oct 25):**
- **Village:** buildings placed per his layout, on their pads.
- **Houses:** resident houses as scenery shells (existing house models, doors closed) filling the gaps.
- **Wharf:**
  - the quay above the water, ladders and the dock;
  - stalls, carts, barrels and nets from existing assets for the market;
  - the lighthouse model.
- **The path:** stone, stairs, fences and lamps.
- **Beach:** the campfire, palms and chairs.
- **Landmarks and objects:** the spawn and the arrival route. Move the existing landmarks, lamps, benches and study tables.
- **Closures:** in place.
- **Tests:** green.

David's editor session (resident anchors, gather and bug spots, mailbox, boards) follows R2.

**R3, dressing (target Oct 26):**
- light trees and bushes in the village;
- dense cedars in the forest;
- trees on the meadow and the north island;
- rock on the cliffs.

Every asset comes from the repo (`web/public/assets/`): palms, cedar, pines, rocks, fences, bridges, boat, barrel, market cart, shop-market, house-common, house_1, lighthouse, campfire, stone lantern, the ruins set. Perf stays within the new world's High budget (4.8 ms and 222 draws today); instance repeated props.

**After launch, in order** (not cut, sequenced):
1. The village building set: new house models in the wharf-fun-house style. Needs art references and asset packs from David. On 2026-10-26 he said today's buildings are "so so midevle vibes its too generic, wanna have more fun with it" and that it "needs more planning": a planning session with him first (`specs/references/terrain/r2-2026-10-26/`).
2. The wharf's fish market, fishing huts and the night bar as real buildings; glowing jellyfish at night.
3. The mountain:
   - elevated water;
   - the big waterfall with mist, the pond and the cave mouth;
   - temples, the carved stairs, the suspension bridge and the obby;
   - the summit shrine and the glider.
4. The forest:
   - god rays and the trail;
   - the portal ruins, the castle and the broken portal.
5. Meadow farm fields and side quests; the north island's purpose; boats to the islets.
6. The world's lighting, after David's side note "check out this game lighting" (`specs/references/terrain/r2-2026-10-26/lighting-game.jpg`).
7. The dungeon and cave lamps in the style of `lamp-dungeon.jpg` (same folder), when the cave is built.
8. Beach volleyball you can play 2v2 with friends on the beach's net (David, 2026-10-26: "add a volly ball net somewhere where you can play 2v2 vollyball with friends"). The net is placed; the game needs ball physics and a match.
9. The shipwright's ship you can go into, where the shipwright builds you a ship (David, 2026-10-26).
10. The fish market's inside (a buy shop and appraisal) and the tackle shop's store (rods and equipment).
11. The sushi bar's phase B: `specs/launch/sushi-bar.md`.

## Gates (every round)

- **Static checks:** web tsc and lint clean on changed files.
- **Tests:**
  - `lib/game/world/*.test.ts` green;
  - `sealed.test.ts` passes with `NEXT_PUBLIC_GAME_WORLD=new` (no leaks into closed zones);
  - `routes.test.ts`: the crossing stays on water and Bram's stops are walkable;
  - `groundGate.test`.
- **Cells:** rerun `scripts/world-cells.ts`; `cells.test.ts` green.
- **Perf:** one headless run on the new world (`SCENES=v2`), High and Lite, against today's numbers.

## David's answers, verbatim (2026-10-23)

- **whole:** feel "I take inspiration from hypixel skyblock map, i want the map to be lively in key locations like ruins, town, but more spatious and more exploring forward for plains but also have a lot of hidden mini quest and easter egg stuff the more you explore." Bugs "that the map levels arent what i want and how it isnt what my vision for the areas are like, things are not naturally generated and my vision for certain areas arent accurate". Size "About the same", "should take longer, its fine". Refs: whole-island.jpg, whole-wharf.jpg.
- **wharf:** feel "busy fishing port, theres a fish market right outside the wharf, the wharf is lively with fishing huts on the side, at night you can sometimes see glowing jellly fish in the water , at night the lanterns are vibey and good aesthetic, the wharf should exist higher than sea level, so the wharf over hangs the water by a bit and theres like ladders to go in the water and ship doc area". Link "a noticible path to the village with stairs if theres elevation or stone path and fence on the side, bushes and lamps". Things "planks, boats, nets, barrels, market place, light house a bit off to the side, lanterns and lamps". Notes "make it lively in the day time, busy fishing area, but at night its very cozy, make the island off the shore a lighthouse island, ou can make it smaller and further away, use lh reference. there is fishing market, fishing hut, and a bar that opens at night that sells sushi and drinks with good vibes". Refs: wharf-2/3/4, wharf-sharkbar, wharf-fishing-hut-1/2, wharf-lighthouse.
- **village:** buildings "HQ should be in the back center, main building, then scatter cafe to the right, residential houses that fill the gap, campfire moved to the beach, shop to the left, museum a bit further but keep layering the builindings so that the town development feels natural". Feel "like a cozy town, the feeling should feel cohesive and buildigns are next to each other and decor bounding them together and have a community feel rather than feeling like placing a few building here and there. there should be a unique building style that makes the buildings feel more cohesive." Layout "around center plaza, theres a water fall maybe its scattered ourtwards". Notes "do not take references too literarly, but i want to develop a building model set that has similar looks to the wharf fun looking houses, while maintaining the acnh vibe and have it cohesive". Refs: village-town-1/2.
- **beach:** feel "relaxing, bon fire, lounge chairs, fishing events, sea shell picking, stuff like that". Look "wide sand, palms, beach chairs, it should give off a sunny relaxing vibe". Notes "this is moreso a feeling you need to convey, suns beaming blue skys, yellow sand". Ref: beach.jpg.
- **meadow:** feel "farm fields rolling meadows, this area serves more for exploring, more side quests are found here, this is more like wilderness, just some emptiness to balance the map". Hill "slight raise in elevation and trees". Notes "this area needs more thinking on what to be done".
- **mountain:** feel "should be dramatic mountain, very high peaks and layered cliffs, should feel grand and majestic from below, big water fall and has like the waterfall fog coming off from it,". Climb "winding trail, carved stairs, suspension bridge and parkour, should feel like an obby". Summit "peak top is oracle where you get your role, and glider, a shrine religious looking, cave is in the middle section of the mountain, easier to access,  for pond and cave fishing. cave is for underground mining and fighting later." Notes "this needs to be grand and exaggerated, look at reference, i want buildings growing on the side of the mountain and around the waterfall, building should feel more like asian insipred temples, top is a temple shrine to get role with glider to glide down the mountain". Refs: mountain-1/2/3/5.
- **rivers:** feel "the water fall on the top is just for visuals, the main waterfall will flow from layer 2 of the mountain to layer 1 where it collects into a pond and flows back in the mountain through a cave opening". Falls "big waterfall, and when it flows down its like flows over a cliff and not down the mountain to layer 1, top water fall is small for visual effects". Cross "bridges for big crossing and stepping stone for small shallow ones". Refs: rivers-waterfall-1/2.
- **forest:** feel "taller bigger tree models, like cedar kinda trees, thicker, and light rays beam through the tree, god ray for aesthetic, and small trail but feel wilderness". Ruins "ruins, there are left over portal ruins walls overgrown with vines, youll encounter a lot of the mobs here and also where you will catch sudos, main buildings are a castle, ponyglyphs, and ad broken portal that transports sudo to the sudo portal thing im building". Notes "make the landscape of the forest hilly and bent, wondering how it will work 3rd person with dense forest". Refs: forest-1/2.
- **north:** feel "not sure what to use it for yet". Bridges "bigger longer bridges, not open at launch, island should be far away enough they dont think about jumping over". Notes "dunno what im doing with this yet".
- **islands:** feel "these are small islands that looks aesthetic from afar, will later be opened wher boats are unlocked". Notes "needs more planing in the future".
- **launch:** open "wharf, west beach, village". Closed "think of natural ways to clsoe, broken bridge, a guard keeping you out, no foot access because of a land slide kinda thing". Cut "none".

All references are in `specs/references/terrain/plan-2026-10-23/` (David's uploads; never add ones of our own).
