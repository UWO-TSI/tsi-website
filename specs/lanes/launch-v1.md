# Lane: launch-v1 (`game/launch-v1`)

Worktree `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/launch-v1`, cut from main at `6286deb0`. Owns checklist items 3, 4, 5 and 7 of `specs/launch/v1-launch.md`: the Preview with the member world open, the two-account test, smoke flows 3 to 5 for v1, and the Halloween check.

## Status

- **Phase B approved by the coordinator (2026-10-22):**
  - one Preview with the service key for that deployment only;
  - a 23 h share link;
  - three throwaway prod accounts and the test's writes (cleaned up the same day, proof by counts);
  - flow 5 skipped (no fake event);
  - the campfire after 19:30 Toronto;
  - Halloween checked locally now, on the Preview Oct 25.
- Main merged at `d251c36e`.
- **Preview:** `uwotsi-3w7kq9vdz-davids-projects-e31987e3.vercel.app`. Its share token and the account and row ids live in the session scratchpad, never in the repo.
- **Accounts:** created 2026-10-22 15:08 (A `598ba9ed`, B `3c5d65e4`, M `18a38805`; world names Probe Alder, Probe Birch, Probe Cedar).
- **Day run (15:17 to 15:25, under the browser lock), all on the Preview against prod Fly and prod Supabase:**
  - **arrival:** A's first login plays it (creator, skips, Bram's walk-along, Skip the walk). The flag is recorded and the menu shows "Here (1)";
  - **two accounts, 25 of 25 steps passed:** tags both ways; Here (2); chat both ways with bubbles (about 1.2 s); friend code ask and accept (`/internal/friend` applied, so the Vercel and Fly secrets match); "Here" in the friends list; a wave and both dances relayed; B's report reaches the T1/T2 queue; remove and mute (`/internal/sanction` applied); A's next line refused 1.2 s after the mute, and B never got it; unmute applied, and A's line goes through again;
  - **flow 4, 8 of 8 passed:** Bram's coins once, a river fish at the wharf, donate, report to Wren: 100 coins once, a second report refused, the letter.
  - The first flow 4 attempt cast into the sea and caught a sea star, which isn't a fish. That was the test's spot, not a bug. Evidence: `specs/evidence/launch-v1/`.
- **Halloween, local** (dev server :3166, `?tradition=halloween`): pumpkins by day, the fog night with lit pumpkins, the knock (a treat), the closet's witch hat. Shots: `halloween-local-*`.
- **Seen in the Fly logs during the day run:** from 19:18:40 to 19:19:52 UTC the realtime server's Supabase reads timed out (3 s): `sanctions_poll_failed` twice, and `friends_load_failed` for A and B. B's join was refused 3 times, so it backed off about 20 s before getting in. Probed afterwards from the machine (`fly ssh`), the same reads take 0.17 to 0.39 s. It looks transient; watch for it in the night run and on launch day.
- **Fly-to-Supabase read timeouts: regions and options (the coordinator decides after the full report; nothing built):**
  - Fly `tethos-rt` runs in `yyz` (Toronto); prod Supabase `rtbkrngsdbptbjhfbcud` is in `us-west-2` (Oregon). Every read crosses the continent. Each read has a 3 s budget (`realtime/src/world.ts` `timeoutMs`, `src/auth/card.ts`).
  - **Already soft:**
    - the join's friends lookup: a failure logs `friends_load_failed`, the join goes ahead with an empty list, and nothing reloads it later (only a `/internal/friend` notice or the next join fills it);
    - the sanctions poll: a failed cycle logs and the next one runs 60 s later;
    - the chat log: failed batches stay queued and retry with backoff.
  - **Hard:** the card and the blocks reads at join. Either one timing out refuses the join with 4107, and the client backs off 2, 4, 8, 16 then 30 s. That's B's 20 s on Oct 22.
  - **Smallest hardening, in order of value:**
    1. One retry with 200 to 600 ms jitter inside `withTimeout`'s callers for the card and blocks reads, before a 4107. Card reads are already cached 60 s, so a retry costs one extra request only on a miss.
    2. A failed friends lookup schedules one reload about 5 s after the join and sends the list then, instead of staying empty for the session.
    3. The sanctions poll: no change needed (a missed cycle is already tolerated); optionally retry once 10 s after a failure instead of waiting 60 s.
  - Blocks stay a hard requirement (a join without them could let a blocked pair chat for a moment), so the retry is the fix there, not failing soft.
- Browser lock released after the day run.
- **Evening (coordinator):**
  - main `4839153a` merged (ponytail fixes; realtime v5 on Fly);
  - a fresh Preview `uwotsi-by2hxb24c-davids-projects-e31987e3.vercel.app`, built the same way (flow 3's routes pass there);
  - the night run adds the moderation re-run and a block check after the campfire.
  - Night begins at sunset + 1 h (`lib/game/sunTimes.ts`): 19:31 on Oct 22, so the run starts at 19:33 or later.
- **Next:**
  1. Night run at 19:33 Toronto or later (re-queue at 19:25): the campfire with 2 dancers, then moderation and the block.
  2. Cleanup, the same evening (`cleanup.mjs collect`, then `delete`, then `verify`).
  3. Report to the coordinator.

## Phase A findings (2026-10-22)

**Vercel (project `uwotsi.com`, root directory `web`, SSO protection on every deployment except custom domains):**
- Preview env already has `NEXT_PUBLIC_MEMBER_WORLD` (= `open`), `NEXT_PUBLIC_REALTIME_URL` (the prod Fly app, `tethos-rt.fly.dev`), `REALTIME_INTERNAL_URL` and `REALTIME_INTERNAL_SECRET` (sensitive, values not readable), and `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` (one entry for Development, Preview and Production: the prod project `rtbkrngsdbptbjhfbcud`).
- **Preview has no `SUPABASE_SERVICE_ROLE_KEY`** (Development and Production only). `memberContext` answers 503 without it, so on a Preview every game route is down: friends, report, admin moderation, identity name and moderate, arrival, progression, wallet. Presence and chat still work (they only need the Supabase session and Fly).
- Production has both `REALTIME_INTERNAL_*` too. The run sheet's "moderation env vars not done" is out of date: they were added on Oct 7.
- `vercel whoami` = `davidliu8473-8139`. The worktree is linked by copying the main repo's `web/.vercel/project.json` (gitignored).

**Fly `tethos-rt` (v4, machine started, health 200):** secrets `ALLOWED_ORIGINS`, `ALLOWED_ORIGIN_PATTERNS`, `SUPABASE_SECRET_KEY`, `SUPABASE_URL`, `REALTIME_INTERNAL_SECRET`. The unsigned `/internal/sanction` answers 401 (so the endpoints are on), and a CORS preflight from a `uwotsi-…-davids-projects-e31987e3.vercel.app` origin is allowed. Whether Vercel's secret matches Fly's shows only in a live route response (`realtime: "applied"`, versus `failed`).

**Without the moderation env vars** (or with a mismatched secret), routes still succeed but return `realtime: skipped` (or `failed`):
- a mute reaches the island only through the server's 60 s poll, so the muted player's next line within that minute still goes out;
- a removal closes the socket up to 60 s late;
- a block, and a friendship made or ended, only show at either player's next join (no heart tag, no "Here" or Join until then).

**Accounts:** the island needs sign-in only (no membership or tier). Email and password sign-in is on the title screen. A first login plays the arrival (Space skips, "Skip the walk" leaves Bram's tour); the creator is skipped by a saved `tsi.look.v1`. Staging (`jjiyeroyralfbluowbjq`) is INACTIVE and missing months of migrations, and Fly has no staging app, so the test runs against prod with throwaway accounts. Delete cascades from `auth.users` through `profiles` cover the wallet, identity, friends, codes, requests, blocks and the reports aimed at them; `world_chat_messages`, `moderation_log` and reports made by them only go to `SET NULL`, so delete those rows first.

**Production builds drop every dev hook:** `window.__net`, `?mp=dev`, `?bots`, `?at=`, `?date=`, `?time=`, `?tradition=` and the dev panel's time-of-day control. On the Preview:
- the campfire lights only at real night in London, Ontario;
- Halloween runs only on the real dates (the prod `traditions` row is `halloween`, 10-25 to 11-01);
- tags and bubbles are DOM (readable); remote poses are WebGL (screenshots, or decoded room messages from the WebSocket).

**A cross-shard Join can't happen on prod with two accounts:** a second shard only opens once the first holds 30 players, and the bots use dev tokens, which prod refuses. With both players in one shard the Friends list says "Here". The cross-shard Join was evidenced on the local bench (`specs/evidence/v1-community/14-*`, `15-*`).

**Smoke flows (runbook §6):**
- Flow 4's "Claim plot" step is drop 4 (`lib/game/drops.ts`). The v1 chapter 1 is: first catch, donate it at the museum, report to Wren at HQ. That pays 100 coins once (`chapter:settle-in`) and puts the letter in the mailbox, after the arrival (Bram's coins once).
- Flow 3 still holds; add `GET /api/world/arrival`, `GET /api/world/friends` and the realtime join.
- Flow 5 needs an approved upcoming event, and prod has none.

## David's decisions

- (2026-10-22, run sheet) Live test: an automated two-account test on a Preview first, then David and one friend play for about 15 minutes.
- (2026-10-22) Halloween costumes: "later problem get the game done first".

## Next

1. Wait for the coordinator's OK on the Phase A asks.
2. Phase B:
   - build the test (`specs/evidence/launch-v1/two-account.mjs`);
   - deploy the Preview;
   - create the accounts;
   - run the test;
   - fix only launch breaks;
   - update runbook flows 3 to 5 and run them;
   - Halloween on Oct 25;
   - clean up the accounts.

## Tools and gotchas

- Root directory is `web`: deploy from the worktree root (a root `.vercel/project.json`), with an untracked root `.vercelignore` that drops `art/`, `references/`, `specs/`, `archive/`, `realtime/`, `web/node_modules` and `web/.next`. Otherwise the upload is about 500 MB.
- The headless browser needs past Vercel SSO: a 23 h share link (`get_access_to_vercel_url`), or the project's automation bypass.
- `vercel env pull` returns sensitive vars as placeholders. Read only booleans from a pull and delete the file.
- `web/.env.local` (the prod env symlink) stores `SUPABASE_SERVICE_ROLE_KEY` quoted with a literal trailing `\n`. Read raw, the key answers 401: strip the quotes and the `\n` (the script does).
- Read-only Supabase: `POST /v1/projects/rtbkrngsdbptbjhfbcud/database/query` with `"read_only": true`. Token: the Supabase CLI keychain entry.
- Two game contexts plus one light moderator context in one headless Chromium with `--mute-audio`, under the browser lock.
