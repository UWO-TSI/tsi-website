# Lane: clothing-v2 (universal garments that fit, designs as paint)

Worktree `.claude/worktrees/clothing-v2`, branch `game/clothing-v2`, cut from main at 5d848445. Agent type `uwotsi-lane`.

David, 2026-10-26, verbatim: "we need better clothing models that are like universal like universal tee hoodie etc and just need to hcange the paint over it like design, current clothes pants shoes pop out the body and poorly modeled."

What that means:
- **One universal model per garment type:** a tee, a hoodie, a long-sleeve, a sweater, trousers, joggers, shorts, a skirt, sneakers, boots, and so on. Each fits the base body exactly through every animation clip: no skin or body poking through, no garment floating off it.
- **A design is paint, not a new model:** a stripe tee, a TSI crew tee and a plain tee are the same tee mesh with a different texture (a design layer on the garment's UVs over its tint). New clothes are then a new design, not new modelling.
- **The body never pokes through:** fit each garment over the base body in Blender, transfer the body's weights, and hide the body under the clothes where it can't show (the usual way: mask or cut the covered body regions per garment), checked in the stretchiest poses of every clip.
- **Cleanly modelled:** soft cartoony shapes (ACNH style), good silhouettes at game distance, cheap (keep each garment's triangles at or under today's), shared materials.

**Round 1 (review with David before more):** the starter set first (`STARTER_PARTS` in `web/lib/game/character/look.ts`: tee, hoodie, striped long-sleeve, shorts, trousers, joggers, slip-ons, sneakers), each rebuilt on its universal model, the striped long-sleeve as a design on the long-sleeve, and the design-paint path working in the game (catalogue entry → mesh + design texture). Then the rest of `art/characters/outfits/` on the same models in round 2. Saved looks must keep working: keep the part ids, or map old ids to new ones in `parseLook`.

**Evidence:** headless Blender renders and in-game headless shots of each garment on the body, front, side and back, in a run, a jump and a sit; before and after the current models; in `specs/evidence/clothing-v2/`. The coordinator puts them on a review page for David; nothing merges before he approves.

**Read first:** `CODEMAP.md` rows "Character, avatar, hair, wardrobe" and "Art pipeline"; `specs/character-set.md`, `specs/character-in-engine.md`, `specs/characters/head-v10.md` (only for the body and rig); `art/characters/outfits/build_outfits.py`; `art/characters/base/`; the outfit parts in `web/data/characters/character_catalog.json`. If a garment's look needs a reference David hasn't given, ask the coordinator; don't find one yourself.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint; one `perf:check` at the end (`SCENES=village,v2,cafe`, characters changed). Message "main" when round 1's renders are ready, with the head SHA, gates and evidence paths, then stop.

## The TSI zip hoodie (David, 2026-10-27, before his round 1 review)

David, verbatim, with his photo: "make this hoodie design". The photo and a written reading are in `specs/references/clothing/` (`2026-10-27-tsi-zip-hoodie.png`, `README.md`). Read both.

- Make it a design on the universal hoodie, the round 1 path: the navy washed colour, the darker ribbing, the silver zip line with its pull tab, the slanted pocket welts and the TSI chest logo (cream letters, dark outline, "EST." and "24"), all painted into the design atlas.
- If the pullover's drawstrings or its kangaroo pocket are geometry, make a zip variant of the universal hoodie without them, the smallest change, sharing its fit, weights and body cut. Don't build a new garment from scratch.
- Keep the logo crisp enough to read at the creator's close-up, and blocky enough at game distance. Paint it from primitives and type in your build script. Use only David's photo as the reference.
- Catalogue: a new part, "TSI zip hoodie", with no price yet (David prices it on the shelf page). Don't change the existing hoodie.
- Evidence for David's page: the photo beside our hoodie, front, back and 3/4 in the creator's light, plus a close-up of the logo and a run/jump/sit strip, in `specs/evidence/clothing-v2/tsi-zip-hoodie/`.

Round 1's review is still out with David, so keep this on top of round 1, on this branch.

## Round 2 (David approved round 1 and the TSI zip hoodie, 2026-10-27)

Round 1 (https://claude.ai/artifact/G5RvBxgazEZwSirknQaBDt): tops, bottoms, shoes, in-game and "shape" all approved. "Shape" approved means: keep these silhouettes and roll the same treatment to the rest. The TSI zip hoodie (https://claude.ai/artifact/TiHe1w3zCSdHEtQkt3F89M) is approved on every item; it gets a price on the shelf page later and stays hidden until then (wardrobe-b3's offered() rule).

Round 2: put every remaining outfit in `art/characters/outfits/` (cardigan, collared shirt, sweater vest, TSI crewneck, raincoat, silk sweater, the skirts, overall shorts, the one-pieces, boots, loafers, rain boots, sandals) on universal models the same way: one mesh per garment type, designs as paint (the TSI crewneck as a design on the sweater or crew model, and so on), the body cut, at or under today's triangles. The design atlas needs room, so grow it to 2048, or use smaller cells where the design is simple. Merge main first. Review shots like round 1, in `specs/evidence/clothing-v2/round2/`.

## Status

Round 1 built, in review (not merged). The TSI zip hoodie built on top of it, shots ready for David (2026-10-27). Head: see
`git log -1` on `game/clothing-v2`.
- **TSI zip hoodie** (part `top_tsi_zip_hoodie`, "TSI zip hoodie"): model `top/top_hoodie_zip.glb` = the universal hoodie
  less the pullover's drawstrings (`hoodie_shell` shared by both; 263 tris, the pullover 271), same rings and weights,
  its own body-cut bit 8 (one bit per model, rig.test; the same 24 skin triangles as bit 2). M_Main fixed `#2A4680`
  (no colour pick). Design `tsi_zip` (cell 1): opaque wash (dusty top, deep navy hem), darker ribbed hem and cuffs,
  silver zip with slider, stop and blue pull tab, slanted welt pockets, the patch (arched varsity TSI, cream on a navy
  outline, "EST." and "24" in a 3 x 5 type), all primitives and type in `build_outfits.py` placed by arc length round
  the hoodie. Unpriced: `key: "tsi-zip-hoodie"`, not in `specs/wardrobe/batch2-pricing.json` (coordinator: a keyed part
  missing from the pricing JSON is hidden everywhere until David prices it; lane wardrobe-b3 adds that helper to look.ts.
  On this branch alone it shows locked in the closet). The batch-2 tests now count only keys in the pricing JSON.
- **Design atlas now 2 x 2 cells of 512 px** (still 1024 px; was 4 x 4 of 256): the logo needs ~570 texels a metre round
  the torso to read at the creator's close-up. Room for 4 designs; round 2 needs grid 4 (2048) or smaller cells.
- **design_uv seam fix:** a face across a family's seam with no corner on it (the hood's middle column) swept the whole
  design row (the zip and logo showed on the hood). Its far corners now go onto the seam. UV-only change to the
  hoodie, shorts, trousers, joggers, slip-ons and sneakers GLBs (no design on them, so nothing visible changed).
- **Evidence** (`specs/evidence/clothing-v2/tsi-zip-hoodie/`): `photo_vs_ours.png` (photo, then front, 3/4 and back in the
  creator's lights), `logo_closeup.png`, `run_jump_sit.png` (in game, the pullover below it), `fit_report.txt`.
- **Gates (TSI zip hoodie):** tsc clean; vitest 3453 passed / 3 skipped, with and without `NEXT_PUBLIC_GAME_WORLD=new`;
  eslint clean on changed files. No perf:check (no new draw call, same atlas size).
- **Universal models** (`art/characters/outfits/build_outfits.py`, section "clothing-v2"): tee, long-sleeve, hoodie,
  shorts, trousers, joggers, slip-ons, sneakers. One mesh per type (`model=`); the striped long-sleeve is
  `outfits/top/top_longsleeve.glb` + the stripe design (the old `top_stripe_ls.glb` is deleted). Part ids unchanged, so
  saved looks keep working. Triangles at or under the old ones: tee 144 (was 152), long-sleeve 248 (256), hoodie 271 (279), shorts 98
  (114), trousers 162 (178), joggers 214 (234), slip-ons 216 (216), sneakers 156 (156).
- **Fit:** each model's rings sit where the skin has its own, none between two across a joint; weights transferred
  from the clip base's skin (nearest point on the same side); bottoms' leg tubes are closed at the top inside the seat
  (a raised thigh showed the tube's open end, and the skin through it, from behind in a sit). Tried and dropped: skirt
  weights on the seat (opened a gap mid-back).
- **Body cut:** `hidden_cut.py bodycut` marks `_BODYCUT` on the base skin (clip base and LOD 1 skin): bit `bodyCut` per
  model = skin hidden from every view (normal + rings at 40/70/87 degrees) in rest and every 3rd frame of all 73 clips.
  Engine: `rig.ts` cuts a list of `PieceCut`s; `Character.tsx lookPieces` adds one per worn garment.
- **Designs:** `outfits/designs.png` (4x4 cells of 256 px, 8 px gutters), catalogue `designs` + part `design` (cell).
  Shared layout per family (`design_uv`): tops torso + sleeves, bottoms hips + legs, shoes feet. Engine: uv moved into
  the cell + `DESIGN_U` (4); the body material paints the texel over the tint by its alpha, the vertex's COLOR_0 shade
  in `hairMap.y`.
- **Evidence** (`specs/evidence/clothing-v2/`): `blender_{tops,bottoms,shoes}.png` (before = last commit's models,
  after; run/jump/sit x front/side/back, no hair so the back shows), `game_starter_set.png` (the runtime Character on
  /lab/avatar ?sheet=fit, design paint and body cut live), `game_cut_off_for_comparison.png` (`&cut=0`),
  `fit_report.txt` (hidden_cut.py bodycut output).
- **Gates (2026-10-27):** tsc clean; vitest 3453 passed / 3 skipped, with and without `NEXT_PUBLIC_GAME_WORLD=new`;
  eslint clean on changed files. perf:check (village, v2, cafe) FAILED against its 2026-10-14 baseline in every scene
  and tier (frame +7 to +44%, cafe lite included) with machine load 5 and swap over 10 GB; v2's +70% draw calls and
  +54% triangles are the v2 world's growth since that baseline. This lane adds no draw call (designs share the body
  material) and lowers garment triangles; the coordinator's combined check should judge it.
- **Evidence tools (zip hoodie):** `/lab/avatar?sheet=look&look=<json>&views=front,34,back&light=creator&framing=body`
  (`&zoom=3.2&at=0.44` for the logo; on this sheet the height looked at is `&at=`, since `&look=` is the JSON).
- **Evidence tools:** `outfits/render_fit.py` (+ `FIT_ROOT` for the last commit's assets), `outfits/fit_sheet.py`
  (`BEFORE=`), `/lab/avatar?sheet=fit` + `web/scripts/fit-shots.mjs` (in-game, `&cut=0` shows the cut skin).

## Next

1. David reviews round 1 (`specs/evidence/clothing-v2/`) and the TSI zip hoodie (`.../tsi-zip-hoodie/`). Apply his notes;
   he prices the hoodie by adding `tsi-zip-hoodie` to `specs/wardrobe/batch2-pricing.json`.
2. Round 2: the rest of `art/characters/outfits/` on the same models (TSI crew = sweater + a TSI design, so the decal
   mesh can go), plus new models for skirts, boots, sandals, loafers, rain boots and the one-pieces.

## Tools and gotchas

- Order after any garment change: `build_outfits.py -- <ids>` → `build_lod.py -- <ids>` (not `base`: that rebuilds
  the LOD skin and drops its marks) → `hidden_cut.py -- bodycut` (prints the FIT/LAYER report; `-- bodycut fit step=15`
  for a quick look without marking) → `node web/scripts/sync-character-assets.mjs` (then `git checkout` the
  regenerated `decal_tsi_mark.png` and `hair_colour_world.png`: tool noise).
- The FIT `poke` count includes a forearm resting into the belly in Sit and a shoe collar sinking into the shin in a
  crouch (the garment inside the skin, not skin through the garment); judge by the renders.
- A ring between two skin rings across a joint (the old knee ring at 0.13) sinks into the back of the knee as it
  bends: the skin has rings at 0.289/0.17/0.09/0.035 (legs) and 0.076/0.138/0.199/0.263/0.273 (arms).
- With swap over 9 GB the Blender lock waits for the dev server lock; run Blender batches in the background in a
  retry loop on withlock's exit 75.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/clothing-v2 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
