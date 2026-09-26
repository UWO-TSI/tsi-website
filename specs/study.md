# Study spec (cafe tables, Pomodoro sessions, coins, stats)

Owner: systems agent (sessions, accrual, presence, stats) now; island agent later for seats and cafe interior (David supplies the interior design). Decisions: rows S1, 72–80, 81, 118–119, 126, 164–171, 214. Ledger wins.

## Fixed decisions

| Topic | Decision | Row |
|---|---|---|
| Where | Cafe (opens with chapter 2) plus outdoor tables; seating mix: window tables, 2-seat, 4-seat, couch area; layout per David's interior design later | S1, 164, 167 |
| Who | Anyone with an account; public accounts allowed | 74, 75 |
| Tables | Open or private (host locks for friends); private shows occupied | 168 |
| Timers | Personal: pick focus length, break length, cycles at sit-down; presets 25/5×4, 50/10×2; independent per person | 73, 165 |
| Overhead | Countdown of current focus block; break countdown during breaks | 78 |
| Breaks | Character stretches at the seat; table chat unmutes; leaving the seat still ends the session | 166 |
| Coins | 1 play coin per completed focus minute, +10 per completed 25-min block (scale bonus with block length); paid at finish/end; ending early keeps minutes, no bonus | 79, 126 |
| Leaving | Leaving the seat ends the session; new session on return; other tabs/apps allowed | 80 |
| Recovery | 5-minute grace on disconnect/sleep, then session ends with minutes paid | 170 |
| Background | Tab title shows countdown; chime at block end; low-rate rendering in background tab | 169 |
| Social | Quiet emotes, optional table text chat muted during focus by default; no voice/video | 77 |
| Stats | Personal totals (minutes this week, longest block); opt-in cafe board of this week's top studiers | 171 |
| Phone | Same tables/timers/rewards through the companion; low-detail 3D cafe view later | 81, 118, 119 |
| Notifications | In-game only | 214 |

## Deliverables (systems agent)

1. Migration draft `20260926150500_study.sql`: study_tables (location, seats, kind, host, is_private), study_sessions (member, table, seat, focus_len, break_len, cycles, started_at, phase, phase_started_at, last_heartbeat, ended_at, minutes_completed, bonus_paid, coins_paid), study_weekly_stats view, member opt-in flag for the board. Coins credited through a service-role function, idempotent per session.
2. Routes `/api/study/*`: tables (list with occupancy and privacy), sit (seat claim, host lock), start (settings), heartbeat (drives phase changes server-side, 5-min grace), break/resume, end (settles minutes and bonus once), stats, board (opt-in top studiers this week). Presence: seat-mates with name, phase and remaining time.
3. Shared client hook `web/lib/study/useStudySession.ts` used by both the game and the phone companion: settings, phase, remaining, seat-mates, chat mute state; tab-title countdown and chime.
4. Phone companion page `/student/companion/study` (mobile-first, no 3D yet): join a table, timer, seat-mates list, coins earned.
5. Tests: accrual math (minutes, bonus, early end), grace period, seat conflicts, private table lock, idempotent settlement. Screenshots under `specs/evidence/study/`.

## Out of scope

Cafe interior model, seat props in the world, the 3D phone cafe view, chat moderation beyond the existing profanity filter.

## Questions

`specs/study-questions.md`.
