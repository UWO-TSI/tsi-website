# Rod style sheet

The art style of our fishing rods, measured from the five rods in the game (`web/public/assets/game/tools/rod-1.glb` to `rod-5.glb`, built by `art/props-enemies/build_tools.py`, tiers in `web/lib/game/rods.ts`). The image model gets this text with the collage `art/pipeline/out/rods/collage.webp` (step 3 of `art/pipeline/tools.md`). The numbers come from `art/pipeline/out/rods/rod-*.json` (`profile.py`).

## The style, for the image model

Cozy hand-made toy fishing rods for a soft low-poly island game. Each rod is a slim six-sided blank on a chunky tapered grip, with a round disc reel hanging in front just above the hand and a thin pale line running from the reel to the tip. The blank tapers to about half its thickness and bows gently backwards, away from the reel, toward the tip. Two or three narrow accent bands ring the blank. Every colour is flat and matte, like painted wood or lacquered toy plastic: no texture, no grain, no shine, no metal glints, only a soft light from above. Shapes are simple and faceted (6 to 9 sides), with crisp silhouettes that read from far away and no fine detail. Each rod tells one idea through its colours and one signature part (a bamboo stick with knots and line wound on it, a lighthouse lamp at the tip, a scallop shell on the reel). The palette is two or three colours plus a cream line.

**The vibe:** a favourite toy, a summer dock, handmade and friendly, a little chunky, never realistic, never techy.

## Shape and proportions

| | Measured | As proportion |
|---|---|---|
| Length | 1.08 to 1.31 game m (0.83 to 1.01 m in the GLB) | longer with each tier |
| Grip | 0.25 game m long, 0.047 thick (0.19 by 0.037 in the GLB) | 19 to 23% of the length, 1.4 times the blank's butt |
| Hand (the GLB origin) | 0.16 game m above the butt | 12 to 14% up the length, inside the grip |
| Blank | 0.035 thick at the butt, 0.016 at the tip (0.027 and 0.012 in the GLB), 6 sides | butt about 3% of the length, tip under half the butt |
| Bow | the tip sits 0.05 game m behind the butt line | about 4% of the length, away from the reel |
| Reel | a disc 0.082 game m across, 0.04 deep, on a short stem 0.06 in front of the blank | 6 to 7% of the length across, centred 14 to 16% up |
| Bands | 3 rings 1.6 cm tall at 1.25 times the blank; the lighthouse 6 stripes twice that | narrow, evenly spaced up the lower two thirds |
| Line | 3 sides, 0.006 game m thick, 1.5 cm in front of the blank | a hairline |
| Across the whole rod | 0.05 to 0.08 wide, 0.08 to 0.17 deep (game m) | 4 to 7% wide, 8 to 14% deep |

Orientation (the game's convention, `build_tools.py`): the grip at the origin is the right hand's socket, the blank runs up +Z (Blender), the character's front is -Y, the reel hangs toward -Y and the blank bows toward +Y. Game units are GLB metres times 1.3 (`CHARACTER_SCALE`, held items are children of the character, who stands 1.36 game m).

## The five rods

| Tier | Rod | Rarity | Length (game m) | Reel | Signature | Palette | Triangles | Materials |
|---|---|---|---|---|---|---|---|---|
| 1 | Flimsy | common | 1.08 | none (line wound on the stick) | bamboo with three knots | blank #C9B07A, knots #9C8452, grip #8E7350, line #EDE6D4 | 277 | 4 |
| 2 | Cedar | uncommon | 1.16 | wood #B8925A | warm cedar | blank #9A5A3A, bands #6D3B26, grip #C8A27A | 361 | 5 |
| 3 | Glass | rare | 1.21 | pale steel #B9C3C6 | sea-glass teal | blank #8FC7C0, bands #5F9C97, grip #E6DCC6 | 361 | 5 |
| 4 | Lighthouse | rare | 1.30 | gold #C79A3E | red and white stripes, a lamp with a red roof and a gold finial at the tip | blank #E8E1D2, stripes #C9463D, grip #5A4636, lamp #FFB548 | 565 | 5 |
| 5 | Tidewarden | epic | 1.31 | gold #D2A845 with a scallop shell | deep sea teal and gold | blank #2F6E73, bands #D2A845, grip #E9DFC8 | 375 | 5 |

Lines are cream (#EDE6D4 to #F4F1E8). Every material is a flat palette colour, roughness 0.9, no metal, with the shared top-light gradient (`art/characters/kit.py`).

**Rarity ladder (David, the new roster):** common Precision, Training and Flimsy; uncommon Glass and Lighthouse; rare Tidewarden, Riptide and Titanium; epic Tempest. "Models get cooler and more abstract with rarity; epic and legendary barely look like rods and have aura effects." Auras are game effects, never in the model or the concept. However abstract the rod, it keeps the grip at the hand, the length range below and a readable tip, so the hold, the cast and the line still work.

New rods' target lengths: common 1.05 to 1.10 game m, uncommon 1.15 to 1.21, rare 1.25 to 1.31, epic 1.31 to 1.40.

## Budgets

- **Low-poly (the world and the hand):** the Tool category in `specs/perf/budget.md` (`ASSET_CATEGORIES`, `game/tools`): at most 600 triangles, 5 primitives, 5 materials, textures 256 px or less. Our rods use 277 to 565 triangles and no textures. The held rod merges into one mesh (`heldMesh.ts`) and a held tool is already over its draw-cost line in the budget, so keep it to one object, at most 5 materials, flat colour (lane rules: textures only where they show; plain colour reads as its material through `lookClassFor`).
- **High-def (the shop's close-up, item previews, the icon):** sized for one model on screen at a time (design bible, Models, rule 6). The specs give no number; this lane proposes at most 3,000 triangles and 512 px textures, for the coordinator to confirm. It shares the low-poly's silhouette, colours and proportions; the low-poly is reduced from it.
