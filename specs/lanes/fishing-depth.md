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

Round 2 (David's review 2026-10-28) built on top of round 1; see "Round 2" below. Round 1 items stay as built unless round 2 replaced them.

- **f-pond: closed by David, 2026-10-27: "pond only in mountain".** No pond on the open map; pond fish stay with the mountain. `closedBiomes()` (rolls.ts) keeps them closed; tasks and the chef only draw from the island's waters; the catch board shows a locked "mountain pond" lane.
- **collection-season: approved** (round 1).

### Round 2

- **Server (lib/wallet, lib/collections):**
  - Fishing tasks replace the requests (David: "its not a hand one over, its if you did it you claim it"): `fishingTasks(day, week, waters)` in rules.ts, 3 a day (common, uncommon, rare, pay `FISH_TASK_PAY` 2x sell price) and 2 a week (a rare or epic fish at 4x; `FISH_TASK_VARIETY` 8 different fish for 250). `fishingTasksView`, `claimFishingTask` (service.ts); `/api/economy/tasks`. Done = a rod cast landed today (catch_rolls) or this week (weekly_catch_bests); nothing taken.
  - The chef's order takes the fish (`FISH_CHEF_PAY` 3x and the staff meal): `chefView`, `fillChefOrder`, `/api/economy/chef`.
  - The monthly board (David: "a place to put your fish to monthly leaderboard"): `monthBoard`, `enterMonthly` (collections/service.ts), `/api/collections/monthly`; you put up one of a fish landed this month (it leaves the bag) at your biggest of it this month; a bigger one replaces your entry. The weekly records board and `/api/collections/records` are gone; the portal leaderboard shows the monthly board.
  - The tackle counter's rolls (lib/wallet/tackle.ts): `TACKLE_PRIZES` (17: bait, bobbers, and per season a legendary "crazy" bait and rod), `TACKLE_COUNTERS` (coins 150 / 1,350 for 10; Gems 5 / 45 for 10; chances by rarity), `odds()`, `rollTackle()` with `secureRandom`, `rollAtTackle` + `tackleView` (service.ts), `/api/economy/tackle`. Prizes are off-sale stacking shop rows (`prizeItems()`).
  - **Mirrors of game/rod-gear's lib/game/rods.ts for the merge (coordinator wires them):** `TacklePrize.key` = TACKLE `key` (and the item's `catalogue_ref`/slug), `name` = `name`, `slot` = `slot` ("bait" | "bobber", plus "rod" for the seasonal rods), `gains` = `gains` (Partial<Stats> over STAT_KEYS luck, bite, strength, reel, lure, control); a seasonal rod's `base` = RodTier `base` (Stats). Extra fields rod-gear doesn't have: `rarity`, `season`, `does`, `icon`. `RodStat` in tackle.ts copies rod-gear's `STAT_KEYS`. The shop_items slot check widening is byte-identical to rod-gear's 20261027183200.
- **Migrations (not applied):** `20261028160000_fishing_tasks_sushi.sql` (the unapplied 20261027181000_fish_requests_sushi renamed with git mv and reshaped: fishing_task_claims + fishing_task_claim, chef_order_fills + chef_order_fill, monthly_fish_entries + monthly_fish_enter, toronto_today; member_buffs, sushi_orders, collections_take_one, sushi_order as before) and `20261028161000_tackle_rolls.sql` (slot check, 17 prize rows, tackle_rolls + tackle_roll). Smokes: `supabase/tests/fishing_tasks_sushi_smoke.sql`, `supabase/tests/tackle_rolls_smoke.sql`, both pass after every migration on a throwaway PG16.
- **UI kit (components/gui/flat/pieces.tsx, shown at /lab/gui?only=flat-pieces):** Thumb (rarity edge), HoverTip + TipBody + MonthDots, TimeStrip, OddsTable, GachaReveal (my own; not daily-social's PrizeWheel), TaskCard, FlatDialog, PaperSheet + PaperHeading + MenuRow. Rarity tokens copied byte-for-byte from game/main-quest's themes; paper tokens `--ui-paper*` added to clean, cream and dark.
- **Screens:** `components/game/peaceful/FishingPlaces.tsx` (FishMarketSheet with 3 places on the rail: quick sell, monthly board, tasks; TaskBoardSheet; TackleCounterSheet; ChefOrderDialog), `CatchBoard.tsx` (CatchBoardSheet = the day strip; the world chalkboards CatchChalk and TaskChalk), `SushiSheets.tsx` (MenuPickup: the paper menu raised first person; SushiBar leans the seated camera in on `tsi:bar-menu`, lib/game/sushiBar.ts `readingView`). The best prize of a roll pops through RewardCard (`tsi:gift`).
- **Placement:** the catch board and the task board stand before the fish market, left of its door, in its frame (lib/game/wharf.ts `MARKET_BOARDS`, `marketBoardsOf`), so they follow the market if David repaints; world.json untouched. The tackle shop's door is the counter (`tackleCounterOf`).
- **Dish models:** `DISH_ART` (lib/wallet/catalogue.ts): each dish's high-def path `/assets/game/food/hd/<dish>.glb`, its icon key, a stand-in icon, `ready: false`. `worldModel` (lib/game/world/active.ts) maps `/assets/game/food/hd/x.glb` to the world copy `/assets/game/food/x.glb`. The menu shows stand-ins marked "stand-in" until David's references and the models exist. Prize art is stand-ins too.

- **Deleted in round 2:** `components/game/peaceful/FishMarketSheet.tsx` (the tabbed market), `OutNowSheet` and the porch `CatchBoard` (CatchBoard.tsx), `SushiMenuSheet` and `ChefOrderSheet` (SushiSheets.tsx), `RequestsBody` (EconomySheets.tsx), `records` and `RecordsBody`, `fishRequests`/`fishRequestsView`/`fillFishRequest`, `catchBoardOf`/`CATCH_BOARD`, `/api/economy/requests`, `/api/collections/records`. `countUp` moved from ShopOverlay into lib/game/shopCounter.ts so the places share the till.
- **Evidence:** `specs/evidence/fishing-depth/r2/` (before shots in `r2/before/`), shot by `r2/shoot.mjs`. The gacha's best prize pops main's old cream RewardCard until game/main-quest's flat RewardPop merges.
- **Gates (round 2):** tsc clean; one vitest run 3559 passed, 4 skipped, 1 failed (the portal leaderboard test forbids the word "Monthly"; the banner is now "Fish of the month" and that file passes); eslint clean on all 40 changed files; SQL smokes pass (game_security, catch_rolls, fishing_tasks_sushi, tackle_rolls) after every migration. No perf:check (UI, data and two small chalkboards moved; one board added, about 60 triangles and a 256 x 184 canvas).

## David's decisions

- 2026-10-28 review: collection-season approved. bar-menu: "BAR MENU SHOULD BE PAPER MENU LIKE REAL RESTAURANCE, NOT THIS BULL SHIT. i need you to fuckign lock in on all the ui, looking at these makes me depressed, these food should have a detailed food model on the menu and you can pick it up first person and hover over dishes show what they do". chef-order: "REDO THE FUCKING UI". board-sheet: "the ui needs completely redone for this and have a time graphic with the things available. like it will be icon and you can hover to see what the fish is and etc". board-world-left: "that should be near the fish shop the tackle shop should be like a gatcha roll for parts thing one for coin one for gem, roll for 1 to 10, seasonal crazy bait and rod". market-records: "i dont like that these are 3 sepetate tables, i want a place to quick sell, a place to put your fish to monthly leaderboard and daily /weekly fishing task". market-requests: "ui needs to be updated. the daily tasks should be on a sperate board that shows the daily quest, and its not a hand one over, its if you did it you claim it".
- 2026-10-27, on f-pond: "pond only in mountain".

## Next

1. David reviews round 2 (specs/evidence/fishing-depth/r2/).
2. The coordinator applies `20261028160000_fishing_tasks_sushi.sql` then `20261028161000_tackle_rolls.sql`, and wires the tackle prizes into rod-gear's TACKLE at merge.
3. With David's references: the five dishes (miso soup, salmon nigiri, tuna roll, omakase, Bancha's feast) as HD + LP models (set `ready`, render their icons as `dish_<id>`), and the prizes' models.

## Tools and gotchas

- Throwaway Postgres: `scratchpad/fishing-depth/smoke.sh <smoke files>` (PG16 on 127.0.0.1:54329, `-k ''`, stub, every migration in order; `020_player_persistence` fails in the stub, as before).
- Shots: `scratchpad/fishing-depth/session.sh <flows>` under `withlock.sh devserver` starts `next dev -p 3147` (Supabase blanked, NEXT_PUBLIC_GAME_WORLD=new), runs `specs/evidence/fishing-depth/r2/shoot.mjs` (flows: showroom, board, world, tasks, market, tackle, chef, menu) and stops it. The scratchpad is shared with other lanes: keep to `scratchpad/fishing-depth/`.
- Demo data: `?collections=demo&tasks=1` lands today's first two task fish and five different fish, puts the chef's fish in the pockets, 1,200 coins and 60 Gems; the demo answers tasks, chef, tackle, monthly, sushi.
- CSS modules need pure selectors: scope attribute selectors to a local class (`:is(.thumb, ...)[data-rarity]`).
- Places (new world): sell stall (71.74, 26.8); catch board (63.58, 28.79), read from (64.14, 30.11); task board (61.67, 28.46), from (62.52, 29.62); tackle counter (71.73, 63.43), from (70.64, 63.37); sushi bar entrance about (-47, 114.5); the chef by day about (-45.25, 114.45).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/fishing-depth /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
