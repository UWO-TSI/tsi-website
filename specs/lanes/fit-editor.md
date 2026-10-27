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

## Round 2 (2026-10-27): reposition, not just height

David, verbatim: "i want you to giv eme an editor where io can reposition the hairs and face locations"

Face Fit (https://claude.ai/artifact/D1gkmSBHBGspFPH5to9yA8, published by the coordinator from `dist/`) sets only height today. Nothing has been saved in its db yet, so the doc shapes can change freely; keep the old `{y}` readable anyway.

1. **Hairstyles and accessories:** move on all three axes of the head: up and down, forward and back, left and right. Keep the steps fine (0.5 mm), with a reset per axis and for the whole item.
2. **Faces:** the eyes up and down, the eyes closer together or further apart (both eyes move as a mirrored pair), and the mouth up and down. Every expression frame, blink and talking mouth moves with them, as the height does now.
3. **Moving it:** the buttons and sliders per axis, the keyboard arrows on the focused view (up/down and left/right in the front view; forward/back with the arrows in the side view), and dragging the item in the front view (left/right and up/down) and the side view (forward/back and up/down). Show the values in millimetres.
4. **Runtime:** extend the catalogue's `fit` map: `{ x, y, z }` in metres along the head's own axes for a hair or accessory, and `{ eyes, mouth, eyesApart }` for a face, with every missing value 0. The game applies them exactly as the editor draws them (the editor keeps using the game's own code). Extend `apply-fit.mjs` and its test. Add tests that each axis moves the item by exactly its value with the head turned, and that `eyesApart` moves the eyes symmetrically.
5. Rebuild `dist/`, run `check.mjs` (extend it to the new controls and doc shapes: a drag saves once, the arrows save, reset saves 0), keep every file a served type, and message the coordinator to publish.

## Status

**Round 2 built (2026-10-27).** David also asked, via the coordinator: "for the hair fit, also provide x and z shifts, also make the viewer draggable so i can seea ll agnes".
- Runtime: the catalogue's `fit` is `{ x, y, z }` (metres along the head's own axes: x its left, which is screen right in the front view; y up; z forward) for a hairstyle or accessory, and `{ eyes, mouth, eyesApart }` (face canvas units: up, up, and each eye away from the centre line) for a whole face. Every missing value is 0. look.ts `Fit`, `ResolvedPart.fit` (a triple, in `bodyKey`), and `faceLift` (now also returns `eyesApart`); rig.ts `adoptPrimitive`/piece `fit` (the old `lift`, replaced) adds the triple to the bind-space positions; face.ts `moved` (the old `raised`, replaced) shifts an anchor up and away from u = 0.5 on its own side, so mirrored eyes and eye_left pairs spread symmetrically, and eye_pair and the mouth have no apart.
- Tests: rig.test (every head piece binds the head with all three axes on the bind axes; real GLBs move exactly each axis's value along the head's own axis, at rest and with the head turned on all three axes; resolves from the catalogue), face.test (eyesApart over every face and three poses, the closed blink among them: both eyes move by exactly the value, outward, height and mouth unchanged; one-cell pairs unchanged), apply-fit.test (the new fields, round 1 `{y}` docs still read, limits on each).
- Editor: per axis a slider, ▼▲/Back Fwd/◀▶ buttons in 0.5 mm steps (face parts in 0.001 canvas, about 0.45 mm), a reset, and Reset all, values in mm. Faces: an Eyes/Mouth choice for what dragging and arrows move. A big "Look around" view (OrbitControls: drag orbits all the way round, above and below too; wheel or pinch zooms; Reset view remounts it; a Move toggle or Shift-drag moves the item there along the camera's screen axes). The fixed Front, 3/4 and Side rows on light and dark skin stay beside and below it. Dragging the Front view moves x/y and dragging the Side view moves z/y, following the cursor (a pixel is the camera's metres-per-pixel at the head). Arrow keys on a focused Front or Side view move the item (left is forward in the Side view, where the face looks left), Shift-arrow moves 10 steps. A drag saves once, when it ends; keys and buttons save through the 300 ms debounce. One hint line explains all of it.
- check.mjs PASS: everything below, plus `{x,y,z}` saved once after a burst, a Front drag moves by the drag on the 0.5 mm grid and saves once, a look-around drag turns the view and saves nothing, a look-around Shift-drag saves once, Reset view saves nothing, the Side view arrows move forward and up, Shift-arrow moves 10 steps, an axis reset saves 0, Reset all saves zeros, a face saves `{eyes, eyesApart, mouth}`, a Front drag on the right half spreads the eyes, and with Mouth chosen the arrow moves the mouth.

**Blank-page fix (2026-10-27, before round 2):** on claude.ai the page was blank. The frame's CSP lets the page fetch only its own files: no data:/blob: fetches, no WebAssembly. Now: build.mjs decodes each GLB's meshopt compression (gltf-transform, separate vertex attributes as the game's files; interleaved ones break rig.ts's merge), moves every embedded image to its own file beside the model (`<model>.glb.<i>.png`), and writes the whole GLB as base64 in `<model>.glb.json`; Editor.tsx shims `THREE.FileLoader` for `.glb.json` (fetch, decode, hand the GLB bytes to the loader); the bundle turns off drei's meshopt and Draco decoders (build plugin on drei `core/Gltf.js`; the game's code is untouched). Error boundaries around each 3D view (message in its cell), the list, the views, the canvas and the app; uncaught errors and rejections show on a line at the top (`#fault`). check.mjs serves dist with the frame's CSP (in the file) inside `<iframe sandbox="allow-scripts allow-same-origin">` from a second origin, fails on any CSP violation, blank root or shown error, and runs once with localStorage refused. PASS. dist: 236 files, 29.7 MB.

**Runtime field in** (commit after 08aecf1a; see `git log`). The catalogue's top-level `fit` map (`web/data/characters/character_catalog.json` and its art source, both), by item id:
- a hairstyle or accessory: `{ "y": <metres up the head> }` (look.ts `FIT`, `ResolvedPart.lift`, rig.ts `mergeLook` piece `lift`: added to the bind-space Y of the piece's vertices; every head piece binds the head with Y straight up, tested);
- a whole face (`FACE.faces`, by its `id`, e.g. `silly_cat`): `{ "eyes": <canvas units up>, "mouth": <canvas units up> }` (look.ts `faceLift`, face.ts `faceSlots`: the anchors move before placement, so every frame, expression, talk cell and the creator's sliders move with them). Face canvas is 0.449 m, so 0.001 is about 0.45 mm.
- Absent is 0: no `fit` key today, nothing changes. A top-level map, not a field on each entry, because `import_hair.py`, `import_roblox.py` and `build_face.py` rebuild entries (and face_v7.json) from scratch and would drop it; they keep top-level keys.
- Tests: `face.test.ts` (face fit block), `rig.test.ts` (fit block: real GLBs skinned in the scene move exactly `y` along the head's up axis, at rest and with the head turned), `scripts/apply-fit.test.mjs`.

**Apply script:** `node web/scripts/apply-fit.mjs <export.json>` (from `web/`): takes the db export (array of `{id|doc_id, data}` or fields beside the id, or an `{id: fields}` map), checks every id and value (unknown id, wrong field, |y| > 0.1, |eyes|/|mouth| > 0.2 refuse the whole export), rounds to 1e-4, drops zeros, writes only the `fit` key's text in both catalogue copies.

**Editor bundle: ready to publish.** `specs/tools/fit-editor/` holds `Editor.tsx` (the page: the game's own Character, face painter and catalogue; the item list, front, 3/4 and side on skins 1 and 10, the default look beside them, height controls with fine steps and a reset, a "set" badge, saving to the db), `index.html` (`<title>Face Fit</title>`, light and dark tokens, phone layout under 760 px), `build.mjs` and `check.mjs`.
- Build: `node specs/tools/fit-editor/build.mjs` writes `dist/` (gitignored): 168 files, 16.9 MB, `editor.js` 1.4 MB, every file a type artifacts serve (html, js, json, png, webp). Artifacts don't serve .glb: each GLB becomes an embedded glTF JSON `<name>.glb.json` (BIN chunk as a base64 data URI; GLTFLoader parses either), and the plugin rewrites `.glb"`/`.glb\`` to `.glb.json` in the web sources and `web/data/*.json` (the catalogue's `glb` paths). Every root-relative `"/assets/` in the bundled web sources becomes relative (the fishing rig preloads its bobber); assets are v6 minus the LOD folders and the unused clip libraries, the hair/accessory/face icons, and the bobber. `__THUMBS__` lists the thumbnails that exist, so missing ones (silly, silly_smile have no icon) show a letter and are never requested.
- Publish (coordinator): `dist/index.html` as the page with every other file under `dist/` in `files` at the same relative path, `capabilities: {"db": {}}`. Saves to collection `fit`, one doc per item id; reads them on load; db null shows "Can't save here".
- Check: `node specs/tools/fit-editor/check.mjs [port]` with the browser lock: local static server, headless Chromium (muted, swiftshader), a stand-in db. It also fails on any dist file of a type artifacts don't serve or over 16 MB, and on any request for one. PASS (after the coordinator's merge of main at e54daf8d): no console errors, page errors or failed requests; starts from a saved doc; a burst of 3 steps saves once (`{y: 0.0115}`); a face saves `{eyes, mouth}`; reset saves 0; no db says it can't save; no horizontal scroll at 1280 and 390. Evidence: `specs/evidence/fit-editor/desktop-{hair,face,accessory}.png`, `phone-{top,views}.png`.
- Gates: tsc clean (web, and Editor.tsx with a scratch tsconfig over web's), eslint clean on changed web files (it ignores `specs/`), vitest 3461 passed with and without `NEXT_PUBLIC_GAME_WORLD=new`.
- Not verified: the real claude.ai db (the stand-in follows the 0.2.91 db types: `collection().get()`, `doc().set()`); the page inside the artifact frame.

Items listed: hairstyles (catalogue hair, slot `back`), whole faces (`FACE.faces`), face accessories (group `face`). Hats are not listed (not in the spec); the field works for any part id if David wants them.

## Next

0. Round 2 is waiting for the coordinator to publish it (report sent with the head SHA). After that, David sets values and the coordinator runs apply-fit.

1. When the coordinator says wardrobe-b3 landed: merge main, `node specs/tools/fit-editor/build.mjs`, take the browser lock, `node specs/tools/fit-editor/check.mjs`, report the new size. The list reads the catalogue and `FACE.faces`, so new items need no code.
2. After David sets values: the coordinator exports the db and runs `node web/scripts/apply-fit.mjs <export.json>` from `web/`.

## Tools and gotchas

- The artifact frame: check.mjs's CSP refuses data:/blob: fetches and WebAssembly; never reintroduce either in the bundle (a meshopt GLB, an embedded image, or a data: buffer would blank a view).
- 1 px in a fixed view is about 3 mm at the head (0.7 m of view height): drag tests use a few pixels, or the 40 mm reach clamps.
- Playwright is global: `createRequire("/opt/homebrew/lib/node_modules/")`.
- withlock.sh gives up after 20 min with exit 75 (silently if output is filtered): retry on 75.
- Typecheck the editor: a tsconfig extending `web/tsconfig.json` with `files: [Editor.tsx]`, `typeRoots` and `paths` `"*": [web/node_modules/@types/*, web/node_modules/*]` (types first).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/fit-editor /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
