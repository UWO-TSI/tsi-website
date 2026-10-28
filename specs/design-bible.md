# Design bible

The one canon for how the game looks: UI, art and models. On these topics it wins over every other spec. A spec, lane file or asset that disagrees with it gets fixed or archived; it isn't followed. Changes to the bible are recorded as rows in the decision ledger (`specs/game-world-development-plan.md`).

Chapters: **Models** is set (David, 2026-10-28, ledger row 319). **UI** and **Art** are being written from the 2026-10-28 codebase review. Until they land, `specs/polish/gui-sheet.md` and `/lab/gui` are the UI reference, and `specs/art-direction-oct17.md` is the art reference.

## Models

David, 2026-10-28: "models should be considered to have a high def version and a low poly version for close up in shop vs from far away, and these models needs to be made properly on blender and not half assed and models should have direction and reference provided before making them".

1. **Direction and references come first.** No model is started until it has:
   - a direction: what it is, where it's seen and the feel;
   - references, which David supplies (agents never find their own).
   A lane that's missing either asks the coordinator, and the coordinator asks David. Without both, no model work starts.
2. **Two versions when a model is seen both up close and far away.**
   - **High-def** is for close-ups: the shop's detail view, item previews, the wardrobe and character creator, museum cases, the trophy case, gift and reward cards, and icons rendered from it.
   - **Low-poly** is for the world: on the ground, held, worn by residents, at a distance.
   - Both share one design: the same silhouette, colours and proportions. The low-poly is reduced from the high-def; it isn't drawn separately.
   - A model only ever seen one way gets one version.
   - The game picks by view. `worldModel` in `web/lib/game/world/active.ts` already serves the world copy while close-ups keep theirs. Grow that switch; don't add a second one.
3. **Made properly in Blender.** Built headless (`/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`) as real modelling:
   - a clean silhouette and sensible topology;
   - proper UVs and named materials;
   - the game's scale, pivot and facing. `art/remodel/` is the working pipeline: reuse its kit (`rkit.py`).
   - No stacks of primitives or maths-generated blobs standing in for a model.
4. **Finished before review.** A model goes to David in both versions: the high-def in its close-up view, and the low-poly in the world from the game camera, beside the model it replaces.
5. **One version in the repo.** When a model replaces another, the old file is deleted or moved to `archive/`, and every path that loaded it moves to the new one. No parallel old copies.
6. **Budgets.** The low-poly fits the world's triangle budget (`specs/perf/`). The high-def is sized for one model on screen at a time.
