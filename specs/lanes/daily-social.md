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

## Monument direction (r3, awaiting David's approval; no modelling until main says go)

**The Lantern Cairn.** When the Keepers scuttled their war vessel, the Founder kept one thing off it: the ship's signal lantern, which once called the fleet to war. The club builds a stone cairn under it so it calls people home instead, and when it is whole the lantern burns for whoever washes up next. Look: warm grey hand-cut stone on a round two-step plinth (about 2 m across, inside the landmark's footprint), a tapering four-sided column about 3.4 m tall with one carved ring band, topped by a weathered brass lantern held in a curved rib of old hull salvage (sea-green patina); read from the game camera as one tall, clear silhouette at the plaza's west side. Stages, one clear silhouette change each: **before 25%** only the plinth's first ring, a chalked outline and a small stack of cut stones with a mallet (the plot is started); **stage 1 (25%)** the full plinth and the column's lower third, a ladder leaning on it; **stage 2 (50%)** the column at two-thirds, a timber scaffold on one side and a rope pulley lifting a block; **stage 3 (75%)** the column at full height with its carved band, the hull-rib bracket and the unlit lantern fitted, scaffold still up; **stage 4 (100%)** scaffold gone, the lantern lit warm (glow plus the night light), two small club pennants and flowers round the plinth. Built in headless Blender as one model with each stage's parts named: a high-def (bevelled blocks, about 15k tris) for the monument sheet's per-stage picture, and a low-poly decimated from it (about 2k tris, flat colours by look class: stone rough, brass metal, wood rough) for the world. Meshy is not available (no "Meshy API" keychain item), so it is modelled from this direction; references from David welcome. The 4 rope fence poles around the plot go.

## Status

**Next:** David's review of the new-world round (ids nw-...); then the coordinator applies the four migrations in order (20261027182444, 20261029062500, 20261029062600, 20261029062659). Unverified: fishing together needs two signed-in friends online (route and roll tests only); the campfire bonus trusts the client that you sat for 30 s; gifts are verified by the SQL smoke and mocked shots (no signed-in run).

- **New world only (2026-10-28 round).** Every feature reads the world's own objects: the campfire is world.json `campfire` (14, 104) by the beach, the monument landmark (21.5, 50) by the plaza. Odile's and Marlo's pond lines now say the river, and the net quest says "the meadow flowers" (residents seed block in 20261029062659, guarded UPDATEs: `guarded` seeds in lib/seedMigrations.ts change a row only while it's still as seeded; resident_lines_smoke.sql). Evidence: `specs/evidence/daily-social/new-world/` (shoot.mjs, `*-before.webp` = the old UI on the new world).
- **David's redo round, built:**
  - d-streak: the welcome week is a reward track (lib/wallet/catalogue.ts WELCOME_TRACK, mirrored in 20261029062500): 200, 300 coins, 5 Gems, 400 coins, 10 Gems, 600 coins, day 7 the box and 10 Gems (1500 coins, 25 Gems). The box spins a PrizeWheel; it holds clothing or the second-tier gear (BOX_GEAR rod-cedar, net-mid, shovel-mid). Gems go through wallet_apply as earn_streak. `welcome_day_coins` is gone from SETTINGS.
  - d-friends: half hearts (level 0..10). The day's first talk +1/2 (approved; its own line on the card so David can cut it), sent as the talk opens; one gift a day per resident from the bag (talk box gift button, GiftPicker): love +1, like +1/2, neither 0, hate -1 (RESIDENT_GIFTS in residentRoster.ts, giftTaste in lib/npc/friendship.ts). Each whole heart once: odd a letter, even coins. resident_friend_gift / resident_friend_move in 20261029062600.
  - d-monument: MonumentSheet rebuilt (goal picture on the paper notice, GoalMeter with the build stages, CountUp numbers, bring icons with hover words, one action).
  - s-campfire: the hour's notice and the bonus are quiet toasts (`toast(text, icon, { quiet: true })`).
  - Kit (components/gui/flat/rewards.tsx): HeartMeter, RewardTrack, PrizeWheel, GoalMeter, CountUp; token `--ui-heart` in the three themes; /lab/gui?only=flat-rewards. main-quest owns the reward pop and the rarity tokens (`--ui-rarity-*`, the wheel already reads them with a fallback).
- x-moves (approved): dash for everyone, glider locked.
- Round done at 8dc5bfea (the lane-file commit sits on top). Gates: vitest with NEXT_PUBLIC_GAME_WORLD=new 3528 passed / 4 skipped (370 files), tsc clean, eslint clean on changed files, the SQL smoke chain passes (welcome_week, resident_friendship, resident_lines).

## David's decisions

- 2026-10-28 (redo round, via the coordinator): d-friends "make it half a heart and like giving them stuff ... gifts increase a heart, non like stuff no increase, ok like half heart, and hate -1 heart"; d-monument "the ui needs to be redone completely, make it less words, more icon and visual and more juicy and simple to understand just by looking at it"; d-streak "you should make it so that you see the reward for logging in each day streak, like a visual, include like 10 gems for day 5 or smth, in the end user gets a total of like 1500 coins, 25 gems, and mystery box with a wheel that spins for gear/clothing"; s-campfire "like less bold it should be very gentle and not something so iumportant"; x-moves-dash approved. All screens follow specs/design-bible.md UI (flat, tokens, the kit).
- 2026-10-28: "why are we using the old island for some of these artifcats, it should not be used or archived": the new world (NEXT_PUBLIC_GAME_WORLD=new) is the only member world; "pond only in mountain".

- 2026-10-28 (via the coordinator): homes are closed, so no furniture, wallpaper or flooring in the box until they open; one switch, `welcome_box_furniture` in economy_settings (0 now), puts furniture back.
- 2026-10-27 (via the coordinator): Contraband is staff-only ("like mod tools normal ppl cant get it"): the day-7 mystery box never holds it and stays starter loot (`boxPool` and the SQL pool: special_pool outfit, hair, face, accessory, furniture, coin-priced at or under welcome_box_coins; tested). No launch date ("just keep building until i feel content"): skip d-halloween; seasonal events follow the real date at launch.

## Tools and gotchas

- Headless checks: `SCRATCH=<scratch> ONLY=streak,friends,monument,campfire,dash,kit LANE=game/daily-social withlock.sh devserver <scratch>/run-dev-new.sh 3147 node specs/evidence/daily-social/new-world/shoot.mjs specs/evidence/daily-social/new-world` (run-dev-new.sh: next dev with NEXT_PUBLIC_GAME_WORLD=new and Supabase blanked). Don't wrap withlock in `timeout`: it waits for the lock itself (exit 75 after 20 min). No queue file. (the wrapper starts `next dev` with Supabase blanked in its own process group and stops it). `/lab/island` needs `tsi.look.v1` in localStorage or it opens the character creator.
- Signed out locally: the gift card and friendship are driven by mocked `/api/economy/*` and `/api/npc/friendship` answers in the scripts; the server side is the SQL smokes.
- Seeds: change the TS (catalogue SETTINGS, the resident roster), then `node scripts/gen-seeds.mjs`. To fold into the unapplied 20261029062659: delete it (and any newer seed), run gen-seeds once, rename the new file back to 20261029062659_catalogue_seed.sql, run gen-seeds again ("up to date"). resident_lines_smoke.sql includes that file by name.
- Swap stays over 9 GB on this machine: the heavy lock waits for the devserver lock; `withlock.sh` gives up after 20 minutes (exit 75, silent behind a grep).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/daily-social /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The new world is the only member world** (the village is being archived). Gates: vitest with NEXT_PUBLIC_GAME_WORLD=new, tsc, eslint on changed files, the SQL smoke chain when SQL changes.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
