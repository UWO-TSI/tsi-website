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

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, claude-in-chrome or blender MCP tools.
- Locks: `LANE=game/analytics /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`, one shoot or measure per locked command, never a sleep hold; no background wait loops; bracket pgrep patterns. Never ports 3000, 3300, 3301, 3390.
- Commit with `[build]`; never push; never bare `git stash`; work only in this worktree; **never touch prod** (ask the coordinator for any read-only prod query, such as table shapes or counts).
- No em dashes; real names never show in game or on the dashboard; never write the gem-to-money rate anywhere. Ponytail code: search first, reuse, smallest change.
