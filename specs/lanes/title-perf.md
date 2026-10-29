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

Started 2026-10-28. Head 59ef45b9 (nothing committed yet).

## David's decisions

(none for this lane yet)

## Next

1. Before numbers at 59ef45b9 (measurement build, load-trace fast cold / slow warm), and before stills (four phases,
   dolly ends and middle).
2. Title cull: mount only the placements the dolly's view can reach.
3. Find the first-sight compile in play; add it to the loading screen's warm-up.
4. After numbers, stills diff, gates, report.

## Tools and gotchas

- Locks: `LANE=game/title-perf /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>` (waits by
  itself; exit 75 after 20 min, retry). No queue file.
- See `specs/lanes/loading.md` "Tools and gotchas" for the build, serve and trace commands.

## Rules

- Headless only; never `open`, never the Playwright MCP or claude-in-chrome; never port 3000.
- New world only. Don't change how anything looks.
- Never push; never bare `git stash`; kill only PIDs you started.
