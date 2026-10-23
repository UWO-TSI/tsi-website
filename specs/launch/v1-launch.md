# v1 launch run (Oct 22 to 31)

David, 2026-10-22. Ledger row 317. The plan is `specs/v1-drop.md`; this is the run to launch day, owned by the coordinator. The launch target is still **October 31**.

## David's decisions (2026-10-22)

- **Feature freeze on Oct 24.** The running lanes finish their current batch. Whatever David approves by Oct 24 merges and gets tested; anything else ships after launch. From Oct 25, only launch fixes go in.
- **Halloween costumes:** "later problem get the game done first". The closet ships with what it has.
- **Perf:** a quiet window on the Mac mini. David closes Roblox, Dia, Discord and Spotify for about 30 minutes while the bench runs; the coordinator tells him when.
- **Live test:** an automated two-account test on a Preview first, then David and one friend play for about 15 minutes.

## Where things stood on Oct 22 (audit, corrected)

- **Must-ship features are in code:** the opening and tutorial, HQ onboarding, name tags, chat, emotes and dances, the campfire, friends and join, photo mode, Halloween, drop gating, moderation routes.
- **Never run live with two players:** chat, friends, join, report through to a live mute, the campfire.
- **Prod migrations:** every game migration is applied, per `~/tethos-launch-2026-09-29/migrations.log`. They're applied through the query API, so Supabase's own migration ledger doesn't list them; don't read that ledger as "unapplied".
- **Realtime (Fly `tethos-rt`):** released v3 on Oct 13 and v4 on Oct 14, after the chat and friends code; v5 on Oct 22; v6 on Oct 23 (every Supabase read logged as `db_read`, one retry for the card and blocks reads, friends reloaded after a failed read).
- **Prod Supabase (`rtbkrngsdbptbjhfbcud`, us-west-2): compute is Small (2 GB) since Oct 23, 02:42 Toronto.** It was on Nano (0.4 GB, more swapped out than in RAM), so the first reads after an idle spell stalled 3+ s and joins were refused for minutes. Live check on Small and realtime v6 (Oct 23): 23 joins from fresh contexts, 3 of them after a 10 minute idle, 0 refusals, the slowest 991 ms; every read 73 to 257 ms; no swap. Evidence: `specs/evidence/realtime-joins/`.
- **Moderation env vars (corrected by the launch lane, Oct 22):**
  - already set: `REALTIME_INTERNAL_URL` and `REALTIME_INTERNAL_SECRET` on Vercel (Preview and Production, since Oct 7), and `REALTIME_INTERNAL_SECRET` on Fly (its `/internal/*` endpoints are on);
  - a live route answering `realtime: "applied"` proves the two secrets match.
- **Previews:**
  - Preview env has `NEXT_PUBLIC_MEMBER_WORLD=open` and the prod realtime URL, and uses the prod Supabase project;
  - it has no `SUPABASE_SERVICE_ROLE_KEY`, so every game route answers 503 there;
  - a test Preview gets the key for that deployment only (`vercel deploy -e SUPABASE_SERVICE_ROLE_KEY=…`), never in the project's Preview env.
- **Not done:**
  - opening the member world (`NEXT_PUBLIC_MEMBER_WORLD=open` and a redeploy);
  - a perf baseline on merged main;
  - the MacBook Air check;
  - smoke flows 3 to 5 (flow 4 still says "Claim plot", but the home island is hidden in v1);
  - the `v1-drop.md` launch checklist.
- **Perf:** the village has read 8 to 36% over the Oct 14 baseline in every run since, on a busy machine. It has to be measured properly.
- **Halloween:** it runs Oct 25 to Nov 1. Two costumes for now.

## Checklist

| # | When | What | Owner |
|---|---|---|---|
| 1 | Oct 22 | Rewrite `STATE.md`; this file; freeze announced to the lanes | coordinator |
| 2 | Oct 22–24 | The running lanes finish (HQ layout B, flat UI round 3 and the creator, the visor logo and the merch catalogue). David reviews; whatever he approves merges by Oct 24 | lanes, David |
| 3 | Oct 23–24 | A Preview with the member world open. The env vars checked, with moderation working | launch lane |
| 4 | Oct 23–24 | An automated two-account test on the Preview: chat, a friend code, join, report through to a live mute, the campfire with 2+ dancers, emotes and dance sync, name tags | launch lane |
| 5 | Oct 23–24 | Smoke flows 3 to 5 updated for v1 and run | launch lane |
| 6 | Oct 24–25 | The perf bench on merged main in a quiet window: fix the village regression, then refresh the baseline | perf lane, David (quiet window) |
| 7 | Oct 25 | Halloween on the Preview: pumpkins, door knocks, fog nights, the costume closet | launch lane |
| 8 | Oct 25–26 | MacBook Air: play the Preview and bench it | David, coordinator |
| 9 | Oct 26–27 | David and one friend play the Preview for about 15 minutes from fresh accounts. Collect David's lines (Bram, Wren, the doors) and the plaque text | David |
| 10 | Oct 28–30 | Fix only what the play-through and the tests find. Runbook section 0: tests, smoke, backup | lanes, coordinator |
| 11 | Oct 31 | Open the member world, redeploy, run smoke flows 3 to 5 live, watch Fly and Supabase | coordinator |

## After launch (parked)

- HQ and the flat UI, if not approved by Oct 24.
- Halloween costumes.
- Fallen leaf piles.
- The body rework.
- Building exteriors.
- Lanyard snap-hook close-ups.
- The keychain click recording.
- The Roblox Studio attachment values.
