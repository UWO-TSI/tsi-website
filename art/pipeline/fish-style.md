# Fish style sheet

The art style of our fish, measured from eight of the fish models (`web/public/assets/acnh/fish/`) that span the sizes and rarities on the roster (`web/lib/collections/roster.ts`). The image model gets this text with the collage `art/pipeline/out/fish/collage.webp` (step 3 of `art/pipeline/tools.md`). Numbers from `art/pipeline/out/fish/*.json` (`profile.py --fit`: each fish is framed on its own, since the models are not to one scale).

| Fish | Rarity | Real size (roster) | Length : width : height | Triangles | Texture |
|---|---|---|---|---|---|
| Neon Tetra | common | 3 to 4 cm | 1 : 0.27 : 0.55 | 296 | 128 x 64 |
| Dace | common | 10 to 18 cm | 1 : 0.17 : 0.39 | 600 | 256 x 128 |
| Bluegill | uncommon | 12 to 22 cm | 1 : 0.31 : 0.62 | 638 | 256 x 128 |
| Salmon | uncommon | 50 to 80 cm | 1 : 0.26 : 0.36 | 800 | 256 x 128 |
| Pike | rare | 50 to 90 cm | 1 : 0.19 : 0.37 | 800 | 256 x 256 |
| Ray | rare | 100 to 200 cm | 1 : 0.51 : 0.09 | 1,010 | 256 x 128 |
| Golden Trout | epic | 40 to 60 cm | 1 : 0.20 : 0.39 | 700 | 256 x 128 |
| Whale Shark | epic | 400 to 800 cm | 1 : 0.39 : 0.32 | 1,976 | 512 x 512 and 256 x 256 |

Length is nose to tail fin, width side to side, height belly to the top of the dorsal fin, fins included.

## The style, for the image model

Storybook aquarium fish for a cozy island game: each one is clearly its real species, with the true silhouette, fin layout and markings, but simplified and softened, a little chunky, with a slightly large head and a big friendly eye. The body is smooth low-poly with gentle facets you can just see. All the colour lives in one small hand-painted texture: a soft gradient from a darker back to a pale belly, crisp simple markings on top (stripes, spots, bands, a glowing line), no scales drawn one by one, no photo detail. The eye is painted: a dark pupil with a bright ring and a white catch-light. Fins and tails are thin flat fans, lighter or semi-transparent at the edges, with a few painted ribs. Colours are clean and saturated but natural, never neon outlines, never cel-shaded black lines. Rarer fish earn a special colour (gold, glow, deep sea blue) or a striking shape, not more detail.

**The vibe:** a picture-book aquarium, bright and friendly, real fish made toy-soft.

## Build conventions

- One mesh, one material and one texture atlas (eyes included), skinned to a small swim rig (`Armature_a`, `Armature_b`, `Armature_Fin`).
- The models come in two forms. Most are raw (`raw: true` in `web/lib/game/fishCatalog.ts`): nose toward -Y and back up +Z once in Blender, drawn at 0.1 scale and turned by `RAW_TURN_X` in the game. The core ones such as Dace and Bluegill are stored nose up (profiled with `@x90`). A new fish matches the form its row uses.
- The raw files carry a stray material-less icosphere; `profile.py` skips material-less meshes.

## Budgets

`specs/perf/budget.md` has no fish category. The current fish set the line: 300 to 800 triangles for a small or medium fish, up to about 1,000 for a flat or long one and 2,000 for a giant, one material, one texture of 256 x 128 (128 x 64 for the tiny ones, 512 for a giant). A new fish stays inside the range of its size class. A fish is seen up close (the catch, the tank, the museum), so one textured version serves both close and far unless the coordinator asks for two (design bible, Models, rule 2).
