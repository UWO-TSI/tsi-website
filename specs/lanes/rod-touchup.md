# Lane rod-touchup

Worktree `.claude/worktrees/rod-touchup`, branch `game/rod-touchup` (from `game/fishing`, never push).

## Task (coordinator, 2026-11-25)

Pipeline step 3 for the 7 raw Meshy rods David approved: Blender hand-edits from the RAW multi_image_to_3d downloads (not the remeshed game GLBs), mirrored back, fitted to the game frame as rod-meshy did (length, butt, grip, `rodFx`). Effect GLBs stay. No triangle limit for now; textures 1024 or 2048. Outputs to `web/public/assets/game/tools/` (same filenames), icons re-rendered, budget.ts exceptions updated. Evidence per rod `specs/evidence/rod-touchup/<rod>.jpg` (columns sheet, raw, touched-up; rows side, top, 3/4) and a review page from `~/Developer/claudebrain-tools/review-page/mkpage.py` (not published). No paid Meshy calls.

## Status

Done, waiting for review. One `[build]` commit on `game/rod-touchup` (head SHA in the report). Review page (not published): scratchpad `touch/review/rod-touchup.html`. Evidence: `specs/evidence/rod-touchup/<rod>.jpg` (columns sheet, raw Meshy as approved, touched-up; rows side, top, three-quarter).

| Rod | File | What changed | Tris | Texture | Packed size |
|---|---|---|---|---|---|
| Cedar | tools/rod-cedar.glb + props/rodfx-cedar-boughs.glb | leaves recoloured to the sheet (deep green at the twig, light at the tips); leaves re-cut into the swaying boughs effect | 287k + 482k | 2048 | 6.8 + 10.7 MB |
| Crystal | tools/rod-glass.glb | grip pearl white, teal swirls, gold rings; crystal repainted as two twisting ribbons with white glints; shaft lumps tamed | 165k | 2048 | 4.1 MB |
| Riptide | tools/rod-riptide.glb | mid blank and wrapping wave remodelled (navy tube + spiral wave band with foam texture, Meshy's crests); mint, reel ring, breaker recoloured | 222k | 2048 + 128x1024 | 4.8 MB |
| Tempest | tools/rod-tempest.glb | globe rounded to a sphere, storm swirl and clouds, silver frame arc; silver bands, charcoal grip, ice matched | 205k | 2048 | 5.1 MB |
| Tidewarden | tools/rod-5.glb | whites to pearl with sheen, gold, gems, coral pink, prongs aqua to blue; Meshy reel replaced by a modelled nautilus reel (shell, spool, flange, neck, crank, pearl knob) | 251k | 2048 + 256x2048 | 5.8 MB |
| Titanium | tools/rod-titanium.glb | anodised violet of 744ce9008, bluer at the fork, lilac to the tip; cyan collars; iridescence patched | 180k | 2048 | 4.1 MB |
| Training 2 | tools/rod-training-2.glb | fitted as is (mirrored back) | 331k | 2048 | 7.1 MB |
| Lighthouse | tools/rod-lighthouse.glb + props/rodfx-lighthouse.glb | colours to the approved colour views; front windows copied onto both side faces (3x3 median); far-side seat porthole pressed flush and painted brass; light anchor y 1.05 to 1.03 (LanternGlow GLASS, effect Lamp, Halo, FX_Lamp, Beam) | 249k | 2048 | 6.5 MB |

Icons re-rendered (`touch/icon.py`, rod-meshy's icon_fx.py with paths as env). budget.ts exceptions set to the new counts, texture 2048. Gates: tsc clean; vitest lib/game all pass; components RodAura.test's 3 failures are the pre-existing ones rod-meshy listed (titanium names its effect, tidewarden library checks, tempest 6 draws).

Not fixed: Lighthouse window reliefs still show at the tower's silhouette edges (flattening them crumpled the mesh, reverted). Training 2 has no top-view reference. Cedar's leaves effect is 10.7 MB (482k tris).

## David's decisions (verbatim, via coordinator 2026-11-25)

- cedar: "looks good, sligth tough up on the leaves in blender"
- glass (now Crystal rod): "the model needs slight clean up from blender, colors more matching the whites and stuff, the crystal redo texture"
- riptide: "needs slight touched up on the waves wrapping the rod in blender and color corrrection"
- tempest: "slight rouchup on the reek [reel] in blender and textxures and colors"
- tidewarden: "slight rrouchup on the whites and the texture/ color, also the reel should be more lik ea. shell in the photo, remodel that and attach it"
- titanium: "the texture/color of the rod should be redone to have the old titanium rob purple glow hue"
- training-2: "looks good"

## Lighthouse (8th rod, coordinator 2026-11-25)

Raw GLB `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/fishing/art/pipeline/meshy_rods/lighthouse-anchor/lighthouse-anchor-raw.glb` (task 01a2118a-bc70-774f-b81a-07fb773cd3b8). Refs: fishing worktree `specs/evidence/style-anchor/lighthouse-views/` and `lighthouse-compare.png` (the rod IS the lighthouse, straight up, lantern at the tip). Touch-ups: restore colour to the views (brass pale sand, red roof dull, cream too pale), clean smeared/ghost windows on the side profile, remove the extra small porthole on the far side of the reel seat. Fit to the current rod-lighthouse GLB (length, butt, grip, rodFx). Move the light (rodfx-lighthouse.glb nodes and LanternGlow.tsx anchor) into the lantern room at the TIP.

## Next

1. Coordinator review; David's marks per card. Open calls: file sizes and tris (no limit asked; a decimate pass is the next lever), Lighthouse silhouette window reliefs.

## Tools and gotchas

- Scripts: `art/pipeline/meshy_rods/touch_prep.py` (fit raw + bake texel positions), `touch_paint.py` (per-rod colour passes on the 2048 texture), `touch_build.py` (per-rod geometry edits and modelled parts, export), `touch_view.py` (renders in raw.py light). Helpers in `art/pipeline/meshy_rods/touch/` (prepall.sh: prep every rod; run.sh <rod>: paint, build, views, compose; hz.sh: 3x grip-end crops; icon.py; budget.py). They use the scratchpad `touch/` dir as work area: `touch/<rod>/{fit.blend,base.npy,pos.npy,tex.png,out.glb}`. Order to ship: run.sh, copy out.glb to web/public/assets/game/tools, icon.py, then `node scripts/pack-glbs.mjs` (Blender can't read packed GLBs).
- Meshy GLBs split vertices at UV seams: weld before any connectivity work. The raw mesh is one connected surface (leaves, ribbons fused to the blank), so cut-and-replace beats in-place repair.
- Material names must be P_<Preset>(.NNN) for the game's presets (modelMaterials.ts); extra parts carry their own materials.
- The old Titanium's purple: `744ce9008` rod-titanium.glb (anodised vertex colours blue-violet to gold, P_Polished metal 0.6 rough 0.16, iridescence 0.5 / IOR 1.8 / 180 nm) and `866c3dbce` (grey with Lilac prongs 0.61 0.47 0.85 linear).
- Lighthouse is not mirrored (its raw front matches the colour front); the other seven are. Its light anchor is the glass centre from the texture bake (y 1.03).
- The bake's gutter texels carry odd colours: take medians, not means, when copying texels by position.
- Added parts are joined per material before export (the tool category allows 5 primitives).
