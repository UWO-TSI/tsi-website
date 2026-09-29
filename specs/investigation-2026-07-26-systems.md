# Systems Investigation — what ACNH, Minecraft and Roblox do that this engine doesn't (2026-07-26)

> David's brief: research how comparable games get (1) a uniform development system,
> (2) simpler computing logic that helps performance, (3) better graphics logic that
> helps both performance and visuals. Then find where this codebase has the same
> class of problem as the terrain.
> Companion doc: `investigation-2026-07-26-foundations.md` (the terrain findings).
> Every number about this repo is measured. External claims are cited.

---

## The one law all three games share

**Pick one spatial quantum, then derive everything else from it.**

| Game | Quantum | Grouping | Levels |
|---|---|---|---|
| ACNH | 1 tile | acre = 16 x 16 tiles; island = 80 x 64 tiles (5 x 4 acres) | 4 elevation levels, cliffs inset 1 tile per layer, inclines 2 x 4 |
| Minecraft | 1 block | chunk section = 16 x 16 x 16 | continuous integer Y |
| Roblox | 4 x 4 x 4 stud voxel, each with occupancy 0..1 + material | streaming regions | continuous via occupancy blend |

The quantum is not a rendering detail. It is the same coordinate system used by
authoring, collision, save format, streaming, culling and networking. Roblox even
keeps the illusion of smooth terrain while staying on a fixed 4-stud grid: occupancy
per cell blends the surface, but the data is still a grid.

**This repo has no quantum.** Measured:

- **606 hardcoded world-coordinate literals** across `components/game/*.tsx`
  (205 in `GameWorld.tsx` alone).
- **17 explicit "keep in sync" / "mirrors" comments** coupling constants that were
  copied between files, including:
  - `terrain.ts:59` BUILDING_FOOTPRINTS must track `BUILDINGS` in GameWorld
  - `terrain.ts:86` RIVER_POLYLINE must track `RIVER_CONTROL_POINTS` in River.tsx
  - `RoadTiles.tsx:34` RECTS must track `PATH_CORRIDORS` in terrain.ts
  - `S7Pockets.tsx:61` PONDS must track flatten slabs in terrain.ts
  - `GameWorld.tsx:1478` the interact sweep must track prop coords

Each of those is a manual join across files, maintained by comment. That is the
uniformity problem stated precisely: there is no single source of spatial truth, so
every system carries its own copy of the world and they drift.

**The fix is the tile grid from the foundations doc.** Once `level[]` and `surface[]`
exist, all 17 couplings collapse into queries against one array, and most of the 606
literals become cell indices. Sizing note: the current island is radius 61u, which at
the measured 1.0u ACNH tile is roughly 122 x 122 cells, about 2.9x the area of a real
ACNH island (80 x 64). Worth deciding deliberately rather than inheriting.

---

## Ask 2: simpler computing logic

### What the reference games do

**Precompute what does not change; per-frame only what does.** Minecraft rebuilds a
chunk mesh only when a block changes, then draws that cached mesh every frame. As
[0fps](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/) puts it, chunk
updates are rare compared to how often they are drawn, so the total cost is dominated
by rendering, not by meshing. The meshing itself is where the wins are: for an
8 x 8 x 8 solid region, naive gives 3,072 quads, culled meshing gives 384 (8x
better), and greedy meshing gives 6 (64x better than culled).

Roblox pushes the same idea into the engine: streaming loads only nearby regions, and
[occlusion culling](https://devforum.roblox.com/t/occlusion-culling-now-live-in-roblox-client/3300953)
skips objects hidden behind other objects with no developer action required.

### What this repo does

| Measure | Value |
|---|---|
| `useFrame` callbacks | **60** across 32 files |
| `useState` in game components | **93** |
| Terrain geometry | one 150 x 150 plane, 217² verts, **not chunked, not cullable** |
| LOD | `three/src/objects/LOD.js` exists in r182, **zero uses** |

Two concrete defects of the same family as the terrain:

**a) React state is on the per-frame path.** `PlayerAvatar.tsx:600` calls
`onMove(pos.clone())` inside `useFrame`, every frame while the player moves. That
lands in `handlePlayerMove` (`GameWorld.tsx:1901`) which calls `setPlayerPos(position)`
and `setNearest(...)`. `playerPos` is passed as a prop to `Building` (7 instances,
each with a drei `<Html>` name pill) and one other child. So walking re-renders the
Scene subtree and every Building at 60fps, plus a `Vector3` allocation per frame.

The codebase already has the right mechanism next to the wrong one: `playerPosRef` is
threaded to most consumers. The `setPlayerPos` call is the leak. Anything that only
needs the position inside `useFrame` should read the ref; React state should update
at most a few times a second, and only for things that genuinely re-render (the
interact prompt text).

**b) Nothing can be culled because nothing is chunked.** The terrain is one geometry,
so the GPU processes all 93k triangles regardless of where the camera looks, and
about 48% of that plane is outside the island radius. Scenery is grouped by GLB URL,
not by location, so an `InstancedGLB` group spanning the whole island is either fully
in or fully out of the frustum. Chunking by acre (16 x 16 cells) makes both cullable
and matches the ACNH authoring unit for free.

**One thing already done right, worth copying elsewhere:** `terrain.ts` bakes a 257²
height grid at module load and bilinear-samples it, replacing ~16 noise samples per
call with 4 array reads. That is exactly the Minecraft instinct. The same instinct
has not been applied to lighting, meshing, or the interact sweep.

---

## Ask 3: better graphics logic

### The measured bottleneck is materials, not geometry

| Measure | Value |
|---|---|
| GLB URLs referenced by components | **108** |
| Primitives they carry | **220** |
| **Distinct materials they carry** | **209** |
| Vertices they carry | 134,817 |
| Inline `<mesh>` / `<points>` / `<sprite>` tags | **377** |
| Total materials across the shipped library | 422 |
| Unique embedded textures | 446 (18.2 MB, only 5.7% redundant) |

134k vertices is nothing; an M1 pushes tens of millions. **The wall is 400 to 500
draw calls with a material state change on each.** Three.js cannot batch across
different materials, so the frame is bound by state changes.

### What the reference games do

**Minecraft: one texture atlas, so an entire chunk section draws in one or two
calls.** All block textures live in a single atlas and each vertex carries an atlas
UV, so geometry with wildly different appearance still shares one material. The
project's own asset textures make this unusually easy here: measured ACNH source
textures are tiny, 32 x 48, 64 x 96, 512 x 128, 512 x 512. Several hundred of them
pack into one or two 2048² atlases.

**Minecraft: lighting is baked into vertex data, not computed per frame.** Light
values are stored per vertex and combined with the texture in the fragment shader,
and smooth lighting is per-vertex ambient occlusion. There are zero realtime shadow
maps in vanilla rendering. That is why it holds framerate on weak hardware.

**ACNH: the shadows ship inside the assets.** This is the most direct finding of the
whole investigation. The source sakura tree
`PltTreeOakSakura/PltTreeOak4Sakura.dae` contains five meshes, and two of them are
**baked shadow geometry**: `LB014__mShadow` (659v) and `PetalL010__mShadowShake`
(394v). Nintendo pre-bakes the contact shadow as a mesh per asset, which is why ACNH
has effectively no dynamic shadow cost.

The extraction pipeline drops exactly those two meshes (the shipped GLB keeps indices
0, 2, 4 of 0-4, and by elimination the survivors are bloom canopy, back layer and
trunk). Then the game adds a 1024² realtime PCF-soft shadow map to replace the effect
it just deleted, at a cost its own code comment puts at **~7 FPS on M1**, and that
shadow map is misaligned anyway because of the `project_vertex` bug in the foundations
doc. The chain is: throw away the free correct thing, pay for an expensive broken
replacement.

**Roblox: engine-level culling and streaming**, cited above, plus a fixed material
set so the renderer can batch.

### What this repo is missing, all available today

| Technique | Status here |
|---|---|
| Texture atlas | none; 446 separate textures, 209 materials in the live scene |
| `THREE.BatchedMesh` (multi-draw, batches different geometries on one material) | ships in the installed three r182, **zero uses** |
| `THREE.LOD` | ships in r182, **zero uses** |
| Compressed textures (KTX2 / Basis) | none; PNG, so uncompressed RGBA8 in VRAM |
| Draco / meshopt geometry compression | none |
| Baked vertex AO / lighting | none; 5 realtime light sources + a shadow map |
| Baked contact shadows | present in the source assets, dropped at extraction |

### The visual argument, not just the perf one

Baked lighting is not a downgrade. It is why Minecraft's caves read as volumes and
why ACNH's props feel planted. Realtime shadow maps at 1024² over a 44u box give
crawling, aliased, misaligned shadows; a baked contact shadow mesh gives a crisp,
stable, artist-controlled result at zero per-frame cost. Restoring the dropped
`mShadow` meshes improves the look **and** removes the 7 FPS shadow map.

---

## Where else the terrain-class mistake appears

The terrain mistake is: *use a continuous general-purpose system where the domain is
discrete and the art assumes it.* Same shape, other places:

1. **River as a spline** instead of tiles. Covered in the foundations doc. The
   45-piece autotile kit is on disk and referenced by zero components.
2. **Interact detection as a linear scan.** `handlePlayerMove` sweeps every NPC,
   building, fishing spot, boat, flower and critter on every move tick. Small today
   (~60 candidates), but it is an O(n) scan over the whole world where a grid bucket
   lookup is O(1). It will become the bottleneck the moment content scales, and the
   tile grid gives the buckets for free.
3. **Scenery grouped by asset instead of by location.** Instancing groups share a
   URL, not a region, so frustum culling cannot help. Grouping by chunk fixes
   culling and draw calls at once.
4. **Ambient systems each running their own `useFrame`.** 60 independent per-frame
   callbacks where a single tick loop over a component array would do, with the added
   benefit that one loop can be frame-budgeted and staggered (update fireflies every
   3rd frame, butterflies every 2nd) without touching each component.
5. **Placement as float literals.** 606 of them. Every one is a decision that cannot
   be validated, versioned, or edited by an admin. Principle #8 in `CLAUDE.md` wants
   monthly content drops without code pushes; that is impossible while the world is
   606 literals across 40 files. A tile map is data, and data can go in Supabase.

---

## What to do, in dependency order

Steps 1-3 from the foundations doc still come first (they are correctness bugs and
they are cheap). Then:

1. **Chunk the world by acre (16 x 16 cells).** Falls out of the tile grid. Unlocks
   frustum culling for terrain and scenery simultaneously.
2. **Restore the baked shadow meshes** in the re-export, then turn the realtime shadow
   map off and compare. Expect the look to improve and ~7 FPS to come back on M1.
3. **Atlas the terrain kit first** (grass, cliff, river, the six road materials). It
   is the highest-frequency material set and the textures are tiny. One atlas plus
   `BatchedMesh` should take the ground plane from hundreds of draws to single digits.
4. **Take React off the per-frame path.** Change `PlayerAvatar.tsx:600` to write the
   ref and only call `onMove` on a throttle (say 10Hz) or on interact-target change.
5. **Consolidate the 60 `useFrame` callbacks** into a small tick registry with
   staggering. Do this after chunking, since chunking changes what needs updating.
6. **KTX2 the textures** once the atlas exists; it is a build-step change at that
   point, not a per-asset one.

Items 1-3 are where the visual and performance wins overlap. Items 4-6 are pure
performance and can wait.

---

## Sources

- [Environmental terrain, Roblox Creator Hub](https://create.roblox.com/docs/building-and-visuals/studio-modeling/terrain) and [Terrain, Roblox Wiki](https://roblox.fandom.com/wiki/Terrain) — 4 x 4 x 4 stud voxels, per-cell occupancy 0..1 plus material
- [Occlusion Culling Now Live in Roblox Client](https://devforum.roblox.com/t/occlusion-culling-now-live-in-roblox-client/3300953) — engine-level occlusion culling, no developer action needed
- [Acre, Nookipedia](https://nookipedia.com/wiki/Acre) and [Island customization, Animal Crossing Wiki](https://animalcrossing.fandom.com/wiki/Island_customization) — 16 x 16 tile acres, 80 x 64 tile island, 4 elevation levels, cliff inset rule, 2 x 4 inclines
- [Meshing in a Minecraft Game, 0fps](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/) — culled vs greedy meshing, 8x and 64x quad reductions, why per-chunk caching wins
- [Chunk rendering in a Minecraft-like engine, Simon Canas](https://canassimon.github.io/blog/programming/2020/07/20/chunk-rendering) — texture atlas indexing, per-vertex luminosity, hidden-face culling
- Kit geometry, texture dimensions, mesh inventories: measured directly from
  `~/Downloads/Assets/Model/` and `public/assets/acnh/` (see foundations doc)
