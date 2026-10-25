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

**R1b was reviewed 2026-10-25: "terrain approved", with notes** (below, verbatim). Head: 616e39e9. The ponytail review passed it as merge-safe with three fixes before the merge (Next, step 1). R1c (the notes) and R2 then run straight on, with one review for both.

What R1b built:

- **Heights:** deck ground 1, stone quay 2 (a 1 u step 13.4 to 14.6 u in from the shore), a gentle climb to the village's 3 from 24 to 36 u in. The main island's base ground is now the village's 3, so no seam dips between zones.
- **The wharf:** the shore moved out to x 74, the jetty to (74.5, 46), the wharf runs z 8 to 92. The stone path goes along the deck, up the step left (south) of the jetty at z 55 to 57, then on to the plaza. A short ramp joins the jetty (its deck still at 0) to the deck ground: raising the jetty is R2.
- **The village:** dead level at 3, much bigger (blob round (6, 52)). The plaza is at (4, 50), radius 12. HQ is west at the back, the café north (right), the shop south (left) and the museum further out south-west. Benches, study tables and lamps sit round the plaza and up the path. The spawn is on the deck by the jetty. The house and lot marks moved into the gaps (`MARKS`).
- **The map:** shorter and compact. The mountain is R1's, moved in to (-10, -42) and scaled 0.62 (`MT`, `inMt`), so its cliffs rise behind the café. The forest is the NE corner past z -4, 7 to 11 high, in two tiers. The north island is smaller and further west, at (-162, 10), with no bridgehead spits. The river runs from the mountain's west foot down the village's west side. The lighthouse islet is at (126, 104).
- **The meadow:** at the village's level (3.4 to 5, rolling). It is closed by the invisible border `BORDER`, which runs from the river to the sea north of the wharf. It is built from barrier segments, model `"border"`: `lib/game/barriers.ts`, `url: null`, feature `meadow` (null in `drops.ts`). `components/game/BorderNotice.tsx` toasts "This area is releasing soon." when you walk up to it.
- **The beach:** smooth and slightly smaller, with no grass patch and dry sand at its back for palms.
- **Objects:** `layoutObjects` in generate.ts places them (`LAYOUT`) and rebuilds the border segments. `scripts/generate-world.ts` runs it, plus `moveMarks`.
- **Renders:** `specs/evidence/terrain-v3/r1b/` (00 top-down, 01 to 11 views, 12 the border toast), from the R1b spots in `shoot.mjs`.
- **Gates:** with `NEXT_PUBLIC_GAME_WORLD=new` and without it, `lib/game/world`, `lib/game/arrival`, barriers, drops, proposals and groundGate are green (27 files, 182 tests): sealed with no leaks, routes green. tsc and eslint are clean. No perf run (that is one run in R3).
- **Grid kept** at 384 x 552 (the island is just smaller inside it).
- **Tests changed:**
  - `walk.test` no longer applies the v1 barrier proposal (it's drawn for the v2 world; `barriers.test` still checks it there), and it skips the border's segments in the dry-land check (their ends run into the water).
  - `generate.test` is updated to the R1b heights and the dock.
- **Questions for David:** `specs/launch/terrain-v3-questions.md` "R1b".

## David's decisions

### 2026-10-25: R1b review, verbatim (https://claude.ai/artifact/GEg5mHuG6ACN95UdZiLJou)

David's message: "terrain approved read feedback".

- **map (redo):** "make the cut smaller so less of the island is cut, thye islets should be 1 bigger with a bunch of small close togetherpl". Asked which cut, he said: "you made a horizontal cut  to make the map shorter, i want you to make it very slightly longer".
- **arrival (redo):** "place but make the flooring like plankes around the water,male the village closer so its in vlew, the wharf a like tooo big now maybe in thems of height like 2/3 or half of what so theres enough to have buildings on the side but not so big the villlage is out of view"
- **wharf-long (redo):** "slightly slightly shorter"
- **path:** "again the path should be way shorter so that the village is next to the wharf"
- **plaza, hq:** no note.
- **beach:** "look good, a little long i was thinking of tapering it off naturally when it transitions to wharf"
- **mountain:** "looks good, eventually need to edit it but it looks good so far"
- **meadow (approve):** "good for now"
- **toast (approve):** no note.
- **forest (redo):** "more gradual"
- **river (approve):** "its fine for now"
- **north (approve):** "good for now"

**The coordinator's reading:**
1. **Map length (z, north to south):** R1b took a horizontal band out to shorten the map. Put a little of it back: very slightly longer, about 10 u, not back to R1's length. The mountain's cliffs must still show behind the café from the plaza.
2. **Islets:** replace the scattered islets with one bigger islet and a cluster of small ones close beside it. The lighthouse islet stays.
3. **The wharf's depth (x, from the water inland):** about half to two thirds of R1b's. Keep enough room for wharf buildings along its sides, but the village must be in view from the jetty (view 01). Keep the heights: deck 1, quay 2, village 3.
4. **The path:** way shorter. The village sits right next to the wharf; it follows from 3. The plaza layout (HQ back, café right, shop left, museum further out) moves with the village and keeps its shape.
5. **The wharf's length along the water (z):** slightly shorter.
6. **The beach:** keep its shape, a little shorter, tapering off naturally where it meets the wharf.
7. **The forest:** a more gradual transition from the wharf and village up to its cliffs.
8. **Approved as is:** the meadow and its border, the toast's wording, the river, the north island, the mountain (redesign later).
9. **The R1b questions:** every default stands. R2 raises the jetty to 1 with ladders; the deck area gets wooden planks ("make the flooring like plankes around the water") and the fish market; the mountain stays as the base for its redesign; the wording stays.

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

1. **Ponytail fixes, then tell the coordinator** (the review of 616e39e9):
   - delete `stairs` in `generate.ts` (about lines 82 to 87) and its test in `generate.test.ts`; only its test uses it now;
   - `walk.test.ts` (about 110 to 112): the barrier check passes on the 19 border segments alone and the dry-land loop then skips all of them, so it checks nothing on the new world. Assert the border count, or drop the two lines and the `barrierPlacements` import;
   - `BorderNotice.tsx:23`: use `toast(...)` from `./ToastHub` (DefaultIslandWorld already does) instead of the hand-made `CustomEvent` and `setTimeout(0)`;
   - while in there, the cheap ones: move `BORDER_NOTE` into `BorderNotice.tsx`; drop the `!p` guard; hoist `sideOf(BORDER)` like `westOfRiver`; store `member` as a `Uint8Array` of `m >= 0.5` (it is about 92 MB of Float32Arrays now); drop the unused `plan` parameter of the generator; stop exporting `fbm`; compute `yaw` once per border segment; chain `.composite(...).png(...).toFile(out)` in `generate-world.ts`; drop the `s = scale` alias and redundant `: number` in `convert.ts`'s defaulted parameters; the double blank line at about 311.
   - Gates under the heavy lock, with and without the switch, then commit and SendMessage "main" with the commit and the gate results. Don't wait for the reply: the coordinator merges that commit and you go straight on.
2. **R1c, the R1b notes** (the reading above, 1 to 7). Regenerate, rerun the seal, the routes and walk tests, and render the top-down map and views 01 to 03 for yourself. Don't stop for a review.
3. **R2 on the R1c ground:**
   - wooden plank flooring over the deck area, and the fish market on it (stalls, carts, barrels, nets);
   - the jetty, the finger pier and the boat's step raised to 1, with ladders down to the water;
   - the path's stairs, fences and lamps;
   - houses filling the gaps round the plaza, so it reads as one town (existing house models as scenery shells, doors closed);
   - the campfire, chairs and palms on the beach's dry sand;
   - the broken bridges and rockfall that close the zones naturally;
   - the lighthouse on its islet;
   - the spawn and the arrival route checked on the new ground (routes test green).

   Assets only from `web/public/assets/` (the spec's R2 and R3 list). Instance repeated props.
4. **One review for R1c and R2:** render under `specs/evidence/terrain-v3/r2/` (the top-down map, the R1b views again, plus close views of the market, the jetty's ladders, the plaza's houses and the campfire), then SendMessage "main" with the images and a one-line fact for each, and stop.
5. **R3**, per the spec, after David's R2 notes.

**Questions for David** go in `specs/launch/terrain-v3-questions.md`, one line each with your default. Carry on with your default meanwhile, unless the answer would change the landform.

## Tools and gotchas

- **node_modules:** the worktree had none; cloned from `perf-v1` (same lockfile) with `cp -c -R .claude/worktrees/perf-v1/web/node_modules web/` (APFS clone, 9 s).
- **Locks:** `LANE=game/terrain-v3 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>` for vitest, tsc, builds and perf. The dev server takes the devserver lock by hand (queue line, mkdir, owner file), on port 3171. Never use port 3000.
- **R1b dark band:** a zone seam with no zone on top falls to the plan's base ground. The main island's ground is the village's 3, so seams stay level.
- **Object key order:** objects the generator writes must list their keys in the order `format.ts` reads them back (id, kind, x, z, yaw, scale, model), and leave out a zero yaw. Otherwise `world.test` ("same bytes") fails.
- **Border toast check:** with `at=0,24`, camera yaw pi, hold W; the toast shows at about z 15.
- **Views:** dev server `cd web && NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= NEXT_PUBLIC_GAME_WORLD=new npx next dev -p 3171`, then `PORT=3171 node specs/evidence/terrain-v3/shoot.mjs <dir> [view,...]` (headless, muted; `/lab/island?fixture=v2&at=x,z`, camera yaw 0 looks toward +z, 90 toward +x). `at=` stands you anywhere, closed zones too, so keep review spots in the open area unless the view is of a closed zone.
- **Curved world:** the bend drops far things by 0.0032 d^2 (30 u at 100 u), so nothing more than about 80 u away shows from the open area.
- **Annotations:** a land zone owns a cell only where the ground stands within 1.5 u of its own height, so a cliff's foot or a coast's last slope isn't counted as the closed zone above it (otherwise the seal test flags the foot).
- **Village is dead level** (no noise): neighbouring building pads level to their own centres, so any noise makes two pads disagree (walk.test "flat pad").
- **softMin power:** the coast's soft minimum at power 4 lowered the plateau 0.04 even 30 u from the sea; the generator uses power 12.
- **Sealed zones:** `cd web && NEXT_PUBLIC_GAME_WORLD=new npx vitest run lib/game/world/sealed.test.ts` prints the leaks.
- **After any world change:** the generator writes `cells.json` itself; after a merge, `cd web && npx vite-node -c vitest.config.ts scripts/world-cells.ts`, then `cells.test.ts`.
- **Assets:** only those already in `web/public/assets/`. Never fetch art or references.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`.
