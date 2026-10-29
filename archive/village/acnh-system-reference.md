# ACNH System Reference — the rules behind the look (2026-07-26)

> David's direction: commit to ACNH grid logic, and research ACNH's systems beyond
> terrain. Everything here is measured from the 12GB rip in `~/Downloads/Assets/Model/`
> or cited. Reference images David supplied: river islets, raw terraform cliffs,
> terraced waterfall garden.
> Companions: `investigation-2026-07-26-foundations.md`, `-systems.md`.

---

## 0. The whole system in one asset

`FldUnit.Nin_NX_NVN/Base_0.dae` is **one quad. 4 vertices. 10.0 x 10.0 raw. Material
`mGrass`.**

That is the entire ACNH ground plane: a grid of 4-vertex quads sharing one material.
No displacement, no noise, no heightfield. Every visual in David's reference images is
built by choosing *which piece* goes in each cell, never by deforming a mesh.

World scale for this project is 0.1, so:

| Constant | Raw | World |
|---|---|---|
| Tile | 10.0 | **1.0u** |
| Elevation step | 15.0 | **1.5u** |
| River water surface | -0.78 | **-0.078u** below its ground level |
| Grass top lip thickness | 0.39 | 0.039u |
| Cliff grass drape down the face | 1.88 | 0.188u |

---

## 1. Terrain: four autotile kits, one shared vocabulary

Naming is `{Kit}{Class}{Variant}_{Rotation}`:

- **Class** 0-8: neighbour configuration
- **Variant** A/B/C: which diagonals are also filled
- **Rotation** 0-3: pre-baked rotated meshes (roads omit these, they rotate trivially)

| Kit | Source | Pieces | Notes |
|---|---|---|---|
| Cliff | `FldUnitCliff` | **44** | 0A(1) 1A(4) 2A(2) 2B(4) 2C(4) 3A(4) 3B(4) 3C(4) 4A(4) 4B(4) 4C(1) 5A(1) 5B(4) 6A(1) 6B(1) 7A(1) |
| River | `FldUnitRiver` | **45** | same classes plus `River8A` |
| Waterfall | `FldUnitFall` | **47** | `Fall1xx`-`Fall4xx` families, water sheet spans exactly one 15-raw step |
| Road | `FldUnitRoadSoil` + 8 more materials | **20 each** | classes 0-8 with A/B/C, no baked rotations |

The rotation counts encode the symmetry group and confirm the scheme: class 0 is an
isolated cell (1 rotation, rotationally symmetric), class 1 is one neighbour (4
rotations), class 2A is two opposite neighbours (2 rotations, a straight run), class
2B is two adjacent neighbours (4 rotations, a corner). This is a symmetry-reduced blob
tileset. **One tiler function drives ground, water and cliffs.**

Road materials available: soil, stone, sand, wood, brick, dark-soil, tile,
fan-pattern, my-design.

### Rules the reference images confirm

- **Cliff corners are rounded, never square.** That is the 2B/2C corner variants doing
  their job. In the raw-terraform image the bare cliffs already show the rounding with
  no decoration on them at all.
- **Each layer insets at least one tile from the layer below** ([Island customization,
  ACNH Wiki](https://animalcrossing.fandom.com/wiki/Island_customization)). This is
  what makes stacked cliffs read as terraces instead of a wall.
- **Up to 4 elevation levels**, top level unusable.
- **Waterfalls appear exactly where a river cell borders a lower level.** They are not
  placed, they are derived. Multi-step drops stack single-step pieces, which is
  visible in the terraced-garden image.
- **The grass lip overhangs the cliff face.** Separate mesh, `mGrassCliffXlu`, drapes
  0.188u down the wall. Rivers get the same treatment via `mGrassRiverXlu`. That soft
  green fringe over a hard edge is the single most recognisable ACNH detail and it is
  free geometry that already ships in every kit piece.

---

## 2. Materials: greyscale albedo plus runtime tint

The shared `FldUnit` material set reveals the whole shading model:

| Suffix | Meaning |
|---|---|
| `_Alb` | albedo |
| `_AlbGry` | **greyscale albedo, tinted at runtime** |
| `_Mix` | packed PBR (occlusion / roughness / metallic) |
| `_Nrm` | normal map |
| `_OP` | opacity mask |
| `_Grd` / `_GrdEdge` | ground texture and its tile-edge variant |
| `Xlu` | translucent overlay layer |
| `Snow` | explicit winter variant |

Two things matter here.

**Seasonal colour is a tint on greyscale, not a second texture set.**
`mGrassCliffXlu_AlbGry`, `mGrassRiverXlu_AlbGry`, `mRiverBed_AlbGry`, `mBeach_AlbGry`
are all greyscale. The season changes a colour uniform. Where the *pattern* changes
rather than the colour, there is an explicit `Snow` variant
(`mGrassSnow_Grd`, `mRiverSnow_Alb`, `mCliffSnow_Alb`, `mRoadBrickSnow_Alb`).

Documented behaviour matches: grass lightens in September, browns through October and
November, snow replaces it in early December and melts February 25, and the *pattern*
swaps for snow ([Grass, Nookipedia](https://nookipedia.com/wiki/Grass);
[Grass, ACNH Wiki](https://animalcrossing.fandom.com/wiki/Grass)). Islands use the
triangle grass pattern, which is clearly visible in David's raw-terraform reference.

**Textures are tiny.** Measured: `mGrass_Grd` 64x96, `mRoadStone_Grd` 32x48,
`mRiver_Alb` 512x128, `mCliff_Alb` 512x512. The whole terrain look runs on a handful
of small textures, which is why it atlases trivially and runs on a Switch.

---

## 3. Placement: everything is an integer footprint

**Buildings are authored to whole tiles.** Measured from the shipped GLBs (raw / 10):

| Asset | Footprint | Documented plot |
|---|---|---|
| `house-chalet` | **5.00 x 4.21** | player home 5 x 4 |
| `shop-market` | 6.65 x 3.60 | Nook's Cranny 7 x 4 (mesh inset inside its plot) |
| `hq-office` | 6.08 x 6.08 | 6 x 6 |
| `oracle-museum` | 6.76 x 3.89 | 7 x 4 |

Plot sizes and gap rules ([Game8](https://game8.co/games/Animal-Crossing-New-Horizons/archives/297396),
[TheGamer](https://www.thegamer.com/animal-crossing-new-horizons-building-plot-size-guide/)):
player home 5x4, villager home 4x4, Nook's Cranny 7x4. **Every building, bridge and
incline requires a 1-tile gap around it.** Trees need 1 tile of clearance from a
building.

**Furniture occupies 1.0x0.5 up to 3x3 tiles, and moves in half-tile increments**
([Furniture, Nookipedia](https://nookipedia.com/wiki/Furniture)).

**Bridges are length-parameterised in tiles.** 8 styles (Bricks, Iron, Japanese, Log,
Red, Stone, Suspension, Wood), each shipping `03`, `04`, `05` lengths plus
`Diagonal025/030/035`. The arched wooden bridge in David's first reference is
`BridgeWood04` or similar, spanning a 4-tile river.

**Inclines are a kit too**: SlopeNatural, SlopeWood, SlopeWoodBlue, SlopeWoodStair,
SlopeBrickStair, SlopeStoneStair, SlopeIronStair, SlopeIronStairBlue. 2x4 tiles, 3 of
the 4 being actual ramp.

So the placement system is: **integer cell + integer level + a footprint in tiles**.
No floats anywhere. That is the uniformity David is asking for, and it is why an ACNH
island never has a floating prop or a seam.

---

## 4. Rendering model: pay nothing at runtime

Four techniques, all of which this project currently pays for and does not receive.

**a) Shadows are baked into the assets as meshes.** `PltTreeOak4Sakura.dae` contains
`LB014__mShadow` (659v) and `PetalL010__mShadowShake` (394v) alongside the canopy and
trunk. Every prop carries its own contact shadow. There is no dynamic shadow cost.

**b) Animation is a separate model, swapped in.** 86 `*Anim` variants exist
(`PltTreeOakAnim`, `PltTreeCedarAnim`, `PltTreePalmAnim`, `PltBushAzaleaAnim`, and so
on). The static model is the default; the animated one is swapped in when something
needs to move. Nothing pays for a skeleton it isn't using.

**c) The horizon is authored, not simulated.** The `FldOut*` family is a ring of
pre-built vista slabs per compass direction: `FldOutECliff`, `FldOutNShip`,
`FldOutMidSea`, `FldOutCenterIsland`, `FldOutNGarden` and dozens more. The distance is
a painted backdrop made of real geometry, placed once.

**d) The camera is constrained**, which is why every asset can be authored for it. The
sakura canopy measures 2.86 wide by 1.67 deep in the source, a flattened fan. That is
only acceptable because Nintendo controls the viewing angle.

---

## 5. Reading David's reference images against the system

| What you see | The mechanism |
|---|---|
| Rounded islet edges in the river | 2B/2C corner autotile variants, not modelling |
| Tan band under the grass on every water edge | the river piece's own wall material, `mRiverBed` / cliff face, revealed by the 0.078u water drop |
| Green fringe hanging over every hard edge | `mGrassCliffXlu` / `mGrassRiverXlu` overlay meshes |
| Yellow triangle path, stone path | custom-design ground layer, a separate tile layer above the terrain, not terrain itself |
| Cliff faces with horizontal strata | `mCliff_Alb` 512x512 plus `_Nrm`, one texture across the whole island |
| Waterfalls at each terrace | derived from river-over-cliff adjacency, one piece per step |
| Props sitting perfectly flat and clustered | integer cells on a flat level, so nothing tilts or floats |
| Bare terraform shot looking clean with zero decoration | the system carries the look; decoration is additive, not corrective |

The last row is the important one. In the raw-terraform image there is nothing on the
ground and it still reads as ACNH. This project's world only reads well once it is
covered in props, which is the tell that the substrate is doing no work.

---

## 6. What to implement

Ordered by leverage. Items 1-3 are the substrate; everything else needs them.

### Tier 1: the grid

1. **`level: Uint8Array` and `surface: Uint8Array` on a 1.0u cell grid.** Height query
   becomes `level[i] * 1.5`. Delete `BUILDING_FOOTPRINTS`, `PATH_CORRIDORS`,
   `RIVER_DEPTH`, the 257² bake, the slab discs.
2. **One autotile function** returning `{class, variant, rotation}` from the 8
   neighbours, shared by cliff, river and road. Lock the class-to-neighbour mapping
   visually in the existing `/lab/item` harness, the same way the road kit was locked.
3. **Chunk by 16x16 cells (one acre).** Merge each chunk's ground quads into one
   geometry per material. This is what makes it cullable and what makes the draw count
   collapse.

### Tier 2: extract what is missing

4. **Extract the cliff kit (44), the fall kit (47) and the full river kit (45)** with
   rotations. Only 12 river pieces are extracted today and they are referenced by zero
   components.
5. **Fix the extractor to fail on mesh-count mismatch**, then re-export the 12 broken
   GLBs, including the baked `mShadow` meshes it is currently dropping.

### Tier 3: adopt the ACNH rules

6. **Integer footprints for buildings.** `house-chalet` is already exactly 5x4. Place
   on cells, enforce the 1-tile gap.
7. **Waterfalls derived, not placed.** Any river cell bordering a lower level emits a
   Fall piece.
8. **Cliff inset rule**: each level must inset 1 tile from the level below. Enforce it
   in the map data so terraces cannot be authored wrong.
9. **Custom-design path as its own tile layer** above terrain, using the road kit's
   `my-design` material. This replaces the current painted-ribbon paths and gives
   admins a real path tool.
10. **Bridges and inclines from the kits**, length chosen by the gap they span.

### Tier 4: the rendering model

11. **Greyscale albedo plus tint for seasons.** Replaces the current vertex-colour
    tinting in `Terrain()`. Ship `Snow` variants for the pattern changes rather than
    tinting green to white.
12. **Turn off the realtime shadow map** once baked shadow meshes are restored.
    Recovers ~7 FPS on M1 by the project's own measurement.
13. **Atlas the terrain material set.** Measured 32x48 to 512x512, so grass, cliff,
    river, sand and the road materials fit in one 2048² sheet. Combine with
    `THREE.BatchedMesh`, which ships in the installed three r182 and is unused.
14. **Static model by default, animated variant swapped in** for wind and shake,
    following the `*Anim` convention.

### Tier 5: decide deliberately

15. **Camera azimuth.** Every ACNH asset is authored for a constrained camera. Free
    360° orbit is why the sakura reads as half an asset. Snapping to 4 or 8 azimuths
    makes 57,000 assets usable as authored.
16. **Island size.** Current radius 61u is roughly 122x122 cells, about 2.9x a real
    ACNH island (80x64). Every cost above scales with this.

---

## Sources

- Kit geometry, piece inventories, material suffixes, building footprints, bridge and
  slope kits: measured from `~/Downloads/Assets/Model/` and `public/assets/acnh/`
- [Island customization, Animal Crossing Wiki](https://animalcrossing.fandom.com/wiki/Island_customization) — 4 elevation levels, 1-tile inset rule, 2x4 inclines
- [Acre, Nookipedia](https://nookipedia.com/wiki/Acre) — 16x16 tile acres, 80x64 island
- [All Building and Plot Sizes, Game8](https://game8.co/games/Animal-Crossing-New-Horizons/archives/297396) and [Building Size Guide, TheGamer](https://www.thegamer.com/animal-crossing-new-horizons-building-plot-size-guide/) — plot sizes, 1-tile gap rule
- [Furniture, Nookipedia](https://nookipedia.com/wiki/Furniture) — 1.0x0.5 to 3x3 footprints, half-tile increments
- [Grass, Nookipedia](https://nookipedia.com/wiki/Grass) and [Grass, ACNH Wiki](https://animalcrossing.fandom.com/wiki/Grass) — triangle pattern, seasonal colour shift, snow replacement Dec to Feb 25
