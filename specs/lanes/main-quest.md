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

**Round 3** (game/main-quest; merged origin/main f0be2c5e). Done:
- Merge: the new world only. residentsHere always swaps the lines (no village filter); ROSTER always has BURIED_FINDS;
  inWorld deleted; releasedChapters and villageNodes have no world param (chapters with world "village" are never offered);
  useMainQuest has no `on`; QuestTracker has no `dropdown` prop; deleted chapterQuest, toolQuest, the village tool and
  sweeper lines, VillageLife's sprite cracks and holes, HOLE_TINT, FLASH_MS.xp, villagePinned.test.tsx and its fixture.
  Took main's residentRoutine (schedules renamed pond and path) and dropped STAND_IN.
- Arrow: 28 px round button, the upright Navigation2 arrow centred in it (measured: icon offset 0, button on the row's middle).
- Sand mark: the same scuff as the dirt (digMark.ts digScuff for both; crackStar deleted), sand tone at 0.25 opacity; the
  copy says "a scuffed patch of sand or dirt" (lines.ts, mainQuest.ts, defaults.ts, the unapplied r2 migration).
- Reward pop: the old card's shape in the flat palette: a soft rounded white card with grain (--ui-grain) and depth, the
  picture on a round dish ringed in the rarity, a glint on rare and up (--ui-glint), facts as pills (the rarity pill
  outlined), divine holo on the edge, the dish and the pill; contraband dark. RewardPop takes lib/rarity's Rarity
  (LadderRarity deleted). The broken sudo has no size (roster size null), so no "cm".
- HUD bars: kit StatBar/StatBars (flat), game HudBars.tsx top left above the Bag: health (combat hp/maxHp) and XP
  (hudStore levelProgress) always on; the level badge only in the UI view; stamina on its own pill while below full,
  out 1.5 s after full, warm and shaking once when run out. TopCluster's level/XP chip is deleted (the bars replace it).
  The XP bar fills to its end on a level up, fires `tsi:level-filled`, rolls over; LevelUpCard shows on that (after a
  chapter's check-mark, never over it) for any level up; a quest unlock is listed only for a chapter's level up.
- Stamina (movement/sim.ts MOVE_TUNING stamina*): staminaSprint 0.1/s (10 s), staminaDash 0.2, staminaGlide 0.04/s
  (25 s), staminaRefill 1/3 per s (3 s from empty) after staminaPause 0.6 s, staminaWinded 0.2. Emptied: sprint is a
  walk, no dash, no glider (an open glide folds). Walking and talking cost nothing. The avatar writes hudLive each frame.
  No new move event (the net protocol's event list is unchanged); bots run the same sim.
- Migrations, in order, none applied: 20261028144337_main_quest, 20261028153805_main_quest_r2 (unapplied, so its dig hint
  was edited), 20261029064914_catalogue_seed (generated after main's 20261029062423: the buried finds, the sudo without
  a size, the docent). Smokes: main_quest_smoke.sql, main_quest_r2_smoke.sql.

## Next

1. Wait for David's review of round 3 (evidence in specs/evidence/main-quest/r3/); the coordinator merges and applies the
   migrations in order.

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
