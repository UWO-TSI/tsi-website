# The fish list: what you can catch, and why

Lane `fish-list`, round 3 (2026-11-04). Still the list only: nothing is built or modelled. Round 1 (2026-11-02) listed today's 91 catches, 24 new fish and 6 creatures; round 2 (2026-11-03) rewrote it to David's marks; round 3 (this one) applies his notes on drops, rods and the epic reel tasks (section 0, "Round 3").

## 0. David's marks

Round 3 review (2026-11-04, verbatim; every card approved: fl2-biome, fl2-new, fl2-megabyte, fl2-odds, fl2-questions "looks good", all ten picks), with these notes:

- fl2-drops (approve): "more rare so like divine 80, leg 70 epic 60"
- fl2-rods (approve): "glass strenght lower, the stats should make sense with the rod. passive ability exist aswell"
- fl2-tasks (approve): "maybe stuff that moves out of the actual bar, so like mouse mouse placement matters"

**What changed in round 3:**
1. **Drops** (section 6): epic 60% (70% on a clean catch), legendary 70%, Divine 80%; common 15, uncommon 30 and rare 50 stay. The "never two misses in a row" rule on creatures stays as it is (it still fits, see section 6).
2. **Rods** (section 8): David's note is recorded and handed to the `rod-gear` lane, which is rescaling every rod this round. Rod stats, Glass's lower strength and rod passives are its. This list keeps only the rule. No rod stat is changed here.
3. **Epic reel tasks** (section 5): the design direction is now David's: the targets move out of the reel bar, so where the mouse (or finger) is matters. One line per task says how each of the six uses it.

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
4. Materials drop by the fish's rarity: 15% from a common, 60% from an epic, 70% from a legendary, 80% from a Divine, never two misses in a row on a creature (section 6; round 3 made the top three rarer).
5. The odds are harder and no longer depend on how many fish a water has; luck boosts cap together, and the tables show each rod alone and with a full stack (section 7).
6. Every rod has its own stat profile, even within a rarity (section 8).
7. Fixes: the Electric Eel moves to the cliff pools; 7 sea epics move to the deep sea (they stay in the sea until it opens); named gifts only for residents who like fish or sea creatures (section 2).

## 1. Per biome: the counts and the new fish

Coins by rarity, unchanged (`SELL_PRICES`): common 8, uncommon 20, rare 60, epic 180, legendary 600, Divine 1500 (a creature is let go, so a legendary or Divine catch sells its core).

{{counts}}

River and sea are the biggest and lean on common and rare; the deep sea and the cliff pools carry the most epic and legendary for their size, and their odds lean that way too (section 7). The river keeps 8 epics because 7 bite there today; the sea's 16 uncommon are today's 14 plus round 1's two winter fish. The counts include the 3 tourney fish (Yellow Perch, Sturgeon, Giant Trevally), which bite only while a tourney is open.

**The new fish, by name:**

{{newByWater}}

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

{{rosterR}}

### Cliff pools

Their own water when the mountain opens (David's pick); until then these fish bite in the river, as today's four do.

{{rosterC}}

### Pond

Up the mountain; opens in the next fishing round (David's pick).

{{rosterP}}

### Sea

{{rosterS}}

### Deep sea

Opens with the boats (next launch, m7). The seven epics and the Football Fish marked *from the sea* stay in the sea until then.

{{rosterD}}

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

**Design direction (David, round 3: "maybe stuff that moves out of the actual bar, so like mouse mouse placement matters").** Today the reel is one input: hold to raise the bar, let go to lower it, and where the pointer is never matters. An epic task is played **outside the bar**: a target appears in the water around it and moves, and the task is won by putting the mouse (or a finger) on it, so where you aim counts as well as when you press. The bar keeps running under it, so the task is a second thing to do, not a pause.

How it works, for every task:
- **Two hands.** Holding the reel stays what it is (Space or any pressed pointer). On a desktop the mouse can be free to aim while Space holds the reel, or the mouse holds the click and drags to the target. On a phone one thumb holds and the other places, or the held finger drags onto the target (a held pointer still counts as holding, `bindFishingInput`).
- **The pointer is read, not clicked.** Run, Snag, Dark and Spark read where the pointer is every frame. Only Leap and Pry need a click or tap, and those two freeze the catch meter for their 1 to 2 seconds so a click can never let the bar fall.
- **Fair to aim at.** A target is never smaller than 28 px on a desktop and 44 px on a phone. Control widens it (below). Targets stay inside the reel panel, clear of the HUD and the Esc hint, and move at a speed a thumb can follow. Reduced motion slows them.
- **No mouse, still playable.** If the last input was a key, the same target is a marker the arrow keys or WASD move, and Space acts as the click. Same task, same windows.
- **Cheap to draw.** The pointer position is a ref updated on `pointermove` and tested in the reel's own frame loop (`useReelLoop`'s `onFrame`: refs and styles, no React renders), so the tasks add no lag to the smooth reel.
- **Build check.** The mouse must be free during a reel. If the camera's mouse-look has the pointer locked while fishing, the reel frees it (Esc already ends mouse-look, `fishingInput`) and shows a cursor. Confirmed when the tasks are built.

| Task | What happens | What you do (desktop; phone): the target moves out of the bar | Rod stat that helps |
|---|---|---|---|
| **Leap** | The fish jumps clear of the water and the bar freezes; a ring drifts out from the bar along the fish's arc toward where it will land, closing as it goes | Put the pointer in the ring and click as it closes, so you aim at the landing as well as time it; tap the ring | Control widens the timing window (300 ms, plus 20 ms per 10 Control over 10) and the ring |
| **Run** | It bolts and a buoy on the line races off across the water, away from the bar, the line glowing red | Keep the pointer on the buoy for about 1.5 s as it tows; drag a finger after it. Leaving it lets the line burn | Strength shortens the run |
| **Snag** | Roots, rock or coral slide in from one side of the panel, towards the bar's water; a clear lane stays open on the other side | Move the pointer into the clear lane before the snag closes (about 1.2 s) and hold it there until it passes; slide a finger over | Control widens the lane and the window |
| **Pry** | It clamps shut or digs into the bottom and the bar freezes; four pry points glow round the bar, one at a time, each for about 1 s | Click each point as it lights, so where you click matters as well as when; tap each | Reel: one point fewer per 20 Reel over 40 (two at least) |
| **Dark** | It inks or slips into the dark: the catch bar fades for 2 s and a faint lamp drifts through the ink beside it | Follow the lamp with the pointer; the bar's edge shows again while you are on it; slide a finger after it | Control widens the lamp's ring (a wider bar is easier blind) |
| **Spark** | It shocks the line: three sparks run down the line from the fish toward your rod, at different heights | Sweep the pointer through each spark before it reaches the rod tip; swipe through each | Strength slows each spark |

**Rules:**
1. One task per epic reel, at a random point between 35% and 75% of the catch meter. The four giants (Whale Shark, Great White Shark, Blue Marlin, Oarfish) get two.
2. A short cue first: an icon over the bobber and a sound, 0.4 s ahead (plus 25 ms per 10 Bite window over 10), so the task is never a surprise.
3. **Hit:** +10% on the catch meter and a small "nice" pip. **Miss:** -15%. A miss never loses the fish by itself; only an empty meter does, as today. Strength softens a miss (-1% per 10 Strength over 10, to -10% at most).
4. **Clean catch:** every task hit stamps the catch card and adds 10 points to its material drop if you let it go (section 6).
5. One placement each, plus a click, a tap or a follow, so every task works on a phone (design principle 5) and with a key marker when there is no mouse (above). Targets are never shown outside the panel or under a finger's own hand (on a phone they spawn away from the holding thumb's corner).
6. **Legendaries** chain their tasks in order through the boss reel (the table below); the Divine raids have their own fight.
7. Built after the `fishing-depth` lane's smooth reel lands, on the reel's own frame loop, so the tasks add no lag.

**Which epic does which:**

{{taskAssign}}

**The legendaries' boss reels:**

{{legTasks}}

## 6. Crafting materials: what fish give

**How:** the catch card's third choice, *Let it go* (David approved): the fish swims off and may leave its material behind (a shed scale, a fin, a squirt of ink, a tooth). The first catch of a species still goes to the book and the museum as today. A legendary or Divine catch is always let go (it's the size of a building) and rolls for its core.

**The drop, by the fish's rarity** (David: "these drops are rarer for common fish and almost guarenteed for legendary or divine fish drops"):

| Fish rarity | Drop when you let it go | Amount | Releases per drop, on average |
|---|---|---|---|
| common | 15% | 1 | about 7 |
| uncommon | 30% | 1 | about 3 |
| rare | 50% | 1, or 2 where the roster says x2 | 2 |
| epic | 60% (70% on a clean catch) | 1 | 1.7 (1.4) |
| legendary | 70%, and never two misses in a row on the same creature | its core | about 1.3 with the rule (1.4 without) |
| Divine | 80%, the same rule; everyone in the raid rolls for their own | its core | about 1.2 with the rule (1.25 without) |

Luck doesn't touch the drop (luck is for rarity), so the drop is the same for every player.

**Round 3 (David: "more rare so like divine 80, leg 70 epic 60").** Epic 75 to 60, legendary 95 to 70, Divine 98 to 80; the clean-catch bonus stays +10 points (so 70% for an epic with every task hit; with two tasks on a giant, both must be hit). The ladder still climbs 15, 30, 50, 60, 70, 80, and the top three are no longer "almost guaranteed", they are earned. **Does "never two misses in a row" still fit?** Yes, and it is left as is. It applies only to a legendary or a Divine creature, whose catch takes hours of fishing and a boss reel, so two empty releases running would be a loss the player cannot fairly be asked to take; it also barely moves the number. With a 70% roll, a miss is followed by a sure drop, so the average legendary drop comes in 1.3 releases (77% felt, against 70% rolled) and a Divine in 1.2 (83% against 80%). Epics have no such rule and stay a plain 60 (70). So "more rare" holds everywhere, the legendary from 1.05 to 1.3 releases a drop and the Divine from 1.02 to 1.2, and a bad streak on a creature is capped at one miss. If David wants the felt rate to be exactly 70 and 80, the rule would go, or the rolls drop to about 57 and 75 (question 6).

**The materials** (sources come straight from the roster):

{{materials}}

**The epic parts** (one or more per subclass; the subclass's epic-look signature weapon):

{{parts}}

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

{{oddsRiver}}

**The other waters, from the first epic rod up:**

{{oddsOther}}

**Today, for comparison** (today's weights and roster, the same seasons and hours):

{{oddsToday}}

In the river, every boost on the Tidewarden now gives rare 16.1% and epic 3.2%: under today's Tidewarden, bobber and MAX cast (17.4% and 5.4%) and well under today's every boost (21.4% and 6.6%). The rod alone gives 9.7% and 2.1%, against 16.3% and 5.1% for today's Glass rod on a MAX cast. At sea, epic halves (6.0% with every boost today, 3.3% proposed).

**What that means in time** (about 20 seconds a cast, 3 a minute): a river, sea or pond legendary at a full stack is about 1,680 casts in its window, roughly 9 hours of fishing its hours; a deep sea one about 670 casts, under 4 hours; a cliff pool one about 800. A Divine is about 16,000 casts for one player, but the raid is the room's: ten people fishing its window find it ten times sooner, and it comes at most once a day per room. A legendary also has to be won in the boss reel.

## 8. Rods: every one different

David: "all rods will have slightly different stats even if both in uncommon".

**Handed to the `rod-gear` lane (round 3).** David's note on this section, verbatim: "glass strenght lower, the stats should make sense with the rod. passive ability exist aswell". Three asks, all for `rod-gear`, which is rescaling every rod this round (`web/lib/game/rods.ts`), so this list changes none of them:
1. **Glass's strength goes lower** (30 in the table below).
2. **A rod's stats make sense with the rod:** the lean follows what the rod is and looks like (the Glass rod a fine, brittle control rod; the Tidewarden's strong line; the Cedar's leaf-light luck and lure), and the reading of a stat on its hex radar matches its name and its model.
3. **Rod passives exist as well:** a rod may carry a passive ability beside its six stats. What they are is `rod-gear`'s to design.

What stays here is **the rule below** (a budget per rarity, no two rods alike, a lean for each, stats out of 100). The table of stats and the budget numbers below are round 2's proposal, kept only so the odds in section 7 can be read: when `rod-gear` lands its numbers, `rods.ts` wins on every stat, and the odds tables are rebuilt from them (edit `RODS` in `specs/fish-list-src/analyze.mjs`, then `node analyze.mjs` and `node build.mjs`). Anything in this section that disagrees with `rod-gear` is out of date.

**The rule:** each rarity has a stat budget (the six stats added up: common 60 to 70, uncommon 150 to 160, rare 230 to 300, epic about 400, legendary about 480), and each rod spends it its own way, its lean. No two rods share a profile, and no rod beats another of its rarity at everything. Stats stay out of 100 (`STAT_MAX`); a rod's rarity still sets what it hooks (`hookCap`).

{{rods}}

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
- The epic tasks in the reel (after fishing-depth's smooth reel): the six kinds as targets that move out of the bar (a pointer ref read in the frame loop, the key marker, the 28 and 44 px floors, the freeze for Leap and Pry), the cue, the hit and miss, the rod stat hooks, the clean catch stamp.
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
5. **The tasks.** Six shared kinds, one per epic and two for the four giants, now played with the pointer on targets that move out of the bar (section 5); a miss costs 15%, never the fish. Fine as sketched? In particular, is the key-marker fallback for players with no mouse right, or should the tasks need a mouse or finger?
6. **The drops.** 15, 30, 50, 60 (70 clean), 70 and 80% (David's round 3 numbers), with no two misses in a row on a creature. That rule makes a legendary feel 77% and a Divine 83%: leave it, or drop it (or lower the rolls to about 57 and 75) so they feel like 70 and 80?
7. **The odds.** Legendary 1 in 2,500 (1 in 1,000 in the deep sea) and Divine 1 in 20,000 per cast before luck; about 9 hours of fishing its window for a river legendary at a full stack. Hard enough, or too hard?
8. **The boost cap.** Book, meals, rain and friends capped at 0.60 together, the cast cut to 0.30: right?
9. **The later rods.** Keep any of the four examples (Driftwood, Bamboo, Coral, Abyss), or only the rule for now?
10. **The Warden family** has no legendary until the pond opens: fine, since it opens next fishing round?
