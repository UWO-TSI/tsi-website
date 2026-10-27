# Lane: collision (walkable edges and hitboxes in the new world)

Worktree `.claude/worktrees/collision`, branch `game/collision`, cut from main at 5d848445. Agent type `uwotsi-lane`. Launch priority.

David, 2026-10-26, after playing production (the new world):
- "wharf the deck near the ledge i just fall in the water"
- "the hit box is weird on the object and building sespecially, some object cant be walked through but should be, some objects can be walked through but shouldnt, and the big buildings hit box vs actual box is not matched"

**1. The wharf deck edge.** Walking near the deck's ledge drops you into the water. Find where the walkable deck (its cells or mask) and the drawn deck disagree, and where the deck has no edge stop. Expected: the deck holds you right up to its drawn edge; you leave it only by a ladder, stairs or the gangways, or by jumping off on purpose if that already exists. Check every deck edge, the three gangways, the boat landing, the jetty and the sushi bar's stilt deck.

**2. The hitbox audit.** Every object and building in the new world (`web/data/world`, the generator `web/lib/game/world/generate.ts`, the models it places):
- measure each model's drawn footprint (its GLB bounds or its walls, `web/scripts/glb-bbox`) against what blocks movement;
- buildings: the blocker matches the walls (the plaza buildings were scaled 1.32 and houses 1.15 in R2b; check the blockers followed), doors stay walkable to their trigger;
- solid things block: buildings, stalls, the fountain, the ship, crates, barrels, lamps' posts, rocks, tree trunks, fences, benches' frames;
- small or soft things don't: grass, flowers, small bushes, shells, rugs, decals, the plank floor, banners overhead, lanterns overhead;
- write the table (object, drawn size, blocker before, after) into `specs/evidence/collision/audit.md`.

Don't move or rearrange anything (David paints the layout; `specs/terrain-law.md`). Fix only what blocks. The village world stays unchanged: gate any shared change on the world, and its tests stay green.

**Verify:** tests for the deck edge (walk to every edge, never fall) and for a sample of blockers; a headless top-down debug render of blockers over the drawn world, before and after, in `specs/evidence/collision/`.

**Read first:** `CODEMAP.md` rows "World, terrain, grid", "Movement"; `specs/terrain-law.md` (the collision parts); `web/lib/game/world/walk.test.ts`, `village.ts`, `generate.ts` (blocker data); `web/lib/game/movement/sim.ts`.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new` (`cells.test` at `--testTimeout=30000`), tsc, eslint, the world regenerated reproducibly if you touch the generator. Message "main" after the wharf fix (it can ship first) and at the end with the head SHA, gates and evidence, then stop.

## Status

(none yet)

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/collision /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
