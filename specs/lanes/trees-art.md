# Lane: trees-art (better-looking low-poly trees for the forest and the river)

Worktree `.claude/worktrees/trees-art`, branch `game/trees-art`, cut from `game/terrain-v3` at d258b30c. Agent type `uwotsi-lane`.

**David's notes (R2d review, 2026-10-26, verbatim in `specs/lanes/terrain-v3.md` "R2d review"):**
- on the forest: "can you model better looking low poly trees instead of copy pasting 1 model"
- on the river: "trees a bit small and look like bushes, still doesnt feel natural"
- earlier, on the forest: "i just need a low render for performance that also looks like busy forest over there but also look natural"

Today the forest is 338 instances of four models (`forest-tree-cedar`, `-fir`, `-broadleaf`, `-young`, from `art/trees/build_forest_trees.py`), and it reads as copy-paste. Read `specs/lanes/village-art2.md` and `art/trees/` (`build_conifers.py`, `build_broadleaf.py`, `greenery_kit.py`, `build_forest_trees.py`) for the style and the builders. `specs/references/terrain/r2-2026-10-26/nature-feel.jpg` is the feel he wants.

## Status

Done, head after this file's commit (batches 86ade31a forest trees, 0033266f river trees, then the tint check with this file). Not yet reviewed by David. One builder, `art/trees/build_forest_trees.py` (`-- forest|river|<model>... [review <dir>]`), all at scale 1, registered in `SCENERY_URLS`, budget rows "forest tree" (400 tris) and "river tree" (1200). Gates: propModels, modelMaterials, natureLod and budget tests 44 pass; eslint clean on the changed TS.

1. **Forest trees** (`specs/evidence/trees-art/forest-trees.webp`): `forest-tree-<name>` in `game/plants/`, crown + trunk triangles: cedar (layered shelves, 8 tall) 200+50, fir (10) 192+50, spire (12) 190+50, old-fir (9) 200+50, leaning (to +x, 8) 168+50, broken (snapped top and side leader, 7.6) 214+78, young (3.4) 94+40, broadleaf (oak-like, 6.6) 294+82, birch (pale trunk, 7.6) 252+120, wide (6.6 across) 294+82, sapling (2.6) 126+32, snag (dead, one draw) 84. 21 to 28 KB each. Same foot and SINK 0.8 as before; cedar, fir, broadleaf and young kept their names. Not solid.
2. **River trees** (`river-trees.webp`, among shrubs for scale): `river-tree-willow` (sprays hung all round, 8 tall) 696+112, `-alder` (8.9) 528+120, `-oak` (8.7 tall, 7.5 across) 576+120, `-lean` (crown 4.3 out to +x, 8.6) 528+120. 35 to 46 KB. Solid at the trunk only (`PROP_FOOTPRINT` in `defaultIsland.ts`).
3. **Tint** (`tint-check.webp`, `art/trees/tint_check.py`): the crowns share `mForestCrown`, one painted 256 px texture, near grey (needle strokes in its top half, leaf dabs in its bottom half); the green and the shade are in COLOR_0, so terrain-v3's `crownTint` (InstancedNature, `setColorAt` on `mForestCrown` only) shifts value and warmth cleanly. `mTreeTrunk` stays untinted.

## Next

Nothing left; wait for David's review notes.

## Tools and gotchas

- The kit's `ellipsoid` UVs run the atlas twice round in steps of segs / 4, so at 6 or 7 sides some faces get one texel column (stripes). `crown()` rewrites the lump UVs from the points.
- `propkit.review` multiplies a material's base colour by COLOR_0: give plain materials a white base (`K.plain(name, (1, 1, 1))`) or the preview shows them twice as dark as the game.
- `propkit.review` frames on a bounding sphere at 0.82, so a long row loses its ends: keep lineups short or lay them out square.
- The crown texture is painted in the builder (seeded numpy), no file on disk.

## Rules

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>` under `trees-art=game/trees-art /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`; `withlock.sh heavy` for vitest and tsc. Never open the Blender app; never use the `blender` MCP tools.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **Art:** never fetch art, textures or references; never use asset libraries or generators. The default village stays unchanged.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees. Don't edit `generate.ts` or `web/data/world/`; placement is terrain-v3's job.
- **Code and text:** no em dashes; real names never show in game; code follows the surrounding code (ponytail).
- **Per asset:**
  - a builder in `art/`;
  - the GLB in `web/public/assets/game/`;
  - a preview in `specs/evidence/trees-art/`;
  - registered in `SCENERY_URLS`, with footprints where solid;
  - the propModels, modelMaterials and budget tests green.
- **Reporting:** after each batch, SendMessage "main" with the commit, each asset's triangles, size, preview path and placement notes. At the end, update Status, send the full list, and stop.
