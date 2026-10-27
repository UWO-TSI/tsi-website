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

## Status

(none yet)

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/wardrobe-b3 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
