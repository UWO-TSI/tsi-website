# Lane: main-quest (a quest line that unlocks the island)

Worktree `.claude/worktrees/main-quest`, branch `game/main-quest`, cut from main at fdd7a901. Agent type `uwotsi-lane`. The launch date moved later; the new date isn't set yet.

Items **m1 to m6, t-next, x-lines, x-teachers** in `specs/launch/v1-gameplay.md`. Existing: chapters in `web/lib/progression/` (`chapters.ts`, `defaults.ts`, `goals`), the teachers in `web/lib/game/tools.ts` and `arrival/hq/teachers.ts`, the residents in `web/lib/content/residentRoster.ts`.

1. **The quest dropdown** (t-next): top right beside the minimap. You can read your quests, and clicking one shows the guide arrow (lane `tutorial-v2` builds the arrow; ask me to merge its commit). It shows your personal main-quest step, never the club goal.
2. **Chapters:**
   - **m1:** first catch, then donate it at the museum to a new museum resident. She explains the museum and gives 100 coins and a thank-you letter. No report to Alice. Add her to the roster with a look made from the creator's parts, and coordinate her slug with lane `npc-editor` through the coordinator.
   - **m2:** Odile's net. Catch 3 bugs. Make sure bug catching is fun (approach, swing, flee, catch feedback).
   - **m3:** Pim's shovel. Dig spots get visible marks on dirt and on sand. Teach how to find them, and let rare finds come up.
   - **m4:** Bram's rod challenge. Catch 5 different fish, one at dawn or dusk. The reward is the Cedar rod. Lane `rod-gear` owns the rods; use its ids.
   - **m5:** the museum as a club collaboration. Personal and club donation targets (10 fish species, 5 bug species and so on); the museum opens at the next launch.
   - **m6:** the pickaxe. Rocks give stone and sometimes iron. Build the new rock and ore models in Blender (headless, from primitives; see `art/remodel/` and `art/props/`).
   - Every step has a clear tracker line with a person and a place.
3. **x-lines:** resident lines that point at closed things get swapped for lines about what's open.
4. **x-teachers:** teachers stand where the quest sends you. The landmark fix is on main; the pond and the path need anchors David places in `/lab/map`, so say which ones.

**Read first:** `specs/launch/v1-gameplay.md` (David's notes verbatim, your items), `CODEMAP.md` rows for your area, and the files named below. Search before building; most systems exist.

**Shared pieces, one owner each:**
- the guide arrow (`tutorial-v2` builds it first and reports);
- the quest dropdown and tracker (`main-quest`);
- the rarity ladder (`rod-gear`).

Others use these once they land. Ask the coordinator to merge the owner's commit into your branch, and don't build a second copy.

**Migrations:** write new ones only (timestamped after the newest on main), and stop for the coordinator to apply them. Prices and rewards go in the existing economy tables and rules. Never write the gem-to-money rate anywhere.

**Visual work** (UI, models, the tour) goes to David as screenshots on a review page before it merges. Pure fixes can merge once verified.

**Gates:** vitest (once), tsc, eslint, the SQL smoke chain, plus headless shots or an in-game run for anything a player sees. One `perf:check` at the end only if you change what renders. Report at each milestone and at the end with the head SHA, gates, evidence and anything you couldn't verify.

## Round 5: David's round 4 review (2026-11-02, verbatim; https://claude.ai/artifact/BNWtSh7obrfHW7S5EAZ39E)

Approved: mq4-xp, mq4-ring-after, mq4-sand, mq4-bible (update design bible UI 8b to match: stamina stays in the card, dimmed when full; the level shows in the ring all the time).
- mq4-hud (redo): "the divide line needs to be thinner and the bar should be longer, idk if they should have a huge white pill "
- mq4-vitals (redo): "more red and critical and flashes"
- mq4-vitals-world (redo): "the screen should get subtle vingette and when its really low the heart pulses and the screen gets less saturaed"
- mq4-levelup (redo): "remove white backgound level up card needs to be redone"
- mq4-reveal, mq4-phone-levelup (redo, no note): follow the level up redo.
- mq4-phone (redo): "the ui for phone needs to increase the camera distance, remove emote dance and make it more compact"

Build:
1. The vitals: a thinner divider, longer bars, and try it without the big white pill (show with and without). Low reads critical: a stronger red, and it flashes when very low.
2. Low health in the world: a subtle vignette as health drops; when very low the heart icon pulses and the screen desaturates a little. Honour reduced motion for the pulse.
3. Level up redone with no white card: the character, motes, flash frames and text over the world (a soft scrim at most), then the reveal in the same style. Phone too.
4. Phone HUD: the camera pulled further back, the emote and dance button removed from the phone HUD, everything more compact.
5. Update bible UI 8b per mq4-bible.

## Round 4: David's review of round 3 (2026-11-01, verbatim; page G6Zne7fKcCCaVBUfBcum6G, collection approvals)

Approved: r3-arrow, r3-pops.
- r3-bars (redo): "the ui for the health bar stamina bar and exp bar needs to be completely redone, stamina should be with health and eventually there might be a shield or mana bar for different classes."
- r3-bars-world (redo): "placement off and in the middle of nowhere"
- r3-stamina (redo): "should be redone"
- r3-stamina-empty (redo): "all the bars should change color as it depleats, so perifiral visiion you cna tell how youre doing and have tallies for every like 20 hearts or smth"
- r3-xp (redo): "exp bar should exists somewhere seperate, maybe a circular bar around a number somewhere and hover shows specific xp amount"
- r3-level-up (redo): "level up card should feel mor oomph, more juice, suspense should feel a lot of dopamine, maybe have your character model there and like the experience floats into the character and flash frame for every experence going in and it has level up animation and the text that says level up and the character jumps and grows a lil and next fram over lay the level upgrade and the things you unlock like gems crafting new unoclable stuff"
- r3-sand (approve): "make it move or twitch a lil bit"
- r3-pop-strip (approve): "i think about time we do 1 round of all dug up treasure, make like a list of like stuff that can be dug up and model it and give it rarity and purpose" (not this lane: a separate treasure lane)

Build:
1. The vitals, redone from scratch: health and stamina together as one stack built to take a third bar later (shield or mana by class), each bar shifting colour as it empties so it reads in peripheral vision, tally ticks every 20 points. Placement that belongs to the HUD's layout (design bible), not floating in the world.
2. XP on its own: a small circular ring around the level number, somewhere sensible in the HUD; hover (or tap) shows the exact XP.
3. Level up as a moment: the character model on the card, XP motes float into it with a one or two frame flash per mote, a level up animation (the character jumps and grows a little), the "Level up" text, then the next frame overlays the new level and what it unlocks (gems, crafting, new unlockables: only what really unlocks). Flashes never back to back; reduced motion drops them.
4. The dig spot's sand moves or twitches a little.

## Round 3: David's review of round 2 (verbatim) and the coordinator's rulings

- Approved: r2-01-line, r2-02-dropdown, r2-21-dig-mark-dirt ("looks good").
- r2-03-arrow: "make the arrow centered and smaller".
- r2-20-dig-mark-sand: "make it similar to the dirt".
- r2-30-reward-pops: "the ui should be a combination, not so flat but also keep the old vibe but new color, dont need cm for sudo" (now bible UI rule 1).
- r2-06-level-up (note): "the user shoud have a health, stamina, and exp bar, and everything should be when exp is filled" (bible UI 8).
- The broken sudo stays legendary for now.
- Coordinator: stamina is a real, gentle mechanic in movement/sim.ts (sprint about 10 s a bar, a dash 20%, glide slow; refill
  about 3 s after a 0.6 s pause; emptied: walk, no dash or glide until above 20%); the bar shows only while below full and
  fades 1.5 s after it fills. Health = combat hp/maxHp, XP = hudStore levelProgress, always on, top left above the Bag.
- Coordinator (bible UI 8b, the two HUD layers): the level badge beside the XP bar only in the UI view (Esc 1); the wallet
  (coins and gems) is TopCluster's slot, built by the tutorial lane: build no coin or gem display here.
- Ownership: this lane owns RewardPop/RewardCard, BigMoment, the rarity tokens and the HUD bars (StatBar, StatBars, HudBars).

## Round 2: David's review (2026-10-28, verbatim, with what each means)

Approved, no change: 04-juno-at-the-museum, 05-juno-talk, 07-next-chapter, 10-brams-challenge, 10-pims-shovel.

Approved, with a note:
- 06-chapter-1-done: "chapter 1 done get enough exp to level up to level 2, should have overlay of what unlocks". Finishing chapter 1 grants enough XP to reach level 2; a level-up overlay shows what level 2 unlocks (reuse the existing XP/level system; only unlocks that really exist).
- 10-odiles-net: "bug catching should have bug catching mini game". Not this lane (its own lane). Net chapter stays as is.

Redo:
- 01-line: "i dont see in this screenshot". Find whether the line doesn't render or the shot missed it; fix and reshoot plainly.
- 02-dropdown: "the bar and main quest drop down should horizontally be the same length". Same width.
- 03-arrow-to-museum: "dont write show the way, just an arrow icon you can press on". Pressable arrow icon with an aria-label.
- 10-elizas-pickaxe, 30-pickaxe-at-a-rock, 31-pickaxe-from-the-side: "dont do pickaxe yet, release thiswith the cave update" / "pickaxe in cave update". Park the pickaxe chapter and mining: keep the code, nothing reachable, no chapter gap.
- 10-the-museum: "this might get impossible if people donate all the stuff". The club goal must always be completable; state the rule in one sentence on the review page.
- 20-dig-mark-sand(-close), 21-dig-mark-dirt(-close): "should be way more subtle and small and lower opacity" / "should look natural and hard to find usually". Much smaller and fainter; on dirt a natural patch you'd usually miss.
- 40-models: "burried find should drop like relics for museum, coins, ores, very rarely gems and veryveryvery rare is a broken sudo. and you can upgrade shovel for differnt loot chances". Buried finds roll a loot table (relics, coins, ores, very rarely gems, very very rarely a broken sudo, lore per specs/lore.md "sudo canon"); shovel tiers change the odds (reuse the rod-tier pattern); every tier's odds in a table on the review page; never the gem-to-money rate; server-authoritative rolls; new timestamped migration.
- 50-village-line, 51-village: "why are you still editing the old world". Proof shots only; drop them from the review, keep villagePinned.test.tsx green, change nothing in the village.

## Status

**Round 4** (game/main-quest, on origin/main 4fb4b8cc). Done, waiting for David's review (evidence specs/evidence/main-quest/r4/):
- Vitals (kit `components/gui/flat/vitals.tsx` Vitals, VitalBar; game `HudBars.tsx`): one soft white card in the top left
  corner, level with the quest line (DefaultIslandWorld.module.css `.hudBars`; the place name `.heading` moved under it,
  top 86px; on touch, `data-compact`, they sit under the menu button and the place name under them; the compact
  `.bagButtons` column lets taps through except on its buttons, via `:where()` so the hidden Bag's pointer-events none
  still wins: before, a hidden Bag button sat over the ring and a tap opened the bag). Health and stamina stacked, both always there (stamina rests at half opacity 1.5 s after it's full, shakes
  once when winded); a class's shield or mana is one more VitalBar row (a kind, an icon, two tokens). Each fill slides
  full colour > shared amber > low colour by its value (CSS color-mix on a registered `--vital`, so colour eases with
  the fill); a notch every 20 points of `max` (TALLY). Tokens: --ui-health, --ui-health-low, --ui-stamina,
  --ui-stamina-low, --ui-vital-mid in clean, cream and dark.
- XP ring (vitals.tsx XpRing): the level number on a white disc, XP round it, always on (it replaces the XP bar and the
  layer-2 level badge); hover, focus or a tap shows "Level n, into / needed XP, x to level n+1" (the kit's HoverTip;
  touch keeps the tip while the ring has focus). Same roll-over and LEVEL_FILLED as round 3.
- Level up (kit `levelUp.tsx` LevelUpMoment, LEVEL_UP_MS; game `LevelUpCard.tsx`): your character (CreatorStage
  Portrait, body framing, white studio, own small canvas while it's up; Portrait gained an optional `motion` prop), 7 XP
  motes curve in 180 ms apart, each landing flashes the figure white for two frames and blips a little higher; the
  burst: "Level up!", sparks, the figure grows 8% and jumps (lift arc 0.2 m, Cheer clip, the jump SFX); the reveal: Lv n
  and the real unlocks (lib/game/levelUp.ts) slide up over the lower half. A click/E/Enter/Esc skips to the reveal, then
  closes. Reduced motion opens at the reveal. BigMoment, StatBar and StatBars deleted (and their CSS).
- Dig spot twitch (lib/game/digMark.ts digTwitch, tested; VillageLife DigSpot): every 2.5 to 5 s (per spot) a 0.4 s
  wobble, scale up to +-24% and a turn up to 0.22 rad, dying away; on sand and dirt alike; none under reduced motion.
  Measured on the mesh in the headless run (scale 0.89 to 1.20).
- Gates: tsc clean; vitest 3733 passed, 2 failed outside this lane (shoreField timed out under load and passes alone;
  study.test.ts "demo scenarios" fails on the date, week_start 2026-11-02, and passed an hour earlier); eslint clean on
  the 12 changed TS files. perf:check SCENES=v2 (one run, load average 8.3, swap 12.7 GB, another lane's Blender lock
  held): v2 high 6.7 ms median (baseline 4.8 from 2026-10-14, +40%, over the 6.5 budget), lite 3.7 (2.9); draw calls
  364 (359), triangles 752k (757k). The bench never mounts the level-up canvas; the only always-on render change is a
  useFrame per dig spot (a scale and a turn). Not rerun (the rules: never for noise); the coordinator's merge-batch check decides.
- Bible to update (coordinator): UI 8b says "stamina only while below full" and "the level badge beside the XP bar" in
  layer 2; round 4 has stamina always in the stack (quiet when full) and the level always in the XP ring.

## Next

1. Wait for David's review of round 4 (specs/evidence/main-quest/r4/); the round 3 migrations still wait to be applied in
   order (20261028144337_main_quest, 20261028153805_main_quest_r2, 20261029064914_catalogue_seed).

## Tools and gotchas

- Browser batches: `LANE=game/main-quest /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh devserver <script>`,
  retried while it exits 75 (no queue file). One short batch per hold. Runner pattern in the scratchpad `mqrun/`.
- `?progression=demo&chapter=<slug>&tally=bugs:2,net:1` puts the demo member anywhere in the main quest.
- Single test files run without the lock; full tsc and vitest under the heavy lock. Under load a few slow tests (net
  loopback, walk.test) time out at 5 s; they pass run alone.
- r3bars probes for open ground (sprint there and back) before the stamina strip; `window.__move.sim.current.state` has stamina.
- `scripts/world-cells.ts` regenerates `web/data/world/cells.json`; `node scripts/gen-seeds.mjs` writes a NEW seed.
- `talkStore.quest` (main quest) is consulted before `talkStore.script` (tool teachers) in `NPC.tsx`.
- The new world's places for shots (activeVillage("new")): museum 4,70.5 (Juno ~7,70), dig-sand-0 -17,102, dig-soil-15 35,84, rock-1 38,25.1.
- Browser runner (round 4): scratchpad `mqrun/qrun5.sh <scenes>` (run5.sh, out to mq-r4; scenes mq4hud, mq4hud-phone,
  mq4tap, mq4sand; mq4lab's element shot of /lab/gui came out black, unused). `mqrun/evid4.py` builds r4/. A failed
  scene no longer kills the batch (logged in errors). The level-up flash lasts two frames: the strip holds it by setting
  the figure's data-flash. `__combat.rt.player.hp` + `__publishCombat()` set health; `__move.sim.current.state.stamina` stamina.
- Browser runner (round 3): scratchpad `mqrun/qrun4.sh <scenes>` (run4.sh, out to mq-r3; scenes r3arrow r3dig r3bars r3pops).
- Browser runner (round 2): scratchpad `mqrun/qrun.sh <scenes>` joins the browser queue, waits up to 9 min (exit 75:
  call again), then runs `run3.sh` under the lock (new world; ICONS="key ..." renders icons first; POPS passes through).
- zsh doesn't word-split `$F`: use `${=F}` for a list of test files.
- Evidence shots: never put the thing to show straight ahead of the player; the camera sits behind and the body hides it.
- `window.__orbit.three()` (dev) is the r3f state: shoot.mjs markClip projects the DigSpot meshes through the camera.
- "Before" shots of a shared component: before.sh swaps main's file in for one batch and restores this lane's.
- The HUD needs ~9 s after the tracker appears (the arrival's fade): shoot.mjs `hudIn`.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/main-quest /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **New world only:** the village is retired; vitest runs once.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
