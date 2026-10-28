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

- **f-pond: closed by David, 2026-10-27: "pond only in mountain".** No pond on the open map; pond fish stay with the mountain and open with it. Nothing offers one while it's closed: `closedBiomes()` (rolls.ts, pond while the island has no pond water) makes the journal's pond species `closed` (never out, in season or coming; the book says "In the mountain, closed for now"); requests and the chef's order only draw from the island's waters (tests over a year); the catch board lists pond fish only under "In the mountain pond: closed" (`closedNow`) and its chalk says "Pond fish: mountain, closed". `rolls.test.ts` pins the new world's waters at ["sea", "river"].
- **f-requests: built (cb920164).** `fishRequests` (lib/wallet/rules.ts): 3 a Toronto day, common, uncommon, rare, biting that day in fair weather in the island's waters (`activeWaters`, `watersOf`), paying `FISH_REQUEST_PAY` (3) times sell price. `/api/economy/requests`; `fish_request_fill` in the migration.
- **f-records: built (cb920164).** `records` (lib/collections/service.ts) and `/api/collections/records`: the weekly board (every species' biggest, uncapped `weeklyTrophies`) and your size records. Fish market sheet's Records tab; portal leaderboard's Catch board. In-game names (museum plaques, trophy case, boards) now come from `member_identity.world_name`, not `profiles.display_name` (it showed real names).
- **d-now: built (4d65e381).** `CatchBoard` chalkboard on the tackle shop porch (wharf.ts `catchBoardOf`, `CATCH_BOARD`), E opens `OutNowSheet`; collection book seasonal filter (journal entries carry `in_season`, `leaving`, `arriving`).
- **f-sushi phase B: built (85ea2c18, 16b030db).** Menu (`SUSHI_MENU`, `STAFF_MEAL` in lib/wallet/catalogue.ts), `orderDish`, `/api/economy/sushi`, feast from an epic or legendary fish, chef's daily order (`chefOrder`, board "chef") by day outside the closed bar, meal buffs in `member_buffs` read by the server's cast (`fishRoll` buff: luck and size). UI: `components/game/peaceful/SushiSheets.tsx`, the Menu button while seated (`tsi:bar-seated`).
- **Migration (not applied):** `web/supabase/migrations/20261027181000_fish_requests_sushi.sql` (fish_request_fills, member_buffs, sushi_orders, collections_take_one, fish_request_fill, sushi_order). Smoke: `web/supabase/tests/fish_requests_sushi_smoke.sql`, passed on a local throwaway Postgres 16.
- **No new food models:** the bar's existing geta and nigiri serve loop stands in; good-looking dish models need art.

## David's decisions

- 2026-10-27, on f-pond: "pond only in mountain".

## Next

1. David reviews the evidence in `specs/evidence/fishing-depth/`: market-requests, market-records, board-sheet, board-world-left (the chalkboard on the porch, left of the door), chef-order, bar-menu, collection-season. Act on his notes.
2. The coordinator applies `20261027181000_fish_requests_sushi.sql`.
3. Later, with art: real dish models for the menu and the feast (the bar's geta and nigiri stand in).

**Gates at 16b030db:** tsc clean; vitest 3500 passed, 4 skipped, in both worlds; eslint clean on every file this lane changed. perf:check v2 (one run, headless, 1-minute load 7.5 to 8.5) failed against the 2026-10-14 baseline: high 25.4 ms, 409 draws; lite 9.3 ms, 345 draws. That baseline predates the terrain v3 world. The board adds 5 meshes (2 legs, frame, slate, chalk), about 60 triangles and one 256 x 184 canvas texture, so it can't account for the gap. Not rerun, per the rules.

## Tools and gotchas

- Throwaway Postgres: `initdb` in the scratchpad, start with `-k ''` (the socket path is too long) on port 54329, load `supabase/tests/supabase_stub.sql`, then every migration in order (`020_player_persistence` fails in the stub, as before), then the smoke.
- Demo data: `?collections=demo&requests=1` puts today's first two requests and the chef's order in the pockets; the demo answers /api/economy/requests, /api/economy/sushi and /api/collections/records.
- Places (new world): sell barrel (71.74, 26.8); catch board in front at about (70.8, 61.8); sushi bar (-47, 119.5), its entrance about (-47, 114.5), the chef outside by day at about (-45.25, 114.45).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/fishing-depth /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
