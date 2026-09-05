# STATE.md — where things actually are

> Read this before `AGENT_LOG.md`. It answers "which branch, what's live, what's next"
> in one page. Update it whenever direction changes. Last updated **2026-09-05** (David + build session).

## Current focus (David, 2026-09-05)

**September 2026 launch = the fall hiring round on the existing web form.**
The applicant world (`feat/apply-world`, draft PR #17) is **parked**: David has no time for it this round. The member game world stays pushed back. Do not spend time on either unless David re-opens them.

| Item | Decision |
|---|---|
| Round | Fall 2026 exec hiring: **VP Marketing** + **PM** (both public). Same 4-step form, submit route, drafts, dashboard and admin board as May; migration 027 only swaps the position rows. |
| Dates | Opens **Sept 5 2026 00:00 EDT**, closes **Sept 11 2026 end of day EDT** (`closes_at` = Sept 12 04:10Z, May convention). |
| Live | **Round opened 2026-09-05 ~06:40 UTC** on David's call (both roles public). 027's data half was applied through `scripts/_apply-fall-2026-positions.mjs`; 028 and 026 were run by David in the SQL editor at 06:49 UTC. `_apply-fall-2026-essays.mjs` writes questions + public/active; `_fall-2026-test-mode.mjs on/off` flips both rows to internal-only for testing. |
| Essays | VP Marketing: one question, "Submit a video that convinces us you're the candidate for this role" (60 words + video upload). PM: two placeholder questions still live; David may replace them (paste into `_apply-fall-2026-essays.mjs`, run). |
| Archive | The May round is archived through `positions.archived_at` (migration 028). The admin list folds those applications into a collapsed **Archived rounds** panel (round → role → cards). Archived cards keep notes and tags editable; verdicts, release and delete are hidden. Archived rows stay out of the live list, board, insights, filters and release; CSV export gains an `archived` column. |
| Applicant world | Parked on `feat/apply-world` (draft PR #17). `NEXT_PUBLIC_APPLY_WORLD` stays unset. Resume from the plan in `AGENT_LOG.md` when re-opened. |
| Log in / admin access | Hamburger "Log in" → `/student/go`: whitelisted admins land in the game portal (`/student/dashboard`, sidebar Admin → Recruitment = the applications board), everyone else in the applicant dashboard (`/student/apply/dashboard`, which shows the sign-in prompt when signed out). Signed-in menu: "My applications" for applicants, "Game portal" + "Admin dashboard" for admins. `/student/login` is the member terminal and is not linked. David's Google profile is tier 1 (set 2026-09-05); the sidebar and in-portal recruitment tab also accept the email whitelist. PR #18. |
| Exec beta | Skipped. |
| Migrations 024/025 (game coins, seasonal seed, drafted on the game branch) | Apply at the game world's launch window, not now. |

## Branch map

| Branch | What it is | Status |
|---|---|---|
| `main` | Production. Marketing site + recruitment + the portal as of **2026-07-22** (`7143205`) plus Sept hygiene/recruitment work. | Auto-deploys to tethos.ca on every push. No staging gate. |
| `feat/fall-2026-apply` | **PR #16, the Sept work.** Fall round rows (027, inactive until the questions land), May archive (028), `ArchivePanel` on the admin list, `ROLE_CONTENT.pm`, landing copy, dev scripts. | Merge once David has eyeballed it; then apply 026 → 027 → 028 in the Supabase SQL editor and run `_apply-fall-2026-essays.mjs`. |
| `feat/apply-world` | Draft PR #17. The applicant island (character creation, one-road island, HQ Recruitment Office, form as a sheet). | **Parked** 2026-09-05. |
| `feat/acnh-tile-grid` | **The game-world tip.** Superset of `restart/art-cohesion-v2` + 60 commits (through 2026-07-30): ACNH grid law investigation, tile-grid substrate behind `?grid=1`, `/lab/map` drafting tool, cliffs/ramps/terraces, shoreSdf water, 123 tests. QA Wave 32 failed visually (river kit unwired, roads untextured, staircase coast, empty plateau, 439 draw calls); Wave 35 had no on-screen check. | **Parked.** Resume here when the game world re-opens. Checked out at `.claude/worktrees/restart-art-cohesion`. |
| `restart/art-cohesion-v2` | Draft PR #14. Geo master plan v2 (island +18%, Wharf, Isla Chica, Temple Rise, Reedmarsh/Flats), economy v2 (Gems/TC/XP), fishing 91 species, weather perks, HUD dock, seasonal palettes, staffed interiors, `/lab`. QA Wave 30 PASS, merge-ready pending David's in-game eyeball. Fully contained in `feat/acnh-tile-grid`. | Parked. Merge path when re-opened: eyeball → merge (or merge tile-grid instead, which includes it). |
| `worktree-review+sprint-2026-07-art-cohesion` | Obsolete first plan (216 behind). | Delete when convenient. |
| `playtest`, `david`, `feat/apply-hardening`, `readme-refresh`, `recruitment-system`, `davidliu/*`, `sarah*`, `eric` | Merged or dead. | Delete when convenient. |

Rule going forward (David's standing preference): short-lived branch per task, PR, merge to main, next task from fresh main.

## Production facts

- **Vercel team** `davids-projects-e31987e3` (hobby). Project **`uwotsi.com`** (`prj_RHJizhUPiP9rWS4RkPdLJKNw5kqm`) serves `tethos.ca`, `www.tethos.ca`, `uwotsi.com`. A second project **`uwotsi`** (`prj_SldZLuGi2Td2ErPj3IqvSRT0sVNH`) is linked to the same repo and also builds every push; it serves nothing real. Safe to delete.
- `tethos.ca` 307s to `www.tethos.ca`. Smoke: `curl -sI https://www.tethos.ca/student/apply` → 200, `https://www.tethos.ca/api/positions` → 200 JSON.
- **Supabase** project "Tethos Central Database", ref `rtbkrngsdbptbjhfbcud`, org `wsacjowpbmnrpbnmctrc`. Free tier.
  - **2026-09-05:** project restored ~06:25 UTC (first minutes returned Cloudflare 521 while the origin came up; a stale negative DNS entry on the dev Mac needed `dscacheutil -flushcache`). Fall round data applied and tested end to end the same hour.
  - **Incident 2026-09-02:** the project had been **paused** (free-tier inactivity). DNS for the ref stopped resolving, every prod API that touches the DB returned `TypeError: fetch failed`, Vercel runtime errors show the same `ENOTFOUND` from **2026-07-02 through 2026-08-31**. David restored it from the dashboard. Free projects pause after ~7 idle days and are deleted after ~90 paused days: **keep it warm** (a weekly cron hit, or upgrade) or this repeats.
- Prod env vars live only in Vercel. `ANTHROPIC_API_KEY` presence there is unverified (only matters for NPC chat, which is parked).
- Recruitment emails: `RECRUITMENT_EMAILS_ENABLED=true` must be set in Vercel before the first status release batch.

## Migrations

- Applied on prod: `001_initial_schema` … `023_member_collections` (verified 2026-07-03 with David watching; `bounty_submissions` restored then).
- Drafted, **not applied**, on the game branch: `024_game_coins.sql`, `025_seasonal_seed.sql`.
- **Applied 2026-09-05:** `026_bounty_deliverables_rls.sql` and `028_recruitment_archive.sql` (SQL editor, David, 06:49 UTC); `027_recruitment_fall_2026.sql`'s data half via `scripts/_apply-fall-2026-positions.mjs` (service-role API). The 027 file is guarded so re-running it is a no-op.
- **Next free slot: `029_*`.** Never edit an applied migration.

## Repo hygiene done 2026-09-02

- Root `node_modules/` (6,641 tracked files) and the stray root `package.json` untracked; `node_modules/` ignored.
- Stale PR #9 closed.
- `.gitignore` still has a blanket `*.json` rule with explicit un-ignores; any new JSON that must ship needs its own `!` line (this once hid the entire island map).

## Open rulings for David

- Essay questions for VP Marketing + PM (he will paste). The round stays closed until they are in.
- Whether to delete the duplicate Vercel project `uwotsi`.
- Keep-warm strategy for the free-tier Supabase project.
- Game world (when re-opened): pastel grade, cliff system, 256×256 island draft, Sea King models, AI sky art, migration hold formality, deploy-safety policy.

## Onboarding order

`CLAUDE.md` → **this file** → `AGENT_LOG.md` (role + latest entries) → `specs/ux-status.md` → the spec for your task. For the game world also read `specs/acnh-system-reference.md` on `feat/acnh-tile-grid`.
