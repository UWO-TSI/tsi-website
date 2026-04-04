# Animal Crossing R3F Implementation Research

> **Owner:** Frontend · **Date:** 2026-03-30
> **Purpose:** Actionable patterns for AC-style game world. Apply when UXUI delivers `ux-game-world-v2.md`.

---

## Critical Insight: AC:NH Uses Smooth Shading, NOT Cel/Toon Shading

The distinctive look comes from **strong ambient fill** (hemisphere light), **warm color temperature**, and **soft shadows** — not from toon materials. `MeshStandardMaterial` with high roughness and zero metalness is closer to the real AC look than `MeshToonMaterial`.

---

## 1. Lighting (Highest Visual Impact)

The lighting setup is the #1 factor in achieving the AC feel.

```tsx
// The key ingredient: HemisphereLight fills shadows with warm color
<hemisphereLight args={['#ffeeb1', '#7ec850', 0.6]} />

// Warm directional sun
<directionalLight
  position={[10, 15, 8]}
  intensity={1.0}
  color="#fff5e6"
  castShadow
  shadow-mapSize={[2048, 2048]}
  shadow-camera-left={-20}
  shadow-camera-right={20}
  shadow-camera-top={20}
  shadow-camera-bottom={-20}
/>

// Ambient fill to prevent pure black shadows
<ambientLight intensity={0.3} color="#e8d5b7" />
```

**Soft shadows** via drei:
```tsx
import { SoftShadows } from '@react-three/drei'
<SoftShadows size={25} samples={16} focus={0.5} />
```

Or for ground ambient occlusion:
```tsx
<ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={20} blur={2} far={4} color="#5c4033" />
```

---

## 2. Camera (Second Most Important)

AC:NH camera is NOT isometric — it's a **perspective camera at a fixed elevated angle** with restricted vertical rotation.

- **FOV: 40-50** (NOT default 75 — narrower feels more "miniature/diorama")
- **Position: `[0, 12, 12]`** relative to player (~45° elevation)
- **Smooth lerp follow** (factor 0.05-0.1, NOT instant)
- **Lock vertical angle** — no free orbit
- Optional: subtle breathing sway via `Math.sin(clock.elapsedTime * 0.5) * 0.05`

---

## 3. Color Palette (from AC:NH analysis)

| Element | Hex | Description |
|---------|-----|-------------|
| Grass (main) | `#7ec850` | Bright spring green |
| Grass (dark) | `#5da33a` | Shadow/accent green |
| Dirt path | `#c4a46c` | Warm sandy brown |
| Sand/beach | `#f0deb0` | Warm cream |
| Water | `#5b9bd5` | Soft blue |
| Water (shallow) | `#7ecad6` | Teal/light cyan |
| Tree trunk | `#8B6914` | Warm wood brown |
| Tree canopy | `#4a8c3f` | Deep green |
| Building wall | `#f5e6cc` | Warm cream/beige |
| Building roof | `#c67b5c` | Terracotta/salmon |
| Building roof alt | `#7eb8c9` | Soft teal |
| Sky | `#87ceeb` | Classic sky blue |
| Sunlight | `#fff5e6` | Warm white |
| Shadow tint | `#5c6b4f` | Muted green-brown |

---

## 4. Terrain

**Flat plane with optional gentle Perlin noise** (amplitude 0.1-0.3 units).

AC:NH curved horizon trick (optional):
```glsl
// Bend ground downward at edges
pos.y -= distFromCenter * distFromCenter * 0.002;
```

Material: `MeshStandardMaterial` with `color="#7ec850"`, `roughness: 0.9`

---

## 5. Trees / Vegetation

**Procedural (no Blender needed):**
- Trunk: `CylinderGeometry(0.08, 0.12, 1, 8)`
- Canopy: `DodecahedronGeometry(0.8, 1)` — gives low-poly rounded AC look
- Material: `MeshStandardMaterial` with `flatShading` for charm, or smooth for softer
- Wind sway: `rotation.z = Math.sin(clock * 0.5 + hash) * 0.03`

**For 20+ trees:** use drei `<Instances>` / `<Instance>` for performance.

---

## 6. Buildings

- Rounded edges (bevel in Blender, or use rounded box geometry)
- Flat pastel colors, NO complex PBR textures
- `MeshStandardMaterial` with `roughness: 0.9, metalness: 0`
- Roof-to-wall ratio: ~40% roof, 60% wall (stubby/wide proportions)

---

## 7. Sky / Atmosphere

**Gradient sky sphere** (more AC-accurate than physically-based):
- Top: `#87ceeb` (sky blue)
- Bottom: `#f0e6d0` (warm cream horizon)

Drei `Cloud` for fluffy clouds:
```tsx
<Cloud segments={40} bounds={[10, 2, 10]} volume={6} color="#ffffff" opacity={0.8} speed={0.1} />
```

Optional soft fog: `<fog args={['#c8e6c9', 30, 80]} />`

---

## 8. Performance Patterns

- **Instance repeated objects** (trees, flowers) via drei `<Instances>`
- **Merge static geometry** with `mergeGeometries()`
- Shadow map: 2048x2048 (sweet spot)
- No LOD needed — fixed camera distance
- All needed drei helpers already installed: SoftShadows, ContactShadows, Sky, Cloud, Instances, Clone

---

## 9. What We Already Have (No New Dependencies)

- `@react-three/drei@10.7.7` — SoftShadows, ContactShadows, Sky, Cloud, Instances, Clone, useGLTF, Environment, Float
- `@react-three/fiber@9.4.2` — Canvas, useFrame, useThree
- `@react-three/rapier@2.2.0` — Physics for player/object collisions
- `three@0.182.0` — All geometry types, materials

**One potential add:** `simplex-noise` for terrain vertex displacement (or inline a small noise function).
