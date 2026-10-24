# Lane: terrain-v3 (the new world rebuilt from David's plan, row 318)

Worktree `.claude/worktrees/terrain-v3`, branch `game/terrain-v3`, cut from main. Agent type `uwotsi-lane`.

**Read first, in order:**
1. `specs/launch/terrain-v3.md`: the build, the rounds and David's answers verbatim. It's the spec.
2. `specs/world-editor.md` "Decisions" and "Data format".
3. `specs/terrain-law.md`, only the parts on water and the coast.
4. The `CODEMAP.md` rows "World, terrain, grid" and "World switch".

Then look at the references in `specs/references/terrain/plan-2026-10-23/` and the drawing `specs/references/terrain/terrainv1.png`.

**Code to start from:**
- `web/lib/game/world/convert.ts` (the wharf quay, pads, coast and grades);
- `format.ts` (writing the files);
- `terrain.ts`, `sealed.test.ts` and `walk.test.ts`;
- `web/scripts/convert-world.ts`;
- `web/lib/game/arrival/routes/new.ts`.

## Status

R1 done, waiting for David's notes (don't start R2 until the coordinator relays them). Head: see `git log -1` on `game/terrain-v3` (the R1 commit, "[build] terrain-v3 R1").

- **The generator:** `web/lib/game/world/generate.ts` (the zone plan `PLAN`, heights `H`, and `generateWorld`), run by `cd web && npx vite-node -c vitest.config.ts scripts/generate-world.ts --preview <png>` (about 9 s, deterministic). It keeps the objects (R1 moves none) and the village's house, lot and boat-arrival marks, and rewrites every zone's annotation from the plan.
- **Reused from convert.ts:** `shelf`, `softMin` (now with a power), `rockRelief` (now with depth and scale), `wharfQuay`, `padBuildings`, `limitSteepness`, and the new `contourDistance` (split out of `tierDistance`).
- **Reach:** the seal's walk, jump and glide reach moved from `sealed.test.ts` to `lib/game/world/reach.ts`, so the preview tints the reachable ground gold. `sealed.test.ts` now also closes the meadow, the mountain and the islets (every zone but the wharf, the beach and the village).
- **Renders:** `specs/evidence/terrain-v3/r1/` (00 top-down, 01 to 12 in-game views), shot by `specs/evidence/terrain-v3/shoot.mjs`.
- **Gates:** with `NEXT_PUBLIC_GAME_WORLD=new`, `lib/game/world`, `lib/game/arrival` and `groundGate.test` green (24 files, 161 tests), sealed with no leaks; tsc and eslint clean. No perf run in R1 (landform only; one run in R3).
- **Questions for David:** `specs/launch/terrain-v3-questions.md` (the mountain can't be seen from the village; the meadow's closures; the quay's height; the terraces).

## David's decisions

- 2026-10-23: the plan page answers, verbatim in the spec. The drawing is a guide to where things go, not a shape to trace. Open on Oct 31: the wharf, the west beach and the village. Close the rest naturally (broken bridges, landslides, a guard). Cut nothing; order the work instead.

## Next

1. Wait for David's R1 notes. Each note is an edit to `PLAN` and a rerun of `scripts/generate-world.ts` (it writes `cells.json` too), then the gates and the views again.
2. R2 and R3 per the spec, each with its own review. R2 starts from the answers to the questions file (the mountain's place changes the landform).

**Questions for David** go in `specs/launch/terrain-v3-questions.md`, one line each with your default. The coordinator relays them to the plan page. Carry on with your default meanwhile, unless the answer would change the landform.

## Tools and gotchas

- **node_modules:** the worktree had none; cloned from `perf-v1` (same lockfile) with `cp -c -R .claude/worktrees/perf-v1/web/node_modules web/` (APFS clone, 9 s).
- **Locks:** `LANE=game/terrain-v3 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>` for vitest, tsc, builds and perf. The dev server takes the devserver lock by hand (queue line, mkdir, owner file), on port 3171. Never use port 3000.
- **Views:** dev server `cd web && NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= NEXT_PUBLIC_GAME_WORLD=new npx next dev -p 3171`, then `PORT=3171 node specs/evidence/terrain-v3/shoot.mjs <dir> [view,...]` (headless, muted; `/lab/island?fixture=v2&at=x,z`, camera yaw 0 looks toward +z, 90 toward +x). `at=` stands you anywhere, closed zones too, so keep review spots in the open area unless the view is of a closed zone.
- **Curved world:** the bend drops far things by 0.0032 d^2 (30 u at 100 u), so nothing more than about 80 u away shows from the open area.
- **Annotations:** a land zone owns a cell only where the ground stands within 1.5 u of its own height, so a cliff's foot or a coast's last slope isn't counted as the closed zone above it (otherwise the seal test flags the foot).
- **Village is dead level** (no noise): neighbouring building pads level to their own centres, so any noise makes two pads disagree (walk.test "flat pad").
- **softMin power:** the coast's soft minimum at power 4 lowered the plateau 0.04 even 30 u from the sea; the generator uses power 12.
- **Sealed zones:** `cd web && NEXT_PUBLIC_GAME_WORLD=new npx vitest run lib/game/world/sealed.test.ts` prints the leaks.
- **After any world change:** the generator writes `cells.json` itself; after a merge, `cd web && npx vite-node -c vitest.config.ts scripts/world-cells.ts`, then `cells.test.ts`.
- **Assets:** only those already in `web/public/assets/`. Never fetch art or references.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`.
