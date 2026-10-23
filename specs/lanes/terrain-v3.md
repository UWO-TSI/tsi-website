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

Not started. Main is at ecc3c069 or later; the world switch is merged, so `NEXT_PUBLIC_GAME_WORLD=new` plays `web/data/world/`.

## David's decisions

- 2026-10-23: the plan page answers, verbatim in the spec. The drawing is a guide to where things go, not a shape to trace. Open on Oct 31: the wharf, the west beach and the village. Close the rest naturally (broken bridges, landslides, a guard). Cut nothing; order the work instead.

## Next

1. **R1, the whole landform.**
   - Write the generator as a zone plan, run it and render the review images headless: a top-down map with zone labels and about 8 in-game views.
   - Commit the renders under `specs/evidence/terrain-v3/r1/`.
   - Message the coordinator ("main") with the list of images and a one-line fact for each, plus any questions. Then stop and wait for David's notes; don't start R2 on unapproved ground.
2. R2 and R3 per the spec, each with its own review.

**Questions for David** go in `specs/launch/terrain-v3-questions.md`, one line each with your default. The coordinator relays them to the plan page. Carry on with your default meanwhile, unless the answer would change the landform.

## Tools and gotchas

- **Locks:** `LANE=game/terrain-v3 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>` for vitest, tsc, builds and perf; `devserver` for a dev server. Never use port 3000.
- **Scratch scripts:** `cd web && npx vite-node -c vitest.config.ts <script.ts>`.
- **Headless only.** Never open a window, tab, app or audio on David's screen, never the Playwright MCP, never `open`. For in-game views, use a headless Playwright script against your own dev server port.
- **Sealed zones:** `cd web && NEXT_PUBLIC_GAME_WORLD=new npx vitest run lib/game/world/sealed.test.ts` prints the leaks. On today's world the summit, the forest ruins and the cave leak.
- **After any world change:** `cd web && npx vite-node -c vitest.config.ts scripts/world-cells.ts`, then `cells.test.ts`.
- **Assets:** only those already in `web/public/assets/`. Never fetch art or references.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`.
