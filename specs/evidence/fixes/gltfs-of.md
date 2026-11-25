# Shared GLTF parses (fixes lane, fix 3)

`gltfsOf` moved from Character.tsx to `web/lib/game/gltfsOf.ts`; ACNHBuilding (ACNHBuilding, ACNHHouses), ShopDisplays
(MergedItems), InstancedNature (MergedModels) and GridCliffs use it. Production build (entry-perf recipe), `specs/perf/entry-trace.mjs`,
cold cache, one run each (single runs: the milliseconds move a few hundred ms between runs, the parse counts don't).

Callers checked: every one passes the scene through `prepareModel` (clones the tree and the materials) or reads it
(`cliffBlocks` bakes geometry into new meshes, `imageKeys` reads); `disposeModelMaterials` disposes the clones' materials,
never the textures. Nothing changes a shared scene.

| | glTF parses | distinct files | parsed more than once | Play to first island frame | Play to can move |
|---|---|---|---|---|---|
| before, campus | 276 | 264 | 10 (door 4x) | 8306 ms | 8469 ms |
| after, campus | 267 | 263 | 4 | 7775 ms | 7990 ms |
| before, unthrottled | 276 | 264 | 10 (door 4x) | 3742 ms | 3982 ms |
| after, unthrottled | 267 | 263 | 4 | 3643 ms | 3845 ms |

Gone: the door (4x to 1), both house shells, log-bench, plaza-bench, FishCrate. Still twice: Crown,Trunk, acc_glasses_square,
acc_glasses_round and bottom_shorts (character parts the creator's list and a single-url loader both ask for: Character.tsx 650 and 837).
The 9 parses saved are small files (the door is 120 KB): the time gain is within run noise, so the claim is the parse count.
