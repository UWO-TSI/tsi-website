# UX Spec — Game World

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-03-27
> **Implements from:** CLAUDE.md (Student Portal Vision), specs/asset-stack.md, DESIGN_SYSTEM.md
> **Frontend reads this to build:** `web/components/game/GameWorld.tsx`, `web/components/game/PlayerAvatar.tsx`, `web/components/game/Building.tsx`

---

## 1. Overview

The game world is a 2.5D isometric PS1-styled campus that renders on the Home page (`/student/dashboard`). Players walk around a mixed campus environment, approach buildings/objects to interact, and enter buildings via a quick fade-to-black transition.

**Rendering:** React Three Fiber canvas, full bleed in the main content area (no padding).
**Shader:** PS1 pipeline (vertex snapping, affine textures, low-res FBO at 320×240, NearestFilter upscale).
**Assets:** Quaternius + Kenney + PSX RPG Town Tiles (all CC0). See `specs/asset-stack.md`.

---

## 2. Camera

| Property | Value |
|----------|-------|
| Type | Perspective |
| FOV | `35°` |
| Polar angle | Locked at `45°` (isometric-ish) |
| Azimuth | Free rotation (player can orbit) OR locked (designer's choice — recommend locked for MVP) |
| Distance | ~`20` units from player |
| Controls | drei `<CameraControls>`, smooth follow via `THREE.MathUtils.damp()` |
| Follow target | Player avatar position |
| Zoom | Disabled for MVP (fixed distance) |
| Near clip | `0.1` |
| Far clip | `200` |
| Fog | Linear fog, `var(--color-bg-main)` (#0f0f10), start `60`, end `120` |

---

## 3. Terrain — Mixed Campus

Grass areas with cobblestone walkways connecting buildings. University campus meets RPG town.

### 3.1 Ground Plane

| Property | Value |
|----------|-------|
| Base | Large flat grass plane using PSX RPG Town Tiles (grass variant) |
| Size | ~`80 × 80` units |
| Paths | Cobblestone walkway tiles connecting all buildings |
| Path width | ~`3` units (wide enough for player + clearance) |
| Path style | PSX RPG Town Tiles (cobblestone/stone variant) |
| Edge | Grass fades into fog at map edges |

### 3.2 Decorative Elements

Scatter these around the map for visual richness (all from Kenney Nature Kit + Quaternius Fantasy Props):

| Element | Asset Source | Placement |
|---------|-------------|-----------|
| Trees | Kenney Nature Kit | Along paths, map edges, clusters |
| Bushes | Kenney Nature Kit | Building perimeters, path borders |
| Benches | Quaternius Fantasy Props | Along walkways, near HQ |
| Lampposts | Quaternius Fantasy Props | Along main paths (warm point lights) |
| Signposts | Quaternius Fantasy Props | At path intersections |
| Flowers | Kenney Nature Kit | Small patches near buildings |
| Rocks | Kenney Nature Kit | Natural clusters, map edges |

### 3.3 Lighting

| Light | Type | Color | Intensity | Position |
|-------|------|-------|-----------|----------|
| Ambient | `<ambientLight>` | `#ffffff` | `0.4` | Global |
| Sun | `<directionalLight>` | `#ffeedd` | `0.8` | High, angled (casting soft shadows) |
| Building lamps | `<pointLight>` | `#ffcc88` | `0.6` | Near each building entrance, range `8` |
| HQ lamp | `<pointLight>` | `var(--color-brand-blue)` tint | `0.3` | Above HQ door (subtle blue glow) |

---

## 4. Map Layout — Building Placement

```
         N
         |
    W ---+--- E
         |
         S

Map layout (top-down, ~80×80 units):

            [Oracle Temple]
                 |
                 | (cobblestone path)
                 |
   [Shop] ------+------ [Bounty Billboard]
                 |
                 |
        [=== HQ Building ===]
                 |
                 |
   [Job Board] -+------ [Leaderboard Statue]
                 |
                 |
           [Spawn Point]
```

### 4.1 Building Positions (approximate center coordinates)

| Building/Object | Position (x, z) | Asset Source | Scale |
|----------------|-----------------|-------------|-------|
| HQ Building | `(0, 0)` | Quaternius Medieval Village (large hall) | 1.0 |
| Shop | `(-15, 10)` | Kenney Retro Medieval (market stall/shop) | 0.8 |
| Oracle Temple | `(0, 25)` | Quaternius Medieval Village (temple/church) | 0.9 |
| Bounty Billboard | `(15, 10)` | Quaternius Fantasy Props (notice board) | 0.6 |
| Job Board | `(-12, -12)` | Quaternius Fantasy Props (sign/bulletin) | 0.6 |
| Leaderboard Statue | `(12, -12)` | Quaternius Fantasy Props (trophy/statue) | 0.7 |
| Spawn Point | `(0, -20)` | No model — player starting position | — |

### 4.2 Building Labels

Each building has a floating label above it, visible from a distance.

| Property | Value |
|----------|-------|
| Component | drei `<Html>` |
| Position | `2` units above building roof |
| Text | Building name (e.g., "HQ", "Shop", "Oracle Temple") |
| Font | IBM Plex Mono, `var(--font-size-label)` (12px) |
| Color | `var(--color-text-main)` (#f1ffff) |
| Background | `rgba(15, 15, 16, 0.7)` |
| Padding | `2px 8px` |
| Border-radius | `4px` |
| Visibility | Always visible, scales with distance (drei `<Html distanceFactor={10}>`) |

---

## 5. Player Avatar — 2D Sprite in 3D World (Dave the Diver Style)

> **Art direction change (2026-03-29):** Avatars are 2D sprites on billboard planes, NOT 3D models. This gives a distinctive mixed-media look — 2D characters walking through a 3D PS1 environment.

### 5.1 Sprite Setup

| Property | Value |
|----------|-------|
| Component | drei `<Billboard>` with textured `<planeGeometry>` |
| Rendering | Always faces camera (billboard behavior) |
| Size | `~1.2 × 1.8` units (width × height) |
| Sprite source | Sprite sheets (PNG) — generated via Nano Banana or hand-drawn |
| Texture filter | `THREE.NearestFilter` (pixel-crisp, matches PS1 aesthetic) |
| Placeholder | Colored rectangle (`1.2 × 1.8` plane, solid color) until real sprites exist |

### 5.2 Sprite Sheet Animation

| Property | Value |
|----------|-------|
| Idle | 1–2 frames, subtle breathing/bob loop |
| Walk | 4–8 frames per direction (down, up, left, right) |
| Frame rate | `8 FPS` (retro feel) |
| Frame cycling | `useFrame()` — advance frame index based on delta time |
| Direction | Flip sprite horizontally for left/right (or use separate sheet columns) |
| Transition | Instant swap between idle ↔ walk (no blend — sprite style) |

### 5.3 Layered Sprite Composition

Avatar customization via stacked sprite layers at slight z-offsets:

```
Layer stack (front to back):
  accessories  (z-offset: +0.003)  — hats, glasses
  hair         (z-offset: +0.002)  — hair style + color
  outfit       (z-offset: +0.001)  — clothing
  body         (z-offset:  0.000)  — base body + skin tone
```

| Property | Value |
|----------|-------|
| Layer count | 4 layers (body, outfit, hair, accessories) |
| Z-offset per layer | `0.001` units (prevents z-fighting) |
| Each layer | Separate `<planeGeometry>` with its own sprite sheet texture |
| Color tinting | `mesh.material.color.set()` for skin tone / hair color variants |
| Alpha | Each sprite sheet has transparent background (PNG with alpha) |

### 5.4 Movement

| Property | Value |
|----------|-------|
| WASD / Arrow keys | Move in 4/8 directions relative to camera |
| Speed | `5` units/second |
| Click-to-move | Raycast on ground plane, move toward click point |
| Direction facing | Sprite flips or swaps sheet row based on movement direction |
| Animation trigger | Speed > `0.1` → walk frames, else idle frames |
| Boundary | Clamped to map bounds (±40 on x and z) |
| Collision | Simple radius check against building positions (no BVHEcctrl needed for 2D sprite) |

### 5.5 Nameplate

| Property | Value |
|----------|-------|
| Component | drei `<Html>` |
| Position | `2.0` units above player origin (above sprite top) |
| Name | `var(--font-size-body-sm)` (14px), `var(--color-text-main)`, weight 700 |
| Level | `var(--font-size-label)` (12px), `var(--color-text-muted)`, IBM Plex Mono |
| Background | `rgba(15, 15, 16, 0.6)` |
| Padding | `2px 8px` |
| Border-radius | `4px` |
| Pointer events | `none` |

---

## 6. Building Interactions

### 6.1 Proximity Detection

When the player is within interaction range of a building/object:

| Property | Value |
|----------|-------|
| Detection range | `3` units from building center |
| Prompt | "Press E to enter" (or "Press E to view" for boards/objects) |
| Prompt style | drei `<Html>`, centered above building door |
| Prompt background | `var(--color-surface)` (#111827), `border: 1px solid var(--glass-border-soft)` |
| Prompt text | `var(--font-size-body-sm)` (14px), `var(--color-text-main)` |
| Prompt padding | `4px 12px` |
| Prompt border-radius | `var(--radius-sm)` (8px) |
| Prompt animation | Fade in `0.2s`, slight `translateY(-4px)` on appear |
| Key | `E` key or click on building |

### 6.2 Building Actions

| Building/Object | Action on Enter |
|----------------|-----------------|
| HQ Building | Fade to black → load HQ interior scene |
| Shop | Fade to black → navigate to `/student/dashboard/shop` |
| Oracle Temple | Fade to black → navigate to `/student/dashboard/oracle` (MBTI → RPG class) |
| Bounty Billboard | Open solid dark overlay panel (bounty board list) |
| Job Board | Open solid dark overlay panel (job listings) |
| Leaderboard Statue | Open solid dark overlay panel (leaderboard rankings) |

**Rule:** Buildings with interiors → fade to black transition. Objects without interiors → overlay panel in-place.

---

## 7. Building Transitions — Quick Fade to Black

### 7.1 Enter Building

```
Timeline:
0.0s  Player presses E near building
0.0s  Player input disabled
0.0s  Black overlay starts fading in (opacity 0 → 1)
0.3s  Screen fully black
0.3s  Load interior scene / navigate to page
0.5s  Interior ready, black overlay starts fading out (opacity 1 → 0)
0.8s  Transition complete, player input re-enabled
```

| Property | Value |
|----------|-------|
| Overlay | Full-screen `div`, `position: fixed`, `inset: 0`, `z-index: 100` |
| Overlay color | `#000000` |
| Fade in | `opacity: 0 → 1`, `0.3s`, `ease-in` |
| Fade out | `opacity: 1 → 0`, `0.3s`, `ease-out` |
| Total duration | ~`0.8s` |
| Player control | Disabled during transition |

### 7.2 Exit Building (Return to Overworld)

Same sequence in reverse. Player position resets to just outside the building door they entered.

### 7.3 Overlay Panel (for objects like Bounty Board, Job Board, Leaderboard)

No scene change. An overlay appears on top of the game world.

| Property | Value |
|----------|-------|
| Backdrop | `rgba(0, 0, 0, 0.6)`, `backdrop-filter: blur(4px)` |
| Panel | See Section 8 (Overlay Panel Style) |
| Animation | Panel: `opacity: 0, scale: 0.95 → opacity: 1, scale: 1`, `0.25s ease-out` |
| Close | Press `Escape`, click backdrop, or click X button |
| Close animation | `opacity: 1 → 0`, `0.15s ease-in` |
| Game state | Paused (player can't move while overlay is open) |

---

## 8. Overlay Panel Style — Solid Dark

Used for in-game object interactions (bounty board, job board, leaderboard).

```
+------ Solid Dark Overlay Panel ------+
|                                       |
|  bg: #0d1b2a (bg-navy)               |
|  border: 1px solid glow-blue         |
|  border-radius: 16px                 |
|  shadow: shadow-strong               |
|                                       |
|  [Header bar]                        |
|  ─────────────────────────           |
|  [Content area — scrollable]         |
|                                       |
|  max-width: 800px                    |
|  max-height: 80vh                    |
|  centered on screen                  |
|                                       |
+---------------------------------------+
```

| Property | Value |
|----------|-------|
| Background | `var(--color-bg-navy)` (#0d1b2a) |
| Border | `1px solid rgba(0, 47, 167, 0.3)` (blue glow border) |
| Border-radius | `var(--radius-md)` (16px) |
| Shadow | `var(--shadow-strong)` |
| Max-width | `800px` |
| Max-height | `80vh` |
| Padding | `var(--space-6)` (24px) |
| Position | Centered on screen (`position: fixed`, transform center) |
| z-index | `60` |

### Panel Header

| Property | Value |
|----------|-------|
| Title | `var(--font-size-h4)` (24px), `var(--color-text-main)`, weight 700 |
| Close button | Top-right, `24px` Lucide `X` icon, `var(--color-text-muted)` |
| Close hover | `var(--color-text-main)` |
| Divider | `1px solid rgba(255, 255, 255, 0.08)` below header |
| Header padding-bottom | `var(--space-4)` (16px) |

### Panel Content

| Property | Value |
|----------|-------|
| Overflow-y | `auto` |
| Max-height | `calc(80vh - 80px)` (minus header) |
| Scrollbar | Thin, styled to match dark theme |

---

## 9. HQ Interior

### 9.1 Main Room

A single open room with interactive stations around the perimeter. Player spawns at the door.

```
+================================+
|                                |
|  [Bulletin Board]  [Trophy]   |
|   → Directory       → Leader  |
|                    board       |
|                                |
|        [Player spawn]          |
|                                |
|  [Bookshelf]      [Desk]      |
|   → Bounty Board   → Profile  |
|                                |
|  [Admin Door]     [Exit Door]  |
|   (T1-T3 only)    → Overworld |
|                                |
+================================+
```

**Room dimensions:** ~`20 × 16` units

| Station | Object Model | Action |
|---------|-------------|--------|
| Bulletin Board | Quaternius props (notice board) | Opens Directory overlay |
| Trophy Case | Quaternius props (display case) | Opens Leaderboard overlay |
| Bookshelf | Quaternius props (bookshelf) | Opens Bounty Board overlay |
| Desk | Quaternius props (writing desk) | Opens own Profile page |
| Admin Door | Medieval door model | Fade to admin room (T1-T3 only) |
| Exit Door | Medieval door model | Fade back to overworld |

### 9.2 Station Interaction

Same proximity system as overworld buildings:
- `2` unit detection range (smaller room, tighter range)
- "Press E to open" prompt appears
- Stations open overlay panels (solid dark style)
- Profile desk navigates to `/student/dashboard/profile`

### 9.3 Admin Door — Locked

| Condition | Behavior |
|-----------|----------|
| Player tier T1-T3 | "Press E to enter" prompt, door opens, fade to admin room |
| Player tier T4-T5 | "Press E" shows message: "Access restricted to administrators" |
| Visual indicator | Door has a subtle red/gold lock icon or different color than exit door |
| Lock visual | Small `<Html>` lock icon (Lucide `Lock`, 16px, `var(--color-brand-yellow)`) floating above door |

### 9.4 Admin Room

Separate room, accessed only through the locked door in HQ main room. Contains multiple themed admin stations.

```
+==============================+
|                              |
|  [Terminal]      [Board]     |
|   Member Mgmt    Bounty      |
|                  Approval    |
|                              |
|       [Player spawn]         |
|                              |
|  [Podium]       [Chest]      |
|   Announcements  Economy     |
|                  Controls    |
|                              |
|       [Door → Main Room]     |
|                              |
+==============================+
```

**Room dimensions:** ~`14 × 12` units

| Station | Object Model | Function |
|---------|-------------|----------|
| Terminal | Quaternius props (desk + crystal ball / magic item) | Member management — view/edit any member's tier, role, active status |
| Board | Quaternius props (standing board/easel) | Bounty approval — review submissions, approve/reject, create new bounties |
| Podium | Quaternius props (podium/lectern) | Announcements — post system-wide announcements |
| Chest | Quaternius props (treasure chest) | Economy controls — adjust coin rewards, manage shop inventory |

**Admin room lighting:** Slightly warmer/different ambiance than main room to feel exclusive.

| Light | Value |
|-------|-------|
| Ambient | `#ffffff`, intensity `0.3` |
| Accent | `<pointLight>` color `var(--color-brand-yellow)` (#ffd166), intensity `0.4`, near terminal |
| Mood | Slightly dimmer than main room, warm gold tones |

---

## 10. Interior Visual Style

Both HQ rooms use the same visual treatment:

| Property | Value |
|----------|-------|
| Floor | PSX RPG Town Tiles (interior wood/stone variant) |
| Walls | Quaternius Medieval Village interior wall pieces |
| Ceiling | Optional — open-top rooms work fine with isometric camera |
| Furniture | Quaternius Fantasy Props |
| Lighting | Warm point lights (candles, lanterns from props) |
| PS1 shader | Same pipeline as overworld — vertex snapping, affine textures, low-res FBO |

---

## 11. Game World Loading

### 11.1 Initial Load

| Phase | Display |
|-------|---------|
| Assets downloading | ASCII loading screen (reuse `<LoadingScreen>` component) with progress bar tracking GLB loads |
| Assets ready | Fade out loading screen, fade in game world |
| First frame | Player at spawn point, idle animation, camera at default position |

### 11.2 Asset Loading Strategy

| Strategy | Detail |
|----------|--------|
| Priority | Load terrain + player first, buildings second, props last |
| Method | drei `useGLTF.preload()` for critical assets |
| Fallback | Simple colored boxes as placeholders while GLBs load |
| Caching | Browser cache for repeat visits |

---

## 12. Visual Reference Summary

**Design decisions (confirmed by David + Management):**
- Terrain: Mixed campus — grass + cobblestone walkways
- **Player avatar: 2D sprites on billboard planes (Dave the Diver style) — NOT 3D models** (Management directive 2026-03-29)
- Sprite composition: 4 stacked layers (body, outfit, hair, accessories) at z-offsets
- Sprite animation: 8 FPS frame cycling, idle (1-2 frames), walk (4-8 frames per direction)
- Placeholder: colored rectangles until real sprite sheets are generated
- HQ: Single open room with stations + separate locked admin room (T1-T3)
- Admin room: Multiple themed stations (terminal, board, podium, chest)
- Building transitions: Quick fade to black (0.3s/0.3s, ~0.8s total)
- Overlay panels: Solid dark (#0d1b2a), blue border glow, max 800px centered
- Camera: 45° isometric, FOV 35°, smooth follow
- PS1 shader on 3D environment; sprites are pixel-crisp (NearestFilter)
