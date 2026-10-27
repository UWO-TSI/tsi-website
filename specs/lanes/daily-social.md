# Lane: daily-social (come back tomorrow)

Worktree `.claude/worktrees/daily-social`, branch `game/daily-social`, cut from main at fdd7a901. Agent type `uwotsi-lane`. The launch date moved later; the new date isn't set yet.

Items **d-streak, d-friends, d-monument, s-campfire, s-fishtogether, x-moves** in `specs/launch/v1-gameplay.md`. Existing:
- `DailyGift.tsx`;
- the economy service (`web/lib/wallet/`);
- residents and their talk;
- the monument and the club goals (`web/lib/progression/`, `ContributeSheet.tsx`);
- the campfire (`web/lib/game/campfire.ts`);
- the friends system (`web/lib/world/`);
- `web/lib/game/moveUnlocks.ts`.

1. **d-streak:** a 7-day log-in bonus for new members. Day 7 opens a mystery box: a roulette of random starter loot. Server-side, with a migration.
2. **d-friends:** resident friendship. Talking each day raises a level; each level brings a letter or a small gift.
3. **d-monument:** walking up to the monument shows the club goal's progress and your share, with a Contribute button.
4. **s-campfire:** a set evening campfire hour, with a drum circle and a small bonus for everyone sitting there, announced in the HUD.
5. **s-fishtogether:** fishing within a few steps of a friend gives both a small rare-odds boost and a "fished with" stamp.
6. **x-moves:** dash is unlocked from the start for everyone. The glider stays locked and its recipe hidden until the mountain expansion.

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
- **Locks:** `LANE=game/daily-social /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
