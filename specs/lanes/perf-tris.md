# Lane: perf-tris (the new world's triangles back under budget, without changing the look)

Worktree `.claude/worktrees/perf-tris`, branch `game/perf-tris`, cut from main at 2e7bd27f. Agent type `uwotsi-lane`.

**The problem (coordinator, 2026-10-28):** `SCENES=v2 RUNS=1 npm run perf:check` on main (2e7bd27f), headless:
- High: 405 draws, 1,369,097 triangles (budget 1,200,000).
- Lite: 340 draws, 1,169,345 triangles (budget 950,000).
- perf-newworld left Lite at 969k triangles (its Pass 3, `specs/lanes/perf-newworld.md`), so about 200k came in after it. Draws (about 400) match where perf-newworld left them, so draws are not the target here.
- Frame times from headless runs are noise at this machine's load (spread 157%), so judge by triangles and draws, which are deterministic. `specs/perf/baseline.json`'s v2 rows are the village's old numbers, not a new-world baseline.

**Steps:**
1. **Attribute.** Find what added triangles since perf-newworld Pass 3, by merge (likely candidates: grass-wind, reflection-waves, remodel step 1's cart, lighthouse, fence and 81 fish, wharf-art, terrain-v3's later rounds) and by object group in the v2 scene, per tier. Write the table into Status before changing anything.
2. **Cut without changing the look:** LOD distances and LOD2 on Lite, instancing or merging, dropping hidden or underground faces, decimating far meshes that read the same, culling by the curved world's sink distance (nothing past about 80 u shows). Each cut gets a before and after render at the same camera.
3. **Look changes need David.** If a target can't be reached without a visible change, stop at the best no-look-change result and list each further step with what it would cost in look. Don't make those changes.
4. **New world only.** The village stays unchanged.

**Gates:** tsc; vitest with and without `NEXT_PUBLIC_GAME_WORLD=new` (budget.test included); eslint on changed files; one `SCENES=v2 RUNS=1 npm run perf:check` at the end (run it bare: it takes the heavy and devserver locks itself). Renders in `specs/evidence/perf-tris/`.

**Report:** commit, update Status here, SendMessage "main" with the attribution table, the before and after triangles and draws per tier, what changed, and the renders. Then stop.

**Rules:**
- Headless only: no visible windows, no `open`, never the Playwright MCP, the claude-in-chrome tools or the blender MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`.
- Locks: `LANE=game/perf-tris /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`, retried in a background loop while it exits 75. Keep each devserver hold to one short batch. There is no queue file; never create one. perf:check takes its own locks, so never wrap it in withlock.
- Kill only processes you started. Never touch port 3000. Delete web/.next when done with a server.
- Git: commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees.
- No fetched art, assets or generators. Writing: no em dashes.

## Status

Not started.
