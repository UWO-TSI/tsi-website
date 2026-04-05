# Asset Map — GLB Model Mapping for Game World

> **Owner:** UXUI · **Status:** Reference for Frontend · **Date:** 2026-04-04
> **Source pack:** Kenney Nature Kit (`~/Downloads/kenney_nature-kit.zip`)
> **Destination:** `web/public/assets/nature/`
> **Current state:** 24 GLBs already extracted and wired via `NatureModels.tsx`

---

## 1. Current State — Already Extracted & Wired

Frontend has already replaced primitive geometries with Kenney Nature Kit GLBs. The models are extracted to `web/public/assets/nature/` and loaded via `web/components/game/NatureModels.tsx`.

### 1.1 Trees (NatureTree component)

| GLB File | Used For | Scale Range | Rotation | Notes |
|----------|----------|-------------|----------|-------|
| `tree_default.glb` | General deciduous tree | `1.0–1.6` | Random Y | Round canopy, most common |
| `tree_oak.glb` | Large deciduous tree | `1.0–1.6` | Random Y | Wider canopy, near buildings |
| `tree_detailed.glb` | Feature tree | `1.0–1.6` | Random Y | Most detailed, use sparingly |
| `tree_pineRoundA.glb` | Cedar/pine tree | `1.0–1.6` | Random Y | Place near Oracle Temple hill |

**Selection logic:** `seed % 4` picks model. Scale: `1.0 + (seed % 5) * 0.15`. Rotation: `seed * 137.5° Y`.

**20 tree positions (from GameWorld.tsx TREE_XZ):**

| Index | X | Z | Seed Model | Placement Context |
|-------|---|---|------------|-------------------|
| 0 | -7 | 16 | tree_default | North of river, west |
| 1 | 7 | 16 | tree_oak | North of river, east |
| 2 | -20 | 5 | tree_detailed | Far west, mid campus |
| 3 | 20 | 5 | tree_pineRoundA | Far east, mid campus |
| 4 | -18 | -5 | tree_default | Southwest campus |
| 5 | 18 | -5 | tree_oak | Southeast campus |
| 6 | -5 | -20 | tree_detailed | South spawn area |
| 7 | 5 | -20 | tree_pineRoundA | South spawn area |
| 8 | -24 | 12 | tree_default | Far northwest |
| 9 | 24 | 12 | tree_oak | Far northeast |
| 10 | -10 | 24 | tree_detailed | Near Oracle Temple |
| 11 | 12 | 24 | tree_pineRoundA | Near Oracle Temple |
| 12 | -22 | -14 | tree_default | Far southwest |
| 13 | 22 | -14 | tree_oak | Far southeast |
| 14 | -14 | -16 | tree_detailed | South mid-west |
| 15 | 14 | 16 | tree_pineRoundA | North mid-east |
| 16 | -28 | 0 | tree_default | West boundary |
| 17 | 28 | 6 | tree_oak | East boundary |
| 18 | -8 | 26 | tree_detailed | Oracle Temple surrounds |
| 19 | 8 | 26 | tree_pineRoundA | Oracle Temple surrounds |

### 1.2 Bushes (NatureBush component)

| GLB File | Scale Range | Notes |
|----------|-------------|-------|
| `plant_bush.glb` | `0.7–1.1` | Standard round bush |
| `plant_bushLarge.glb` | `0.7–1.1` | Larger variant |
| `plant_bushSmall.glb` | `0.7–1.1` | Small ground cover |

**Selection logic:** `seed % 3` picks model. Scale: `0.7 + (seed % 3) * 0.2`. Rotation: `seed * 1.3 Y`.

**20 bush positions (from BUSH_XZ):**

| Index | X | Z | Context |
|-------|---|---|---------|
| 0 | -5 | -2 | Near HQ west |
| 1 | 5 | -2 | Near HQ east |
| 2 | -13 | 6 | West campus |
| 3 | 13 | 6 | East campus |
| 4 | -3 | -7 | South of HQ |
| 5 | 3 | -7 | South of HQ |
| 6 | -15 | -3 | West mid |
| 7 | 15 | -3 | East mid |
| 8 | -7 | 12 | North of river |
| 9 | 7 | 12 | North of river |
| 10 | 0 | -17 | South spawn |
| 11 | -18 | 10 | Northwest |
| 12 | 18 | 10 | Northeast |
| 13 | -6 | -14 | Southwest |
| 14 | 6 | -14 | Southeast |
| 15 | -10 | 14 | North west |
| 16 | 10 | 14 | North east |
| 17 | -22 | 3 | Far west |
| 18 | 22 | 3 | Far east |
| 19 | 0 | 9 | Central north |

### 1.3 Flowers (NatureFlowerCluster component)

| GLB File | Scale | Notes |
|----------|-------|-------|
| `flower_redA.glb` | `0.5` | Red roses/tulips |
| `flower_purpleA.glb` | `0.5` | Purple pansies |
| `flower_yellowA.glb` | `0.5` | Yellow mums |
| `flower_redB.glb` | `0.5` | Red variant B |
| `flower_purpleB.glb` | `0.5` | Purple variant B |

**Cluster logic:** Each cluster places 3 flowers in a tight group (0.4 unit spacing), each a different model from the pool. 12 clusters total.

**12 flower cluster positions (from FLOWER_XZ):**

| Index | X | Z |
|-------|---|---|
| 0 | -4 | -3 |
| 1 | 4 | 6 |
| 2 | -7 | 11 |
| 3 | 11 | -4 |
| 4 | -2 | 14 |
| 5 | 6 | -13 |
| 6 | -11 | 5 |
| 7 | 13 | 4 |
| 8 | 2 | 17 |
| 9 | -6 | -11 |
| 10 | 8 | 15 |
| 11 | -14 | -6 |

### 1.4 Fences (NatureFence component)

| GLB File | Scale | Notes |
|----------|-------|-------|
| `fence_simple.glb` | `0.8` | Simple wooden fence segment |
| `fence_planks.glb` | `0.8` | Plank fence segment |

**Selection:** Alternates between simple and planks. 6 segments flanking HQ.

| Index | X | Z | Variant |
|-------|---|---|---------|
| 0 | -5 | -2 | fence_simple |
| 1 | -5 | 0 | fence_planks |
| 2 | -5 | -4 | fence_simple |
| 3 | 5 | -2 | fence_planks |
| 4 | 5 | 0 | fence_simple |
| 5 | 5 | -4 | fence_planks |

### 1.5 Mushrooms (NatureMushroom component)

| GLB File | Scale | Notes |
|----------|-------|-------|
| `mushroom_red.glb` | `0.5` | Red cap mushroom |
| `mushroom_tan.glb` | `0.5` | Brown/tan mushroom |

**Placement:** Under large trees (offset -0.5 from tree position). 5 total.

| Index | X | Z |
|-------|---|---|
| 0 | -7.5 | 15.5 |
| 1 | 7.5 | 15.5 |
| 2 | -20.5 | 4.5 |
| 3 | 20.5 | 4.5 |
| 4 | -5.5 | -19.5 |

### 1.6 Stumps (NatureStump component)

| GLB File | Scale | Notes |
|----------|-------|-------|
| `stump_round.glb` | `0.6` | Round tree stump |

**3 stump positions:**

| X | Z | Context |
|---|---|---------|
| -16 | -10 | Southwest clearing |
| 18 | -16 | Southeast edge |
| -20 | 14 | Northwest forest |

### 1.7 Rocks (NatureRock component — defined but not yet placed in GameWorld)

| GLB File | Scale Range | Notes |
|----------|-------------|-------|
| `rock_smallA.glb` | `0.5–0.8` | Small gray rock |
| `rock_smallB.glb` | `0.5–0.8` | Small rock variant |

**Note:** NatureRock is defined in `NatureModels.tsx` but NOT yet placed in `GameWorld.tsx`. See Section 3 for recommended placements.

---

## 2. Additional GLBs Already Extracted (not yet used)

These models are in `web/public/assets/nature/` but not referenced in any component:

| GLB File | Potential Use |
|----------|--------------|
| `mushroom_redGroup.glb` | Mushroom cluster (3-pack) — use for denser forest areas |
| `plant_bushSmall.glb` | Already in BUSH_MODELS rotation — working |
| `stump_old.glb` | Alternative stump — could add variety |
| `tree_pineRoundB.glb` | Second pine variant — add to TREE_MODELS pool |
| `tree_small.glb` | Sapling — scatter near forest edges |
| `rock_largeA.glb` | Large rock — place near river banks or cliff areas |
| `fence_planks.glb` | Already used — working |
| `fence_simple.glb` | Already used — working |

---

## 3. Recommended Additional Assets to Extract

These models are in the Kenney Nature Kit zip but NOT yet extracted. Frontend should add them.

### 3.1 Priority 1 — Fill Gaps

| GLB to Extract | Use For | Recommended Position(s) | Scale | Notes |
|----------------|---------|------------------------|-------|-------|
| `sign.glb` | Directional signpost | `[0, 0, -13]` (near spawn), `[0, 0, 5]` (path intersection) | `0.7` | Spec called for signposts at path intersections |
| `lily_small.glb` | River lily pads | `[-3, -0.02, 3]`, `[5, -0.02, 3]`, `[-8, -0.02, 3]` | `0.6` | Spec called for 3-5 lily pads in river |
| `lily_large.glb` | Larger lily pad | `[2, -0.02, 3]` | `0.7` | Pair with small lilies |
| `log.glb` | Fallen log | `[-12, 0, -8]`, `[16, 0, 12]` | `0.6` | Natural forest detail |
| `grass.glb` | Grass tuft clusters | Scatter 10-15 in open grass areas | `0.4` | Adds ground-level detail |
| `grass_leafs.glb` | Leafy grass | Near river banks | `0.4` | Transition from grass to water |

### 3.2 Priority 2 — Polish

| GLB to Extract | Use For | Recommended Position(s) | Scale | Notes |
|----------------|---------|------------------------|-------|-------|
| `bridge_wood.glb` | Replace handmade bridge | `[0, 0, 3]` | `1.0` | Could replace the box-geometry bridge |
| `campfire_stones.glb` | Community campfire | `[-2, 0, -10]` (near spawn) | `0.6` | Cozy gathering point, add point light |
| `pot_large.glb` | Decorative planter | Near Shop entrance `[-13, 0, 6]` | `0.5` | Shop decoration |
| `pot_small.glb` | Decorative planter | Near HQ entrance `[-1, 0, -2]` | `0.5` | HQ decoration |
| `statue_column.glb` | Oracle Temple columns | `[-2, 3, 20]`, `[2, 3, 20]` | `0.8` | Flanking Oracle entrance |
| `statue_obelisk.glb` | Oracle Temple marker | `[0, 3, 19]` | `0.6` | At base of Oracle stairs |
| `path_stone.glb` | Stepping stones | Near river `[-4, 0, 2]`, `[-3, 0, 4]` | `0.8` | Spec called for stepping stones near river |
| `fence_gate.glb` | HQ entrance gate | `[0, 0, -7]` | `0.8` | Gate at HQ fence opening |

### 3.3 Priority 3 — Tree Variety

| GLB to Extract | Use For | Scale | Notes |
|----------------|---------|-------|-------|
| `tree_fat.glb` | Thick canopy tree | `1.0` | Good for shade near benches |
| `tree_thin.glb` | Tall slender tree | `1.0` | Pathway lining |
| `tree_tall.glb` | Tall tree | `1.0` | Background/boundary |
| `tree_plateau.glb` | Flat-top tree | `1.0` | Distinctive, near Oracle |
| `tree_pineDefaultA.glb` | Full pine tree | `1.0` | Conifer variety |
| `tree_cone.glb` | Cone-shaped tree | `1.0` | Alternate pine shape |

**Recommendation:** Expand `TREE_MODELS` in `NatureModels.tsx` from 4 to 7-8 models for more variety. Weight distribution: ~50% deciduous (default, oak, fat, detailed), ~30% round canopy (tall, thin, plateau), ~20% conifer (pineRoundA, cone, pineDefault).

---

## 4. Primitive Geometry Still in Use (NOT Kenney models)

These elements still use hand-built THREE.js geometry, NOT GLB models:

| Element | Component | Geometry | Status |
|---------|-----------|----------|--------|
| Buildings (6) | `Building.tsx` ACBuilding | Box + cone roof, custom | Keep — custom AC-style shapes |
| Bridge | `GameWorld.tsx` River | Box planks + cylinder rails | Could replace with `bridge_wood.glb` |
| Benches (4) | `GameWorld.tsx` Props | Box seat + back + legs | Could replace with Kenney model if available |
| Lampposts (5) | `GameWorld.tsx` Props | Cylinder pole + box lantern + point light | Keep — needs light attachment |
| Well (1) | `GameWorld.tsx` Props | Cylinder base + cylinder pole + box roof | Keep — custom detail |
| Banners (2) | `GameWorld.tsx` Props | Cylinder pole + plane flag | Keep — custom with texture |
| Terrain | `GameWorld.tsx` Terrain | PlaneGeometry, vertex-displaced | Keep — custom noise mesh |
| River | `GameWorld.tsx` River | PlaneGeometry, animated verts | Keep — needs animation |

**Priority replacements:** Bridge is the best candidate for a GLB swap (eliminates ~15 box/cylinder primitives). Benches could use a Kenney model too if one exists in another pack.

---

## 5. Complete Directory of Used Asset Paths

Frontend should verify all these paths resolve to files in `web/public/assets/nature/`:

```
/assets/nature/tree_default.glb          ← 20 instances (trees)
/assets/nature/tree_oak.glb              ← 20 instances (trees)
/assets/nature/tree_detailed.glb         ← 20 instances (trees)
/assets/nature/tree_pineRoundA.glb       ← 20 instances (trees)
/assets/nature/plant_bush.glb            ← 20 instances (bushes)
/assets/nature/plant_bushLarge.glb       ← 20 instances (bushes)
/assets/nature/plant_bushSmall.glb       ← 20 instances (bushes)
/assets/nature/flower_redA.glb           ← 12 clusters × 3 flowers
/assets/nature/flower_purpleA.glb        ← 12 clusters × 3 flowers
/assets/nature/flower_yellowA.glb        ← 12 clusters × 3 flowers
/assets/nature/flower_redB.glb           ← 12 clusters × 3 flowers
/assets/nature/flower_purpleB.glb        ← 12 clusters × 3 flowers
/assets/nature/fence_simple.glb          ← 3 instances
/assets/nature/fence_planks.glb          ← 3 instances
/assets/nature/mushroom_red.glb          ← 2-3 instances
/assets/nature/mushroom_tan.glb          ← 2-3 instances
/assets/nature/stump_round.glb           ← 3 instances
/assets/nature/rock_smallA.glb           ← defined, not placed
/assets/nature/rock_smallB.glb           ← defined, not placed
```

---

## 6. Performance Notes

| Metric | Value |
|--------|-------|
| Total GLB instances | ~100 (20 trees + 20 bushes + 36 flowers + 6 fences + 5 mushrooms + 3 stumps + ~10 future) |
| GLB file sizes | 3KB–31KB each (Kenney models are very lightweight) |
| Total asset size | ~300KB for all nature GLBs |
| Instancing | `NatureGLB` uses `scene.clone(true)` — shares geometry/material. Good enough for <100 instances. |
| Optimization | If >200 instances needed later, switch to `<InstancedMesh>` with `useGLTF` shared geometry. |
| Loading | All wrapped in `<Suspense fallback={null}>` — progressive loading, no blocking. |
