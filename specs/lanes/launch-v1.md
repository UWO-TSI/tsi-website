# Lane: launch-v1 (`game/launch-v1`)

Worktree `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/launch-v1`, cut from main at `6286deb0`. Owns checklist items 3, 4, 5 and 7 of `specs/launch/v1-launch.md`: the Preview with the member world open, the two-account test, smoke flows 3 to 5 for v1, and the Halloween check.

## Status

- **Phase A (investigate and plan): done 2026-10-22, reported to the coordinator. Waiting for its OK before Phase B.** Nothing outside the worktree was changed. Read-only probes only (Vercel env names, Fly secret names, Supabase read-only queries, Fly `/health`, a CORS preflight, an unsigned `/internal/sanction`).
- Nothing approved yet.

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
- Read-only Supabase: `POST /v1/projects/rtbkrngsdbptbjhfbcud/database/query` with `"read_only": true`. Token: the Supabase CLI keychain entry.
- Two game contexts plus one light moderator context in one headless Chromium with `--mute-audio`, under the browser lock.
