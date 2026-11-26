# Lane rod-touchup

Worktree `.claude/worktrees/rod-touchup`, branch `game/rod-touchup` (from `game/fishing`, never push).

## Task (coordinator, 2026-11-25)

Pipeline step 3 for the 7 raw Meshy rods David approved: Blender hand-edits from the RAW multi_image_to_3d downloads (not the remeshed game GLBs), mirrored back, fitted to the game frame as rod-meshy did (length, butt, grip, `rodFx`). Effect GLBs stay. No triangle limit for now; textures 1024 or 2048. Outputs to `web/public/assets/game/tools/` (same filenames), icons re-rendered, budget.ts exceptions updated. Evidence per rod `specs/evidence/rod-touchup/<rod>.jpg` (columns sheet, raw, touched-up; rows side, top, 3/4) and a review page from `~/Developer/claudebrain-tools/review-page/mkpage.py` (not published). No paid Meshy calls.

## Status

Round 3b (2026-11-26): David approved round 3 with "looks better make the model bigger in game and make the head 30% bigger". Head: `HEAD_SCALE` 1.30 about z 0.635 (tip now 1.051), game copy rebuilt (10.0k tris, 1024, 0.55 MB), icon re-rendered (`SPIN_5=180`). In game: `ROD_SCALE` in `web/lib/game/rods.ts` (rod_tidewarden 1.25), looked up by `heldScale(url)` in `web/lib/game/tools.ts` (the rod's own and awakened models) and multiplied into the hold's grip scale in Character.tsx HeldItem (the grip is the model's origin, so it stays in the hand; remote players use the same component). The shop and bag stages fit every model to the stage, so a scale does not show there; there is no rod rack in the game. In-hand still: `specs/evidence/rod-touchup/r3b-tidewarden-hand.jpg` (shot with the starter's slot carrying the Tidewarden GLB and a temporary rod_flimsy 1.25 entry, reverted). origin/main merged (`.gitignore` and `audio.ts` conflicts: both sides kept). Branch ready for the coordinator to push and merge.


Round 3 (2026-11-26): Tidewarden only, waiting for David. Page published: https://claude.ai/artifact/4cEhrPv9ER4k92JKdgF1fG (db + comments; `approvals` collection empty at publish), source `specs/evidence/rod-touchup/page-3/index.html`, image `r3-tidewarden.jpg`. The round-2 sharp tip is dropped (`tidewarden_tip()` no longer called); the round-1 Tidewarden with its whole head scaled 1.12 about z 0.635 (`HEAD_Z`, `HEAD_SCALE` in touch_build.py, eased over 0.03), tip now 0.993. Game copy 10.0k tris, 1024, 0.52 MB. Icon re-rendered with `SPIN_5=180` (icon.py turns the rod about its axis: the shell faces the camera). In-hand shot: rod-gear's `hand.mjs` with the route widened to `rod-{1,flimsy}.glb` (the starter now loads rod-flimsy.glb); its `time=` and zoom are ignored by the current lab island (night light, fixed distance), so crop around the character.
Approved by David on page 2: Riptide round 2 and all 8 game copies.


Round 2 done, waiting for review (`[build]` commit on `game/rod-touchup`, head SHA in the report). Review page (not published): `specs/evidence/rod-touchup/page-2/index.html`. Evidence: `specs/evidence/rod-touchup/r2-<rod>.jpg` (sheet | round 1 | round 2) for Riptide and Tidewarden, `low-<rod>.jpg` (high | game copy) for all 8. Round 1 page and compares: `specs/evidence/rod-touchup/<rod>.jpg`; round-1 high GLBs are in commit 86eb8104c.

The game now loads the cut-down copies (touch_low.py: the touched-up high model decimated, one 1024 texture baked from it, P_Metal parts kept as flat metal):

| Rod | High tris / packed MB | Game tris / packed MB |
|---|---|---|
| Cedar rod + leaves effect | 287k + 482k / 6.8 + 10.7 | 7.0k + 10.0k / 0.65 + 0.83 |
| Crystal | 165k / 4.1 | 8.0k / 0.48 |
| Riptide | 235k / 5.0 | 10.0k / 0.68 |
| Tempest | 205k / 5.1 | 8.0k / 0.54 |
| Tidewarden | 245k / 5.6 | 10.0k / 0.53 |
| Titanium | 180k / 4.1 | 8.0k / 0.49 |
| Training 2 | 331k / 7.1 | 8.0k / 0.53 |
| Lighthouse | 249k / 6.5 | 9.0k / 0.64 |

Round 2 changes: Riptide's wrap modelled (wider spiral band with foam edge; three breaking crests rising off it along its spiral, the sheet's wave profile with a curling lip over a hollow front, 30 foam lumps each). Tidewarden's prongs replaced by two longer, thinner hard-edged crystal spikes (diamond section, needle points, splayed a little) with a crown of five gold thorns at each root; tip now at 0.971 (was 0.955), butt and grip unchanged. Icons for Riptide and Tidewarden re-rendered from the round-2 highs. budget.ts at the game copies' counts, texture 1024.

Round 1 (approved by David for cedar, glass, lighthouse, tempest, titanium, training-2): see the table in git history of this file and `specs/evidence/rod-touchup/<rod>.jpg`.

## David's decisions (verbatim, via coordinator 2026-11-25)

Round 1 marks: approved cedar, glass (Crystal), lighthouse, tempest, titanium, training-2.
- riptide (redo): "the waves wrapping the r od needs to be redone"
- tidewarden (redo): "make the tip sharker [sharper] and more aggressive"
Then (coordinator): a cut-down pass on all 8 for the game, about 6,000 to 10,000 tris, 1024 textures baked from the 2048 highs, about 0.5 MB packed.

Round 1 notes:

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

1. Coordinator review of page-2. The high (2048) versions are not in the game; if close-ups need them (design bible: high-def for the shop and previews), wire them through the existing view switch in a later lane. Round-2 highs are rebuilt by the scripts (prepall.sh, then run.sh <rod>).

## Tools and gotchas

- Scripts: `art/pipeline/meshy_rods/touch_prep.py` (fit raw + bake texel positions), `touch_paint.py` (per-rod colour passes on the 2048 texture), `touch_build.py` (per-rod geometry edits and modelled parts, export), `touch_view.py` (renders in raw.py light). Helpers in `art/pipeline/meshy_rods/touch/` (prepall.sh: prep every rod; run.sh <rod>: paint, build, views, compose; hz.sh: 3x grip-end crops; icon.py; budget.py). They use the scratchpad `touch/` dir as work area: `touch/<rod>/{fit.blend,base.npy,pos.npy,tex.png,out.glb}`. Order to ship: run.sh <rod> (high out.glb), icon.py on the highs (ASSETS pointing at a folder holding them), lowall.sh <rod>:<tris> (low.glb, renders, compose), copy low.glb into web/public/assets/game/tools, then `node scripts/pack-glbs.mjs` (Blender can't read packed GLBs).
- Meshy GLBs split vertices at UV seams: weld before any connectivity work. The raw mesh is one connected surface (leaves, ribbons fused to the blank), so cut-and-replace beats in-place repair.
- Material names must be P_<Preset>(.NNN) for the game's presets (modelMaterials.ts); extra parts carry their own materials.
- The old Titanium's purple: `744ce9008` rod-titanium.glb (anodised vertex colours blue-violet to gold, P_Polished metal 0.6 rough 0.16, iridescence 0.5 / IOR 1.8 / 180 nm) and `866c3dbce` (grey with Lilac prongs 0.61 0.47 0.85 linear).
- Lighthouse is not mirrored (its raw front matches the colour front); the other seven are. Its light anchor is the glass centre from the texture bake (y 1.03).
- The bake's gutter texels carry odd colours: take medians, not means, when copying texels by position.
- Added parts are joined per material before export (the tool category allows 5 primitives).
- Blender 5's glTF exporter takes `export_image_quality` for JPEG (export_jpeg_quality alone did nothing); the game copies use 70.
- Bake materials take the plain preset name only if the high materials are renamed first (RodAura.test wants `P_Polished` exactly).
