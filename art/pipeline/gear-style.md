# Gear style sheet

The art style of our other held gear, measured from the peaceful tools (`web/public/assets/game/tools/`: nets, shovels, the pickaxe, the broom, the sushi knife) and a spread of the weapons (`web/public/assets/game/weapons/`). The image model gets this text with `art/pipeline/out/gear/tools/collage.webp` or `art/pipeline/out/gear/weapons/collage.webp` (step 3 of `art/pipeline/tools.md`). Numbers from the JSONs beside them (`profile.py`, one scale per collage, game m = GLB m times 1.3).

## Measured

| Piece | Length (game m) | Across, as % of length | Triangles | Materials | Signature |
|---|---|---|---|---|---|
| Net T1, T3, T5 | 1.03, 1.06, 1.09 | 23 to 39% x 22 to 25% | 300, 348, 396 | 3 to 4 | a round hoop on a pole, a soft cream bag behind; T3 a ribbon, T5 gold wings |
| Shovel T1, T3, T5 | 0.86 | 18% x 7% | 266, 306, 266 | 4 to 5 | a D-grip, a straight shaft, a cupped pointed blade; T3 rivets, T5 gold |
| Pickaxe | 0.64 | 8% x 66% | 336 | 4 | a wrapped handle, a curved double-pointed grey head |
| Broom | 1.02 | 30% x 9% | 198 | 4 | a pole, red bindings, a flat straw fan |
| Sushi knife | 0.37 | 8% x 11% | 80 | 3 | a pale wood handle, a dark collar, a long single-edged blade |
| Sword (iron) | 0.75 | 9% x 38% | 246 | 3 | a leaf blade, a brass cross-guard and pommel |
| Warhammer (rune) | 1.42 | 17% x 37% | 408 | 5 | a long haft, a big block head with a carved rune |
| Tanto (lotus) | 0.50 | 51% x 12% | 972 | 6 | a pair of short blades with pink glow edges |
| Aegis (gilt) | 0.72 | 46% x 33% | 558 | 6 | a sword and a gold-rimmed kite shield |
| Bow (yew) | 0.86 | 8% x 13% | 176 | 4 | a single curved stave, a wrapped grip |
| Rifle T3 | 0.89 | 13% x 27% | 652 | 6 | a wood stock, a dark barrel, a scope |
| Harpoon T5 | 0.78 | 68% x 25% | 742 | 7 | a crossbow-style harpoon with glow and rune accents |
| Living staff T5 | 1.15 | 13% x 10% | 932 | 6 | a branch staff wound with leaves and a flower bud |
| Prism staff T5 | 1.26 | 14% x 13% | 412 | 6 | a gold staff with a purple wrap and a crystal crown |
| Bone tome T3 | 0.26 | 39% x 95% | 423 | 4 | a thick bound book with a glowing trim |
| Seal gloves T3 | 0.13 | 81% x 83% | 604 | 5 | a dark glove with a glowing seal |
| Kunai | 0.28 | 18% x 20% | 100 | 3 | a small diamond blade, a wrapped grip, a ring |

The tools' palettes are in `art/props-enemies/build_tools.py` (net tiers: pole #B9925E to #5A3E78, hoops #7FA36A to gold #D2A845, bags cream #EFE8D6 to #F3EEF6; shovels: shafts #B38A5A to #EADFC8, blades grey #A7ABA8 to gold #E2B547).

## The style, for the image model

Cozy hand-made toy gear for a soft low-poly island game, held in one hand by a small rounded character. Every piece is a few simple, chunky shapes with crisp, readable silhouettes: round poles and handles of 6 to 8 sides, flat blades and heads with bevelled edges, no fine detail. Colours are flat and matte, like painted wood, dyed cloth and soft toy metal: two or three main colours plus one accent, no texture, no grain, no scratches, only a soft light from above. Grey or steel parts stay soft grey, never chrome. Higher tiers keep the same shape and change the colours, add one decorative part (a ribbon, small wings, rivets, gold trim) and, for weapons, a small carved rune or a coloured glow edge painted on as a flat bright colour. Proportions are toy-like: thick handles, heads and blades a little oversized for the shaft.

**The vibe:** a toy-box version of a village's tools and an adventurer's kit: friendly, sturdy, colourful, never gritty or realistic.

## Build conventions

The grip at the origin is the right hand's socket, Blender Z up, the character's front -Y (`build_tools.py`, `build_weapons.py`). Rods and nets run up +Z from the grip with the opening facing front; shovels run down -Z to the blade, the scoop facing front. One merged mesh per piece (`heldMesh.ts`).

## Budgets

`specs/perf/budget.md`, `ASSET_CATEGORIES`:

- **Tool** (`game/tools`): at most 600 triangles, 5 primitives, 5 materials, textures 256 px or less. Today 80 to 396, flat colour.
- **Weapon** (`game/weapons`): at most 1,000 triangles, 8 primitives, 8 materials, textures 256 px or less. Today 100 to 972, flat colour.
- The high-def close-up copy is sized for one model on screen (design bible, Models, rule 6); the rod sheet's proposal (at most 3,000 triangles, 512 px textures) applies here too until the coordinator sets a number.
