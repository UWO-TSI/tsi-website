# Lane: analytics (the game's player analytics dashboard)

Worktree `.claude/worktrees/analytics`, branch `game/analytics`, cut from origin/main 16e7152df. Agent type `uwotsi-lane`. Dev port 3498.

**Read first:** `specs/lanes/README.md`, `specs/lane-rules.md`, `STATE.md` (prod, migrations), `CODEMAP.md` (the game's server routes and stores), `web/lib/server/adminContext.ts` (T1/T2 admins), the arrival, progression, quests, wallet, catches and collections code and tables. Recruitment owns `web/app/admin/recruit`, `web/components/admin/` and its migrations: don't touch them. `middleware.ts` and `web/lib/supabase/*` belong to the play.tethos.ca session: don't edit them; ask the coordinator if you need a change there.

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

## Status (round 1 built, awaiting review)

Head: see `git log -1` on game/analytics. Not merged, migration not applied.

- **Event log:** `web/lib/analytics/steps.ts` (the one list), `track.ts` (tab side: batched, beacon on pagehide, 3-min heartbeat while visible, no-op until the member island calls `startSession`), `POST /api/analytics/events` (session checked, ids only, 25 a request, 40 a member a minute).
- **Hooks:** `DefaultIslandWorld` (session, screen, arrival phases and walk stops through `subscribeArrival`), `hq/store.ts` (HQ beats), `lookStore.saveMyLook` (creator), `collections.ts` catchRequest (fishing, foraging). Features also come from `API_WRITE`.
- **Page:** `/student/dashboard/admin/game` ("Players" on the admin hub), `components/portal/GameAnalytics.tsx`. It reads `GET /api/admin/game-analytics?days=` (adminContext), and `lib/analytics/report.ts` adds it up on the server. The dev twin is `/dev/analytics` (made-up players, or `?source=backfill` with `ANALYTICS_SNAPSHOT=<json>`).
- **Migration** `20261106210000_game_events.sql` (unapplied):
  - the `game_events` table, with RLS on, no policies, and access revoked from anon and authenticated;
  - `game_events_prune` (180 days; daily pg_cron job `game-events-prune` where pg_cron exists);
  - `game_analytics_snapshot(p_since)` (service_role only).
  - Smoke: `web/supabase/tests/game_events_smoke.sql`, added to the canonical chain.
- **Spec:** `specs/analytics.md` covers what's collected, privacy and the history sources.
- **Gates (r1):**
  - tsc clean;
  - vitest 3805 passed, both with and without `NEXT_PUBLIC_GAME_WORLD=new`;
  - eslint clean on the changed files;
  - the lane's SQL smoke fails before the migration and passes after, applies twice, and the security smoke still passes;
  - the canonical chain passes except `world_chat_smoke` "the rest", which also fails with this migration cut (pre-existing).

## Next

1. The coordinator reviews and publishes the an1 page with the questions below. David answers.
2. Apply his answers: cut or rename funnel steps (`steps.ts`), the quiet window (`GONE_DAYS`), the retention window (180 days in the migration's prune, while the migration is still unapplied), and who counts as a player.
3. The coordinator applies the migration after David approves the page. Until then, the route answers 503 and the tab stops sending (`off`).

Questions for David: Are these the funnel steps he wants (28 rows: every opening phase, walk stop and HQ beat), or a shorter list? Is 7 days the right "never came back" mark? Should events be kept 180 days? Is a player a member, or anyone who played? Anything to cut?

## Tools and gotchas

- SQL: `zsh specs/evidence/analytics/r1/sql-smoke.sh [out.json]`. With a path, it also loads `backfill.sql` (90 made-up players) and writes the snapshot JSON there. Postgres port 55498.
- Shots: `LANE=game/analytics withlock.sh devserver zsh specs/evidence/analytics/r1/shoot.sh <snapshot.json>` (dev :3498, headless). The devserver lock is heavily contended: a wait can time out (exit 75), so retry.
- `member_identity` needs `world_name_key` with `world_name` (check constraint).
- `catch_rolls` rows are pruned after a day, so they're no history. Use `member_collections.first_collected_at`.
- `player_positions` is never written, and `profiles.last_login_at` and `first_seen_at` are never written either: don't use them.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, claude-in-chrome or blender MCP tools.
- Locks: `LANE=game/analytics /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`, one shoot or measure per locked command, never a sleep hold; no background wait loops; bracket pgrep patterns. Never ports 3000, 3300, 3301, 3390.
- Commit with `[build]`; never push; never bare `git stash`; work only in this worktree; **never touch prod** (ask the coordinator for any read-only prod query, such as table shapes or counts).
- No em dashes; real names never show in game or on the dashboard; never write the gem-to-money rate anywhere. Ponytail code: search first, reuse, smallest change.
