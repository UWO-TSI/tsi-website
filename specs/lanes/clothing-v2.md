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

## Round 3 (David's round 2 review, 2026-10-28)

David, verbatim:
- blender_tops: approved. "clothes look good, but you need start worrying and developing clothing model for classes and armour related soon for differnt class". (A later lane: no class or armour clothing here.)
- blender_round1_tops_reweighted: approved ("looks good").
- blender_shoes, game_tops, game_shoes, game_bottoms_onepieces, tsi_crew_closeup: approved.
- blender_bottoms (redo): "long dress clothes going though body, the 2 skirts are flashing when sitting down".
- blender_onepieces (redo): "include these but they look ugly, needs remodeling adn model them properly, use blender and online for refernce images".

## Status

Round 3 skirts fix built, not merged (head: `git log -1` on `game/clothing-v2`). Rounds 1 and 2 notes: git history of this
file (commits 5886cdbc, da63d1d3).
- **Root cause (both skirts):** a skirt's hem kept fixed region weights (body_shape "skirt": hips blended into the
  thighs, the front by SKIRT_FRONT). Seated, the lap (40 % hips, 60 % thigh) collapsed toward the hip joint, so the
  thigh rose through it; the skin under a skirt is never cut (0 triangles: it is open below), so thigh and skirt sat
  within millimetres and z-fought (the flashing). In a run the long skirt's back hung from the hips and the kicked heel
  came through it.
- **Fix: `drape_weights` (build_outfits.py, parts with `drape=True`: the two skirts).** Each skirt vertex below the
  hips mixes hips / both thighs / both shins as (1 - u - s, u, s), a smooth field (a value per ring at 5 directions
  front to back, eased, mirrored), fitted to the clips' poses (DRAPE_STEP; key clips weigh 1): the skirt's surface
  (vertices and points across its triangles, posed as the engine skins) kept DRAPE_CLEAR (12 mm) off capsules on the
  legs and shoes (body_shape.LEG rings, knee + 8 mm) and the torso, the hem not rising over its knee more than at rest
  while upright, nothing under the soles while standing, least pull off the hips, close to the legs it rides on, no
  fold or tear. Prints the field and the worst poses. The long skirt is fuller behind (oval `cy`, `back`) so a heel
  kicked back in a run stays inside. Tris unchanged (120, 160). The coat, dress, kimono and cape keep the old region
  weights (one-pieces get remodelled).
- **Real-skin check** (`hidden_cut.py bodycut`, `round3/fit_report.txt`): the skirts' remaining "poke" vertices are
  hands and forearms resting on the lap (Sit, SitGround, DanceRobot), no leg skin.
- **Evidence** (`specs/evidence/clothing-v2/round3/`): `blender_skirts.png` (before / after, run, jump, sit x front,
  side, back), `blender_skirts_more.png` (idle, run with the foot kicked back, sit on the ground), `game_skirts.png` (in
  game, /lab/avatar sheet=fit), `fit_report.txt`.
- **Gates (2026-10-29):** tsc clean; vitest 3544 passed / 4 skipped; eslint clean on changed files; fit_check PASS.
  No perf:check (tris and draw calls unchanged).
- **One-piece references:** collected (headless Bing image search via Playwright, `search.mjs`-style script in the
  session scratchpad), in `specs/references/onepieces/{sundress,koi_kimono,monarch_cape}/` with `sources.md` each:
  sundress 4, koi kimono 4, monarch cape 3 (Animal Crossing item renders + clean real kids' garments). The images are
  NOT committed (third-party images, public repo): the coordinator decides. Waiting for David's picks.

## Next

1. Wait for David's picks from `specs/references/onepieces/` (design bible Models rule 1: no modelling before).
2. Then remodel the one-pieces from his picks (properly in Blender, design bible Models), using `drape=True` for their
   skirts.
3. Known: the long skirt's front in a side sit drapes to a point past the toes; hands resting on a seated skirt sink
   into its lap.

## Tools and gotchas

- `render_fit.py`: `FIT_POSES=name:Clip:t,...` (e.g. `idle:Idle:0.5,run_kick:Run:0.43,sit_ground:SitGround:0.5`) and
  `FIT_RES=2` for a closer look; `fit_sheet.py` follows the same `FIT_POSES` names.
- `drape_weights` runs ~1 to 2 min per skirt inside build_outfits (all clips' poses).

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
