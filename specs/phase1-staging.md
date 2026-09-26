# Phase 1 spec: staging database and signed-in end-to-end

Owner: one agent in its own worktree off `feat/game-default-island` (after wave B merges). Staging: Supabase project `tethos-staging`, ref `jjiyeroyralfbluowbjq`, free plan, us-west-2, created 2026-09-26. DB password in the macOS keychain (`security find-generic-password -s "Supabase tethos-staging db password" -w`); management API token from the Supabase CLI keychain entry (see how the coordinator reads it: `security find-generic-password -s "Supabase CLI" -w`, strip `go-keyring-base64:` and base64-decode if needed). API keys via `GET https://api.supabase.com/v1/projects/jjiyeroyralfbluowbjq/api-keys`. Never write keys or passwords into tracked files; use `web/.env.staging.local` (gitignored; verify with `git check-ignore`).

## Steps
1. Apply every migration in `web/supabase/migrations` in filename order to staging (numbered 001–028, then the timestamped recruitment, security and game migrations) through the management API or `psql` with the staging connection string. Record the applied list in `specs/evidence/phase1/applied.md`. Staging only: never touch the production ref `rtbkrngsdbptbjhfbcud`.
2. Auth: enable the email provider with password sign-in on staging only; create two test users through the admin API (a member at tier 4 flagged as a TSI member, and a public account), plus one tier-2 staff user for admin paths. Passwords in the keychain.
3. Run the app locally against staging (`web/.env.staging.local`, one dev server under the shared lock `/private/tmp/claude-501/uwotsi-devserver.lock`, port 3500). Sign in through Supabase password auth in Playwright and carry the session cookie.
4. Signed-in flows, each with screenshots and a DB readback under `specs/evidence/phase1/`:
   - chapter 1 in the world (claim plot, donate first catch, report to HQ), then a club-goal contribution and the monument progress;
   - a catch with size record, a sale, a museum donation (duplicate refused);
   - a study session: sit, start, one short block with the server clock, settlement coins, walk-away;
   - room purchase and a decorate-and-reload;
   - Oracle reading to completion and a respec with the coin fee;
   - letters between the two accounts, notice board, a report;
   - merch reserve by the member, fulfil and cancel by the staff user;
   - combat: gate check, one mission start to complete, XP and durability readback;
   - the security guarantees: the member cannot change own tier/class/Gems or write ledgers (expect errors).
5. Every failure: fix it on the branch with a regression test (smallest fix), rerun the flow.
6. Report: flows passed/failed, fixes with commits, anything that only works in demo mode.

Free projects pause after about a week idle: if staging is paused, restore it through the management API before starting.
