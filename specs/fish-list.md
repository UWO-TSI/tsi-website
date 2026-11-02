# The fish list: what you can catch, and why

Lane `fish-list`, round 1 (2026-11-02). The list for David's marks: every fish with its water, season, time, weather, rarity, chance per cast and sell price, what each one is for, the gaps, the new fish proposed to fill them (with legendary and Divine catches tied to class gear), and how the new ones get modelled. Nothing ships this round.

David (2026-11-02): "i need you to expand this fishing catagory", then: "The fish list: do for fish what the treasure page did for digging: every fish with its rarity as a percentage, where and when, what it's for (crafting materials for class gear, the tasting book, the aquarium), plus new fish to fill the gaps. A list for you to mark first, nothing built."

His treasure notes the same night set the direction: "give the percentage too for the rarity, more rare core crafting ingredient, like a few more legendary item to make legendary gear for mage, marksman, and the classes", "legendary and divine gear digs should have like a glow or aura to it", and for the tasting book "every new fish you find you can cook it for a very small perm fishing buff ... it can unlcok dishes taht are temp big buff but require ingredients and expensive".

Read on `game/fish-list` (cut from `game/fishing-depth`, so it has round 5's whole seasons). Every number below is computed from the code on this branch (`fishPoolFor`, `rig`, the roster), not estimated, except the new fish, which are estimated by adding them to the same pools.

## 1. What exists today

**The roster.** 91 rod catches (`lib/collections/roster.ts`: `FISH_ROWS`, `SEA_ROWS`, `EVENT_SPECIES`, `REEL_FISH`), every one with a reel entry in `lib/game/fishing.ts` `FISH` and a remodelled model (`art/remodel/build_fish.py`: 600 to 2,000 triangles, one material, one texture, a soft wet sheen).

| Water (roster biome) | Kinds | common | uncommon | rare | epic | legendary | Divine | Can you fish it today? |
|---|---|---|---|---|---|---|---|---|
| River | 30 (2 tourney only) | 8 | 10 | 5 | 7 | 0 | 0 | yes |
| Cliff pool | 4 | 0 | 0 | 1 | 3 | 0 | 0 | no water of its own: they bite in the river (see findings) |
| Pond | 13 | 5 | 6 | 1 | 1 | 0 | 0 | no: the pond is up the mountain, shut (David: "pond only in mountain") |
| Sea | 44 (34 fish, 10 sea creatures; 1 tourney only) | 12 | 14 | 6 | 12 | 0 | 0 | yes |
| Deep sea | 0 | | | | | | | no: the HUD's biome tag names it (fishing-depth r6), but no water rolls it yet; the boats are next launch (m7) |

**How a cast picks a fish** (`fishPoolFor` in `lib/game/peaceful.ts`, rolled on the server in `lib/collections/rolls.ts` `fishRoll`):

1. **Who's out:** the water's species that bite now. Season (whole seasons since round 5: spring Mar to May, summer Jun to Aug, autumn Sep to Nov, winter Dec to Feb), the Toronto hour, the island's weather (the reel only knows sunny, cloudy and rain: snow and fog count as cloudy), and the tourney window for the 3 event fish.
2. **The rod's cap** (`hookCap`, `lib/game/rods.ts`): a rod hooks one rung above its own rarity. Flimsy (common, the starter) hooks up to uncommon; Cedar (uncommon, shop) up to rare; Glass (rare, shop) and Lighthouse (rare, crafted) up to epic; Tidewarden (epic, crafted) up to legendary. A legendary rod would hook Divine; none exists.
3. **Weights:** common 100, uncommon 48, rare 18, epic 7, legendary 2.5, Divine 0.4 (`RARITY_META`). Rare and up are multiplied by (1 + luck). The Golden Koi counts double in rain.
4. **Luck:** cast power (0 to 1) plus 0.3 on a MAX cast, plus the rod's luck (0.04 per 10 luck over 10: Cedar 0.08, Glass 0.12, Lighthouse 0.16, Tidewarden 0.24), the Lucky bobber 0.08, rain 0.1, a sushi meal 0.05 to 0.35, fishing together 0.1. Sweet bait changes the bite window and the wait, not the odds.

**The rarity bands per rod** (share of casts by rarity, averaged over the year's seasons and hours in fair weather):

| Water | Gear and cast | common | uncommon | rare | epic |
|---|---|---|---|---|---|
| River | Flimsy (any cast) | 68.8% | 31.2% | 0 | 0 |
| River | Cedar, plain cast | 63.0% | 28.5% | 8.5% | 0 |
| River | Cedar, MAX cast | 57.2% | 25.8% | 17.0% | 0 |
| River | Glass, plain cast | 61.3% | 27.4% | 8.6% | 2.7% |
| River | Glass, MAX cast | 54.5% | 24.1% | 16.3% | 5.1% |
| River | Tidewarden, MAX cast | 54.0% | 23.8% | 17.0% | 5.2% |
| River | Tidewarden + Lucky bobber, MAX cast | 53.6% | 23.6% | 17.4% | 5.4% |
| Pond | Flimsy (any cast) | 34.2% | 65.8% | 0 | 0 |
| Pond | Cedar, MAX cast | 33.5% | 63.9% | 2.6% | 0 |
| Pond | Glass, MAX cast | 32.4% | 61.0% | 2.5% | 4.1% |
| Pond | Tidewarden + Lucky bobber, MAX cast | 32.3% | 60.6% | 2.7% | 4.4% |
| Sea | Flimsy (any cast) | 70.6% | 29.4% | 0 | 0 |
| Sea | Cedar, plain cast | 68.4% | 28.4% | 3.2% | 0 |
| Sea | Cedar, MAX cast | 65.9% | 27.3% | 6.8% | 0 |
| Sea | Glass, plain cast | 66.8% | 27.7% | 3.3% | 2.2% |
| Sea | Glass, MAX cast | 62.9% | 26.1% | 6.6% | 4.4% |
| Sea | Tidewarden + Lucky bobber, MAX cast | 62.3% | 25.9% | 7.1% | 4.8% |

Rain adds 0.1 luck on top (a few tenths of a point more rare and epic). A meal or a friend beside you adds the same kind of nudge.

**What a fish is for today:**
- **Sell:** `SELL_PRICES` fish and sea rows (`lib/wallet/catalogue.ts`): 8, 20, 60, 180 coins common to epic (legendary 600, Divine 1500, unused). No species has its own price.
- **Museum:** the first of each kind can be donated to the aquarium wing.
- **The tasting book** (on `game/tasting-book`, not merged): cook a species at Bancha's counter for its stamp, or give it to HQ's club tank. Round 2 there adds David's "very small perm fishing buff" per first cook and the dishes it unlocks.
- **Work:** the daily fish requests and weekly tasks (pay 2 times the sell price, you keep the fish), the chef's order (3 times, he takes it), Bancha's feast (cooked from your own epic), size records and the club board.
- **Main quest:** Juno takes your first catch for the halls (m1).
- **Recipes** (`lib/crafting/recipes.ts`), the whole fish as an ingredient: Black Bass and Pearl Oyster (Lighthouse rod), Tuna and Giant Isopod (Tidewarden rod), Golden Koi (Koi kimono), Football Fish (Rune staff). Nothing else.
- **Gifts** (`RESIDENT_GIFTS`): by category only. Fish: loved by Juno and Bram, liked by Toren and Odile, hated by Sable and Nell. Sea creatures: liked by Odile, Bram, Pim and Juniper, hated by Mayor Eliza and Marlo. No fish is named.

**Findings while reading** (for the coordinator, none fixed here):
1. **The starter rod can't feel a MAX cast.** Cast luck only lifts rare and up, and the Flimsy rod hooks only common and uncommon, so a MAX cast changes nothing for a new player.
2. **The rod's luck stat barely moves the odds.** Glass to Tidewarden at a MAX cast moves the river's epic share from 5.1% to 5.2%: the cast's 1.3 dwarfs the rod's 0.12 to 0.24. What a better rod really changes is the cap (which rarities can bite). That is rod-gear's call; it matters for the hex radar's honesty.
3. **Cliff pool fish already bite in the river** (`fishPoolFor` sends every non-pond fish to the river), while the tasting book's Cliff pools page says "Opens later". One of the two should change.
4. **The pond is shut, so 13 fish can't be caught,** among them the Golden Koi, which the Koi kimono recipe needs, and the Snapping Turtle.
5. **No fish is legendary or Divine** (by design: the boss reel and the raid are behind `NEXT_PUBLIC_FISH_BOSSES`). Divine also needs a legendary rod, and there isn't one.
6. `fishing.ts`'s header still says "Legendary is deliberately tight (7)": stale since the re-tier.

## 2. The rules every fish follows

1. **A reason beyond coins.** Every fish already has four: the museum, the tasting book, HQ's tank and the fishing tasks. This list adds a fifth to almost every one: a crafting material (section 5), and for some a resident who loves it by name or a dish.
2. **Fits the island.** Ontario seasons, the river, the mountain pond, the sea off the wharf, the deep sea past it. Legendary and Divine are the creatures of legend David asked for ("sea monsters and stuff thats like building level", "divine is like actually crazy big models and is like server size fight"), with the tech skin he wants and the lore allows (the island's monsters are feral hardware the sea grew over). No real names; item text never explains the war or quotes the Founder.
3. **Uses what's there.** The one rarity ladder, the roster's `months`, `hours` and `weather`, `SELL_PRICES`, `RESIDENT_GIFTS` keys, rows in `recipes.ts`.
4. **Hard at the top.** Legendary and Divine get a fixed, small chance per cast (section 7), the way the treasure page set its legendary at about 1 in 600.

## 3. The roster (all 91)

**Columns.** *Hours* are island time, start to end, wrapping past midnight. *Starter*: the chance per cast in its water while it's out, fair weather, Flimsy rod ("no": the starter can't hook it). *First rod*: the first rod that hooks it, on a MAX cast (Cedar for rare, Glass for epic). *Best*: Tidewarden with the Lucky bobber on a MAX cast (bait doesn't change odds). Common and uncommon fish lose a little share as the rarer ones join the pool. *Coins*: the sell price. *Purpose (new)*: the material it leaves when released (section 5), plus G (a resident who would love it by name), R (a recipe that uses it today), dish (a dish ingredient candidate for the tasting book's round 2). Every fish also has the museum, the tasting book stamp, HQ's tank and the fishing tasks, not repeated per row. Cliff pool fish are listed as cliff pools but roll in the river today.

| Fish | Water | Seasons | Hours, weather | Rarity | Coins | Size cm | Starter % | First rod % | Best % | Purpose (new) |
|---|---|---|---|---|---|---|---|---|---|---|
| Dace | River | all year | any | common | 8 | 10-18 | 24.3 | - | 18.7 | Fish Scale |
| Freshwater Goby | River | all year | 20-04 | common | 8 | 10-15 | 26.3 | - | 19.4 | Fish Scale |
| Guppy | River | Sp Su Au | 06-18 | common | 8 | 3-5 | 14.7 | - | 11.9 | Fish Scale; G: Odile |
| Loach | River | Sp | any | common | 8 | 12-20 | 24.1 | - | 18.1 | Fish Scale |
| Neon Tetra | River | Sp Su Au | 06-18 | common | 8 | 3-4 | 14.7 | - | 11.9 | Fish Scale; G: Marlo |
| Pale Chub | River | all year | 06-18 | common | 8 | 8-14 | 19.4 | - | 15.6 | Fish Scale |
| Pond Smelt | River | Wi | any | common | 8 | 6-10 | 36.1 | - | 28.9 | Fish Scale; dish: fried smelt |
| Yellow Perch | River | Au | any | common | 8 | 20-30 | 14.6 | - | 11.0 | Fish Scale; tourney catch |
| Angelfish | River | Su Au | any | uncommon | 20 | 8-12 | 8.9 | - | 6.7 | Fin |
| Betta | River | Su Au | 06-18 | uncommon | 20 | 6-8 | 6.5 | - | 5.3 | Fin; G: Juniper |
| Doctor Fish | River | Su | any | uncommon | 20 | 15-25 | 9.5 | - | 7.3 | Fin |
| Mitten Crab | River | Au | any | uncommon | 20 | 10-18 | 8.3 | - | 6.1 | Crab Shell; dish: hotpot; G: Pim |
| Rainbow Trout | River | Sp Au | 05-19 | uncommon | 20 | 30-50 | 8.0 | - | 6.3 | Fin |
| Salmon | River | Au | any | uncommon | 20 | 50-80 | 8.3 | - | 6.1 | Fin; dish: Salmon nigiri (menu) |
| Soft-shelled Turtle | River | Su Au | any | uncommon | 20 | 20-35 | 8.9 | - | 6.7 | Crab Shell |
| Sweetfish | River | Su | any | uncommon | 20 | 18-30 | 9.5 | - | 7.3 | Fin; dish: salt-grilled |
| Tilapia | River | Su Au | any | uncommon | 20 | 25-40 | 8.9 | - | 6.7 | Fin |
| Yamame Trout | River | Sp Au | any | uncommon | 20 | 20-35 | 9.9 | - | 7.4 | Fin |
| Bichir | River | Su | 20-04 | rare | 60 | 40-70 | no | Cedar 8.1 | 7.5 | Armour Scale |
| Black Bass | River | all year | any | rare | 60 | 30-55 | no | Cedar 8.6 | 8.8 | Fin (2); R: Lighthouse rod (today) |
| Pike | River | Au | any | rare | 60 | 50-90 | no | Cedar 5.9 | 6.0 | Fang |
| Piranha | River | Su | 06-18 | rare | 60 | 25-40 | no | Cedar 5.4 | 5.6 | Fang |
| Snakehead | River | all year | 09-16 | rare | 60 | 40-90 | no | Cedar 6.7 | 7.1 | Fang |
| Arapaima | River | Su | 16-09, rain any hour | epic | 180 | 150-300 | no | Glass 2.9 | 3.0 | Arapaima Scale (Guardian) |
| Arowana | River | Su | 20-04 | epic | 180 | 60-90 | no | Glass 2.8 | 2.9 | Silver Scale (Illusionist) |
| Catfish | River | all year | 20-04, rain any hour | epic | 180 | 50-110 | no | Glass 3.4 | 3.6 | Whisker (Shaman) |
| Dorado | River | Su | 06-18 | epic | 180 | 70-100 | no | Glass 2.0 | 2.2 | Golden Scale |
| Golden Arowana | River | Su | 20-04 | epic | 180 | 70-100 | no | Glass 2.8 | 2.9 | Golden Scale |
| King Salmon | River | Au | any | epic | 180 | 70-120 | no | Glass 2.2 | 2.3 | Roe (dish ingredient); feast |
| Sturgeon | River | Au | any | epic | 180 | 100-200 | no | Glass 1.9 | 2.0 | Ancient Bone (Necromancer); Roe; tourney catch |
| Char | Cliff pool | Sp Au | any | rare | 60 | 40-60 | no | Cedar 7.1 | 7.3 | Armour Scale |
| Gar | Cliff pool | Su | 16-09, rain any hour | epic | 180 | 90-150 | no | Glass 2.9 | 3.0 | Gar Fang (Assassin) |
| Golden Trout | Cliff pool | Sp Au | any | epic | 180 | 40-60 | no | Glass 2.7 | 2.8 | Golden Scale |
| Stringfish | Cliff pool | Wi | 21-04, rain any hour | epic | 180 | 80-130 | no | Glass 4.5 | 4.8 | Frost Fin (Elementalist) |
| Bitterling | Pond | Wi | any | common | 8 | 5-10 | 28.4 | - | 26.9 | Fish Scale |
| Crayfish | Pond | Sp Su | any | common | 8 | 5-12 | 18.2 | - | 17.0 | Shell Grit |
| Frog | Pond | Su | any | common | 8 | 5-10 | 16.5 | - | 15.6 | none (book, tank); G: Nell |
| Killifish | Pond | Sp Su | 06-20 | common | 8 | 3-5 | 16.4 | - | 15.9 | Fish Scale; G: Nell |
| Tadpole | Pond | Sp Su | any | common | 8 | 3-5 | 18.2 | - | 17.0 | none (book, tank) |
| Bluegill | Pond | all year | 09-16 | uncommon | 20 | 12-22 | 11.0 | - | 10.5 | Fin |
| Carp | Pond | all year | any | uncommon | 20 | 35-70 | 12.5 | - | 11.5 | Fin |
| Crucian Carp | Pond | all year | any | uncommon | 20 | 15-30 | 12.5 | - | 11.5 | Fin |
| Goldfish | Pond | all year | any | uncommon | 20 | 8-15 | 12.5 | - | 11.5 | Fin; G: Mayor Eliza |
| Pop-eyed Goldfish | Pond | all year | any | uncommon | 20 | 8-12 | 12.5 | - | 11.5 | Fin |
| Ranchu Goldfish | Pond | all year | any | uncommon | 20 | 10-15 | 12.5 | - | 11.5 | Fin |
| Snapping Turtle | Pond | Sp Su Au | 20-04 | rare | 60 | 20-35 | no | Cedar 10.5 | 10.9 | Turtle Shell |
| Golden Koi | Pond | all year | any | epic | 180 | 60-95 | no | Glass 4.1 | 4.4 | Golden Scale; R: Koi kimono (today); G: Mayor Eliza |
| Acorn Barnacle | Sea | all year | any | common | 8 | 2-4 | 8.0 | - | 7.0 | Shell Grit |
| Anchovy | Sea | all year | 06-18 | common | 8 | 10-15 | 7.8 | - | 7.0 | Fish Scale |
| Clown Fish | Sea | Sp Su | any | common | 8 | 8-12 | 7.1 | - | 6.2 | Fish Scale; G: Bram |
| Dab | Sea | Sp Au Wi | any | common | 8 | 25-45 | 8.3 | - | 7.4 | Fish Scale |
| Horse Mackerel | Sea | all year | any | common | 8 | 20-40 | 8.0 | - | 7.0 | Fish Scale |
| Scallop | Sea | all year | any | common | 8 | 8-14 | 8.0 | - | 7.0 | Shell Grit; dish: scallop |
| Sea Bass | Sea | all year | any | common | 8 | 50-90 | 8.0 | - | 7.0 | Fish Scale |
| Sea Butterfly | Sea | Wi | any | common | 8 | 2-4 | 9.0 | - | 7.8 | Shell Grit |
| Sea Star | Sea | all year | any | common | 8 | 8-15 | 8.0 | - | 7.0 | Shell Grit |
| Squid | Sea | Sp Su Wi | any | common | 8 | 20-40 | 7.7 | - | 6.8 | Squid Ink; dish: grilled squid |
| Surgeonfish | Sea | Sp Su | any | common | 8 | 15-25 | 7.1 | - | 6.2 | Fish Scale |
| Sweet Shrimp | Sea | all year | 16-09 | common | 8 | 5-9 | 7.9 | - | 6.9 | Shell Grit; dish: Omakase |
| Barred Knifejaw | Sea | Sp Su Au | any | uncommon | 20 | 30-50 | 3.7 | - | 3.2 | Fin |
| Blowfish | Sea | Wi | 20-04 | uncommon | 20 | 20-40 | 4.2 | - | 3.5 | Spine |
| Butterfly Fish | Sea | Sp Su | any | uncommon | 20 | 10-15 | 3.4 | - | 3.0 | Fin |
| Dungeness Crab | Sea | all year | any | uncommon | 20 | 15-25 | 3.8 | - | 3.4 | Crab Shell |
| Firefly Squid | Sea | all year | 21-04 | uncommon | 20 | 5-8 | 3.8 | - | 3.3 | Glow Ink; G: Marlo |
| Garden Eel | Sea | all year | 06-18 | uncommon | 20 | 30-40 | 3.7 | - | 3.4 | Eel Skin |
| Moray Eel | Sea | Au | any | uncommon | 20 | 60-100 | 4.2 | - | 3.8 | Eel Skin |
| Olive Flounder | Sea | all year | any | uncommon | 20 | 40-80 | 3.8 | - | 3.4 | Fin |
| Porcupine Fish | Sea | Su | any | uncommon | 20 | 20-35 | 3.3 | - | 2.9 | Spine |
| Red Snapper | Sea | all year | any | uncommon | 20 | 30-60 | 3.8 | - | 3.4 | Fin; dish: snapper rice |
| Ribbon Eel | Sea | Su Au | any | uncommon | 20 | 60-100 | 3.8 | - | 3.3 | Eel Skin |
| Seahorse | Sea | Sp Su Au | any | uncommon | 20 | 3-6 | 3.7 | - | 3.2 | Fin; G: Juniper |
| Suckerfish | Sea | Su | any | uncommon | 20 | 30-60 | 3.3 | - | 2.9 | Fin |
| Zebra Turkeyfish | Sea | Sp Su Au | any | uncommon | 20 | 25-40 | 3.7 | - | 3.2 | Spine |
| Abalone | Sea | all year | 16-09 | rare | 60 | 12-20 | no | Cedar 3.1 | 3.3 | Nacre |
| Football Fish | Sea | Wi | 20-04 | rare | 60 | 30-60 | no | Cedar 3.4 | 3.4 | Lantern Lure; R: Rune staff (today) |
| Giant Trevally | Sea | Au | any | rare | 60 | 80-150 | no | Cedar 3.4 | 3.6 | Armour Scale; tourney catch |
| Mahi-mahi | Sea | Su | any | rare | 60 | 80-140 | no | Cedar 2.8 | 2.8 | Fin (2); dish: grilled mahi |
| Pearl Oyster | Sea | all year | any | rare | 60 | 7-12 | no | Cedar 3.2 | 3.3 | Pearl; R: Lighthouse rod (today) |
| Ray | Sea | Au | 06-18 | rare | 60 | 100-200 | no | Cedar 3.4 | 3.6 | Ray Leather |
| Barreleye | Sea | all year | 20-04 | epic | 180 | 10-15 | no | Glass 1.2 | 1.3 | Barreleye Lens (Sniper) |
| Blue Marlin | Sea | all year | any | epic | 180 | 200-350 | no | Glass 1.2 | 1.3 | Marlin Bill (Marksman) |
| Coelacanth | Sea | all year | 20-04, rain only | epic | 180 | 120-180 | no | Glass 1.2 | 1.3 | Ancient Bone (Necromancer); G: Sable |
| Giant Isopod | Sea | all year | 20-04 | epic | 180 | 20-40 | no | Glass 1.2 | 1.3 | Isopod Plate (Guardian); R: Tidewarden rod (today) |
| Great White Shark | Sea | Su | any | epic | 180 | 300-500 | no | Glass 1.0 | 1.1 | Great White Tooth (Transmuter) |
| Hammerhead Shark | Sea | Su | any | epic | 180 | 180-350 | no | Glass 1.0 | 1.1 | Hammer Crest (Juggernaut) |
| Napoleonfish | Sea | Su | 06-18 | epic | 180 | 100-180 | no | Glass 1.0 | 1.1 | dish: Bancha's feast |
| Oarfish | Sea | Sp Wi | any | epic | 180 | 300-500 | no | Glass 1.2 | 1.3 | Oar Ribbon (Illusionist) |
| Ocean Sunfish | Sea | Su | any | epic | 180 | 150-300 | no | Glass 1.0 | 1.1 | Sun Scale (Priest) |
| Saw Shark | Sea | Su | 20-04 | epic | 180 | 120-200 | no | Glass 1.0 | 1.1 | Saw Rostrum (Hunter) |
| Tuna | Sea | Sp Wi | any | epic | 180 | 150-250 | no | Glass 1.2 | 1.3 | dish: Tuna roll (menu); R: Tidewarden rod (today); G: Toren |
| Whale Shark | Sea | Su | any | epic | 180 | 400-800 | no | Glass 1.0 | 1.1 | Whale Shark Hide (Martial Artist) |

Tourney fish (Yellow Perch, Sturgeon, Giant Trevally) are shown with the tourney open; outside it they never bite. The Coelacanth is shown in rain, the only weather it bites in.

## 4. The gaps

| Where it's thin | Today | Filled by (section 6) |
|---|---|---|
| River in winter, by day | 5 kinds: 3 common, 2 rare; no uncommon, no epic | Lake Whitefish, Muskellunge (day); Burbot (night) |
| River at dusk | every window is day, night, midday or any | Walleye (17:00 to 21:00) |
| Pond, all of it | 13 kinds, shut; 1 rare (night only), no common in autumn | Pumpkinseed, Mudminnow, Axolotl, Mossback Turtle, and Ness |
| Cliff pools | 4 kinds, no common or uncommon, no water of their own | Sculpin, Blind Cavefish, Crystal Crayfish (and a decision: own water or part of the river) |
| Sea in autumn, by day | 1 epic (Blue Marlin) | Sailfish |
| Sea in winter | 4 uncommon | Lumpfish, Snowflake Eel, Herring |
| Deep sea | nothing | 6 new kinds, 4 moved from the sea, and the Kraken and Leviathan |
| Weather | rain matters for 5 fish; snow and fog never do | Axolotl (rain), Snowflake Eel (snow, needs the reel to know snow), the legendaries' storms |
| Legendary and Divine | none | 4 legendary (one per class family) and 2 Divine |
| Class materials | none; 6 whole-fish recipe ingredients | the materials below, every subclass covered |

## 5. Crafting materials: what fish give

**How a fish gives one: let it go.** The catch card gets a third choice beside keep and sell: *Let it go*. The fish swims off and leaves its material behind (a shed scale, a fin, a squirt of ink, a tooth: sharks really do shed teeth). Nothing gets filleted, it stays cozy, and releasing becomes a real choice. Common and uncommon fish leave 1, rare and epic 1 (or 2 where the table says so). The first catch of a species still goes to the book and the museum as today. A legendary or Divine catch is always let go (it's the size of a building) and always leaves its core.

**The materials:**

| Material | Rarity | From | Used for |
|---|---|---|---|
| Fish Scale | common | most common fish | rod grips, every Guardian shield's facing, fishing outfit trims |
| Shell Grit | common | Scallop, Sweet Shrimp, Sea Star, Acorn Barnacle, Crayfish, Sea Butterfly | the polish in every crafted rod; shell housings for sudos later (lore: beachcombing) |
| Squid Ink | common | Squid | Summoner seals, Illusionist cards, Necromancer pages (tiers 1 to 3 looks) |
| Fin | uncommon | most uncommon fish (2 from Black Bass, Mahi-mahi) | Marksman fletching, Hunter bolt vanes, Shaman totem feathers |
| Crab Shell | uncommon | Dungeness Crab, Mitten Crab, Soft-shelled Turtle | Juggernaut and Guardian plating |
| Spine | uncommon | Blowfish, Porcupine Fish, Zebra Turkeyfish | Assassin kunai, Hunter barbs |
| Eel Skin | uncommon | Ribbon Eel, Moray Eel, Garden Eel, Gulper Eel, Snowflake Eel | Martial Artist wraps, bow and holster leather |
| Glow Ink | uncommon | Firefly Squid | Illusionist and Summoner glow; the lamps in place of a firefly |
| Pearl | rare | Pearl Oyster | Gunslinger grips, Priest and Sniper settings |
| Nacre | rare | Abalone | Illusionist card faces, staff inlays |
| Fang | rare | Pike, Snakehead, Piranha, Walleye | Transmuter charms, Assassin and Hunter edges |
| Armour Scale | rare | Bichir, Char, Giant Trevally | Juggernaut, Sniper stock |
| Ray Leather | rare | Ray | Martial Artist wraps, Marksman grip |
| Turtle Shell | rare | Snapping Turtle | Guardian shield |
| Lantern Lure | rare | Football Fish | Shaman totem light, the Rune staff (today it takes the whole fish) |
| Night Ink | rare | Vampire Squid (new) | Necromancer and Summoner, the rare look |
| Axolotl Frill | rare | Axolotl (new) | Druid |
| Crystal Carapace | rare | Crystal Crayfish (new) | Elementalist staffs (beside the treasure list's special crystals) |
| Golden Scale | epic | Golden Koi, Golden Trout, Golden Arowana, Dorado | the gold trim on any epic-look piece of any class (the class sheet's T4 look is gold trim) |
| Roe | epic | King Salmon, Sturgeon | a dish ingredient only (the tasting book's big dishes) |
| The epic parts | epic | one or two per subclass, below | the subclass's epic-look signature weapon |
| The legendary cores | legendary | the 4 legendaries, below | the family's legendary-look gear, with the gold aura |
| The Divine cores | Divine | the 2 Divines, below | a Divine piece, with the holographic aura |

**Class gear.** One row per subclass (`specs/classes/design-sheet.md`): its signature weapon and the fish parts that make its looks. The gear is the class's own weapon in a sea-made look (a "tide" set), at the same stats as the tier it stands for, because classes are flair, not mechanics (design principles, rule 4). Whether it replaces or sits beside the guardian's T4 and T5 drops is David's call (question 6).

| Family | Subclass | Signature weapon | Rare part | Epic part (fish) | Legendary core |
|---|---|---|---|---|---|
| Arcane (mage) | Elementalist | crystal staff | Crystal Carapace, Pearl | Storm Coil (Electric Eel), Frost Fin (Stringfish) | Imugi's Pearl |
| Arcane | Illusionist | enchanted cards | Nacre | Silver Scale (Arowana), Oar Ribbon (Oarfish) | Imugi's Pearl |
| Arcane | Necromancer | bone tome | Night Ink | Ancient Bone (Coelacanth, Sturgeon) | Imugi's Pearl |
| Arcane | Transmuter | monster-tooth charm | Fang | Great White Tooth (Great White Shark), Muskie Fang (Muskellunge) | Imugi's Pearl |
| Ranger (marksman) | Marksman | recurve bow | Ray Leather | Marlin Bill (Blue Marlin) | Megabyte Fang |
| Ranger | Sniper | scoped rifle | Pearl, Armour Scale | Barreleye Lens (Barreleye) | Megabyte Fang |
| Ranger | Hunter | harpoon crossbow | Fang | Saw Rostrum (Saw Shark) | Megabyte Fang |
| Ranger | Gunslinger | revolver | Pearl | Black Pearl (Black-lip Oyster) | Megabyte Fang |
| Vanguard (warrior) | Guardian | shield and sword | Turtle Shell | Arapaima Scale (Arapaima), Isopod Plate (Giant Isopod) | Kraken Beak |
| Vanguard | Juggernaut | war hammer | Armour Scale | Hammer Crest (Hammerhead Shark) | Kraken Beak |
| Vanguard | Martial Artist | hand wraps | Ray Leather | Whale Shark Hide (Whale Shark) | Kraken Beak |
| Vanguard | Assassin | tanto and kunai | Fang | Gar Fang (Gar) | Kraken Beak |
| Warden (healer) | Summoner | ink-black seal gloves | Night Ink | Abyss Ink (Giant Squid) | Ness Scale |
| Warden | Shaman | totem staff | Lantern Lure | Sail Fin (Sailfish), Whisker (Catfish) | Ness Scale |
| Warden | Druid | living staff | Axolotl Frill | Living Moss (Mossback Turtle) | Ness Scale |
| Warden | Priest | sunstone staff | Pearl | Sun Scale (Ocean Sunfish) | Ness Scale |

A look's recipe, as a shape: the epic look takes its epic part, a Golden Scale, two of its rare part and the commons (Fish Scale, Shell Grit, Fin) plus coins; the legendary look takes the family's legendary core on top. The Divine cores make one Divine piece each: Leviathan Heart for Vanguard or Ranger, Dragon King's Pearl for Arcane or Warden. Exact counts come with the recipes, after David's marks.

**The legendary rod.** Divine fish need a legendary rod (`hookCap`), and none exists. Proposed: it is the treasure list's Fallen Star rod (David: "fallen star should be core crafting material like fallen star rod"), crafted from a Fallen Star and one legendary core. That links the two lists: dig for the star, fish for the core, then fish for the Divine.

## 6. New fish

**Status:** *new* (a new roster row and model) or *moved* (an existing fish whose water changes). *Est. %* is the chance per cast while it's out, estimated by adding all the new fish to today's pools (starter rod, or the first rod that hooks it on a MAX cast). Coins come from `SELL_PRICES`.

| # | Fish | Water | Seasons | Hours, weather | Rarity | Coins | Est. % | Material | Fills | Model route (section 8) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Lake Whitefish | River | Wi | any | common | 8 | 25.5 | Fish Scale; dish: smoked whitefish | winter river by day | A: from the Dace |
| 2 | Burbot | River | Wi | 20-04 | uncommon | 20 | 10.7 | Fin; dish: stew | winter river uncommon | A: from the Loach |
| 3 | Brook Trout | River | Sp | 05-19 | uncommon | 20 | 8.4 | Fin | spring river | A: from the Rainbow Trout |
| 4 | Walleye | River | Au Wi | 17-21 (dusk) | rare | 60 | Cedar 8.3 | Fang | dusk, winter rare | A: from the Black Bass |
| 5 | Muskellunge | River | Au Wi | 06-18 | epic | 180 | Glass 2.6 | Muskie Fang (Transmuter) | winter river epic by day | A: from the Pike |
| 6 | Electric Eel | River | Su | 20-04, rain any hour | epic | 180 | Glass 2.8 | Storm Coil (Elementalist) | a storm fish | B |
| 7 | Pumpkinseed | Pond | Su Au | 06-18 | common | 8 | 20.2 | Fish Scale; G: Nell | pond autumn common | A: from the Bluegill |
| 8 | Mudminnow | Pond | Wi | any | common | 8 | 22.1 | Fish Scale | pond winter | A: from the Killifish |
| 9 | Axolotl | Pond | Sp Au | rain only | rare | 60 | Cedar 9.8 | Axolotl Frill (Druid); G: Juniper | pond rare by day, rain | B |
| 10 | Mossback Turtle | Pond | Sp Su | 04-08 (dawn) | epic | 180 | Glass 2.9 | Living Moss (Druid) | pond epic, dawn | A: from the Snapping Turtle |
| 11 | Sculpin | Cliff pool | all year | any | common | 8 | see note | Fish Scale | cliff common | A: from the Freshwater Goby |
| 12 | Blind Cavefish | Cliff pool | all year | 20-04 | uncommon | 20 | see note | Fin | cliff uncommon | A: from the Dace |
| 13 | Crystal Crayfish | Cliff pool | Wi | any | rare | 60 | see note | Crystal Carapace (Elementalist) | mage crystals | A: from the Crayfish |
| 14 | Herring | Sea | Wi Sp | 06-18 | common | 8 | 6.8 | Fish Scale; dish | sea winter | A: from the Horse Mackerel |
| 15 | Lumpfish | Sea | Wi | any | uncommon | 20 | 3.7 | Fin; G: Juniper | sea winter uncommon | B |
| 16 | Snowflake Eel | Sea | Wi | snow only | uncommon | 20 | 3.4 | Eel Skin | the first snow fish | A: from the Moray Eel |
| 17 | Black-lip Oyster | Sea | all year | 20-04 | epic | 180 | Glass 1.1 | Black Pearl (Gunslinger) | Gunslinger | A: from the Pearl Oyster |
| 18 | Sailfish | Sea | Au | 06-18 | epic | 180 | Glass 1.2 | Sail Fin (Shaman) | sea autumn epic by day | A: from the Blue Marlin |
| 19 | Lanternfish | Deep sea | all year | any | common | 8 | 38.1 | Fish Scale | deep sea common | B |
| 20 | Hatchetfish | Deep sea | all year | any | common | 8 | 38.1 | Fish Scale | deep sea common | B |
| 21 | Dumbo Octopus | Deep sea | all year | any | uncommon | 20 | 18.3 | Squid Ink; G: Marlo | deep sea uncommon | B |
| 22 | Gulper Eel | Deep sea | all year | 20-04 | uncommon | 20 | 16.2 | Eel Skin | deep sea night | B |
| 23 | Vampire Squid | Deep sea | all year | 20-04 | rare | 60 | Cedar 12.3 | Night Ink | Necromancer, Summoner | B |
| 24 | Giant Squid | Deep sea | Wi Sp | any | epic | 180 | Glass 5.3 | Abyss Ink (Summoner) | deep sea epic | B |
| 25 | Barreleye | Deep sea (from the sea) | all year | 20-04 | epic | 180 | Best 4.8 | Barreleye Lens | moved | exists |
| 26 | Football Fish | Deep sea (from the sea) | Wi | 20-04 | rare | 60 | Best 10.7 | Lantern Lure | moved | exists |
| 27 | Giant Isopod | Deep sea (from the sea) | all year | 20-04 | epic | 180 | Best 4.8 | Isopod Plate | moved | exists |
| 28 | Oarfish | Deep sea (from the sea) | Sp Wi | any | epic | 180 | Best 6.1 | Oar Ribbon | moved | exists |
| 29 | Tide-rusted Gear (salvage, not a fish) | any water | all year | any | uncommon | 20 | about a Fin's | a sudo part later (lore: tide-rusted gears are fishing's part family); one key shared with the treasure list's gear | lore | A: Blender alone |

The moved four stay in the sea until the deep sea opens, so no catch disappears in between.

**Cliff pools note.** As their own water, the 7 cliff fish would be far too easy (the Crystal Crayfish about 28% a cast, the Sculpin 89% with a starter rod), because the pool is small. Two ways: keep cliff pools as part of the river, as the code does today (and give the tasting book's page the river's rule), or give them their own water with lower weights. Question 3.

**Legendary and Divine** (all new; the catches behind the boss reel and the raid, `fishBosses`). They surface in the cutscene, fight, and on landing are let go and leave their core. They glow: legendary with a gold aura (an emissive rim, slow gold sparks, matching the golden "!"), Divine with the holographic shimmer (the `--gui-holo` look, matching the Divine "!"). Their cores glow the same way in the bag, in the museum and on the gear they make. Names come from David's own draft list where they fit; the tech skin is the lore's (the island's monsters are hardware from the buried vessel that the sea grew over).

| # | Creature | Water | When | Rarity | Core (family) | What it is | Glow |
|---|---|---|---|---|---|---|---|
| L1 | Imugi | River | Su, rain only, 20-04 | legendary | Imugi's Pearl (Arcane: Elementalist, Illusionist, Necromancer, Transmuter) | A river serpent with a pearl in its jaw, waiting a thousand years to become a dragon. Faint circuit-trace light runs down its scales. | gold aura |
| L2 | Megabyte | Sea (deep sea once it opens) | Su Au, 20-04 | legendary | Megabyte Fang (Ranger: Marksman, Sniper, Hunter, Gunslinger) | A megalodon plated in old hull steel, rivets for teeth. The name is the tech joke David asked for. | gold aura |
| L3 | Kraken | Deep sea (the sea's far edge until then) | Au Wi, rain only | legendary | Kraken Beak (Vanguard: Guardian, Juggernaut, Martial Artist, Assassin) | Arms of tangled fleet cable, a beak like an anchor's fluke. | gold aura |
| L4 | Ness | Pond (the mountain) | Wi Sp, 04-08 (dawn mist) | legendary | Ness Scale (Warden: Summoner, Shaman, Druid, Priest) | The mountain pond's shy giant: moss on its back, one lamp-like eye. Its fight is a long, patient one, not a violent one. | gold aura |
| D1 | Leviathan | Deep sea | all year, rain only, 22-02 | Divine | Leviathan Heart (one Divine piece, Vanguard or Ranger) | Bigger than the wharf, still humming like a machine nobody switched off. The raid boss. | holographic |
| D2 | Longwang, the Dragon King | The sea off the river mouth | Sp, rain only, 04-07 | Divine | Dragon King's Pearl (one Divine piece, Arcane or Warden) | What an Imugi becomes. The second raid. | holographic |

Sell: legendary 600, Divine 1500 (`SELL_PRICES`), for the core, since the creature itself is let go. David's other drafts (Umibozu, Charybdis and Scylla, Lyngbakr, the sea beasts) wait for a later round. "Sea Kings" and "Lord of the Coast" are a well-known manga's names, so those would want names of our own.

## 7. The odds for legendary and Divine, as proposed

Today's weights would make a legendary's chance depend on the water's size: one legendary at weight 2.5 with Tidewarden on a MAX cast would be about 1 in 74 casts in the pond, 1 in 98 in the river and 1 in 245 at sea. Too easy, and uneven. Proposed instead, as the treasure page did for digging:

- **Legendary: a fixed share, 1 in 600 casts,** with the Tidewarden (the first rod that hooks one) on a MAX cast, in its water, while its window holds. A plain cast halves it (1 in 1,200). Luck lifts it toward 1 in 300 at most (the legendary rod, the Lucky bobber, the feast, fishing together). The hourly cap stays (3 an hour).
- **Divine: 1 in 6,000 casts** with the legendary rod on a MAX cast, in its window, and at most one raid per room per day. It's a server fight, so it should feel like an event.
- **Everything below legendary keeps today's weights.** The new fish join their pools and take a little share from their neighbours, as the estimates above show.

## 8. Modelling

Meshy is paused (David, 2026-11-02, via the coordinator: "dont use meshy as for now, just try to replicant the same output through using blender and modeling it from the multi angle designs"). The route for every new fish:

1. **Concept views:** front, side and top, made with the ElevenLabs image tool from a text prompt or from David's reference.
2. **Headless Blender from those views** (`Blender -b --factory-startup -P`), matching our existing fish: the remodel's finish (`art/remodel/build_fish.py`: smooth shading, the palette grade, the counter-shade, the soft wet sheen), the game's frame (head up +y, back toward -z, game scale), 600 to 2,000 triangles, one material, one texture. Fish are one version today (the catch card, the tank and the hold all use it); new fish match.
3. `cd web && node scripts/pack-glbs.mjs`, then the icon render.

**Three routes:**

| Route | Which | How |
|---|---|---|
| A: from an existing fish | Lake Whitefish, Burbot, Brook Trout, Walleye, Muskellunge, Pumpkinseed, Mudminnow, Mossback Turtle, Sculpin, Blind Cavefish, Crystal Crayfish, Herring, Snowflake Eel, Black-lip Oyster, Sailfish, the Tide-rusted Gear (15 fish, 1 salvage) | concept views from a plain text prompt; the Blender script starts from the named fish's mesh and reshapes and repaints it (proportional moves, fins and heads remodelled, a new painted texture). Same family look for free. |
| B: new shapes | Electric Eel, Axolotl, Lumpfish, Lanternfish, Hatchetfish, Dumbo Octopus, Gulper Eel, Vampire Squid, Giant Squid (9) | concept views from a plain text prompt, then modelled in Blender from the views (blockout, joined, shaped). |
| C: David's references | Imugi, Megabyte, Kraken, Ness, Leviathan, Longwang (6 creatures) and their 6 cores | David supplies the references (or approves picks). Each creature needs a building-size fight model with its own budget row (one on screen, in the cutscene and the fight) and the aura material; each core is a high-def and low-poly item that glows. |

**Materials as items** (the 47 things in section 5): small held things, each a high-def close-up (bag, reward card, icon) and a low-poly copy. Blender alone from a plain text direction for the commons, uncommons and rares (a scale, a fin, an ink vial, a pearl, a fang, a shell piece); concept views from a text prompt for the epic parts. Only the 6 legendary and Divine cores need David's references.

**The aura material** is one shared pair, extending the look classes in `lib/game/modelMaterials.ts` (`lookClassFor`): *aura-gold* for legendary and *aura-holo* for Divine, so every legendary and Divine thing (creature, core, gear) glows the same way and shares a material.

**Image credits:** about 24 fish concept sheets plus the epic parts; logged per model like the Meshy log was. The coordinator OKs anything past 10 in a round.

## 9. Code and data each needs (later rounds, not now)

- Roster rows for the new fish (`REEL_FISH` style, appended so no position moves), reel entries in `fishing.ts` `FISH` with their move fields, a seed migration through `scripts/gen-seeds.mjs`.
- A `deep` water type (`WaterType` in `fishingSpots.ts`, `fishPoolFor`, the server roll) and the boat or spot that fishes it; the biome tag already names it.
- Snow (and fog) reaching the reel (`reelWeather` maps them to cloudy today) for the Snowflake Eel and the misty legendaries.
- *Let it go* on the catch card: a server path that records the material instead of the fish (the catch is the server's own roll, so the check is the same one keep and sell use). Material rows like `MATERIALS` in `recipes.ts`.
- The fixed share for legendary and Divine in `fishPoolFor` (a per-rarity share, not a weight), and the one-raid-a-day rule in the realtime room.
- Gift keys in `RESIDENT_GIFTS` (a key wins over the category).
- The tide set's recipes in `recipes.ts`, the legendary rod with the treasure lane's Fallen Star.

## 10. Open questions for David

1. **The list.** Which of the 24 new fish stay, go or get renamed? The 4 moved to the deep sea?
2. **Let it go.** Is releasing a fish for its material the way fish give materials? (The other way is cleaning it at Pim's bench, which uses up the fish and reads less cozy.)
3. **Cliff pools.** Part of the river (as the code does today) or a water of their own (then with lower weights)?
4. **Legendary and Divine.** Are these six the ones (Imugi, Megabyte, Kraken, Ness, Leviathan, Longwang)? One legendary per class family, one Divine per two families?
5. **Odds.** Legendary 1 in 600 with the Tidewarden, Divine 1 in 6,000 with the legendary rod and one raid a day: hard enough?
6. **Class gear.** Is the fish-made gear a look (same stats as its tier) or real stat gear beside the guardian's T4 and T5 drops?
7. **The legendary rod.** Is it the Fallen Star rod from the treasure list (a Fallen Star and a legendary core)?
8. **The starter rod and the MAX cast.** Should a MAX cast do something a new player can feel (a bigger fish, a bit more uncommon), since luck only touches rare and up?
9. **References.** For the 6 creatures and their cores: will you send references, or should the lane search headless and show you picks first? The rest go from plain text prompts.
10. **Gifts.** OK to name fish for residents (Sable loves the Coelacanth, Nell the Frog, Mayor Eliza the Golden Koi, and so on), even where they dislike fish in general?
