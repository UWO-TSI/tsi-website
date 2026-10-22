# Lane: ponytail cleanup audit

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/ponytail`
- **Branch:** `game/ponytail`, cut from main at `d251c36e`.
- **Lock helper:** `/Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh`, with `LANE=game/ponytail`. Use it for any full tsc or vitest.

## Status (2026-10-22)

- **Phase A (read-only audit):** done. Output: `specs/ponytail-audit-2026-10-22.md`, committed on this branch (the commit that adds this line). Nothing else was edited; no tsc or vitest was run.
  - Risks R1 to R19; cleanup S1 to S10 [LAUNCH-SAFE] (~1,800 lines), F1 to F12 [LAUNCH-FIX] (~60 lines changed), A1 to A11 [AFTER-LAUNCH] (~230), D1 to D16 [DECISION] (~2,900).
  - Reported to the coordinator.
- **Phase B (apply):** done; handed to the coordinator. Per-item commits and line counts: the "Applied (Phase B)" table at the end of `specs/ponytail-audit-2026-10-22.md`.
  - Applied: R1 (David's off-sale), F2, F3, F4, F5, F7, F8, F9, F10, F11, F12, S1, S2, S3, S5, S6, S7 (partial), S8, S9. Dropped: F1, F6 (the audit was wrong). About −1,650 lines of code.
  - Main merged in at 3e6ced4b (flat-ui) and 2d359c38 (themes).
  - Gates on the head: full tsc (web, realtime), full vitest (web 353 files / 3,362 tests; realtime 10 / 222), eslint on every changed file, SQL smoke green. Evidence: `specs/evidence/ponytail/`.
  - **Needs, outside this lane:** a realtime deploy for F3; prod apply of `20261022212455_catalogue_seed.sql` (R1).
  - Waiting on `game/hq-interior`: S7's lazy-loading of the scenes (A13).

## David's decisions

- **2026-10-22, R1 (via the coordinator):** "Take both off sale". The TSI tote bag and the TSI sticker pack aren't real. Off the catalogue (a new generated migration) and off the shop's 3D merch displays.

## Coordinator's corrections (2026-10-22)

- R2 was wrong: the moderation env vars are set on Vercel (Preview and Production, since Oct 7) and on Fly. F1 dropped.
- R7 was wrong too (found in Phase B): the admin hub links Merch pickups through `GameContentIndex`. F6 dropped; a test pins the link.

## Next

1. Stop. The coordinator merges, deploys realtime (F3) and applies the R1 migration.
2. After `game/hq-interior` merges, if asked: A13 (lazy-load the café, Oracle, home and ruins scenes in `DefaultIslandWorld.tsx`; ShopOverlay calls `buyAtCounter`).

## Tools and gotchas

- No knip, ts-prune or madge. The import scan was a TypeScript-compiler-API script in the session scratchpad (`deadscan.mjs`, not in the repo): it resolves static imports, `import()`, import types, `require` and `vi.mock` in `web/` and `realtime/`. It can't see scripts that load modules through a built `path.join` (`author-elevation.mjs`, `snap-world-to-grid.mjs` load `coast.ts` and `terrain.ts` that way), so every candidate needs an `rg` over `web/`, `realtime/`, `art/`, `scripts/` and `specs/` before deleting.
- Evidence scripts shoot some portal pages (`specs/evidence/gui-sheet/shoot.mjs`, `specs/evidence/audit-2026-10/ui/shoot.cjs`): drop a page from their lists when it goes.
- Phase A edits nothing but the audit file and this lane file.
- With swap over 9 GB and the devserver lock held, the heavy lock can't be taken. A scoped typecheck keeps the per-commit gate light: a tsconfig in the scratchpad that extends `web/tsconfig.json` with `files` = the changed files, plus `node_modules/next/index.d.ts`, `global.d.ts`, `types/*.d.ts`, `"types": ["node"]` and `typeRoots` pointed at `web/node_modules/@types` (without those it misses CSS modules and `process`). Run the full tsc under the lock before the handoff.
- `realtime/node_modules` isn't in a fresh worktree: clone it with `cp -cR` from another worktree's `realtime/node_modules` (it's ignored).
- Only queue for the devserver lock when the browser work is ready to run; leave the queue while coding (the coordinator moves a lane that sits first without taking the lock).
- The evidence shoot: `HOST=http://localhost:<port> node specs/evidence/ponytail/shoot.mjs <out> <tag> campfire creator scenes net applicant`. The reflection's "Yes" bobs, so it needs a forced click. The applicant island needs Supabase and doesn't render with the env blanked.
- `git checkout <sha> -- <files>` stages the old versions; put them back with `git checkout HEAD -- <files>` before any commit.
