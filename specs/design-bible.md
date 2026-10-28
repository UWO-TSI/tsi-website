# Design bible

The one canon for how the game looks: UI, art and models. On these topics it wins over every other spec. A spec, lane file or asset that disagrees with it gets fixed or archived; it isn't followed. Changes to the bible are recorded as rows in the decision ledger (`specs/game-world-development-plan.md`).

Chapters: **UI** and **Models** are set (2026-10-28, ledger rows 320 and 319). **Art** is being written from the 2026-10-28 codebase review; until it lands, `specs/art-direction-oct17.md` is the art reference. Older UI docs (`specs/polish/gui-sheet.md`, `specs/polish/ui-themes.md`, `specs/cozy-lighting-and-adaptive-ui-2026-09-17.md`, `specs/game-ui-questions.md`, `web/DESIGN_SYSTEM.md`, `web/STYLE.md`) are history wherever they disagree with this file.

## UI

David, 2026-10-28, on the review pages: "i need you to fuckign lock in on all the ui". The game had two live looks (flat in 11 menus, cream paper in about 14 plus the HUD), so every new screen copied whichever one its brief named. From now on there is one look.

**The look**
1. **Clean flat is the one base for the whole game UI:** menus, sheets, HUD chrome, toasts, prompts, dialogs. That means one flat light panel ("clean simple 1 box or 2 max"), white item cards, black and white type, an icon rail, and coins and gems top left. No boxes inside boxes, no beige and no glass. (Rows 315 and 285; David 10-22: "this is the basic clean color theme for ui".)
2. **Paper only for things that are paper in the world:** letters, notices, the club goal, HQ notices, a restaurant's menu (David 10-28: "PAPER MENU LIKE REAL RESTAURANCE"). Paper is a material inside the flat system. It is not a second UI.
3. **Minimal and visual.** Less text, more icons and pictures: you should understand a screen "just by looking at it". Show what something does on hover, in a line of plain words. Lighter colours, less bold (David 10-28 on the radar, the monument and the market).
4. **Weight matches importance.** Big moments (a rare catch, a level-up, a reward) are juicy: they pop, spring and fly to their slot. Ambient notices (campfire hour, a resident's letter arriving) are gentle and quiet (David 10-28: "very gentle and not something so important").
5. **One action per view and room to breathe** (David 10-18: "more space and cleaner more intuitive design").
6. **Real items, not text:** item pictures are the real model or its rendered icon, with the pixel filter. No emoji (row 281). Food on a menu is the food model (David 10-28).
7. **Rarity colours:** common grey, uncommon green, rare blue, epic purple, legendary yellow, and divine a purple holographic rainbow (`--gui-holo`). Rarity shows as a thin outline or edge, not a fill (David 10-28). Text on divine is white.
8. **HUD at rest:** only the quest line, the minimap and the time with its sun, top right (row 309). No movement UI. Esc 1 is a UI view with no dimming; Esc 2 is Settings and Log out.
9. **Motion:** a spring with about 12% overshoot; hover about 200 ms, select about 400 ms; transform only; a slight drop shadow on hover; off under reduced motion. When a value changes (a stat, a count), animate the change; never jump.
10. **Never show the coin or gem to CAD rate.**

**How it's built**
1. **Tokens only.** Components read the `--ui-*` theme tokens (`web/styles/themes/`) and nothing else. No hex, `rgb()` or font stacks in component CSS or inline styles. A missing token gets added to the theme file first. Themes swap whole, as a "css color sheet change" (David 10-22).
2. **One kit:** `web/components/gui/flat/` plus the shared pieces in `web/components/gui/` (motion, dialogs, `Keycap`, `Tabs`, `Tooltip`, `Progress`, `Counter`). Use a kit piece if one exists. If none exists (a radar chart, a reward track, a time strip), add it to the kit and the showroom first, then use it. No one-off panels, buttons, tags, bars or bubbles inside features.
3. **One showroom:** `/lab/gui` shows every kit piece in the base theme. A screen goes to David only after its pieces look right there.
4. **Review:** every new or changed screen goes to David as before and after shots on the new world, with frame strips for anything animated.

**Defaulted, David can overturn:** cream stops being a base look; its paper textures stay only as the paper material (rule 2), and a cream or ACNH theme could come back later as a paid theme swap. Nunito stays the one typeface. Ink black is the primary colour. The canonical Button, Keycap and Dialogue move from `components/recruit/ui` into `components/gui`. Recruitment keeps its own look, and the applicant island is unchanged.

## Models

David, 2026-10-28: "models should be considered to have a high def version and a low poly version for close up in shop vs from far away, and these models needs to be made properly on blender and not half assed and models should have direction and reference provided before making them".

1. **Direction and references come first.** No model is started until it has:
   - a direction: what it is, where it's seen and the feel;
   - references that David supplied or approved. When he asks a lane to find them online (David 10-28, the one-pieces: "use blender and online for refernce images"), the lane searches headless and shows him the picks before it models anything.
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
