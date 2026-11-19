# Lane: analytics (the game's player analytics dashboard)

Worktree `.claude/worktrees/analytics`, branch `game/analytics`, cut from origin/main 16e7152df. Agent type `uwotsi-lane`. Dev port 3498.

**Read first:** `specs/lanes/README.md`, `specs/lane-rules.md`, `STATE.md` (prod, migrations), `CODEMAP.md` (the game's server routes and stores), `web/lib/server/adminContext.ts` (T1/T2 admins), the arrival, progression, quests, wallet, catches and collections code and tables. Recruitment owns `web/app/admin/recruit`, `web/components/admin/` and its migrations: don't touch them. `middleware.ts` and `web/lib/supabase/*` belong to the play.tethos.ca session: don't edit them; ask the coordinator if you need a change there.

## Round 2: David's Player Analytics 1 review (2026-11-13, verbatim; https://claude.ai/artifact/MAk7U5tczG8P6CPmkLBTwA)

Approved: none.
- an1-features (redo)
- an1-history (redo)
- an1-phone (redo)
- an1-players (redo): "use the new ui, add important analytics, use graphs and a summerize section taht analyses and produceces a summary for the data on the admin side"
- an1-private (redo)
- an1-questions (redo)
- an1-quit (redo)
- an1-tracking (redo)

All eight cards are redo; the one note covers the page.

**Main moved:** merged (done in round 2).

Build (coordinator):
1. **The new UI.** Rebuild the page in the newest admin look on origin/main. Check `git log origin/main -- web/app/student/dashboard web/components/portal` for the latest dashboard restyle and match it; if the game's flat kit (row 320) is the better fit, say so. Name which look you used on the questions card.
2. **Graphs, not tables:** players over time (new, active day/week), the funnel as a bar chart with drop-off between steps, retention cohorts as a heatmap, where people quit ranked, session length distribution, feature use. Read `~/.claude/skills/dataviz` guidance if present; one palette, light and dark, works on a phone.
3. **Important analytics he hasn't got yet:** daily, weekly and monthly actives and their ratio (stickiness), day 1, 7 and 30 retention, median session length and sessions per player, time to first catch, first sale and first quest, the share who finish the tutorial, the share who come back the next day. Leave room for the new systems (the markets, the login calendar, gem purchases), which will log events later: a section that lists any event kind it sees.
4. **A summary section** at the top that reads the data and says what it means in plain sentences: the biggest changes against the previous period, the worst drop-off step, retention moving up or down, where people quit most, anything unusual. Compute it on the server from the numbers, no LLM call and no cost. Note on the questions card that a Claude-written summary is possible later if he wants one.
5. Rename the "Village" screen label to Island (from round 1).
6. Privacy and the unapplied migration as in round 1. If the migration changes, edit it in place (it is still unapplied).
7. **The page, "Player Analytics 2":** the dashboard on made-up data, desktop and phone, one card per section, the summary card, a questions card.

Evidence `an2-*` in `specs/evidence/analytics/r2/`.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, the SQL smoke chain, headless shots.

## Round 1: David's ask (2026-11-06, verbatim)

"make a backened analytics dashboard to see players and like funnel for each major step and gauge engagement so that i can see whats wrong and what gts peopel to log out and never  come back and similar analytics"

Build (coordinator):
1. **What we can already tell.** Inventory the data prod already has (profiles and their created_at, arrival and taught, progression, quests and chapters, wallet ledger, catches and rod catches, collections, donations, sales, crafting, volleyball, sushi, auth last sign-in) and which funnel steps and engagement numbers each one answers, including history from before this lane.
2. **A small event log** for what the tables can't tell: one table (for example `game_events`: member, kind, step, small props, at), written through one server route that checks the session and rate-limits, never free text or personal data. Track: session start, a heartbeat every few minutes while the tab is visible, session end (pagehide), each major onboarding step and tutorial beat reached, and each feature's first use. One list of steps in code (`lib/analytics/steps.ts`) that both the client and the dashboard read. Keep it cheap: batched, no per-frame work, nothing on the render path.
3. **The dashboard**, admin only (T1/T2 via adminContext; signed-out or non-admin gets nothing), at a new route such as `/admin/game` (outside recruitment's folders). Read with the service role on the server. It shows:
   - players: total, new per day, active per day and week, a list (world name only, never real names or emails) with first seen, last seen, sessions, time played, furthest step;
   - **the funnel**: each major step from sign-in to the creator, the arrival, every tutorial beat, the first catch, the first sale, the first quest, day 2 and day 7, with how many reach each step and the drop-off between steps;
   - **where people quit**: the last step and screen before a session ends, and before a player goes quiet for 7 days or more ("never came back"), ranked;
   - engagement: session length, sessions per player, time per tutorial step, which features people use and come back to;
   - retention cohorts by signup week (day 1, day 7, day 30).
   Plain, readable charts in the UI kit's style; a date range; works on a phone.
4. **Privacy:** minimal data, world names only, admin only, an event retention limit (say 180 days), and a short note in the spec of what's collected. The repo is public: no secrets, no rates.
5. **The migration** is new and unapplied: write it, test it locally (the SQL smoke chain), and stop. The coordinator applies it to prod after David approves the page.
6. **Evidence:** the dashboard with realistic made-up data in dev (desktop and phone), and the funnel and quit views filled from a local backfill of the existing tables if you can get a copy of the shapes (never real prod data in evidence). A questions card (which steps David wants in the funnel, retention window, anything to cut).

Evidence `an1-*` in `specs/evidence/analytics/r1/`.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, the SQL smoke chain with the new migration, headless shots. Show that the tracking adds no work per frame.

## Status (round 2 built, awaiting review)

Head: see `git log -1` on game/analytics. Not merged, migration not applied. origin/main merged (to 25ffc2a4f's line, 129 commits).

- **Round 2:**
  - **The look:** the game's flat kit (design bible UI, row 320), not a dashboard restyle: none has landed on origin/main (the admin pages still wear the cream kit through `--gui-*`; `/admin/npo` is a bare dark table). The page wraps itself in `data-gui-flat` and wears `data-ui-theme` clean or dark from `prefers-color-scheme`.
  - **Charts are kit pieces:** `components/gui/flat/charts.tsx` (+ `charts.module.css`): `StatTile`, `Delta`, `ChartCard`, `TimeChart` (bars and lines, crosshair read-out), `BarRows` (funnel, quits, features, kinds), `Columns`, `Heatmap`, `Segmented` (the range), `Legend`. In the showroom at `/lab/gui#charts`. Colours: `--ui-chart` and `--ui-chart-gain` (validated with the dataviz script, light passes; dark.css's two values changed to `#5f88e6` and `#22a596` so dark passes the lightness band: dev-only theme, the rod radar in dark shifts a little), a new `--ui-good` token in clean, cream and dark.
  - **New numbers** (`lib/analytics/report.ts`): per day the week and month actives; `actives` (a day, week, month, stickiness), `retention` (day 1, 7, 30, the very next day), `tutorial`, `firsts` (time to first fish, sale, chapter), `sessionLengths`, `kinds` (every event kind in the log), `changes` (this period against the one before), `summary` (`summarize`, sentences from the numbers; no model call).
  - **Migration** renamed `20261106210000_game_events.sql` to `20261113120000_game_events.sql` (still unapplied; main now has 20261111 and 20261112 migrations). The kind check is now an id shape, so a new system logs its own kind without a migration (the route still takes only the code's kinds); the snapshot returns `kinds`. Smoke updated; the canonical chain lists the two site migrations and this one.
  - "Village" shows as Island (`screenLabel`); the ID card's new `id` sheet is a screen ("Island ID").
  - Scripts moved to `specs/evidence/analytics/r2/` (`sql-smoke.sh`, `backfill.sql`, `shoot.sh`, `shoot.mjs`).
- **Round 1** (still true): event log (`steps.ts`, `track.ts`, `POST /api/analytics/events`), hooks in `DefaultIslandWorld`, `hq/store.ts`, `lookStore.saveMyLook`, `collections.ts`; page `/student/dashboard/admin/game`, read route `GET /api/admin/game-analytics?days=`; dev twin `/dev/analytics` (now 30 days by default); privacy in `specs/analytics.md`.

- **Gates (r2):** tsc clean; vitest 3869 passed (4 skipped) both with and without `NEXT_PUBLIC_GAME_WORLD=new`; eslint clean on the changed files; the lane's SQL smoke fails before the migration and passes after, applies twice, security smoke passes, the snapshot takes 8 ms on the backfill; the canonical chain passes except `world_chat_smoke` "the rest" (pre-existing). No perf check: an admin page, nothing on the game's render path.
- **Evidence** (`specs/evidence/analytics/r2/`, made-up data, dev `now` 2026-11-13):
  - `an2-summary.png`: the summary card.
  - `an2-tiles.png`: this period (with changes) and active and coming back.
  - `an2-over-time.png`: players over time.
  - `an2-funnel.png`: the funnel as bars with the drop under each step.
  - `an2-quit.png`: where people stop for good, and where sessions end.
  - `an2-retention.png`: the cohort heatmap, session lengths and time to the firsts.
  - `an2-features.png`: features (used, came back) and time between steps.
  - `an2-kinds.png`: every kind of event, with a made-up `market_sale` as a new system's.
  - `an2-desktop.png`, `an2-phone.png`: the whole page; `an2-dark.png`, `an2-dark-phone.png`: dark.
  - `an2-backfill.png`: the summary and funnel from the local backfill of the game's tables.
  - `an2-kit.png`: the chart pieces in the showroom.
  - `an2-gate-signed-out.png`: signed out gets "Admins only".

## Next

1. The coordinator publishes "Player Analytics 2" and David answers the questions card.
2. Apply his answers (funnel steps in `steps.ts`, `GONE_DAYS`, the 180-day prune while unapplied, the summary's rules in `summarize`).
3. The coordinator applies `20261113120000_game_events.sql` after David approves. Until then the routes answer 503 and the tab stops sending.

Questions for David (round 2): the look is the game's flat kit, since no newer admin look exists on main: keep it, or match something else? Should the summary later be written by Claude (a small cost per view, or once a day) instead of the fixed rules? Are 28 funnel rows right, or a shorter list? Is 7 days the right "never came back" mark, and 180 days the right keep? Dark mode follows the viewer's setting: keep it?

## Tools and gotchas

- SQL: `zsh specs/evidence/analytics/r2/sql-smoke.sh [out.json]`. With a path, it also loads `backfill.sql` (90 made-up players) and writes the snapshot JSON there. Postgres port 55498.
- Shots: `LANE=game/analytics withlock.sh devserver zsh specs/evidence/analytics/r2/shoot.sh <snapshot.json>` (dev :3498, headless; `ONLY=an2-funnel,...` for some). The devserver lock is heavily contended: a wait can time out (exit 75), so retry.
- `member_identity` needs `world_name_key` with `world_name` (check constraint).
- `catch_rolls` rows are pruned after a day, so they're no history. Use `member_collections.first_collected_at`.
- The gui kit's `Tabs` inside `data-gui-flat` draws its highlighter marker in `--ui-highlight` (black), which reads as a strike through the picked tab: use the flat `Segmented` instead.
- Chart colours: run `node <dataviz skill>/scripts/validate_palette.js "<hex,hex>" --mode light|dark --surface <card>` before changing them.
- `player_positions` is never written, and `profiles.last_login_at` and `first_seen_at` are never written either: don't use them.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, claude-in-chrome or blender MCP tools.
- Locks: `LANE=game/analytics /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`, one shoot or measure per locked command, never a sleep hold; no background wait loops; bracket pgrep patterns. Never ports 3000, 3300, 3301, 3390.
- Commit with `[build]`; never push; never bare `git stash`; work only in this worktree; **never touch prod** (ask the coordinator for any read-only prod query, such as table shapes or counts).
- No em dashes; real names never show in game or on the dashboard; never write the gem-to-money rate anywhere. Ponytail code: search first, reuse, smallest change.
