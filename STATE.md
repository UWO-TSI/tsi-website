# STATE.md

Current facts only: what's live, where, and the rules for changing it. Update it when direction changes, and move superseded sections to `archive/logs/` instead of stacking them here. Last updated 2026-10-28.

- **Lanes, review pages and what's waiting on David:** `specs/lanes/coordinator.md` (the coordinator keeps it current).
- **Full history before 2026-10-22** (the September recruitment round, the Free-tier outages, old branch maps, the 2026-09-29 launch log): `archive/logs/STATE-history-to-2026-10-22.md`.
- **Sessions on other devices:** read this before starting, pull `main` often and push small merges. The coordinator merges with whatever lands on `main`.

## Now (2026-10-28)

- **The plan:** `specs/launch/v1-gameplay.md`. No launch date and no freeze: David keeps building until he's content (2026-10-27).
- **Live:** play.tethos.ca runs the new world (`web/data/world/`). Production has set `NEXT_PUBLIC_GAME_WORLD` and `NEXT_PUBLIC_MEMBER_WORLD` since 2026-10-26, so the member world is open. The old village island is retired (2026-10-28); lane `game/village-archive` is removing it.
- **How it looks:** `specs/design-bible.md` is the one canon for UI, art and models (rows 319 and 320).
- **Lanes, review pages and what's waiting on David:** `specs/lanes/coordinator.md`.
- **Prod migrations:** see the coordinator handoff for the applied and pending lists. The applied record is `~/tethos-launch-2026-09-29/migrations.log`.
- **Realtime:** Fly `tethos-rt` v7.
- **Story canon:** `specs/lore.md`. **Classes v2:** on `main` behind `economy_settings.classes_v2` (0 in production).

## Branches and deploys

- `origin/main` equals `feat/game-default-island` (the local `main` ref is far behind; never merge it) (the coordinator's worktree is `.claude/worktrees/restart-art-cohesion`). Every verified merge goes to `main` right away (row 248). Vercel auto-deploys every push; there's no staging gate.
- Lanes work on `game/<lane>` branches in `.claude/worktrees/<lane>`. They never push; the coordinator merges.
- Short-lived branch per task, merged to `main` often (David's standing preference).

## Production

- **Vercel** team `davids-projects-e31987e3`. Project `uwotsi.com` (`prj_RHJizhUPiP9rWS4RkPdLJKNw5kqm`) serves `tethos.ca`, `www.tethos.ca`, `play.tethos.ca` and `uwotsi.com`. The second project `uwotsi` (`prj_SldZLuGi2Td2ErPj3IqvSRT0sVNH`) builds every push but serves nothing; it's safe to delete.
- `tethos.ca` 307s to `www.tethos.ca`. Smoke: `curl -sI https://www.tethos.ca/student/apply` returns 200, and `https://www.tethos.ca/api/positions` returns 200 JSON.
- **play.tethos.ca** (live since 2026-10-09, Namecheap CNAME `play` to `cname.vercel-dns.com`) serves the title screen. `www.tethos.ca/student` and portal paths 307 to play; play sends `/student/apply/*` and site pages back to www.
- **Member world gate:** `/student/dashboard`, `/student/onboarding` and `/student/companion` show `/student/opening-soon` until `NEXT_PUBLIC_MEMBER_WORLD=open` is set for Production in Vercel and redeployed (`web/lib/recruitment-access.ts`); it has been set since 2026-10-26. On phones, `/student/dashboard` sends players to `/student/companion`.
- **Realtime:** the Colyseus server in `realtime/` runs on Fly as `tethos-rt` (`specs/multiplayer.md`, ledger rows 296 to 299).
- **Supabase:** project "Tethos Central Database", ref `rtbkrngsdbptbjhfbcud`, org `wsacjowpbmnrpbnmctrc`. Pro since 2026-10-14.
- **Env vars** live only in Vercel. Never print them. `ANTHROPIC_API_KEY` there is unverified (only NPC chat needs it). Recruitment status emails need `RECRUITMENT_EMAILS_ENABLED=true`.
- **Invite code:** rotated at the 2026-09-29 launch. It lives only in David's keychain ("Tethos invite code"). Never put it in the repo.

## Shared code: applicant and member islands

The applicant island (`/student/apply/portal`, preview with `?preview=1`) and the member island use one implementation of the game components: `PlayerAvatar` and `HQInterior` take an `avatarMode`, plus `collectionScope`, `islandLighting` and `clubhouse`. Change them for both.

## Security invariants (verified at the 2026-09-29 launch)

`wallet_apply` is server-only, `invite_codes` is hidden, `member_badges` is closed to anon, and self-promotion returns 403. The exploit tests are `web/supabase/tests/game_security_smoke.sql`. Don't loosen any of these.

## Migrations

- Pending ones, if any, are listed in `specs/lanes/coordinator.md`. Ask the coordinator before assuming one is applied.
- The coordinator applies prod migrations: back up first, apply one transaction each through the query API, verify, then log it in `~/tethos-launch-2026-09-29/migrations.log`. The procedure is in `specs/launch-runbook.md`. Safety dumps live outside the repo (`~/tethos-prod-2026-09-29.dump`, `~/tethos-launch-2026-09-29/`).
- New migrations take a `YYYYMMDDHHMMSS_` timestamp after the newest file in `web/supabase/migrations/`. Never edit an applied migration.
