# Props and enemies art spec (original low-poly models in the locked character style)

Owner: one Blender art agent. Style source of truth: the locked v6 character and its parts (`art/characters/`, `kit.py`): smooth-by-angle surfacing with only a few large planes, flat palette materials from `art/characters/palette.json` plus a small prop/enemy palette extension, the exported COLOR_0 top-to-bottom gradient, simple cute shapes (David rejected triangle-skin and uncanny detail). Never source references; design originals in this style. Rows 140, 208, 213, 228–231, 198–199.

## Targets (replace dump placeholders)
- Weapons (hand/back sockets on the v6 rig, rows 140, 31): the four starters `sword-driftwood`, `bow-willow`, `staff-oak`, `tome-spirits`, plus the crafted/higher-tier weapon ids found in `web/lib/game/combat/data.ts`, `web/lib/combat/`, and the crafting outputs (`web/lib/crafting/`). Each ≤ 300 tris, grip origin at the hand socket.
- Enemies (row 228: corrupted wildlife outside, arcane constructs inside, statue boss; no gore, cute-menacing): `shadow-fox`, `thorn-crab`, `mushroom-beast`, `rune-wisp`, `animated-book`, `stone-golem`, the elites (`elder-thorn-crab` and any other elite in the data), boss `guardian-statue`. Built from separate named parts (body, head, legs/claws, glow parts) so the engine can animate them procedurally (bob, lunge, slam, telegraph glow) without a skeleton; include a `telegraph` emissive material slot. Normal enemies ≤ 800 tris, elites ≤ 1200, boss ≤ 2500.
- Props: the HQ crafting workbench, the beach message bottle, and a branch pickup.

## Wiring (minimal code)
Export GLBs under `web/public/assets/game/{weapons,enemies,props}/`, then update only the model paths/scales/yaw in `web/lib/game/combat/data.ts` (`WEAPON_LOOK`, enemy looks) and the crafting prop references. No behaviour changes.

## Evidence
`art/props-enemies/` build scripts (regenerable, headless Blender, reuse `kit.py`), contact sheets `weapons_sheet.png`, `enemies_sheet.png`, `props_sheet.png` (3/4 and front, with the v6 character for scale), and in-engine screenshots under `specs/evidence/props-enemies/` (E- prefix, WebP): ruins encounter with the new enemies, the player holding each starter weapon, the workbench in HQ, the bottle on the beach.
