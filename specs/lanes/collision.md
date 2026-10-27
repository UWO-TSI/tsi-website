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

- **Wharf deck edge: done, 6969b2ac** (can ship first). The `deck` board squares are walkable decks (turned, at their
  tile's height); the shallows within 1.5 of any deck are unwadeable water, so every deck edge over the sea holds you.
  Test: `walk.test.ts` "holds you on every deck right up to its drawn edge" (sprint and dash across every edge of the
  squares, the jetty and the sushi bar: never into the water, and stopped at the edge, not short of it).
- **Hitbox audit: done** (this commit; head SHA in the report). Table and before/after renders in
  `specs/evidence/collision/audit.md`. Fixes, all on the smooth world only (the village's cell walker is unchanged):
  prop tops stand on the ground under them (they were read as heights over the sea, so the plaza's and the wharf's
  props were walked through); buildings block their measured wall box, turned with them (`BUILDING_SOLID`); lamp posts
  are solid (`NEW_LAMPS[kind].post`); new-world footprints fitted (centre offsets in `PROP_FOOTPRINT`, the round
  fountain `ROUND_PROPS`). Tests in `walk.test.ts` and `propModels.test.ts`.
- Not approved by David yet. Flagged to the coordinator: the broken market-cart GLB, the walk-through campfire, the
  invisible seatable plaza benches, the village's same building offsets (all in audit.md).

## Next

- Nothing, unless review asks. If David repaints the world, rerun the audit:
  `cd web && AUDIT_OUT=/tmp/audit npx vitest run lib/game/world/collisionAudit.test.ts`.

## Tools and gotchas

- The audit generator `web/lib/game/world/collisionAudit.test.ts` is skipped in normal runs; it writes PNGs and
  `audit.json` to `AUDIT_OUT` (`AUDIT_PNG=0` for the table only). Its "before" renders came from a detached worktree at
  main 1d9a951e with the same file copied in.
- `scripts/glb-bbox.mjs` reads accessor min/max only: it can't see a broken index buffer (the market cart) or a body
  height slice; the audit reads triangles.
- A test that starts the sim at a point inside a solid gets y = Infinity (the plaza lamp 5.4 east of the fountain).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/collision /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
