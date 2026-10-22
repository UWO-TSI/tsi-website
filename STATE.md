# STATE.md

Current facts only: what's live, where, and the rules for changing it. Update it when direction changes, and move superseded sections to `archive/logs/` instead of stacking them here. Last updated 2026-10-22.

- **Lanes, review pages and what's waiting on David:** `specs/lanes/coordinator.md` (the coordinator keeps it current).
- **Full history before 2026-10-22** (the September recruitment round, the Free-tier outages, old branch maps, the 2026-09-29 launch log): `archive/logs/STATE-history-to-2026-10-22.md`.
- **Sessions on other devices:** read this before starting, pull `main` often and push small merges. The coordinator merges with whatever lands on `main`.

## Now (2026-10-22): v1 launch run, freeze Oct 24, launch Oct 31

- **Run sheet:** `specs/launch/v1-launch.md` (ledger row 317). Feature freeze on Oct 24; from Oct 25, only launch fixes.
- **Coordinator handoff and lanes:** `specs/lanes/` (the `coordinator.md` file, plus one per lane). Lanes restart fresh from these files.
- **Main:** `f66bafe6` and later. Merged since Oct 14:
  - the shop interior and the flat shop UI;
  - real merch (the keycap keychain, the lanyard, the GENESIS sticker), off sale until their catalogue rows land;
  - flat UI steps 1 and 2;
  - wardrobe batch 2.
- **Prod migrations:** all applied, including `20261017172740_catalogue_seed` (Oct 22). The record is `~/tethos-launch-2026-09-29/migrations.log`. They're applied through the query API, so Supabase's own migration ledger doesn't list them.
- **Realtime:** Fly `tethos-rt` v4 (Oct 14), current with the chat and friends code.
- **Supabase:** Pro since Oct 14.
- **Member world:** still closed in production (`NEXT_PUBLIC_MEMBER_WORLD` unset). It opens on Oct 31.
- **Running lanes** (each finishes its batch for the freeze):
  - `game/hq-interior`, layout B with taller ceilings;
  - `game/flat-ui`, round 3 panels and motion, then the avatar creator;
  - `game/wardrobe-followup`, the #04 visor logo, then the merch catalogue rows.
- **Launch work:** the launch lane (Preview, two-account test, env vars, smoke flows, Halloween check) and the perf lane (a quiet-window bench, the village regression).

## v1 "Arrival" (decided 2026-10-13)

- **The plan is `specs/v1-drop.md`,** decided with David. All eight v1 lanes (perf, community, emotes, opening, world, water, land, head fit) merged to `main` on 2026-10-14 (`8809c517`). The perf baseline was reset at `0fd7d615`. Prod has the `v1_drop_copy` and `traditions` migrations.
- **Waiting on David as of Oct 14:** accepting the proposals in `/lab/map` (`web/data/proposals/v1-barriers.json`, `v1-campfire.json`, the rock layer) and the draft lines (Bram, Rosa, Wren, the door answers). The current list is in `specs/lanes/coordinator.md`.
- **Ownership (David, 2026-10-14, row 308):** the coordinator session on the Mac mini owns the world editor, `/lab/map` and the world map files (`web/data/*map*.json`, the v2 draft). No other session edits them.
- **Story canon:** `specs/lore.md` (locked 2026-10-10) covers the Answer, the Keepers and their questions, the veil, the buried ship, the one-year arc, the never-resolved outside world, and the sudo pet system. Read it before writing any quest, NPC, monster, pet or cutscene content. The museum plaque is David's to write.
- **Classes v2:** all 16 subclasses (`specs/classes/design-sheet.md`) are on `main` behind `economy_settings.classes_v2`, which is 0 in production. The 80 signature weapons are seeded; the 40 class cosmetics stay inactive while the flag is off. David playtests at `/lab/classes` (dev only). Wave 5 (backfill, cosmetics on sale, balance pass, flag on) waits for his notes.

## Terrain v2: the world island (2026-10-10)

- **`specs/terrain-v2.md` is the plan**, agreed with David. His drawing became a 384x552 world draft that will replace the live member island once village, residents and fishing pass gates. Merged to `main` (`0c0310e6`): the generator `art/terrain/draft_from_png.py`, the draft data and fixture, 7 guard tests, `MAX_LEVEL` 6 to 8, and residentRoutine crash guards.
- Walk it at `/lab/island?fixture=v2`, paint it at `/lab/map?fixture=v2`. Frozen 2026-10-10: `web/data/world-map.json` is David's hand-edited source of truth (the painter's Save writes it; it's committed when he locks the layout). The generator no longer writes it.
- Since row 308 (Oct 14) the new world is being rebuilt as smooth terrain in a 3D editor (`specs/world-editor.md`). v1 launches Oct 31 on the current village.
- Still open: the village and wharf layout proposal (the Oracle Temple goes on the summit, the village is chill study, the wharf is the fishing-village entrance), and the combat home (north island or forest ruins, David deciding).

## Branches and deploys

- `main` equals `feat/game-default-island` (the coordinator's worktree is `.claude/worktrees/restart-art-cohesion`). Every verified merge goes to `main` right away (row 248). Vercel auto-deploys every push; there's no staging gate.
- Lanes work on `game/<lane>` branches in `.claude/worktrees/<lane>`. They never push; the coordinator merges.
- `game/avatar-v8` stays open, on hold for David's references.
- Short-lived branch per task, merged to `main` often (David's standing preference).

## Production

- **Vercel** team `davids-projects-e31987e3`. Project `uwotsi.com` (`prj_RHJizhUPiP9rWS4RkPdLJKNw5kqm`) serves `tethos.ca`, `www.tethos.ca`, `play.tethos.ca` and `uwotsi.com`. The second project `uwotsi` (`prj_SldZLuGi2Td2ErPj3IqvSRT0sVNH`) builds every push but serves nothing; it's safe to delete.
- `tethos.ca` 307s to `www.tethos.ca`. Smoke: `curl -sI https://www.tethos.ca/student/apply` returns 200, and `https://www.tethos.ca/api/positions` returns 200 JSON.
- **play.tethos.ca** (live since 2026-10-09, Namecheap CNAME `play` to `cname.vercel-dns.com`) serves the title screen. `www.tethos.ca/student` and portal paths 307 to play; play sends `/student/apply/*` and site pages back to www.
- **Member world gate:** `/student/dashboard`, `/student/onboarding` and `/student/companion` show `/student/opening-soon` until `NEXT_PUBLIC_MEMBER_WORLD=open` is set for Production in Vercel and redeployed (`web/lib/recruitment-access.ts`). On phones, `/student/dashboard` sends players to `/student/companion`.
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
