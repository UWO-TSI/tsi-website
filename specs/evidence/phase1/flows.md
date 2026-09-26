# Phase 1 signed-in flows on staging (2026-09-26)

Dev server on `:3500` from this worktree, env from `web/.env.staging.local` only (staging URL and keys; no `.env.local`), under the shared dev-server lock. Users signed in through `/student/login` (Supabase password auth); the session cookie (`sb-jjiyeroyralfbluowbjq-auth-token`) was saved and reused for every API call, so the flows ran through the real Next routes → service → store → staging Postgres. Screenshots from a headed Chromium (headless can't get WebGL here). Readbacks are `psql` against staging. All flows were rerun end to end after merging `feat/game-default-island` (crafting + study × character) at 16:39Z, on reset test data.

Accounts: **member** (tier 4, `membership = member`), **public** (tier 4, `public`), **staff** (tier 2). Ids in `applied.md`.

**Final run (17:15–17:30Z)** after also merging `game/polish-ownership` (`20260926180000_ownership`, applied to staging): every flow rerun on reset data, all pass; log `flows-final-run.txt` (the first run with its failures is `flows-run.txt`). Changes the merge brought: decorating now refuses an unowned wallpaper (`422 not_owned`, then passes after buying `wall-brick`); the starter kit is granted once (24 items in `member_inventory`); the creator's look is saved through `PATCH /api/profile` (server-checked); `/api/study/tables` is gone (tables come with `/api/study/state`). Security run: 46 checks (adds "member can't set own `avatar_config`").

## Results

| # | Flow | Result |
|---|---|---|
| 1 | Chapter 1: claim plot, first catch, donate, report to HQ; club-goal contribution; monument progress | **Pass after fix** (first run: report to HQ → 500, chapter saved as completed, 100-coin reward never paid; fixed by `20260926155100`) |
| 2 | Catch with size record, sale, museum donation, duplicate refused | Pass |
| 3 | Study: sit, start, one block on the server clock, settlement, walk-away | **Pass after fix** (resume after a reload left the avatar in the plaza while "studying", so walk-away never fired; dev-only, fixed in `StudySeats.tsx`) |
| 4 | Room purchase; decorate and reload | Pass |
| 5 | Oracle reading to completion; respec with the coin fee | Pass (7-day cooldown bypassed with a staging fixture) |
| 6 | Letters between the accounts, notice board, reports | Pass |
| 7 | Merch reserve (member), fulfil and cancel (staff) | Pass (API only: no staff UI calls `/api/economy/admin/merch`) |
| 8 | Combat: gate check, mission start → complete, XP and durability | Pass; gate is not enforced server-side (question 4) |
| 9 | Security guarantees | **Pass after 3 fixes** (46/46 checks in the final run; see below) |
| + | Character creator (first login), crafting (merged mid-run) | Pass |

## 1. Chapter 1 and the club goal (member)

`POST /api/progression/chapters/advance` `claim_plot` 200 → `report_hq` 409 "Claim your plot and donate a catch first." → `POST /api/collections` `fish_dace` 14.2 cm 200 → `POST /api/collections/museum/donate` 200 → `donate_catch` 200 → `report_hq` 200. Wallet 100 coins; mailbox has the chapter letter.

```
settle-in | completed | {"claim_plot": …, "first_catch": …, "donate_catch": …, "report_hq": …} | fish_dace
letters:        system | Settle in | chapter:settle-in
wallet_ledger:  100 | 100 | chapter | settle-in
```

Contribution: 50 coins then 10 coins, the 10 resent with the same idempotency key (200, no second debit). Monument (`reopen-cafe`) 0 → 60 points, `my_points` 60; wallet 40.

```
reopen-cafe | coins | 50 | 50 | 50
reopen-cafe | coins | 10 | 10 | 10
wallet_ledger: -50 | 50 | goal ;  -10 | 40 | goal
```

Journal button path: the public account's "Claim plot" button in the journal (`P1-08`) wrote `settle-in | active | {"claim_plot": …}`.

## 2. Catch, sale, museum (member, public)

Anchovy 11 cm (record) → 14.5 cm (record) → 12 cm (kept 14.5) → 999 cm (clamped to the species max, 15.0). Sold 2 (`POST /api/economy/sell`), same key resent: credited once, 40 → 56. Anchovy donated by the member; the public account's donation of the same species → 409, the member's second → 409.

```
member_collections: member fish_anchovy count 1, total 4, best 15.0 ; public fish_anchovy count 1, best 12.0
museum_donations:   fish_dace by member 14.2 ; fish_anchovy by member 15.0
wallet_ledger:      16 | 56 | sell | fish_anchovy
```

`P1-03`: the public account inside the museum sees "Dace / Anchovy — Donated by Phase1 Member".

## 3. Study (member)

- Block to completion: `POST /api/study/sit` (pier table, seat 1) → `POST /api/study/start` 5/1 × 1. Focus ran on the server clock (16:48:30 → 16:53:30Z); the heartbeat after it settled the session: `ended | 5 min | bonus 2 | coins_paid 7 | end_reason finished`, ledger `7 | study`.
- Final run, API only with a heartbeat every 60 s (what the HUD sends): block `finished`, 5 min + 2 bonus = 7 coins; then a second session ended by walking away after 2 min: `left`, 2 coins. Without any heartbeat a session times out at the last heartbeat and pays nothing (`end_reason timeout`), as the 5-minute grace rule says.
- Walk-away: second session, island reloaded while seated. **Before the fix** (`P1-04a`) the HUD showed "Focus 04:21 · Pier table" while the avatar stood in the plaza; walking to the shore did not end it (the avatar was never seated, so walk-away never armed). Cause: React Strict Mode (dev) re-runs StudySeats' scene-change cleanup after the first frame has seated the avatar; it cleared the seat but kept the once-per-session guard. With Strict Mode off (as in a production build) the same reload seated the avatar, so production is not affected. **After the fix** (`P1-04b`) the avatar resumes at the pier; walking off ended the session: `ended | 1 min | bonus 0 | coins_paid 1 | end_reason left`, ledger `1 | study`.

## 4. Home (member)

`GET /api/homes`: 1 room, next room 500 coins. The member had 56 coins and there is no admin coin grant route, so staging got a fixture credit (`wallet_apply(…, 1500, 'admin', …)`, ledger-visible). `POST /api/homes/rooms` at 500 → `rooms_count 2`, `home_room_purchases: room 2 | 500`. Bought the cream rug (`POST /api/economy/buy`, 140 coins), then `PUT /api/homes/layout`: room 2 wallpaper `brick00`, rug at (2,2) rot 1, starter lamp moved to (5,1) rot 2 → revision 2; the same save on the old revision → 409; reload returns the edit.

```
0 | room-1 | plaster00 | simpleparquet00 | […{"uid":"starter-lamp","cell":[5,1],"rot":2}…]
1 | room-2 | brick00   | tatami00        | [{"uid":"p1-rug","piece":"lounge-rug","cell":[2,2],"rot":1}]
member_homes: rooms_count 2, revision 2
```

`P1-05`: `?home=inside` after reload shows the moved lamp and room 2's brick wall, tatami and rug.

## 5. Oracle (member)

`POST /api/oracle/start` (free) → 64 items answered (`/answer`) → `/finish` returned tie-breakers → finished with `tie_answers`: ESTJ, **Ranger**, fee 0. A second start → 409 `cooldown` until +7 days. Fixture: moved the reading and `quiz_taken_at` 8 days back. `/api/oracle/me` then offered `{"kind":"respec","fee":250}`; second reading → INFP, **Warden**, 250 coins charged.

```
oracle_attempts: completed ESTJ Ranger 0 ; completed INFP Warden 250
respec_log:      Ranger → Warden | 250 | respec:oracle-…
wallet_ledger:   -250 | 526 | respec
profiles.class = Warden, member_identity = INFP/Warden
```

## 6. Letters, notice board, reports (member, public, staff)

Member → public note 200; public sees it, marks it read, replies; member sees the reply; a note to yourself 400; public reports the note 200; the sender reporting their own sent note 404; member reports the public account's name 200.

```
note | from member | to public | Hi from the pier | read | reported | test report
note | from public | to member | Re: pier
identity_reports: member → public | name test
```

Notice board: staff credited `reopen-cafe` to its 15,000-point target (`POST /api/progression/goals/reopen-cafe/credit`, T1/T2 only; the member gets 403). The goal completed (stage 4), the broadcast "The cafe is open" reached all three accounts (`letters.broadcast_key = goal:reopen-cafe:0`, one row each), and chapter 2 completed for the member. This broadcast path used the same broken upsert as flow 1 before `155100`. `P1-02`: the member's mailbox with the chapter letter, the cafe broadcast and both notes. `P1-07`: the public account's journal.

## 7. Merch (member, staff)

Staff awards the member 1,000 Gems (`POST /api/economy` `award`; the member → 403). Member reserves the sticker pack (150) and the tote (600); member can't list or resolve reservations (403). Staff fulfils the sticker pack and cancels the tote: Gems 850, stock sticker 100 → 99, tote 30 → 30.

```
merch-sticker-pack | 150 | fulfilled | picked up at GENESIS | by staff
merch-tote         | 600 | cancelled | out of totes         | by staff
tc_transactions: 1000 earn_admin ; -150 spend_merch ; -600 spend_merch ; +600 refund_merch
```

## 8. Combat (member)

`GET /api/combat/progression`: `{"level":1,"family":"Warden","gateOpen":false,"reason":"Reach level 10."}`. **An inner-zone mission (`hunt-wisps`) still started (200)** with the gate closed (abandoned right after; question 4). `hunt-foxes`: 6 × `POST /api/combat/kill` (30 XP each), progress events → `ready`, `/complete` → 300 XP + 60 coins; a second turn-in replays with no reward. Wear 40 hits → sword 50/90, repair 40 coins → 90/90.

```
member_progression: xp 480, level 3
combat_xp_ledger:   6 × 30 kill ; 300 mission hunt-foxes
member_weapons:     sword-driftwood 90 (equipped) ; wraps-cloth 90
mission_progress:   hunt-wisps abandoned ; hunt-foxes completed
wallet_ledger:      60 mission ; -40 repair
```

`P1-06`: the ruins with the equipped sword at 90/90.

## 9. Security guarantees (member and public JWTs, public anon key, straight at PostgREST)

46 checks in the final run (45 before the ownership merge), all pass after the fixes (`security-run.txt`; every request and readback of the whole run is in `flows-run.txt`). Profile updates sent with `Prefer: return=minimal` so the UPDATE really runs and the #40 guard answers:

- Own `tier`, `class`, `subclass`, `tethos_coins`, `xp`, `level`, `membership`, `is_active` → 403 "profiles: … can only be changed by the server"; public → `membership = member` refused; own `bio` still 204. Readback unchanged (tier 4, coins 0, xp 0, member).
- INSERT refused (42501) on `wallet_ledger`, `wallets`, `tc_transactions`, `member_collections`, `museum_donations`, `club_goal_contributions`, `combat_xp_ledger`, `member_progression`, `member_weapons`, `member_inventory`, `merch_reservations`, `letters` (system), `study_sessions`, `member_identity`, `home_room_purchases`; UPDATE affects nothing on `wallets`, `member_progression`, `member_weapons`, `member_collections`, `study_sessions`, `member_identity`.
- RPC: `wallet_apply` (coins and Gems), `combat_grant_xp`, `daily_gift_claim` → "permission denied for function". Only five SECURITY DEFINER functions are executable by `anon`/`authenticated` at all: `increment_invite_uses`, `get_election_results`, `current_tier`, `can_edit_kanban_board`, `invite_code_valid`.
- Reads: another member's email/phone (column grants) refused; another member's ledger and mail return nothing.
- Every `public` table has RLS on.
- Sign-up trigger (reconciled `handle_new_user`): Google-shaped metadata (`full_name` only) → display name "Grace Hopper", `public`; an anonymous `POST /auth/v1/signup` carrying `invite_code: "tethos-w26"` (the seeded, public code) → `member`. Works as ruled, which is why question 2 matters. Both throwaway users deleted.

Found and fixed (each with a fail-first section in `web/supabase/tests/phase1_regressions.sql`):

| Hole | Fix |
|---|---|
| A member could insert their own `event_attendance` row as `attended` for any IRL event: staging paid 50 coins + 2,000 combat XP (and club-goal event points) through the launch triggers. Present in production today (without the triggers). | `20260926155200`: insert policy is RSVP-only. |
| Invite codes were readable by anon (production hand-made policy) and by any signed-in user (001), and an active code makes a sign-up a member. | `20260926155300` + `/student/signup` uses `invite_code_valid()`. The seeded code is public in git: question 2. |
| `member_badges` was readable with the anon key (every account id, member badge, family): Supabase's default privileges had granted anon before identity's `GRANT … TO authenticated`. | `20260926155400`: revoke anon. |

## Light-tier frame rate (`P1-09`)

**This is the M4 Mac mini, not an integrated-GPU student laptop; it does not satisfy decision 39's check.** Headed Chromium 147, ANGLE Metal on Apple M4, 1440 × 900 viewport at DPR 2 (2880 × 1800 backbuffer), 144 Hz display, dev build (includes dev overhead), signed in as the member, Quality = Light, walking a loop from the clearing to the pier for 30 s, 12 samples of the island's own Performance readout:

| | FPS | ms/frame | draws | triangles |
|---|---|---|---|---|
| min | 138 | 7.2 | 360 | 165,230 |
| median | 142 | 7.0 | ~400 | ~177,000 |
| max | 143 | 7.0 | 432 | 183,659 |

Capped by the 144 Hz refresh, so it says nothing about headroom. What will matter on an integrated GPU: Light still issues 360–432 draw calls and the Shadows toggle stays on under Light.

## Only works in demo mode / not wired signed in

- Nothing in the nine flows needed a demo store; every flow above ran on staging.
- Merch fulfil/cancel has an API but no staff screen.
- The mission and kill events that pay XP are client-reported (per design); the ruins gate is client-side only.
- `/api/shop`, `/api/inventory` and the avatar purchase in `/api/economy` read `avatar_items`, which production never had (005 never ran); there the `/api/shop` query errors and the route answers 503 (from the code; not called against production). The island's economy uses `/api/economy/shop`, so the flows didn't touch them.

## Fixtures used (staging only)

1,500 coins via `wallet_apply` (no admin coin route), Oracle cooldown moved back 8 days, reopen-cafe credited to target by the staff route (real route), two IRL test events inserted by SQL. Test data reset between runs with a staging-only script that deletes the three test users' rows.
