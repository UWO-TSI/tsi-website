# Lane rod-rebuild-a

Worktree `.claude/worktrees/fishing`, branch `game/fishing` (shared with rod-rebuild groups B and C, who edit `art/pipeline/build_rods.py`; this lane never edits it).

## Status

- Rebuilt the Riptide, Tempest, Tidewarden and Titanium part by part against their approved concepts in `art/pipeline/concepts/old/<rod>/` (hero, turnaround rod only, effects layer). Builders in `art/pipeline/build_rods_a.py`; it execs build_rods.py's helpers (everything above its `# ==== build` marker, plus its render helpers) without running that file's build.
- Round 2 (the coordinator's review, budget raised to 2500): Riptide's ribbon a thick band spiralling over and under the blank with a foam roll on its leading edge, big on the crests, an open breaking wave with foam puffs, a bigger whirlpool, claws and crystal drop, a faceted crystal pommel; Tempest's chunky chain bars, flat links and icicles, a dark wood grip, a bigger storm globe (cloud puffs, blue core, wing guard, ice shards), a bigger spear with four barbs; Tidewarden rebuilt to its concept (nautilus reel, pearl pommel in gold leaves, coral trident with two blue crystal prongs, proper gold, pearl and teal, quieter wisps); Titanium thicker hex sections, bolder cyan collar bands, chunkier fork and fin, a proper spinning reel (housing, cyan rings, spool, claw guard, crank and knob), no black dashes. build_rods.py no longer builds these four by default (its -a1 forms still).
- Round 3 (the coordinator's review): compare_a.py lit softer (its white world washed colours out), materials set from colours sampled off the concepts; blanks and grips about 1.6x thicker; Riptide's wave about 1.6x bigger and its crest foam as rolling mounds; Tempest's chain 1.5x thicker, deeper blue ice, the globe back to concept size; Tidewarden's nautilus striped in pastel spiral bands, thicker gold leaves, a bigger coral head; Titanium dark gunmetal under its film, a bigger reel with crescent claws, a bigger fork and fin.
- Outputs (packed with `web/scripts/pack-glbs.mjs`):

  | Rod | Rod GLB | Tris | Mats | Effect GLB | FX tris, meshes |
  |---|---|---|---|---|---|
  | Riptide | tools/rod-riptide.glb | 2474 | 5 | props/rodfx-riptide.glb | 1352, 5 (Water ribbon and wave face, Water whirlpool, Foam crests, Spray drops, Light crescent trail) |
  | Tempest | tools/rod-tempest.glb | 2350 | 5 | props/rodfx-tempest.glb | 864, 5 (Glow bolts flicker, Glow storm eye and shards pulse, Glow tip spark, Light gusts spin with trail, Aura) |
  | Tidewarden | tools/rod-5.glb | 2060 | 5 | props/rodfx-tidewarden.glb | 62, 2 (Light wisps past the prongs, Light drift along the line) |
  | Titanium | tools/rod-titanium.glb | 1444 | 1 (P_Polished, film) | props/rodfx-titanium.glb | 586, 3 (Glow bands and slits, Glow coil spinning, Glow sparks flicker) |

- Evidence: `specs/evidence/rod-rebuild-a/<rod>-compare.webp` (top: concept hero beside the model at compare_sheet.py's angle with the effect lit; bottom: the turnaround's side row beside the model side on).
- Awaiting the coordinator's round 3 review.

## David's decisions

- 2026-11-20 round 3 (coordinator): thinner and paler than the concepts in the hero views; fix compare exposure, sample concept colours, blanks 1.6 to 2x thicker. Don't touch budget.ts or tools.ts (lane B).
- 2026-11-20 round 2 (coordinator's review): include the nautilus reel on the Tidewarden (David wanted B's details); proper gold, pearl white and teal; effects less dominant. Budget 2500 tris per rod.
- 2026-11-20 (via coordinator): "riptide effects are crucial"; "tidewarden = original model plus the pearls, filigree and small details"; "titanium = match the concept including details". Triangle budget about 900 to 1500 per rod.

## Next

1. Coordinator review of round 3; fix marks in `build_rods_a.py` and rerun (commands below).
2. Done in round 2: build_rods.py's default list skips riptide, tempest, tidewarden and titanium. Their old builder functions are still in it (tidewarden(woke=True), tempest_a1 and titanium_a1 use them or their helpers); delete the bodies only once the awakened forms are rebuilt.
3. Rod icons (lab/icons) and the awakened models (`rod-*-a1.glb`) were not redone; the a1 models no longer match their base rods.

## Tools and gotchas

- Build: `LANE=rod-rebuild-a /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/pipeline/build_rods_a.py -- only riptide` (omit `only` for all four), then `cd web && node scripts/pack-glbs.mjs <the glbs>`.
- Review: `art/pipeline/compare_a.py -- <rod.glb> <fx.glb|-> <hero.png> <turnaround.png> <out.png> [fxonly]`. compare_sheet.py draws the Water, Foam and Spray parts with their data colours (dark), so compare_a.py stands in rough game colours for them.
- Each builder measures off the turnaround's top row: `sheet_space(x_hand, y_axis, px)` maps a pixel (x right, y down) to the rod (Z along, -Y down toward the reel). Measure extents with a PIL column scan of the turnaround, not by eye off a zoomed crop.
- A Water part's ring order is its flow direction; `water(..., cut=...)` splits strips in one object. Effect spin only works about a part's own up (RodAura sets rotation.y), so the reel whirlpool is a flowing Water spiral, not a spinning part.
- kit.Piece flips each face away from its `ref` point: keep refs inside the solid (`revolve` uses the solid's middle so flat drum faces face out).
