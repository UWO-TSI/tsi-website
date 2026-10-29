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

Head: see git log. All six items done; every `// new world:` skip is gone. Done:
- 1 Halloween: `pumpkinLamp` (lib/game/halloween.ts) picks every lantern post on land and the quay (not hand lanterns, the jetty or the fountain ring: David's R2c "less pumpkins"), and each pumpkin stands at its post's foot on the lit side (the arm's direction), facing out; it steps round the post if the ground there isn't standable. 21 lamp pumpkins + door pairs on the new world. Test rewritten and un-skipped. Shots: `specs/evidence/newworld-fixes/halloween-*.webp` (evening, `?tradition=halloween`). Sent to main.
- 2 Study seats: the world's four model-less `study-0..3` (inert: no furniture, so no seats) became the backend's two outdoor anchors: `study:plaza-picnic` (picnic, 4 seats) at study-0's spot on the plaza rim by the café, turned along the rim; `study:pier-bench` (pier, 2 seats + parasol) on the quay at (71, 43) between the jetty's north and middle gangways, seats to the sea. study-1..3 removed. Same in generate.ts LAYOUT. New test lib/study/seats.newworld.test.ts. Shots `study-{plaza,pier}-{before,after}.webp`.
  - Side fix: lib/game/world/walk.test.ts's deck-edge test dashes on every other run, so a new solid on the quay flipped the parity and exposed a dash off the sushi bar's ramp onto the beach's toe-deep shallows, which the test counted as falling in. Its water check is now `island.wet` (deep water or the band beside a deck); it passes with every run dashing and with none.
- 3 Residents: NavGrid (lib/game/residentRoutine.ts) let walks cut through lamp posts (0.16 across): `clear` sampled every 0.2 and `body` probed only 4 axis points, so a post slipped between. Now it samples every 0.1 and probes the body's rim every 45°. A bench is "under a lamp" only by a lamp with a pool of light (not a hand lantern): the night owl moved from the campfire bench lit only by a hand lantern to the one by the campfire's lantern post. The night test now checks every night sitter against the lamp posts (it read `objectsOf("lamp")[0]`, a village-era single lamp). Shots `resident-night-owl-{before,after}.webp` (`&at=01:30&time=night`).
- 4 bench-0: the plaza's rim benches carried no model, and only `propsOf` filled in "plaza-bench", so anything reading the bench objects (the test, the footprint) saw none. world.json and generate.ts's `rimBench` now give them `model: "plaza-bench"`; `propsOf`'s fallback is deleted. Nothing a player sees changes (propsOf already drew and blocked them).
- 5 Fauna: butterflies: a patch was the flowers within 7 of home; the new world's 26 flowers stand scattered, so a flight crossed up to 10 u of open grass. `PATCH_R` = 3.5 (lib/game/ambientFauna.ts). Leaping fish and gulls were test-only: the test centred leaps on the village's sea (0, -25), now off the jetty (100, 46); the gull test's extra anchor was the village pond (-24, 12), now at sea (110, 46). The game's calls (camera focus, `gullAnchors(v.bounds)`) were right. No stills: the butterfly change shows only in motion.
- 6 Bots and loopback: the root of the room's bounds strikes was the island's `top` over deep water, which was the seabed (down to -12), so a fall off the jetty sank a body to the seabed before it splashed: below the room's floor (protocol OUTDOOR yMin -3), and the splash showed underwater. `islandOf`'s `top` is now the sea's surface over wet water (lib/game/defaultIsland.ts); real players get the same fix. The bots' shore spots require water at every 0.5 u from 1.6 to 8 out (one had a sandbar at 2; lib/net/botBrain.ts OPEN_WATER). The wire's bench lift is checked against `benchLift` at the slot: the plaza's stone slopes, so 0.359 is right, and 0.344 assumed flat ground. In the drive test, LOD distance was measured from the origin (the village's centre), so all 24 bots were hidden; it's now from the spawn. The "seated 0" note was really this `maxShown` assertion.
  - Evidence `sea-fall-{before,after}-strip.webp` (coordinator's ask): the player jumps off the jetty's middle finger from the game camera. Before (ef90c927): falls through the water to y -4.36, splashes on the seabed, the camera dives after them. After: splash at y -0.14 on the surface (rings on the water), sinks to -0.41 over half a second, respawns on the pier at 1.18 s. Script: scratchpad `nwf/fall.mjs` (via run.sh with `SCRIPT=`).

## David's decisions

(none yet)

## Next

Done. Report sent to main. Waiting for review (David on the Halloween shots).

## Tools and gotchas

- Locks: `LANE=game/newworld-fixes /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; retry on exit 75.
- New-world village in tests: `villageOfWorld(loadWorldFromDisk(<web>/data/world))`.
- Shots: scratchpad `nwf/run.sh <abs out> <views> "&tradition=halloween"` (dev server :3193 under the devserver lock, /lab/island, headless; `VIEWS` env JSON adds views; out path must be absolute, the script cd's into web).
- Clock: `?at=HH:MM` sets the world clock (residents follow it); position then needs `at=x,z` too (both repeat). The shot script passes extras as its third arg.
- Known gate failure: lib/seedMigrations.test.ts (catalogue seed not regenerated; coordinator does it at merge).
