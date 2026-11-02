# Making new versions of tools, fish and gear

David, 2026-11-02: "i want you to make a multi angle profile on our basic rod designs and have it create a colloge of the rod dimentions and the vibes and describe the art style of the rod, then i want you to go to elevenlabs connect to gpt image 2.5 and ask for it to produce a rod in the same style ... remember this pipeline for creating versions of tools." Then: "once you rendered the differnt rods i want you to pitch me the different rods and models as a artifact, do this with new fish and new gear as well", and "dont use meshy as for now, just try to replicant the same output through using blender and modeling it from the multi angle designs".

A new rod, fish or gear piece is designed from our own models, never from fetched art: our models are measured and described, an image model draws the new piece in that style as a turnaround, David picks from a pitch, and it is modelled in Blender to the turnaround's views. Families done so far: rods, fish, gear (tools and weapons). All Blender runs are headless under the Blender lock: `LANE=game/<lane> /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>` (exit 75 means retry). Below, `Blender` is `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P`.

## 1. Profile our own models

```
Blender art/pipeline/profile.py -- --out art/pipeline/out/rods --px 800 web/public/assets/game/tools/rod-{1,2,3,4,5}.glb
```

Five orthographic views of each GLB (front from -Y, side from +X, back, top, three-quarter) on a transparent background, one scale for the whole run, and `<name>.json`: the bounding box, the length along the long axis in GLB metres and game units (`--scale`, 1.3 for held items: `CHARACTER_SCALE`), triangles, materials, primitives, textures, a ten-slice thickness profile, and each part (material) with its size and where it sits along the length. `--fit` frames each model on its own (fish, not to one scale). `file.glb@x90` turns a model stored on its side 90 degrees about X first. `art/pipeline/families.sh profile` reruns the current families (rods, eight fish, nine tools, twelve weapons).

## 2. Collage and style sheet

```
art/pipeline/families.sh             # or: python3 art/pipeline/collage.py <out dir> --title ... --labels ... --parts Grip,Reel
```

One sheet per family with the dimensions drawn on and the numbers under each model (`out/rods/collage.webp`, `out/fish/collage.webp`, `out/gear/tools/collage.webp`, `out/gear/weapons/collage.webp`), and the written style for each family: `rod-style.md`, `fish-style.md`, `gear-style.md` (silhouette, proportions, palette, materials, edges, detail, budgets, the vibe). The image model gets the collage and the style text.

## 3. Concept turnaround (the coordinator runs it)

The image model (ElevenLabs' image generation, the GPT image model David named; the connection lives in the coordinator's session) gets the family's collage and the prompt from `art/pipeline/prompts/`: one per planned rod (`rod-carrot.md`, `rod-precision.md`, `rod-training.md`, `rod-riptide.md`, `rod-titanium.md`, `rod-tempest.md`) and a template for a new fish (`fish-template.md`) and a new gear piece (`gear-template.md`), filled from the fish-list and treasure lanes' proposals. Every prompt asks for one row of views on white, orthographic, aligned and at one scale, the piece alone with no text, so the sheet works as blueprints. A sheet with perspective, uneven scale or views touching goes back for another take. Save the sheets in `art/pipeline/concepts/<family>/<name>.png`.

## 4. Model it in Blender from the turnaround

```
Blender art/pipeline/blueprint.py -- --sheet art/pipeline/concepts/rods/carrot.png --length 0.86 --out art/pipeline/out/blueprints/rod-carrot
```

`blueprint.py` splits the sheet into its views, crops each, sets the first view's longest side to `--length` GLB metres (take it from the family's style sheet: a new rod's target length by rarity) and writes the views as images plus `blueprint.json`: metres per pixel and each view's silhouette (left and right edges for 64 slices), which the modelling script reads as lathe and tube profiles. Fish sheets: `--views side,top,three-quarter --turn top=90`.

The lane's own headless Blender script then models the piece to those views (design bible, Models, rule 3: a real modelling script, joined and shaped into one clean mesh, not a stack of primitives), in the family's style and budgets, at the game's scale, pivot and facing. Run `blueprint.py` again with `--model <hd.glb>` for the match check: each view with the model at 50% over it (`<view>-match.png`) and the silhouette overlap in `blueprint.json`. Keep modelling below about 0.8 on front, side and top.

**Meshy (paused, David 2026-11-02).** Meshy multi-image-to-3D from the turnaround's views (`node art/meshy/meshy.mjs image <name> <front.png> <side.png> <back.png> <top.png>`, raw output in the untracked `art/meshy/raw/`, credits in `art/meshy/log.md`) stays documented but is not used until David lifts the pause.

## 5. Finish in Blender

- `Blender art/meshy/clean.py -- --in <model.glb> --hd <hd.glb> --lp <lp.glb> --height <GLB length> --lp-tris <budget>`: one merged mesh, sized textures, the high-def and the low-poly reduced from it. It puts the pivot at the bottom centre; held tools need the grip at the origin (the right hand's socket, Z up, front -Y; a rod's hand is 12 to 14% up from the butt), so the lane's script sets the pivot after it, or builds at the right pivot and skips its re-pivot.
- Budget check against the family's style sheet (`specs/perf/budget.md`, `ASSET_CATEGORIES`): Tool 600 triangles, 5 primitives, 5 materials, 256 px textures; Weapon 1,000, 8, 8, 256.
- Materials mapped to the game's look classes (`web/lib/game/modelMaterials.ts`, `lookClassFor`), flat colour where the lane rules say so.
- `cd web && node scripts/pack-glbs.mjs` after every export into `web/public/`.
- The icon: `BASE=http://localhost:<port> node scripts/render-icons.mjs <key>` under the devserver lock (headless).

## 6. Review

The collage, the turnaround and the model side by side, with an existing piece of the family in the shop and in hand, for David (design bible, Models, rule 4: both versions).

### 6b. Pitch before modelling

Every batch of concepts goes to David as a pitch page before anything is modelled (or sent to Meshy): each concept with its name, rarity, what it's for and its turnaround, beside the family's collage. The coordinator publishes the page. Only the concepts David picks go on to step 4.
