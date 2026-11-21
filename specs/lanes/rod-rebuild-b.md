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
- Lighthouse: same, `rod_lighthouse` (tier 4) to `rod-4.glb`; new `rod-lighthouse.glb`. `LanternGlow.tsx` LANTERN_URL and its GLASS point name rod-4 and its lamp position.
- build_rods.py `carrot()` and `precision()` still write rod-carrot.glb and rod-precision.glb: running build_rods.py without `only` overwrites these rebuilds.

## Status
- 2026-11-20 round 1 built, compared and packed (about ten compare rounds, Opus in Blender, no worker). Not yet reviewed by David.
  - Glass 1485 tris, 5 materials (Pearl carries a 128x192 wave-inlay texture); fx: Glints (Glow, flicker), Flecks and Twist (Light, spin round the axis), a teal Halo at the point, sparkle sparks.
  - Lighthouse 1492 tris, 5 materials; the lantern stands on the rod's axis at the tip. fx: Beam (three nested Light cones from the lamp, spin 1.1 about the rod's axis, a lighthouse sweep), Lamp (Glow, pulse), a warm Halo, glow sparks. The lamp's centre is Blender (0, 0, 0.884), glTF (0, 0.884, 0): LanternGlow's GLASS for this model.
  - Precision 987 tris, 5 materials (Blank carries a ruler texture, Grip a knurl texture). No fx.
  - Carrot 1488 tris, 5 materials. No fx.
- Compares: `specs/evidence/rod-rebuild-b/<rod>-compare.webp` (top: compare_sheet.py hero beside the concept hero; bottom: compare_turn_b.py side, top and three-quarter beside the turnaround).
- Known gaps against the concepts: the Glass blank's two strands read faceted (three stations a half turn in the budget), its grip wave is one long wave with two curls; the Carrot's fronds are flat lobed leaves in one green; the compares render Light parts flat and grey (in the game they are additive).

## Next
1. Coordinator: the mapping changes above, then a review page for David.
2. David's notes come back here; rebuild with `only <rod>`, recompare, pack, commit.

## Tools and gotchas
- Run: `LANE=rod-rebuild-b /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/pipeline/build_rods_b.py -- only glass`
- Compare renders read the unpacked export: render before running pack-glbs (Blender's importer may not read meshopt).
- Compares: `compare_sheet.py -- rod.glb fx.glb concepts/old/<rod>/hero.png out.png`, then `compare_turn_b.py -- rod.glb fx.glb concepts/old/<rod>/turnaround.png out.png <f0> <length>` with f0 = -hand * length from build_rods_b.py SHEET. A smaller length zooms in (close-ups of the crown, the lantern).
- Light parts carry alpha 0.35 in Blender only so the compares show through them; RodAura ignores it.
- The concept references in `art/pipeline/concepts/old/` are untracked in this worktree (not committed by this lane).
