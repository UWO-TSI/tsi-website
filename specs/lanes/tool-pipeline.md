# Lane: tool-pipeline (new tool versions from our own style)

Worktree `.claude/worktrees/tool-pipeline`, branch `game/tool-pipeline`, cut from origin/main 1ae98ff6. Agent type `uwotsi-lane`. No dev port needed.

## Round 3: David's rod models review (2026-11-03, verbatim; https://claude.ai/artifact/LFoFkQq2pABPtHPEZS4A7L)

Approved: rm2-carrot, rm2-glass (the cooler sea glass stays rare), rm2-precision, rm2-training. Not marked yet: Tempest, Titanium, Tidewarden, Riptide.
- rm2-cedar (redo): "the leave should grow in a natural looking way, make it look like a cedar tree"

Build: Cedar's foliage grows naturally, like a little cedar tree (layered sprays of flat needle foliage along the upper blank), not leaves stuck on. Same budget. Old and new shots (ids rm3-*). Leave the four epic and rare rods as they are until David marks them.

## Round 2: rod models (David's rod pitch review, 2026-11-02, verbatim; https://claude.ai/artifact/XqZK2hk32ydhYjbKFhhwFJ)

- rod-carrot (approve): "make the carrot thicket, this is uncommon rod"
- rod-precision (approve)
- rod-training (approve): "this is good, but make it like a common thats like easter egg to unlock and not a common rod you can buy, this rod also has very good satts comparable to uncommon rare, one of best starter rods and it has upgrade potential. I want you to also do a fish caught tracker for all rods so yo know how many fish you caught with a certain rod." (the unlock, stats and tracker are the rod-gear lane's, not yours)
- rod-tempest (redo): "not cool"; rod-titanium (redo): "not cool"; rod-riptide (redo): "not cool enough i need you to use "
- rod-next (redo): "i sent you references for tempest and titatium like epic rods are supposed to look epic, these rods are poorly designed and needs to be more exaggerated with effects and get like default idle animatinos"
- rod-ours (redo): "tide warden rod not even epic bruh not cool at all, other rods are wtv, glass rod can be cooler or just make it uncomon, cedar rod should have like leaf elements"

**Read first:** David's rod references and his rarity rule, `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/rod-gear/specs/references/rods/README.md` and the images beside it (untracked, third-party: never copy them into git). The rule: the rarer the rod, the cooler and more abstract; rare is "still chill"; epic is where rods start to look really cool; epic and legendary "almost doesnt look like a rod", with aura effects. Round 1's prompts kept every rod rod-shaped; that's why the epic ones failed.

**Build (Blender, headless; no Meshy; the ElevenLabs credits are spent, so no new concept images: model straight from the sheets and the references, and render your own views as the concepts):**
1. **Approved rods, modelled from their concept sheets** (`/private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/rodgen/sheets/<name>-<n>.png`; David approved without a take number, so pick the cleanest take for blueprints and say which): Carrot (a noticeably thicker carrot), Precision, Training. Files `web/public/assets/game/tools/rod-carrot.glb`, `rod-precision.glb`, `rod-training.glb`, within the tool budget, pivot at the hand, icons rendered.
2. **Existing rods:** Cedar gets leaf elements; Glass: a cooler version (David's alternative is to move it to uncommon as it is: show the cooler one and say so).
3. **Epic redesigns, exaggerated and barely rod-shaped:** Tempest (from `epic-tempest-ref.png`, and `epic-tornado.png` for the aura), Tidewarden (epic, from the rule and the references' level of drama), Titanium (from `epic-titanium-ref.png`), Riptide (rare: cooler than round 1 but "still chill"). Effects: glowing parts, an aura and particles built the way the lantern glow is (`LanternGlow.tsx`, no real lights, a few transparent draws), and a **default idle animation** while held (floating or orbiting parts, a pulse, sparks). Say the cost per holder.
4. **Pitch evidence:** for each rod, five views and a three-quarter hero render, in hand in the game (day and night), and an idle animation strip. Old rod beside new for Cedar, Glass and Tidewarden.

**File names (coordinator, 2026-11-02):** Cedar, Glass and Tidewarden replace `tools/rod-2.glb`, `rod-3.glb`, `rod-5.glb` in place (live with no wiring, no parallel copies); the new rods are `tools/rod-<name>.glb` (carrot, precision, training, tempest, titanium, riptide). A rod's effect is keyed by its GLB's scene extras (`userData.rodFx`), not its URL, so rod-gear can rename freely; the effect's moving parts are `game/props/rodfx-<name>.glb`. This branch merges `game/polish` at 020c16e0 (LanternGlow, `lib/game/glow.ts`), which polish merges to main first.

Data (roster entries, rarity, prices, stats, the Training unlock, the per-rod catch tracker) is the rod-gear lane's: don't edit `rods.ts` or the catalogue. Name your files as above so it can wire them.

## David's call (2026-11-02, verbatim)

"i want you to make a multi angle profile on our basic rod designs and have it create a colloge of the rod dimentions and the vibes and describe the art style of the rod, then i want you to go to elevenlabs connect to gpt image 2.5 and ask for it to produce a rod in the same style but the rod is like carrot rod or like one of our rods weve written down adn have it create a multiangle render of the new rod object then put it in meshy.ai to create a 3d model of the rod. remember this pipeline for creating versions of tools. set this up and start working on this"

## The pipeline (write it up in `art/pipeline/tools.md`; the coordinator saves it as a standing rule)

1. **Profile our own tools:** headless Blender renders of each existing tool GLB from fixed angles (front, side, back, top, three-quarter), on a plain background, orthographic, same scale, with measured dimensions (length, grip, reel, tip, thickness, in game units and as proportions).
2. **Collage and style sheet:** one collage per tool family (rods first) with the dimensions drawn on, plus a written style description: silhouette, proportions, colour palette, materials and texture, edge softness, detail density, triangle and texture budgets, and "the vibe" in a few words. The image model gets the collage and this text.
3. **Concept turnaround:** an image model (ElevenLabs' image generation, the GPT image model David named) makes the new tool in the same style as a multi-angle turnaround sheet (front, side, back, three-quarter, top) on white, same scale. The coordinator runs this step (the ElevenLabs connection lives in the coordinator's session); this lane writes the prompts.
4. **3D:** the turnaround's views go to Meshy multi-image-to-3D (`art/meshy/meshy.mjs image <name> <views...>`), raw output in the untracked `art/meshy/raw/`.
5. **Edits in Blender only:** `art/meshy/clean.py` (scale to the family's measured dimensions, pivot, facing, merge, sized textures, HD and LP), then budget checks, then `cd web && node scripts/pack-glbs.mjs`, then the icon render.
6. **Review:** the collage, the turnaround and the model side by side with an existing rod in the shop and in hand, for David.

## Round 1 (this lane)

1. Write `art/pipeline/profile.py` (headless Blender: any GLB in, the five views and a dimensions JSON out) and `art/pipeline/collage.py` (views plus dimensions into one labelled sheet). Run them on `web/public/assets/game/tools/rod-1.glb` to `rod-5.glb` (Flimsy, Cedar, Glass, Lighthouse, Tidewarden per `web/lib/game/rods.ts`; check the mapping) into `art/pipeline/out/rods/` (our own renders; keep them small, webp).
2. Write `art/pipeline/rod-style.md`: the rod family's art style and vibe, the dimension ranges, and the budgets (from `specs/perf/budget.md` and the design bible's Models rules).
3. Write the image prompts in `art/pipeline/prompts/`: one for a Carrot rod (David's example) and one for each rod on the planned roster that has no model yet (Precision, Training, Riptide, Titanium, Tempest; see `specs/lanes/rod-gear.md` and the coordinator handoff), each asking for a five-view turnaround in our style, white background, no text, the rod alone.
4. Write `art/pipeline/tools.md` (the six steps above, commands included) and add a row to CODEMAP and the design bible's Models rules pointing at it.
5. Report: the collage paths, the style text, the prompts, and anything the image step needs from the coordinator.

## Round 1 additions (coordinator relay, David 2026-11-02 verbatim: "once you rendered the differnt rods i want you to pitch me the different rods and models as a artifact, do this with new fish and new gear as well")

6. The same profile collage and style sheet for fish (6 to 8 of our fish GLBs spanning sizes and rarities) and gear (the other tools, weapons, wearable gear GLBs in web/public): `art/pipeline/fish-style.md`, `art/pipeline/gear-style.md`, collages in `art/pipeline/out/fish/` and `out/gear/`.
7. Prompt templates for a new fish (side, top, three-quarter on white) and a new gear piece (five-view turnaround), each with a slot for the name and a one-line description, for the coordinator to fill from the fish-list and treasure lanes' proposals.
8. `art/pipeline/tools.md` step 6b: every batch of concepts goes to David as a pitch page (name, rarity, what it's for, the turnaround) before anything goes to Meshy.

9. Meshy paused (coordinator relay, David 2026-11-02 verbatim: "dont use meshy as for now, just try to replicant the same output through using blender and modeling it from the multi angle designs"). Step 4 becomes: the picked turnaround's front, side and top views go in as aligned blueprint planes in a headless Blender script, and the tool is modelled to match them in our style and budgets (then clean, HD and LP, pack-glbs, icon). Meshy stays documented as a paused option. `art/pipeline/blueprint.py` loads the views as aligned reference planes and renders the model over them for a match check. The prompts ask for orthographic, aligned views at one scale so they work as blueprints.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`.
- Locks: `LANE=game/tool-pipeline /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`; exit 75 means retry.
- No fetched art: our own GLBs are the only reference. Meshy only once the "Meshy API" keychain item exists, and ask the coordinator before generating. Never print keys.
- Commit `[build]`, never push, never bare `git stash`. No em dashes. Ponytail (`specs/lane-rules.md`).

## Status

Round 3 (Cedar redo) built on `game/tool-pipeline` (head: see `git log`), merged origin/main b56f3c36 first, not yet reviewed or merged. Rounds 2 (866c3dbc, ca59bb39) and 1 (576859f6) are under it.
- Cedar `tools/rod-2.glb` regrown as a little cedar tree (`cedar()` and `whorl()` in `build_rods.py`): seven layers of flat needle sprays up the top half of the blank (z 0.35 to 0.71), 6, 6, 5, 5, 4, 4, 3 sprays from the bottom, reach 0.1 down to 0.022, each layer rising off the trunk then drooping, turned on about the golden angle from the last, each spray a raised midrib with alternating branchlet points and a deep notch to the next; the blank's tip stands out as the leader. One sheet per layer (Leaf double-sided), 8 triangles a spray. Leaf green darkened to #4A7A38; the third band (now under the foliage) and the bands' hidden end caps dropped. 577 triangles, 5 materials (Grip, Blank, Band, Line, Leaf), one mesh, nothing emissive, pivot unchanged. Was 521/5.
- Icon `public/assets/icons/rod_cedar.webp` re-rendered (render-icons.mjs).
- Evidence `specs/evidence/tool-pipeline/rods-r3/`: `rm3-cedar-views` (five views and the hero), `rm3-cedar-old-new` (round 2 left, round 3 right, one scale), `rm3-cedar-hand` (in hand: old day, old night, then new day, new night), `rm3-cedar-hand-close` (the same, 2x on the rod), `rm3-cedar-icon` (old icon, new icon).
- Every other rod untouched (only `cedar` was rebuilt: `-- only cedar`).
- Round 2's rods, effects, perf and evidence: `specs/evidence/tool-pipeline/rods-r2/` and the round 2 commits; the four epic and rare rods (Tempest, Titanium, Tidewarden, Riptide) wait on David's marks.

## Next

1. Coordinator: show David the rm3 Cedar (the evidence above) beside the round 2 one.
2. Tempest, Titanium, Tidewarden, Riptide: wait for David's marks, then a round 4 from them.
3. rod-gear: wire `rod-carrot/precision/training/riptide/tempest/titanium.glb` into the roster (keys `rod_<name>` match the icons), and mount `RodAura` in the shop's RodStage (`<RodAura rod={model} url={rodFxUrl(model)} />`).
4. Open: high-def copies for the rods (none yet: one version each within the Tool budget); the Tempest's links read pale on a light icon background.

## Tools and gotchas

- Blender 5.2 headless; Eevee renders fine with `-b`. Locks: `LANE=game/tool-pipeline /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`.
- Raw fish GLBs (`acnh/fish`) carry a stray material-less icosphere (profile.py skips material-less meshes); Dace and Bluegill are stored nose up (`@x90`). Fish are not to one scale: `--fit`.
- Rod materials are named `rod-N_<Part>`; the Lighthouse's gold is both reel and finial and its red both stripes and lamp roof, so parts are measured on their biggest group along the length (`also` lists the rest).
- `clean.py` re-pivots to the bottom centre; held tools need the grip at the origin (a rod's hand is 0.12 GLB m above the butt).
- `build_rods.py`: a rod is `kit.Piece` faces (`loft`, `leaf`, `flange`, `lathe`, `reel`, `line`), one object per rod; its effect parts are their own objects (`fx_part`, origin at their pivot) with extras that RodAura reads. Blender names repeat as `Aura.001`, so RodAura matches by prefix. A part with two materials is two draws: keep each effect node one material.
- In-game shots: `run.sh`-style wrapper (next dev on 3347, Supabase blanked) under `withlock.sh devserver`, then `HOST=http://localhost:3347 node specs/evidence/tool-pipeline/rods-r2/shoot.mjs <out> name=rod-x.glb@day|night@140,8,0.6[@strip]` with `CLIP=420,240,440,480`; about 20 s a shot after the first. Camera zoom bottoms out at 0.6, so crop. Any rod is held by answering `rod-1.glb` (the Flimsy, everyone's starter) with it; the bench does the same with `HELD_ROD=<file>` (perf-bench.mjs).
- `blueprint.py` has a `left` view (from -X) now.
- In-hand camera: yaw 140, pitch 8, zoom 0.6 shows the rod over the shoulder from the front; yaw 60 and 250 are back views (useless for rods). Crop the 440x480 clip at 200x200+90+150 for a close look at the rod.
- With swap over 9 GB, withlock waits for every other lock: a Blender run can sit 20 minutes behind another lane's devserver and exit 75. Run it in the background and wait on an exit file.
