# Lane: rod-rebuild-c

Worktree `.claude/worktrees/fishing`, branch `game/fishing` (shared with lanes rod-rebuild-a and rod-rebuild-b: commit only this lane's files).

Task (coordinator, 2026-11-20): rebuild the Cedar, Flimsy and Training (stage 1) rod models identical to their approved concepts, and build Training stage 2 from `art/pipeline/concepts/old/training1/training2-a.png` (a picked over b: a is the easier read, its glow and cracks sit in one bandage and one reel seam). Write `rod-<rod>.glb`; report mapping changes rather than rewiring game code.

## Status

- Builder: `art/pipeline/build_rods_c.py` (loads build_rods.py's helpers by exec of its source up to its build section, never runs its builds; build_rods.py untouched). Compare: `art/pipeline/compare_c.py` (compare_sheet.py's hero camera, plus the turnaround's side, top and three-quarter rows and a close-up, COLOR_0 multiplied in, Glow drawn unlit).
- Outputs: `web/public/assets/game/tools/rod-cedar.glb` + `props/rodfx-cedar-boughs.glb` (the boughs, swaying), `tools/rod-flimsy.glb`, `tools/rod-training.glb` (replaced in place), `tools/rod-training-2.glb` + `props/rodfx-training-2.glb` (amber cracks and reel seam, two Halo sprites, amber sparks).
- Round 2 (coordinator review, 2026-11-20: "match the HERO's proportions ... budget up to 2500 tris each"): grips, reels and charms scaled to the heroes (measured across the rod axis on each hero), Training's finger bumps and big bobber reel and crank, Flimsy's coiled twine wraps and larger reel, charm and rag, Cedar's fuller fronds over and under the blank with a branch wound round it and a forked gold bracket over the reel, Training stage 2 worn through (thick grip tape, big frayed bandage, battered reel with a patch plate and a dent, red knot, feathers, faded engraved blank).
- Triangles (rod + effect): Cedar 1072 + 1016 boughs, Flimsy 1474, Training 1406, Training stage 2 1968 + 196 glow. Materials 3 to 4 each. All six GLBs packed (pack-glbs.mjs).
- Final compares (uncommitted, review only): `specs/evidence/rod-rebuild-c/<rod>-{hero,turn,close}.jpg`, model left, sheet right. The hero camera is compare_sheet's at 62 degrees (the sheets' rods lie at 28), framed by width. Stage 2's turn rows use the stage-1 turnaround for shape.
- Awaiting the coordinator's review.

## Mapping changes needed (not made here)

- `web/lib/game/tools.ts`: `rod_flimsy` and `rod_cedar` are in `LAUNCH_RODS`, so they load `rod-1.glb` and `rod-2.glb`. Point them at `rod-flimsy.glb` and `rod-cedar.glb` (drop them from LAUNCH_RODS, which then names `rod-flimsy`/`rod-cedar` by key). rod-1.glb, rod-2.glb and rodfx-cedar.glb then go unused.
- `web/lib/game/rods.ts`: the Training's first awakening (`at: 50`) needs `model: "/assets/game/tools/rod-training-2.glb"`.
- `rod-training.glb` keeps its path; no change.

## How these rods are made

- Every face's colour is its vertex colour (COLOR_0). Materials are presets by name (P_Wood, P_Metal, P_Paint, P_Cloth, P_Leather) sharing one painted atlas per rod; plain faces read its white corner, painted parts (carved grip, reel faces, stitching, tag, wraps, bandage) read their patch by projection (`cyl_uv`, `disc_uv`) or explicit uv.
- Atlas patches carry a copy of their left eighth past their right edge, so faces across a cylinder's seam read correctly.
- Proportions follow the heroes (round 2): girths and reels measured across each hero; lengths along the rod from the turnaround.

## Tools and gotchas

- Run: `LANE=rod-rebuild-c /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <scratch>/run.sh cedar,flimsy,training,training-2 <tag>` (builds, then compare_c.py per rod into the scratchpad). Then `cd web && node scripts/pack-glbs.mjs`.
- Textured faces must be painted white (`pc.paint("#FFFFFF")`): the vertex colour multiplies the texture.
- kit's remove_doubles replaces vertices: finish_c keeps uv and colours by position.
- A float-step dash loop once hung Blender: dashes() now steps by index.

## Next

- Coordinator review of the compare images; apply the mapping changes above.
