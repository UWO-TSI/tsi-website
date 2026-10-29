# Lane: title-perf (the title loads only what it sees; no first-sight shader compile in play)

Worktree `.claude/worktrees/title-perf`, branch `game/title-perf`, cut from game/loading 59ef45b9 (which has
game/village-archive and main de87c07f). Agent type `uwotsi-lane`.

David (earlier): "the entry loading screen takes forever to load, I need more on performance, loading speed and lag
spikes". The loading lane measured two regressions after the title moved onto the new world
(`specs/evidence/loading/after.md` "Round 2"):
1. The title has 113 frames over 50 ms while it streams 503 models (the whole world), though its camera sees only the
   plaza and the HQ.
2. A 482 ms first-sight shader compile lands in the first minute of play (round 1 had none).

**Task (coordinator, 2026-10-28):**
1. The title loads and draws only what its camera can see across the whole dolly, all four phases
   (`web/components/title/shots.ts`). After Let's Play the island loads the rest as today. Pixel-identical title:
   before/after stills from the same shots.
2. Find the material or effect that compiles at first sight in play and precompile it during the loading screen.

Measure with `specs/perf/load-trace.mjs` (measurement build, same lines as rounds 1 and 2): long frames on the title,
models loaded on the title, world ready fast/slow, downloaded MB, long frames in the first minute of play. Before
(59ef45b9) and after.

Gates: tsc, one vitest run (2 known `seedMigrations` failures), eslint on changed files, `npm run build` under the
heavy lock, one perf:check (SCENES=v2). Commit `[build]`, don't push.

**Read first:** `specs/lanes/loading.md` (Tools and gotchas), `specs/evidence/loading/after.md` "Round 2",
`web/components/title/` (TitleScene, TitleVillage, shots), `web/components/game/InstancedNature.tsx`.

## Status

Done 2026-10-28, reported. The code is 226ae4f4; the evidence commit is on top. Numbers, causes and the pixel proof
are in `specs/evidence/title-perf/results.md`.
- Title: 61 point lights (Lanterns, one per lamp) caused the 49 to 56 ms frames. It now lights only the lamps whose
  5 u light reaches the frame (`titleView` in `components/title/shots.ts`; `Lanterns` `lit`): 7 of 59. Long frames
  143 -> 6 (fast cold), median 55 -> 6.9 ms. The prefetch now runs (it had been starved of idle time): world ready
  8.6 -> 7.5 s, 25 -> 4.6 MB after Let's Play.
- Play: the warm-up compiles the blended programs of things that fade (`userData.fades`, VillageLife's bugs) and
  keeps every program it made (`keepPrograms`). There were no links in play after.
- The model cull was dropped (coordinator agreed): it needs per-model bounds, and saves about 3 MB.
- Play on the new world is already capped (LampPool, point9).
- Gates: tsc, eslint and the build are clean; vitest has only the 2 known seedMigrations failures; perf:check v2 passed.

## David's decisions

(none for this lane yet)

## Next

Nothing. Open, outside this lane:
- `applyEnvironment` makes a new PMREMGenerator for each rebake (2 links in play when the phase turns; under 50 ms
  here).
- Module-scope `useGLTF.preload`s (NatureModels PRELOAD and others) load about 40 files on the title that it never
  draws.

## Tools and gotchas

- Locks: `LANE=game/title-perf /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>` (waits by
  itself; exit 75 after 20 min, retry). No queue file.
- See `specs/lanes/loading.md` "Tools and gotchas" for the build, serve and trace commands. After each measurement
  build, drop the `/student/dashboard` matcher from `web/.next/server/middleware-manifest.json`.
- `specs/perf/title-probe.mjs` (under `next dev`): `perf` gives title frame times, point lights, draws and models;
  `still` gives deterministic stills (Playwright clock, the R3F clock pinned, seeded random) for pixel diffs.
- Run perf:check as a measurement build (heavy lock), then `SKIP_BUILD=1 SCENES=v2 npm run perf:check` under the
  devserver lock: the full command can run past 10 minutes.

## Rules

- Headless only; never `open`, never the Playwright MCP or claude-in-chrome; never port 3000.
- New world only. Don't change how anything looks.
- Never push; never bare `git stash`; kill only PIDs you started.
