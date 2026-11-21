# Lane: rod-rebuild-c

Worktree `.claude/worktrees/fishing`, branch `game/fishing` (shared with lanes rod-rebuild-a and rod-rebuild-b: commit only this lane's files).

Task (coordinator, 2026-11-20): rebuild the Cedar, Flimsy and Training (stage 1) rod models identical to their approved concepts, and build Training stage 2 from `art/pipeline/concepts/old/training1/training2-a.png` (a picked over b: a is the easier read, its glow and cracks sit in one bandage and one reel seam). Write `rod-<rod>.glb`; report mapping changes rather than rewiring game code.

## Status

- Builder: `art/pipeline/build_rods_c.py` (loads build_rods.py's helpers by exec of its source up to its build section, never runs its builds; build_rods.py untouched). Compare: `art/pipeline/compare_c.py` (compare_sheet.py's hero camera, plus the turnaround's side, top and three-quarter rows and a close-up, COLOR_0 multiplied in, Glow drawn unlit).
- Outputs: `web/public/assets/game/tools/rod-cedar.glb` + `props/rodfx-cedar-boughs.glb` (the boughs, swaying), `tools/rod-flimsy.glb`, `tools/rod-training.glb` (replaced in place), `tools/rod-training-2.glb` + `props/rodfx-training-2.glb` (amber cracks and reel seam, two Halo sprites, amber sparks).
- Triangles (rod + effect): Cedar 868 + 729 boughs, Flimsy 930, Training 1002, Training stage 2 1544 + 176 glow. Materials 3 to 4 each. All six GLBs packed (pack-glbs.mjs).
- Final compares (uncommitted, review only): `specs/evidence/rod-rebuild-c/<rod>-{hero,turn,close}.jpg`. Each is the model on the left, the sheet on the right; Training stage 2's turn row uses the stage-1 turnaround for shape (training2 has no turnaround).
- Judged against the sheets: shapes, stations and colours match the turnaround side views (measured column by column). The heroes are drawn chunkier than the turnarounds (bigger grip and reel); the models follow the turnaround.
- Done, awaiting the coordinator's review. Commit: `[build] Rods c: Cedar, Flimsy, Training and Training stage 2 rebuilt against their sheets`.

## Mapping changes needed (not made here)

- `web/lib/game/tools.ts`: `rod_flimsy` and `rod_cedar` are in `LAUNCH_RODS`, so they load `rod-1.glb` and `rod-2.glb`. Point them at `rod-flimsy.glb` and `rod-cedar.glb` (drop them from LAUNCH_RODS, which then names `rod-flimsy`/`rod-cedar` by key). rod-1.glb, rod-2.glb and rodfx-cedar.glb then go unused.
- `web/lib/game/rods.ts`: the Training's first awakening (`at: 50`) needs `model: "/assets/game/tools/rod-training-2.glb"`.
- `rod-training.glb` keeps its path; no change.

## How these rods are made

- Every face's colour is its vertex colour (COLOR_0). Materials are presets by name (P_Wood, P_Metal, P_Paint, P_Cloth, P_Leather) sharing one painted atlas per rod; plain faces read its white corner, painted parts (carved grip, reel faces, stitching, tag, wraps, bandage) read their patch by projection (`cyl_uv`, `disc_uv`) or explicit uv.
- Atlas patches carry a copy of their left eighth past their right edge, so faces across a cylinder's seam read correctly.
- Proportions follow the turnaround's side view (orthographic); grip, reel and charm on the Cedar are 1.15x toward the hero's chunkier read.

## Tools and gotchas

- Run: `LANE=rod-rebuild-c /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <scratch>/run.sh cedar,flimsy,training,training-2 <tag>` (builds, then compare_c.py per rod into the scratchpad). Then `cd web && node scripts/pack-glbs.mjs`.
- Textured faces must be painted white (`pc.paint("#FFFFFF")`): the vertex colour multiplies the texture.
- kit's remove_doubles replaces vertices: finish_c keeps uv and colours by position.
- A float-step dash loop once hung Blender: dashes() now steps by index.

## Next

- Coordinator review of the compare images; apply the mapping changes above.
