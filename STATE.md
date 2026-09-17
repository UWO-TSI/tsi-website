# STATE.md — where things actually are

> Read this before `AGENT_LOG.md`. It answers "which branch, what's live, what's next"
> in one page. Update it whenever direction changes. Last updated **2026-09-17**.

## Google Sheet pages and copy (2026-09-17, later)

- The recruitment workbook now has one page per pipeline stage (Screening, Interview Invite, Final Review, Accepted, Waitlist, Rejected) for live rounds and an **Archived rounds** page. They are live `FILTER` formulas over the master **Recruitment records** tab (`SHEET_VIEWS` in `web/lib/recruitment-sheet-data.ts`); the delivery worker creates missing pages and rewrites their header + formula after every master write. PR #26. Verified live: Screening shows the two developer applicants, Archived rounds 68. The empty default `Sheet1` tab is untouched.
- Copy: "Welcome to Tech for Social Impact" in the member world and applicant island; the questions-step note is the blunt no-AI version. PR #27.
- Housekeeping: ~330 Finder-style " 2" duplicate files (identical copies) were removed from the working tree; a few differing copies are listed in the AGENT_LOG entry for David to judge.

## Production release and immediate opening (2026-09-17)

Deployed PR #23 (`4ab7f63`) and whitespace-only Google destination fix PR #24 (`f0616f5`) to www.tethos.ca. Production build and 339 tests passed. Applied only recruitment delivery migration (remote ledger 20260917160347) and its minute scheduler (20260917161307); parked game migrations remain unapplied. Google workbook auto-creation recovered correctly after trimming the existing newline-only ID.

Live verification: all 68 existing applications delivered; a synthetic internal application's multiline answer and later update were read back from its fixed row. Deleted only that synthetic application/position. The minute job cleared its row, returned HTTP 200 without timeout, and left zero pending; all 68 real applications remain. Authenticated Dia admin shows zero waiting and the workbook link. Production island, HQ, board and protected-route checks pass. No applicant email was sent. Actual applicant form submission/resume upload/email delivery were not exercised live; timeout/race recovery is covered by local SQL/unit tests rather than a forced production outage.

David then explicitly requested opening immediately, archiving PM/VP Marketing and pushing quieter world-first laptop entry. Production roles opened at **2026-09-17 12:17:10 Toronto (16:17:10Z)**; September 23, 11:59 PM Toronto deadline is unchanged. PM and VP Marketing are archived, preserving all applications; current unarchived round has zero applications at verification. This supersedes the earlier 3 PM opening. Follow-up code sends laptops directly into the existing applicant island, retaining mobile/reduced-motion forms and the explicit `?view=form` escape. Applicant music gain is 0.18; SFX gain 0.25, with a further 0.35 gain for running/landing/jumping. Saved volume settings and member-world levels are preserved.

Operational follow-up: Google consent identified a Testing app. Verify OAuth publishing status or renew before the documented seven-day token expiry; queued applications remain in Supabase if Google access expires. Full repository lint retains known debt (68 errors/52 warnings against previous main 74/53); focused changes pass. New externally-created ` 2` duplicate files appeared untracked during release and are preserved, excluded from staging. Exact follow-up code verified in an isolated checkout: production build and all 343 tests pass; focused ESLint passes.

## Production credentials prepared (2026-09-17)

David authorized completing the production settings. Dia verified `uwotsi.com` serves www.tethos.ca. This project was missing all three OAuth variables; added verified local GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN plus a generated CRON_SECRET as non-revealable Secret variables for Production only. Preserved existing folder/workbook and unrelated variables. Vercel confirmed save success and requires a new deployment to apply them.

Created Supabase Vault recruitment_sheet_origin=https://www.tethos.ca and recruitment_sheet_cron_secret matching the Vercel input; SQL verified both present and matching without returning their values. No delivery migration, scheduler, role activation, code push or redeploy. Google publishing/testing-state review and existing production workbook access verification remain open. Evidence: `specs/references/deployment-2026-09-17/production-configuration.json`. Next: deploy compatible code, then delivery migration/roles/scheduler and end-to-end verification. Do not redeploy old code as a substitute.

## Local Google credential installed (2026-09-17)

David explicitly authorized replacing only GOOGLE_OAUTH_REFRESH_TOKEN in web/.env.local. Replacement completed; all other file bytes preserved and credential never logged. Fresh checkout diagnostic verifies authorization valid and destination writable. Local dev log confirms environment reload. Production environment unchanged; delivery migration/scheduler/new roles and production Google configuration remain outstanding. Temporary credential copy removed after verification; the local env is now the credential source.

## Google reconnect verified (2026-09-17)

David completed consent. New credential saved in protected temporary storage (0600), not in environment files. Actual Google requests passed authorization, configured Drive folder write access, synthetic spreadsheet write/readback, repeated RAW fixed-row update without duplication (including a formula-like literal), and blank-row clearing/readback. The temporary workbook was then moved to trash. No real applicants, database mutations or emails were involved. Evidence: `specs/references/deployment-2026-09-17/google-live-verification.json`.

This verifies the new credential and Google transport. The running local/Vercel configuration still has not been updated, and full admin-to-database-to-Sheets delivery/scheduling still requires the migration and deployed setup. Asked explicit permission to replace only GOOGLE_OAUTH_REFRESH_TOKEN in web/.env.local, per AGENTS.md; pending at checkpoint.

The consent screen explicitly described a testing app. Google documents seven-day refresh-token expiry for external apps in Testing with Drive/Sheets scopes. Verify the OAuth publishing status and production suitability before treating this as a durable production connection; do not assume the earlier invalid_grant cause is proven. Source: https://developers.google.com/identity/protocols/oauth2#expiration. No publishing-status change performed.

## Confirmed schedule and reconnect started (2026-09-17)

David confirmed all four roles open September 17 at 3:00 PM and close September 23 at 11:59 PM, interpreted in the previously agreed Toronto time (EDT in September). UTC: 2026-09-17T19:00:00.000Z to 2026-09-24T03:59:00.000Z. Local role source/preview/preparation payload updated; production roles remain untouched and draft preparation remains inactive.

Google reconnect opened in Dia with the existing account/client. Waiting for user consent at Google's unverified testing-app screen. Existing oauth-setup utility now supports --token-file with exclusive owner-only output, validates OAuth state, binds loopback and omits sensitive error bodies. No .env edit. Syntax/focused lint, TypeScript, 5 role tests, dry-run dates and invalid-state callback rejection checked. Credential receipt/live Google verification still pending.

## Latest deployment preparation (2026-09-17)

Production build and 338 tests pass; 300-record local SQL delivery test passes. Admin Sheets health now verifies actual Google authorization/destination access and distinguishes missing schema. Full lint still has baseline debt (68 errors vs main 74). Fresh read-only checks: checkout Google refresh returns invalid_grant; production delivery tables, pg_cron/pg_net and four new roles are absent. Vercel configuration inaccessible through connector. Dates and Google reconnect pending. No push, deployment, production mutation or env edit. Release sequence and evidence: `specs/recruitment-deployment-readiness-2026-09-17.md`. Deploy compatible server route BEFORE delivery migration; do not claim Sheets works until live write/readback and scheduler recovery pass.

## Latest researched clubhouse refinement (2026-09-17)

David approved sage/wood/cream clubhouse, subtle feedback and autonomous local implementation/testing. Pinterest plus IKEA/Room & Board/Lutron research informs a centered hiring board, clear main aisle, grouped lounge, wall-backed shelf and task-based fixture placement. Original white pendants/cream rug add 347 KiB. Shared placement/collision anchors; smaller fading guidance; existing advanced ToastHub/queue recovered for pickup feedback. TypeScript, focused lint, 90 tests and original UV/PNG audit pass; Dia verifies board access, evening and night/dark room views, no current console errors. Local only. Full sources, screenshots, scope and verification limits: `specs/clubhouse-refinement-2026-09-17.md`.

## Latest lightweight surfaces and HQ lounge (2026-09-17)

Applicant grass/path/beach materials now have corrected texture scale, subtle grain and coordinated sage/earth/cream colors; existing water shader uses the original 128px sea-normal texture for fine ripples and quieter rings. Removed applicant acorn rug/art; original cream sofa, wood table, tea set, books and lamp form a lounge with collision-safe board access. Four models total 534 KiB. TypeScript, focused lint, 84 tests, source-asset audit and Dia pixel/smooth visual checks pass. Local only. Details: `specs/applicant-surfaces-and-lounge-2026-09-17.md`.

## Latest cozy lighting and island interactions (2026-09-17)

Applicant HQ has phase-based warm lamp pools and an original-source reading area; clock is against the wall with a compact scene-anchored proximity countdown. Existing fireflies are smaller and wander independently around 22 bush anchors; shoreline-derived targets reuse the full fishing system. Recruitment UI/loading follow system light/dark appearance, with Toronto-time accents. TypeScript, focused lint, 34 tests and asset/primary-contrast checks pass. Dia verified the night exterior and furnished HQ; final proximity/theme-switch/fishing walkthroughs remain unverified after computer control was blocked on the current browser URL. No deployment. See `specs/cozy-lighting-and-adaptive-ui-2026-09-17.md`.

## Latest HQ interior polish (2026-09-17)

Restored original remake atlases and missing UVs on eight existing furniture GLBs; original geometry preserved. Applicant HQ now uses source parquet, sage panels, neutral fill with warm light pools, furniture shadows, inward-facing bookshelf and readable welcome mat. TypeScript, focused lint, 7 tests and an eight-asset binary audit pass; Dia verified textures, entry/exit, four-role board and clock proximity. Source/reproduction/evidence: `specs/hq-interior-polish-2026-09-17.md`. Prior exterior window/firefly visual check also completed. Local only, no push/deploy.

## Latest cozy HQ request (2026-09-16, late evening)

Implemented golden emissive HQ glass, warmer porch/window light spill and real fireflies using the existing ACNH firefly model, AmbientLife motion and sun-glow texture. No generated insect assets or duplicate system. 20 focused tests, TypeScript and focused lint pass. Final visual check pending: Dia connector timeouts, then native fallback blocked by concurrent user input. See the last section of `specs/applicant-lighting-2026-09-16.md`. Local only.

## Latest graphics continuation (2026-09-16, evening)

Applicant graphics polish reuses existing blob shadows for character/plant grounding, reduces middle-distance haze, improves cached shadow-map detail, softens source sand's orange cast and adds optional FXAA only to smooth mode. Pixel and lighter modes checked; 43 tests, TypeScript and focused lint pass. Full settings/screenshots/performance caveats in `specs/applicant-lighting-2026-09-16.md` follow-up section. No push/deploy.

## Latest lighting research and application (2026-09-16, evening)

David requested Animal Crossing-like land colors, lighting and distance softness. Local applicant island now uses coordinated day/evening/night key/fill/environment/water/grade profiles, brighter grass and quieter sandy dirt, existing aerial haze, bounded existing cloud shadows, softer PCF shadows and the existing lantern light. Reused the advanced/current implementations; no second rendering pipeline or replacement assets. Nintendo-confirmed art principles are separated from visual inference and our settings. Source audit, 23-item effect inventory, settings, screenshots and checks: `specs/applicant-lighting-2026-09-16.md`. TypeScript, focused lint and 41 tests pass; Dia covers phases, light graphics and HQ transitions. No push/deploy. Advanced member worktree unchanged.

## Latest applicant visual revision (2026-09-16, evening)

David's latest correction keeps the Quaternius character style but differentiates the player: Casual2_Male with blond hairstyle, light warm skin, green shirt and navy trousers; Jayden unchanged. This supersedes the identical-model appearance, procedural human and fox/hoodie. Jayden replaces Eliza using the supplied Quaternius Casual character and David's casual dialogue. Recruitment HQ cabinet/trophies/desk are upright; clock faces inward with visible dial and automatic application countdown. Middle river/bridge removed, foliage increased, translucent arrow guides to HQ then hiring board. Dia visual/proximity checks, 37 focused tests, TypeScript and focused lint pass. Dates remain unset (coming soon). Local only, no push/deploy. Checkpoint: `~/Desktop/ClaudeBrain/Sessions/2026-09-16 Applicant village characters and furniture.md`.

## Latest recovery and playable verification (2026-09-16, evening)

Recovered interrupted Codex thread `01a07833-2c27-7871-b1fb-66a98f5426c7` and resumed here. Its final implementation was newer than the planning checkpoint below: animated applicant, campus-time lighting, guided HQ/four postings, full application sheet, updated Marketing/Developer copy, applicant login routing and member-world development-only restriction are present locally. Ocean Railway island / Willow Tree HQ audio and requested MP4 export were completed in that chat.

Fresh Dia walkthrough: island → HQ → physical posting → form validation/review → rehearsal completion; X returns to board. Fixed cue wrapping, essay-error clearing and HQ texture batch preload. 88 focused tests, TypeScript and focused lint pass. Preview: `http://localhost:3102/student/apply/portal?preview=1`. Live authenticated submission/resume/draft readback, Google reconnection/Sheets readback, final dates and release checks remain outstanding. No push/deploy/production writes. Checkpoint: `~/Desktop/ClaudeBrain/Sessions/2026-09-16 Interrupted recruitment chat recovery.md`.

## Latest request: applicant character and guided HQ revision (2026-09-16)

Planning interview active for the urgent recruitment revision. David requests a simple animated 3D applicant, central HQ, minimal top-right WASD/E tutorial, subtle destination cues, four board postings, approximately 85%-viewport application overlay, reliable X-save/close and submitted-role glow/check/confetti. Preserve existing local implementation. R1 now explicitly supersedes the prior optional-village entry: ordinary applicants enter the application island after account creation/login; the member/main world is testing-only. R2 delegates a lightweight downloaded animated 3D character. R3 uses sunny/seaside and cozy evening styling driven by real-life time. R4 A confirms direct mobile forms without a canvas; R5 A confirms one scrollable application plus review. Existing code routes remain unchanged during planning. Applicant-only character change; separate member worktree/map untouched. Read the new top section of `specs/director-developer-round.md` for current inspection findings. UI kit and draft/submission safeguards are implemented locally; final focused verification:44tests, TypeScript and focusedlint pass. see `specs/recruitment-ui-kit.md`. David approved the soft component style and requested Tethos palette/type, near-fullscreen application and failure recovery/help. Existing preview route `/student/apply/ui-preview` is development-only. Real authenticated integration and full revised island/access flow remain outstanding.

## Previous same-day implementation checkpoint (entry superseded above)

Local, uncommitted implementation on `feat/director-developer-recruitment`, based on `f850451`. Four separate roles: Marketing Director, Internal Director, External Director, Developer. External/Internal questions and hiring counts now use David’s supplied copy; Marketing questions are empty and Developer remains a draft. Internal-specific overview/responsibilities are drafted for review. David confirmed 250-word written director answers and a URL field for Internal Q3. Dates unset. **Latest explicit decision: four roles immediately; village optional.** `/student/apply` is the direct directory on desktop/mobile. Role pages no longer require scrolling through a posting or checking an acknowledgement; sign-in returns to the chosen form. Optional desktop game lives at `/student/apply/portal`.

The rejected mini island has been replaced with the actual game's rendering/movement/material/audio systems, compact village/guide and furnished HQ containing a four-posting board. This checkout includes shared game updates requiring member-route regression review; the separate member-game worktree and authored map were not edited. Dia checks cover direct desktop/mobile pages and optional village/HQ/board navigation. 185 tests, TypeScript, focused lint and webpack build pass. Full lint remains existing debt (69 errors/52 warnings). Hardware performance, audio listening and authenticated end-to-end submission remain unverified.

Backend has a prepared durable Sheets queue/retry migration, validated submissions, bounded admin pagination and full-field export. Migration, retry schedule and inactive-role preparation script are **not run on production**. Google refresh returns `invalid_grant`; reconnect before claiming live sync. No push or deployment until David tests. Full evidence/release gates: `specs/director-developer-round.md`. Preview: `http://localhost:3102/student/apply?preview=1`.

## Historical fall launch (David, 2026-09-05)

**September 2026 launch = the fall hiring round on the existing web form.**
The applicant world (`feat/apply-world`, draft PR #17) is **parked**: David has no time for it this round. The member game world stays pushed back. Do not spend time on either unless David re-opens them.

| Item | Decision |
|---|---|
| Round | Fall 2026 exec hiring: **VP Marketing** + **PM** (both public). Same 4-step form, submit route, drafts, dashboard and admin board as May; migration 027 only swaps the position rows. |
| Dates | Opens **Sept 5 2026 00:00 EDT**, closes **Sept 11 2026 end of day EDT** (`closes_at` = Sept 12 04:10Z, May convention). |
| Live | **Round opened 2026-09-05 ~06:40 UTC** on David's call (both roles public). 027's data half was applied through `scripts/_apply-fall-2026-positions.mjs`; 028 and 026 were run by David in the SQL editor at 06:49 UTC. `_apply-fall-2026-essays.mjs` writes questions + public/active; `_fall-2026-test-mode.mjs on/off` flips both rows to internal-only for testing. |
| Essays | VP Marketing: one question, "Submit a video that convinces us you're the candidate for this role" (60 words + video upload). PM: David's three questions (200 words each: why PM + what you hope to gain; a project where others' work was your responsibility; week 6 of 12, developer gone quiet, demo in 10 days) plus an optional "Past projects" box stored as `__past_projects` in `essay_answers`. Source of truth: `_apply-fall-2026-essays.mjs`. |
| Archive | The May round is archived through `positions.archived_at` (migration 028). The admin list folds those applications into a collapsed **Archived rounds** panel (round → role → cards). Archived cards keep notes and tags editable; verdicts, release and delete are hidden. Archived rows stay out of the live list, board, insights, filters and release; CSV export gains an `archived` column. |
| Applicant world | Parked on `feat/apply-world` (draft PR #17). `NEXT_PUBLIC_APPLY_WORLD` stays unset. Resume from the plan in `AGENT_LOG.md` when re-opened. |
| PM page extras | "How this works" callout (hire first, project selection day later) and a "See projects from last year" link to `/tsi-25-26-developer-package.pdf` (16 MB, `web/public`). |
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
