# Lane: ponytail cleanup audit

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/ponytail`
- **Branch:** `game/ponytail`, cut from main at `d251c36e`.
- **Lock helper:** `/Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh`, with `LANE=game/ponytail`. Use it for any full tsc or vitest.

## Status (2026-10-22)

- **Phase A (read-only audit):** done. Output: `specs/ponytail-audit-2026-10-22.md`, committed on this branch (the commit that adds this line). Nothing else was edited; no tsc or vitest was run.
  - Risks R1 to R19; cleanup S1 to S10 [LAUNCH-SAFE] (~1,800 lines), F1 to F12 [LAUNCH-FIX] (~60 lines changed), A1 to A11 [AFTER-LAUNCH] (~230), D1 to D16 [DECISION] (~2,900).
  - Reported to the coordinator.
- **Phase B (apply):** not started. The coordinator picks which items apply. Items touching HQInterior, FounderDesk, Bag, ShopOverlay or `gui/flat` wait for `game/hq-interior` and `game/flat-ui` to merge.

## David's decisions

- **2026-10-22, R1 (via the coordinator):** "Take both off sale". The TSI tote bag and the TSI sticker pack aren't real. Off the catalogue (a new generated migration) and off the shop's 3D merch displays.

## Coordinator's corrections (2026-10-22)

- R2 was wrong: the moderation env vars are set on Vercel (Preview and Production, since Oct 7) and on Fly. F1 dropped.
- R7 was wrong too (found in Phase B): the admin hub links Merch pickups through `GameContentIndex`. F6 dropped; a test pins the link.

## Next

1. Wait for the coordinator's Phase B list. Then one `[build]` commit per item, re-finding symbols first (line numbers are at `d251c36e`), with tsc and the full vitest under the heavy lock after each batch.
2. Migrations for R16/R17 or R1 go in new files only; the coordinator applies them.

## Tools and gotchas

- No knip, ts-prune or madge. The import scan was a TypeScript-compiler-API script in the session scratchpad (`deadscan.mjs`, not in the repo): it resolves static imports, `import()`, import types, `require` and `vi.mock` in `web/` and `realtime/`. It can't see scripts that load modules through a built `path.join` (`author-elevation.mjs`, `snap-world-to-grid.mjs` load `coast.ts` and `terrain.ts` that way), so every candidate needs an `rg` over `web/`, `realtime/`, `art/`, `scripts/` and `specs/` before deleting.
- Evidence scripts shoot some portal pages (`specs/evidence/gui-sheet/shoot.mjs`, `specs/evidence/audit-2026-10/ui/shoot.cjs`): drop a page from their lists when it goes.
- Phase A edits nothing but the audit file and this lane file.
