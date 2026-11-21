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

## Mapping and budget (done in round 3)
- `web/lib/game/tools.ts`: rod_glass and rod_lighthouse left LAUNCH_RODS, so they load `rod-glass.glb` and `rod-lighthouse.glb`. `rod-3.glb` and `rod-4.glb` are no longer loaded by the game (not deleted here).
- `LanternGlow.tsx`: LANTERN_URL `rod-lighthouse.glb`, GLASS glTF (0, 0.898, 0).
- `web/lib/game/perf/budget.ts` ASSET_EXCEPTIONS: every rebuilt rod GLB over the tool budget (all three rod lanes), triangles 2,500, texture 512 where a rod ships a 512 texture. budget.test passes.
- build_rods.py no longer builds `carrot` and `precision` by default (round 2).
- Open: `lib/game/character/heldMesh.test.ts` expects every tool to merge to one mesh; textured or translucent parts stay separate meshes by heldMesh's design, so it fails for every textured rod: candy-cane (already on the branch), the other lanes' rods, and here Glass (grip texture, translucent crystal) and Precision (ruler and knurl textures). Lighthouse and Carrot pass. The coordinator decides: loosen the test to one mesh per unmergeable group, or drop the textures and translucency.

## Status
- Round 3 (coordinator 2026-11-20): Precision and Carrot passed round 2 (gold rings kept). Glass and Lighthouse made bigger in the hero view:
  - Glass 2472 tris: blank about 1.8x thicker, its strands translucent (alpha 0.84, glTF BLEND) and shaded per vertex from light on the lit side to teal; grip thicker (0.046) and longer (from station 0.021, the gem behind it); float r 0.047 with a bigger net, tassel and drops; crown, tip shards, scroll and point scaled up.
  - Lighthouse 2386 tris: tower 1.6x thicker, grip end 1.5x, lantern 1.4x, reel 1.45x; red bands 0.05 long; the beam points out along the rod's line (+Z) at rest and breathes (pulse) instead of spinning. Lamp at Blender (0, 0, 0.898).
  - Carrot rebuilt only to drop a Blender-only roughness tweak that split its held mesh (same geometry and colours).
- Round 2 summary: recolor() and gradient() give extra colours on 5 materials; compares from compare_turn_b.py.

## David's review round 1 notes (via coordinator, 2026-11-20)
Glass: blank too thin and saw-toothed; grip cream with a teal swirl inlay and a faceted teal end cap; tip a cluster of shards plus a gold scroll; float bigger with its net and tassel crystal. Lighthouse: blank thicker; porthole reel with glass and crank; bigger lantern with red roof, glazed room, gold rail; arched windows; beam not grey in compares. Precision: black knurled grip, silver cap and ferrule; silver reel with side crank and knob; ruler ticks, white ferrules. Carrot: thicker at the grip end, ridged, glossy; lush curled two-tone fronds; cream grip bound with green leaves; carrot-slice reel with leaf crank.

## Next
1. Coordinator: decide the heldMesh test (above), then a review page for David.
2. David's notes come back here; rebuild with `only <rod>`, recompare, pack, commit.

## Tools and gotchas
- Run: `LANE=rod-rebuild-b /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/pipeline/build_rods_b.py -- only glass`
- Compare renders read the unpacked export: render before running pack-glbs (Blender's importer may not read meshopt).
- Compares: `compare_turn_b.py -- rod.glb fx.glb art/pipeline/concepts/old/<rod> out.png <f0> <length>` with f0 = -hand * length from build_rods_b.py SHEET. A smaller length zooms the turnaround rows in.
- Blender 5's glTF importer already multiplies COLOR_0 into the base colour (through a Mix node): read a material's colour from that node, never multiply again.
- Light parts carry alpha 0.35 in Blender only so the compares show through them; RodAura ignores it.
- The concept references in `art/pipeline/concepts/old/` are committed (coordinator's ask).
