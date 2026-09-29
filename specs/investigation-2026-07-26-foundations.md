# Foundations Investigation — why the world reads wrong (2026-07-26)

> David's brief: stop implementing blindly, find the fundamental reasons. Complaints
> in scope: terrain, river flow logic, mountain logic, lighting science, assets,
> cherry blossom half-asset, camera angle, M1 2020 performance.
> Method: read the shipped code, measure the actual ACNH kit geometry out of the
> 12GB dump, compare. Every number below is measured, not estimated.

---

## Verdict

One root cause sits under half the list: **the game was built as a continuous
heightfield with hand-placed decoration, and the art it uses was authored for a
discrete tile-and-level grid.** Every ACNH asset in `public/assets/acnh/` assumes a
1.0u tile, a 1.5u elevation step, and a ground plane at exactly y=0. The terrain
under them is smooth FBM noise capped at 0.6u with a spline river carved to -0.95u.
Nothing can line up, so every sprint adds another paper-over layer (bank ribbons,
rock bands, slab discs, blob shadows), and each one adds a new seam.

The other half is three independent defects: a shader patch that corrupts the shadow
map, an extraction pipeline that silently drops meshes, and a lighting budget where
fill nearly equals key.

---

## 1. Terrain — the fundamental mismatch

### What ACNH actually does (measured from `FldUnitCliff`, `FldUnitRiver`, `FldUnitRoadSoil`)

The kits are autotile sets. Naming is `{Kit}{N}{Variant}_{Rot}`:
- `N` = 0..8, the neighbour-configuration class
- `Variant` = A/B/C, alternates within a class
- `Rot` = 0..3, pre-rotated meshes

Cliff, River and Road all share the identical index scheme. That is the uniform
terrain logic: **one tiler drives ground, water and cliffs.**

Measured constants (raw dump units, world = raw x 0.1):

| Quantity | Raw | World | Source |
|---|---|---|---|
| Tile pitch | 10.0 | **1.0** | `Cliff*`, `River*` bbox exactly 10 x 10 |
| Elevation step | 15.0 | **1.5** | `Cliff0A_0`: top grass at y=0, lower-level grass at y=-15.00 |
| Grass top lip | 0.39 | 0.039 | `GrassT__mGrass` y[-0.39, 0] |
| Cliff grass drape | 1.88 | 0.188 | `GrassOP__mGrassCliffXlu` y[-1.88, 0] |
| River water surface | 0.78 below ground | **-0.078** | `River0A_0`: `Grass__mGrass` y[-0.78, 0], bed starts at -0.78 |
| River bed depth | 11.25 | 1.125 | `RiverAC__mRiver` y[-11.25, -0.78] |
| Waterfall sheet | 14.85 | 1.485 | `Fall100_0` `Water_100__mWaterfall` y[-19.19, -4.34], one step |

Piece inventory sitting in the dump: **44 cliff pieces, 45 river pieces, 47 waterfall
pieces**, plus the shared material set in `FldUnit` (`mGrass_Grd`, `mGrass_GrdEdge`,
`mCliff_Alb/Mix/Nrm`, `mGrassCliffXlu`, `mGrassRiverXlu`, `mRiver`, `mRiverBed`, and
snow variants of all of them).

### What the game does (`components/game/terrain.ts`, `GameWorld.tsx:574`)

- `PlaneGeometry(150, 150, 216, 216)` = **0.694u per vertex**, uniform across the
  whole square, including the ~48% of the plane that lies outside the island radius.
- Height = 4-octave FBM, `NOISE_AMPLITUDE = 0.6`, plus a 0.8 swell on the outskirts.
- `Math.max(h, 0)` at the end: the terrain has **no dips anywhere**. Everything is
  bumps above a flat plane.
- Elevation range of the entire island is roughly 0 to 1.4u. **One ACNH step is 1.5u.**
  The whole world lives inside a single tier, so nothing reads as a level.
- `TEMPLE_RISE.h = 2.3` is not a multiple of 1.5, so even the one intentional
  elevation cannot accept a cliff piece.

### Why this specifically causes what you see

1. **The river cannot be represented.** Channel half-width is 2.2u scaled by
   `riverWidthScale` (0.66x at the narrows), blend 1.3u. At 0.694u vertex spacing
   there are ~4 vertices across a narrow channel and the sample points rarely land on
   the centreline, so `riverInfluence` never reaches 1 in places. The bed is a
   faceted asymmetric trench, not a channel.
2. **Building flatten zones fight the paths.** `baseTerrainHeight` returns on the
   first matching footprint and sets height to `rawNoiseHeight(b.x, b.z)`, which
   ignores path corridors entirely. A building next to a path sits at a different
   height than the path meeting it. The `slab-{i}` circle discs in `Terrain()` exist
   only to hide that seam.
3. **Object placement has no anchor.** Every prop position in the codebase is a
   hand-tuned float pair with a comment explaining which hack it dodges. There is no
   grid to snap to, which is exactly the uniformity problem you described.
4. **Two different height functions disagree.** `sampleTerrainHeightFast` adds the
   bridge arch after the bilinear lookup; `getTerrainHeight` (used for one-shot prop
   placement) does not. Props placed near a bridge sink into it.

### Fix

Replace the heightfield with a tile grid. Not a rewrite of the world, a rewrite of
its substrate:

- `level: Uint8Array` over a 1.0u grid, values 0..3.
- `surface: Uint8Array` per cell: grass / soil / stone / sand / wood / brick / river.
- Height query becomes `level[cell] * 1.5`, an array read. No FBM, no bake, no grid
  interpolation, no separate fast path.
- Render per 16x16 chunk: pick the autotile index from the 8 neighbours, instance the
  right `{N}{Variant}_{Rot}` piece, merge each chunk into one geometry. Chunks are
  frustum-cullable, which the current single 150x150 plane is not.
- Cliff walls fall out for free: any cell whose neighbour is a lower level emits the
  matching `Cliff{N}` piece.
- Object placement becomes `(cellX, cellZ, level)`. Every prop sits flush by
  construction. The slab discs, the flatten zones and the path-corridor system all
  delete.

`RoadTiles.tsx` already proves the pattern works in this codebase. It is the same
tiler, applied to the ground instead of just the paths.

**Bug to fix while you are there:** `RoadTiles.tsx` uses `CELL = 0.89`, but the tile
meshes measure exactly 10.0 raw = 1.0u (`road/4-a.glb` is 9.453 x 0.005 x 10.0; the
9.453 is the soft grass-meeting edge on the X side, and `road/1-a.glb` at 8.906 is
the inset edge variant, which is where 0.89 was probably read from). The road network
steps 11% short of its own tile size, so **every road tile overlaps its neighbour**.
These tiles are 0.0005u thick, so overlapping coplanar pairs z-fight. That is a
visible shimmer on every path.

---

## 2. River flow — three conventions stacked

Three systems each assume a different water depth:

| Layer | Water/ground datum | Source |
|---|---|---|
| ACNH kit (the art) | ground 0.0, water -0.078, bed to -1.125 | measured above |
| `terrain.ts` | channel carved to **-0.95** | `RIVER_DEPTH = -0.95` |
| `River.tsx` | water plane at **-0.32** | `WATER_Y = -0.32` |

The water plane floats 0.63u above the carved floor and sits 0.24u below where the
kit's grass fringe expects it. `RiverBanks.tsx` and `RiverBankWalls.tsx` exist to
paper the gap, which is why the banks read as applied decoration rather than as the
edge of the water.

Two further findings:

- **The river tile kit is extracted and completely unused.** `public/assets/acnh/river/`
  holds 12 GLBs. `grep` across `components/`, `lib/` and `app/` returns **zero
  references**. The river is instead a Catmull-Rom spline with a procedural shader,
  while the correct auto-tiling pieces sit on disk.
- **The flow has no gradient.** `RIVER_DEPTH` is a constant across the whole island,
  so the river is a level channel from coast to coast. Water motion is a scrolling
  texture over flat geometry. ACNH's river descends through waterfall pieces at level
  boundaries, which is what makes flow direction legible without any animation. The
  47-piece `FldUnitFall` kit is not extracted at all.

**Fix:** river becomes a cell type in the tile grid, at the kit's own datum
(ground 0, water -0.078). Where a river cell borders a lower-level river cell, emit
the `Fall` piece. Flow direction becomes a property of the level map instead of a
shader uniform.

---

## 3. Mountain logic

`TEMPLE_RISE = { x: 0, z: 31.8, topR: 6.6, blend: 1.7, h: 2.3 }` is a radial cone:
flat disc on top, smoothstep skirt over 1.7u, with `TempleRise.tsx` drawing a band of
rocks around the skirt to hide that it is a smooth ramp rather than a cliff.

That is the whole mountain system. It cannot accept the cliff kit because:
- `h = 2.3` is not a multiple of the 1.5u step
- the skirt is radial and continuous, the kit is orthogonal and discrete
- the cliff kit is not extracted (`public/assets/acnh/` has no `cliff/` directory)

**Fix:** raise cells to level 2 in a tile-shaped footprint, let the autotiler emit
`Cliff{N}{V}_{R}` on the boundary, and cut a stair notch by dropping a run of cells
back to level 1 then 0. `Cliff0A_0` already ships the grass top, the rock wall and
the `mGrassCliffXlu` drape as separate meshes, so the ACNH grass-over-cliff-lip look
comes for free. Delete the rock band.

---

## 4. Lighting science

### Two defects, one measurable, one structural.

**a) Key and fill are the same size.** At the 10:00 TOD key (`GameWorld.tsx:195`):

| Source | Intensity |
|---|---|
| Key directional (`#FFF7E4`) | 1.40 |
| Ambient (`#CFE2FF`) | 0.35 |
| Hemisphere (`0.2 + sunI * 0.14`) | 0.40 |
| Second fill directional (`#C0D0FF`) | 0.15 |
| Environment IBL (`environmentIntensity`) | 0.40 |
| **Total fill** | **1.30** |

Key:fill is **1.08:1**. An upward-facing surface gets 2.55 lit versus 1.15 shaded,
a **2.2:1 contrast ratio, about 1.1 stops**. On vertical faces N·L drops and the
ratio collapses further. Form cannot read at that ratio: no terminator, no shape,
everything is the same brightness. This is the flatness.

Then `PostFX.tsx` applies `uDesat 0.14` and `uBlackLift (0.05, 0.042, 0.032)` with
`uContrast` at identity, which removes another 14% saturation and lifts the shadows
that were already lifted. The grade is compensating in the same direction as the
problem.

**Fix:** cut total fill to roughly 0.45-0.55 (ambient ~0.12, hemi ~0.15, env ~0.2,
delete the second directional) and keep the key at 1.4. That lands near 4:1, about 2
stops, which is where soft-but-readable lives. Then re-tune the grade against the
new base rather than against the flat one.

**b) The curved-world patch corrupts the shadow map.** `lib/game/curvedWorld.ts`
patches the shared `THREE.ShaderChunk.project_vertex`. In three r182,
`ShaderLib/depth.glsl.js:37` includes `<project_vertex>`, so **the shadow depth pass
is bent too, in the light's view space**. Meanwhile the receiving surface computes
its shadow lookup from `worldpos_vertex`, which uses `transformed` and
`modelMatrix`, so the lookup coordinate is **unbent** (verified: `meshphysical.glsl.js`
includes `project_vertex` at line 44 and `worldpos_vertex` at line 50, and
`worldpos_vertex.glsl.js` reads `vec4 worldPosition = vec4(transformed, 1.0)`).

Caster and receiver disagree. The displacement is `lightViewZ² * 0.0032 +
lightViewX² * 0.0011`, and the sun rig sits 30u out, so casters land several units
off in the shadow map, by an amount that changes quadratically with distance from the
shadow camera centre. Because the rig follows the player, **the error changes as you
walk**, so shadows slide relative to their objects.

**Fix:** guard the chunk patch so it no-ops for the depth and distance materials
(`#ifndef DEPTH_PACKING` style, or swap to bending in world space relative to the
player, which is camera-independent and also fixes the free-orbit warping below).

---

## 5. Assets — the extraction pipeline drops meshes silently

Audited all 266 GLBs under `public/assets/acnh/`. The exporter preserves source mesh
indices in the mesh names, so dropped geometry leaves a gap in the numbering. **12
files have gaps, and they are the most visible assets in the game:**

| File | Kept indices | Meshes dropped |
|---|---|---|
| `buildings/house-chalet.glb` | 0,4,8 / 0,3,4 / 0 | 2 |
| `buildings/house-chalet-red.glb` | 0,4,8 / 0,3,4 / 0 | 2 |
| `buildings/house-chalet-yellow.glb` | 0,4,8 / 0,3,4 / 0 | 2 |
| `buildings/oracle-museum.glb` | 0,1,2,3,4,7 | 2 |
| `buildings/shop-market.glb` | 0,1,2,5,8 / 0,1 | 2 |
| `plants/tree-blossom.glb` | 0,2,4 | 2 |
| `plants/tree-hardwood-a.glb` | 0,2,5 | 3 |
| `plants/tree-hardwood-b.glb` | 0,3,4 | 2 |
| `river/bank-straight.glb` | 1,2,3 | 1 |
| `river/bank-corner.glb` | 1,2,3 | 1 |
| `river/bank-dead.glb` | 1,2,3 | 1 |
| `river/bank-edge.glb` | 1,2,3 | 1 |

The four river bank pieces all dropped **index 0**. Comparing against a complete
sibling (`river/4-a.glb` keeps 0,1,2,3), index 0 is the mesh at y[-0.78, 0.00], which
is `Grass__mGrass`: **the ground surface**. Every bank piece in the game is missing
its own ground plane, which is why the terrain has to fill in behind it and why the
seam never resolves.

That is "the houses" and "the assets" in one line: the buildings and the banks are
incomplete exports, not bad models.

**Fix:** the extractor needs to fail loudly on a mesh-count mismatch instead of
writing a partial file. Re-export the 12, then run the whole library through a
count-check against the source `.dae`.

---

## 6. Cherry blossom — why two fixes did not fix it

Source `PltTreeOakSakura/PltTreeOak4Sakura.dae`: **5 meshes, 5 materials.**

```
LB014__mShadow                    659v
LB015__mTreeOakSakuraBack         160v   <- the back canopy layer
L_L1_1__mTreeOakSakuraBloom      1019v
PetalL010__mShadowShake           394v
TrunkBottom__mTreeOakTrunkSakura  517v
```

Shipped `plants/tree-blossom.glb`: **3 meshes, 3 materials**, at indices 0, 2, 4.
Two layers were dropped at export. Surviving meshes by bbox: the bloom canopy
(x ±1.4, y 0.88-3.22), a thin back layer (164v), and the trunk group (x ±0.69,
y -0.14-2.02).

Second, and this is the part neither previous fix addressed: the canopy is
**2.864 wide by 1.674 deep**, a 1.7:1 flattened fan of cards. That ratio is present
in the source too (1.795 deep), so it is how Nintendo authored it, for a camera whose
angle they control. This game gives the player free 360° azimuth
(`azimuthRotateSpeed={1.0}`, no azimuth limits on `CameraControls`), so you orbit
onto the thin axis and see a card edge.

Wake 2 set `DoubleSide` (fixed backface culling). Wake 4 set `frustumCulled={false}`
(fixed instanced-bounds culling). Both were real bugs and neither is this one. The
geometry is thin and two of its five layers are missing.

**Fix:** re-export with all 5 meshes, then either constrain camera azimuth (see §7)
or cross the canopy cards so the asset survives free orbit. The second option is a
per-asset geometry pass and only worth it for hero props.

---

## 7. Camera angle

Current rig (`GameWorld.tsx:2111`, `:2668`):
- FOV **48**, near 0.1, far 300
- distance clamped 9 to 34
- polar range 0° to 42° above horizontal, default position `[0, 16.5, -21]` = **38°**
- azimuth **unconstrained**, `truckSpeed 0`, `smoothTime 0.18`

Two problems.

**FOV 48 is a wide lens.** The AC diorama read comes from a long lens: low
perspective divergence, near-parallel verticals, the world reading as a model on a
table. At 48° verticals splay toward the screen edges and the world reads large and
warped. Dropping to roughly 28-32° and pushing the camera back to keep the same
subject size will do more for the look than any shader.

**The wide FOV amplifies the curved-world bend.** The bend is
`y -= z²·0.0032 + x²·0.0011` in view space. A wide FOV puts far more of the world at
large view-z and large view-x on screen, so the side term visibly bows straight
things (roads, the river, building edges) near the screen edges. Narrowing the lens
reduces the artefact for free. Bending in world space relative to the player instead
of view space would remove the camera dependence entirely, and it is the same change
that fixes the shadow bug in §4b.

**Free azimuth is the deeper decision.** Every ACNH asset in the library is authored
for a constrained camera. Free 360° orbit will keep surfacing flat backs, missing
back-faces and card-edge canopies across the whole library, forever. Constraining
azimuth to 4 or 8 snap positions is both the ACNH-accurate choice and the one that
makes 57,000 assets usable as authored. This one is your call, not a bug.

---

## 8. Performance on M1 2020

Measured contributors, roughly in cost order:

1. **`dpr={[1, 2]}`** (`GameWorld.tsx:2668`). On a Retina M1 that resolves to 2.0,
   so a 1440x900 window renders 2880x1800 = 5.2 Mpx. That is 4x the fragment work of
   dpr 1. The `pixelated` setting drops to 0.66 but is opt-in and off by default.
2. **Real shadow maps are on.** `shadows="soft"` on the Canvas plus a `castShadow`
   directional with a 1024² map. The sun moves every frame and the rig follows the
   player, so the shadow map re-renders the scene every frame. The comment at
   `:2642` says "shadow maps are gone for good, the old PCF-soft pass cost ~7 FPS on
   M1" but the code still has them, gated behind the setting named `blobShadows`.
   Documentation drift with a 7 FPS price tag.
3. **Bloom is auto-on for most Macs.** `useGraphicsSettings.ts` reads
   `navigator.deviceMemory` and enables bloom at >= 8GB. Safari and Firefox do not
   implement `deviceMemory` at all, so the fallback of 8 applies, and Chrome caps the
   value at 8 regardless of real RAM. In practice the check always says 8 and bloom
   is always on. The file's own comment says bloom cost ~12 FPS.
4. **Draw calls.** 377 `<mesh>`/`<points>`/`<sprite>` tags across the game
   components, plus 108 distinct GLB URLs each carrying its own material. 26
   `InstancedGLB` call sites help, but the scene is well past what a single
   `renderList` sort wants to chew on each frame.
5. **Terrain waste.** 217² = 47k vertices, 93k triangles in one undivided mesh.
   About 48% of it is outside the island radius, and none of it can be frustum-culled
   because it is a single geometry. Chunking (§1) fixes both.
6. **Overlapping road tiles** (§1) double the fragment work on every path and
   z-fight while doing it.

Order of attack for the M1: default `pixelated` on for Apple Silicon, gate bloom
behind an actual FPS probe rather than `deviceMemory`, and decide whether the real
shadow map earns its 7 FPS given that §4b means it is misaligned anyway.

---

## Sequencing

The tile grid is the keystone. It is also the one that unblocks the others, so the
order matters:

1. **Fix the two cheap correctness bugs first** so you are looking at the real world
   while you work: exclude the depth pass from the curved-world patch (§4b), and set
   `CELL = 1.0` in `RoadTiles.tsx` (§1).
2. **Re-export the 12 broken GLBs** and add the count-check to the extractor (§5, §6).
3. **Rebalance the light budget** (§4a). Cheap, immediate, and you need honest
   contrast to judge everything after it.
4. **Extract the cliff, river and waterfall kits** (44 + 45 + 47 pieces) with
   rotations, into `public/assets/acnh/{cliff,river,fall}/`.
5. **Build the tile grid**: level + surface arrays, autotile index, chunked merge.
   Port the existing world layout onto it as a fixed map rather than regenerating.
6. **Move river, cliffs and object placement onto the grid.** Delete
   `RIVER_DEPTH`, `WATER_Y`, `BUILDING_FOOTPRINTS`, `PATH_CORRIDORS`, the slab discs,
   `TempleRise`'s rock band, `RiverBanks`, `RiverBankWalls`.
7. **Camera pass**: narrow the FOV, decide the azimuth question.
8. **Performance pass** against the new chunked scene, since the numbers change
   completely once the terrain is culled and the roads stop overlapping.

Steps 1-3 are a day. Steps 4-6 are the real work and they replace roughly 900 lines
of accumulated workaround with roughly 300 lines of tiler.
