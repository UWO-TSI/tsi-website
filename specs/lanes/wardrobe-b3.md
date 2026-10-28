# Lane: wardrobe-b3 (David's batch 3: 15 hairstyles, 7 faces, 3 face accessories)

Worktree `.claude/worktrees/wardrobe-b3`, branch `game/wardrobe-b3`, cut from main at 00f0593f. Agent type `uwotsi-lane`.

David, 2026-10-27, verbatim: "add these new hair fance accessories, i want you to make a editor for the face parts so i can manually set the proper height on the face both face and hair. then i want to do the accessory check list with free or price thing again just update it after"

**His files, already unpacked here (commit them with your first commit):**
- `art/characters/hair/source/david-b3/`: hairstyles #28 to #42 (Roblox GLBs) and `_preview-3.png`, his picture of the set.
- `art/characters/v7/face/source/david-b3/`: faces #26 to #32, each split as `eyes/`, `mouth/`, `face/` and `full/` GLBs, plus `_previews/batch3.png`.
- `art/characters/accessories/source/david-b3/face/`: face accessories #25 (droopy kitty glasses with a pink bow), #26 (white bandages) and #27 (face bandaid), plus `_preview-3.png` and `_preview-3-side.png`.

**Do:** import all of them exactly the way batch 2 was imported (`specs/lanes/wardrobe-b2.md`, Status and Tools, and the scripts it names: the hair import and its natural map and atlas cell, the skull fit, `hidden_cut.py` for anything that covers hair (#34's rolled-up ski mask), `fit_check.py`, the LODs, the colour atlas, the creator thumbs `scripts/bake-hair-thumbs.mjs`, the shop icons). Keep within the per-look triangle budget batch 2 used.
- **Names in game:** our own plain descriptive names, never a character or brand name from the file names (no "Spider-Man", "Gojo", "Ichigo", "Nagumo", "UA"). For example "Spiky messy", "Space buns with fluffy edges".
- **Prices:** none yet. David picks free or price on the shelf page after this lands. Until then, give each new item a `key` (`hair-28` to `hair-42`, `face-26` to `face-32`, `acc-25` to `acc-27`, following batch 2's scheme; check those keys are free) and leave it out of `batch2-pricing.json`.
- **Heights:** don't hand-tune heights on the face beyond what the import does. Lane `fit-editor` is building an editor where David sets each hair's, face's and accessory's height himself. Use the same catalogue fields it adds (ask the coordinator if they're not on main yet).
- **Merges:** lane `hair-shelf` is changing `web/data/characters/character_catalog.json` and `specs/wardrobe/batch2-pricing.json` (4 hairs priced, 3 removed). Merge `game/hair-shelf` when the coordinator says it landed; never pick a side of a generated file, regenerate it.

**Evidence:** sheets of every new item on the body in the creator's light, front, 3/4, side and back (the `/lab/avatar` sheets `roblox`, `facekit`, `hairkit`), next to David's previews, in `specs/evidence/wardrobe-b3/`. Nothing merges before David has priced and fitted them.

**Read first:** `CODEMAP.md` rows "Character, avatar, hair, wardrobe", "Art pipeline", "Economy"; `specs/characters/head-roblox.md` and `head-v10.md`; `specs/lanes/wardrobe-b2.md`.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, `fit_check` PASS, gen-seeds up to date (no seed yet; the coordinator writes prices after David picks). Message "main" when the evidence is ready, with the head SHA, the item list (key, id, name, triangles) and the gates, then stop.

## Removal (David, 2026-10-27): "remove fluffy crop and wind swept"

Remove `hair_fluffy_crop` (hair-33, Fluffy crop, source #29) and `hair_long_windswept` (hair-35, Long windswept, source #31) from batch 3 entirely, the way hair-shelf removed three hairstyles (`specs/lanes/hair-shelf.md` Status):
- their catalogue entries in both copies, their GLBs at full, lod1 and lod2, thumbs, shop icons and lod.json entries;
- mark them removed in the import manifest (`art/characters/hair/source/david-b3/manifest.json` or wherever batch 3's list lives), so a re-import doesn't bring them back. Keep David's source GLBs as they are;
- leave their atlas cells empty; don't re-bake the atlas;
- don't renumber the other keys (hair-33 and hair-35 just stay unused);
- tests and counts updated; any resident or default look that uses them repointed to a free hairstyle.
Gates as before (vitest both worlds, tsc, eslint, fit_check). Commit, update Status, message "main" with the head SHA, and stop.

## Status (2026-10-27)

- **Head:** the commit carrying this file (on top of `4d5d7b3f`). Main `58e6f63f` (hair-shelf merged) is merged in. Evidence ready; nothing approved yet. Nothing merges before David prices and fits them.
- **Keys (hair-28 to 31 went to four earlier hairs in the hair shelf, so batch 3 starts after them):**
  - hairs #28-42 = `hair-32` to `hair-46`: spiky messy, fluffy crop, straight layers, long windswept, rolled-up mask, tousled spikes, ski mask and dreads, braided pigtails, space buns with fluffy edges, messy buns with a braid, messy with a braid, freeform afro, sponge twists, middle part, mod cut;
  - faces #26-32 = `face-26` to `face-32` (squiggle, zombie, big eyes, crying, moody, dizzy, wink), mix-and-match parts;
  - face accessories #25-27 = `acc-25` to `acc-27` (droopy glasses with a bow, cross bandage, face bandaids).
  - None is in `batch2-pricing.json`. `look.ts partRef`: a keyed item without a price is free until David prices it. Shop icons exist for all of them (hair tiles, accessory renders, face icons), so pricing needs no rerun.
- **What changed in the pipeline:**
  - Hair atlas `hair_colour.png` grew from 6x5 to 6x7 cells. Its UVs are in atlas space, so every hair was rebuilt from source (import, LOD, hidden, hat cut). Existing hairs' triangles are unchanged; sheet 04 shows them before and after.
  - Hair-shelf removals carried into the manifests: `hair_visor_messy` is `accessory_only` (acc_visor still split from it), `hair_fluffy_boy` and `hair_wavy_half_up` are `removed`. None of the three is back in the catalogue.
  - New cap rules in `import_hair.py`: `light` (#34's white ski mask, `islands` so its logo is painted out, logos `dark`) and `skin_tone` (#36, #39, #40's painted scalp and edges, drawn as they are).
  - Face page 2 (`v7_face_atlas_2.png`) is now 3264 x 3648: batch 3 sits in its own 1216-px columns on the right, because another band would have run past 4,096 px down. Every earlier rect and pixel is unchanged.
  - Colour atlas: three 128 px tiles for the accessories. It has two 128 px tiles left, and no 256.
  - `import_roblox.py`: entries take a source `set` (`david-b3`), and a new fit `face_on` (a bandage resting on the face, `side: right` for the cheek).
  - `fit_check.py`: face limits raised to batch 3's widest parts, as batch 2 did: eye reach 66 deg (#28's big eyes, 65.2) and facing 82.5 deg (#29's tears run down the cheeks, 81.6).
  - `#31 long windswept`: override 0.006 stud forward (about 2 mm; its fringe clipped the forehead by 2.8 mm). No height changes anywhere (fit-editor's `fit` map is for that).
- **Gates:** tsc clean; eslint clean on the changed files; vitest 3,461 passed with and without `NEXT_PUBLIC_GAME_WORLD=new`; fit_check PASS (`specs/evidence/wardrobe-b3/fit-check.txt`); gen-seeds up to date (no seed). Heaviest look 7,757 / 4,981 / 3,970, within 7,800 / 5,100 / 4,000 (`budget.txt`), the same as batch 2.
- **Evidence (`specs/evidence/wardrobe-b3/`):** `01-hairs.webp` (front, 3/4, side, back beside David's preview), `02-faces.webp`, `03-accessories.webp`, `04-existing-before-after.webp` (bob, two-tone curly pigtails, the ushanka, ribbon bob, own colours and dyed), `05-kits.webp` (facekit, hairkit).
- **Open, for David:**
  - #32's rolled-up mask still shows its white eye lenses: it reads as a well-known character's mask. Name is neutral.
  - Short hairs at their provisional height (#29, #39, #40, #41) show the matte under-cap's stepped edge at the temples and nape. #36's scalp shell shows dark under-cap blocks at the nape; turning its under-cap off left the crown uncovered (fit_check float 9 cm), so it stays on.
  - The skin-coloured scalp and edges (#36, #39, #40) are drawn in the source's own skin tone. They don't follow the member's skin. Their sources use alpha (#36's baby hairs), which our hair material doesn't cut out.
  - #25's glasses are cut to the 350-triangle face cap, and the frames look jagged.
  - fit_check flags: `hair_fluffy_crop` skin_through 4.9 mm at the nape, `hair_sponge_twists` 0.4 mm (and #20's old one).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/wardrobe-b3 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.

## Next

1. Wait for David's free-or-price picks and his heights in the fit editor. The coordinator writes prices and the seed.
2. If he sends items back, rebuild only those (Tools below), then reshoot with `shoot.mjs` and `sheets.py`.

## Tools and gotchas

- **Rebuild one hair:** `import_hair.py -- --only <id> --no-lod --no-sync`, `build_lod.py -- <id>`, `hidden_cut.py -- hidden <id>`, `hidden_cut.py -- hatcut <id>`, then `node web/scripts/sync-character-assets.mjs` and `git checkout web/public/assets/characters/v6/decal_tsi_mark.png`.
  - A full rebuild of all 39 hairs takes about 2 min (import), 3.5 min (LOD), 2 x 2 min (hidden, in halves) and 2 x 4 min (hat cut, in halves). Split it, or it outruns the 10-minute call.
- **Accessories:** `import_roblox.py -- --only <ids>`, then `build_lod.py` and `hidden_cut.py -- hidden` for them.
- **Faces:** `v7/build_face.py` (Blender), then `python3 art/characters/v7/face_icons.py`.
- **Orientation of a new hair:** the face side of the raw mesh; orientation 0 = raw -Z, 180 = +Z, 90 = -X, -90 = +X. Check with `import_hair.py -- --only <id> --render <dir>`.
- **Evidence:** dev server on 3186 under the browser lock, then `PORT=3186 node web/scripts/bake-hair-thumbs.mjs`, `BASE=http://localhost:3186 node web/scripts/render-icons.mjs <acc ids>`, `HOST=http://localhost:3186 node specs/evidence/wardrobe-b3/shoot.mjs <dir> hairs faces acc kits same`, `python3 specs/evidence/wardrobe-b3/sheets.py <dir> <before dir>`. The "before" shots ran with main's hair assets checked out temporarily.
- `/lab/avatar` `b2acc` and `b2faces` take `&keys=` and `&views=` now.
- zsh: quote any URL with `?` in curl, or the glob fails.
