# Lane: grass-wind (longer grass, wind waves, ground colour)

Worktree `.claude/worktrees/grass-wind`, branch `game/grass-wind`, cut from main at 5d848445. Agent type `uwotsi-lane`.

David, 2026-10-26, after playing the new world on production, verbatim: "grass is ugly and sticks out ugly, should be longer blades of grass that have some logiic to make them sway like a texture like how waves sway from wind, color should match the floor color"

What that means:
- **Longer blades,** thin and tapered, not stubby tufts that stick out of the ground. Soft cartoony style (ACNH), no realism.
- **Wind as travelling waves:** gusts that roll across the field in bands, the way wind moves over a meadow and the way waves move on the water, so neighbouring blades bend together and the pattern visibly travels. Not each blade wobbling on its own.
- **Colour from the ground:** each blade's base takes the ground colour right under it (the terrain's own colour at that point, sampled from the ground's colour source, not a fixed green), lightening a little toward the tip, so the grass grows out of the floor instead of sitting on it. It follows the ground through the seasons and the night look the way the ground does.

Find the new world's grass first (`CODEMAP.md` row "Nature, grass, FX": `web/lib/game/grassField.ts`, `InstancedNature.tsx`, `natureLod.ts`, and whatever the new world's terrain draws). **Change only the new world's grass:** the village's stays exactly as it is (gate it on the world).

**Performance first:** grass is many instances. Keep draws flat (one instanced draw per chunk or less), keep the triangle count at or under today's (the new world is already over its triangle budget, about 1.4M on High against 1.2M; don't add to it, cut if you can), do the wind in the vertex shader, fade with distance, and keep a Lite version. Run `perf:check` once at the end with `SCENES=v2` and report the numbers against today's.

**Evidence:** headless shots of the same spots before and after (meadow edge, plaza edge, the riverbank, day and evening), plus a short frame sequence of a gust rolling through, in `specs/evidence/grass-wind/`. The coordinator puts them on a review page for David; visual work isn't merged before he approves.

**Read first:** `CODEMAP.md` rows "Nature, grass, FX", "Rendering look", "Perf budget"; `specs/perf/budget.md`; the files above.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, one `perf:check`. Message "main" with the head SHA, gates, perf and evidence, then stop.

## Status

(none yet)

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/grass-wind /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
