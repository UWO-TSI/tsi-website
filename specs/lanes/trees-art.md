# Lane: trees-art (better-looking low-poly trees for the forest and the river)

Worktree `.claude/worktrees/trees-art`, branch `game/trees-art`, cut from `game/terrain-v3` at d258b30c. Agent type `uwotsi-lane`.

**David's notes (R2d review, 2026-10-26, verbatim in `specs/lanes/terrain-v3.md` "R2d review"):**
- on the forest: "can you model better looking low poly trees instead of copy pasting 1 model"
- on the river: "trees a bit small and look like bushes, still doesnt feel natural"
- earlier, on the forest: "i just need a low render for performance that also looks like busy forest over there but also look natural"

Today the forest is 338 instances of four models (`forest-tree-cedar`, `-fir`, `-broadleaf`, `-young`, from `art/trees/build_forest_trees.py`), and it reads as copy-paste. Read `specs/lanes/village-art2.md` and `art/trees/` (`build_conifers.py`, `build_broadleaf.py`, `greenery_kit.py`, `build_forest_trees.py`) for the style and the builders. `specs/references/terrain/r2-2026-10-26/nature-feel.jpg` is the feel he wants.

## Next

1. **Forest trees:** 10 to 12 better-looking low-poly trees, very different from each other:
   - several conifer shapes (tall spires, broad old firs, layered cedars, one leaning, one with a broken top);
   - rounder broadleaf (oak-like, birch-like with pale trunks, one with a wide crown);
   - young saplings;
   - a dead snag.

   Natural proportions, never stretched. Each one about 120 to 400 triangles, two materials, with the same trunk foot and sink as the current forest trees, so terrain-v3 can instance them. Show them together in one preview, as a grove.
2. **River trees:** three or four bigger trees for the riverbanks, for example a willow with drooping branches, a big alder or oak, and a leaning riverside tree. They must read as trees, not bushes: tall trunks and crowns well above the shrubs. These can be richer, around 600 to 1200 triangles, since there are few of them.
3. **Tint:** terrain-v3 adds a per-instance tint. Keep the leaf colours neutral enough that a 10% tint varies them nicely, and say which material takes the tint.

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
