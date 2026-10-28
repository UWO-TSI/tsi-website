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

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, plus headless shots or an in-game run for anything a player sees. One `perf:check` at the end only if you change what renders. Report at each milestone and at the end with the head SHA, gates, evidence and anything you couldn't verify.

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

**Round 2** (head: see git log, game/main-quest; merged feat/game-default-island 0a8a9514). Coordinator rulings this
round: the old village is retired (lane village-archive removes it and villagePinned.test.tsx; new world only, vitest
with NEXT_PUBLIC_GAME_WORLD=new only; leave the world column and settle-in row as they are; keep off
web/lib/game/world/active.ts). UI follows specs/design-bible.md's UI chapter (flat, --ui-* tokens only, kit pieces in
components/gui/flat plus /lab/gui). tutorial-v2 owns the quest-complete check (QuestCheck on `tsi:quest-complete`).

Done in round 2:
- **01 line**: round 1's shot was taken under the arrival's fade (the line renders); shoot.mjs `hudIn` waits for it.
- **02/03 tracker** (QuestTracker.tsx/.module.css): flat, tokens only; with the dropdown the bar and list are one width
  (300 px); the guide arrow is a round icon button (aria-label "Show the way to <quest>", aria-pressed).
- **06 level up**: chapters have `reward_xp` (paid once through combat_grant_xp, source 'chapter'); first-find pays
  125 = xpForLevel(2). The advance answer carries `xp_gain`; hudStore takes the total; LevelUpCard shows the kit's
  BigMoment 1.6 s after `tsi:quest-complete` (useMainQuest dispatches it with the chapter title instead of a toast).
  Unlocks shown (lib/game/levelUp.ts, only what's real): the next main-quest chapter; stat points only when DROPS.classes.
- **Pickaxe parked for the cave update**: `DROP_FEATURES.cave: null` (lib/game/drops.ts) and `REQUIREMENT_FEATURE
  { pickaxe: "cave" }`: releasedChapters drops elizas-pickaxe (its row stays; it was the last chapter, so no gap);
  `MINING` (lib/collections/roster.ts) gates Eliza's hand-over (teachers.ts live), rocks taking the pickaxe (toolOf),
  the stone/iron-only rocks (islandNodes) and the mining rock models/labels (VillageLife). Parked, kept: the pickaxe
  item (off sale), build_mining.py's pickaxe and rocks, QUEST_LINES.pickaxe, TOOL_LINES pickaxe, the chapter row and
  STEP_RULES.pickaxe. The cave update releases it by giving `cave` a drop number.
- **Museum drive** (m5): any fish, bug or buried find handed in counts, duplicates too (museum_handins,
  museum_hand_in, /api/collections/museum/hand-in). facts.ts: your part = donations + hand-ins; the club tally counts
  both. Odile's drive talk opens MuseumDrive (flat panel; DonateSheet untouched). Rule for the review page: "Every fish,
  bug or buried find you hand in counts toward the drive, even a kind the museum already has."
- **Dig marks**: sand a small faint hairline star, dirt a faint scuff with two crumbs (digMark.ts), transparent.
- **Dig loot** (lib/collections/digLoot.ts, server-rolled in service.ts digAt with the held shovel's tier;
  collections_dig records once per spot and hour, member_digs tallies digs for Pim's chapter):
  | Shovel | Relic | Coins | Ore | Gem | Broken sudo |
  |---|---|---|---|---|---|
  | 1 Shovel | 50% | 34.68% | 15% | 0.3% | 0.02% |
  | 2 Iron | 52% | 30.57% | 17% | 0.4% | 0.03% |
  | 3 Sturdy | 54% | 26.46% | 19% | 0.5% | 0.04% |
  | 4 Crystal | 56% | 22.24% | 21% | 0.7% | 0.06% |
  | 5 Golden | 58% | 17.9% | 23% | 1.0% | 0.1% |
  Coins 10 to 50; ore iron 85% / gold 15%; a gem is 1. Broken sudo (`find_broken_sudo`, legendary, nature room):
  "A little screen-faced chassis with an empty heart socket. Whoever built it never got to flash it." Model in
  build_mining.py (`-- only find_broken_sudo`). Flag for David: "divine once the ladder lands?".
- **Loot UI**: the kit's RewardPop (rarity outline from --ui-rarity-*, divine the moving --ui-holo) is what RewardCard
  renders for every pop (bug, forage, dig, purse, craft); a bottle's recipe stays the paper scroll. A purse pops via
  `tsi:dig-purse`. Rarity tokens --ui-rarity-common..divine, --ui-holo, --ui-on-divine in clean/cream/dark.css.
- **Migrations, in order, none applied**: 20261028144337_main_quest (unchanged), 20261028144350_catalogue_seed,
  20261028153805_main_quest_r2 (reward_xp, XP source 'chapter', wallet source 'dig', gem type 'earn_dig',
  member_digs, collections_dig, museum_handins, museum_hand_in, copy), 20261028194150_catalogue_seed (generated:
  the broken sudo). Smokes: main_quest_smoke.sql, main_quest_r2_smoke.sql in sql-smoke.sh.

## Next

1. Shoot round 2 (scratchpad mqrun/qrun.sh: before pops with main's RewardCard via before.sh, then r2flow, r2museum,
   r2dig, pops with POPS=after), copy to specs/evidence/main-quest/r2/, review the shots, fix, reshoot.
2. Gates (vitest new, tsc, eslint on changed files, SQL chain), one perf:check (dig marks), report to main.

## Tools and gotchas

- Browser batches: `LANE=game/main-quest /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh devserver <script>`,
  retried while it exits 75 (no queue file). One short batch per hold. Runner pattern in the scratchpad `mqrun/`.
- `?progression=demo&chapter=<slug>&tally=bugs:2,net:1` puts the demo member anywhere in the main quest.
- Single test files run without the lock; full tsc and vitest under the heavy lock.
- `scripts/world-cells.ts` regenerates `web/data/world/cells.json`; `node scripts/gen-seeds.mjs` writes a NEW seed.
- `talkStore.quest` (main quest) is consulted before `talkStore.script` (tool teachers) in `NPC.tsx`.
- The new world's places for shots (activeVillage("new")): museum 4,70.5 (Juno ~7,70), dig-sand-0 -17,102, dig-soil-15 35,84, rock-1 38,25.1.
- Browser runner (round 2): scratchpad `mqrun/qrun.sh <scenes>` joins the browser queue, waits up to 9 min (exit 75:
  call again), then runs `run3.sh` under the lock (new world; ICONS="key ..." renders icons first; POPS passes through).
- zsh doesn't word-split `$F`: use `${=F}` for a list of test files.
- Evidence shots: never put the thing to show straight ahead of the player; the camera sits behind and the body hides it.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/main-quest /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
