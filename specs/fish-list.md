# The fish list: what you can catch, and why

Lane `fish-list`, round 2 (2026-11-03). Still the list only: nothing is built or modelled. Round 1 (2026-11-02) listed today's 91 catches, 24 new fish and 6 creatures; David marked it on the review page. This round rewrites it to his marks.

## 0. David's marks

Round 2 review (2026-11-03, verbatim):

- Approved: fl-classparts, fl-models. fl-rods: "the mathing of it looks pretty good". fl-roster: "idk you figure it out it looks pretty good". fl-new: "fill it and fix it". fl-questions: "all rods will have slightly different stats even if both in uncommon". fl-creatures: "L2 should be megladon with electricty aura and tech stuff like a robot megladon".
- fl-today (redo): "i want like 10 common ish, 10 uncommon ish, 8 rare ish, 5 epic ish, 2 legendary so far for each biome, so brainstorm what should be added, this is roughly so could be more or less, like river and sea would have more fish obviously but also have more common and rare type, but deep sea and cliff pool will have higher epic leg ratio to common uncommon kinda thing.  also epic will have added like lil thing that you gotta do while you reel in. also the current reel in is laggy and not smooth and affecting user experience for fishing"
- fl-gaps (redo): "fill it and fix it"
- fl-materials (redo): "these drops are rarer for common fish and almost guarenteed for legendary or divine fish drops"
- fl-odds (redo): "make it hard, cuz there will be a lot of stuff giving luck boost like sushi and bobber so dont make it too easy"

His approved picks on round 1's questions (fl-questions) stand: letting a fish go is how it gives its material; cliff pools become their own water when the mountain opens (in the river until then); fish-made gear is a look at its tier's stats; the legendary rod is the Fallen Star rod; a MAX cast lands a slightly bigger fish; David sends references for the creatures and their cores, the rest go from text prompts; no named favourite fish for residents who dislike fish; the pond opens in the next fishing round.

The laggy reel is the `fishing-depth` lane's fix, in parallel. The epic tasks (section 5) are built on top of its smooth reel, after it lands.

**What changed from round 1:**
1. Every water now has about 10 common, 10 uncommon, 8 rare, 5 epic and 2 legendary (section 1): 70 more fish (62 fish and 8 creatures), river and sea biggest and heaviest on common and rare, cliff pools and the deep sea heaviest on epic and legendary. Every water has every rarity from common to epic in every season, by day and by night (checked by script).
2. Megabyte is a robot megalodon with an electric aura (section 4).
3. Every epic fish has a small task during its reel, from six shared kinds; legendaries chain two or three (section 5).
4. Materials drop by the fish's rarity: 15% from a common, 95% from a legendary, 98% from a Divine, never two misses in a row on a creature (section 6).
5. The odds are harder and no longer depend on how many fish a water has; luck boosts cap together, and the tables show each rod alone and with a full stack (section 7).
6. Every rod has its own stat profile, even within a rarity (section 8).
7. Fixes: the Electric Eel moves to the cliff pools; 7 sea epics move to the deep sea (they stay in the sea until it opens); named gifts only for residents who like fish or sea creatures (section 2).

## 1. Per biome: the counts and the new fish

Coins by rarity, unchanged (`SELL_PRICES`): common 8, uncommon 20, rare 60, epic 180, legendary 600, Divine 1500 (a creature is let go, so a legendary or Divine catch sells its core).

| Water | common | uncommon | rare | epic | legendary | Divine | All | Epic and up | New this round |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| River | 13 | 12 | 11 | 8 | 2 |  | 46 | 22% | 10 |
| Cliff pools | 6 | 6 | 6 | 6 | 2 |  | 26 | 31% | 18 |
| Pond | 10 | 10 | 8 | 5 | 2 |  | 35 | 20% | 17 |
| Sea | 16 | 16 | 11 | 7 | 2 | 1 | 53 | 19% | 10 |
| Deep sea | 6 | 6 | 6 | 8 | 4 | 1 | 31 | 42% | 15 |

River and sea are the biggest and lean on common and rare; the deep sea and the cliff pools carry the most epic and legendary for their size, and their odds lean that way too (section 7). The river keeps 8 epics because 7 bite there today; the sea's 16 uncommon are today's 14 plus round 1's two winter fish. The counts include the 3 tourney fish (Yellow Perch, Sturgeon, Giant Trevally), which bite only while a tourney is open.

**The new fish, by name:**

- **River.** New this round: common: Common Shiner, Brook Stickleback, White Sucker, Rock Bass; rare: Lake Trout, Brown Trout, Bowfin, American Eel, Paddlefish; legendary: Namazu. From round 1: common: Lake Whitefish; uncommon: Burbot, Brook Trout; rare: Walleye; epic: Muskellunge; legendary: Imugi.
- **Cliff pools.** New this round: common: Cave Shrimp, Fathead Minnow, Alpine Newt, Stone Loach, Pearl Dace; uncommon: Arctic Grayling, Cutthroat Trout, Freshwater Mussel, Glass Catfish, Kokanee; rare: Black Ghost Knifefish, Golden Mahseer, Geode Clam, Hillstream Loach; epic: Taimen, Olm; legendary: Raiju, Hanzaki. From round 1: common: Sculpin; uncommon: Blind Cavefish; rare: Crystal Crayfish. Moved in: Electric Eel.
- **Pond.** New this round: common: Weather Loach, Golden Shiner, Pond Snail; uncommon: Medaka, Paradise Fish, Black Crappie, Painted Turtle; rare: Butterfly Koi, Bullfrog, Brown Bullhead, Eastern Newt, Oranda Goldfish, Tench; epic: Platinum Koi, Tancho Koi, Giant Gourami; legendary: Dragon Gate Koi. From round 1: common: Pumpkinseed, Mudminnow; rare: Axolotl; epic: Mossback Turtle; legendary: Ness.
- **Sea.** New this round: common: Blue Mussel, Sardine, Sand Dollar; rare: Octopus, Spiny Lobster, Yellowtail, Cuttlefish, Halibut, Sea Urchin; legendary: Umibozu. From round 1: common: Herring; uncommon: Lumpfish, Snowflake Eel; epic: Black-lip Oyster, Sailfish; legendary: Megabyte; Divine: Longwang, the Dragon King.
- **Deep sea.** New this round: common: Bristlemouth, Hagfish, Glass Squid, Ruby Shrimp; uncommon: Sea Pig, Chimaera, Blobfish, Yeti Crab; rare: Fangtooth, Viperfish, Spider Crab, Dragonfish; legendary: Charybdis, Bakunawa, Lyngbakr. From round 1: common: Lanternfish, Hatchetfish; uncommon: Dumbo Octopus, Gulper Eel; rare: Vampire Squid; epic: Giant Squid; legendary: Kraken; Divine: Leviathan. Moved in: Football Fish, Barreleye, Giant Isopod, Oarfish, Coelacanth, Blue Marlin, Whale Shark, Saw Shark.

Plus the Tide-rusted Gear (round 1): salvage, not a fish, uncommon, in any water (a sudo part later; the lore's fishing part family).

**Gaps fixed** (round 1's list, then the ones the new counts would have opened):

| Where it was thin | Filled by |
|---|---|
| River in winter, by day: no uncommon or epic | Burbot (now any hour), Brook Trout (winter and spring), Lake Trout, Muskellunge (spring, autumn and winter) |
| River in spring, by day: no epic | Muskellunge now bites in spring too |
| River at dusk | Walleye (17 to 21) |
| River's rare band: 5 kinds | Lake Trout, Brown Trout, Bowfin, American Eel, Paddlefish (11 rare) |
| Pond: shut, 1 rare, no common in autumn | 17 new kinds, among them a koi set (Golden, Platinum, Tancho, then the Dragon Gate Koi); opens in the next fishing round (David's pick) |
| Cliff pools: 4 kinds, no common or uncommon | 6 of every band, all new except Char, Gar, Golden Trout and Stringfish; the hull breach is the excuse for the odd ones (crystal, electric, blind) |
| Sea: 12 epics, rare band thin | 7 epics move to the deep sea; 6 new rares (Octopus, Spiny Lobster, Yellowtail, Cuttlefish, Halibut, Sea Urchin) |
| Deep sea: nothing | 30 kinds and the Leviathan |
| Weather: snow and fog never mattered | Snowflake Eel (snow), Umibozu (cloud, fog or snow), Bakunawa and the Dragon Gate Koi (clear sky), Weather Loach (rain) |
| Legendary and Divine: none | 12 legendary (3 per class family) and 2 Divine |

**The check:** for every water, season, day (06 to 18) and night (18 to 06), at least one common, uncommon, rare and epic fish bites in fair weather. No gaps.

## 2. The rules every fish follows

1. **A reason beyond coins.** Every fish has the museum, the tasting book, HQ's tank and the fishing tasks; almost every one also leaves a crafting material when let go (section 6), and some are a dish, a recipe or a resident's favourite.
2. **Fits the island.** Ontario seasons; the river, the mountain pond, the cliff pools by the hull breach, the sea off the wharf, the deep sea past it. Legendary and Divine are the creatures of legend, with the tech skin the lore allows (feral hardware the sea grew over; nobody inside them). No real names; item text never explains the war or quotes the Founder.
3. **Uses what's there.** The one rarity ladder, the roster's seasons, hours and weather, `SELL_PRICES`, `RESIDENT_GIFTS` keys, rows in `recipes.ts`.
4. **Hard at the top** (section 7).
5. **Named gifts only where they fit** (David: no named favourites for residents who dislike fish). Fish: Juno and Bram love them, Toren and Odile like them; sea creatures: Odile, Bram, Pim and Juniper like them. Round 1's named gifts for Nell, Sable, Mayor Eliza and Marlo are gone (the Coelacanth goes to Juno, the Dumbo Octopus to Juniper).

## 3. The roster, water by water

**Columns.** *Hours* are island time (the Toronto hour), start to end, wrapping past midnight. *Status*: blank is today's fish, **new** is new this round, *new (r1)* came in round 1, *from the sea* moves to the deep sea when it opens (until then it stays in the sea). *Let it go*: the material it may leave (section 6). *Reel task*: epic fish only (section 5); legendaries list their boss reel. *First rod %*: the chance per cast while it's out, with the first rod that hooks it and nothing else (Flimsy for common and uncommon, Cedar for rare, Glass for epic, Tidewarden for legendary, Fallen Star for Divine), a plain cast, fair weather. *Full stack %*: with the Tidewarden (Fallen Star for Divine), the Lucky bobber, a MAX cast and every boost (section 7). Common and uncommon fish lose a little share under a full stack, because the rarer ones take more. Rain-only and snow-only fish are computed in their weather. Legendary and Divine are per cast while their window holds. Every number is computed by the lane's script from this list and the proposed odds, averaged over the fish's seasons and hours.

### River

| Fish | Rarity | Seasons | Hours, weather | Status | Let it go | Also | Reel task | First rod % | Full stack % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dace | common | all year | any hour |  | Fish Scale |  |  | 15.5 | 12.5 |
| Freshwater Goby | common | all year | 20-04 |  | Fish Scale |  |  | 17.8 | 14.4 |
| Guppy | common | Sp Su Au | 06-18 |  | Fish Scale | gift: Odile |  | 10.0 | 8.1 |
| Loach | common | Sp | any hour |  | Fish Scale |  |  | 11.8 | 9.5 |
| Neon Tetra | common | Sp Su Au | 06-18 |  | Fish Scale |  |  | 10.0 | 8.1 |
| Pale Chub | common | all year | 06-18 |  | Fish Scale |  |  | 10.9 | 8.8 |
| Pond Smelt | common | Wi | any hour |  | Fish Scale | dish: fried smelt |  | 16.5 | 13.3 |
| Yellow Perch | common | Au | any hour |  | Fish Scale | tourney only |  | 14.5 | 11.7 |
| Lake Whitefish | common | Wi | any hour | new (r1) | Fish Scale | dish: smoked whitefish |  | 16.5 | 13.3 |
| Common Shiner | common | all year | 06-18 | **new** | Fish Scale |  |  | 10.9 | 8.8 |
| Brook Stickleback | common | Sp Su | any hour | **new** | Fish Scale |  |  | 13.1 | 10.6 |
| White Sucker | common | Sp | any hour | **new** | Fish Scale | the spring run |  | 11.8 | 9.5 |
| Rock Bass | common | Su Au | any hour | **new** | Fish Scale |  |  | 16.8 | 13.6 |
| Angelfish | uncommon | Su Au | any hour |  | Fin |  |  | 5.1 | 4.1 |
| Betta | uncommon | Su Au | 06-18 |  | Fin | gift: Juniper |  | 4.5 | 3.7 |
| Doctor Fish | uncommon | Su | any hour |  | Fin |  |  | 5.7 | 4.6 |
| Mitten Crab | uncommon | Au | any hour |  | Crab Shell | dish: hotpot; gift: Pim |  | 4.5 | 3.6 |
| Rainbow Trout | uncommon | Sp Au | 05-19 |  | Fin |  |  | 7.2 | 5.8 |
| Salmon | uncommon | Au | any hour |  | Fin | dish: salmon nigiri (menu) |  | 4.5 | 3.6 |
| Soft-shelled Turtle | uncommon | Su Au | any hour |  | Crab Shell |  |  | 5.1 | 4.1 |
| Sweetfish | uncommon | Su | any hour |  | Fin | dish: salt-grilled |  | 5.7 | 4.6 |
| Tilapia | uncommon | Su Au | any hour |  | Fin |  |  | 5.1 | 4.1 |
| Yamame Trout | uncommon | Sp Au | any hour |  | Fin |  |  | 11.7 | 9.5 |
| Burbot | uncommon | Wi | any hour | new (r1) | Fin | dish: stew |  | 22.0 | 17.8 |
| Brook Trout | uncommon | Wi Sp | 05-19 | new (r1) | Fin |  |  | 13.0 | 10.5 |
| Bichir | rare | Su | 20-04 |  | Armour Scale |  |  | 2.1 | 4.0 |
| Black Bass | rare | all year | any hour |  | Fin x2 | recipe: Lighthouse rod |  | 3.1 | 5.9 |
| Pike | rare | Au | any hour |  | Fang |  |  | 2.8 | 5.1 |
| Piranha | rare | Su | 06-18 |  | Fang |  |  | 3.4 | 6.4 |
| Snakehead | rare | all year | 09-16 |  | Fang |  |  | 2.7 | 4.9 |
| Walleye | rare | Au Wi | 17-21 | new (r1) | Fang | gift: Toren |  | 2.5 | 5.0 |
| Lake Trout | rare | Wi Sp | any hour | **new** | Fin x2 |  |  | 2.9 | 5.7 |
| Brown Trout | rare | Sp Au | 18-06 | **new** | Fin x2 |  |  | 2.2 | 4.2 |
| Bowfin | rare | Su | 20-04 | **new** | Armour Scale |  |  | 2.1 | 4.0 |
| American Eel | rare | Su Au | 20-04, any hour in rain | **new** | Eel Skin x2 |  |  | 2.1 | 3.9 |
| Paddlefish | rare | Sp | any hour | **new** | Ray Leather |  |  | 2.3 | 4.4 |
| Arapaima | epic | Su | 16-09, any hour in rain |  | Arapaima Scale |  | Leap | 1.1 | 1.7 |
| Arowana | epic | Su | 20-04 |  | Silver Scale |  | Leap | 0.54 | 0.87 |
| Catfish | epic | all year | 20-04, any hour in rain |  | Whisker |  | Snag | 1.5 | 2.4 |
| Dorado | epic | Su | 06-18 |  | Golden Scale |  | Leap | 1.7 | 2.7 |
| Golden Arowana | epic | Su | 20-04 |  | Golden Scale |  | Snag | 0.54 | 0.87 |
| King Salmon | epic | Au | any hour |  | Roe | feast | Run | 1.3 | 2.0 |
| Sturgeon | epic | Au | any hour |  | Ancient Bone | Roe too; tourney only; gift: Juno | Run | 0.77 | 1.3 |
| Muskellunge | epic | Sp Au Wi | 06-18 | new (r1) | Muskie Fang |  | Snag | 1.8 | 2.9 |
| Imugi | legendary | Su | 20-04, rain only | new (r1) | Imugi's Pearl | Arcane core | Snag, Dark | 1 in 2,281 | 1 in 1,680 |
| Namazu | legendary | Wi Sp | 20-04 | **new** | Namazu Keystone | Vanguard core | Run, Pry | 1 in 2,281 | 1 in 1,680 |

### Cliff pools

Their own water when the mountain opens (David's pick); until then these fish bite in the river, as today's four do.

| Fish | Rarity | Seasons | Hours, weather | Status | Let it go | Also | Reel task | First rod % | Full stack % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sculpin | common | all year | any hour | new (r1) | Fish Scale |  |  | 16.5 | 10.9 |
| Cave Shrimp | common | all year | any hour | **new** | Shell Grit |  |  | 16.5 | 10.9 |
| Fathead Minnow | common | Sp Su Au | 06-18 | **new** | Fish Scale |  |  | 14.8 | 9.8 |
| Alpine Newt | common | Sp Su Au | any hour | **new** | Fish Scale |  |  | 15.6 | 10.3 |
| Stone Loach | common | all year | 20-04 | **new** | Fish Scale |  |  | 15.1 | 9.9 |
| Pearl Dace | common | Wi Sp | any hour | **new** | Fish Scale |  |  | 16.3 | 10.7 |
| Blind Cavefish | uncommon | all year | 20-04 | new (r1) | Fin |  |  | 10.7 | 7.0 |
| Arctic Grayling | uncommon | Su Au | 06-18 | **new** | Fin |  |  | 9.1 | 6.0 |
| Cutthroat Trout | uncommon | Sp Su | any hour | **new** | Fin |  |  | 13.0 | 8.5 |
| Freshwater Mussel | uncommon | all year | any hour | **new** | Shell Grit x2 |  |  | 13.0 | 8.5 |
| Glass Catfish | uncommon | Su Au | any hour | **new** | Fin |  |  | 9.7 | 6.4 |
| Kokanee | uncommon | Au Wi | any hour | **new** | Fin | dish: smoked kokanee |  | 13.0 | 8.5 |
| Char | rare | Sp Au | any hour |  | Armour Scale |  |  | 5.1 | 9.6 |
| Crystal Crayfish | rare | Wi | any hour | new (r1) | Crystal Carapace |  |  | 10.6 | 19.8 |
| Black Ghost Knifefish | rare | all year | 20-04 | **new** | Fin x2 |  |  | 4.8 | 8.9 |
| Golden Mahseer | rare | Su | any hour | **new** | Armour Scale |  |  | 4.6 | 9.6 |
| Geode Clam | rare | Sp Su Au | any hour | **new** | Crystal Carapace |  |  | 5.0 | 9.6 |
| Hillstream Loach | rare | Sp Su | 06-18 | **new** | Fin x2 |  |  | 4.3 | 8.9 |
| Gar | epic | Su | 16-09, any hour in rain |  | Gar Fang |  | Snag | 4.4 | 7.1 |
| Golden Trout | epic | Sp Au | any hour |  | Golden Scale | gift: Juno | Leap | 4.1 | 6.6 |
| Stringfish | epic | Wi | 21-04, any hour in rain |  | Frost Fin |  | Run | 2.1 | 3.5 |
| Electric Eel | epic | Su | 20-04, any hour in rain | new (r1), from the river | Storm Coil | moved from the river (round 1) | Spark | 2.1 | 3.5 |
| Taimen | epic | Wi Sp | any hour | **new** | Frost Fin |  | Run | 4.0 | 6.4 |
| Olm | epic | all year | 20-04 | **new** | Ancient Bone |  | Dark | 2.4 | 4.0 |
| Raiju | legendary | Su | any hour, rain only | **new** | Raiju Capacitor | Arcane core | Spark, Spark, Leap | 1 in 1,095 | 1 in 806 |
| Hanzaki | legendary | Au Wi | 20-04 | **new** | Hanzaki Hide | Vanguard core | Pry, Snag | 1 in 1,095 | 1 in 806 |

### Pond

Up the mountain; opens in the next fishing round (David's pick).

| Fish | Rarity | Seasons | Hours, weather | Status | Let it go | Also | Reel task | First rod % | Full stack % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bitterling | common | Wi | any hour |  | Fish Scale |  |  | 17.4 | 14.7 |
| Crayfish | common | Sp Su | any hour |  | Shell Grit |  |  | 11.3 | 9.5 |
| Frog | common | Su | any hour |  | none |  |  | 10.0 | 8.5 |
| Killifish | common | Sp Su | 06-20 |  | Fish Scale |  |  | 10.2 | 8.7 |
| Tadpole | common | Sp Su | any hour |  | none |  |  | 11.3 | 9.5 |
| Pumpkinseed | common | Su Au | 06-18 | new (r1) | Fish Scale |  |  | 13.0 | 11.0 |
| Mudminnow | common | Wi | any hour | new (r1) | Fish Scale |  |  | 17.4 | 14.7 |
| Weather Loach | common | all year | any hour, x3 in rain | **new** | Fish Scale | bites 3 times as often in rain |  | 15.1 | 12.7 |
| Golden Shiner | common | Sp Su Au | any hour | **new** | Fish Scale |  |  | 14.3 | 12.1 |
| Pond Snail | common | all year | any hour | **new** | Shell Grit |  |  | 15.1 | 12.7 |
| Bluegill | uncommon | all year | 09-16 |  | Fin |  |  | 4.0 | 3.4 |
| Carp | uncommon | all year | any hour |  | Fin |  |  | 4.9 | 4.2 |
| Crucian Carp | uncommon | all year | any hour |  | Fin |  |  | 4.9 | 4.2 |
| Goldfish | uncommon | all year | any hour |  | Fin |  |  | 4.9 | 4.2 |
| Pop-eyed Goldfish | uncommon | all year | any hour |  | Fin |  |  | 4.9 | 4.2 |
| Ranchu Goldfish | uncommon | all year | any hour |  | Fin |  |  | 4.9 | 4.2 |
| Medaka | uncommon | Sp Su | 06-18 | **new** | Fin |  |  | 4.0 | 3.4 |
| Paradise Fish | uncommon | Su Au | any hour | **new** | Fin |  |  | 4.5 | 3.8 |
| Black Crappie | uncommon | Sp Au Wi | 17-21 | **new** | Fin |  |  | 4.8 | 4.0 |
| Painted Turtle | uncommon | Sp Su Au | 09-16 | **new** | Crab Shell |  |  | 3.7 | 3.1 |
| Snapping Turtle | rare | Sp Su Au | 20-04 |  | Turtle Shell |  |  | 2.5 | 4.6 |
| Axolotl | rare | Sp Au | any hour, rain only | new (r1) | Axolotl Frill | gift: Juniper |  | 1.7 | 3.2 |
| Butterfly Koi | rare | all year | 06-18 | **new** | Fin x2 |  |  | 2.5 | 4.7 |
| Bullfrog | rare | Su | 20-04 | **new** | none |  |  | 1.7 | 3.2 |
| Brown Bullhead | rare | Su Au | 20-04 | **new** | Fin x2 |  |  | 2.0 | 3.7 |
| Eastern Newt | rare | Sp Su Au | 06-18, any hour in rain | **new** | Axolotl Frill |  |  | 2.2 | 4.1 |
| Oranda Goldfish | rare | all year | any hour | **new** | Fin x2 |  |  | 3.5 | 6.4 |
| Tench | rare | Su Au | 04-09 | **new** | Fin x2 |  |  | 2.4 | 4.5 |
| Golden Koi | epic | all year | any hour, x2 in rain |  | Golden Scale | recipe: Koi kimono | Leap | 0.88 | 1.4 |
| Mossback Turtle | epic | Sp Su | 04-08 | new (r1) | Living Moss |  | Pry | 0.60 | 0.97 |
| Platinum Koi | epic | Au Wi | 20-04 | **new** | Silver Scale |  | Dark | 0.67 | 1.1 |
| Tancho Koi | epic | Wi Sp | 06-18 | **new** | Sun Scale |  | Snag | 0.78 | 1.3 |
| Giant Gourami | epic | Su Au | any hour | **new** | Roe |  | Snag | 0.74 | 1.2 |
| Ness | legendary | Wi Sp | 04-08 | new (r1) | Ness Scale | Warden core | Run, Dark | 1 in 2,281 | 1 in 1,680 |
| Dragon Gate Koi | legendary | Sp Su | 10-16, clear sky only | **new** | Dragon Gate Scale | Warden core | Leap, Leap, Leap | 1 in 2,281 | 1 in 1,680 |

### Sea

| Fish | Rarity | Seasons | Hours, weather | Status | Let it go | Also | Reel task | First rod % | Full stack % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Acorn Barnacle | common | all year | any hour |  | Shell Grit |  |  | 6.0 | 4.8 |
| Anchovy | common | all year | 06-18 |  | Fish Scale |  |  | 5.5 | 4.5 |
| Clown Fish | common | Sp Su | any hour |  | Fish Scale | gift: Bram |  | 5.6 | 4.5 |
| Dab | common | Sp Au Wi | any hour |  | Fish Scale |  |  | 6.0 | 4.9 |
| Horse Mackerel | common | all year | any hour |  | Fish Scale |  |  | 6.0 | 4.8 |
| Scallop | common | all year | any hour |  | Shell Grit | dish: scallop |  | 6.0 | 4.8 |
| Sea Bass | common | all year | any hour |  | Fish Scale |  |  | 6.0 | 4.8 |
| Sea Butterfly | common | Wi | any hour |  | Shell Grit |  |  | 5.7 | 4.6 |
| Sea Star | common | all year | any hour |  | Shell Grit |  |  | 6.0 | 4.8 |
| Squid | common | Sp Su Wi | any hour |  | Squid Ink | dish: grilled squid |  | 5.6 | 4.5 |
| Surgeonfish | common | Sp Su | any hour |  | Fish Scale |  |  | 5.6 | 4.5 |
| Sweet Shrimp | common | all year | 16-09 |  | Shell Grit | dish: omakase |  | 6.1 | 4.9 |
| Herring | common | Wi Sp | 06-18 | new (r1) | Fish Scale | dish |  | 5.0 | 4.0 |
| Blue Mussel | common | all year | any hour | **new** | Shell Grit | dish: steamed mussels |  | 6.0 | 4.8 |
| Sardine | common | all year | 06-18 | **new** | Fish Scale |  |  | 5.5 | 4.5 |
| Sand Dollar | common | all year | any hour | **new** | Shell Grit |  |  | 6.0 | 4.8 |
| Barred Knifejaw | uncommon | Sp Su Au | any hour |  | Fin |  |  | 3.5 | 2.8 |
| Blowfish | uncommon | Wi | 20-04 |  | Spine |  |  | 5.3 | 4.3 |
| Butterfly Fish | uncommon | Sp Su | any hour |  | Fin |  |  | 3.4 | 2.8 |
| Dungeness Crab | uncommon | all year | any hour |  | Crab Shell |  |  | 4.2 | 3.4 |
| Firefly Squid | uncommon | all year | 21-04 |  | Glow Ink |  |  | 3.8 | 3.1 |
| Garden Eel | uncommon | all year | 06-18 |  | Eel Skin |  |  | 4.1 | 3.3 |
| Moray Eel | uncommon | Au | any hour |  | Eel Skin |  |  | 3.5 | 2.9 |
| Olive Flounder | uncommon | all year | any hour |  | Fin |  |  | 4.2 | 3.4 |
| Porcupine Fish | uncommon | Su | any hour |  | Spine |  |  | 2.9 | 2.3 |
| Red Snapper | uncommon | all year | any hour |  | Fin | dish: snapper chazuke |  | 4.2 | 3.4 |
| Ribbon Eel | uncommon | Su Au | any hour |  | Eel Skin |  |  | 3.2 | 2.6 |
| Seahorse | uncommon | Sp Su Au | any hour |  | Fin | gift: Odile |  | 3.5 | 2.8 |
| Suckerfish | uncommon | Su | any hour |  | Fin |  |  | 2.9 | 2.3 |
| Zebra Turkeyfish | uncommon | Sp Su Au | any hour |  | Spine |  |  | 3.5 | 2.8 |
| Lumpfish | uncommon | Wi | any hour | new (r1) | Fin | gift: Juniper |  | 6.2 | 5.0 |
| Snowflake Eel | uncommon | Wi | any hour, snow only | new (r1) | Eel Skin |  |  | 5.1 | 4.2 |
| Abalone | rare | all year | 16-09 |  | Nacre |  |  | 1.6 | 3.0 |
| Giant Trevally | rare | Au | any hour |  | Armour Scale | tourney only |  | 1.5 | 2.9 |
| Mahi-mahi | rare | Su | any hour |  | Fin x2 | dish: grilled mahi |  | 1.4 | 2.7 |
| Pearl Oyster | rare | all year | any hour |  | Pearl | recipe: Lighthouse rod |  | 1.7 | 3.3 |
| Ray | rare | Au | 06-18 |  | Ray Leather |  |  | 2.0 | 3.6 |
| Octopus | rare | all year | 20-04 | **new** | Squid Ink x2 |  |  | 1.3 | 2.4 |
| Spiny Lobster | rare | Au Wi Sp | 20-04 | **new** | Crab Shell x2 | gift: Bram |  | 1.4 | 2.5 |
| Yellowtail | rare | Wi Sp | any hour | **new** | Fin x2 | dish: yellowtail nigiri |  | 1.9 | 3.5 |
| Cuttlefish | rare | Sp Su | any hour | **new** | Nacre |  |  | 1.5 | 2.9 |
| Halibut | rare | Su Au | any hour | **new** | Fin x2 | dish |  | 1.6 | 3.1 |
| Sea Urchin | rare | all year | any hour | **new** | Spine x2 | dish: uni |  | 1.7 | 3.3 |
| Great White Shark | epic | Su | any hour |  | Great White Tooth |  | Run | 0.57 | 0.91 |
| Hammerhead Shark | epic | Su | any hour |  | Hammer Crest |  | Run | 0.57 | 0.91 |
| Napoleonfish | epic | Su | 06-18 |  | Roe | feast | Snag | 0.54 | 0.87 |
| Ocean Sunfish | epic | Su | any hour |  | Sun Scale |  | Leap | 0.57 | 0.91 |
| Tuna | epic | Sp Wi | any hour |  | Roe | dish: tuna roll (menu); recipe: Tidewarden rod; gift: Toren | Run | 1.8 | 2.9 |
| Black-lip Oyster | epic | all year | 20-04 | new (r1) | Black Pearl |  | Pry | 1.2 | 1.9 |
| Sailfish | epic | Au | 06-18 | new (r1) | Sail Fin |  | Leap | 2.1 | 3.5 |
| Megabyte | legendary | Su Au | 20-04, any hour in rain | new (r1) | Megabyte Fang | Ranger core | Spark, Run, Leap | 1 in 2,281 | 1 in 1,680 |
| Umibozu | legendary | Au Wi | 20-04, cloud, fog or snow only | **new** | Umibozu Lamp | Ranger core | Dark, Run | 1 in 2,281 | 1 in 1,680 |
| Longwang, the Dragon King | Divine | Sp | 04-07, rain only | new (r1) | Dragon King's Pearl | the river mouth; raid | raid | 1 in 18,868 | 1 in 15,974 |

### Deep sea

Opens with the boats (next launch, m7). The seven epics and the Football Fish marked *from the sea* stay in the sea until then.

| Fish | Rarity | Seasons | Hours, weather | Status | Let it go | Also | Reel task | First rod % | Full stack % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Lanternfish | common | all year | any hour | new (r1) | Fish Scale |  |  | 11.6 | 6.8 |
| Hatchetfish | common | all year | any hour | new (r1) | Fish Scale |  |  | 11.6 | 6.8 |
| Bristlemouth | common | all year | any hour | **new** | Fish Scale |  |  | 11.6 | 6.8 |
| Hagfish | common | all year | 20-04 | **new** | Eel Skin |  |  | 10.3 | 6.0 |
| Glass Squid | common | all year | any hour | **new** | Squid Ink |  |  | 11.6 | 6.8 |
| Ruby Shrimp | common | all year | any hour | **new** | Shell Grit |  |  | 11.6 | 6.8 |
| Dumbo Octopus | uncommon | all year | any hour | new (r1) | Squid Ink | gift: Juniper |  | 8.5 | 5.0 |
| Gulper Eel | uncommon | all year | 20-04 | new (r1) | Eel Skin |  |  | 6.4 | 3.8 |
| Sea Pig | uncommon | all year | any hour | **new** | Shell Grit x2 | gift: Pim |  | 8.5 | 5.0 |
| Chimaera | uncommon | all year | 20-04 | **new** | Spine |  |  | 6.4 | 3.8 |
| Blobfish | uncommon | all year | any hour | **new** | none | gift: Juniper |  | 8.5 | 5.0 |
| Yeti Crab | uncommon | all year | any hour | **new** | Crab Shell |  |  | 8.5 | 5.0 |
| Vampire Squid | rare | all year | 20-04 | new (r1) | Night Ink |  |  | 3.0 | 5.6 |
| Football Fish | rare | Wi | 20-04 | from the sea | Lantern Lure | recipe: Rune staff |  | 2.3 | 4.3 |
| Fangtooth | rare | all year | any hour | **new** | Fang |  |  | 4.8 | 9.0 |
| Viperfish | rare | all year | 20-04 | **new** | Fang |  |  | 3.0 | 5.6 |
| Spider Crab | rare | Wi Sp | any hour | **new** | Crab Shell x2 | gift: Pim |  | 3.9 | 7.3 |
| Dragonfish | rare | all year | any hour | **new** | Lantern Lure |  |  | 4.8 | 9.0 |
| Barreleye | epic | all year | 20-04 | from the sea | Barreleye Lens |  | Dark | 2.3 | 3.6 |
| Giant Isopod | epic | all year | 20-04 | from the sea | Isopod Plate | recipe: Tidewarden rod | Pry | 2.3 | 3.6 |
| Oarfish | epic | Sp Wi | any hour | from the sea | Oar Ribbon |  | Snag | 2.8 | 4.5 |
| Coelacanth | epic | all year | 20-04, rain only | from the sea | Ancient Bone | gift: Juno | Dark | 1.8 | 2.9 |
| Blue Marlin | epic | all year | any hour | from the sea | Marlin Bill | gift: Bram | Leap | 4.2 | 6.8 |
| Whale Shark | epic | Su | any hour | from the sea | Whale Shark Hide |  | Run | 3.9 | 6.2 |
| Saw Shark | epic | Su | 20-04 | from the sea | Saw Rostrum |  | Snag | 1.9 | 3.1 |
| Giant Squid | epic | Wi Sp | any hour | new (r1) | Abyss Ink |  | Dark | 2.8 | 4.5 |
| Kraken | legendary | Au Wi | any hour, rain only | new (r1) | Kraken Beak | Vanguard core | Snag, Snag, Dark | 1 in 912 | 1 in 672 |
| Charybdis | legendary | Sp Su | 16-20 | **new** | Charybdis Turbine | Ranger core | Run, Snag | 1 in 912 | 1 in 672 |
| Bakunawa | legendary | all year | 22-02, clear sky only | **new** | Bakunawa Moonscale | Arcane core | Leap, Dark | 1 in 912 | 1 in 672 |
| Lyngbakr | legendary | Sp Su | 06-12 | **new** | Lyngbakr Seed | Warden core | Run, Pry | 1 in 912 | 1 in 672 |
| Leviathan | Divine | all year | 22-02, rain only | new (r1) | Leviathan Heart | raid | raid | 1 in 18,868 | 1 in 15,974 |

## 4. Legendary and Divine

Twelve legendaries, two in every water and four in the deep sea, three per class family; two Divine. Each surfaces in the cutscene, fights (the boss reel, behind `NEXT_PUBLIC_FISH_BOSSES`), and on landing is let go and leaves its core (section 6). Legendaries glow with the shared gold aura (an emissive rim, slow gold sparks, matching the golden "!"); Divine with the holographic shimmer (the `--gui-holo` look). Their cores glow the same way in the bag, in the museum and on the gear they make.

| # | Creature | Water | When | Core (family) | What it is |
|---|---|---|---|---|---|
| L1 | Imugi | River | Su, 20 to 04, rain only | Imugi's Pearl (Arcane) | A river serpent with a pearl in its jaw, waiting a thousand years to become a dragon. Faint circuit-trace light runs down its scales. (round 1) |
| L2 | Namazu | River | Wi Sp, 20 to 04 | Namazu Keystone (Vanguard) | A catfish as long as the bridge with a mossy keystone pinned to its head. Its whiskers are seismograph needles; the riverbed hums when it turns. |
| L3 | Megabyte | Sea | Su Au, 20 to 04, any hour in a storm | Megabyte Fang (Ranger) | The robot megalodon, below. |
| L4 | Umibozu | Sea | Au Wi, 20 to 04, cloud, fog or snow only | Umibozu Lamp (Ranger) | A smooth black dome rises out of a still night sea and two lamp eyes open: the conning tower of something huge, barnacled and silent. |
| L5 | Ness | Pond | Wi Sp, 04 to 08 (dawn mist) | Ness Scale (Warden) | The mountain pond's shy giant: moss on its back, one lamp-like eye. A long, patient fight, not a violent one. (round 1) |
| L6 | Dragon Gate Koi | Pond | Sp Su, 10 to 16, clear sky only | Dragon Gate Scale (Warden) | A koi as long as a rowboat that leaps the mountain falls, its scales brushed-gold plates with fine seams. The top of the pond's koi set. |
| L7 | Raiju | Cliff pools | Su, any hour, rain only | Raiju Capacitor (Arcane) | The thunder beast of the storm pools: an eel-long body of copper coil and fine filaments, living on the power that leaks from the hull breach. |
| L8 | Hanzaki | Cliff pools | Au Wi, 20 to 04 | Hanzaki Hide (Vanguard) | A giant salamander older than the Keepers, its hide like rubbered hull lining, a cell glowing faintly in its belly. |
| L9 | Kraken | Deep sea (the sea's far edge until it opens) | Au Wi, any hour, rain only | Kraken Beak (Vanguard) | Arms of tangled fleet cable, a beak like an anchor's fluke. (round 1) |
| L10 | Charybdis | Deep sea | Sp Su, 16 to 20 | Charybdis Turbine (Ranger) | A whirlpool with a throat: a scuttled intake turbine on the bottom, still turning, and the sea grew a mouth around it. It doesn't swim; it pulls. |
| L11 | Bakunawa | Deep sea | all year, 22 to 02, clear sky only | Bakunawa Moonscale (Arcane) | The moon-eating sea serpent: silver plate scales like dish antennas, rising when the moon is up. |
| L12 | Lyngbakr | Deep sea | Sp Su, 06 to 12 | Lyngbakr Seed (Warden) | A whale so big a garden grows on its back and sailors take it for an island; it rhymes with the island itself. A long, gentle fight. |
| D1 | Leviathan | Deep sea | all year, 22 to 02, rain only | Leviathan Heart (one Divine piece, Vanguard or Ranger) | Bigger than the wharf, still humming like a machine nobody switched off. The raid boss. (round 1) |
| D2 | Longwang, the Dragon King | The sea off the river mouth | Sp, 04 to 07, rain only | Dragon King's Pearl (one Divine piece, Arcane or Warden) | What an Imugi becomes. The second raid. (round 1) |

Until the deep sea opens, the Kraken waits at the sea's far edge (round 1); Charybdis, Bakunawa, Lyngbakr and the Leviathan wait for the deep sea. Every family has a legendary before then except Warden, whose two are in the pond, which opens next fishing round. Names are myth names (Imugi, Namazu, Umibozu, Raiju, Hanzaki, Kraken, Charybdis, Bakunawa, Lyngbakr, Leviathan, Longwang) or ours (Megabyte, Ness, Dragon Gate Koi).

**Megabyte, the robot megalodon** (David: "L2 should be megladon with electricty aura and tech stuff like a robot megladon"):
- **Body:** a megalodon's shape, three times a great white, plated in riveted hull steel; the seams between plates glow electric blue.
- **Head:** a sonar dome on the snout with a sweeping scan light; its eyes are two lens rings that focus.
- **Jaw:** hinged on visible pistons, rows of steel blade teeth set like rivets.
- **Gills:** five cooling vents a side that spark as it breathes.
- **Dorsal fin:** an antenna mast with a blinking tip, the first thing you see cutting the water.
- **Tail:** an exposed cable spine running into a ribbed fluke.
- **Electric aura:** blue-white arcs crawl over the plates and jump to the water, and the sea around it fizzes. It sits over the shared gold rim, so Megabyte still reads legendary at a glance.
- **When:** summer and autumn nights, and any hour in a storm (it rides the lightning).
- **Its boss reel:** Spark, Run, Leap (section 5).
- **Core:** the Megabyte Fang, a serrated steel tooth with a chip at its root, crackling faintly. Ranger gear made with it (bow, rifle, crossbow, revolver) carries the crackle.
- **Model:** route C, from David's references (section 9).

## 5. Epic reel tasks

David: "epic will have added like lil thing that you gotta do while you reel in". Six shared kinds, each epic fish has one. Common to rare keep today's reel.

| Task | What happens | What you do (desktop; phone) | Rod stat that helps |
|---|---|---|---|
| **Leap** | The fish jumps clear of the water; a ring closes on it at the top of the arc | Press space or click as the ring closes; tap | Control widens the timing window (300 ms, plus 20 ms per 10 Control over 10) |
| **Run** | It bolts and the line glows red | Let go of the reel until the glow fades (about 1 s), then reel again; lift your thumb | Strength shortens the glow |
| **Snag** | It heads for roots, rock or coral; an arrow shows which way | Steer the other way with A or D (or the arrows); swipe | Control widens the window |
| **Pry** | It clamps shut or digs into the bottom | 6 quick presses in 2 s; 6 quick taps | Reel: one tap fewer per 20 Reel over 40 |
| **Dark** | It inks or slips into the dark: the catch bar fades out for 2 s | Keep the fish in the bar by its faint shadow and the line's tug | Control (a wider bar is easier blind) |
| **Spark** | It shocks the line: three quick flashes | Stop reeling on each flash, reel between them | Strength shortens each flash |

**Rules:**
1. One task per epic reel, at a random point between 35% and 75% of the catch meter. The four giants (Whale Shark, Great White Shark, Blue Marlin, Oarfish) get two.
2. A short cue first: an icon over the bobber and a sound, 0.4 s ahead (plus 25 ms per 10 Bite window over 10), so the task is never a surprise.
3. **Hit:** +10% on the catch meter and a small "nice" pip. **Miss:** -15%. A miss never loses the fish by itself; only an empty meter does, as today. Strength softens a miss (-1% per 10 Strength over 10, to -10% at most).
4. **Clean catch:** every task hit stamps the catch card and adds 10 points to its material drop if you let it go (section 6).
5. One input each: a tap, a lift or a swipe, so every task works on a phone (design principle 5).
6. **Legendaries** chain their tasks in order through the boss reel (the table below); the Divine raids have their own fight.
7. Built after the `fishing-depth` lane's smooth reel lands, on the reel's own frame loop, so the tasks add no lag.

**Which epic does which:**

| Task | Epic fish (water) | Count |
| --- | --- | --- |
| Leap | Arapaima (river), Arowana (river), Dorado (river), Golden Trout (cliff), Golden Koi (pond), Ocean Sunfish (sea), Sailfish (sea), Blue Marlin (deep) | 8 |
| Run | King Salmon (river), Sturgeon (river), Stringfish (cliff), Taimen (cliff), Great White Shark (sea), Hammerhead Shark (sea), Tuna (sea), Whale Shark (deep) | 8 |
| Snag | Catfish (river), Golden Arowana (river), Muskellunge (river), Gar (cliff), Tancho Koi (pond), Giant Gourami (pond), Napoleonfish (sea), Oarfish (deep), Saw Shark (deep) | 9 |
| Pry | Mossback Turtle (pond), Black-lip Oyster (sea), Giant Isopod (deep) | 3 |
| Dark | Olm (cliff), Platinum Koi (pond), Barreleye (deep), Coelacanth (deep), Giant Squid (deep) | 5 |
| Spark | Electric Eel (cliff) | 1 |

**The legendaries' boss reels:**

| Creature | Water | Its boss reel, in order |
| --- | --- | --- |
| Imugi | River | Snag, Dark |
| Namazu | River | Run, Pry |
| Raiju | Cliff pools | Spark, Spark, Leap |
| Hanzaki | Cliff pools | Pry, Snag |
| Ness | Pond | Run, Dark |
| Dragon Gate Koi | Pond | Leap, Leap, Leap |
| Megabyte | Sea | Spark, Run, Leap |
| Umibozu | Sea | Dark, Run |
| Kraken | Deep sea | Snag, Snag, Dark |
| Charybdis | Deep sea | Run, Snag |
| Bakunawa | Deep sea | Leap, Dark |
| Lyngbakr | Deep sea | Run, Pry |

## 6. Crafting materials: what fish give

**How:** the catch card's third choice, *Let it go* (David approved): the fish swims off and may leave its material behind (a shed scale, a fin, a squirt of ink, a tooth). The first catch of a species still goes to the book and the museum as today. A legendary or Divine catch is always let go (it's the size of a building) and rolls for its core.

**The drop, by the fish's rarity** (David: "these drops are rarer for common fish and almost guarenteed for legendary or divine fish drops"):

| Fish rarity | Drop when you let it go | Amount | Releases per drop, on average |
|---|---|---|---|
| common | 15% | 1 | about 7 |
| uncommon | 30% | 1 | about 3 |
| rare | 50% | 1, or 2 where the roster says x2 | 2 |
| epic | 75% (85% on a clean catch) | 1 | 1.3 (1.2) |
| legendary | 95%, and never two misses in a row on the same creature | its core | about 1.05 |
| Divine | 98%, the same rule; everyone in the raid rolls for their own | its core | about 1.02 |

Luck doesn't touch the drop (luck is for rarity), so the drop is the same for every player.

**The materials** (sources come straight from the roster):

| Material | Rarity | From (let it go) | Used for |
| --- | --- | --- | --- |
| Fish Scale | common | Dace, Freshwater Goby, Guppy, Loach, Neon Tetra, Pale Chub, Pond Smelt, Yellow Perch, Lake Whitefish, Common Shiner, Brook Stickleback, White Sucker, Rock Bass, Sculpin, Fathead Minnow, Alpine Newt, Stone Loach, Pearl Dace, Bitterling, Killifish, Pumpkinseed, Mudminnow, Weather Loach, Golden Shiner, Anchovy, Clown Fish, Dab, Horse Mackerel, Sea Bass, Surgeonfish, Herring, Sardine, Lanternfish, Hatchetfish, Bristlemouth | rod grips, every Guardian shield's facing, fishing outfit trims |
| Shell Grit | common | Cave Shrimp, Freshwater Mussel (x2), Crayfish, Pond Snail, Acorn Barnacle, Scallop, Sea Butterfly, Sea Star, Sweet Shrimp, Blue Mussel, Sand Dollar, Ruby Shrimp, Sea Pig (x2) | the polish in every crafted rod; shell housings for sudos later (lore: beachcombing) |
| Squid Ink | common | Squid, Octopus (x2), Glass Squid, Dumbo Octopus | Summoner seals, Illusionist cards, Necromancer pages |
| Fin | uncommon | Angelfish, Betta, Doctor Fish, Rainbow Trout, Salmon, Sweetfish, Tilapia, Yamame Trout, Burbot, Brook Trout, Black Bass (x2), Lake Trout (x2), Brown Trout (x2), Blind Cavefish, Arctic Grayling, Cutthroat Trout, Glass Catfish, Kokanee, Black Ghost Knifefish (x2), Hillstream Loach (x2), Bluegill, Carp, Crucian Carp, Goldfish, Pop-eyed Goldfish, Ranchu Goldfish, Medaka, Paradise Fish, Black Crappie, Butterfly Koi (x2), Brown Bullhead (x2), Oranda Goldfish (x2), Tench (x2), Barred Knifejaw, Butterfly Fish, Olive Flounder, Red Snapper, Seahorse, Suckerfish, Lumpfish, Mahi-mahi (x2), Yellowtail (x2), Halibut (x2) | Marksman fletching, Hunter bolt vanes, Shaman totem feathers |
| Crab Shell | uncommon | Mitten Crab, Soft-shelled Turtle, Painted Turtle, Dungeness Crab, Spiny Lobster (x2), Yeti Crab, Spider Crab (x2) | Juggernaut and Guardian plating |
| Spine | uncommon | Blowfish, Porcupine Fish, Zebra Turkeyfish, Sea Urchin (x2), Chimaera | Assassin kunai, Hunter barbs |
| Eel Skin | uncommon | American Eel (x2), Garden Eel, Moray Eel, Ribbon Eel, Snowflake Eel, Hagfish, Gulper Eel | Martial Artist wraps, bow and holster leather |
| Glow Ink | uncommon | Firefly Squid | Illusionist and Summoner glow |
| Pearl | rare | Pearl Oyster | Gunslinger grips, Priest and Sniper settings, Elementalist staff tips |
| Nacre | rare | Abalone, Cuttlefish | Illusionist card faces, staff inlays |
| Fang | rare | Pike, Piranha, Snakehead, Walleye, Fangtooth, Viperfish | Transmuter charms, Assassin and Hunter edges |
| Armour Scale | rare | Bichir, Bowfin, Char, Golden Mahseer, Giant Trevally | Juggernaut, Sniper stock |
| Ray Leather | rare | Paddlefish, Ray | Martial Artist wraps, Marksman grip |
| Turtle Shell | rare | Snapping Turtle | Guardian shield |
| Lantern Lure | rare | Football Fish, Dragonfish | Shaman totem light, the Rune staff |
| Night Ink | rare | Vampire Squid | Necromancer and Summoner |
| Axolotl Frill | rare | Axolotl, Eastern Newt | Druid |
| Crystal Carapace | rare | Crystal Crayfish, Geode Clam | Elementalist staffs |
| Golden Scale | epic | Dorado, Golden Arowana, Golden Trout, Golden Koi | the gold trim on any epic-look piece of any class |
| Roe | epic | King Salmon, Sturgeon, Giant Gourami, Napoleonfish, Tuna | a dish ingredient only (the tasting book's big dishes) |

**The epic parts** (one or more per subclass; the subclass's epic-look signature weapon):

| Epic part | Subclass | From |
| --- | --- | --- |
| Gar Fang | Assassin | Gar |
| Living Moss | Druid | Mossback Turtle |
| Frost Fin | Elementalist | Stringfish, Taimen |
| Storm Coil | Elementalist | Electric Eel |
| Arapaima Scale | Guardian | Arapaima |
| Isopod Plate | Guardian | Giant Isopod |
| Black Pearl | Gunslinger | Black-lip Oyster |
| Saw Rostrum | Hunter | Saw Shark |
| Silver Scale | Illusionist | Arowana, Platinum Koi |
| Oar Ribbon | Illusionist | Oarfish |
| Hammer Crest | Juggernaut | Hammerhead Shark |
| Marlin Bill | Marksman | Blue Marlin |
| Whale Shark Hide | Martial Artist | Whale Shark |
| Ancient Bone | Necromancer | Sturgeon, Olm, Coelacanth |
| Sun Scale | Priest | Tancho Koi, Ocean Sunfish |
| Whisker | Shaman | Catfish |
| Sail Fin | Shaman | Sailfish |
| Barreleye Lens | Sniper | Barreleye |
| Abyss Ink | Summoner | Giant Squid |
| Muskie Fang | Transmuter | Muskellunge |
| Great White Tooth | Transmuter | Great White Shark |

**The cores.** Each legendary leaves its own core; any one of a family's three makes that family's legendary-look gear, and the core you use sets the piece's trim (a Megabyte-made bow crackles blue; an Umibozu one has lamp-glass).

| Family | Subclasses | Legendary cores (water) |
|---|---|---|
| Arcane (mage) | Elementalist, Illusionist, Necromancer, Transmuter | Imugi's Pearl (river), Raiju Capacitor (cliff pools), Bakunawa Moonscale (deep sea) |
| Ranger (marksman) | Marksman, Sniper, Hunter, Gunslinger | Megabyte Fang (sea), Umibozu Lamp (sea), Charybdis Turbine (deep sea) |
| Vanguard (warrior) | Guardian, Juggernaut, Martial Artist, Assassin | Namazu Keystone (river), Hanzaki Hide (cliff pools), Kraken Beak (deep sea) |
| Warden (healer) | Summoner, Shaman, Druid, Priest | Ness Scale (pond), Dragon Gate Scale (pond), Lyngbakr Seed (deep sea) |

Divine: the Leviathan Heart makes one Divine piece for Vanguard or Ranger, the Dragon King's Pearl one for Arcane or Warden.

**Class gear** (fl-classparts, approved): every subclass's signature weapon in a sea-made look, at its tier's stats (a look, David's pick). The epic look takes its epic part, a Golden Scale, two of its rare part and the commons plus coins; the legendary look adds one of its family's cores. Exact counts come with the recipes. The legendary rod is the Fallen Star rod (David's pick): a Fallen Star from the treasure list and any one legendary core.

## 7. The odds

David: "make it hard, cuz there will be a lot of stuff giving luck boost like sushi and bobber so dont make it too easy".

**How a cast rolls (proposed):**
1. **Who's out:** as today (season, hour, weather, the tourney window).
2. **The rarity first,** from the water's bands below, not from how many kinds bite. Adding fish to a water never makes rare or epic more common; it only spreads the band over more kinds. (Today's weights made the odds depend on a water's size: the pond's one epic bit as often as the sea's twelve together.)
3. **The rod's cap** (`hookCap`, unchanged): bands above what the rod hooks give their share to common and uncommon.
4. **Luck lifts rare and up only, less at the top:** rare x(1 + 0.8 L), epic x(1 + 0.6 L), legendary x(1 + 0.4 L), Divine x(1 + 0.2 L), where L is the total luck. Common and uncommon take what's left, in their usual ratio.
5. **Then the kind:** the fish out in that band share it equally (the Golden Koi counts x2 in rain, the Weather Loach x3). If none of that band is out, the roll drops a rung.
6. **Legendary and Divine:** a fixed share per cast while the creature's window holds, lifted by luck as above. The hourly cap stays (3 an hour); a Divine raid at most once a day per room.

**The bands** (per cast, a rod that hooks it, no luck):

| Water | common | uncommon | rare | epic | legendary, in its window | Divine, in its window |
|---|---|---|---|---|---|---|
| River | 62% | 28% | 8% | 2% | 1 in 2,500 | none |
| Sea | 62% | 28% | 8% | 2% | 1 in 2,500 | 1 in 20,000 (Longwang) |
| Pond | 64% | 28% | 6.5% | 1.5% | 1 in 2,500 | none |
| Cliff pools | 52% | 30% | 12% | 6% | 1 in 1,200 | none |
| Deep sea | 48% | 30% | 13% | 9% | 1 in 1,000 | 1 in 20,000 (Leviathan) |

**Luck, and the full stack:**

| Source | Today | Proposed | Group |
|---|---|---|---|
| Cast power | 0 to 1.0 | 0 to 0.15 | the cast |
| MAX cast | +0.30 | +0.15 (and a slightly bigger fish, David's pick) | the cast |
| The rod's Luck stat | 0.04 per 10 over 10 | unchanged; every rod differs (section 8) | the rig |
| Lucky bobber | +20 Luck (+0.08) | unchanged | the rig |
| The tasting book | up to +0.40 (60 species) | unchanged | boosts |
| A meal or a book dish | +0.05 to +0.35 | unchanged | boosts |
| Rain | +0.10 | unchanged | boosts |
| Fishing together | +0.10 | unchanged | boosts |
| **Boosts together** | no cap | **capped at 0.60** | |

The cast and the rig stay outside the cap, so a better rod and a good cast always count; the boosts cap together, so the sushi, the book, the weather, friends and whatever comes later can't stack past 0.60. **Full stack:** a MAX cast at full power (0.30), the rod with the Lucky bobber, and boosts at the cap (the full book and the best meal already pass it). That's L = 1.22 with the Tidewarden. **Rod alone:** the rod's own Luck, a plain cast, nothing else.

Cutting the cast's share from 1.3 to 0.3 fixes round 1's finding that the cast dwarfed the rod; the MAX cast's feel moves to the bigger fish.

**The river, every rod:**

| Water | Rod | Setup | Luck (L) | common % | uncommon % | rare % | epic % | legendary, in its window | Divine, in its window |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| River | Flimsy rod | rod alone | 0.00 | 68.9 | 31.1 | 0.0 | 0.0 | no | no |
| River | Flimsy rod | full stack | 0.98 | 68.9 | 31.1 | 0.0 | 0.0 | no | no |
| River | Cedar rod | rod alone | 0.08 | 63.0 | 28.5 | 8.5 | 0.0 | no | no |
| River | Cedar rod | full stack | 1.06 | 58.7 | 26.5 | 14.8 | 0.0 | no | no |
| River | Glass rod | rod alone | 0.12 | 61.4 | 27.7 | 8.9 | 2.0 | no | no |
| River | Glass rod | full stack | 1.10 | 56.2 | 25.4 | 15.3 | 3.0 | no | no |
| River | Lighthouse rod | rod alone | 0.16 | 61.2 | 27.6 | 9.2 | 2.0 | no | no |
| River | Lighthouse rod | full stack | 1.14 | 56.0 | 25.3 | 15.6 | 3.1 | no | no |
| River | Tidewarden rod | rod alone | 0.24 | 60.7 | 27.4 | 9.7 | 2.1 | 1 in 2,281 | no |
| River | Tidewarden rod | full stack | 1.22 | 55.6 | 25.1 | 16.1 | 3.2 | 1 in 1,680 | no |
| River | Fallen Star rod | rod alone | 0.30 | 60.4 | 27.3 | 10.1 | 2.2 | 1 in 2,232 | none here |
| River | Fallen Star rod | full stack | 1.26 | 55.4 | 25.0 | 16.4 | 3.2 | 1 in 1,662 | none here |

**The other waters, from the first epic rod up:**

| Water | Rod | Setup | Luck (L) | common % | uncommon % | rare % | epic % | legendary, in its window | Divine, in its window |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cliff pools | Glass rod | rod alone | 0.12 | 51.0 | 29.4 | 13.6 | 6.0 | no | no |
| Cliff pools | Glass rod | full stack | 1.10 | 42.8 | 24.7 | 23.3 | 9.2 | no | no |
| Cliff pools | Tidewarden rod | rod alone | 0.24 | 50.0 | 28.8 | 14.8 | 6.4 | 1 in 1,095 | no |
| Cliff pools | Tidewarden rod | full stack | 1.22 | 41.8 | 24.1 | 24.5 | 9.6 | 1 in 806 | no |
| Cliff pools | Fallen Star rod | rod alone | 0.30 | 49.5 | 28.6 | 15.4 | 6.6 | 1 in 1,071 | none here |
| Cliff pools | Fallen Star rod | full stack | 1.26 | 41.5 | 23.9 | 24.9 | 9.8 | 1 in 798 | none here |
| Pond | Glass rod | rod alone | 0.12 | 63.5 | 27.8 | 7.1 | 1.6 | no | no |
| Pond | Glass rod | full stack | 1.10 | 59.3 | 26.0 | 12.2 | 2.5 | no | no |
| Pond | Tidewarden rod | rod alone | 0.24 | 63.0 | 27.6 | 7.7 | 1.7 | 1 in 2,281 | no |
| Pond | Tidewarden rod | full stack | 1.22 | 58.8 | 25.7 | 12.8 | 2.6 | 1 in 1,680 | no |
| Pond | Fallen Star rod | rod alone | 0.30 | 62.7 | 27.4 | 8.1 | 1.8 | 1 in 2,232 | none here |
| Pond | Fallen Star rod | full stack | 1.26 | 58.7 | 25.7 | 13.1 | 2.6 | 1 in 1,662 | none here |
| Sea | Glass rod | rod alone | 0.12 | 61.4 | 27.7 | 8.9 | 2.1 | no | no |
| Sea | Glass rod | full stack | 1.10 | 56.2 | 25.4 | 15.2 | 3.2 | no | no |
| Sea | Tidewarden rod | rod alone | 0.24 | 60.7 | 27.4 | 9.6 | 2.2 | 1 in 2,281 | no |
| Sea | Tidewarden rod | full stack | 1.22 | 55.6 | 25.1 | 16.0 | 3.3 | 1 in 1,680 | no |
| Sea | Fallen Star rod | rod alone | 0.30 | 60.4 | 27.3 | 10.0 | 2.3 | 1 in 2,232 | 1 in 18,868 |
| Sea | Fallen Star rod | full stack | 1.26 | 55.4 | 25.0 | 16.2 | 3.4 | 1 in 1,662 | 1 in 15,974 |
| Deep sea | Glass rod | rod alone | 0.12 | 46.8 | 29.3 | 14.2 | 9.6 | no | no |
| Deep sea | Glass rod | full stack | 1.10 | 37.3 | 23.3 | 24.4 | 14.9 | no | no |
| Deep sea | Tidewarden rod | rod alone | 0.24 | 45.7 | 28.5 | 15.5 | 10.3 | 1 in 912 | no |
| Deep sea | Tidewarden rod | full stack | 1.22 | 36.1 | 22.6 | 25.7 | 15.6 | 1 in 672 | no |
| Deep sea | Fallen Star rod | rod alone | 0.30 | 45.1 | 28.2 | 16.1 | 10.6 | 1 in 893 | 1 in 18,868 |
| Deep sea | Fallen Star rod | full stack | 1.26 | 35.7 | 22.3 | 26.1 | 15.8 | 1 in 665 | 1 in 15,974 |

**Today, for comparison** (today's weights and roster, the same seasons and hours):

| Water | Today's gear and cast | Luck | common % | uncommon % | rare % | epic % |
| --- | --- | --- | --- | --- | --- | --- |
| River | Glass, MAX cast | 1.42 | 54.5 | 24.1 | 16.3 | 5.1 |
| River | Tidewarden + Lucky bobber, MAX cast | 1.62 | 53.6 | 23.6 | 17.4 | 5.4 |
| River | Tidewarden, every boost (MAX, bobber, full book, best meal, a friend) | 2.47 | 50.1 | 21.9 | 21.4 | 6.6 |
| Sea | Glass, MAX cast | 1.42 | 62.9 | 26.1 | 6.6 | 4.4 |
| Sea | Tidewarden + Lucky bobber, MAX cast | 1.62 | 62.3 | 25.9 | 7.1 | 4.8 |
| Sea | Tidewarden, every boost (MAX, bobber, full book, best meal, a friend) | 2.47 | 60.0 | 24.9 | 9.0 | 6.0 |

In the river, every boost on the Tidewarden now gives rare 16.1% and epic 3.2%: under today's Tidewarden, bobber and MAX cast (17.4% and 5.4%) and well under today's every boost (21.4% and 6.6%). The rod alone gives 9.7% and 2.1%, against 16.3% and 5.1% for today's Glass rod on a MAX cast. At sea, epic halves (6.0% with every boost today, 3.3% proposed).

**What that means in time** (about 20 seconds a cast, 3 a minute): a river, sea or pond legendary at a full stack is about 1,680 casts in its window, roughly 9 hours of fishing its hours; a deep sea one about 670 casts, under 4 hours; a cliff pool one about 800. A Divine is about 16,000 casts for one player, but the raid is the room's: ten people fishing its window find it ten times sooner, and it comes at most once a day per room. A legendary also has to be won in the boss reel.

## 8. Rods: every one different

David: "all rods will have slightly different stats even if both in uncommon".

**The rule:** each rarity has a stat budget (the six stats added up: common 60 to 70, uncommon 150 to 160, rare 230 to 300, epic about 400, legendary about 480), and each rod spends it its own way, its lean. No two rods share a profile, and no rod beats another of its rarity at everything. Stats stay out of 100 (`STAT_MAX`); a rod's rarity still sets what it hooks (`hookCap`).

| Rod | Rarity | Source | Status | Luck | Bite | Strength | Reel | Lure | Control | Total | Lean | Rig luck (alone / + Lucky bobber) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Flimsy rod | common | starter | today | 10 | 10 | 10 | 10 | 10 | 10 | 60 | even, the floor | 0.00 / 0.08 |
| Driftwood rod | common | found | later (example) | 15 | 10 | 5 | 10 | 15 | 10 | 65 | luck and lure, a weak line | 0.02 / 0.10 |
| Cedar rod | uncommon | shop | today | 30 | 30 | 20 | 20 | 30 | 20 | 150 | luck, bite and lure | 0.08 / 0.16 |
| Bamboo rod | uncommon | shop | later (example) | 20 | 30 | 30 | 30 | 20 | 30 | 160 | steady: strength, reel, control | 0.04 / 0.12 |
| Glass rod | rare | shop | today | 40 | 40 | 30 | 40 | 30 | 50 | 230 | control (the widest bar) | 0.12 / 0.20 |
| Coral rod | rare | crafted | later (example) | 55 | 40 | 35 | 40 | 50 | 40 | 260 | luck and lure, a sea rod | 0.18 / 0.26 |
| Lighthouse rod | rare | crafted | today | 50 | 60 | 50 | 50 | 50 | 40 | 300 | bite window, all-round | 0.16 / 0.24 |
| Tidewarden rod | epic | crafted | today | 70 | 80 | 70 | 60 | 60 | 60 | 400 | bite window, strong line | 0.24 / 0.32 |
| Abyss rod | epic | crafted | later (example) | 60 | 60 | 85 | 75 | 55 | 65 | 400 | strength and reel, for runs and the deep sea | 0.20 / 0.28 |
| Fallen Star rod | legendary | crafted | proposed | 85 | 75 | 80 | 80 | 70 | 90 | 480 | control and luck | 0.30 / 0.36 |

The five today keep their stats (already all different, Glass and Lighthouse included). The Fallen Star rod is the legendary rod (round 1, David's pick), the only rod that hooks Divine. The four marked *later* are examples of the rule, not proposed for this launch: they show how a second rod in a rarity differs (the Bamboo rod gives up luck for a steadier line than the Cedar; the Abyss rod trades the Tidewarden's bite window for strength and reel, for the deep sea's runs). The Coral and Abyss rods would be crafted from fish materials (Shell Grit, Nacre, Pearl; Isopod Plate, Abyss Ink).

What each stat does now, with the tasks: Luck lifts rarer fish (section 7); Bite window gives more time to hook, and a longer task cue; Line strength drains the meter slower, shortens Run and Spark, and softens a missed task; Reel speed fills the meter faster and takes taps off Pry; Lure brings the bite sooner; Control widens the bar and the Leap and Snag windows.

## 9. Modelling

Unchanged from round 1 (approved, fl-models): concept views (front, side, top) from the ElevenLabs image tool, from a text prompt or David's reference, then headless Blender matching the remodel's finish (`art/remodel/build_fish.py`: 600 to 2,000 triangles, one material, one texture, the soft wet sheen), then `node scripts/pack-glbs.mjs` and the icon. No Meshy (paused).

**Route A, from an existing fish** (reshaped and repainted; the family look for free), 48:
- Small fish: Common Shiner, Fathead Minnow, Golden Shiner and Sardine (from the Pale Chub or the Anchovy), Brook Stickleback and Medaka (Killifish), Pearl Dace (Dace), Weather Loach and Stone Loach (Loach).
- Bass, carp, trout and koi: White Sucker and Golden Mahseer (Carp), Rock Bass and Black Crappie (Bluegill), Lake Trout, Brown Trout, Cutthroat Trout and Arctic Grayling (Rainbow Trout), Kokanee and Taimen (Salmon), Bowfin (Snakehead), Tench (Crucian Carp), Paradise Fish (Betta), Oranda Goldfish (Ranchu), Butterfly Koi, Platinum Koi and Tancho Koi (Golden Koi), Brown Bullhead and Glass Catfish (Catfish).
- Eels, turtles and frogs: American Eel and Hagfish (Moray Eel, Garden Eel), Painted Turtle (Snapping Turtle), Bullfrog (Frog).
- Shells and crabs: Freshwater Mussel, Geode Clam and Blue Mussel (Pearl Oyster, Scallop), Sand Dollar (Sea Star), Cave Shrimp and Ruby Shrimp (Sweet Shrimp), Yeti Crab and Spider Crab (Dungeness Crab).
- Sea and deep: Yellowtail (Horse Mackerel), Cuttlefish (Squid), Halibut (Olive Flounder), Glass Squid (Firefly Squid), Fangtooth (Football Fish).
- Once their route B parent exists: Eastern Newt and Olm (from the Axolotl), Bristlemouth (from the Lanternfish).

**Route B, new shapes** (modelled from the views): Paddlefish, Alpine Newt, Black Ghost Knifefish, Hillstream Loach, Pond Snail, Giant Gourami, Octopus, Spiny Lobster, Sea Urchin, Sea Pig, Chimaera, Blobfish, Viperfish, Dragonfish (14), plus round 1's 9.

**Route C, David's references:** the 12 legendaries, the 2 Divine and their 14 cores. Each creature is a building-size fight model with its own budget row and the aura material (aura-gold, aura-holo; Megabyte adds its electric arcs).

**Image credits:** about 62 new concept sheets this round on top of round 1's 24; the coordinator OKs anything past 10 in a round, so the fish go in batches by water.

## 10. Code and data each needs (later rounds, not now)

- Roster rows for the new fish (appended so no position moves), reel entries in `fishing.ts` `FISH`, a seed migration through `scripts/gen-seeds.mjs`; the Electric Eel and the seven epics' water changes.
- The rarity-first roll in `fishPoolFor` and the server's `fishRoll`: per-water bands, the luck lifts, the boost cap, the cast retune, fixed shares for legendary and Divine, the drop-a-rung rule.
- Water types: `cliff` and `deep` in `WaterType`, the spots or boat that fish them; snow and fog reaching the reel (`reelWeather` maps them to cloudy today).
- The epic tasks in the reel (after fishing-depth's smooth reel): the six kinds, the cue, the hit and miss, the rod stat hooks, the clean catch stamp.
- *Let it go* on the catch card: a server path that rolls the drop by rarity, with the pity rule for creatures; material rows like `MATERIALS` in `recipes.ts`.
- Rod stat rows for the Fallen Star rod, and the later rods if David keeps any.
- Gift keys in `RESIDENT_GIFTS` (a key wins over the category); the class gear recipes.

## 11. Findings (for the coordinator, none fixed here)

From round 1, with where they stand:
1. The starter rod couldn't feel a MAX cast: answered (a slightly bigger fish, David's pick).
2. Rod luck barely moved the odds next to the cast: fixed by the cast retune (section 7).
3. Cliff pool fish bite in the river while the tasting book says "Opens later": answered (their own water when the mountain opens; the book's page should say so until then).
4. The pond is shut, so 13 fish and the Koi kimono's Golden Koi can't be caught: answered (opens next fishing round).
5. No legendary or Divine: this list.
6. `fishing.ts`'s header still says "Legendary is deliberately tight (7)": stale.

New: the tasting book's luck (+1% a species for 20, then +0.5%, cap +0.40) lives in its own lane; under this proposal it counts inside the 0.60 boost cap, so its numbers can stay.

## 12. Open questions for David

1. **The counts.** The river keeps 8 epics (7 today plus the Muskellunge) and the sea 16 uncommon: fine, or demote one or two?
2. **The new fish.** Any to cut or rename (sections 1 and 3)? The koi set in the pond (Golden, Platinum, Tancho, then the Dragon Gate Koi)?
3. **The creatures.** The twelve legendaries and their myth names (Namazu, Umibozu, Raiju, Hanzaki, Charybdis, Bakunawa, Lyngbakr), three per class family?
4. **Megabyte's aura.** Electric arcs over the gold legendary rim (so it still reads legendary), or electric instead of gold?
5. **The tasks.** Six shared kinds, one per epic and two for the four giants; a miss costs 15%, never the fish. Too easy, too hard?
6. **The drops.** 15, 30, 50, 75, 95 and 98%, with no two misses in a row on a creature?
7. **The odds.** Legendary 1 in 2,500 (1 in 1,000 in the deep sea) and Divine 1 in 20,000 per cast before luck; about 9 hours of fishing its window for a river legendary at a full stack. Hard enough, or too hard?
8. **The boost cap.** Book, meals, rain and friends capped at 0.60 together, the cast cut to 0.30: right?
9. **The later rods.** Keep any of the four examples (Driftwood, Bamboo, Coral, Abyss), or only the rule for now?
10. **The Warden family** has no legendary until the pond opens: fine, since it opens next fishing round?
