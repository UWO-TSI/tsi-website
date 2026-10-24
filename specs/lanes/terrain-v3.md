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

R1 (e8675d5e) was reviewed by David on 2026-10-24: every item redo or noted, none approved, so nothing is merged to main. Main has moved (HQ round 4 and the upper-floor fix, 71135930 and later); merge it first. R1 as built:

- **The generator:** `web/lib/game/world/generate.ts` (the zone plan `PLAN`, heights `H`, and `generateWorld`), run by `cd web && npx vite-node -c vitest.config.ts scripts/generate-world.ts --preview <png>` (about 9 s, deterministic). It keeps the objects (R1 moves none) and the village's house, lot and boat-arrival marks, and rewrites every zone's annotation from the plan.
- **Reused from convert.ts:** `shelf`, `softMin` (now with a power), `rockRelief` (now with depth and scale), `wharfQuay`, `padBuildings`, `limitSteepness`, and the new `contourDistance` (split out of `tierDistance`).
- **Reach:** the seal's walk, jump and glide reach moved from `sealed.test.ts` to `lib/game/world/reach.ts`, so the preview tints the reachable ground gold. `sealed.test.ts` now also closes the meadow, the mountain and the islets (every zone but the wharf, the beach and the village).
- **Renders:** `specs/evidence/terrain-v3/r1/` (00 top-down, 01 to 12 in-game views), shot by `specs/evidence/terrain-v3/shoot.mjs`.
- **Gates:** with `NEXT_PUBLIC_GAME_WORLD=new`, `lib/game/world`, `lib/game/arrival` and `groundGate.test` green (24 files, 161 tests), sealed with no leaks; tsc and eslint clean. No perf run in R1 (landform only; one run in R3).
- **Questions for David:** `specs/launch/terrain-v3-questions.md` (the mountain can't be seen from the village; the meadow's closures; the quay's height; the terraces).

## David's decisions

### 2026-10-24: R1 review, verbatim (https://claude.ai/artifact/U9bsDg9XdmeZo3iuwUZiHv)

- **map (redo):** "village should be 2,3 wharf is 1, and wharf needs to be bigger, the step should go up later so push the stairs to the left more and expand the wharf so more wharf buildings, also the deck board area needs to be way bigger. i want you make the meadow area the same level and not sudden raise so it looks natural, but just put invisible boarders for now that says release soon"
- **wharf (redo):** "quay needs to be a 2 with larger deck board to fit the fishing market, and larger deck"
- **path (redo):** "the elevation to island is too high keep village 2,3"
- **plaza (redo):** "I wan you to make plaza bigger, and have the buildings set around the plaza naturally, buildings can be side by side"
- **hq (redo):** no note.
- **beach (redo):** "remove that patch of grass, and have the beach shape redone and slightly smaller and smoothed out, there shuold pla places where palm tree can grow"
- **mountain from the village:** "I want you to make the map shorter and have the mountain and allat moved closer, "
- **mountain from the meadow:** "mountain will be redone in next version focus on main island and vilage for now"
- **forest (redo):** "cliffs further out, rightnow it doesnt look natural the transirtion"
- **north (redo):** "remove that straight thing" (the long narrow spit reaching toward the island in view 08)
- **river:** "fine for now"
- **slide (redo):** "I want you to make the village area bigger and enlarge and shrink the other parts, like make meadow and forest and hills shorter, make north island smaller and bring mountains closer"

**The coordinator's reading** (heights are in u above the sea, as the review page gave them):
1. **Heights:**
   - the wharf's deck boards at 1;
   - the stone quay at 2;
   - the village at 2 to 3.
   The climb from the quay is gentle and starts further inland. The stairs move to the LEFT as seen arriving from the jetty (view 01).
2. **The wharf, much bigger:**
   - a far larger deck-board area, room for the fish market's stalls and more wharf buildings;
   - a larger quay.
3. **The village and plaza, bigger:**
   - the buildings sit around the plaza naturally and can stand side by side: HQ at the back centre, the café right, the shop left, the museum further out, per the plan;
   - move the existing landmarks in this round.
4. **A shorter, more compact map:**
   - the mountain and the rest come closer to the village; it should show from the village (the bend hides anything past about 80 u);
   - the village area grows;
   - the meadow, forest and hills get lower and smaller;
   - the north island gets smaller, and the straight spit toward it goes.
   Keep the grid size unless shrinking it is clearly simpler; say which in the report.
5. **The meadow:**
   - at the village's level, a natural continuation with no sudden rise;
   - closed for now by an invisible border that tells the player it's releasing soon. This overrides the spec's "no invisible walls" for the meadow.
   - Reuse any existing barrier, toast or opening-soon message; the seal test must count the border.
6. **The forest:** its cliffs further out, with a natural transition, not the abrupt wall by the jetty.
7. **The beach:**
   - no grass patch;
   - reshaped, slightly smaller and smoothed;
   - spots where palm trees can grow.
8. **The mountain:** only moved closer now. Its redesign is a later version, so focus on the main island and the village.
9. **The river:** fine for now.

### 2026-10-23

The plan page answers, verbatim in the spec. The drawing is a guide to where things go, not a shape to trace. Open on Oct 31: the wharf, the west beach and the village. Close the rest naturally (broken bridges, landslides, a guard). Cut nothing; order the work instead.

## Next

1. **Merge main** into the branch, then regenerate `cells.json` if the merge touched the world.
2. **R1b, the landform redo and the village layout.**
   - Apply every point of the 2026-10-24 reading above: edit `PLAN` and rerun the generator.
   - Place the existing buildings around the bigger plaza, and the spawn, lamps, benches and study tables to suit. The arrival route and `routes.test` must stay green.
   - Shoot the views again from the same spots where they still make sense: the top-down, arrival, path, plaza, HQ, beach, the mountain from the village, the forest edge, the north island, and the meadow border.
   - Commit the renders under `specs/evidence/terrain-v3/r1b/`.
   - Message "main" with an image list and one line per image, then stop for David's notes.
3. **R2**, on approval:
   - the path's stairs, fences and lamps;
   - the wharf's market stalls, carts, barrels, nets, ladders and lighthouse;
   - the campfire on the beach;
   - the broken bridges, rockfall and borders.
4. **R3**, per the spec.

**Questions for David** go in `specs/launch/terrain-v3-questions.md`, one line each with your default. Carry on with your default meanwhile, unless the answer would change the landform.

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
