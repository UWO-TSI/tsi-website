# Player analytics

David, 2026-11-06: "make a backened analytics dashboard to see players and like funnel for each major step and gauge engagement so that i can see whats wrong and what gts peopel to log out and never come back and similar analytics".

## The page

`/student/dashboard/admin/game` ("Players" on the admin hub). It's for T1 and T2 only: the page sits behind `AdminGate`, and the route it reads, `GET /api/admin/game-analytics?days=7|30|90|180`, checks `adminContext` before anything else. Signed out gets 401. T3 to T5 get 403, and nothing is read.

The route reads one snapshot with the service role and adds it up on the server (`web/lib/analytics/report.ts`). Account ids never reach the browser: the page gets world names and numbers.

Round 2 (David, 2026-11-13: "use the new ui, add important analytics, use graphs and a summerize section taht analyses and produceces a summary for the data on the admin side"): the page wears the game's flat kit (design bible UI, ledger row 320), light or dark from the viewer's setting, and its charts are kit pieces (`web/components/gui/flat/charts.tsx`, on `/lab/gui#charts`).

It shows, one card each:

- **What the numbers say:** plain sentences worked out on the server from the numbers (`summarize` in `report.ts`, no model call, no cost): the biggest moves against the period before (counts in percent with at least 3 behind them, shares in points, 5 or more), the worst drop between two funnel steps, day 7 retention of the newest old-enough signup week against the weeks before, where most quiet players stopped, and anything unusual (a day at 2.5 times a usual one, 3 or more days with nobody, an event kind the page doesn't know yet).
- **This period:** new players, players a day, sessions, typical session, the share who finished the tutorial (arrival done) and the share who came back the very next day, each against the same length of time before it. There's nothing to compare when the earlier period is past the 200 days the snapshot reads, and sessions need the log to have run the whole earlier period.
- **Active and coming back:** a day (the average of the last 7), a week, a month, stickiness (the day over the month), sessions a player, typical session, day 1, 7 and 30 retention (came back on that day or later, of the players who joined in the range and are old enough), the very next day, the tutorial's share, and quiet 7 days or more.
- **Players over time:** each day's players (bars), the players in the 7 days to it, and who joined (lines). Hover or tap a day for its numbers.
- **Players:** a list of every player: world name, joined, last seen, sessions, time played and furthest step.
- **The funnel:** each step in `web/lib/analytics/steps.ts`, in order. It runs from sign-in through the opening, the creator, the crossing, every walk-along stop and every HQ beat, then the first fish, the first sale, arrival done, the first chapter, day 2 and day 7.
  - For each step: how many players reached it, out of how many, and the drop from the step before.
  - It counts players who joined in the range since the log's first session, the same people at every step, so each drop is real.
  - Before the log has run, it counts everyone who joined in the range, over the steps the tables keep. Steps only the log knows (`log` in `steps.ts`) show "not logged yet".
  - Players in the range who joined before the log get their own short list, "Joined before the log", built from the tables' steps.
- **Where sessions end:** the screen the player was on when the session ended (island, room, or open sheet), ranked.
- **Where people stop for good:** for players quiet for 7 days or more, the last screen of their last session, ranked. With no logged session (history), it uses the furthest step they reached.
- **Engagement:** sessions, typical and average length, sessions per player, and the typical minutes between consecutive funnel steps.
- **Features:** players who used each feature in the range, and how many came back to it on another day.
- **Retention by signup week:** a heatmap of the share who played again 1, 7 and 30 days later. A cell shows "soon" until the whole week is that old.
- **How long a session lasts:** sessions by length (under 1, 1 to 5, 5 to 15, 15 to 30, 30 to 60 minutes, over an hour), and the typical time from joining to the first fish, the first sale and the first chapter.
- **Every kind of event:** each kind the log holds in the range, with its count and players. A new system's kind (the markets, the login calendar, gem purchases) shows by its id, marked new, as soon as it's logged, and the summary names it.

## What is collected (the event log)

There's one table, `game_events` (migration `20261113120000_game_events.sql`, unapplied; renamed from `20261106210000` in round 2 so it sorts after the newest migration on main). Each row is:

- member id
- session id (random, one per page load of the member island)
- kind: `session_start`, `heartbeat`, `session_end`, `step` or `feature` today. The table takes any id-shaped kind, so a new system logs its own without a migration; the route takes only the kinds in code.
- step or feature id (a new kind may carry its own detail id here; the session kinds never do)
- screen id
- time

Ids come only from the lists in `steps.ts` (the route refuses anything else), and the table's checks refuse anything not shaped like an id. There's no free text, no names, no emails, no positions and no device data.

- **Who sends:** only the member island (`DefaultIslandWorld` calls `startSession`). The applicant island shares components but never starts a session, so it sends nothing.
- **When:**
  - a session's start;
  - a heartbeat every 3 minutes while the tab is visible;
  - the end, as a beacon on pagehide;
  - each funnel step the first time in a session (the opening's phases and walk stops from the arrival store's change notice, the HQ beats from the HQ store, the creator from `saveMyLook`);
  - each feature's first use in a session (from the writes the routes already announce, `API_WRITE`, and the catch route).
- **Cost:** nothing runs per frame. Events queue in memory and go out in one POST at most every 15 seconds, or in a beacon on pagehide.
- **The route** is `POST /api/analytics/events`. It checks the session (401 signed out), validates every id, takes at most 25 events per request and 40 per member per minute (429 after), and dates each event with the server's clock less the time it waited in the tab (at most 15 minutes).
- **Access:** RLS is on with no policies, and everything is revoked from anon and authenticated, so members can't read or write the table. `game_analytics_snapshot` and `game_events_prune` run for `service_role` only.
- **Retention:** rows go after 180 days (`game_events_prune`, daily through pg_cron where it exists).

## History from before the log

The snapshot also reads the game's own tables, so the page has numbers from day one:

| Answer | Source |
|---|---|
| Players | profiles that are members, or have played (the log, or the arrival paid) |
| Character made | `profiles.avatar_config ? 'look'` (time: `member_identity.name_set_at`) |
| Arrival done | `wallet_ledger` source `quest`, ref `arrival` |
| First sale | first `wallet_ledger` source `sell` |
| First fish | `member_collections.first_collected_at` of a fish or sea species |
| First chapter | `member_quest_progress.completed_at` |
| Active days, last seen | the log, `wallet_ledger`, `daily_login_claims` (the daily gift claims on every visit), `craft_log`, `combat_kills`, `study_sessions`, `world_chat_messages`, `museum_handins`, `volleyball_casual_tickets`, `sushi_orders`, `chef_order_fills`, `fishing_task_claims` |
| Feature days | the ledger's sources (sell, shop, daily gift, dig, friend, volleyball, campfire, mission, study, chapter) and the tables above |

The tables can't tell the opening's beats, the walk's stops, the HQ beats, sessions, screens, fishing days (catch rows are pruned after a day) or session length. Those exist only from the day the log ships.

## Files

- `web/lib/analytics/steps.ts`: the one list (steps, features, screens).
- `web/lib/analytics/track.ts`: the tab side.
- `web/lib/analytics/report.ts`: the numbers.
- `web/lib/analytics/demo.ts`: made-up players for `/dev/analytics`.
- `web/app/api/analytics/events/route.ts`: the event route.
- `web/app/api/admin/game-analytics/route.ts`: the read route.
- `web/components/gui/flat/charts.tsx`: the kit's charts (tiles, a time chart, bars along rows, columns, a heatmap, the range pills).
- `web/components/portal/GameAnalytics.tsx` and `web/app/student/dashboard/admin/game/page.tsx`: the page.
- Smoke: `web/supabase/tests/game_events_smoke.sql`, in the chain at `specs/evidence/launch-fixes/sql-smoke.sh`.
