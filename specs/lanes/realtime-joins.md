# Lane: realtime-joins (`game/realtime-joins`)

Worktree `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/realtime-joins`, cut from main at `b8df3b76`. Launch fix: joins refused for up to 3+ minutes (close 4107, `friends_load_failed: timeout` on Fly). Evidence from the launch lane: `specs/evidence/launch-v1/results-night.txt`, `fly-log-counts.txt`.

## Status

- **Done 2026-10-23. Pass.** Prod Supabase resized Nano to Small (2 GB) at 06:42 UTC (David approved); realtime v6 (this lane's code, main `4e817b20`) live at 06:44 UTC.
- **Live check** on Preview `o3afq5l8y` (now deleted), 2 throwaway prod accounts, a fresh headless context per join (`results-joins.txt`, `after-resize.txt`):
  - 20 joins spread over 10 min (06:46 to 06:56 UTC): 0 refusals, matchmake to JOIN_ROOM 528 to 769 ms (median 619).
  - 3 joins each after 10 min with no realtime reads (07:07, 07:17, 07:28): 0 refusals, 723 to 991 ms; their reads 80 to 213 ms.
  - `db_read` (80 lines): 0 failed, no retries needed; card, blocks, friends, sanctions all 73 to 257 ms (median ~103). Before: 3000 ms timeouts, then 2.7 to 3.0 s, warm 0.25 to 0.6 s.
  - Supabase after the resize: 1924 MB RAM, 1282 MB available, 0 swap used, 0 pages swapped in.
  - Keep-warm read: not added (not needed).
- **Cleanup** (`cleanup-proof.txt`): 2 name log rows deleted by id, both users deleted (200), then 162 uuid columns plus `auth.users` and `profiles` hold 0 rows for the two ids. Previews `o3afq5l8y`, `3w7kq9vdz`, `by2hxb24c` deleted.
- Run sheet (`specs/launch/v1-launch.md`) updated: compute is Small, realtime v6.
- **Root cause (2026-10-22, read-only evidence): prod Supabase runs on Nano compute and swaps.**
  - Metrics (`/customer/v1/privileged/metrics`): MemTotal 426 MB; swap used ~440 MB of 1 GB, more than the RAM. Since boot (Sep 18, 34 days): 433M pages swapped in (~0.6 MB/s on average), 280M major faults, ~3.7% of CPU time in iowait. `billing/addons` lists no compute addon: the org's Pro upgrade (Oct 14) left the project on Nano.
  - Reproduced from a fresh process on the Fly machine (same supabase-js, same options as the server) after ~10 min idle: card, blocks and friends all hit the 3 s timeout; the batch 1 s later took 2.7 to 3.0 s; then 0.25 to 0.6 s. undici diagnostics: TCP+TLS in 15 to 20 ms, request sent at once; the whole wait is between the send and the response headers, inside Supabase.
  - `pg_stat_activity`: PostgREST's backends for those requests started ~3.5 s after the send, the responses followed within ~0.1 s. So the stall is before Postgres (the box paging the gateway and PostgREST back in), not the queries.
  - Ruled out: DNS and IPv6 (the host has no AAAA record; v4 Cloudflare edge, TLS in 7 to 12 ms), the Node client stack, undici pooling. The launch lane's "fresh process is fast" probes ran right after refused joins had warmed the box.
- **Root fix:** the compute change, applied by the coordinator with David's OK: Small (2 GB), 2026-10-23 06:42 UTC.
- **Evidence:** `specs/evidence/realtime-joins/root-cause.txt` (numbers), `probe-reads.mjs` (the cold-read probe), `joins.mjs` (the live join test), `cleanup.mjs` (two accounts).
- **Built and committed (`e30f21e8`; gates: realtime tsc clean, vitest 227 passed, eslint clean on the changed files via `web/node_modules/.bin/eslint -c web/eslint.config.mjs` from the worktree root):**
  - `realtime/src/read.ts` `timedRead`: every Supabase read (card, blocks, friends, sanctions) has its time budget, one `db_read` log line per attempt (`read`, `uid` or `n`, `attempt`, `ms`, `ok`, `reason`) and optional retries after 200 to 600 ms. Replaces world.ts's `withTimeout` and card.ts's own race.
  - Card and blocks: one retry before a 4107.
  - Friends: a failed join read lists none and is read again 5 s later (applyFriend + refreshFriends).
  - `friends_load_failed` is gone (the `db_read` line carries it).
  - Tests: `realtime/test/reads.test.ts`, the card retry tests in `auth.test.ts`.

## David's decisions

(none yet)

## Next

Nothing. Lane finished.

## Tools and gotchas

- Probe scripts live in the session scratchpad, not the repo. Run one on Fly with `fly ssh console --app tethos-rt -C "sh -c 'echo <base64> | base64 -d > /app/zz.mjs && cd /app && node zz.mjs; rm -f /app/zz.mjs'"` (in `/app` so it resolves the server's `node_modules`; the ssh env has `SUPABASE_URL` and `SUPABASE_SECRET_KEY`; never print them).
- The metrics endpoint is cached for about a minute: two reads seconds apart give the same counters.
- A cold state takes ~10 min of no Supabase traffic, so a cold probe is one shot per 10 minutes.
