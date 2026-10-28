# Lane: village-archive (retire the village; the new world is the member island's only world)

Worktree `.claude/worktrees/village-archive`, branch `game/village-archive`, cut from main at `a017efae`.

Read first: `web/lib/game/world/active.ts`, `web/lib/game/villageMap.ts`, `web/lib/game/world/load.ts`, `web/lib/collections/rolls.ts`. Don't touch the applicant island (`/student/apply/portal`, `lib/game/applicantVillage.ts`) or the title's look (`components/title/`).

## Status

Started 2026-10-28. Step 1 (the map) in progress.

## David's decisions

- 2026-10-28: "why are we using the old island for some of these artifcats, it should not be used or archived"

## Scope (coordinator, 2026-10-28)

- Map approved. The title moves to the new world too (David's quote supersedes row 318); before/after title shots go to David before merge (`specs/evidence/village-archive/title-*.webp`). Touch TitleScene only for the swap (game/loading has a Strict Mode fix there).
- Ledger row is **321**.
- Docs: the coordinator edits CLAUDE.md, STATE.md, CODEMAP.md, specs/INDEX.md, specs/lane-rules.md, specs/lanes/README.md, specs/perf/budget.md. Don't. Report doc lines to fix instead. This lane keeps: ledger row 321, archive/village/README.md, moving specs/island-painter.md, island-core.md, terrain-blending.md, acnh-system-reference.md into archive/village/.
- Expansion: every retired island goes. /lab/map whole (page, lib/game/mapBudget.ts, scripts/map-budget.mjs; keep painterTools.ts; mapHealth.ts goes); the legacy draft (data/island-map.json, scripts/author-elevation.mjs, scripts/preview-map.mjs, lib/game/coast.ts, islandMap.test.ts); the v2 cell world (data/world-map.json, fixtures/terrainV2Draft.ts + test, convert.ts's convertCells/heightsFromCells/tierDistance/blurToSamples + convert.test.ts, app/api/lab/world-map, /lab/island `?fixture=v2-cells`, `?draft=1`, `?proposals=1`, art/terrain/draft_from_png.py, scripts/convert-world.ts); placement proposals (lib/game/proposals.ts + test, data/proposals/v1-*.json, art/barriers/propose_v1.py, hooks in WorldEditor.tsx and editorStore.ts). Re-point halloween, campfireSite, barriers, groundGate tests at web/data/world. perf: the bench's v2 scene on the live world. Data files to archive/ with a README line each; code deleted; report lines removed.
- Routines: pond → beach, path → plaza at the source (residentRoster.ts, content-defaults.ts); keep placeAt's same-name fallback; test that every schedule place resolves on the new world. SEEDED_AS stays. Don't regenerate the catalogue seed.
- Bundle: measure title / island / applicant chunks before and after (`tools/chunks.mjs` in the scratchpad; before: title 850 KB gz with village data, island 1637 KB gz, applicant 1147 KB gz with village data). If world.json lands somewhere new that doesn't need it, import it lazily.

## Next

1. Map every world branch and every test that pins the village; send main the list before deleting anything.
2. `village()` and the server judge the new world unconditionally; drop `NEXT_PUBLIC_GAME_WORLD` and the village branches.
3. Village-only data to `archive/village/` with a README; delete village-only tests, rewrite fixture-only ones on the new world.
4. Docs: lane rules, lanes README, CODEMAP, STATE, lane files, ledger row, CLAUDE.md lines naming the village as live or fallback.
5. perf: drop the village scenes from `specs/perf/perf-check.mjs` and `baseline.json`; one perf:check at the end, the new world as the baseline.
6. Gates: tsc, one vitest run, eslint on changed files, `npm run build` (flag unset), one headless smoke + screenshot in `specs/evidence/village-archive/`.

## Tools and gotchas

- Lock helper: `LANE=game/village-archive /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`.
- "village" is also the member island's area name (net protocol, `Site`, `Area`, `TripPlace`, the collections API): that's a name, not the old island. Leave it.
- `v.terrain` branches tell a heightfield world from a cell world (labs, fixtures, the server's cell view, the title, the applicant island): not world-switch branches.
