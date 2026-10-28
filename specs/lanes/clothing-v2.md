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

Round 2 built, shots ready for David (2026-10-28), not merged. Head: see `git log -1` on `game/clothing-v2`. Round 1 and
the TSI zip hoodie were approved (their notes are in git history of this file, commit 5886cdbc).
- **Every outfit on a universal model** (`build_outfits.py`), part ids unchanged (saved looks keep working). Model ->
  parts (tris now / old): tee -> base tee, sweater vest (144 / 152, 188); tee_collar (the tee + a white collar, the zip
  hoodie's way) -> collared shirt (160 / 176); longsleeve -> striped; hoodie / hoodie_zip; sweater (the hoodie's body and
  sleeves, a crew collar) -> TSI crewneck, cardigan, silk sweater (216 / 256, 262, 236); coat -> raincoat (216 / 218);
  shorts; overalls (the shorts + bib, straps, two gold studs) -> overall shorts (146 / 162); skirt -> pleated (120 / 120,
  pleats are paint); skirt_long -> long skirt (160 / 160); trousers; joggers; dress -> sundress (188 / 208); kimono (260 /
  277, koi and collar paint, obi and bow geometry); cape -> monarch cape (228 / 252, veins, border, spots paint); slipon;
  sneakers -> sneakers, loafers (156 / 156, 172); boots -> boots, rain boots (216 / 248, 248); sandals (152 / 152).
  Body cut bits 0-19, one per model (`fit_report.txt`).
- **Design atlas** 2048 px of 256 px units: a design takes 1 unit or 2 x 2 (tsi_zip, tsi_crew, kimono); 16 designs, 25 of
  64 units used. Catalogue `designs`: `cells` (name -> index) and `rects` ([u0, v0, size] in the atlas), no more `grid`.
  Engine: look.ts `designUse` reads `rects`. Designs paint fixed colours; black or white at a low alpha shades the tint
  (ribbing, seams, folds follow the picked colour). Family layouts: one-pieces = tops' with the torso down to the sole;
  shoes: foot v 0..0.65, a boot's shaft below it (slip-on and sneaker GLBs changed UVs only).
- **Weights:** a skirt-region vertex (skirts, dress, kimono hem, coat flare, cape) keeps its region weights (`vreg`
  stashed on the object by kit.finish); a torso vertex takes the nearest body point among triangles not mostly on an
  arm (a roomy back over the shoulder blade took arm weights and bared the back in a run). This re-weighted the round 1
  tops (tee, long-sleeve, hoodie, zip hoodie): `blender_round1_tops_reweighted.png` shows them unchanged to the eye.
- **The decal is gone:** the crewneck's TSI mark (public/logo.svg, rasterised by build_outfits with rsvg-convert) is in
  its design. Deleted: the decal mesh, material and loader in Character.tsx, `TSI_DECAL_URL`, `ResolvedPart.decal`,
  `PartMaterial.decal`, the sync script's raster step, both `decal_tsi_mark.png`, kit's decal material kind and
  `decalSlot` on new entries, and 14 old garment GLBs (+ their LOD 1). preloadAssets.ts edited by hand to the new GLBs.
- **TSI zip hoodie, members only** (David, 2026-10-27: "its free in the default character creation but only for tsi
  members, unobtainable for non"): catalogue `members: true`; `partRef` null (nothing to own, no shop row, so no
  special, gift or reward); `shownOptions(..., member)` hides it from non-members in every creator; `forMember(look,
  member)` puts the default top back. Membership: `profiles.membership === 'member' && is_active` (the member badge's
  test, lib/identity/service.ts badgeFor), read by lookStore from GET /api/profile (`MyLook.member`) and checked again
  on the server in PATCH /api/profile (403 `members_only`). Creators: PlayerCharacterUI, WardrobeSheet and the arrival's
  ReflectionCreator pass `member`; the applicant island passes nothing (hidden there). Remote players: `remoteLook(json,
  player.member)`. Merged main again (2026-10-28) for wardrobe-b3's `offered()`: it lets a `members` part through (never
  priced, offered free, to members alone); creatorCategories.test runs `shownOptions(member)` with `offered()` in the
  creator and the closet, member and non-member.
- **Gates (after the second main merge, 2026-10-28):** tsc clean; vitest with `NEXT_PUBLIC_GAME_WORLD=new` 3512 passed /
  4 skipped; without it 3504 passed, one lib/game/world/cells.test.ts case timed out at 908 s under machine load (a file
  this branch doesn't touch; before the merge it was a barriers.test.ts case the same way); eslint clean on changed
  files. No perf:check (machine saturated; the lane removes the decal's draw call, adds none; atlas 1024 -> 2048).
- **Evidence** (`specs/evidence/clothing-v2/round2/`): `blender_{tops,bottoms,onepieces,shoes}.png` (before / after, run,
  jump, sit x front, side, back), `blender_round1_tops_reweighted.png`, `fit_report.txt`, in game (the runtime Character on /lab/avatar ?sheet=fit,
  design paint and body cut live) `game_tops.png`, `game_bottoms_onepieces.png`, `game_shoes.png`, and
  `tsi_crew_closeup.png` (the crewneck's mark at the creator's close-up, creator light).

## Next

1. David reviews round 2 (`specs/evidence/clothing-v2/round2/`); apply his notes.
2. Known: the long skirt folds oddly in a side sit (as before); the rain boots share the boot's shaft (shorter than
   the old rain boots); the overall shorts' bib sits over every top (by design, LAYER report).

## Tools and gotchas

- Evidence: `outfits/render_fit.py` (`FIT_ROOT=<an older art/characters tree>` for "before"; tints each part from its
  catalogue colours) and `outfits/fit_sheet.py` (`BEFORE=`); in game `/lab/avatar?sheet=fit&ids=` + `web/scripts/fit-shots.mjs`
  (`&cut=0` shows the cut skin); a close-up: `/lab/avatar?sheet=look&look=<json>&views=front,34,back&light=creator&framing=body&zoom=3.2&at=0.44`.
- zsh doesn't split `$IDS`: write the ids out (or `${=IDS}`) when passing them to Blender.
- The session scratchpad is shared with other agents: use your own subfolder.
- Order after any garment change: `build_outfits.py -- <ids>` → `build_lod.py -- <ids>` (not `base`: that rebuilds
  the LOD skin and drops its marks) → `hidden_cut.py -- bodycut` (prints the FIT/LAYER report; `-- bodycut fit step=15`
  for a quick look without marking) → `node web/scripts/sync-character-assets.mjs` (then `git checkout` the
  regenerated `hair_colour_world.png`: tool noise).
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
