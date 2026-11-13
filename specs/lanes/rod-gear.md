# Lane: rod-gear (rods, add-ons, the hex radar, the rarity ladder)

Worktree `.claude/worktrees/rod-gear`, branch `game/rod-gear`, cut from main at fdd7a901. Agent type `uwotsi-lane`. The launch date moved later; the new date isn't set yet.

Items **f-rods, x-shop and m4's rod shop** in `specs/launch/v1-gameplay.md`. Existing: `web/lib/game/rods.ts` (5 tiers: Flimsy, Cedar, Glass, Lighthouse, Tidewarden), `web/lib/wallet/catalogue.ts` (prices, sell prices), the shop UI, `FishingRig.tsx`, and the rarity in `web/lib/collections/roster.ts` and `fishing.ts`.

1. **The rarity ladder** for items and fish: common, uncommon, rare, epic, legendary, Divine, Contraband. Contraband is for mods and T0/T1 only; how it's earned is still open, so build the tier and gate it behind a flag. Colours in the GUI kit. Update every place rarity shows. Commit it first and report it, because other lanes use it.
2. **5 rods at launch:** from the starter through Cedar to an intermediate rod, each with 5 or 6 stats (for example bite window, line strength, luck or rare odds, cast distance, reel speed). Map the existing tier effects onto them, and show what each stat does.
3. **Add-on slots:** each rod has slots for bait and a bobber (and more later). Each add-on raises stats; for example, the lucky bobber raises luck and bait raises bite time. Add-ons are owned items. Make the existing "Lucky bobber" real.
4. **The rod shop:**
   - each rod's 3D model, turnable;
   - a hex radar chart of its stats, with the equipped add-ons' gains layered on in a different colour over the base;
   - also shown wherever you equip gear.
5. **Hollow items:** hide or replace any shop item that does nothing (the "Basic rod" with no tool, net and shovel tiers with no effect, furniture while homes are closed).

Prices go into the existing catalogue and seed, with a new migration I apply.

**Read first:** `specs/launch/v1-gameplay.md` (David's notes verbatim, your items), `CODEMAP.md` rows for your area, and the files named below. Search before building; most systems exist.

**Shared pieces, one owner each:**
- the guide arrow (`tutorial-v2` builds it first and reports);
- the quest dropdown and tracker (`main-quest`);
- the rarity ladder (`rod-gear`).

Others use these once they land. Ask the coordinator to merge the owner's commit into your branch, and don't build a second copy.

**Migrations:** write new ones only (timestamped after the newest on main), and stop for the coordinator to apply them. Prices and rewards go in the existing economy tables and rules. Never write the gem-to-money rate anywhere.

**Visual work** (UI, models, the tour) goes to David as screenshots on a review page before it merges. Pure fixes can merge once verified.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, plus headless shots or an in-game run for anything a player sees. One `perf:check` at the end only if you change what renders. Report at each milestone and at the end with the head SHA, gates, evidence and anything you couldn't verify.

## Round 11: David's rods 9 and rods 10 reviews (2026-11-06, verbatim; https://claude.ai/artifact/YFRYq9Ngqr2cKSaf37YiGj and https://claude.ai/artifact/GiX3bxPqLYRnenR9bybssB)

Rods 9 approved: rg9-bag, rg9-budget, rg9-hand-close, rg9-hand, rg9-questions, rg9-study.
- rg9-awaken (redo, no note)
- rg9-fx-water (redo): "water effect needs to be faster, the lighter blue white s are the foam from crashing, make the water flwo faster and make the cashing of the water naturally create the foam and make it faster and crash harder. and water dripping off should feel natural"
- rg9-tidewarden (redo): "add the reel and line component to this that matches its style, make all bobber smaller in general"

Rods 10 approved: rg10-cedar, rg10-fx-pulse, rg10-fx-sway, rg10-impact, rg10-questions, rg10-table, rg10-tempest-hand.
- rg10-awaken-tempest (approve): "needs to redo the awakened model but animation looks good"
- rg10-awaken-tidewarden (redo): "that wave animation sucks. i think have the rod not have the wave wrapped aound and the the animation is that the waves wrap around the rod and the awakened will have waves wrapped around and it will have wave movement animation with like wave articles flowing around and water dripping and make the head of the drident longer and glowing"
- rg10-awaken-training (redo): "the flash frame should have more impact like if its lighting related strike with lighting or in this case make the particle gather small and slow and ramp up and the flash frame needs to fit"
- rg10-fx-burst (redo): "this should be turned into its own lane artifacr called aura and effects and not in rod awakenings"
- Every other rg10-fx-* note goes to the new **vfx-library** lane (below).

**The VFX library leaves this lane.** A new lane, `vfx-library` (game/vfx-library, cut from this branch at 544018464), owns the library from now on: `web/lib/game/fx/library.ts`, `water.ts`, the effect types and their shaders, `art/pipeline/fx_library.py`, `/lab/fx`, `specs/fx-library.md` (renamed the VFX library), with its own review page. This lane uses its types and doesn't change them; if a rod needs a library change, tell the coordinator. game/rod-titanium also runs in parallel (the Titanium only).

Build (coordinator):
1. **Tidewarden:** add a reel and the line, styled to match the trident (gold, teal). The base rod has no water wrapped round it.
2. **All bobbers smaller**, everywhere they show.
3. **The Tidewarden's awakening:** the waves wrap around the rod during the animation (replace the wave strike that "sucks"); the awakened form has waves wrapped round it with wave motion, water particles flowing around it and water dripping, and a longer, glowing trident head (a new awakened model, like the Titanium's per-awakening model).
4. **The Training rod's awakening:** the gather starts small and slow and ramps up; the flash frame lands harder and fits the moment.
5. **The Tempest:** the animation is approved; its awakened model is redone (keep the lightning strike), within the Tool budget. Its base model still waits for David's reference.
6. rg9-awaken came back redo with no note: give your best guess and a fix on the questions card.

Evidence `rg11-*`: the Tidewarden with its reel and line (vs the sketch, untracked composite), bobbers before and after, the Tidewarden's awakening and its awakened form (clips), Training's awakening, the Tempest's awakened model, a questions card.

## Round 10: David's rods awakening round 8 review (2026-11-06, verbatim; https://claude.ai/artifact/AgE5pgESXMPef71FiPT1Bx)

Approved: rg8-awaken-epic, rg8-awaken-legendary, rg8-questions.
- rg8-awaken-training (redo): "the awakening animation looks better but needs more flash and almost impact flash frames and make it more juicy and exciting and more suspense, if its a new model or new effect external things will attach like a lighting related will strike it with thunder and stuff you know"
- rg8-cedar (redo): "more dense and move more down to the handle area, the leaves sway a lil when moved like physics"
- rg8-fx (redo): "non of these have proper animation i need you to redo them, and add more and show me one by one the animation, have a pedals animation liek sakura flower pedals, electricity, puslign fire sparks, flame, water allat. this wont only be for fishing rod but for weapon, vfx clothes etc"
- rg8-table (redo): "tide warden titanium and tempes only have 1 awakenings, and they are all very high cap at 600 ish"
- rg8-tempest-hand (redo): "tempes aura is not on the rod body"
- rg8-tempest (redo): "still doesnt look good looks wonkey ill provide reference"

Round 9 (Tidewarden and Water) is on its own page (https://claude.ai/artifact/YFRYq9Ngqr2cKSaf37YiGj), waiting on marks. game/rod-titanium (the new Titanium, its mecha awakening, the general awakened-model wiring) runs in parallel and merges into this branch; leave the Titanium's model and effect alone.

Build (coordinator):
1. **The awakening, juicier:** impact flash frames (a few frames of full flash at the burst, like a hit), more suspense in the build-up, a stronger, more exciting burst. When the awakening brings a new model or a new effect, outside things act on it: a lightning rod is struck by lightning with thunder, a water rod is hit by a wave, a fire rod catches flame, and so on per rod.
2. **The effects library, redone:** every type gets proper animation (none of today's read as animated). Add types: sakura petals, electricity, pulsing fire sparks, flame, and water (round 9's). The library is for weapons, VFX on clothes and more, not only rods: keep the types holder-agnostic. Show each one by one, each its own clip on `/lab/fx`.
3. **Awakenings:** Tidewarden, Titanium and Tempest each have one awakening, at about 600 fish. Update the table and the cutscene harness.
4. **Cedar:** denser, the foliage reaching further down toward the handle, and the leaves sway a little with physics when the rod moves.
5. **Tempest:** its aura isn't on the rod's body in hand: fix that. The model waits for David's new reference ("ill provide reference"): don't remodel it yet.

Evidence `rg10-*`: the awakening (Training and one rod with a new effect, the outside strike), each library type one by one (clips), the new table, the Cedar swaying (clip), the Tempest in hand, a questions card.

## Round 9: the Tidewarden and the water effect (David, 2026-11-05, verbatim)

- With `specs/references/rods/fx-aquatic-water-ref.png`: "look at this water effect on the sword i want you to turn it into a effect with that foam look and water crashing, i want you to model this as 1:! as possible serious job use wtv u can"
- Right after, with `specs/references/rods/epic-tidewarden-ref.png`: "tide warden reference"

Both images are third-party: they stay untracked in `specs/references/rods/` (README.md there describes them) and in the vault. Never commit them; evidence may show them side by side with our renders.

Round 8 is still waiting on David's marks (https://claude.ai/artifact/AgE5pgESXMPef71FiPT1Bx). Build on it; its notes come back as round 10.

Build (coordinator):
1. **The water effect, a new library type** (`Water` in `web/lib/game/fx/library.ts`, `specs/fx-library.md`, a template in `art/pipeline/fx_library.py`). Match the Aquatic sword's water as closely as you can, it's a "serious job":
   - the body: deep teal-blue with darker diagonal streaks and pale highlights, moving (it flows; it is never a still texture);
   - the foam: white with a faint cyan edge, breaking along the water's edges in ragged, curling tongues;
   - the crash: a foam crown that breaks and re-forms where the water ends, splash tendrils curling off, droplets flying out and falling.
   Pick colours off the reference. Use whatever gets closest: Blender for the shapes (headless only), a custom shader (flow, foam edge, alpha cut in the toon look), the existing particle pack (`web/lib/game/fx/pack.ts` splash crown, `fishingFx.ts` FOAM_TINT and the crown recipes) and the sea's water shader. Search those first and reuse them. Keep the library's rules: no rings or discs, one material per part, a holder's effect at most five draws (RodAura.test). Say what grows with strength (more foam, more of the shaft wrapped, more splashes).
2. **A 1:1 study of the reference:** model the Aquatic sword itself (the shell hilt and the water blade) as the Water type's sample on `/lab/fx`, at the reference's angle and framing, and show our render beside the reference. It's the proof the effect matches; it's not a game item.
3. **The Tidewarden, remodelled 1:1 from its reference:** a golden trident, three blue-tipped prongs with the two round cut-outs and the spurs, teal veins cracking through the gold head, the long thin shaft, the teal wrap and the four-point star butt cap. It stays a working rod (the line leaves the middle prong's tip; a reel only if the rig needs one, small and quiet). Tool budget (600 tris, 5 materials, nothing emissive on the rod). Its effect GLB (`rodfx-tidewarden`) wears the Water type: the ribbon of water wrapping the shaft under the head with splashes and droplets trailing off (as drawn), the teal veins as Glow. The old Halo discs, the spindle aura and the pearl go (the reference has none), so the Tidewarden is on the library like the Tempest. Its wave motion (round 8, `rodMotion.ts`) stays and fits the water: the rod is never still. Re-render its icon.
4. **Where it shows:** the shop detail, the bag's rod stage, the awakening cutscene (`/dev/economy?view=awakening&rod=tidewarden&stage=1|2`, with the effect's strength rising per awakening) and in hand on the island.

Evidence `rg9-*` in `specs/evidence/rod-gear/r9/`:
- the water study beside the reference (still);
- the Water type on `/lab/fx` at strength 1 and 2.5 (clips);
- the Tidewarden beside its reference (still), turning (clip), and in the shop, bag, cutscene and hand (desktop and phone);
- its draws and tris against the budget;
- a questions card (Riptide still has no reference; anything else you need decided).

Gates as usual, one `perf:check` at the end on the scenes you touched.

## Round 8 additions: David's rod models notes (2026-11-05, verbatim, relayed by the coordinator; https://claude.ai/artifact/LFoFkQq2pABPtHPEZS4A7L)

- rm3-cedar (redo): "more leaves it loosk naked"
- rm2-tempest (redo): "no epic enough, shape isnt right and the effects on the rod also isnt right, i will provide references, the aura doesnt look rightm and the light coming off of it being circle isnt right. i want you to make a mini effect library that organizes types of effects and its a standard so future vfx or effects and r eference and take the template"

Build (coordinator):
1. Cedar: more leaves, growing naturally the way a cedar's do (rm2-cedar's earlier note).
2. A small effects library: a standard set of effect types that future VFX copy as a template (aura, glow on the object, particles, trails, pulses, sparks and bursts), each with its parameters, a strength setting and a preview clip. No circle or ring glows. Build round 8's awakening effects from it.
3. Tempest: rework it with the library against `specs/references/rods/epic-tempest-ref.png`. More references are coming: say so on the questions card.
4. Tidewarden and Riptide have no references on file yet: keep them as they are, and list that on the questions card.

## Round 8: David's rods awakening round 7 review (2026-11-05, verbatim; https://claude.ai/artifact/BHtKmVCxwLk6MdRxugfPFg)

Approved: rg7-awakened-card, rg7-gary, rg7-questions, rg7-rodbox-bag, rg7-rodbox, rg7-traded.
- rg7-awaken-epic (redo): "remove circle, make rod in the midle of the glow, also the glow is recealing theres a hard box around cuz glow is cut off. i want you to edit more effects like the tidewarden should get wave animation and shouldnt be a stagnant rod, orb shoul grow in size etc."
- rg7-awaken-legendary (redo): "the background glow needs to show that its previously a epic or rare and not glow white,"
- rg7-awaken-training (redo): "make the stats grow after rod animation is done, one of the design priciples is that the eye cant look at two things at once, i dont htink we need the circle, make the bacground glow a glow on the rod instead"
- rg7-table (redo), no note

Build:
1. The awakening cutscene:
   - No circle or ring anywhere.
   - The glow is on the rod itself, not a background glow. The rod sits in the middle of it.
   - The glow is never cut off by a hard edge: make the quad or render target big enough, or soft-edged.
   - One thing at a time: the rod's animation plays first, and the stats grow only after it ends ("the eye cant look at two things at once").
2. More effects, per rod:
   - Tidewarden gets a wave animation and moves; it is never a still rod.
   - The orb grows in size.
   - "etc.": give each awakening rod its own motion that fits it (Tempest's wind and storm, Titanium's metal sheen), within the perf budget. Clip each rod.
3. The legendary awakening: the glow starts in the colour of the rarity the rod had (rare blue or epic violet) and turns into the legendary colour. Never white.
4. rg7-table was marked Redo with no note. Keep the numbers, and put the table on the questions card asking which ones to change.
5. The approved picks from rg7-questions stand:
   - Epics stay epic.
   - Real awakened models come through the tool pipeline with David's references (Tempest, Tidewarden and Riptide are still awaited). Meshy is paused and ElevenLabs credits are out, so the stand-in recolours stay.
   - The recolour shows only in the cutscene.
   - The aura gets a strength setting.
   - The cutscene replaces the card on every awakening.
6. `specs/references/rods/` is third-party art and is untracked. Never commit it.

## Round 7: David's rod data round 6 review (2026-11-04, verbatim; https://claude.ai/artifact/YSyC1PSg7s3yeftBuVcdJu)

Approved: rg6-epic, rg6-passive, rg6-shop, rg6-stats, rg6-training-phone.
- rg6-awaken (redo): "awakening needs animation and cut scene, like how when pokemon evlolve, same concept with rod"
- rg6-quest (approve): "dont say nobody sells it,"
- rg6-questions (redo): "epic awaken depends, stats change also depend on the rod, and its not all 200 800 some have solo awakenings. rod seller will be named Gary"
- rg6-rodbox (approve): "remove the all top left"
- rg6-traded (redo): "like should hit that it has potential the more you fish with it"
- rg6-training (approve): "when awakened, rarity change and the rod design will have improvements"

Build:
1. **The awakening as a cutscene** (rg6-awaken), like a Pokémon evolution: the camera frames the rod, it glows and pulses, a burst, and it comes back in its new rarity's outline and an improved design (rg6-training: the rarity changes and the rod's model gets improvements at each awakening). Pitch it with clips; it only replaces the card once David approves.
2. **Awakenings per rod** (rg6-questions): not every epic awakens at 200 and 800, stats don't all rise the same way, and some rods have a single awakening. Propose a per-rod table (thresholds, how many awakenings, which stats change and by how much) for David to mark.
3. **The rod seller is named Gary.** Use the name wherever the seller speaks or is shown.
4. The trade quest's text: don't say nobody sells it (rg6-quest).
5. The rod box: remove "All" in the top left (rg6-rodbox).
6. After the trade (rg6-traded): hint that the Training rod has potential that grows the more you fish with it.

## Round 6: David's rod data round 5 review (2026-11-04, verbatim; https://claude.ai/artifact/1sHjWWpEULGjw1m2rTgeF9)

Approved: rg5-aura, rg5-bag, rg5-models, rg5-shelf, rg5-epics ("i will check": Riptide rare and Titanium epic, both crafted at the workbench; Tempest epic from a quest or event).
- rg5-questions (redo): "make common fish up to rare as default no level up exists only like awakening some rods have 1, for training rod it has 2 awakenings, but dont show it, its supposed to be sudden. okay to unlock the training rod 35 flimsy rod fish and it triggers a quest that allows you to talk to the rod guy and he asks u to trade the flimsy rod for a training rod. no levels, only awakenings for rods. more expensive, price rods properly. yeah and say unique cenario required"
- rg5-stats (redo): "training should be lower level like similar to flimsy stats, but once you fish like 50 fish it evolves and it goes to stats of a rare, and 2nd level up to a epic, and 3rd to a legendary stats . has to fish 50, 250, 1000. make sure the epic rods dont max out too early, so i think you scale down the stats for all the rods down, to make room for legendary and divine rods stats, legendary is basically 100 and divine goes past like 110-120"
- rg5-training (redo): "on the fishing rod have the bar that has the evolution bar for fish caught thing like the training rod but only certain rare rods have that only epic+ with exception of training rod has the evolution thing, so matters more about how long u fish with a rod rather than always the rarity for late game rods, also the left right arror in the rod box ui needs to be remove same with the all arrow, removed. left right arror put very faint and small and light. also have space for a line for the passive for the rod, some rod dont have passive but like rare+ rods will have passives"
- From the fish list review (fl2-rods, approve): "glass strenght lower, the stats should make sense with the rod. passive ability exist aswell"
- David's answers (2026-11-04, asked because the notes disagreed): the Training rod has **three** awakenings, at 50, 250 and 1000 fish; **epic and up show a fish-caught bar** to the next awakening, and **the Training rod shows only its fish count** (its awakenings stay a surprise).

Round 6:
1. **No levels anywhere, only awakenings.** Delete the level code and copy ("Level 1 of 3", the ring). Training starts at about Flimsy's stats and hooks common to rare from the start; at 50, 250 and 1000 fish caught with it, it awakens to rare, then epic, then legendary stats. Its card shows only its fish count, and an awakening lands as a short surprise reveal when the fish that triggers it is landed.
2. **Epic and up awaken too**, with a fish-caught evolution bar to the next awakening on the rod card (small, in the r5 line's place), so late rods reward time fished with them. Rare and below have none (Training is the exception). Propose each epic and up rod's awakenings (how many, at how many fish, what each gives: stats, a passive, a stronger aura) for David's OK.
3. **The Training unlock:** at the 35th Flimsy-rod fish a quest starts: the rod seller asks to trade your Flimsy rod for the Training rod (the Flimsy leaves your bag). `20261102170000_rod_catches.sql` is unapplied: change it in place (no grant at the 50th; whatever the quest needs server side). The shop's ??? teaser card reads "Unique scenario required".
4. **Stats rescaled:** every rod down so epics don't max out early; legendary about 100 per stat, Divine past it (110 to 120). Each rod's numbers fit the rod (Glass's strength lower). Old and new table side by side.
5. **Passives:** rare and up have one (a few may have none); a line for it on the rod card, empty for rods without. Propose one per rare and up rod, in the six stats' vocabulary or plain rules.
6. **Prices:** higher, priced against what a player earns per hour fishing at each stage; show the reasoning in a line. Never the gem-to-money rate.
7. **Rod box UI:** remove the left and right arrows on the rod box and the "all" arrow; any left and right arrows that must stay become very faint, small and light. Say which ones stayed.
8. **The roster:** Riptide (rare, crafted), Titanium (epic, crafted) and Tempest (epic, a quest or event) join with stats in the new scale and recipes. Their models are being redone from David's references on the tool-pipeline lane with the same file names; wire the current ones.
9. Evidence ids `rg6-*`: the rod cards (Training before and after an awakening, an epic with its bar, a rare with its passive), the awakening reveal as a strip, the shop with the teaser, the quest talk, the rescaled table, desktop and phone.

## Round 5: David's rod data review (2026-11-03, verbatim; https://claude.ai/artifact/LNrapLgneyk16D14xRTVsi)

- rg4-unlock (approve)
- rg4-training (no mark): "the ui needs fixing, you dont need a whole bar to say " (the note stops there)

Build: the Training rod's level and progress move into the rod card as one small line or ring next to the stats, not a full-width bar; the same for the Fish caught line if it takes a bar too. Wire the tool-pipeline lane's new model files (`rod-carrot.glb`, `rod-precision.glb`, `rod-training.glb`, in game/tool-pipeline) in place of the stand-ins and mount `RodAura` in the shop's RodStage (see tool-pipeline's lane file). Shots of the cards before and after (ids rg5-*).

## Round 4: the new rods' data, the Training rod, the catch tracker (2026-11-02)

David's rod pitch review, verbatim (https://claude.ai/artifact/XqZK2hk32ydhYjbKFhhwFJ):
- rod-carrot (approve): "make the carrot thicket, this is uncommon rod"
- rod-precision (approve)
- rod-training (approve): "this is good, but make it like a common thats like easter egg to unlock and not a common rod you can buy, this rod also has very good satts comparable to uncommon rare, one of best starter rods and it has upgrade potential. I want you to also do a fish caught tracker for all rods so yo know how many fish you caught with a certain rod. "
- rod-ours (redo): "tide warden rod not even epic bruh not cool at all, other rods are wtv, glass rod can be cooler or just make it uncomon, cedar rod should have like leaf elements"

The tool-pipeline lane (game/tool-pipeline) models the rods in parallel: `tools/rod-carrot.glb`, `rod-precision.glb`, `rod-training.glb`, plus reworked Cedar, Glass, Tidewarden, Tempest, Titanium and Riptide. Wire to those file names; until they land, use the old rod files as stand-ins and say so.

Build:
1. **Roster entries** in `web/lib/game/rods.ts` and the catalogue for Carrot (uncommon), Precision (common) and Training (common, never sold). Stats, prices and sell values in the existing economy rules. Never write the gem-to-money rate.
2. **The Training rod as an easter egg:** hidden, unlocked by doing something (propose two or three unlocks and build the one that fits the island best; server-checked), stats comparable to uncommon and rare, one of the best starter rods, with upgrade potential: use the existing tackle and upgrade systems if they fit, otherwise propose the smallest upgrade path and build it.
3. **Per-rod catch tracker:** how many fish you've caught with each rod, counted on the server at catch time, shown on the rod's card (bag and shop). A migration (timestamped after the newest on main) if the catch rows don't already record the rod; stop before prod, the coordinator applies it.
4. Glass may move to uncommon (David: "glass rod can be cooler or just make it uncomon"): wait for his pick on the next pitch, don't move it yet.

## Status

- Round 1 (94eade9f, e35dd842): rarity ladder (cb7bed43, on main), five rods with six stats, bait and bobber slots, the rod shop, hollow items hidden. David reviewed it 2026-10-28 (below).
- **Round 2 built** on `game/rod-gear` (main merged at 581dd5b3; the build f7adcb6a, evidence and fixes 064c59ce; gates: tsc clean, vitest 3551 passed in the new world, eslint clean on changed files, SQL smoke chain clean):
  - Rod rarity: Flimsy common, Cedar uncommon, Glass rare, Lighthouse rare, Tidewarden epic (`RodTier.rarity`, lib/game/rods.ts).
  - Hook rule: a rod hooks one rung above its own rarity (`hookCap`, `canHook`). David's three examples were rare to epic, epic to legendary and legendary to divine; the coordinator applied the same pattern down the ladder. The server rolls with the same `canHook` (peaceful.ts via lib/collections/rolls.ts), so no SQL. Nothing can hook divine until a legendary rod exists.
  - The shop shelf sells rods up to rare (`onShopShelf`, `SHOP_ROD_MAX`). Tidewarden is off the shelf; its workbench recipe stays.
  - Stats are graded out of 100 (`STAT_MAX` 100, rods x10, tackle gains x10; `effects` unchanged in effect).
  - Rarity shows as a thin outline in `--ui-rarity-*` on the shop's and the bag's rod cards and on the detail stage (`rarityEdge`, the `ItemCard`/`DetailView` prop `rarity`). Divine runs `--ui-holo`.
  - Radar rebuilt as a flat kit piece (`components/gui/flat/HexRadar.tsx`):
    - big, light, thin rings in the new `--ui-chart` token;
    - an icon and value at each corner, with the stat's name and one plain line on hover or focus;
    - the build over the rod alone (faint, dashed), sliding linearly over 450 ms.
  - Slots live only on your own rod: the bag's tools shelf opens a rod in `DetailView`, with `RodSlots` (kit `GearSlot`) in the stage's bottom-right corner (`DetailView corner`). The shop has no slots.
  - What's fitted hangs from the rod tip and settles: `RodStage` in components/economy/RodGear.tsx, through `FittedModel hang`, using `rodTip` (moved to lib/game/rodTip.ts).
  - An add-on's detail shows only the add-on (its HD model) and its own radar (`TackleRadar`).
  - HD/LP split: `Tackle.model` is the HD file; `worldModel` maps it to `/assets/game/items/lp/` (lib/game/world/active.ts). Until the real models land, both lp files are copies of the HD ones.
  - Kit: divine badge text is white (`--ui-on-divine`). `--gui-holo` is replaced by `--ui-holo`, and `--gui-rarity-divine` is now main-quest's purple. The themes carry main-quest's exact rarity block, so that merge is trivial. The other `--gui-rarity-*` tokens (the badges and tiles David approved) stay.
  - Migrations: `20261028155000_rod_tackle_slots` (re-timestamped, unapplied) and `20261029020457_catalogue_seed` (regenerated, unapplied). Both are in the chain in specs/evidence/launch-fixes/sql-smoke.sh, with the new `rod_tackle_slots_smoke.sql`. 033 and taught_tools smokes now follow the hollow tools.
  - Evidence: `specs/evidence/rod-gear/r2/` (shots.mjs makes them). The round-1 shots in `specs/evidence/rod-gear/` are the "before" set.

- **Round 4 built** on `game/rod-gear` (on 1ae98ff6; gates: tsc clean, full vitest 3744 passed + 1 load-timeout flake (shoreField, passes alone), eslint clean on changed files, SQL smoke chain clean incl. the new `rod_catches_smoke.sql`; the world_chat smoke's "the rest" assert fails on origin/main's own chain too (checked 1ae98ff6), untouched; migrations re-timestamped to 170000/170100 after tasting-book's 120000):
  - Roster (lib/game/rods.ts, weakest first): Flimsy, **Precision** (common, shop 200), Cedar, **Carrot** (uncommon, shop 550), **Training** (common, `found`, never sold), Glass, Lighthouse, Tidewarden. Tools key by rod key now (`rodByKey`, `heldRig`, `ownedRig(key, …)`); `rodByTier` is the first rod of a tool tier. `rodOf` in RodGear.tsx is gone (use `rodByKey`).
  - Stand-in art: `STAND_IN` (rods.ts) gives Precision the Flimsy's model and icon, Carrot the Cedar's, Training the Glass's (tools.ts, icons/keys.ts). When tool-pipeline's `tools/rod-precision.glb`, `rod-carrot.glb`, `rod-training.glb` and their icons land: delete the lines, then `node scripts/gen-seeds.mjs` (the sprite_urls). rods.test.ts checks every rod's model and icon file exists.
  - The Training rod (`TRAINING`): the Flimsy rod's 50th landed fish finds it (granted in collections_land, server-side; the land reply says `unlocked`, the client shows a "Found: the Training rod" card: `rodNews` in useFishingSession.ts). It trains: +5 to every stat at 25, 75 and 150 fish landed with it (`trained`, `trainingLevel`), on the server's roll and the client's reel; a level-up toasts. Base 205 total (Carrot 170, Glass 230), fully trained 295 (Lighthouse 300). Off sale (`FOUND_ONLY` in RETIRED); the shop shows it only to its finder, pill "Found".
  - Catch tracker: `catch_rolls.rod_key` + `rod_catches` (owner-read RLS, written only by collections_land). Shown on the bag's and the shop's rod cards ("37 fish caught", "Owned · 37 fish") and the rod details' specs (Fish caught, Training level). `InventoryView.catches`, `ShopView.catches`, `rodCatches()` on both stores.
  - Migrations (unapplied, stop for the coordinator): `20261102170000_rod_catches.sql`, `20261102170100_catalogue_seed.sql` (the three rods' rows and icons). Both in the sql-smoke chain (with main's 20261101230000_profile_pronouns, which was missing from it). Apply the migration before the code deploys: the new `collections_cast` takes `p_rod` (old 4-arg calls still work).
  - Evidence: `specs/evidence/rod-gear/r4/` (shots.mjs makes them).

- **Round 5 built** on `game/rod-gear` (origin/main b56f3c36 and game/tool-pipeline merged; gates: tsc clean, full vitest 3765 passed + the known shoreField timeout flake (passes alone), eslint clean on changed files, SQL smoke chain clean except the world_chat "the rest" assert that fails on origin/main too):
  - The rod card's record is one small line under the title (`RodRecord`, RodGear.tsx): "31 fish caught", and on the Training rod a small ring of the way to its next level with "Level 1 of 3 · 31 fish caught" (hover: fish to the next). The full-width specs strip (`rodFacts`) is gone from the shop's and the bag's rod details. The shop's rod radar is 340 wide so the column fits.
  - `STAND_IN` deleted (rods.ts, tools.ts, icons/keys.ts, wallet/service.ts, rods.test.ts): Precision, Carrot and Training use `tools/rod-precision|carrot|training.glb` and their own icons. The seed `20261102170100_catalogue_seed.sql` is regenerated (three sprite_urls), still unapplied, same name.
  - `RodAura` mounts in `FittedModel` (components/economy/ItemViewer.tsx), which the shop's detail and the bag's `RodStage` both use: a rod whose GLB names a `rodFx` wears its effect there; such a rod fits 22% smaller to leave the aura room. Only Tidewarden (rod-5) has an effect among the roster's eight; Riptide, Tempest and Titanium (models and effects landed) are not in the roster yet.
  - Dev harness: `/dev/economy?view=bag&tide=1` puts a Tidewarden rod in the bag.
  - Evidence: `specs/evidence/rod-gear/r5/` (`rg5-before-*` are the round-4 shots, `rg5-*` after; shots.mjs makes them).

- **Round 6 built** on `game/rod-gear` (origin/main 18362223 merged; gates: tsc clean, full vitest 3787 passed + 1 real failure fixed after (toolWheel.test.ts, the Training rod now tier 1; passes alone), no load timeouts, eslint clean on changed files, SQL smoke chain clean except the known world_chat "the rest" assert):
  - **No levels.** `trained`, `trainingLevel`, `toNextLevel`, `TRAINING.levels/step/unlock` and the level ring are deleted. `awakened(rod, catches)` (rods.ts): a rod's `awakenings` (`at`, `base`, `looks`, optional `hooks` and `passive`) replace its stats as it lands fish. `RodTier` gains `hooks`, `passive`, `awakenings`, `stage`; `canHook` reads `hooks`.
  - Training: about the Flimsy's stats (12 each), hooks up to rare; awakens at 50, 250, 1000 to rare (36 to 38), epic (56 to 62), legendary (94 to 100, hooks divine, passive Seasoned) stats. Secret (`secretAwakenings`): its card shows only its fish count; the landing fish pops the reward card "Awakened!" in the new rung's outline (`rodNews`, `tsi:gift` now takes `rarity`).
  - Epics (Titanium, Tidewarden, Tempest) awaken in the open: +6 every stat at 200 fish, +12 at 800 (Tidewarden's second also widens its passive). **Proposed, built, awaiting David's OK.** The card shows a 64 px bar "120 / 200 fish to awaken". A stronger aura per awakening is proposed only (RodAura takes no strength yet).
  - Passives (rare and up, `inPlay`): Glass Sunlit (+10 control, sunny), Riptide Current (+10 reel, sea), Lighthouse Beacon (+10 luck, 8 pm to 6 am), Titanium Steel line (+10 strength, river and pond), Tidewarden Tide keeper (+10 strength, sea), Tempest Storm born (+10 reel and luck, rain). Applied on the server's roll (rolls.ts fishRoll) and the client's reel (useFishingSession). The card's passive line is kept (empty) on rods without one.
  - Rescale: `STAT_MAX` 120 (the radar's ring and the cap). Table: `specs/evidence/rod-gear/r6/rg6-table.png`. Glass's strength 16 is its weakest stat.
  - The Training trade: at the Flimsy's 35th fish a toast and the tracker's quest "The rod seller" (`trainingQuest`, DefaultIslandWorld's quests); E at the tackle counter opens `RodSellerTalk` (components/game) instead of the counter; "Trade the Flimsy rod" calls POST /api/economy/rod-trade, `rod_training_trade` (owning the Training rod retires the Flimsy everywhere: `ownsRod` in rods.ts, tools.ts `ownsTool`, the shop shelf). Store method `tradeForTraining` on both economy stores and transports; error `not_ready`.
  - Shop: a found rod you lack shows as a teaser card (service.ts `TEASER`: "???", "Unique scenario required", silhouette via the kit's `not-found` cover, not clickable; no ref or slug sent). Tempest is found-only and epic, so off the shelf.
  - Rod box: `DetailView quiet` (kit): All without its arrow; previous and next as faint 16 px chevrons at the stage's sides (stayed, for paging). Used by the shop's rod detail and the bag's rod detail.
  - Prices by hours of fishing (about 80 fish an hour: 1,000 coins an hour on a common, 1,250 uncommon, 1,900 rare): Precision 1,000 (was 200), Cedar 2,500 (400), Carrot 3,000 (550), Glass 6,000 (1,200); nominal: Riptide 6,500, Lighthouse 8,000 (3,000), Titanium 14,000, Tidewarden 16,000 (6,000), Training 2,500 (900), Tempest 16,000.
  - Roster: Riptide (rare, tier 3, crafted: wood 6, iron 2, whelk 2, mahi-mahi 1), Titanium (epic, tier 5, crafted: iron 8, gold 2, crystal 2, sturgeon 1), Tempest (epic, tier 5, found, catalogue row 1004, FOUND_ONLY). Current models wired by name (`tools/rod-riptide|titanium|tempest.glb`, their icons and rodFx).
  - Migrations (unapplied, same names and order): `20261102170000_rod_catches.sql` (no grant in collections_land; new `rod_training_trade(uuid)`, service role only) and `20261102170100_catalogue_seed.sql` (regenerated: prices, Tempest, Training copy, and now a crafting block for the two crafted rods). Smoke: `rod_catches_smoke.sql` section 2 tests the trade.
  - Evidence: `specs/evidence/rod-gear/r6/` (shots.mjs makes them).

- **Round 7 built** on `game/rod-gear` (on 5d8d975f; gates: tsc clean, full vitest 3790 passed + 4 skipped with and without `NEXT_PUBLIC_GAME_WORLD=new` (toolWheel.test.ts passes), eslint clean on changed files; the SQL smoke chain not rerun: the seed's only change is the Training rod's description):
  - **The awakening cutscene (pitch, not wired in game):** kit piece `Awakening` (components/gui/flat/moments.tsx, `AWAKEN_MS` frame 900, glow 1100, pulse 2600, burst 650, then the reveal; `ready` holds it until the model loads; on /lab/gui?only=awakening) and `RodAwakening` (components/game): the rod's model large and turning over `--ui-scrim-deep`, white and glowing (CSS filter on the canvas), pulsing between its old and new look faster and faster, a white flash with rays and sparks (`--ui-glow`), then the new look in its rung's ring with a card (Awakened!, the rung's pill, what changed, a new passive, the radar sliding from the old shape, `RodRadar from`). Sounds: blip3 rising on each beat, bite-legendary at the burst, confirm at the reveal. The improved design is a stand-in recolour per awakening (`FINISH` in RodAwakening.tsx, by material) until awakened models exist. Harness `/dev/economy?view=awakening&rod=<key>&stage=<n>`. The land still shows the reward card ("Awakened!", rodNews); to wire it after David's OK: rodNews dispatches the rod and stage, a host in DefaultIslandWorld mounts RodAwakening, and the gift card goes.
  - **Awakenings per rod** (rods.ts, proposed): Training unchanged (50, 250, 1000); Titanium one at 400 (+14 line, +6 control, +4 reel); Tidewarden two at 300 (+8 bite, +6 luck, +4 line) and 1200 (+16 bite, +12 luck, +4 line, +8 lure, +6 reel, passive adds +10 luck in the sea); Tempest two at 150 (+8 reel, +6 lure) and 600 (+16 reel, +6 lure, +10 luck, +6 control, passive also on cloud). `epicAwakenings` and `plus` are gone (`up(stats, gains)`). Table: `specs/evidence/rod-gear/r7/rg7-table.png`.
  - **Rarity follows the awakening:** `awakened()` sets `rarity` to the awakening's `looks`; the shop's and the bag's rod cards and boxes take their outline from it (rodLine says "Rare rod" too).
  - **Gary:** `ROD_SELLER` (rods.ts) in the talk's speaker, the quest ("Gary wants a word", "Talk to Gary at the tackle shop"), the toast, the trade card's note and the counter's prompt while the quest is on ("Talk to Gary").
  - **The ask** no longer says nobody sells it; Gary's thanks hints at the potential ("It doesn't look like much yet, but it has potential. The more you fish with it, the more it grows."), and so does the Training rod's description (catalogue, so the unapplied seed `20261102170100_catalogue_seed.sql` is regenerated in place, same name). Talk lines go through `KeywordLine`.
  - **Rod box:** `DetailView quiet` has no back on the stage (no "All"); the rail goes back (the bag's rail now does too: `visit` in BagSheet). The faint chevrons stay.
  - Evidence: `specs/evidence/rod-gear/r7/` (shots.mjs makes them; clips by CDP screencast, since Playwright's recordVideo wants its own ffmpeg build).

- **Round 8 built** on `game/rod-gear` (on c56e45356; gates at the end of the round: tsc clean, full vitest 3801 passed + 4 skipped in the new world (3 heldMesh failures from the packed GLBs fixed and rerun), eslint clean on changed files, perf:check v2 passed (high 5.10 ms, lite 3.10 ms, draws 356 and 281) before the additions; the cutscene isn't a bench scene, its clip frame times are swiftshader's):
  - **The cutscene redone** (kit `Awakening`, components/gui/flat/moments.tsx and moments.module.css): no ring, halo, rays or sparks (the sparks drew a ring as they set off). The glow is on the thing itself: stacked `drop-shadow`s on `.awThing` in `--glow`, which is `--from` (the rung it had, new prop `from`) until the burst, then `--edge` (the new rung). The burst flares that glow and tints the whole screen in the new rung's colour at a third (no shape, no edge; never white). New beat `show` (1900 ms) after the burst: the new form plays its motion alone; at the `reveal` it steps aside, keeps a faint edge in its rung's colour, and the card comes in. `AWAKEN_CARD_MS` (900): the radar grows only then (RodAwakening). `thing(after, phase)` now gets the phase. Phone reveal: the stage at translateY(-52%) scale(0.55), clear of the card.
  - **The hard edge was the canvas:** R3F measured the stage's canvas through the `.awThing` scale(0.72) transform, so the canvas was 72% of its box, top-left (the rod sat high and left, its glow cut by the canvas edge). `TurnStage` now sizes by layout (`resize={{ offsetSize: true }}`), and the thing's box is `AWAKEN_ROOM` (1.6) times the stage with the camera pulled back to match, so the motion and the glow never reach an edge.
  - **Each rod its own motion** (components/game/rodMotion.ts, pure, tested): Training lifts and twirls; Titanium rises level with a band of light (a point light, always mounted, dark when unused) running up its steel; Tidewarden rides a swell (bob, roll lagging, drift); Tempest whips in gusts with a shake and lightning flashes on it. `BEAT` sets each phase's energy, inner glow and aura gain; `Motion` in RodAwakening.tsx eases to them and lights the rod's own materials from within (emissive) in the glow's colour, read from the theme tokens on the client.
  - **The aura's strength setting** (approved pick): `RodAura strength` (default 1, eased per holder): spins and bobs faster and further, swelling parts grow (the Tidewarden's pearl, the Tempest's tornado), halos grow, sparks come more often. `FittedModel aura` passes it. The cutscene uses `auraAt(look)` (1 + 0.5 per awakening) plus the beat's gain. Not used in the world yet (a held rod's stage isn't known there): asked on the questions card.
  - The table is on the questions card (`rg8-questions.png`), numbers unchanged.
  - Evidence: `specs/evidence/rod-gear/r8/` (shots.mjs makes them; CLIP= and ONLY=clips,table). Clip frame times are swiftshader's and mean nothing for a GPU.

- **Round 8 additions built** (David's rod models notes, above; game/tool-pipeline's rm3 Cedar merged first at a0b49bd33):
  - **The effects library** (`specs/fx-library.md`, the standard): types, parameters and what grows with strength in `web/lib/game/fx/library.ts` (`FX`, `fxAt`, `fxGrow`; tested); Blender templates in `art/pipeline/fx_library.py` (`part`, `glow`, `light`, `aura_hug`, `trail`, `particles`; `model`, `export` moved there from build_rods.py, which imports them); the code types in `web/lib/game/fx/glowOn.ts` (`glowOn`, `sparkRecipe`); RodAura reads the library's growth and draws **trails** (a `trail` and `trailFrom` extra on a part: a fading additive ribbon, one draw; RodAura.test counts trails in the five draws). Previews at `/lab/fx` (each type on a stand-in rod, strength 1 and 2.5; samples `props/fxlib-<type>.glb` from `fx_library.py -- samples`). The awakening uses it (glowOn, sparks at the burst, the burst's peak). No halos in the library; `halo()` stays only for the Tidewarden and the Titanium (made before it).
  - **Cedar** (`cedar()`, `whorl()`): twelve close layers of 4-triangle sprays (8 down to 3 a layer, 74 sprays) in two greens (`Leaf`, new `Fresh` lighter; the upper half lighter), shallow notches so each layer reads full; the hidden band dropped and the other band now Grip. 597 tris, 5 materials.
  - **Tempest** (`tempest()`), against epic-tempest-ref.png: a chain of nine hexagonal icy links, each a quarter turn from the last, leaning with a bolt's zigzag; a crystal spike, jagged ice shards, white reel with a dark hub, black grip in white rings (600 tris, 4 materials). Effect, no discs: `Bolts` (lightning down both sides of the chain with forks, the shards' charge and the butt cap; flicker), `Spark` (the tip's four-point spark; pulse), `Gust` (a wisp of wind winding up the chain; spin, bob, trail), `Aura` (aura_hug along the chain); particles. The tornado and both halos are gone. Icon re-rendered.
  - GLBs packed (`node scripts/pack-glbs.mjs <files>`; it needs the file list). RodAura.test now decodes meshopt.
  - Tidewarden and Riptide: no references on file; unchanged.

- **Round 9 built** (on 7106dbe5f; the build d308bad83, evidence after; gates: tsc clean, full vitest in the new world 3801 passed + 4 skipped + 1 failure (budget.test: the lab-only study GLB over the effect budget) fixed by an ASSET_EXCEPTIONS entry, budget.test then 13/13, eslint clean on changed files, perf:check v2 with the Tidewarden held passed (high 5.10 ms, 361 draws; lite 3.00 ms, 286)):
  - **The Water type** (`water` in lib/game/fx/library.ts, specs/fx-library.md): lib/game/fx/water.ts, three shaders picked by material name (RodAura `WATER_PART`): `Water` (the body: the reference's palette, dark streaks leaning up the water with pale lines, lighter edges, bubbles, all running; foam breaking along both edges with a cyan inner edge; a ragged outline), `Foam` (depth into the foam eaten and re-grown by noise, tongues swaying, a crown that breaks into blobs and re-forms), `Spray` (quads facing you, flying out from the axis and falling). Flat colours, hard edges, one draw each; each holder its own material copy (`waterAt`, its strength). Grows with strength: flow, foam, `wrap` (the grown water, gated per vertex, shows: the Tidewarden's wrap three more turns down the shaft by 2.5), `splashes` (the foam's hold and the drops made to come with strength).
  - **Templates** (art/pipeline/fx_library.py): `water` (rings, uv across and along, a gate per ring, `cut` strips), `foam`, `spray`, `sheet` (explicit vertices, uv and per-vertex data; v pre-flipped for the exporter). **Tracing** (art/pipeline/trace_refs.py, `python3 -I`, numpy/opencv/scipy): reads the two untracked references and writes art/pipeline/traced_refs.py (numbers only): the trident upright (its shaft fitted, 23.91 degrees), the head mask (everything drawn, closed, the left slot reopened, smoothed, eroded half a pencil line), the colour bands per prong (row labels), ear-clipped; the veins (cyan, filled shapes); the reference's frame (hand px, px per unit). The sword: the blade's rows, the foam pieces (Delaunay inside the mask, depth per vertex), the round loose drops.
  - **The study** (the Water type's sample, `props/fxlib-water.glb`, 3,782 tris, lab only): the traced blade, foam and drops plus a modelled murex shell (lit; landmarks read off the reference). `/lab/fx?study=water` and `?study=tidewarden` draw a study at its reference's size and framing (orthographic, flat); the grid's tenth card is the water (sways).
  - **The Tidewarden** (`tidewarden()` in build_rods.py, rod-5.glb): the traced head as one flat sheet (Gold, Mint, Tip), shaft 0.0072 (traced 0.0064), a teal ring and band at the butt, the star cap with its diamond cut; 332 tris, 4 materials, no reel (the tip is the middle prong's). Effect `rodfx-tidewarden.glb`, 4 draws, 1,236 tris: `Veins` (Glow, both faces), `Tide` (Water: the wrap as drawn, the streamer, a wisp, a flung drop, and the grown wrap), `Crash` (Foam), `Drops` (Spray, the drawn drops plus eight that come with strength). No pearl, halo, aura or light ribbons. `aura_shell` and `halo` stay for the Titanium (its own lane, game/rod-titanium: leave titanium() alone). Icon re-rendered.
  - The shop doesn't sell the Tidewarden (epic, crafted): shown in the bag's stage, the cutscene and in hand (same stage as the shop's detail). Asked on the card.
  - Evidence: `specs/evidence/rod-gear/r9/` (shots.mjs ONLY=study,fx,bag,awaken,cards; hand.mjs for the hand shots).

- **Round 9b** (the coordinator's review of round 9, before David sees it; f8d57a92b and after):
  - History: the two composites holding David's references were never committed (210e98f2a and 448bef875 rewritten from d308bad83 into c0a37700a); composites are `*-vs-ref.*`, ignored by `.gitignore` (`specs/evidence/**/*-vs-ref.*`), kept on disk for the review page.
  - The head a real 3D relief: trace_refs.py smooths the outline (contour Gaussian, simplified), opens the two cut-outs to their drawn size (centres read off the sketch), triangulates with the medial axis (conforming Delaunay), and gives each vertex a depth, a ridge flag and a colour band; build_rods.py raises it to a ridge (HALF 0.0058, BEVEL 16 px) on both faces meeting at a fine edge. Its colour runs in its vertices (one white Gold material): gold, each prong's tip fading through mint into blue. The whole rod has one sheen (roughness 0.45, metal 0.35; heldMesh merges on these, so it stays one draw in hand). 560 tris, 3 materials (Gold, Shaft, Teal).
  - Stylised for game size: the head 1.2x the sketch's (the tip where it was, the shaft shorter), the shaft 0.0095 (traced 0.0064), and the head turned a quarter about the shaft to face the holder's side (in hand you see its face; `/lab/fx?study=tidewarden` turns it back with `face`).
  - Veins as cracks: the sketch's teal (paler strokes counted on the gold) thinned and traced into branching polylines (spurs pruned), ribbons lying on the relief, both faces.
  - The wrap a ribbon square to its run (one turn, 0.022 wide), foam flecks on it, a longer drooping streamer; effect 4 draws, 984 tris.
  - FittedModel (components/economy/ItemViewer.tsx): an effect rod's GLB may say how much room its effect needs (`fxRoom` scene extra, default 22%); the Tidewarden's is 4%, so it fills the bag's stage as the Cedar does.
  - The cutscene's stand-in tints (FINISH) now tint Gold (white, over the vertex colours) and Shaft.
  - Gates: tsc clean; full vitest 3802 passed + 4 skipped both with and without NEXT_PUBLIC_GAME_WORLD=new (budget.test and heldMesh.test included; heldMesh failed once on two look keys, fixed by the one sheen); eslint clean on changed files; perf:check v2 with the Tidewarden held FAILED on frame time only (high 5.50 ms +14.6%, lite 3.20 ms +10.3%; draws 359 and 286, flat; load 6.1 to 6.2, swap over 10 GB), not rerun.

- **Round 10 built** (David's rods 8 review, above; on 03988b28c; the build fe29dc271, fixes and evidence b23f1b3a2 and after):
  - **The table** (rods.ts `AWAKEN_AT` 600): Titanium, Tidewarden and Tempest awaken once each at 600. The Tidewarden's and the Tempest's one awakening gives what their two gave (the Tidewarden +16 bite, +12 luck, +4 line, +8 lure, +6 reel and its wider passive; the Tempest +16 reel, +6 lure, +10 luck, +6 control and the storm on cloud). The Titanium's row changed only its threshold (400 to 600). The harness needs no change (`stage=1` only for those three); FINISH keeps one look each.
  - **The effects library on any holder** (components/game/fx/HolderFx.tsx, lib/game/fx/holder.ts, tested): reads only a holder's shape (64 surface points and normals, its long axis, its size), at most four draws: a glow shell, an aura shell, one particle pool in the world (`HolderPool`, 320, registered in budget.ts; the regex there now reads `HolderPool(` too), a swept trail (the weapon trail's shader). Every type animates: glow (rim light, a band running up it, breathing), aura (a shell whose edge licks upward, cel tongues, its colour's flame tongues rising), particles, trail, pulse (lub-dub), motion (comets spiralling up), flicker, sparks, burst. New types: electricity (bolts crawling between surface points 16 times a second, arcs out), embers (fire sparks in pulses), flame, petals (sakura), gather (light drawn in), sway (below). Strikes: lightning and a wave (`throwStrike`). Its pack: `fxlib-pack.webp` (`build_pack.py fxlib`: the combat pack's mote, sparkBurst, flare, bolt, flame, wave, droplet rows cut out, a sakura petal painted as heat; `FXLIB_PACK` in fxMaterial.ts, firePack.test checks it). The old GLB samples (fxlib-glow ... fxlib-flicker) and their builders are deleted; only fxlib-water stays.
  - **/lab/fx** one type at a time: `?type=<kind>` (a plain rod and the iron sword swaying as a hand moves them), `?type=sway` (the Cedar swung and stopped), `?type=lightning|wave` (the strikes every 3.2 s); the index lists them. The grid and fx.module.css are gone.
  - **The awakening, juicier** (kit `Awakening`, moments.tsx and .module.css; RodAwakening; rodMotion `BEAT`, `AWAKEN_FX`): `AWAKEN_MS` frame 900, glow 1300, pulse 2800, **hush 500**, burst 700, show 1900. Suspense: a second scrim deepening through the pulse (darkest in the hush), the stage pushing in, the rod trembling harder (`BEAT.shake`), light gathering in (`BEAT.gather`, HolderFx gather in the old rung's colour), flashing up on each beat; the hush holds the old form, dim and still, the lead gone. The hit: **impact frames** (210 ms: the screen in the new rung's colour with the rod a dark cut-out, then dark with the rod lit in that colour through a multiply tint, then the colour again; never white), the stage shakes, the flare and the screen tint. Sounds (synthesised, art/audio/synth_awaken.py, `AW_SFX` in audio.ts, SOURCES.md and MANIFEST.md): `aw-riser` under glow and pulse (cut dead at the hush), `aw-heart` on each beat, `aw-impact` at the burst, the strike's sound. **Strikes** (`AWAKEN_FX`): the Tempest is struck by lightning (thunder) and wears electricity after; the Tidewarden takes a wave (its sound rushes in over the hush and crashes on the hit) and its water grows as before. Training: no strike (its awakenings are finishes). Titanium: none here (its lane wires its model; an `AWAKEN_FX.rod_titanium` entry adds one).
  - **Cedar** (`cedar()` in build_rods.py): eighteen layers from just above the grip (z 0.11) to the tip, each with a short inner layer, two greens; the foliage is now the rod's effect `rodfx-cedar.glb` (772 tris, one node, two materials, `sway` 1.0) and the rod is 301 tris, 3 materials. **Sway** (RodAura): soft parts get a per-holder copy of their lit materials bent in the vertex shader by a spring (`fxAt("sway", ...)`: stiffness 38, damping 5) driven by the foliage middle's acceleration in the rod's space, more the further a vertex reaches from the axis, plus a breeze. /lab/icons now adds a rod effect's sway parts to its picture (the Cedar's leaves are its design).
  - **The Tempest's aura in hand** (rg8-tempest-hand): the root cause was every effect shader writing `gl_Position` itself, so it never took the curved world's bend (curvedWorld.ts patches `project_vertex`) while the rod it hugs did: the aura floated off the rod in the world, not in the shop or the cutscene. RodAura's aura, the Water type's three shaders and HolderFx's shells now go through `#include <project_vertex>`. The Tempest's model waits for David's new reference (not remodelled).
  - Gates: tsc clean; full vitest 3810 passed + 4 skipped both with and without NEXT_PUBLIC_GAME_WORLD=new; eslint clean on changed files; perf:check v2 with the Cedar held (SKIP_BUILD after measure-build.sh under the heavy lock, HELD_ROD=rod-2.glb, 3 runs, load 3.7) passed: high 4.70 ms, 356 draws; lite 2.80 ms, 281 (specs/perf/effects-cost.md).
  - Evidence `specs/evidence/rod-gear/r10/` (shots.mjs: ONLY=clips,impact,fx,cards; FX=, CLIP=; on the GPU, ANGLE Metal, headless): the awakening clips (Training, Tempest struck by lightning, Tidewarden hit by a wave, the Tempest on a phone) each with a poster, a beat strip and an impact strip; `rg10-impact-frames-*` the impact states as drawn; `rg10-fx-<kind>.mp4` and posters for all 18 (16 types and 2 strikes); `rg10-questions.png` with the new table; `rg10-tempest-hand.webp` (before, after at night and by day); `rg10-cedar-hand.webp`, `rg10-cedar-old-new.webp` (icons old and new, the new model's views); the sway clip is `rg10-fx-sway.mp4`.

- **Round 11 built** (David's rods 9 and 10 reviews, above; on 2c92a6093):
  - **Merged game/rod-titanium at 18cb82788** (c93fc8056, the coordinator's OK): the per-awakening model wiring (rods.ts `Awakening.model`, `awakenedLook`; itemModel `rodSpec`; the wheel's `WheelItem.model`; the bag's icon and stage; the manifest's `<rod>_a<n>` icons). Kept this lane's table (the Titanium at `AWAKEN_AT` 600; rod-titanium's tests moved from 400), AWAKEN_FX and the fx-library spec lines; took theirs for the Titanium's model, effect, icon. The Titanium's look is round 1's; rod-titanium round 2 will merge again.
  - **Tidewarden** (`tidewarden(woke=False)` in build_rods.py, rod-5.glb 598 tris, 3 materials): a gold spool on a gold stem with a teal crank and knob, built toward -Y then turned a quarter back so the rod's final quarter turn leaves it at the front; a teal line up the shaft and onto the middle prong's face to its tip. Leaner to fit 600: the shaft 5 sides, the butt ring 5 segments, the teal band 7 points. The base effect is the veins only (no water: David's "have the rod not have the wave wrapped aound").
  - **Bobbers 0.7 smaller everywhere:** build_bobber.py `SCALE` 0.7 (about 0.12 across; the eye 0.0826, FishingRig `EYE`; `FLOAT` 0.0245 in fishingRig.ts), and the bag's hanging tackle (RodGear `SIZE` bobber 0.09, bait 0.07).
  - **The awakened Tidewarden** (`tidewarden-a1`: rod-tidewarden-a1.glb 598 tris, rodfx-tidewarden-a1.glb 4 draws 1,412 tris): the head 1.55 long (1.2 wide) and lit (its mint and blue reaching further up, brighter gold), a glowing rim round the head's outline and brighter veins (one Glow); water: two ribbons wound against each other down the whole shaft, swelling in and out, a crest curling off under the head (one `Tide` node spinning about the shaft, 1.1 rad/s), foam on the crest and the wrap's top, drops flung all down it and dripping off the prongs (Spray), motes dripping (`particles`, rise -0.35). The wrap is gated down the shaft (0 at the head to 0.3), so it shows only from strength 1 and runs to the grip by 1.45; the effect GLB's scene extra `fxStrength` 1.5 (new in RodAura: the strength it is drawn at as made, times the holder's) shows all of it in a hand or the bag.
  - **Its awakening:** the wave strike is gone (AWAKEN_FX `strike` optional; `strength(phase, beat)` per rod). The new form's water: 0.6 before the pulse (none), a little further down on every up beat of the pulse (1 + 0.012 a beat), drawn off in the hush (its rushing sound), 1.8 on the hit (it winds all the way round within about half a second), 2.3 while it shows, 1.5 at the reveal (divided by `TIDE_MADE`).
  - **Training's awakening:** `gatherAt(phase, beat)` (rodMotion): the gather a trickle through the glow (0.15) and building on every beat of the pulse (0.3 + 0.12 a beat, about 3 by the last), none in the hush while the last of it arrives. The impact frames (kit, moments.module.css) burst out of the rod: rays in the new rung's colour out from it, then dark with it lit, then the colour with a ring round it; each held 5 frames and 80 ms (160 at most); a shockwave ring runs out from the stage after them. A gather that also grows its motes' size and speed with strength is asked of vfx-library (via the coordinator).
  - **The awakened Tempest** (`tempest_a1()`: rod-tempest-a1.glb 542 tris, 5 materials; rodfx-tempest-a1.glb 4 draws 510 tris): seven bolder links zigzagging harder, a crown of three forked ice spikes, a storm cloud for a reel, two long shards, a navy grip; its effect the Tempest's, stronger (bolts forking at every other link, a five-point crown spark, a bigger gust, a deeper aura, more sparks). The strike and the electricity after stay. The base Tempest waits for David's reference.
  - Both awakenings now have models (rods.ts `model`), so RodAwakening's FINISH keeps only the Training rod's stand-in finishes.
  - Gates: tsc clean; full vitest 3822 passed + 4 skipped both with and without NEXT_PUBLIC_GAME_WORLD=new; eslint clean on changed files; perf:check v2 with the awakened Tidewarden held (HELD_ROD=rod-tidewarden-a1.glb, SKIP_BUILD after measure-build.sh, load 7.4 to 8) passed: high 5.00 ms, 358 draws; lite 3.00 ms, 286 (specs/perf/effects-cost.md).
  - Evidence `specs/evidence/rod-gear/r11/` (shots.mjs, on the GPU, headless): the awakening clips (Training, the Tidewarden, the Tempest; the Tidewarden on a phone) each with a poster, a beat strip and an impact strip; `rg11-impact-frames-training.png` the three impact states as drawn; `rg11-tidewarden-turn.mp4` and `-bag.png` (the reel and line), `rg11-tidewarden-a1-turn.mp4` and `-bag.png` (awakened, in the bag); `rg11-bobbers.png` (round 9's bag shot and now); `rg11-tempest-a1.png` (Blender views and the cutscene's show); `rg11-questions.png`; `rg11-tidewarden-vs-ref.png` untracked (the sketch, the rod and the awakened rod).

## David's decisions

- 2026-10-28 review (verbatim in the coordinator's round-2 prompt): rarity outline on shop cards (common grey, uncommon green, rare blue, epic purple, legendary yellow, divine purple holo); shop sells up to rare rods; hook caps by rod rarity; Flimsy common, Lighthouse rare; divine text white; gui-tiles approved; radar redone (bigger, minimal, lighter, icons with hover lines at the corners, out of 100, the base faint behind the build, linear slide); bait and bobber slots bottom-right of your own rod's square only, fitted ones show on the rod model with a settle; the bobber's detail shows only the bobber with its own radar; bobber and bait to be remodelled properly in Blender (HD for the shop, LP on the rod; the lucky bobber a four-leaf clover), **waiting on David's references** (coordinator asked him).

## Next

0. David reviews `specs/evidence/rod-gear/r11/` (round 11); his notes come back as round 12. game/rod-titanium round 2 merges into this branch again (keep this lane's table, AWAKEN_FX and its spec lines; theirs for the Titanium's files).
0b. If vfx-library grows the Gather type's mote size and speed with strength (asked via the coordinator), Training's ramp (`gatherAt`) picks it up with no change here.
1. Coordinator: apply `20261102170000_rod_catches` then `20261102170100_catalogue_seed` (before the code deploys).
2. On David's OK of the cutscene: wire RodAwakening in place of the "Awakened!" card (rodNews dispatches the rod and stage, a host in DefaultIslandWorld mounts RodAwakening, the gift card goes).
3. If David says yes on the card: a held rod wears its awakened effect in the world (`RodAura strength = auraAt(stage)` and the `AWAKEN_FX` wears through HolderFx; Character.tsx needs the rod's stage).
4. The Tempest's base model when David's new reference lands (keep its effect GLB names); its awakened model (`tempest_a1`) is round 11's. Titanium: game/rod-titanium owns its model, effect, icon and awakened model; a strike for it is one `AWAKEN_FX.rod_titanium` entry (asked on the card).
5. Glass to uncommon only on David's pick. Riptide waits for a reference. Bobber and bait models wait for references.

## Tools and gotchas

- Round 11: `Blender ... build_rods.py -- only tidewarden,tidewarden-a1,tempest-a1 [render <dir>]` then pack those six GLBs; `build_bobber.py` (SCALE 0.7) then pack. Blender's renders draw the Water type as a flat dark green stand-in: judge water in the game (the bag `?view=bag&tide=1&tdc=600` shows the awakened Tidewarden). Icons: `BASE=... node scripts/render-icons.mjs rod_tidewarden rod_tidewarden_a1 rod_tempest_a1` (the manifest makes `<rod>_a<n>` from rods.ts `model`). Evidence: `specs/evidence/rod-gear/r11/shots.mjs` (ONLY=clips,impact,bag,cards; CLIP=).
- The rod's line and reel on the Tidewarden: its geometry is turned a quarter about Z at the end (the head faces the holder's side), so anything that must end toward -Y is built toward -Y and turned back a quarter first (verts and `pc.ref`). The Tool budget is tight (598/600): the reel is a bare lathe, not `reel()`.
- An effect whose water is gated to wind on (`gate` > 0) shows none of it at strength 1: give its scene `fxStrength` (RodAura multiplies it in) so a hand and the bag draw it whole.
- The Tidewarden's icon is drawn edge-on (the diagonal view sees the head's edge since round 9b's quarter turn); unchanged this round.
- Round 10: `/lab/fx?type=<kind>` (one type at a time), `?type=sway`, `?type=lightning|wave`; `art/fx/build_pack.py fxlib` rebuilds the library pack; `art/audio/synth_awaken.py <wav dir>` then ffmpeg for the `aw-*` sounds. Clips on the GPU (`--use-angle=metal --ignore-gpu-blocklist`, headless): swiftshader drew the cutscene at about 2 fps, so its beats and impact frames never showed. shots.mjs reads the beats off the page (`data-phase`) and finds the impact frames by the clip's brightness.
- A custom ShaderMaterial on anything in the world must go through `#include <project_vertex>` (with `vec3 transformed`), or it floats off its holder by the curved world's bend.
- HolderFx registers a kind's ramp row at mount (`rowOf`, which flags the ramp texture): a row added after the first upload draws black. Its pool mesh stays visible with no instances so its shader compiles at mount.
- The kit's impact frames are React state stepped by painted frames (`IMPACT_FRAMES`, at least 60 ms, at most 140 ms each), never CSS keyframes (an `animation` with `both` holds its values over later rules: the lead never hid until `animation: none`).
- The dev-shoot wrapper (scratchpad `devshoot.sh`): starts `next dev -p 3490` with Supabase blanked, waits for it, runs one command, kills only its own PIDs; inside one `withlock.sh devserver` call.

- Round 9: `python3 -I art/pipeline/trace_refs.py` after any change to the tracing (it rewrites traced_refs.py; the references stay untracked, never `git add` specs/references/rods/). Then `Blender ... build_rods.py -- only tidewarden [render <dir>]` and `fx_library.py -- samples water` (`samples a,b` builds only those), then pack those GLBs.
- Studies: `/lab/fx?study=water|tidewarden&k=<n>`, orthographic at the reference's own px per unit (R3F looks at the origin unless the camera is re-aimed in onCreated). Compare with `magick <ref> <ours> +append`.
- A dev-shoot wrapper that starts the dev server, runs one command and stops it, all inside one `withlock.sh devserver` call, avoids sleep holds; pass absolute paths to it (it cd's into web).
- Blender's glTF export keeps a FLOAT_COLOR point attribute as data (COLOR_0, vec4) and flips uv v: `sheet` pre-flips. Three's ShaderMaterial with `vertexColors` declares `color` vec3 or vec4 (USE_COLOR_ALPHA): read it as `vec3(color)`.
- three.Triangle.containsPoint says yes for a degenerate (edge-on) triangle: test coverage in 2D with care.

- Locks are contended: there is no queue file (the coordinator removed it); retry `withlock.sh heavy|devserver` in a loop while it exits 75, and keep each hold to one short batch.
- `node scripts/gen-seeds.mjs` writes the catalogue seed migration after a catalogue change; a hand migration that widens a check must sort before it.
- Dev harness: `/dev/economy?view=overlay&section=rods` (the rod shop) and `/dev/economy?view=bag` (the bag's tools: Cedar and Glass rods, the lucky bobber on, sweet bait owned), memory store.
- Clips: Playwright's `recordVideo` needs its own ffmpeg build (not installed); r7/shots.mjs records a CDP screencast and joins it with the system ffmpeg.
- Shots: `specs/evidence/rod-gear/r2/shots.mjs` (PW=playwright index.mjs from ~/.npm/_npx, SHELL_BIN=the cached chromium_headless_shell-1217, BASE=dev server). The site's intro curtain (`.ld-overlay`) waits on window load and covers dev pages: the script hides it.
- `/dev/economy` seeds rod catches (Flimsy 50, Cedar 37, Glass 12, Training `&tc=` default 31, Tidewarden `&tdc=` default 120) and trades for the Training rod (`&found=0`: not yet, the quest is on); `?view=awaken` plays the Training rod's awakening card through `rodNews`; `?view=awakening&rod=&stage=` the cutscene pitch; `?view=trade&found=0` Gary's ask. The harness funds enough coins for the new prices.
- The SQL smoke chain re-applies the backpack migration inside backpack_smoke, which brings back the 4-arg `collections_cast`: rod_catches_smoke drops it first.
- Memory stores: `m.caught(member, rod, n)` seeds rod_catches (both the collections and the economy store).
- The vitest seed check fails until `node scripts/gen-seeds.mjs` runs after any catalogue text change; delete the lane's own unapplied seed first, and update the chain in launch-fixes/sql-smoke.sh.

- Rods: `Blender -b --factory-startup -P art/pipeline/build_rods.py -- only cedar,tempest [render <dir>]` (under `withlock.sh blender`); it exports before its budget assert, so a failed assert leaves an over-budget GLB: rebuild. Then `cd web && node scripts/pack-glbs.mjs <the files>` (with no files it does nothing). Effect samples: `fx_library.py -- samples`.
- In-hand shots: tool-pipeline's `specs/evidence/tool-pipeline/rods-r2/shoot.mjs` (HOST, CLIP=420,240,440,480, `<name>=<rod glb>@day|night@140,8,0.6`). Icons: `BASE=... node scripts/render-icons.mjs rod_tempest rod_cedar`.
- A Canvas under a CSS scale measures the scaled box: TurnStage sizes by layout (`resize offsetSize`). A TurnStage needs a sized className (its div has no size of its own).
- r8 evidence: `specs/evidence/rod-gear/r8/shots.mjs` (ONLY=clips,fx,table; CLIP= picks clips). Clip frame times are swiftshader's.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/rod-gear /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
