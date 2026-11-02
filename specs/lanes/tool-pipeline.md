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

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`.
- Locks: `LANE=game/tool-pipeline /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`; exit 75 means retry.
- No fetched art: our own GLBs are the only reference. Meshy only once the "Meshy API" keychain item exists, and ask the coordinator before generating. Never print keys.
- Commit `[build]`, never push, never bare `git stash`. No em dashes. Ponytail (`specs/lane-rules.md`).

## Status

Not started.
