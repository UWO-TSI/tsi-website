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

## Status

Head: see git log (game/main-quest). Merged origin/main 2e7bd27f (coordinator OK, 2026-10-28). Village gated and pinned;
green on both worlds; ready for the coordinator.

**The village plays as before (prod's default).** Everything the main quest adds is behind `NEXT_PUBLIC_GAME_WORLD=new`
or world-aware data whose village rows are unchanged. Fixes on top of the [wip] (each a village leak):
- Club chapters keep positions 2 to 4 (the village journal numbers chapters by position: "Chapter 3" for the museum
  fund). The new world's chapters sit at 5 to 10; `evaluateChapters` orders personal chapters before the club's; the
  new world's journal counts instead (JournalSheet).
- The tracker's aria-label stays "Chapter: ..." in the village ("Main quest" only in the dropdown).
- `toolOf` moves only rocks (biome `rocks`) to the pickaxe; tree branches stay by hand.
- Juno and the new world's line swaps are applied in the persona loader (`residentsHere`, lib/content/loader.ts), so
  every in-game consumer (useCheer, Keeper, cafe) sees the village's residents; NPC.tsx no longer filters.
- memoryStore defaults to this world's chapters (as the server lists them).
- New world only: a resident in reach beats a closed museum or cafe sign for E (Juno waits at the closed museum's door).

**Village-pinning tests** (`web/lib/game/villagePinned.test.tsx`, fixture `villagePinned.fixture.ts` generated from
80816727's modules): settle-in progress read from the migrated rows (in progress with the donation stored, plot claimed,
completed, skipped) evaluates, objectives and advances exactly as before; village chapter rows equal 80816727's; rocks
take the shovel with no `only`; no dig spots, no finds in the ROSTER or DB roster filter; no Juno, residents' lines and
RESIDENT_TALK equal base; TOOL_LINES, WREN_LINES (Alice's farewell), HQ_TRACKER and Rosa's SWEEPER_LINES equal base; the
tracker's markup equals 80816727's. Before writing it, a throwaway harness compared the base and current engines over 216
village progress/facts/drop combinations (views, objectives, every action): identical.

**Gates at the report SHA:** tsc clean; eslint clean on the 83 changed files; SQL launch chain clean (main quest 1 to 5
ok). vitest village: 3534 passed, 2 failed (lib/game/world/cells.test.ts, 5 s timeouts under load; pass alone, 4/4).
vitest new: 3532 passed, 3 failed, then fixed or load: routes.test.ts (fixed: chapter 1 by world), generate.test.ts and
loopback.test.ts (timeouts; pass alone). Rerun singly on both worlds after the fixes: all pass.

**Evidence** (`specs/evidence/main-quest/`, shot with NEXT_PUBLIC_GAME_WORLD=new on the dev server; `shoot.mjs`):
01 to 07 (line, dropdown, arrow, Juno at the museum, her talk, chapter 1 done, next chapter), 10-* (each chapter's
dropdown), 20/21 (dig marks on sand and dirt, with close crops), 30/31 (pickaxe at a rock), 40-models; 50/51 the village
(default world): its one line, no dropdown, "Chapter: Settle in".

- **Chapter engine** (`web/lib/progression/chapters.ts` STEP_RULES): steps are counted from server facts
  (`lib/progression/facts.ts`), stored by an action, or the finish. Personal chapters 1 to 6 come before the club's
  (7 cafe, 8 museum fund, 9 ruins). The dropdown shows `personalChapter` only, never a club goal. `reward_item`
  (Bram's `rod-cedar`).
  - m1 `settle-in`: first catch, then **Juno** (new resident `docent`, post `museum_guide`, at the museum; slug
    confirmed by the coordinator) finishes it: 100 coins and her letter. No report to Alice.
  - m2 `odiles-net`, m3 `pims-shovel`, m4 `brams-challenge` (5 kinds, one at dawn or dusk: `twilight_catch` on the
    server clock), m5 `the-museum` (donate 3 new; club tally 10 fish, 5 bugs, 3 finds), m6 `elizas-pickaxe` (3 stone,
    1 iron). Each finishes by talking to its person (`lib/game/mainQuest.ts`, `components/game/useMainQuest.ts`).
- **Quest dropdown** (`components/game/QuestTracker.tsx`): the line drops down your quests; the main quest's
  "Show the way" points the guide arrow (owner "quest").
- **Pickaxe** (`pickaxe-basic`, nobody's starter, Mayor Eliza gives it to everyone); rocks need it and give stone or
  iron (clay, gold, crystal moved to biome `mountain`). Held kind `pickaxe` in the net protocol.
- **Dig spots** (`digSpots()` in `lib/game/islandNodes.ts`), 8 on sand and 8 on soil read off the painted map; seven
  buried finds (`BURIED_FINDS`); the server's cell view carries sand and soil (`data/world/cells.json` regenerated).
  The marks are a seeded crack star and a dug hole a fading disc (plain geometry, lib/game/digMark.ts). The server's
  cell view keeps sand and soil for the dig spots only (`Village.digSurface`); its coast stays on plain land.
- **Bug catching**: a missed swing startles nearby bugs, an escape says "It got away!", a catch sparkles.
- **x-teachers**: a chapter's people stay at its place all day (`questPosts`). New world stand-ins (David: "pond only
  in mountain"): a pond stop is spent on the **beach**, a path stop on the **plaza** (`placeAt` STAND_IN).
- **x-lines**: Bram's go-home line, Sable's temple line and Rosa's "not open yet" swapped for open things.
- **Art** (`art/props-enemies/build_mining.py`): pickaxe, stone, iron and spent outcrops, seven finds; icons rendered.
- **Migrations (not applied), in order:** `20261028144337_main_quest.sql` (hand-written), then `20261028144350_catalogue_seed.sql` (generated; the coordinator regenerates one final seed on the combined tree).
  Smoke: `web/supabase/tests/main_quest_smoke.sql` in `specs/evidence/launch-fixes/sql-smoke.sh`.

## Next

1. Wait for David's review of the evidence; the coordinator merges and applies the migrations.

## Tools and gotchas

- Browser batches: `LANE=game/main-quest /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh devserver <script>`,
  retried while it exits 75 (no queue file). One short batch per hold. Runner pattern in the scratchpad `mqrun/`.
- `?progression=demo&chapter=<slug>&tally=bugs:2,net:1` puts the demo member anywhere in the main quest.
- Single test files run without the lock; full tsc and vitest under the heavy lock.
- `scripts/world-cells.ts` regenerates `web/data/world/cells.json`; `node scripts/gen-seeds.mjs` writes a NEW seed.
- `talkStore.quest` (main quest) is consulted before `talkStore.script` (tool teachers) in `NPC.tsx`.
- The new world's places for shots (activeVillage("new")): museum 4,70.5 (Juno ~7,70), dig-sand-0 -17,102, dig-soil-15 35,84, rock-1 38,25.1.
- Browser runner: scratchpad `mqrun/run2.sh <new|village> <scenes>` (sets or unsets NEXT_PUBLIC_GAME_WORLD, deletes web/.next).
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
