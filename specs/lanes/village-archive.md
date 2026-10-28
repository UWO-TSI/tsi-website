# Lane: village-archive (retire the village; the new world is the member island's only world)

Worktree `.claude/worktrees/village-archive`, branch `game/village-archive`, cut from main at `a017efae`.

Read first: `web/lib/game/world/active.ts`, `web/lib/game/villageMap.ts`, `web/lib/game/world/load.ts`, `web/lib/collections/rolls.ts`. Don't touch the applicant island (`/student/apply/portal`, `lib/game/applicantVillage.ts`) or the title's look (`components/title/`).

## Status

Head: see `git log` (milestone 1 `bebe67a4`, main de87c07f merged `1e40fd1f`). Done:
- `village()` starts on the new world's cell view (cells.json + world.json; lib/game/villageMap.ts), the server (rolls.ts) judges it unconditionally, `loadGameWorld` always loads (a failed load shows "Reload island", no fallback). `active.ts` is `worldModel(url)` only. One arrival route (`routes/new.ts`).
- The title loads the member world (`loadGameWorld`, reused after Let's Play); its shots are staged in the HQ's frame (`components/title/shots.ts atHq`).
- Retired and moved to `archive/village/` (README): village-map.json, island-map.json, world-map.json, the v1 proposals, the four specs, the wharf dressing and rowboat GLBs. Deleted: /lab/map, mapBudget, mapHealth, map-budget, author-elevation, preview-map, coast, islandMap.test, proposals (+ editor hooks), terrainV2Draft, convert chain + convert-world, api/lab/world-map, draft_from_png, propose_v1, the wharf's `dressed` dressing (finger pier, lanterns, rowboats), residentSpots/anchorAt/SHARED_SPACING, villageJson, turnQuarter, PAINTER_DRAFT_KEY, RAW_TURN_X's village turn. /lab/island = the member island + `?fixture=terrain`.
- Schedules: pond → beach, path → plaza (residentRoster, content-defaults); test that every schedule place resolves on the new world. residentHome and placeAt lost their village branches.
- perf: the village and v2cells scenes are gone (perf-bench, perf-check, budget.ts); v2 is the member island.
- Ledger row 321.

### Skipped tests: new-world gaps for a follow-up lane (coordinator, 2026-10-28)

Each is `it.skip` with a `// new world: ...` note.
- lib/game/halloween.test.ts: pumpkins stand by only 7 of 59 lamps.
- lib/game/residentRoutine.test.ts: 7 walks pass through a solid; the night owl's bench isn't under a lamp (20.6 u off).
- lib/game/ambientFauna.test.ts: a butterfly's patch check; no leaping-fish spots in open sea (0); gull circles fail the camera-reach check.
- lib/game/defaultIsland.test.ts: bench-0 has no propFootprint (still after remodel round 3).
- lib/net/botBrain.test.ts: the dev bots' world check (places/benches/shores); bots break the room's bounds checks; bench seat lift 0.359 vs 0.344.
- lib/net/loopback.test.ts: loopback positions fail the area check.
- components/game/net/drive.loopback.test.ts: no bot ends up seated (0).

Kept: `web/lib/game/fixtures/village-2026-09-28.json`, a frozen cell-map test fixture that 7 cell-mechanics tests use (seabed, glints, decorative fish, casting); the game never loads it. The plain pier (`PIER_URL`, `WHARF_DECK_LOCAL`) stays for the home island and cell fixtures.

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

Done; reported 2026-10-28. Waiting on David's review of the title (specs/evidence/village-archive/title-*.webp) before merge.
Gates at the head: tsc 0 errors; one full vitest run (no flag) 3469 passed, 16 skipped, 2 failed: lib/seedMigrations.test.ts, because the roster's schedules changed and the catalogue seed isn't regenerated (the coordinator does that at merge). eslint clean on changed files. `npm run build` with no flag: ok.
Bundle (all JS a route can load, gzip; main de87c07f → branch): title 870 → 984 KB (the world document, which the title now renders), island 1772 → 1767 KB, applicant 1150 → 1147 KB (no world data, no village data).
perf:check SCENES=v2 (headless, 5 runs): High 4.8 ms median, p95 7.0, 359 draws, 757k tris; Lite 2.9 ms, p95 5.2, 289 draws, 567k tris. Against the 2026-10-14 v2 row the draws were over 10% (that row predates terrain v3 and the remodels); now the baseline. Within budget.

## Tools and gotchas

- Lock helper: `LANE=game/village-archive /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>` (waits by itself; retry on exit 75; there is no queue file).
- Tests that need the member island as the game plays it: `villageOfWorld(loadWorldFromDisk(<web>/data/world))`, or `setVillage(...)` of it at the top of the file. Bare `village()` is the cell view (no heightfield).
- Builds need placeholder Supabase env (`NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder`) or /admin/recruit's prerender fails.
- "village" is also the member island's area name (net protocol, `Site`, `Area`, `TripPlace`, the collections API): that's a name, not the old island. Leave it.
- `v.terrain` branches tell a heightfield world from a cell world (labs, fixtures, the server's cell view, the title, the applicant island): not world-switch branches.
