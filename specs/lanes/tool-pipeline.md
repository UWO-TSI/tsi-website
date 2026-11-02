# Lane: tool-pipeline (new tool versions from our own style)

Worktree `.claude/worktrees/tool-pipeline`, branch `game/tool-pipeline`, cut from origin/main 1ae98ff6. Agent type `uwotsi-lane`. No dev port needed.

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

Round 1 done on `game/tool-pipeline` (the commit "[build] tool-pipeline round 1"), not yet reviewed or merged.
- `art/pipeline/profile.py` (headless: GLBs in, five ortho views as webp and a dimensions JSON out), `collage.py`, `families.sh` (`profile` reruns all four families, then the collages), `blueprint.py` (a turnaround sheet split into cropped views at a set length, silhouettes in `blueprint.json`; `--model` renders the model over them and scores the overlap). Self-tested: rod-3's own renders as a sheet score 0.83 to 0.97, pike's side 0.98.
- Collages: `art/pipeline/out/rods/collage.webp`, `out/fish/collage.webp`, `out/gear/tools/collage.webp`, `out/gear/weapons/collage.webp`, with every view and JSON beside them (JSONs unignored in `.gitignore`).
- Style sheets `rod-style.md`, `fish-style.md`, `gear-style.md`; prompts in `prompts/` (Carrot, Precision, Training, Riptide, Titanium, Tempest; fish and gear templates); `tools.md` with step 4 as Blender from blueprints (Meshy paused) and step 6b (pitch page); CODEMAP row and design bible pointer (Models rule 3).

## Next

1. Coordinator: run the image step with the prompts and collages, publish the pitch page (6b), relay David's picks.
2. Next round: model the picked rods from their sheets (`blueprint.py`, then a modelling script per rod, then the match check, clean.py, budgets, pack-glbs, icon).
3. Open for the coordinator: the high-def budget (the sheets propose at most 3,000 triangles and 512 px textures); the Carrot rod's rarity; whether Cedar stays on the new roster.

## Tools and gotchas

- Blender 5.2 headless; Eevee renders fine with `-b`. Locks: `LANE=game/tool-pipeline /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`.
- Raw fish GLBs (`acnh/fish`) carry a stray material-less icosphere (profile.py skips material-less meshes); Dace and Bluegill are stored nose up (`@x90`). Fish are not to one scale: `--fit`.
- Rod materials are named `rod-N_<Part>`; the Lighthouse's gold is both reel and finial and its red both stripes and lamp roof, so parts are measured on their biggest group along the length (`also` lists the rest).
- `clean.py` re-pivots to the bottom centre; held tools need the grip at the origin (a rod's hand is 0.12 GLB m above the butt).
