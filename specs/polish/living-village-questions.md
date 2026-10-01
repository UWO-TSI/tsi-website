# Living village: questions for David

Spec: `living-village.md`. Branch `game/polish-village`. Every question below has an assumption already built in, so nothing here blocks. Answer whichever you like; the rest stays as built.

## 1. The resident roster (deliverable 7, rows 85, 92, 122, 217)

These are placeholders until your list of founders' and honorary people's names and traits arrives (row 217). They are built as data:
- each is an `npc_personas` row: name, post, bio, tone, lines, and a routine and home in the existing `schedule` JSON;
- each has a look on the character rig, keyed by slug in `web/lib/content/residentRoster.ts`.

Right now they appear only in dev (the Supabase-less fallback). The live island keeps its two seeded residents until you approve the seed migration. I haven't written that migration.

| Name | Post | Look | Traits, quirk | Home | Routine (dawn / day / evening / night) |
|---|---|---|---|---|---|
| **Wren** | HQ lead | Club crew tee, high ponytail, freckles, shoulder bag (the first-login greeter's look on main) | Warm, a little scattered; runs club goals and the notice board; meets every new member on the wharf | Clubhouse | Clubhouse steps / clubhouse, plaza, path, clubhouse, pond / plaza, bench / bench under the lamp, then home |
| **Toren** (seeded) | Shopkeeper | Square glasses, sage sweater vest, charcoal trousers, work boots | Dry, deadpan; thinks everything is overpriced; secretly restocks what people like | Shop | Shop front / shop, plaza, shop, pond / shop, pond / home |
| **Odile** | Museum curator | Braided crown, round glasses, cream collar shirt, navy pleated skirt | Precise, earnest, owlish; says the Latin name of every bug | Museum | Pond / museum, pond, beach / museum, plaza / home |
| **Bram** | Wharf keeper | Navy beanie, blue striped top, yellow rain boots, grey hair, freckles | Playful, weathered; reads the weather off the gulls; a story for every knot | Clubhouse (see 2b) | Wharf / wharf, beach, wharf, plaza / wharf, bench / bench, then home |
| **Sable** | Oracle keeper | Lavender robe, long dark hair, shell necklace, sandals | Quiet; answers questions with better questions; stargazes from the temple steps | Oracle temple | Temple / temple, pond, temple / temple, pond / temple steps, then home |
| **Pim** | Workshop crafter | Wood-brown jumpsuit, cap, backpack, ginger hair | Tinkerer; combs the beach for driftwood; a pencil behind one ear | Clubhouse (the workbench is inside) | Home (a late riser) / clubhouse, beach, path, plaza / plaza, clubhouse / home |
| **Rosa** (in code) | Café owner | As shipped by the café polish | As shipped | The café | Stays in the café (her work loop there) |
| **Mayor Eliza** (seeded) | Villager: the island's historian | Grey bun, round glasses, lavender cardigan, long brown skirt, scarf | Warm; remembers everyone's first week; tells the club's story to anyone who sits still | Clubhouse | Home / path, plaza, bench, pond / plaza, pond / home |
| **Juniper** | Villager | Teal tee, joggers, high ponytail | Early riser; runs the beach at dawn and stretches on the sand; knows every shortcut | Clubhouse | Beach, path / pond, plaza, beach / plaza, bench / home |
| **Marlo** | Villager | Straw hat, pink hoodie, shoulder bag of pencils | Sketches the island a page a day; has drawn the clubhouse forty times | Clubhouse | (day routine) / bench, pond, museum / beach, bench / home |
| **Nell** | Villager: the night owl | Navy cardigan, yellow scarf, long wavy hair | Sleeps in; out all night under the lamp; names constellations after club members | Clubhouse | Home / home, plaza, temple / beach, bench / bench, beach, bench (out all night, so the village is never empty) |

That's ten in the village plus Rosa in the café: 11 of the 8 to 12 in row 85.

**Assumptions taken:**
- **a. Two HQ leads.** The HUD agent's first login (on main, `lib/game/welcome.ts`) already names **Wren** as the HQ lead. I kept her as the HQ lead with that look. The seeded Mayor Eliza (who had no post) becomes the island's historian, a villager. I renamed my night owl from Wren to Nell.
  - On merge, the welcome scene's Wren and the walking Wren should be one person. The simplest fix is for the welcome to hide the walking `wren` resident while it plays. **Question:** keep Mayor Eliza as a villager, or make her the HQ lead and Wren someone else?
- **b. Homes.** Flavour villagers and Bram have no house of their own: the map has none, and you place buildings (rows 241, 246, 247). Until you do:
  - villagers lodge in the clubhouse;
  - Bram also sleeps in the clubhouse. The routine already supports "home: wharf" (stepping aboard a boat at the stub end), which needs the docked boat from the arrival-wharf spec.

  **Question:** do you want villager houses on the map, and where?
- **c. Looks.** An authored look applies wherever that slug appears, so the live Toren and Mayor Eliza now wear their authored looks instead of slug-seeded random ones. To revert, delete their two entries in `RESIDENT_LOOKS`.
- **d. Looks as admin data.** `npc_personas` has no look column, so a resident an admin adds gets a look seeded from its slug. **Question:** shall I add a `look jsonb` column, with a look picker in the Residents editor (the character creator's), so admins can dress new residents?
- **e. Dialogue.** The lines are mine (three each), awaiting your review (row 217: "dialogue drafts return for his review"). Personal quest chains (row 92) are not written; that's later content.

## 2. Behaviour calls I made

1. **They step round you.**
   - A walking resident who meets you on their path steps half a stride off it to pass you.
   - They wait only where there's no room (a bridge). Waiting holds their routine, and they catch up a little brisker afterwards.
   - They turn to face you only once they've stopped and you're within 3.4 units.
2. **One greeting at a time.** Walk into a group and the first to notice you says a line. Only the nearest resident shows the "!" and a nameplate, so a bench of three never stacks three labels. Each resident waits at least 22 s before greeting you again.
3. **Chatting.** Two stopped residents within 2.6 units face each other and take turns talking (the new Chat clip and the talking mouth), with an occasional laugh. They break off to face you if you come close.
4. **Idles.**
   - A look round (new LookAround clip) or a standing stretch (new StretchUp clip) every 14 to 26 s at a stop.
   - Gazing out at the pond, beach and wharf.
   - Sitting on benches.

   **Question:** any idles you want added (sweeping at the shop, fishing at the pond, a yawn at night)? Each is a clip in `build_clips.py`.
5. **Night.**
   - Residents go home in through their door. The building's front wall hides them as they reach the door, since the doors don't open.
   - Or they sit on the bench under the lamp. There is one lamp and two benches on the map. A bench seats three, and each phase's sitters take their own seats, the lamp bench first, so no two ever share a seat.
   - When you place more lamps (row 246), the routine finds benches under them automatically.

   **Question:** should doors open, as in ACNH? That needs a door-open animation on the ACNH door parts.
6. **Ceremony.** Residents leave their routine, walk to the map's gather spots, face the monument and cheer (the Cheer clip). Afterwards they walk back onto their routine.

## 3. Ambient life

1. **Gulls** circle low (3.4 units up) over the sea off both side shores and the far shore of the village and the home island, all day and night.
   - Not off the near shore or the wharf: at that height their orbit ran through the follow camera.
   - **Question:** do gulls rest at night?
2. **Butterflies and dragonflies, by season and hour:**

   | Species | Seasons | Hours |
   |---|---|---|
   | Common butterfly | spring, summer, autumn | 7 to 17:30 |
   | Tiger | spring, summer | 7:30 to 17 |
   | Agrias | summer | 8 to 17 |
   | Monarch | summer, autumn | 8 to 17 |
   | Peacock | spring, summer, autumn | 5 to 19 |
   | Emperor | summer, autumn | 17 to 21 |
   | Darner dragonfly | spring, summer | 8 to 17 |
   | Red dragonfly | summer, autumn | 8 to 18:30 |

   - About 10 butterflies over the flower patches and 6 dragonflies along the river and pond. Light mode has 6 and 3.
   - They lift away in rain and snow and at the end of their hours.
   - None in winter.

   **Question:** right density?
3. **Crabs.** Six crabs on the beach (four in Light mode).
   - They sidle along the waterline.
   - They freeze when you're within 4 units.
   - Within 2.2 units they scuttle off sideways and dig into the sand, coming back up 6 s after you've left.
4. **Fish leaping.** Leaps are seeded per 10×10 square of open sea, about one every 50 s per square. That's one every few seconds somewhere on screen at the wharf, each with a splash out and back in.
   - Row 195 ruled out fish shadows. I read the spec's "fish jumping" as allowed.
   - **Question:** keep the rate, halve it, or remove the leaps?

## 4. Night and light

- **Phase blend.** The light now blends across each phase boundary over 20 minutes either side: dawn's start, sunrise, golden hour's start, nightfall. Before, it stepped.
  - It updates once a minute (the world clock tick), so each step is small.
  - A forced phase (the time menu, `?time=`) still jumps at once, by design.
- **Windows.** Every building with windows glows warm from inside as the light falls: the shop, the Oracle temple, the museum chalet and the home house. The clubhouse is unchanged.
  - The boarded museum glows too, since Odile the curator lives there. **Question:** keep it dark until it opens?
- **Lamps.** The street lamp's globe and light pool, the clubhouse porch lights and the home doorway light now fade over about 3 s.
- **Lamp placement.** Still yours (rows 163, 246). Nothing was placed or moved.

## 5. Weather

- **Rain.** Rain lands on the ground at about 0.4 drops per square unit per second as world state. Each drop gives a droplet crown and a wet ring (fainter in grass), and rings on puddles, the river and the sea.
  - **Question:** heavier? It's tuned to read as rain at the follow camera without busy noise.
- **Snow footprints.**
  - Prints are left in snow behind you and every resident, one per stride.
  - They last 14 s and fade over the last 6.
  - None on boards (bridges, decks) or water.
  - The print is a new row painted into our particle pack (`art/fx/build_pack.py`, "footprint").

  **Question:** wet-sand prints on the beach too?

## 6. Sounds this needs (none exist; row 125 and the Sound pass)

Wired with nothing (silent) until you pick a source:
- door open and close as residents go in and out;
- gull calls (distance-attenuated);
- crab skitter and dig;
- fish splash;
- rain on the ground and on water (a weather bed);
- footsteps in snow (the movement agent's footsteps use the blips);
- bench sit;
- the residents' chatter murmur.

## 7. Found along the way (not fixed: other specs own them)

- **Forage primitives.** Pink icosahedron flower tufts and red fruit spheres still show at forage nodes (`VillageLife.tsx` NodeVisual). They belong to the forage/craft spec.
- **CafeOwner.** `CafeOwner.tsx` still calls `setState` in its frame loop (`:63-64`): café files were out of bounds for me.
- **Seeded schedules.** The two seeded rows' schedules in production (`{"day": "path"}`, `{"day": "shop"}`) now mill about three spots near their anchor and go home at night. That's the routine engine's fallback, so production residents are no longer frozen on the path at 3 a.m.
