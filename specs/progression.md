# Progression: the player's road through the game

Status: **live, canon** (ledger row 345). Set by David on 2026-11-26. It replaces the four-chapter main quest in `progression-systems.md` (Settle in, Reopen the cafe, Fund the museum, Reach the ruins gate) and the season mapping and ending in `lore.md`. Club-wide goals, the journal and letters in `progression-systems.md` stay. The structure is locked. The details marked open are still being planned with David.

## David's words (2026-11-26, verbatim)

"heres the game progression i have loosey in mind, update and replace what i have before, it will go from tutorial/fishing to exploring the village, and do something that allows access to the mountains, mountian will be obby, where they will get glider and unlock combat, they wil have to talk to oracle in temple, first person and make u stare in crystal ball and transport you into a dystopian barren wasteland, the minigame lasts 5-10 min that checks ur pattern to give you one of the 16 class, the mini game will see how you play, your decisions, and etc, needs to be better planned, but this is also a foreshadow to the outside world, yo coe back with new power and weapon kinda thing, glide down with glider after, then when you have comabt ready you can explore forest, which unlocks foraging and fihging mobs, and after some missions cooking will be fully unlocked and you can cook dishes with stuff you forage and fish and meat you get from fihsing or monster, and then cave will open which gives you the proper stuff to build a good enough ship to sail into the unknown, and it will be another minigame, if you crash you go back into beginning cutscene but you remember this time and you kinda keep trying until you get to the dystopian world which will be another thing"

## The road

| # | Stage | Where | What the player does | What it unlocks |
|---|---|---|---|---|
| 1 | **Arrival and fishing** | Beach, wharf | The wash-up cutscene, then the fishing tutorial | Fishing; the village |
| 2 | **The village** | Village core | Meet the residents, learn the village tools and missions, then do the thing that opens the mountain | The mountain path |
| 3 | **The mountain** | Mountain | An obby climb. The glider is found on the way up and combat unlocks | Glider, combat |
| 4 | **The Oracle and the vision** | The temple | Talk to the Oracle. In first person you stare into the crystal ball and are pulled into a barren dystopian wasteland. A 5 to 10 minute minigame reads how you play and what you decide | One of the 16 classes, its power and its weapon |
| 5 | **The descent** | Mountain to the village | Glide down from the temple with the glider | (the way back) |
| 6 | **The forest** | Forest | Explore with combat ready | Foraging, fishing mobs |
| 7 | **Cooking** | Sushi bar, later restaurants | After some forest missions, cooking fully unlocks. Dishes use what you forage and fish, and meat from fishing and monsters | Full first-person cooking |
| 8 | **The cave** | Cave | Gather what the ship needs | Ship parts |
| 9 | **The crossing** | Open sea | Build a good enough ship and sail into the unknown: a sailing minigame. A crash sends you back to the opening cutscene, but this time you remember. You keep trying | Reaching the dystopian world |
| 10 | **The dystopian world** | Beyond the veil | "another thing": the next part of the game, planned later | |

## Stage notes

### 1. Arrival and fishing
- The opening is the existing wash-up: you wake almost drowning and the fisherman pulls you out (`lore.md`, the boat-to-shore cutscene).
- Stage 9 reuses this cutscene. A crash at sea ends with you washing up here again, so the first time you play it, it is already the end of a loop you don't remember yet.
- Fishing is the tutorial. Existing work: the fishing rig, the reel minigame, fishing camera v4 (`web/lib/game/reelCam.ts`), and the Roblox Studio fishing body clips (`art/roblox/kit/`).

### 2. The village
- The existing village quest steps fit here: the museum donation, the net, the shovel, the rod challenge, the museum goal and the pickaxe (`specs/lanes/main-quest.md`, m1 to m6).
- **What opens the mountain (David, 2026-11-26):** "village quest line finish, the mountain path is repaired because the guy there wants sushi from bachi which you need to get from bachi quest, then the does cutscene to clear the path". The village quest line ends with Bancha's (the sushi chef's) quest. Its sushi goes to the resident at the mountain path, and his cutscene clears the path.
- **The nudge when stuck (David):** "if youre stuck for too long or like dont know how to progress, you will get a cutscene of like you sensing something at the top of the moutain, liek of a cuz scene of someone whispering in your ear and you look around and noones there and it shows you slowly panned and looking at the top of the mountain, and youll be like it feels like someone is watching me kinda thing to nudge them to explore". A short Studio cutscene: a whisper, the character looks round, nobody is there, then a slow pan up to the summit, and a line like "it feels like someone is watching me". **Open:** how long counts as stuck.

### 3. The mountain (obby)
- A platforming climb.
- The glider is found on the mountain. `glider.md` holds the existing glider work; it was the first movement unlock and now comes from here.
- Combat unlocks on the mountain. `combat-foundation.md` holds the existing combat work.
- **Open:** where on the mountain combat unlocks, and whether the climb has fights.

### 4. The Oracle and the vision
- **The temple is at the mountain summit (David, 2026-11-26).** The obby leads to it. The village temple moves up there.
- **First person:** the camera moves into first person and you stare into the crystal ball. The pull into the vision is a cutscene authored in Roblox Studio (standing rule: all cutscenes, cameras and VFX are made in Studio).
- **The wasteland minigame:** 5 to 10 minutes in a barren dystopian wasteland. It watches how you play and what you decide, and gives you one of the 16 classes. `classes/design-sheet.md` holds the 16 subclasses.
- It foreshadows the outside world.
- **You come back with a new power and a weapon:** your class's kit and its weapon. The design sheet's ceremony, with the weapon forming in the subclass colour, fits here.
- **This replaces the Oracle quiz** (MBTI questions; removed 2026-11-28, its specs in `archive/specs/oracle-identity.md` and `ux-oracle-v2.md`) and the level-10 subclass choice (ledger row 22). The quiz's type-to-subclass table can seed how the minigame's readings map to classes.
- **What the vision is (David, 2026-11-26):** both a possible future of the world and a fragment of your lost memory: "both 2 and 3, i want you to plan with me that ties in the story of the game better and the ending". The story spine is being planned with David.
- **Open, needs its own planning pass with David:**
  - What the minigame measures, and how that maps to 16 classes.
  - Whether the player can see or change the result.
  - Redo rules.

### 5. The descent
- You glide down from the temple.
- It is the first real use of the glider, from a height built for it.

### 6. The forest
- Explore with combat.
- The forest unlocks foraging and fishing mobs.
- **Open:** what a fishing mob is (monsters that come out of the water, or fish you fight).
- Foraging rows in the ledger (129 and others) still describe what can be found.

### 7. Cooking
- Cooking fully unlocks after some forest missions. A first slice opens earlier: Bancha's quest in the village is a guided sushi session, and its sushi opens the mountain path (stage 2).
- **Ingredients:** foraged goods, fish, and meat from fishing and from monsters.
- **The model:** first-person cooking modelled closely on Hands-On Delight (study and build plan: `specs/cooking/`, branch game/cooking-study). Kaleidoscope Cookery is a secondary reference.
- **Where:** the sushi bar first, restaurants later.

### 8. The cave
- The cave opens after cooking.
- It gives the proper materials to build a good enough ship.
- `lore.md` puts a sealed cave on the cliff, a hull breach of the buried war vessel. That fits: the cave holds the old ship's parts.

### 9. The crossing
- **Build the ship:** "good enough" suggests the ship's quality affects the sailing. **Open:** whether the build is a crafting checklist or a ship editor.
- **The sailing minigame** goes into the unknown.
- **On a crash (David, 2026-11-26):** "what if it feels like you restarted and the character loses their memory but you get like flashes of your past memory, and because the player remembers stuff like they dont have to restart from the very beginning, like idk help me think, and also because you restarted you will improve the ship the second time which makes it possilbe to cross, but you will go do the parkour again and talk to oracle, its just that like your skills poitns are still there kidna thing, also make the npc initial dialogue talk to you like they kinda met you already like ambiguous, so that its not the first tuime youre back"
  - The character wakes on the beach with their memory gone again, but gets flashes of the past run.
  - The player remembers, so the road goes faster.
  - Skill points stay.
  - You climb the obby and see the Oracle again.
  - Residents' first lines are ambiguous, as if they have met you before.
  - The second ship is better, which is what makes the crossing possible.
  - **Open:** what else stays or resets (items, home, class, the village quest steps); whether the first crossing always fails by design.
- You keep trying until you reach the dystopian world.

### 10. The dystopian world
- The next part of the game. Not planned yet.

## The story

The story (the Answer, the veil, the Keepers who escaped by forgetting, Wren the fisherman and his pact, the fork) is canon in `lore.md`. This file holds only the road and its rules.

## The crossing loop: rules

- The first crossing always crashes. It is scripted.
- **The fork:** stay (an Animal Crossing life on the island) or sail (the dystopian world, combat and survival). Neither is a failure, and in the end you can travel between both.

### What survives a crash (David: "innate stuff stays the same like class and skill stats")

| Stays (who you are) | Resets (what you carried) |
|---|---|
| Level, skill points, stats, class | The village story steps, replayed fast because flashes skip the teaching |
| Fishing, foraging and cooking mastery | What you carried on the ship (lost at sea) |
| Known recipes | The ship (the wreck's salvage makes the second one better) |
| Your home ("someone kept this house for you") | The climb and the Oracle visit |
| Everything bought with gems or earned as cosmetics, never lost | The glider: found again on the climb, already known how to fly |

## What this changes

- **Main quest:** the four chapters in `progression-systems.md` (rows 87, 101, 177 to 179) are replaced by the road above. Chapters 2 and 3 were club-wide goals. Club-wide goals and their monument still exist, as their own layer; they no longer gate the personal road.
- **Classes:** assigned by the vision minigame instead of the Oracle quiz and the level-10 choice (rows 16, 20, 22).
- **Combat:** unlocks on the mountain, before the class. `lore.md`'s class line "cosmetic and flair only; never feature gates" no longer holds, because the class now brings a power and a weapon.
- **Glider:** comes from the mountain.
- **Lore:** `lore.md` was rewritten on 2026-11-26 around this road. The old season arc, level-10 ending and never-show-the-outside rule are deleted.
- **The arrival loop:** the opening cutscene becomes the restart point of the crossing.

## Existing pieces by stage

| Stage | Exists today |
|---|---|
| 1 | Wash-up cutscene, fishing rig, reel minigame, fishing camera v4, Studio fishing clips |
| 2 | Village core, residents, main-quest m1 to m6, museum, tools |
| 3 | Glider spec and build; combat foundation |
| 4 | Oracle temple building, Oracle keeper, 16 subclass kits, the subclass ceremony |
| 5 | Glider |
| 6 | Foraging roster rows, forest terrain plans |
| 7 | Sushi bar (building, chefs, menu, first-person stools), cooking study |
| 8 | Lore cave, ore and pickaxe (m6) |
| 9 | Boat and wharf trip, arrival cutscene |

## Open questions for David

1. ~~What opens the mountain~~ (answered: Bancha's sushi for the path resident).
2. The vision minigame:
   - what it measures;
   - how it reaches one of 16 classes;
   - whether you can see or redo the result.
   This needs its own planning pass.
3. ~~Real outside or possible future~~ (answered: both; see `lore.md`).
4. What is a fishing mob?
5. ~~Does any cooking open before the forest~~ (answered: Bancha's quest is a guided first slice).
6. The ship: a checklist of parts, or an editor where the build changes how it sails?
7. ~~After a crash~~ (answered: the table in the story spine; the first crossing always crashes).
8. ~~Where the temple sits~~ (answered: the summit).
9. How long counts as stuck before the summit-whisper nudge plays.
