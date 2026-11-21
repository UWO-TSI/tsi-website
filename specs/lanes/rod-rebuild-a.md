# Lane rod-rebuild-a

Worktree `.claude/worktrees/fishing`, branch `game/fishing` (shared with rod-rebuild groups B and C, who edit `art/pipeline/build_rods.py`; this lane never edits it).

## Status

- Rebuilt the Riptide, Tempest, Tidewarden and Titanium part by part against their approved concepts in `art/pipeline/concepts/old/<rod>/` (hero, turnaround rod only, effects layer). Builders in `art/pipeline/build_rods_a.py`; it execs build_rods.py's helpers (everything above its `# ==== build` marker, plus its render helpers) without running that file's build.
- Outputs (packed with `web/scripts/pack-glbs.mjs`):

  | Rod | Rod GLB | Tris | Mats | Effect GLB | FX tris, meshes |
  |---|---|---|---|---|---|
  | Riptide | tools/rod-riptide.glb | 1498 | 5 | props/rodfx-riptide.glb | 1096, 5 (Water ribbon and wave face, Water whirlpool, Foam crests, Spray drops, Light crescent trail) |
  | Tempest | tools/rod-tempest.glb | 1496 | 5 | props/rodfx-tempest.glb | 864, 5 (Glow bolts flicker, Glow storm eye and ice shards pulse, Glow tip spark, Light gusts spin with trail, Aura) |
  | Tidewarden | tools/rod-5.glb | 1472 | 5 | props/rodfx-tidewarden.glb | 502, 3 (Glow veins, Light wisps round the head, Light drift along the shaft) |
  | Titanium | tools/rod-titanium.glb | 1372 | 1 (P_Polished, film) | props/rodfx-titanium.glb (new) | 586, 3 (Glow bands and slits, Glow coil spinning, Glow sparks flicker) |

- Evidence: `specs/evidence/rod-rebuild-a/<rod>-compare.webp` (top: concept hero beside the model at compare_sheet.py's angle with the effect lit; bottom: the turnaround's side row beside the model side on).
- Awaiting review. Not seen by David yet.

## David's decisions

- 2026-11-20 (via coordinator): "riptide effects are crucial"; "tidewarden = original model plus the pearls, filigree and small details"; "titanium = match the concept including details". Triangle budget about 900 to 1500 per rod.

## Next

1. Coordinator review of the four compares; fix marks in `build_rods_a.py` and rerun (commands below).
2. When groups B and C are done with build_rods.py: delete its riptide, tempest, tidewarden (rod-5) and titanium builders and their BUILD/ROD_FILES entries (a full `build_rods.py` run would overwrite this lane's four GLBs with the old models). Keep `tidewarden(woke=True)`, `tempest_a1`, `titanium_a1` and the TI_* helpers they use: the awakened models still load from rods.ts.
3. Rod icons (lab/icons) and the awakened models (`rod-*-a1.glb`) were not redone; the a1 models no longer match their base rods.

## Tools and gotchas

- Build: `LANE=rod-rebuild-a /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/pipeline/build_rods_a.py -- only riptide` (omit `only` for all four), then `cd web && node scripts/pack-glbs.mjs <the glbs>`.
- Review: `art/pipeline/compare_a.py -- <rod.glb> <fx.glb|-> <hero.png> <turnaround.png> <out.png> [fxonly]`. compare_sheet.py draws the Water, Foam and Spray parts with their data colours (dark), so compare_a.py stands in rough game colours for them.
- Each builder measures off the turnaround's top row: `sheet_space(x_hand, y_axis, px)` maps a pixel (x right, y down) to the rod (Z along, -Y down toward the reel). Measure extents with a PIL column scan of the turnaround, not by eye off a zoomed crop.
- A Water part's ring order is its flow direction; `water(..., cut=...)` splits strips in one object. Effect spin only works about a part's own up (RodAura sets rotation.y), so the reel whirlpool is a flowing Water spiral, not a spinning part.
- kit.Piece flips each face away from its `ref` point: keep refs inside the solid (`revolve` uses the solid's middle so flat drum faces face out).
