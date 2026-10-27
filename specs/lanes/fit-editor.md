# Lane: fit-editor (David sets each hair's, face's and accessory's height himself)

Worktree `.claude/worktrees/fit-editor`, branch `game/fit-editor`, cut from main at 00f0593f. Agent type `uwotsi-lane`.

David, 2026-10-27, verbatim: "i want you to make a editor for the face parts so i can manually set the proper height on the face both face and hair"

**What he gets:** a page he opens from any computer, as a claude.ai artifact the coordinator publishes. On it:
- the item list down one side: every hairstyle, every face (eyes, mouth and extras, as a set) and every face accessory (glasses, masks, bandages), each with its thumbnail;
- the chosen item on the character's head, as the game draws it, seen front, 3/4 and side at once, on a light and a dark skin, with the default hair or face beside it so he can judge;
- one control per item: **height**, up and down in fine steps, with a reset; for a face, the eyes and the mouth each get their own height (he may want them closer or further apart);
- every change saves at once and shows which items he has set.

**Fidelity is the point:** it draws with the game's own runtime code (`web/components/game/character/Character.tsx`, the face painter `web/lib/game/character/faceMaterial.ts`, the hair attach, the catalogue), bundled for the page (esbuild from the repo's sources, React Three Fiber included), not a re-made viewer. So a height set there is exactly the height in the game.

**Build:**
1. **The runtime field:** one optional per-item height offset in the catalogue (`web/data/characters/character_catalog.json`), in the game's units: a hair's or accessory's lift along the head's up axis; for a face, an eyes lift and a mouth lift on the face (applied where the painter places them, so every expression frame and blink moves with them). Default 0, so nothing changes for anything not set. Tests for each.
2. **The editor bundle:** a static folder (`index.html` with `<title>Face Fit</title>`, the bundle, and the assets it loads at relative paths, under 60 MB in all) the coordinator publishes with `capabilities: {"db": {}}`. It saves to the page's db: `const db = await window.claude.use("db")` (null when it can't save: show that), collection `fit`, one doc per item id, `{ y }` for a hair or an accessory, `{ eyes, mouth }` for a face. It reads the saved docs on load and starts from them, falling back to the catalogue's values. Follow the page rules in the Artifact contract: theme tokens for light and dark, works at phone width, no external fetches except pinned scripts from cdnjs or jsdelivr (bundle everything else), no `alert` or `confirm`. Build the folder at `specs/tools/fit-editor/dist/` (gitignored output) from a script in the repo.
3. **The apply script:** `web/scripts/apply-fit.mjs <export.json>` writes the saved values into the catalogue; the coordinator exports the db and runs it. Test it on a sample.
4. **Batch 3:** lane `wardrobe-b3` is importing 15 hairstyles, 7 faces and 3 face accessories. Build against today's items now; the coordinator tells you when b3 lands, then rebuild the bundle with them.

**Verify:** a headless screenshot of the page at desktop and phone width; a test that an offset in the catalogue moves the item by exactly that much in the game's scene; the bundle loads with no console errors in headless Chromium from a local static server. Evidence in `specs/evidence/fit-editor/`.

**Read first:** `CODEMAP.md` rows "Character, avatar, hair, wardrobe"; `specs/characters/head-roblox.md`, `head-v10.md`, `head-fit.md`; `web/lib/game/character/look.ts`, `face.ts`, `faceMaterial.ts`; the `/lab/avatar` sheets (`web/app/lab/avatar/page.tsx`) for how the runtime character is staged.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint. Message "main" when the bundle is ready to publish (its folder, size, and what you checked), then stop.

## Status

**Runtime field in** (commit after 08aecf1a; see `git log`). The catalogue's top-level `fit` map (`web/data/characters/character_catalog.json` and its art source, both), by item id:
- a hairstyle or accessory: `{ "y": <metres up the head> }` (look.ts `FIT`, `ResolvedPart.lift`, rig.ts `mergeLook` piece `lift`: added to the bind-space Y of the piece's vertices; every head piece binds the head with Y straight up, tested);
- a whole face (`FACE.faces`, by its `id`, e.g. `silly_cat`): `{ "eyes": <canvas units up>, "mouth": <canvas units up> }` (look.ts `faceLift`, face.ts `faceSlots`: the anchors move before placement, so every frame, expression, talk cell and the creator's sliders move with them). Face canvas is 0.449 m, so 0.001 is about 0.45 mm.
- Absent is 0: no `fit` key today, nothing changes. A top-level map, not a field on each entry, because `import_hair.py`, `import_roblox.py` and `build_face.py` rebuild entries (and face_v7.json) from scratch and would drop it; they keep top-level keys.
- Tests: `face.test.ts` (face fit block), `rig.test.ts` (fit block: real GLBs skinned in the scene move exactly `y` along the head's up axis, at rest and with the head turned), `scripts/apply-fit.test.mjs`.

**Apply script:** `node web/scripts/apply-fit.mjs <export.json>` (from `web/`): takes the db export (array of `{id|doc_id, data}` or fields beside the id, or an `{id: fields}` map), checks every id and value (unknown id, wrong field, |y| > 0.1, |eyes|/|mouth| > 0.2 refuse the whole export), rounds to 1e-4, drops zeros, writes only the `fit` key's text in both catalogue copies.

**Editor bundle:** `specs/tools/fit-editor/` (`Editor.tsx`, `index.html`, `build.mjs`, `check.mjs`); `node specs/tools/fit-editor/build.mjs` writes `dist/` (gitignored): 170 files, 15.9 MB, editor.js 1.4 MB. Headless check pending (browser lock queue).

Items listed: hairstyles (catalogue hair, slot `back`), whole faces (`FACE.faces`), face accessories (group `face`). Hats are not listed (not in the spec).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/fit-editor /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
