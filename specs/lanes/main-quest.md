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

Merged tutorial-v2's guide arrow (203f8603). Built so far (uncommitted work is committed as it lands; see git log):

- **Chapter engine** (`web/lib/progression/chapters.ts`): requirements are data (`STEP_RULES`): each step is counted from
  server facts, stored by an action, or the finish. Personal chapters 1 to 6 run before the club ones (7 cafe, 8 museum
  fund, 9 ruins). The dropdown shows `personalChapter` only, never a club goal. Facts: `web/lib/progression/facts.ts`
  (member_collections totals, gear, museum_donations). `reward_item` gives a shop item on completion (Bram's `rod-cedar`).
  - m1 `settle-in`: first catch, then talk to **Juno** (new resident, slug `docent`, post `museum_guide`, at the museum):
    her talk sends `donate_catch`, which finishes the chapter (100 coins and her letter). No report to Alice.
  - m2 `odiles-net`, m3 `pims-shovel`, m4 `brams-challenge` (5 kinds, one at dawn or dusk: `twilight_catch`, checked on
    the server clock against the last fish's updated_at), m5 `the-museum` (donate 3 new; club tally 10 fish, 5 bugs,
    3 finds), m6 `elizas-pickaxe` (3 stone, 1 iron). Each finishes by talking to its person (`lib/game/mainQuest.ts`).
- **Quest dropdown** (`components/game/QuestTracker.tsx`): the line drops down your quests; clicking the main quest
  points the guide arrow (owner "quest") at the step's place or the nearest bug, dig spot or rock.
- **Pickaxe**: tool kind `pickaxe` (`pickaxe-basic`, nobody's starter, Mayor Eliza gives it to everyone), rocks need it
  and give only stone or iron (clay, gold, crystal moved to biome `mountain`). Held kind added to the net protocol.
- **Dig spots**: `digSpots()` in `lib/game/islandNodes.ts` picks sand and soil cells off the painted map (8 each);
  buried finds `BURIED_FINDS` in the roster (7 new, rarities to legendary). The server's cell view now carries sand `s`
  and soil `d` (`lib/game/world/cells.ts`; `web/data/world/cells.json` regenerated).
- **x-teachers**: the chapter's people stay at its place all day (`questPosts`, NPC plans).
- **Migrations (not applied):** `20261027150000_main_quest.sql` (hand-written: requirement CHECK, reward_item, the
  pickaxe in tool/slot CHECKs, chapter 1 copy, chapters 2 to 6, club chapters to 7 to 9) then a generated
  `*_catalogue_seed.sql` (roster finds, pickaxe item, Juno). Regenerate the seed (delete it, `node scripts/gen-seeds.mjs`)
  after any catalogue change.

## Next

1. Commit; tsc and the full vitest (both world envs).
2. Bug catching fun (m2): approach, swing, flee, catch feedback.
3. Dig marks clearer on sand and dirt (m3); models for the 7 finds, the pickaxe, new rock and ore outcrops (Blender,
   headless); then set the finds' icon/model in the roster and regenerate the seed.
4. x-lines: swap lines about closed things.
5. Headless shots: the dropdown open with the arrow, Juno, a dig mark on sand and dirt, the pickaxe. Review page via
   the coordinator.
6. Ask the coordinator: Juno's slug `docent` with lane npc-editor; pond and path anchors for David (x-teachers).

## Tools and gotchas

- Single test files run without the lock: `npx vitest run <file>`. Full tsc and vitest under the heavy lock.
- `scripts/world-cells.ts` regenerates `web/data/world/cells.json` (run without the heavy lock; it's light).
- The seed test needs the generated catalogue seed in sync: `node scripts/gen-seeds.mjs` writes a NEW migration.
- `talkStore.quest` (main quest) is consulted before `talkStore.script` (tool teachers) in `NPC.tsx`.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/main-quest /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
