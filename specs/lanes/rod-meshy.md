# Lane rod-meshy

Worktree `.claude/worktrees/fishing`, branch `game/fishing` (never push).

## Task (coordinator, 2026-11-21)

David rejected 8 rebuilt rod models. Rebuild them with Meshy (multi_image_to_3d, ai_model meshy-7.1, texture_model meshy-7, 2K texture, 30 credits each; meshy_remesh 5 each for every rod except Tidewarden). Hard budget 300 credits. No retries without asking. Never re-create a task after a timeout: check meshy_list_tasks first.

## Status

Done, waiting for review. Commit `[build] Rods rebuilt with Meshy` on `game/fishing` (head SHA in the report).

Credits: 1070 before, 795 after: 275 spent (8 x 30 generation, 7 x 5 remesh). No failed or repeated tasks.

| Rod | File | Meshy generate | Meshy remesh | Tris | Texture |
|---|---|---|---|---|---|
| Cedar | tools/rod-cedar.glb + props/rodfx-cedar-boughs.glb (leaves) | 01a1ff81-5c4e-725f-9826-0160926a89f5 | 01a1ff83-2d76-7183-acdb-a3b768d6765a | 1125 rod + 1331 leaves | 1024 JPEG (both files) |
| Crystal (rod_glass) | tools/rod-glass.glb | 01a1ff82-dbc8-77e1-809d-42d94d52a2b8 | 01a1ff85-618b-759c-8636-0596bc8f81d8 | 2493 | 1024 |
| Lighthouse | tools/rod-lighthouse.glb | 01a1ff82-e541-71c8-ba64-12be30e3755a | 01a1ff85-6549-745f-b8c2-17920b69cba8 | 2028 | 1024 |
| Riptide | tools/rod-riptide.glb | 01a1ff82-f007-7167-9b65-3da195d2d323 | 01a1ff85-6942-7177-b17a-038d695c2c12 | 2417 | 1024 |
| Tempest | tools/rod-tempest.glb | 01a1ff82-fa4e-76e4-bfeb-62e81bfcd917 | 01a1ff85-6d56-765c-a82e-aad6ff5a689d | 2475 | 1024 |
| Tidewarden | tools/rod-5.glb | 01a1ff83-0505-74f7-9f50-f1e2460d65a6 | none (David) | 24000 (Blender decimate of 769k) | 1024 (Meshy's own UVs) |
| Titanium | tools/rod-titanium.glb | 01a1ff83-11ef-7718-8a1a-ff046a70de77 | 01a1ff85-713e-71c3-8fbe-19d9a4e49feb | 2420 | 1024, P_Polished + the OG thin film |
| Training stage 2 | tools/rod-training-2.glb | 01a1ff83-1c7b-738d-907b-87e57295ff19 | 01a1ff85-74c4-72cd-97e6-ff78725c615e | 2480 | 1024 |

Evidence: `specs/evidence/rod-meshy/<rod>-compare.jpg` (sheet view above model view: side, top, three-quarter; Training stage 2: refs a and b above the model side and three-quarter).

What changed besides the GLBs:
- Glass renamed "Crystal rod" (rods.ts, catalogue.ts, lab gui page, tests); key `rod_glass` and slug `rod-glass` kept. Economy seed: folded into `20261126203439_catalogue_seed.sql` (rod-touchup, 2026-11-26; the branch seeds 20261120031507 and 20261121192921 were dropped and regenerated on top of main).
- Lighthouse light moved to the lantern on the body: LanternGlow `GLASS` (0, 1.05, 0); rodfx-lighthouse's Lamp, Halo, FX_Lamp and Beam at y 1.05, the Beam turned to shine out sideways (+X) at 0.6 size instead of along the rod past the tip.
- Cedar: the old swaying Boughs replaced by the Meshy model's own leaves (faces whose texel is green), cut into rodfx-cedar-boughs.glb with `sway: 1`.
- Riptide: rodfx-riptide's Current, Crests and Whirl dropped (the Meshy body has the ribbon, wave and whirlpool; the old animated water spiralled across it). Drops, Swoosh and sparks kept.
- Other effects unchanged: glass, tempest, tidewarden, titanium (Bands glow rings sit near but not exactly on the new collars; one floats under the reel), training-2 (Cracks roughly on the bandage and reel).
- budget.ts ASSET_EXCEPTIONS: the 7 rods at 2500 tris / texture 1024, rod-5 at 24000 / 1024, rodfx-cedar-boughs texture 1024.
- RodAura.test's loader stubs textures as heldMesh.test does (node can't decode images; every textured rod failed with "self is not defined").
- Icons re-rendered (scratchpad icon.py; Cedar with its leaves effect): rod_cedar, rod_glass, rod_lighthouse, rod_riptide, rod_tempest, rod_tidewarden, rod_titanium, rod_training_a1.

## David's decisions (via coordinator, verbatim intent)

- cedar: leaves point the wrong direction; handle doesn't match the picture.
- glass: shape nowhere close; must be thin and longer, proper handle shape, tip like reference. Rename to "Crystal rod".
- lighthouse: rod too thick and short, make longer and thinner; light comes from the lighthouse body not the very tip; spool redone accurately.
- riptide, tempest: redo, closer to sheet.
- tidewarden: "not similar at all, don't worry about triangles, model as closely as possible".
- titanium: inspiration from the OG titanium's textured metal colour; match sheet.
- training stage 2: redo from training2-a.png and training2-b.png.

## Next

1. Coordinator review of the compares. Open calls for David: Riptide's animated water dropped in favour of the static Meshy ribbon; Lighthouse beam direction; Tidewarden at 24k tris; 1024 textures (each rod GLB is now 0.4 to 0.9 MB).
2. Any redo costs Meshy credits: ask first.

## Tools and gotchas

- Scripts: `art/pipeline/meshy_rods/` (headless Blender, `-b --factory-startup -P`):
  - `crop.py` + `deline.py`: crop each turnaround row to a square white PNG, remove the fishing line. Views are then turned tip-up (`magick -rotate -90`) so side and top views are turntable views.
  - `bake.py <hi.glb> <lo.glb> <out.glb> 1024`: Meshy's remesh bakes a blurry texture (its UV atlas wastes most of the square); this re-UVs the remesh (smart project) and bakes the hi model's colour onto it in Cycles.
  - `fit.py <in.glb> <old.glb> <out.glb> '<json>'`: into the old GLB's frame: rod along glTF +Y, butt at the old min Y, scaled to the old length (`length` overrides: glass 1.12, lighthouse 1.2), reel toward +Z, `mirror` (Meshy builds these mirror-imaged), `reel_deg` (cedar 30), `decimate`, `tex`, `preset` (material name P_Wood / P_Paint / P_Polished), `split_green` (cedar leaves). Keeps scene extras `rodFx`, `fxRoom`. Exports JPEG textures (pack-glbs keeps them).
  - `fxedit.py`: drop, move, turn, scale nodes of an effect GLB, add a mesh from another GLB; keeps node and scene extras.
  - `patch_ir.py`: puts the OG Titanium's KHR_materials_iridescence on the Titanium GLB (after every fit).
  - `cmp.py`: side, top and three-quarter renders with the effect.
  - `unpack.mjs`: decodes a packed GLB for Blender and prints nodes, extras, bbox, tris, textures.
- Meshy downloads (hi and lo) are in the scratchpad `meshy/dl/` and links expire 2026-11-24; the task ids above re-download free until then.
- Render compares before `pack-glbs.mjs`: Blender can't read meshopt GLBs (use unpack.mjs).
- Don't rerun build_rods_a/b/c.py for these eight rods: they would overwrite the Meshy models.
- Pre-existing test failures, not this lane's: seedMigrations.test crafting and ownership seeds out of date on this branch (3 tests); RodAura.test: rod-titanium names rodfx-titanium though the test wants none, rodfx-tidewarden library checks, rodfx-tempest 6 draws (5 meshes + a trail) over the 5 cap. All three were hidden behind the texture error before.
