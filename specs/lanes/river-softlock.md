# Lane: river-softlock (a dash-slide over the river soft-locks the player in an unreleased region)

Worktree `.claude/worktrees/river-softlock`, branch `game/river-softlock`, cut from `game/newworld-fixes` at `7cfc3230` (on `game/village-archive`).

Read first: `specs/lane-rules.md`, `specs/lanes/newworld-fixes.md` (the island's `top` over deep water is now the sea's surface), CODEMAP section 2 (Movement, World), `lib/game/drops.ts`, `lib/game/barriers.ts`, `lib/game/movement/sim.ts`.

## Scope (coordinator, 2026-10-28)

David (2026-10-29, playtesting): "i can dash slide across the river but i get soft locked there cuz i cant dash back and i just drown and respawn where i was but i also cant go on the other side of the island cuz unreleased".

Fix at the root:
1. No movement mode (walk, dash, slide, jump, glider, knockback) may enter a locked (DROPS-gated) region. Use the same check walking uses; no second barrier system.
2. Respawn and recovery always land on a reachable released spot: last safe position is never recorded in a locked region or a stranded patch; a player already in a locked region recovers to the nearest released safe spot.

Tests: dash-slide from the near bank toward the locked far bank ends on the released side; a drown on the far bank respawns on the released side; the last-safe tracker never stores a locked-region point.
Evidence: headless strip of the dash-slide at the river, before (parent, crosses) and after (stops), in `specs/evidence/river-softlock/`.
Gates: tsc, one vitest run (2 known `seedMigrations` failures expected), eslint on changed files. Commit `[build]`, don't push.

## Status

Head: see git log. Done: the soft lock (first commit) and the two study items (second commit). Reported to main.
- **Root cause:** the border's far-bank wall (generate.ts FAR_BANK) stands 2 to 3 u west of the river's west waterline. That leaves a strip of land between the river and the wall that walking can't reach. A slide-jump or sprint-jump with an air dash off the near bank (z 12 to 19) landed on it, the sim recorded `safe` there, and every splash put the player back on the strip.
- **Fix:** `releaseRegions` (lib/game/barriers.ts), built lazily in `islandOf` (smooth world only), fills a half-unit lattice of land from the spawn with the barriers as walls. Land walking reaches is released. Unreached land that meets a barrier is locked. Other land (the islets) is stranded.
  - The sim (movement/sim.ts) gains `MoveWorld.locked` (a wall in `inside`, the one collision test, so walk, dash, slide, jump, glide and push all respect it) and `released` (the only ground the safe tracker and the mantle record).
  - `createMoveState` and the splash respawn send a start or a kept safe spot that isn't released to the nearest released spot (`refuge`). A body found inside locked land goes straight there (a "respawn" event).
  - `island.top` and `standable` are unchanged, so grass and props on locked land still draw.
- Cost: about 24 ms in node, once per island (only the released and locked land is filled; the open sea is never asked). Memory about 1.7 MB (two 848k-cell byte arrays). DROPS is fixed per page load; the regions follow `barrierPlacements` at build (tested with drop 1 against drop 2).
- Tests: lib/game/world/released.test.ts. Two geometry tests that walk on locked land (the oracle door, the mountain's steep face) now use the island without the regions.
- Evidence: `specs/evidence/river-softlock/dash-slide-{before,after}-strip.webp`. The autopilot does a dash, a crouch slide, a slide-jump at the bank and an air dash at z 14. Before (7cfc3230), the player lands at x -51.5 on the far bank and the border notice shows. After, the player bonks the far bank, splashes and respawns at x -43 on the near bank.

## David's decisions

- 2026-10-29: "i can dash slide across the river but i get soft locked there cuz i cant dash back and i just drown and respawn where i was but i also cant go on the other side of the island cuz unreleased".
- New-world fixes page (via the coordinator): nf-study-pier "shouldnt be study table should just be bench"; nf-study-plaza "not needed".

- Study items (David on the new-world fixes page):
  - The quay spot `study:pier-bench` (71, 43, yaw -π/2) is now study furniture `bench`: the plaza's backless bench (`SCENERY_URLS["plaza-bench"]`), its 2 seats on its slots, facing the sea (+x), solid as the prop. There is no table, no log benches and no parasol. Its anchor stays because the café is closed at drop 1, so this is the only study spot.
  - The plaza picnic is gone from world.json, generate.ts LAYOUT and DEFAULT_TABLES (T(8)). The demo's closed scenario seats Maya on the bench.
  - The migration `20261029010000_study_outdoor_bench.sql` retires the picnic row (active = false, so its sessions and chat stay) and relabels the pier to "Pier bench". The generated seed blocks need `node scripts/gen-seeds.mjs` (the coordinator).
  - Evidence: `study-pier-{before,after}.webp`. Tests: seats.newworld.test.ts (one outdoor spot, facing the sea), seats.test.ts (the fixture is a bench).
- Gates: tsc clean, eslint clean on changed files. One vitest run: 4 failures, all generated seed blocks (seedMigrations ×3 including study-tables, plus study.test's seed block). The regions measured 11 ms in the suite and 24 ms alone.

## Next

Done. Waiting for review.

## Tools and gotchas

- Locks: `LANE=game/river-softlock /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`; retry on exit 75. Port 3300 is David's; never 3000.
- New-world village in tests: `villageOfWorld(loadWorldFromDisk(<web>/data/world))`.
- River shot: scratchpad `rsl/run.sh <abs out> <yaw> <zoom> <pitch>` (dev :3311, /lab/island, stepped with `__move.pause/run` and `autopilot`). Run it as `0 1.7 0.95`.
- Known gate failures: the generated seed blocks (lib/seedMigrations.test.ts, lib/study/study.test.ts seed): the coordinator runs gen-seeds.
- Quay shot: scratchpad `rsl/run2.sh` with `SHOT=quay.mjs` (two angles of (71, 43)).
