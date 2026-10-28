# Lane: remodel (our own models in place of the old and ACNH-dump ones; the fish fitted to our look)

Worktree `.claude/worktrees/remodel`, branch `game/remodel`, cut from main at 00f0593f. Agent type `uwotsi-lane`. Runs overnight; David reviews in the morning.

David, 2026-10-27 (night), verbatim: "I want you to go ahead and remodel some old models or some of the models from animal crossing dump that we are currently using, maybe tweak the fish models we have so it fits our game, i want you to do a artifact fro before after your remodels, make sure to remodel on blender, use pinterest for reference photos"

**1. Inventory first** (`specs/evidence/remodel/inventory.md`): every model from the ACNH dump (`web/public/assets/acnh/`) and every other old model still drawn in the game. Count the new world (production) and the views every player sees: the fish reveal and the fish market, the critters, the props, the plants, the tools. Rank them by how much a player sees them, and say what each one's file, triangles and textures are. Many are referenced by id at runtime (`lib/game/fishCatalog.ts`, `ambientFauna.ts`, `propModels.ts`, `NatureModels.tsx`), so trace those too.

**2. Remodel, most-seen first,** as many as the night allows. Do quality over count: about 8 to 12 props, plus the fish.
- **Our style:** cozy and cartoony like ACNH, but our own shapes, never a copy of a Nintendo model. Simpler and smoother, with soft silhouettes that read at game distance. Follow `specs/lane-rules.md` "Textures only where they show": plain colour plus the material look classes (`lib/game/modelMaterials.ts`), shared materials, and small textures only where seen up close. Fit the palette of the new world and of what's already ours (the wharf, the plaza set, the lamps, the trees: `art/props/`, `art/wharf/`, `art/trees/`).
- **Drop-in:** the same scale, pivot, facing and footprint as the model it replaces, and triangles at or under it. The collision footprints and PROP_TOP in `lib/game/defaultIsland.ts` must stay right; re-measure if a shape changes.
- **Blender:** build every model in a script under `art/remodel/` (one `build_*.py` per family) and export GLB headless: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`, under the Blender lock, closed after each batch. Never the blender MCP tools; they drive David's visible Blender. No asset libraries, no generators, no imported meshes from anywhere: model from primitives and code.
- **The fish:** tweak the fish we have so they sit in our game's look: consistent proportions, palette, softness and outline with the rest of our art. Keep every species recognisable, because players learn them, and keep their sizes and ids.

**3. References: Pinterest, David's request for this pass.** This is an exception to the usual rule, for this lane only. Search Pinterest for references of each kind of object (for example "cozy game lamp post 3d", "stylized low poly fish", "cute 3d crab model") with a **headless** browser only. Use a script with Chromium and `--mute-audio`, never a visible window, never the Playwright MCP. Save the images you use **outside the repo**, in `/private/tmp/claude-501/remodel-refs/`. Record each one's source URL, and what it informed, in `specs/references/remodel-2026-10-27/README.md` (URLs and notes only: the repo is public and the pictures are other people's). The references guide shape, colour and mood; never copy one design. If Pinterest won't load headless without signing in, try its public search pages and the `i.pinimg.com` images they link. If that fails too, say so and carry on from our own art.

**4. Before and after for David's review page:** for each model, the old and the new side by side under the same camera and light, as a Blender render and a headless in-game shot where it stands. Put them in `specs/evidence/remodel/<name>-before.webp` and `<name>-after.webp`, with a one-line note each. The coordinator builds the page. Wire the new models into the game on this branch, but nothing merges before David approves each one.

**Read first:** `CODEMAP.md` rows "Art pipeline", "Nature, grass, FX", "Fishing"; `specs/lane-rules.md` (textures, perf); one existing build script of ours for the conventions (`art/props/build_new_lamps.py`, and `art/wharf/`).

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, and one `perf:check` at the end (`SCENES=village,v2`). Message "main" with the inventory as soon as it's done, then at the end with the head SHA, the before and after list, triangles before and after, the gates and perf, and anything you couldn't do.

## Round 2 (David's review of round 1, 2026-10-27; https://claude.ai/artifact/4uk78WkbWRFyBRc3HD4WTL)

**Approved:** market cart, lighthouse, monument rope fence, the fish (all 81) and the fish close-up. Fish note, verbatim: "looks good i want all fishes remodeled like this". All 81 already have the tweak. Also re-render the fish icons (the catch card, the collection book) from the tweaked fish, so they match.

**Step 1, ship the approved ones first:** cut the wiring down to just the approved models (cart, lighthouse, rope fence, fish), with the redo items back on the old models for now. Run the gates, commit, and message the coordinator with that SHA so it can merge to main before you go on. One merge, then keep working on top.

**Redos, verbatim, with my reading:**
- **Crabs:** "the after sucks so bad if its similar triangles than i want you to keep the old ones". Drop our crabs and keep the dump's, with their wiring reverted. Delete the crab build script and GLBs.
- **Gather rocks:** "no i like the old one, it actuallyu looks like real rocks with texture and not random smooth shape, redo tp make it more liek the before". Rebuild them closer to the old ones: faceted, rocky, with the stone texture or a similar small stone texture that reads as real rock. No smooth blobs. Keep them at or under the old triangles.
- **Market barrel:** "i want shape to be more round, stay closer to reference". A rounder barrel with a clear belly bulge, closer to the old barrel and the references.
- **Butterflies, dragonflies, the four crawlers** (the same note on each): "i think they should be small less triangesl in game cuz theyre small but the close up model of the butter flies need to be the before. the after can be even less traiangles, but the zoom in should be the before".
  - In the world, where they're tiny and flying, use an even cheaper version of ours, fewer triangles than round 1.
  - Wherever the game shows one close up, keep the old (before) model: the catch reveal, the collection book, any zoomed view.
  - Find every close-up path and wire it to the old model, and the world path to the cheap one.

**Evidence** for round 2: the barrel, the rocks (in game and in Blender, old next to new), a bug in the world (new cheap) beside its close-up (old), and the fish icons before and after, in `specs/evidence/remodel/round2/`. Same gates; one `perf:check` at the end.

## Round 3 (David's review of round 2, 2026-10-27; https://claude.ai/artifact/5yR9MapBKhCw5SvmpHnoxp)

**Approved:** the market barrel, the gather rocks, the crawlers (cheap in the world, old up close) and the bug close-ups.

**Fish icons:** approved, with a note, verbatim: "make sure the orientation of these fish models are correct". Check every one of the 81 icons, and the 3D fish too, for facing and upright: all facing the same way, belly down, none mirrored or upside down. Fix any that aren't.

**Butterflies and dragonflies:** redo, verbatim: "shape should still replicate the before like gneral overall shape of wings". Keep them cheap in the world, but trace each species' wing outline from the old model: the overall shape, the proportions, the forewing and hindwing lobes, the tails where they have them. Cheap means fewer triangles, not a different silhouette.

**Step 1, ship first:** merge main; put the butterflies and dragonflies back on the old models; fix the fish orientation; run the gates; commit and message the coordinator with that SHA. Then step 2: redo the flyers, and make shots of old and new wings side by side for his review.

## Status

Round 3. Main (635577f6) merged. Head: `git log -1` on game/remodel.
- **Step 1 (ship), done:** the butterflies and dragonflies are back on the dump's in the world (worldModel's REMODELLED drops them; their round 2 GLBs deleted). The fish orientation is fixed in the new world: all 81 baked into the game's frame by `build_fish.py` (head up, back -z, game scale; the trophy arowana's pillar dropped; the counter-shade back to belly), no fish raw in the new world (`fishing.ts`), the leaping fish laid level from it (`AmbientFauna` fishBody), the icons drawn from `levelFish` nose left and back up (ray, dab, olive flounder, mitten crab from above), all 81 re-rendered. Evidence and the cause: `specs/evidence/remodel/round3/notes.md`. The village keeps the dump's raw calibration, which leaves its raw fish (and the 10 sea creatures, both worlds) upside down in the hold, tank and trophy case: a one-sign fix, not made (village unchanged); the icon stage rights raw models itself.
- Approved and shipped in round 2: market barrel, gather rocks, crawlers (cheap in the world, old up close), the bug close-ups.
- **Step 2 (next):** the flyers' world models with each species' old wing outline (`build_critters.py`, being rewritten to trace the old wings).
- Gates at step 1: tsc clean; vitest 3484 passed in both worlds (the one new test fixed after the full run, rerun alone in both); eslint clean on changed files.

## David's decisions

- 2026-10-27 (night), verbatim at the top of this file. Oct 17 (art-direction-oct17.md): "old fruits are way better, it has soul": fruit kept.

## Next

1. Step 2: run `build_critters.py -- debug <json>` to check the traced outlines, then the build; side-by-side shots old and new wings (top view and 3/4) into `specs/evidence/remodel/round3/`; wire the eight flyers back into REMODELLED (`lib/game/world/active.ts`, its test).
2. Not done: the firefly, the village buildings, the arrival boat, the seagull.

## Tools and gotchas

- Fish orientation check: `Blender -b --factory-startup -P art/remodel/fish_orient.py -- x <out> remodel|acnh [names|all] [3]` renders each fish as the tank levels it (nose left, back up when right); `3` adds views from above and below. Judge back and belly by colour, not brightness (the sun lights whatever faces up).
- Icon runner: `/private/tmp/claude-501/remodel-work/r3/icons.sh <keys>` (dev server on 3191, new world, stops it after); run it under the devserver lock. In zsh pass keys through `bash -c '... $(cat keys.txt)'` (zsh doesn't split a variable).

- Census: `PORT=3191 node ../specs/evidence/remodel/tools/census.mjs <all-stats.json> <out.json>` from web/, dev server with `NEXT_PUBLIC_GAME_WORLD=new`.
- Stats: `node ../specs/evidence/remodel/tools/glb-stats.mjs <out.json> <dirs>` (signatures for census and ingame).
- Renders: `Blender -b --factory-startup -P art/remodel/review.py -- <spec.json> <out-dir> [ids]` (spec in the script's docstring; the night's spec is /private/tmp/claude-501/remodel-work/spec.json).
- In-game: `PORT=3191 node ../specs/evidence/remodel/tools/ingame.mjs <stats.json> <out-dir> before|after [ids]`. `?time=10` renders dusk; use `time=day`. Crabs and fish are hard to catch in frame (they move or sit under water).
- Pinterest signed out gives images but no pin links: the README records image URLs and the search page.
- In-game before frames on the current map: put the step-1 wiring back for the run (`git show 11461c48:web/lib/game/world/active.ts`, same for propModels.ts), shoot `before`, `git checkout --` them, shoot `after`. Round 2's cameras: /private/tmp/claude-501/remodel-work/ig2/cams.json.
- Icons: `BASE=http://localhost:3191 node scripts/render-icons.mjs <keys>` from web/ with the dev server in the new world.
- withlock.sh waits for every other lock while swap is over 9 GB: run Blender batches with run_in_background, never under a 10 minute foreground timeout.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/remodel /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
- **Art:** the Pinterest exception above is for this lane only. No asset libraries, generators or imported meshes. Reference images never go in the repo.
