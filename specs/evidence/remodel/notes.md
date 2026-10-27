# Remodel before and after (2026-10-27 night)

Each `<name>-before.webp` / `<name>-after.webp`: the game's own frame where the model stands in the new world (left, when
there is one), then the Blender views of the old model and ours under the same camera and light. Built from primitives
in `art/remodel/build_*.py`; references in `specs/references/remodel-2026-10-27/README.md`. In the game only with
`NEXT_PUBLIC_GAME_WORLD=new` where the village shares the model (`worldModel`); the village keeps the dump's.

| Name | Note | Triangles before -> after |
|---|---|---|
| market-barrel | The market's ten barrels: warm staves in tones, dark hoops, a planked lid and a bung, no texture. | 1196 -> 616 |
| market-cart | The market's four carts: the old countdown stall drew only a third of itself (two of four meshes empty); ours fills the footprint its blocker already covered: two big wheels, a planked bed, fish on ice and fruit, a striped awning. | 1506 -> about 1470 |
| lighthouse | Cream with coral bands instead of flat red, a stone footing and steps, a timber door, a gallery rail, warm lantern glass. | 4735 -> 2260 |
| butterflies | Six species, one shared 256 x 128 wing atlas: soft round body, big polar wings with a few bold marks per species (in-game: too small and quick to frame). | 770 to 824 -> 350 each |
| dragonflies | Darner and red: big eyes, a banded tail, pale wings with a dark tip mark. | 778 and 360 -> 287 each |
| crabs | The swimming crab (soft carapace, big blue claws with orange tips) and the hermit crab (a striped cone shell, a red crab with one big claw). | 926 and 802 -> 924 and 796 |
| gather-rocks | The five rocks a player strikes: the new world's organic stone, cooler grey, a touch of moss. | 214, 198, 146 -> 128, 152, 100 |
| rope-fence | The monument's rope lengths: two timber posts and a thick sagging rope instead of metal stanchions. | 696 -> 414 |
| fish, fish-close | All 81 species kept (shape, size, id, pattern), tweaked: smooth-shaded, the scale normal map dropped, the texture softened and warmed, one back-to-belly shade on every fish. | unchanged (same mesh), one texture fewer each |
| crawlers | Ladybug, cicada, grasshopper, mantis: soft bodies, wings closed (the old ones spread them), the grasshopper standing on the ground (the old one hung below its origin). | 504, 732, 608, 1006 -> 496, 340, 364, 392 |
