# Player analytics

David, 2026-11-06: "make a backened analytics dashboard to see players and like funnel for each major step and gauge engagement so that i can see whats wrong and what gts peopel to log out and never come back and similar analytics".

## The page

`/student/dashboard/admin/game` ("Players" on the admin hub). It's for T1 and T2 only: the page sits behind `AdminGate`, and the route it reads, `GET /api/admin/game-analytics?days=7|30|90|180`, checks `adminContext` before anything else. Signed out gets 401. T3 to T5 get 403, and nothing is read.

The route reads one snapshot with the service role and adds it up on the server (`web/lib/analytics/report.ts`). Account ids never reach the browser: the page gets world names and numbers.

It shows:

- **Players:** the total, new in the range, played today, played this week, and quiet for 7 days or more. There's a chart of players per day (new ones darker) and a list of every player: world name, joined, last seen, sessions, time played and furthest step.
- **The funnel:** each step in `web/lib/analytics/steps.ts`, in order. It runs from sign-in through the opening, the creator, the crossing, every walk-along stop and every HQ beat, then the first fish, the first sale, arrival done, the first chapter, day 2 and day 7.
  - For each step: how many players reached it, out of how many, and the drop from the step before.
  - It counts players who joined in the range.
  - Steps only the event log knows (`log` in `steps.ts`) count only players who joined after the log's first session, so history doesn't read as drop-off.
- **Where sessions end:** the screen the player was on when the session ended (island, room, or open sheet), ranked.
- **Where people stop for good:** for players quiet for 7 days or more, the last screen of their last session, ranked. With no logged session (history), it uses the furthest step they reached.
- **Engagement:** sessions, typical and average length, sessions per player, and the typical minutes between consecutive funnel steps.
- **Features:** players who used each feature in the range, and how many came back to it on another day.
- **Retention by signup week:** the share who played again 1, 7 and 30 days later. A cell shows "soon" until the whole week is that old.

## What is collected (the event log)

There's one table, `game_events` (migration `20261106210000_game_events.sql`). Each row is:

- member id
- session id (random, one per page load of the member island)
- kind: `session_start`, `heartbeat`, `session_end`, `step` or `feature`
- step or feature id
- screen id
- time

Ids come only from the lists in `steps.ts`, and the table's checks refuse anything else. There's no free text, no names, no emails, no positions and no device data.

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
- `web/components/portal/GameAnalytics.tsx` and `web/app/student/dashboard/admin/game/page.tsx`: the page.
- Smoke: `web/supabase/tests/game_events_smoke.sql`, in the chain at `specs/evidence/launch-fixes/sql-smoke.sh`.
