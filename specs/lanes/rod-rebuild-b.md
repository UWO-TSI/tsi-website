# Lane: rod-rebuild-b (Glass, Lighthouse, Precision, Carrot rebuilt to their concepts)

Worktree `.claude/worktrees/fishing`, branch `game/fishing`. Agent type `uwotsi-lane`. Two other rod lanes work in this worktree in parallel: touch only the files below.

## Task (coordinator, 2026-11-20)
Rebuild the Glass, Lighthouse, Precision and Carrot rod models so each is identical to its approved concept in `art/pipeline/concepts/old/<rod>/` (hero.png, turnaround.png, effects.png where present). Solid rod in `web/public/assets/game/tools/rod-<rod>.glb`, effects (glass glints, lighthouse beam) in `web/public/assets/game/props/rodfx-<rod>.glb`. Method as the Christmas rods (build_rods.py north_star, candy_cane; compare_sheet.py). Triangle budget about 900 to 1500. Iterate privately; report per rod the final compare image, triangle count, commit sha and mapping changes.

## David's decisions
- Lighthouse: "the lantern at the tip must stand straight, in line with the rod."

## Files (this lane only)
- `art/pipeline/build_rods_b.py`: the four builders. It loads build_rods.py's helpers by exec-ing its source up to the `# ... build` marker (importing it would rebuild every rod). Never edit build_rods.py.
- `art/pipeline/compare_turn_b.py`: renders a model as the turnaround sheet's rows (side from -X, bottom from -Y, three-quarter) beside the sheet.
- Outputs: `rod-glass.glb`, `rod-lighthouse.glb`, `rod-precision.glb`, `rod-carrot.glb` and `rodfx-glass.glb`, `rodfx-lighthouse.glb`.

## Mapping changes needed (for the coordinator, not done here)
- Glass: `web/lib/game/tools.ts` LAUNCH_RODS sends `rod_glass` (tier 3) to `rod-3.glb`; the new model is `rod-glass.glb`.
- Lighthouse: same, `rod_lighthouse` (tier 4) to `rod-4.glb`; new `rod-lighthouse.glb`. `LanternGlow.tsx` LANTERN_URL names rod-4; its GLASS for the new model is glTF (0, 0.888, 0).
- Budget: `web/lib/game/perf/budget.ts` caps `game/tools/` at 600 triangles; these four are 1452 to 2465 (the coordinator's 2500), so budget.test.ts needs ASSET_EXCEPTIONS entries or a raised tool category.
- Done here (coordinator's ask): build_rods.py no longer builds `carrot` and `precision` by default (only with `only`).

## Status
- Head 950654f34 (models), 30467d483 (concept refs). Round 2 (coordinator review 2026-11-20, budget 2500): rebuilt all four against the notes below, about six compare rounds. Not yet reviewed by David.
  - Glass 2388 tris: two smooth crystal strands (3.25 turns, 6 stations a half turn, pentagon sections), thicker; a 192x256 swirl-inlay grip texture; a bigger faceted gem cap; a crown and a tip cluster of 3D crystal shards, a big gold scroll; a bigger float (r 0.034) in a 6 + 6 cord net with tassel and crystal drops.
  - Lighthouse 2386 tris: tower 0.0345 across; a brass porthole reel (riveted bezel, glass window over the wound line, hinge lugs, crank with wood knob); a bigger lantern room (gallery with railing, glazing between mullions, red roof, gold ball); arched amber windows with glazing bars. Beam at rest points +Y and spins about the rod's axis.
  - Precision 1452 tris: black knurled grip, silver end cap, silver reel with a gold face ring, gauge, silver side crank and black knob; ruler marks; white ferrules. The concept itself shows thin gold rings at both ends of the grip, so those stay.
  - Carrot 2465 tris: body 0.0575 across at its fattest, crisp grooves, a glossy streak; nine two-tone fronds with cupped lobes, a dark hook curling under; cream grip bound by a green vine with leaves; a carrot-slice reel (paler core, sunburst) with a leaf crank.
  - Extra colours without extra materials: `recolor()` moves a virtual part's faces onto a lighter real material and tints their COLOR_0 (the game multiplies it in). Every rod stays at 5 materials.
- Compares: `specs/evidence/rod-rebuild-b/<rod>-compare.webp`, all from compare_turn_b.py now (top: concept hero | model hero; bottom: turnaround | side, top, three-quarter). Light parts draw as light there.

## David's review round 1 notes (via coordinator, 2026-11-20)
Glass: blank too thin and saw-toothed; grip cream with a teal swirl inlay and a faceted teal end cap; tip a cluster of shards plus a gold scroll; float bigger with its net and tassel crystal. Lighthouse: blank thicker; porthole reel with glass and crank; bigger lantern with red roof, glazed room, gold rail; arched windows; beam not grey in compares. Precision: black knurled grip, silver cap and ferrule; silver reel with side crank and knob; ruler ticks, white ferrules. Carrot: thicker at the grip end, ridged, glossy; lush curled two-tone fronds; cream grip bound with green leaves; carrot-slice reel with leaf crank.

## Next
1. Coordinator: the mapping and budget changes above, then a review page for David.
2. David's notes come back here; rebuild with `only <rod>`, recompare, pack, commit.

## Tools and gotchas
- Run: `LANE=rod-rebuild-b /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/pipeline/build_rods_b.py -- only glass`
- Compare renders read the unpacked export: render before running pack-glbs (Blender's importer may not read meshopt).
- Compares: `compare_turn_b.py -- rod.glb fx.glb art/pipeline/concepts/old/<rod> out.png <f0> <length>` with f0 = -hand * length from build_rods_b.py SHEET. A smaller length zooms the turnaround rows in.
- Blender 5's glTF importer already multiplies COLOR_0 into the base colour (through a Mix node): read a material's colour from that node, never multiply again.
- Light parts carry alpha 0.35 in Blender only so the compares show through them; RodAura ignores it.
- The concept references in `art/pipeline/concepts/old/` are committed (coordinator's ask).
