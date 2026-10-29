# Lane: newworld-fixes (fix the new-world bugs the village-archive lane skipped)

Worktree `.claude/worktrees/newworld-fixes`, branch `game/newworld-fixes`, cut from `game/village-archive` at `ef90c927`.

Read first: `specs/lanes/village-archive.md` (its "Skipped tests" list), `specs/design-bible.md`, CODEMAP sections 2 (world, villagers, study, multiplayer) and 6.

## Scope (coordinator, 2026-10-28)

Fix each skipped `// new world:` test at the root and un-skip it. Order (Halloween is Oct 31):
1. Halloween: pumpkins by only 7 of 59 lamps (`lib/content/traditions.ts`, `lib/game/halloween.test.ts`). Dusk shots with Halloween forced: plaza, wharf, one path. Send main the shots as soon as done (may ship alone).
2. Outdoor study seats: study:plaza-picnic / study:pier-bench don't exist on the new world; study-0..3 have no model. Reuse table/bench models.
3. Residents: 7 routine walks through solids; night owl's bench not under a lamp (residentRoutine, residentRoster).
4. bench-0 has no propFootprint (defaultIsland.test.ts).
5. Ambient fauna: leaping fish in open sea, butterfly patch, gull camera reach.
6. Dev bots / loopback (?bots): room bounds, bench seat lift 0.359 vs 0.344, seated count 0.

Rules: David decides layout. Small props the bugs need (pumpkins, study seats) are OK; don't move buildings, paths or landmarks without asking main. No fetched art. Don't regenerate the catalogue seed. Evidence in `specs/evidence/newworld-fixes/`.

## Status

Head: see git log. Done:
- 1 Halloween: `pumpkinLamp` (lib/game/halloween.ts) picks every lantern post on land and the quay (not hand lanterns, the jetty or the fountain ring: David's R2c "less pumpkins"), and each pumpkin stands at its post's foot on the lit side (the arm's direction), facing out; it steps round the post if the ground there isn't standable. 21 lamp pumpkins + door pairs on the new world. Test rewritten and un-skipped. Shots: `specs/evidence/newworld-fixes/halloween-*.webp` (evening, `?tradition=halloween`). Sent to main.
- 2 Study seats: the world's four model-less `study-0..3` (inert: no furniture, so no seats) became the backend's two outdoor anchors: `study:plaza-picnic` (picnic, 4 seats) at study-0's spot on the plaza rim by the café, turned along the rim; `study:pier-bench` (pier, 2 seats + parasol) on the quay at (71, 43) between the jetty's north and middle gangways, seats to the sea. study-1..3 removed. Same in generate.ts LAYOUT. New test lib/study/seats.newworld.test.ts. Shots `study-{plaza,pier}-{before,after}.webp`.
  - Side fix: lib/game/world/walk.test.ts's deck-edge test dashes on every other run, so a new solid on the quay flipped the parity and exposed a dash off the sushi bar's ramp onto the beach's toe-deep shallows, which the test counted as falling in. Its water check is now `island.wet` (deep water or the band beside a deck); it passes with every run dashing and with none.

## David's decisions

(none yet)

## Next

3. Residents.

## Tools and gotchas

- Locks: `LANE=game/newworld-fixes /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; retry on exit 75.
- New-world village in tests: `villageOfWorld(loadWorldFromDisk(<web>/data/world))`.
- Shots: scratchpad `nwf/run.sh <abs out> <views> "&tradition=halloween"` (dev server :3193 under the devserver lock, /lab/island, headless; `VIEWS` env JSON adds views; out path must be absolute, the script cd's into web).
- Known gate failure: lib/seedMigrations.test.ts (catalogue seed not regenerated; coordinator does it at merge).
