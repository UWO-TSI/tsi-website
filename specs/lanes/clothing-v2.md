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

## Status

Round 1 built, in review (not merged). Head: see `git log -1` on `game/clothing-v2`.
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
- **Evidence tools:** `outfits/render_fit.py` (+ `FIT_ROOT` for the last commit's assets), `outfits/fit_sheet.py`
  (`BEFORE=`), `/lab/avatar?sheet=fit` + `web/scripts/fit-shots.mjs` (in-game, `&cut=0` shows the cut skin).

## Next

1. David reviews round 1 (`specs/evidence/clothing-v2/`). Apply his notes.
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
