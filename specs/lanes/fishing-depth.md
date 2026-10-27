# Lane: fishing-depth (reasons to keep fishing)

Worktree `.claude/worktrees/fishing-depth`, branch `game/fishing-depth`, cut from main at fdd7a901. Agent type `uwotsi-lane`. The launch date moved later; the new date isn't set yet.

Items **f-pond, f-requests, f-records, d-now, f-sushi** in `specs/launch/v1-gameplay.md`. Existing:
- `web/lib/game/fishing*.ts`, `peaceful.ts` (`fishPoolFor`);
- `web/lib/collections/`;
- the fish market and sell barrel in the new world;
- `web/lib/game/sushiBar.ts` and `specs/launch/sushi-bar.md` (phase B).

1. **f-pond:** the 13 pond-only fish (the Golden Koi among them) can't be caught: the new world's pond is dry rock. Make a real pond fishable in the new world. Find the dry pond in the world data and give it water through the generator or terrain rules. David paints the layout, so don't move anything; if the fix needs a new painted area, say so and stop.
2. **f-requests:** the fish market posts 3 requests a day for bonus coins, with server-side checks.
3. **f-records:** a size record per species (personal best) and a weekly club board, at the fish market and in the portal leaderboard.
4. **d-now:** a board or TV in the fishing shack (the tackle shop) showing which fish are out right now, and where. The collection book gets the seasonal view.
5. **f-sushi (phase B):** orders, dishes, small buffs, and the chef's fishing quests, per the sushi spec.

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

(none yet)

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/fishing-depth /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
