# UX Spec — Game World v2: Animal Crossing Visual Guide

> **Owner:** UXUI · **Status:** URGENT — Frontend blocked on this · **Date:** 2026-03-30
> **Replaces:** `specs/ux-game-world.md` (PS1 aesthetic — DEPRECATED)
> **Art direction:** Animal Crossing: New Horizons. Cozy, bright, colorful, inviting.
> **PS1 shader is REMOVED.** Full resolution, antialiased, clean rendering.

---

## 1. Overall Mood & Feel

**Target:** Walking around your island in AC: New Horizons on a sunny morning. Everything is soft, rounded, pastel, and inviting. The campus should feel like a place you WANT to hang out in.

**Keywords:** Cozy, cheerful, warm, playful, lived-in, welcoming, lush, gentle.

**NOT this:** Dark, gritty, pixelated, retro, sterile, empty, angular, industrial.

**Reference games (in priority order):**
1. **Animal Crossing: New Horizons** — primary reference for everything
2. **Animal Crossing: New Leaf** — building proportions, village layout
3. **Cozy Grove** — warm lighting, hand-painted feel
4. **Spiritfarer** — color palette warmth
5. **A Short Hike** — soft low-poly nature, gentle terrain

---

## 2. Camera

AC: New Horizons uses a slightly elevated perspective camera that follows the player. NOT true isometric — it's more like a tilted overhead view with perspective foreshortening.

| Property | Value |
|----------|-------|
| Type | Perspective |
| FOV | `50°` (wider than PS1 spec's 35° — more open, airy feel) |
| Polar angle | `55–60°` from horizontal (looking down at ~30-35° from vertical) |
| Distance | `~15` units from player (closer than before — more intimate) |
| Azimuth | **Locked** — camera does not rotate. Player always faces "toward camera" when walking down. This matches AC exactly. |
| Follow | Smooth follow with `THREE.MathUtils.damp()`, lerp factor `0.08` (gentle, not snappy) |
| Zoom | Disabled for MVP |
| Near/Far clip | `0.1` / `150` |
| Tonepping | `THREE.ACESFilmicToneMapping` — gives that soft cinematic warmth |
| Output encoding | `THREE.sRGBEncoding` |

**NO post-processing filters.** No pixelation, no dithering, no color quantization. Clean native resolution with antialiasing enabled (`antialias: true` on Canvas).

---

## 3. Color Palette — Definitive Hex Values

### 3.1 Sky

| Element | Hex | Description |
|---------|-----|-------------|
| Sky top | `#87CEEB` | Soft sky blue (AC daytime) |
| Sky bottom | `#B8E4F0` | Lighter horizon blue |
| Sunset sky top | `#FF9966` | Warm orange (golden hour) |
| Sunset sky bottom | `#FFD4A8` | Pale peach horizon |
| Night sky top | `#1A1A40` | Deep navy |
| Night sky bottom | `#2D2D6B` | Purple-navy |

Implementation: `<Sky>` from drei or gradient background plane.

### 3.2 Grass & Terrain

| Element | Hex | Description |
|---------|-----|-------------|
| Grass primary | `#7EC850` | Bright AC green (main ground color) |
| Grass secondary | `#6BB83E` | Slightly darker green (for variation patches) |
| Grass highlight | `#9ADE6B` | Lighter green (sunlit areas, hill tops) |
| Grass shadow | `#5AA033` | Darker green (shadows, under trees) |
| Dirt path | `#C4A265` | Warm sandy brown |
| Dirt path edge | `#B39355` | Slightly darker path edge |
| Stone path | `#B8B0A0` | Warm gray cobblestone |
| Cliff face | `#8B7355` | Brown-gray cliff edge |
| Beach/sand | `#F5DEB3` | Warm wheat (if beach area exists) |

### 3.3 Water

| Element | Hex | Description |
|---------|-----|-------------|
| River surface | `#5BB8D4` | Bright teal-blue (AC river color) |
| River deep | `#3A8FB0` | Deeper blue (center of river) |
| River edge | `#7CCCE5` | Lighter edge where water meets grass |
| River sparkle | `#FFFFFF` | White specular highlights (animated) |
| Pond surface | `#6DC4D8` | Slightly greener than river |

### 3.4 Buildings

| Element | Hex | Description |
|---------|-----|-------------|
| HQ walls | `#FFF5E1` | Warm cream/ivory |
| HQ roof | `#E87B5A` | Terracotta orange-red |
| HQ door | `#8B5E3C` | Warm wood brown |
| Shop walls | `#D4EAD4` | Soft mint green |
| Shop roof | `#5BA086` | Darker teal-green |
| Shop awning | `#FFD166` | Golden yellow (matches brand) |
| Oracle walls | `#E8DCF0` | Soft lavender |
| Oracle roof | `#7B5EA7` | Deep purple |
| Oracle accents | `#FFD166` | Gold trim |
| Window glass | `#B8E4F0` | Light sky blue (reflective) |
| Window frame | `#FFFFFF` | White trim |
| Chimney | `#C4A265` | Sandy brick |
| Door frame | `#6B4226` | Dark wood |

### 3.5 Trees & Foliage

| Element | Hex | Description |
|---------|-----|-------------|
| Tree trunk | `#8B6B4A` | Warm medium brown |
| Tree bark detail | `#6B5238` | Darker brown lines |
| Deciduous foliage | `#4DAF4A` | Rich green (round canopy) |
| Deciduous highlight | `#6BC867` | Light green (sun-facing side) |
| Deciduous shadow | `#3A8838` | Dark green (shadow side) |
| Pine/cedar foliage | `#3D7A3D` | Deeper green |
| Bush | `#5CB85C` | Medium bright green |
| Bush flower accent | `#FF6B8A` | Pink blooms on some bushes |

### 3.6 Flowers (scatter randomly in grass)

| Color | Hex | AC equivalent |
|-------|-----|---------------|
| Red | `#E85050` | Red roses/tulips |
| Pink | `#FF8CB0` | Pink cosmos |
| Yellow | `#FFD166` | Yellow mums |
| White | `#F5F5F5` | White lilies |
| Blue | `#6BA3D6` | Blue hyacinths |
| Purple | `#9B6BB0` | Purple pansies |
| Orange | `#FF9944` | Orange tulips |

### 3.7 Props & Details

| Element | Hex | Description |
|---------|-----|-------------|
| Wooden fence | `#B8935A` | Light warm wood |
| Stone fence | `#A8A090` | Warm gray |
| Signpost wood | `#8B6B4A` | Same as tree trunk |
| Signpost text bg | `#FFF5E1` | Cream |
| Lamp post | `#3D3D3D` | Dark iron |
| Lamp glow | `#FFE4B0` | Warm yellow-white |
| Bridge wood | `#A07850` | Medium brown |
| Bridge rope | `#C4B090` | Tan/hemp |
| Well stone | `#9B9080` | Warm gray |
| Bench wood | `#B8935A` | Light wood |

---

## 4. Terrain

### 4.1 Shape — Gentle Rolling Hills

The terrain is NOT flat. It has subtle elevation changes like AC: New Horizons.

| Property | Value |
|----------|-------|
| Base elevation | `0` (river level) |
| Main campus | `0.5–2.0` units above base (gentle mounds) |
| Oracle Temple hill | `3.0–4.0` units (elevated cliff area, accessed by ramp/stairs) |
| Hill smoothness | Very smooth, rounded — use noise-based displacement or sculpted mesh |
| Grass rendering | Vertex-colored mesh with 3-4 green tones blended based on height/noise |
| No hard edges | Everything is smooth and organic — no grid seams visible |

### 4.2 Paths

| Property | Value |
|----------|-------|
| Main paths | Dirt (`#C4A265`) with soft edges — NOT sharp rectangles |
| Path width | `~2.5` units |
| Path edges | Feathered/blended into grass — no hard line. Use vertex color blending or alpha-blended decals |
| Stone paths | Near buildings only — `#B8B0A0` cobblestone, slightly raised |
| Stepping stones | Scattered near the river, random placement, `#B8B0A0` |

### 4.3 Grass Details

| Property | Value |
|----------|-------|
| Base | Vertex-colored terrain mesh (no repeating texture) |
| Color variation | Perlin noise-driven blend between primary/secondary/highlight/shadow greens |
| Flowers | Scattered flower clusters (3-5 flowers in a group) in 7 colors, random placement |
| Weeds/grass tufts | Small geometry clusters at random, slight sway animation |
| Clovers/dandelions | Occasional white/yellow small details |

---

## 5. Stream / River

A small stream winds through the campus with a wooden bridge crossing.

```
Map layout (top-down):

         [Oracle Temple] (elevated)
              |  stairs/ramp
              |
  [Shop] ----+---- [Bounty Board]
              |
     ~~~~~ RIVER (flows east) ~~~~~
     ===== BRIDGE =====
              |
         [=== HQ ===]
              |
  [Job Board]-+---- [Leaderboard]
              |
         [Spawn Point]
```

### 5.1 River Properties

| Property | Value |
|----------|-------|
| Width | `~3` units |
| Depth visual | Shallow — see-through to riverbed |
| Flow direction | West to east (animated UV scroll) |
| Shape | Gently curving, not straight |
| Banks | Rounded, grass overhangs slightly |
| Riverbed | `#A08B65` (dark sandy) visible through water |
| Water surface | Semi-transparent, animated ripples |
| Sparkles | Animated white specular dots on surface |
| Lily pads | 3-5 scattered in wider sections (optional) |

### 5.2 Bridge

| Property | Value |
|----------|-------|
| Style | Wooden plank bridge with rope railings (AC style) |
| Width | `~3` units (same as path width) |
| Material | `#A07850` wood planks, `#C4B090` rope |
| Player can walk across | Yes — bridge is part of the walkable surface |

---

## 6. Buildings — Full AC Cartoon Style

All buildings have: rounded corners, pastel walls, oversized doors (~40% of wall height), small round/arched windows, bold-colored roofs, decorative details (chimneys, awnings, flower boxes, signs).

### 6.1 HQ (Resident Services / Town Hall equivalent)

The biggest building — central to the campus.

| Property | Value |
|----------|-------|
| Walls | `#FFF5E1` warm cream, slightly rounded corners |
| Roof | `#E87B5A` terracotta, gentle slope with overhang |
| Door | Oversized double doors, `#8B5E3C` wood, arched top |
| Windows | 4 small arched windows, `#B8E4F0` glass, `#FFFFFF` frames |
| Chimney | `#C4A265` brick, right side, small puff of smoke (particle) |
| Sign | "HQ" in cute rounded font on wooden sign above door |
| Flower boxes | Under 2 windows, pink + yellow flowers |
| Doormat | Small welcome mat |
| Scale | Largest building — ~6×5×4 units (w×d×h) |
| Light | Warm glow from windows at evening/night (`#FFE4B0`) |

### 6.2 Shop (Nook's Cranny equivalent)

| Property | Value |
|----------|-------|
| Walls | `#D4EAD4` soft mint green |
| Roof | `#5BA086` darker teal-green, steep slope |
| Awning | `#FFD166` golden yellow striped awning over entrance |
| Door | `#8B5E3C` wood, oversized, bell above door |
| Windows | 2 large display windows showing "items" inside |
| Sign | "SHOP" on wooden hanging sign with coin icon |
| Crates/barrels | Stacked outside near entrance |
| Scale | Medium — ~4×4×3.5 units |
| Vibe | Like a cozy general store |

### 6.3 Oracle Temple (Museum equivalent)

Elevated on the hill area. The most impressive building.

| Property | Value |
|----------|-------|
| Walls | `#E8DCF0` soft lavender |
| Roof | `#7B5EA7` deep purple, pagoda-style layered roofline |
| Door | Grand arched entrance, `#6B4226` dark wood with `#FFD166` gold trim |
| Columns | 2 small decorative pillars flanking the entrance |
| Windows | Round stained-glass-style windows, multiple colors |
| Roof ornament | Gold star or crystal on peak (`#FFD166`) |
| Stairs | Stone stairs leading up from campus level |
| Lanterns | 2 standing lanterns at entrance, warm glow |
| Scale | Large — ~5×5×5 units (taller due to elevation + roof) |
| Vibe | Mystical but approachable — more Celeste's temple than dark dungeon |

### 6.4 Bounty Board (Outdoor Object)

| Property | Value |
|----------|-------|
| Type | Standing wooden bulletin board |
| Frame | `#8B6B4A` wood frame, angled slightly |
| Board | `#C4A265` cork/wood backing |
| Pinned items | Colorful paper notes pinned at angles (visual only) |
| Height | Player-height (~1.5 units) |
| Sign | "BOUNTIES" on a small plaque at top |

### 6.5 Job Board (Outdoor Object)

| Property | Value |
|----------|-------|
| Same as Bounty Board but different sign: "JOBS" |
| Different pinned paper colors (blues/greens vs bounty's reds/yellows) |

### 6.6 Leaderboard (Outdoor Object)

| Property | Value |
|----------|-------|
| Type | Stone trophy pedestal / monument |
| Base | `#9B9080` warm gray stone |
| Trophy | Gold cup on top (`#FFD166`) |
| Plaques | 3 name plaques on the front face (gold, silver, bronze) |
| Height | ~2 units tall |

---

## 7. Trees & Vegetation

### 7.1 Trees — Round and Lush (NOT pointy cones)

AC trees have perfectly round, fluffy canopies. Like green cotton balls on sticks.

| Type | Trunk | Canopy Shape | Canopy Color | Height | Count |
|------|-------|-------------|-------------|--------|-------|
| Deciduous (main) | `#8B6B4A`, cylinder | Sphere / 3-sphere cluster | `#4DAF4A` with `#6BC867` highlights | 3-4 units | 15-20 scattered |
| Fruit tree | Same trunk | Slightly smaller sphere | `#4DAF4A` with colored dots (fruit) | 2.5-3 units | 5-8 |
| Cedar/Pine | `#6B5238`, tapered | Layered cone (but rounded layers) | `#3D7A3D` darker green | 4-5 units | 3-5 on hill |
| Small tree/sapling | Thin trunk | Small sphere | `#6BC867` lighter | 1.5-2 units | 5-8 |

### 7.2 Bushes

| Property | Value |
|----------|-------|
| Shape | Rounded blobs, half-sphere or squished sphere |
| Color | `#5CB85C` base, some with `#FF6B8A` flower accents |
| Size | `0.5–0.8` units tall, `0.8–1.2` wide |
| Placement | Along paths, near buildings, in clusters |
| Count | 20-30 scattered |

### 7.3 Flowers

| Property | Value |
|----------|-------|
| Shape | Simple 2-3 petal geometry or billboarded sprites |
| Colors | 7 colors from palette (red, pink, yellow, white, blue, purple, orange) |
| Grouping | Clusters of 3-5 same-color flowers |
| Size | `0.2–0.3` units |
| Placement | Random in grass, along path edges, near buildings |
| Animation | Subtle sway (vertex displacement, slow sine wave) |

---

## 8. Lighting

### 8.1 Dynamic Time-of-Day Cycle

The world transitions through day phases based on real-world time (like AC).

| Phase | Hours | Sky | Sun Color | Sun Intensity | Ambient Color | Ambient Intensity |
|-------|-------|-----|-----------|---------------|--------------|-------------------|
| Dawn | 5-7am | `#FFB366` → `#87CEEB` | `#FFD4A8` | 0.6 | `#C4B0FF` | 0.4 |
| Morning | 7-10am | `#87CEEB` | `#FFF5E1` | 0.9 | `#B0D4FF` | 0.5 |
| Midday | 10am-3pm | `#87CEEB` | `#FFFFFF` | 1.0 | `#C4D8FF` | 0.5 |
| Afternoon | 3-5pm | `#87CEEB` → `#FFD4A8` | `#FFE4B0` | 0.8 | `#D4C8B0` | 0.5 |
| Golden hour | 5-7pm | `#FF9966` | `#FFB366` | 0.7 | `#FFD4A8` | 0.4 |
| Evening | 7-9pm | `#FF9966` → `#2D2D6B` | `#FF8844` | 0.3 | `#6B5A8B` | 0.3 |
| Night | 9pm-5am | `#1A1A40` | none (moon) | 0.0 | `#3344666` | 0.25 |

### 8.2 Light Sources

| Light | Type | Purpose |
|-------|------|---------|
| Sun | `<directionalLight>` | Main light, casts shadows, color/intensity from time table |
| Ambient | `<ambientLight>` | Fill light, prevents pitch-black shadows |
| Building windows | `<pointLight>` | Warm `#FFE4B0` glow, visible at evening/night, range `3` |
| Lamp posts | `<pointLight>` | Warm `#FFE4B0`, activate at night, range `5` |
| Oracle lanterns | `<pointLight>` | Slightly purple-tinted `#D4B0FF`, always on, range `3` |

### 8.3 Shadows

| Property | Value |
|----------|-------|
| Shadow map | `2048 × 2048` resolution |
| Shadow type | `THREE.PCFSoftShadowMap` (soft edges, not hard) |
| Shadow bias | `-0.001` |
| Cast shadows | Sun directional light, buildings, trees |
| Receive shadows | Terrain, paths, bridge |
| Shadow opacity | Soft — AC shadows are not harsh. Use shadow color `#3A6B3A` (green-tinted on grass) |

---

## 9. Props & Environmental Details

Scatter these around the campus to make it feel lived-in.

| Prop | Model Source | Placement | Count |
|------|-------------|-----------|-------|
| Wooden fence sections | Kenney/custom | Along path edges, around HQ | 10-15 |
| Stone fence sections | Kenney/custom | Around Oracle Temple perimeter | 6-8 |
| Signpost (directional) | Quaternius props | Path intersections, 2-3 arrows per sign | 3-4 |
| Welcome sign | Custom | Near spawn point | 1 |
| Bench | Quaternius props | Along paths, facing scenic spots | 4-6 |
| Lamp post | Quaternius props | Along main path, every ~8 units | 5-7 |
| Well | Quaternius props | Near HQ, decorative | 1 |
| Market stall | Quaternius props | Near Shop entrance | 1-2 |
| Stepping stones | Simple geometry | Near river bank, across shallow spots | 5-8 |
| Log stump | Simple geometry | Random in grassy areas | 3-4 |
| Mushrooms | Small geometry | Under trees, random | 5-8 |
| Butterflies | Billboarded sprites | Floating, random gentle paths | 3-5 |
| Sparkle particles | Particle system | On water surface, near Oracle | Subtle |

---

## 10. Player Avatar

**Still 2D sprite on billboard** (Dave the Diver style — this hasn't changed).

The sprite style should be updated to match the AC-bright world:
- Brighter, more saturated sprite colors (not dark/muted)
- Softer outlines (not harsh pixel edges)
- Same layered composition (body + outfit + hair + accessories)
- Same 8 FPS frame cycling
- Nameplate styling unchanged

---

## 11. Map Layout — Updated Positions

```
                N
                |
           W ---+--- E
                |
                S

Map (~80×80 units):

          [Oracle Temple]  ← elevated hill, stone stairs down
               |
               | (dirt path)
               |
  [Shop] -----+------ [Bounty Board]
               |
  ~~~~~ RIVER ~~~~~ (flows W→E)
  ===== BRIDGE =====
               |
          [=== HQ ===]  ← largest building, central
               |
               | (dirt path)
               |
  [Job Board] -+------ [Leaderboard]
               |
          [Spawn Point]
```

Same positions as v1 spec but with the river bisecting the campus. Oracle Temple is on the elevated north side.

---

## 12. Atmosphere & Animation

### 12.1 Ambient Animations

| Element | Animation | Speed |
|---------|-----------|-------|
| Clouds | Slow drift across sky (billboard planes) | `0.02` units/frame |
| Water ripples | UV scroll + sine displacement | `0.5` Hz |
| Water sparkles | Random white dots flashing | `2s` interval |
| Flower sway | Vertex displacement, sine wave | `0.3` Hz, `0.05` amplitude |
| Tree sway | Gentle rotation of canopy | `0.15` Hz, `2°` amplitude |
| Butterflies | Bezier curve paths, random | Slow, looping |
| Smoke (HQ chimney) | Small particle emitter | Slow upward drift |
| Leaves (wind) | Occasional leaf particle burst | Every 10-20s |

### 12.2 Audio Mood (Reference)

| Source | Description |
|--------|-------------|
| Background music | Gentle piano + ukulele + light percussion (AC: New Horizons hourly music vibe) |
| Ambient sounds | Birds chirping, gentle stream water, wind rustling leaves |
| Interaction sounds | Soft pop for menu open, chime for building enter, coin jingle for shop |

---

## 13. What to Remove from Current Implementation

| Remove | Why |
|--------|-----|
| PS1Pipeline.tsx | PS1 shader pipeline is dead |
| RetroPass / three-retropass | No more pixelation/dithering |
| NearestFilter on textures | Use `LinearFilter` + mipmaps for smooth rendering |
| Low-res FBO (320×240) | Render at native resolution |
| Vertex snapping shader | No more jitter |
| Dark fog (`#0f0f10`) | Replace with light distance fog matching sky color |
| Color quantization | Full color depth |

---

## 14. What to Keep from Current Implementation

| Keep | Notes |
|------|-------|
| R3F Canvas + drei | Same tech stack |
| CameraControls | Same camera system, just adjust angle/FOV |
| Building.tsx proximity detection | "Press E" system works, keep it |
| Fade-to-black transitions | Still the transition style |
| Billboard sprites for player | Same approach |
| Building labels (Html) | Same floating labels |
| WASD + click-to-move | Same control scheme |

---

## 15. Implementation Priority for Frontend

1. **Remove PS1 pipeline** — delete shader, enable antialias, use native resolution
2. **Sky** — add `<Sky>` from drei or gradient background matching palette
3. **Terrain** — replace flat green with vertex-colored terrain mesh with gentle hills
4. **Grass color** — apply the green palette (`#7EC850` primary)
5. **Building colors** — tint existing placeholder boxes with building palette colors
6. **Trees** — replace cone trees with sphere-canopy trees using foliage palette
7. **River** — add transparent blue plane with UV animation
8. **Bridge** — simple plank geometry across river
9. **Lighting** — set up time-of-day system (start with fixed midday, add cycle later)
10. **Props** — scatter flowers, bushes, fences, benches
11. **Shadows** — enable soft shadow maps
12. **Ambient animations** — flower sway, tree sway, water sparkle
