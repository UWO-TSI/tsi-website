# UXUI Design Review v2 — Frontend's AC Visual Implementation

> **Reviewer:** UXUI Agent · **Date:** 2026-04-04
> **Reviewed:** `davidliu/frontend` commits `8be3b15` (AC overhaul) + `014c7c1` (terrain/building fix)
> **Compared against:** `specs/ux-game-world-v2.md`

---

## Summary

**Frontend did excellent work.** The implementation closely follows the v2 spec — correct palette, sphere-canopy trees, river with bridge, flowers, bushes, props, lighting, clouds. The code explicitly references the spec sections in comments. Only minor deviations to flag.

**Severity:** 🟢 Matches spec · 🟡 Minor deviation · 🔴 Major deviation

---

## 1. Color Palette

### 🟢 All hex values match spec exactly
Frontend's `P` object on line ~30 copies every hex from v2 spec Section 3 verbatim. Sky, grass (4 tones), water, dirt, buildings, trees, flowers, props — all correct.

### 🟡 Fog color differs
- **Spec:** Not explicitly defined (said "matching sky color")
- **Built:** `#C8E4D8` (green-tinted fog)
- **Note:** This is actually a nice choice — gives a soft green haze that blends grass and sky. Acceptable.

---

## 2. Camera

### 🟢 FOV, distance, tone mapping all correct
- FOV: `50°` ✅
- Distance: locked at `15` ✅
- Tone mapping: `THREE.ACESFilmicToneMapping` ✅
- Output: `THREE.SRGBColorSpace` ✅
- Antialias: `true` ✅

### 🟡 Polar angle slightly different
- **Spec:** `55-60°` from horizontal (= `minPolarAngle: π/3` to `maxPolarAngle: π/3.6`)
- **Built:** `minPolarAngle: π/3.3`, `maxPolarAngle: π/3`
- **Note:** π/3.3 ≈ 54.5° and π/3 = 60° — very close to spec range. Acceptable, camera angle looks correct.

### 🟢 Azimuth locked, zoom disabled, smooth follow — all match

---

## 3. Terrain

### 🟢 Grass colors correct (4-tone system)
Primary `#7EC850`, secondary `#6BB83E`, highlight `#9ADE6B`, shadow `#5AA033` — all match.

### 🟡 Terrain is flat circle, not rolling hills
- **Spec:** "Gentle rolling hills" with noise-based vertex displacement, 0.5-2.0 unit elevation variation
- **Built:** Flat `circleGeometry` with color patches (darker rings, lighter circles) but no elevation
- **Impact:** The campus looks flat. Spec called for subtle mounds and bumps.
- **Fix:** Add vertex displacement to the terrain mesh using simplex noise. Even small (0.3-0.5 unit) elevation changes would add the organic AC feel. The Oracle Temple hill IS elevated (cylinder at y=1.5), which is good.

### 🟡 Paths are rectangular planes, not feathered
- **Spec:** "Feathered/blended into grass — no hard line. Use vertex color blending or alpha-blended decals"
- **Built:** Sharp-edged `planeGeometry` rectangles with `polygonOffset`
- **Impact:** Paths look like paved rectangles instead of worn dirt trails
- **Fix:** Use alpha-blended path textures or soften edges with gradient materials. Low priority — functional but not AC-authentic.

---

## 4. River & Bridge

### 🟢 River implementation is solid
- Riverbed, bank, water surface — correct layering
- Colors match spec (surface `#5BB8D4`, bed `#A08B65`, edge `#7CCCE5`)
- UV scroll animation for flow — good

### 🟢 Bridge matches spec
- Wooden planks, rope railings, correct colors (`#A07850`, `#C4B090`)
- Posts with rope connecting them — nice detail

### 🟡 River is straight, spec called for "gently curving"
- **Spec:** "Shape: Gently curving, not straight"
- **Built:** Straight `planeGeometry` at z=3
- **Fix:** Use a curved path geometry or multiple angled segments. Low priority for MVP.

### 🟡 Missing: lily pads, sparkle particles
- **Spec:** "Lily pads: 3-5 scattered in wider sections" and "Sparkles: Animated white specular dots"
- **Built:** Not implemented
- **Fix:** Nice-to-have polish items. Add later.

---

## 5. Buildings

### 🟢 ACBuilding component is well-implemented
- Pastel walls, bold roof with overhang, oversized door, arched windows, chimney, flower boxes, awning — all present
- Colors correct: HQ cream/terracotta, Shop mint/teal, Oracle lavender/purple
- Window glass `#B8E4F0` with warm emissive glow — nice touch

### 🟡 All buildings use same generic ACBuilding shape
- **Spec:** Each building has unique proportions and features (Shop has striped awning, Oracle has pagoda roof + columns + stained glass)
- **Built:** Generic box-with-cone-roof template, differentiated only by color and size
- **Impact:** Buildings look same-shaped with different colors. AC buildings each have distinct silhouettes.
- **Fix:** Phase 2 — create custom geometry for Shop (steep roof, market crates), Oracle (layered pagoda roof, pillars, stairs), HQ (wider, grander). Or replace with real GLB models when available.

### 🟢 Roof colors derived from wall color
Good approach — `roofColor = wallColor * 0.55` creates harmonious pairs.

### 🟡 Missing: per-building signs with cute text
- **Spec:** Each building has a named sign ("HQ", "SHOP", "Oracle Temple")
- **Built:** Floating HTML labels only, no physical sign objects
- **Fix:** Low priority — HTML labels serve the purpose.

---

## 6. Trees

### 🟢 Sphere canopy trees — exactly per spec
4 tree types implemented: single sphere, 3-sphere cluster, sapling, cedar/pine layers. All correct.

### 🟢 Tree sway animation
Canopy rotates gently with sine wave — matches spec's "gentle rotation, 0.15 Hz, 2° amplitude"

### 🟢 Correct colors
Trunk `#8B6B4A`, foliage `#4DAF4A`/`#6BC867`/`#3A8838`, pine `#3D7A3D` — all match.

### 🟡 20 trees — spec said 15-20 deciduous + 3-5 pine
- **Built:** 20 trees with type determined by `seed % 4` — roughly equal distribution
- **Spec:** Mostly deciduous with a few cedar/pine on the hill
- **Fix:** Weight the distribution: ~70% deciduous (types 0-1), ~15% sapling (type 2), ~15% cedar (type 3). Place cedars near the Oracle hill.

---

## 7. Bushes, Flowers, Props

### 🟢 Bushes — good implementation
20 bushes, sphere shapes, correct colors. Some with flower accents.

### 🟢 Flowers — 7-color system works
12 clusters, 5 flowers each, rotating through all 7 spec colors. Slight emissive gives them pop.

### 🟢 Props — comprehensive
Benches (4), lampposts (5), fences near HQ, well, log stumps, mushrooms, banners — all from spec Section 9.

### 🟡 Missing props from spec
- Signposts (directional, at path intersections)
- Stepping stones (near river)
- Welcome sign (near spawn)
- Market stall (near shop)
- Butterflies (billboarded sprites)
- **Fix:** Polish items for later.

---

## 8. Lighting

### 🟢 Hemisphere light — great addition
`<hemisphereLight args={["#FFF5E1", P.grassPrimary, 0.55]}` — warm sky + green ground bounce. Not in spec but adds AC warmth.

### 🟡 Fixed midday only — no time-of-day cycle yet
- **Spec:** Dynamic 7-phase time-of-day cycle
- **Built:** Fixed midday lighting
- **Note:** Spec said "start with fixed midday, add cycle later" — this is expected. Frontend followed the guidance correctly.

### 🟢 Shadow setup correct
2048×2048 shadow map, soft shadows via ContactShadows + SoftShadows, green-tinted shadow color `#3A6B3A`.

### 🟢 Clouds
3 cloud groups with varying opacity/speed — adds life to the sky.

---

## 9. Overall Assessment

| Category | Score | Notes |
|----------|-------|-------|
| Color palette | 🟢 10/10 | Every hex matches spec |
| Camera | 🟢 9/10 | Spot on |
| Terrain shape | 🟡 6/10 | Flat instead of rolling hills |
| Paths | 🟡 5/10 | Sharp edges instead of feathered |
| River | 🟢 8/10 | Good, minor curve/polish items |
| Buildings | 🟡 7/10 | Colors right, shapes generic |
| Trees | 🟢 9/10 | Excellent |
| Vegetation | 🟢 9/10 | Comprehensive |
| Props | 🟢 8/10 | Most items present |
| Lighting | 🟢 9/10 | Warm and inviting |

**Overall: 8/10.** Strong AC vibe achieved. Main gaps are terrain elevation and building silhouette variety — both are Phase 2 polish items.

---

## Priority Improvements (for Frontend)

1. **Terrain elevation** — add simplex noise displacement to grass mesh (biggest visual impact)
2. **Building variety** — custom shapes for Shop, Oracle (when time allows or GLBs arrive)
3. **Path softening** — alpha-blend path edges
4. **River curve** — use curved path geometry
5. **Time-of-day** — implement the 7-phase light cycle
6. **Missing props** — signposts, stepping stones, welcome sign, butterflies
