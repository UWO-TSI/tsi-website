# STATE.md — where things actually are

> Read this before `AGENT_LOG.md`. It answers "which branch, what's live, what's next"
> in one page. Update it whenever direction changes. Last updated **2026-09-02** (David + build session).

## Current focus (David, 2026-09-02)

**September 2026 launch = the fall hiring round with a gamified application.**
The member game world is **pushed back**. Do not spend time on it unless David re-opens it.

| Item | Decision |
|---|---|
| Round | Fall 2026 exec hiring: **VP Marketing** + **PM** (both public) |
| Dates | Opens **Sept 5 2026 00:00 EDT**, closes **Sept 11 2026 end of day EDT** (`closes_at` = Sept 12 04:10Z, May convention) |
| Prototype | "Character sheet" apply flow: short class quiz (Oracle MBTI logic) → the 4 form steps become quests with an XP bar → success = shareable character card. Small prototype, not the 3D world. Live for Sept 5. |
| Essays | David pastes new questions. May's questions are the placeholder until then. |
| Exec beta | Skipped. |
| Migrations 024/025 (game coins, seasonal seed, drafted on the game branch) | Apply at the game world's launch window, not now. |

## Branch map

| Branch | What it is | Status |
|---|---|---|
| `main` | Production. Marketing site + recruitment + the portal as of **2026-07-22** (`7143205`) plus Sept hygiene/recruitment work. | Auto-deploys to tethos.ca on every push. No staging gate. |
| `feat/acnh-tile-grid` | **The game-world tip.** Superset of `restart/art-cohesion-v2` + 60 commits (through 2026-07-30): ACNH grid law investigation, tile-grid substrate behind `?grid=1`, `/lab/map` drafting tool, cliffs/ramps/terraces, shoreSdf water, 123 tests. QA Wave 32 failed visually (river kit unwired, roads untextured, staircase coast, empty plateau, 439 draw calls); Wave 35 had no on-screen check. | **Parked.** Resume here when the game world re-opens. Checked out at `.claude/worktrees/restart-art-cohesion`. |
| `restart/art-cohesion-v2` | Draft PR #14. Geo master plan v2 (island +18%, Wharf, Isla Chica, Temple Rise, Reedmarsh/Flats), economy v2 (Gems/TC/XP), fishing 91 species, weather perks, HUD dock, seasonal palettes, staffed interiors, `/lab`. QA Wave 30 PASS, merge-ready pending David's in-game eyeball. Fully contained in `feat/acnh-tile-grid`. | Parked. Merge path when re-opened: eyeball → merge (or merge tile-grid instead, which includes it). |
| `worktree-review+sprint-2026-07-art-cohesion` | Obsolete first plan (216 behind). | Delete when convenient. |
| `playtest`, `david`, `feat/apply-hardening`, `readme-refresh`, `recruitment-system`, `davidliu/*`, `sarah*`, `eric` | Merged or dead. | Delete when convenient. |

Rule going forward (David's standing preference): short-lived branch per task, PR, merge to main, next task from fresh main.

## Production facts

- **Vercel team** `davids-projects-e31987e3` (hobby). Project **`uwotsi.com`** (`prj_RHJizhUPiP9rWS4RkPdLJKNw5kqm`) serves `tethos.ca`, `www.tethos.ca`, `uwotsi.com`. A second project **`uwotsi`** (`prj_SldZLuGi2Td2ErPj3IqvSRT0sVNH`) is linked to the same repo and also builds every push; it serves nothing real. Safe to delete.
- `tethos.ca` 307s to `www.tethos.ca`. Smoke: `curl -sI https://www.tethos.ca/student/apply` → 200, `https://www.tethos.ca/api/positions` → 200 JSON.
- **Supabase** project "Tethos Central Database", ref `rtbkrngsdbptbjhfbcud`, org `wsacjowpbmnrpbnmctrc`. Free tier.
  - **Incident 2026-09-02:** the project had been **paused** (free-tier inactivity). DNS for the ref stopped resolving, every prod API that touches the DB returned `TypeError: fetch failed`, Vercel runtime errors show the same `ENOTFOUND` from **2026-07-02 through 2026-08-31**. David restored it from the dashboard. Free projects pause after ~7 idle days and are deleted after ~90 paused days: **keep it warm** (a weekly cron hit, or upgrade) or this repeats.
- Prod env vars live only in Vercel. `ANTHROPIC_API_KEY` presence there is unverified (only matters for NPC chat, which is parked).
- Recruitment emails: `RECRUITMENT_EMAILS_ENABLED=true` must be set in Vercel before the first status release batch.

## Migrations

- Applied on prod: `001_initial_schema` … `023_member_collections` (verified 2026-07-03 with David watching; `bounty_submissions` restored then).
- Drafted, **not applied**, on the game branch: `024_game_coins.sql`, `025_seasonal_seed.sql`.
- Added 2026-09-02 on main: `026_bounty_deliverables_rls.sql` (closes the Supabase critical advisory), `027_recruitment_fall_2026.sql` (the fall round rows).
- **Next free slot: `028_*`.** Never edit an applied migration.

## Repo hygiene done 2026-09-02

- Root `node_modules/` (6,641 tracked files) and the stray root `package.json` untracked; `node_modules/` ignored.
- Stale PR #9 closed.
- `.gitignore` still has a blanket `*.json` rule with explicit un-ignores; any new JSON that must ship needs its own `!` line (this once hid the entire island map).

## Open rulings for David

- Essay questions for VP Marketing + PM (he will paste).
- Whether to delete the duplicate Vercel project `uwotsi`.
- Keep-warm strategy for the free-tier Supabase project.
- Game world (when re-opened): pastel grade, cliff system, 256×256 island draft, Sea King models, AI sky art, migration hold formality, deploy-safety policy.

## Onboarding order

`CLAUDE.md` → **this file** → `AGENT_LOG.md` (role + latest entries) → `specs/ux-status.md` → the spec for your task. For the game world also read `specs/acnh-system-reference.md` on `feat/acnh-tile-grid`.
