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

## Removal (David, 2026-10-27): "remove fluffy crop and wind swept" (done; later removals are in Status)

Remove `hair_fluffy_crop` (hair-33, Fluffy crop, source #29) and `hair_long_windswept` (hair-35, Long windswept, source #31) from batch 3 entirely, the way hair-shelf removed three hairstyles (`specs/lanes/hair-shelf.md` Status):
- their catalogue entries in both copies, their GLBs at full, lod1 and lod2, thumbs, shop icons and lod.json entries;
- mark them removed in the import manifest (`art/characters/hair/source/david-b3/manifest.json` or wherever batch 3's list lives), so a re-import doesn't bring them back. Keep David's source GLBs as they are;
- leave their atlas cells empty; don't re-bake the atlas;
- don't renumber the other keys (hair-33 and hair-35 just stay unused);
- tests and counts updated; any resident or default look that uses them repointed to a free hairstyle.
Gates as before (vitest both worlds, tsc, eslint, fit_check). Commit, update Status, message "main" with the head SHA, and stop.

## Status (2026-10-27, end of the day's follow-ups)

- **Head:** the commit carrying this file, on game/wardrobe-b3 (main merged earlier). Everything below is done and gated; nothing merged or pushed by this lane.
- **Removed on David's word (catalogue both copies, GLBs at every tier, thumbs, icons, lod.json, manifests marked `removed` so a re-import skips them, atlas cells left, keys never reused):** `hair_fluffy_crop` hair-33, `hair_long_windswept` hair-35, `hair_tousled_spikes` hair-37, `hair_space_buns` hair-40, `hair_messy_braid` hair-42 (manifest `art/characters/hair/source/david-b3/manifest.json`), face-30 moody (`v7/face_set_b3.py` REMOVED, `build_face.py` leaves it and its parts out of `face_v7.json`), `acc_cross_bandage` acc-26 (`removed: true` in `accessories/roblox_attachments.json`, `import_roblox.py` skips it; its 128 px colour tile stays reserved).
- **What is in the game from batch 3 (all priced, `specs/wardrobe/batch2-pricing.json`, David's shelf page):** free: hair-34 straight layers, hair-39 braided pigtails, hair-43 freeform afro, hair-45 middle part, hair-46 mod cut. 350 coins: hair-32 spiky messy, hair-41 messy buns with a braid, hair-44 sponge twists. 200 Gems: hair-36 rolled-up mask, hair-38 ski mask and dreads. Faces: face-29 crying and face-31 dizzy 250 coins, face-26 squiggle, face-27 zombie, face-28 big eyes, face-32 wink 100 Gems. acc-27 face bandaids 150 coins, acc-25 droopy glasses with a bow 100 Gems. Seed migration `web/supabase/migrations/20261027165850_catalogue_seed.sql` (unapplied; the coordinator applies it); `sql-smoke.sh` chain passes.
- **Rule changes this lane made:** `offered(id)` in `look.ts` (a keyed part, or a keyed face's parts, with no entry in the pricing file is not offered in the creator or the closet; Face Fit and /lab still list everything); hairstyles and faces are never in the daily specials pool (`special_pool` false in `lib/wallet/catalogue.ts`).
- **Placement:** Tousled spikes sat 78 mm forward (its fringe pulled the seat fit); fixed with an override before it was removed; `specs/evidence/wardrobe-b3/placement/` has the table. Nothing else moved. The method (bbox centre of the part above the skull's centre, `table-*.txt`) is the check for any new hair.
- **Monocle (acc-11):** re-imported with `piece_budget` (`decimate_pieces` in `import_roblox.py`): the ring 210 triangles alone, the chain's first seven links and the clasp 140, 342 in all. The source has no separate lens. `specs/evidence/wardrobe-b3/monocle/`.
- **Under-cap (David: "gotta remove that under layer thing"; his screenshot was Middle part):** `hidden_cut.py -- undercap [ids]`. For each cap triangle (u < 0) four sample points, the share of directions within 70 degrees of its outward normal that escape past the head, the body and the hair's own strands; more than `UNDERCAP_T` (0.1) is cut, per tier. `UNDERCAP_T_HAIR` raises it to 0.35 for `hair_dreads_cap` (at 0.1 its fit gap_max stood at 11 mm). 2,074 of 16,408 cap triangles cut over 30 hairstyles and three tiers (`specs/evidence/wardrobe-b3/undercap/cut-counts.txt`, `pair-1.webp` to `pair-8.webp`: every hairstyle, front, 3/4, side, back, before | after; `david-vs-after-middle-part.webp`: his screenshot beside it after. `make_pairs.py` builds them from `before/` and `after/` shots, which are not kept (12 MB of PNG); reshoot with `shoot.mjs ids:sN:...`. Note: `pair-4.webp`'s hair_dreads_cap row was shot at the first threshold (0.1); the shipped one cuts 7 of its 332 cap triangles, not 51, and fit_check passes on it). Run it after `hidden`, before `hatcut`; it keeps the `_HATCUT` marks (they move with the vertices).
  - Not the under-cap, so still there: #40 Sponge twists' brown notches at the temples and the skin-coloured scalp and edges of freeform afro (hair-43) are the source's own skin-tone geometry (`skin_tone` cap rule), not the matte under-cap. Say if David wants those cut too.
- **Gates:** vitest 3,463 passed with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc clean, eslint clean on changed files, fit_check PASS (0 over the limits), gen-seeds up to date, sql-smoke chain ok.
- **Superseded earlier notes:** the batch 3 list above in "Do" is now 10 hairstyles (hair-32, 34, 36, 38, 39, 41, 43, 44, 45, 46), 6 faces and 2 face accessories; the evidence sheets 01 to 05 in this folder were shot before the removals and still show the removed items.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/wardrobe-b3 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.

## Next

1. Done: prices and seed. Wait for the coordinator to merge; David's heights come from the fit editor.
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
