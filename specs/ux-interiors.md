# UX Spec — Building Interiors (Animal Crossing Style)

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-04-04
> **Style:** AC: New Horizons — full 3D rooms, walk around, interact with stations
> **Extends:** `specs/ux-game-world-v2.md` (exterior world)
> **Frontend reads this to build:** interior scenes for each building

---

## 1. Overview

Every building has a full 3D interior scene. Entering a building triggers fade-to-black (0.3s), loads the interior, player spawns at the door. The player walks around inside and approaches interactive stations to trigger UI panels or navigate to dashboard pages.

**Camera inside buildings:** Same perspective camera as exterior but pulled closer — FOV `50°`, distance `10`, slightly steeper polar angle `~65°` for better room visibility.

**Exiting:** Walk to the door and press E, or press Escape. Fade-to-black, return to exterior at building entrance.

---

## 2. Shared Interior Elements

### 2.1 Floor

| Property | Value |
|----------|-------|
| Material | Warm wood planks |
| Color | `#D4B896` (light warm wood) |
| Alt color | `#C4A878` (slightly darker planks for variation) |
| Pattern | Alternating plank widths via UV tiling |
| Roughness | `0.85` |

### 2.2 Walls

| Property | Value |
|----------|-------|
| Material | Painted plaster (matches building exterior color but lighter) |
| Interior tint | Exterior wall color lightened ~15% |
| Wainscoting | Lower 30% of wall is darker wood (`#B8935A`) |
| Roughness | `0.9` |

### 2.3 Ceiling

| Property | Value |
|----------|-------|
| Color | `#FFF8F0` warm white |
| Exposed beams | `#8B6B4A` wood beams crossing ceiling (2-3 per room) |

### 2.4 Lighting

| Light | Type | Color | Intensity |
|-------|------|-------|-----------|
| Ambient | `<ambientLight>` | `#FFF5E1` | `0.6` |
| Overhead | `<pointLight>` | `#FFE4B0` | `0.8`, centered, y=ceiling height |
| Window light | `<directionalLight>` | `#FFFFFF` | `0.3`, angled from window positions |
| Accent lamps | `<pointLight>` | `#FFE4B0` | `0.4`, range `4`, near interactive stations |

### 2.5 Interactive Stations

Same proximity system as exterior:
- Detection range: `2` units (tighter in rooms)
- Prompt: "Press E to use" / "Press E to open"
- On interact: opens a solid dark overlay panel OR navigates to dashboard page

### 2.6 Room Size Guidelines

| Building | Room Size | Ceiling Height |
|----------|-----------|---------------|
| HQ (main) | `16 × 12` units | `4` units |
| HQ (admin) | `10 × 8` units | `3.5` units |
| Shop | `10 × 10` units | `3.5` units |
| Oracle Temple | `12 × 12` units | `5` units (grand) |

---

## 3. HQ — Main Room (Resident Services)

The main hub building. Contains stations for Directory, Leaderboard, Profile, and the locked Admin door.

```
+================================+
|                                |
|  [Bulletin Board]  [Trophy     |
|   → Directory       Case]     |
|                    → Leaderbd  |
|                                |
|       [Player spawn]           |
|                                |
|  [Desk + Chair]   [Bookshelf]  |
|   → Profile        → Quests   |
|                                |
|  [Admin Door]     [Exit Door]  |
|   (T1-T3 lock)    → Outside   |
|                                |
+================================+
```

### 3.1 Furniture & Stations

| Station | Model Description | Interaction |
|---------|-------------------|-------------|
| Bulletin Board | Cork board on wall, colorful pinned papers, wooden frame (`#8B6B4A`) | Opens Directory overlay → `/dashboard/directory` |
| Trophy Case | Glass display case with gold trophies/medals on shelves, warm lamp on top | Opens Leaderboard overlay → `/dashboard/leaderboard` |
| Desk + Chair | Wooden desk (`#B8935A`) with books/papers, comfy chair, desk lamp | Opens Profile page → `/dashboard/profile` |
| Bookshelf | Tall wooden bookshelf, colorful book spines, small potted plant on top | Opens Quests panel |
| Admin Door | Wooden door on left wall, gold lock icon above (`#FFD166`), different color than exit | Fade to Admin room (T1-T3) or "Access restricted" message |
| Exit Door | Wooden door on back wall, "EXIT" sign above, welcome mat | Fade back to exterior |

### 3.2 Decorative Elements

| Element | Description |
|---------|-------------|
| Rug | Large woven rug (`#D4A876`) centered on floor |
| Potted plants | 2 small plants in corners (green spheres in terracotta pots `#C4825A`) |
| Wall clock | Round clock on wall, `#FFF5E1` face, `#8B6B4A` frame |
| Ceiling fan | Optional — decorative, slow rotation |
| Framed pictures | 2-3 small frames on walls (colored rectangles for now) |
| Welcome mat | At exit door, `#7EC850` green with "TETHOS" text |

### 3.3 Color Palette

| Element | Hex |
|---------|-----|
| Floor wood | `#D4B896` |
| Walls (interior) | `#FFF8EE` (warmer than exterior `#FFF5E1`) |
| Wainscoting | `#B8935A` |
| Desk | `#B8935A` |
| Bookshelf | `#8B6B4A` |
| Rug | `#D4A876` |
| Chair cushion | `#E87B5A` (terracotta accent, matches roof) |

---

## 4. HQ — Admin Room

Accessed through the locked door. T1-T3 only. Slightly warmer/special lighting.

```
+==============================+
|                              |
|  [Terminal Desk]  [Board]    |
|   → Member Mgmt   → Bounty  |
|                    Approval  |
|                              |
|       [Player spawn]         |
|                              |
|  [Podium]       [Chest]      |
|   → Announce     → Economy   |
|                              |
|       [Door → Main Room]     |
|                              |
+==============================+
```

### 4.1 Stations

| Station | Model Description | Interaction |
|---------|-------------------|-------------|
| Terminal Desk | Dark wood desk with glowing crystal ball (`#7B5EA7` purple glow), open book | Opens Member management panel (admin UI) |
| Board | Standing easel with clipboard, red/green status indicators | Opens Bounty approval panel |
| Podium | Wooden lectern with scroll, `#FFD166` gold trim | Opens Announcement creation form |
| Chest | Treasure chest (`#B8935A` wood, `#FFD166` gold clasp), slight gold particle glow | Opens Economy controls panel |
| Door | Same wood door, leads back to main room | Fade back to HQ main room |

### 4.2 Ambiance

| Property | Value |
|----------|-------|
| Lighting | Warmer than main room — gold accent `#FFD166` point lights |
| Special effect | Crystal ball on terminal desk has subtle purple emissive pulse |
| Floor | Same wood, but with a dark `#7B5EA7` purple rug |
| Walls | `#F0E8F5` slightly purple-tinted white |
| Mood | Exclusive, warm, important-feeling |

---

## 5. Shop Interior

A cozy general store. Displays merchandise on shelves and counters.

```
+==============================+
|                              |
|  [Shelf L]     [Shelf R]    |
|   Display       Display      |
|                              |
|       [Counter]              |
|        → Browse/Buy          |
|                              |
|  [Barrel]      [Crate]      |
|   Decor         Decor        |
|                              |
|       [Exit Door]            |
|                              |
+==============================+
```

### 5.1 Stations

| Station | Model Description | Interaction |
|---------|-------------------|-------------|
| Counter | Wooden counter with cash register, small items displayed | Opens Shop page → `/dashboard/shop` |
| Shelf Left | Tall wooden shelf with colorful product boxes/items | Decorative (or opens specific category) |
| Shelf Right | Matching shelf with different items | Decorative |
| Exit Door | Back to exterior | Fade out |

### 5.2 Decorative Elements

| Element | Description |
|---------|-------------|
| Cash register | On counter, `#3D3D3D` metal body, `#FFD166` gold details |
| Product displays | Colorful boxes on shelves (different sizes/colors) |
| Hanging sign | "WELCOME" wooden sign behind counter |
| Barrels | 2 wooden barrels near door, `#A07850` |
| Crates | Stacked wooden crates, some open showing items |
| Potted plant | Windowsill plant |
| String lights | Warm fairy lights along ceiling edge (`#FFE4B0` emissive dots) |

### 5.3 Color Palette

| Element | Hex |
|---------|-----|
| Floor | `#D4B896` wood |
| Walls (interior) | `#E8F0E8` soft mint (lighter than exterior `#D4EAD4`) |
| Counter | `#B8935A` |
| Shelves | `#8B6B4A` |
| Awning stripe (interior banner) | `#FFD166` + `#FFFFFF` alternating |

---

## 6. Oracle Temple Interior

Grand and mystical. Where the MBTI quiz happens.

```
+================================+
|                                |
|  [Crystal Altar]               |
|   → Take MBTI Quiz             |
|                                |
|  [Left Pillar]  [Right Pillar] |
|   with lantern   with lantern  |
|                                |
|       [Player spawn]           |
|                                |
|  [Scroll Shelf]  [Class Mural] |
|   → Class Info    Decorative   |
|                                |
|       [Exit Door]              |
|                                |
+================================+
```

### 6.1 Stations

| Station | Model Description | Interaction |
|---------|-------------------|-------------|
| Crystal Altar | Stone pedestal (`#9B9080`) with large floating crystal (purple `#7B5EA7`, slow rotation + glow) | Opens Oracle quiz → `/dashboard/oracle` |
| Scroll Shelf | Ornate bookshelf with scrolls and ancient books | Opens Class info panel (your class/subclass details) |
| Class Mural | Large decorative wall art showing the 4 classes (Warrior, Mage, Healer, Rogue) | Decorative — no interaction |
| Exit Door | Grand arched door | Fade back to exterior |

### 6.2 Decorative Elements

| Element | Description |
|---------|-------------|
| Pillars | 2 stone columns (`#9B9080`) with purple-flame lanterns at top |
| Stained glass | Colored rectangles on walls simulating stained glass windows (red, blue, green, yellow) |
| Runic circles | Floor pattern — concentric circles around the altar (subtle `#D4B0FF` emissive) |
| Candles | Small candle clusters on floor near altar (warm glow) |
| Banner tapestries | 4 hanging banners on walls, one per class color (red, blue, green, yellow) |
| Incense particles | Optional — slow-rising particle wisps near altar |
| Starry ceiling | Optional — dark ceiling `#1A1A40` with `#FFFFFF` dot particles simulating stars |

### 6.3 Color Palette

| Element | Hex |
|---------|-----|
| Floor | `#A09080` warm stone gray |
| Walls (interior) | `#F0E8F5` soft lavender |
| Pillars | `#9B9080` |
| Crystal | `#7B5EA7` with emissive `#D4B0FF` |
| Runic floor glow | `#D4B0FF` at 0.1 emissive intensity |
| Lantern flame | `#D4B0FF` (purple-tinted) |
| Candle flame | `#FFE4B0` warm |
| Banner colors | `#E85050` (Warrior), `#002FA7` (Mage), `#22C55E` (Healer), `#FFD166` (Rogue) |

### 6.4 Mood

Mystical but warm and inviting — like the museum in AC: New Horizons. NOT dark or scary. Soft purple lighting, gentle crystal glow, warm candles. The player should feel curious and special, not intimidated.

---

## 7. Transition Flow

### 7.1 Entering a Building

```
Exterior → Press E at door
→ Player input disabled
→ 0.3s fade to black
→ Unload exterior (or keep cached)
→ Load interior scene
→ Player spawns at interior door position
→ 0.3s fade from black
→ Player input re-enabled
```

### 7.2 Exiting a Building

```
Interior → Walk to exit door → Press E
→ 0.3s fade to black
→ Unload interior
→ Restore exterior
→ Player position = just outside building door
→ 0.3s fade from black
```

### 7.3 Interior ↔ Interior (HQ → Admin Room)

Same fade-to-black sequence. Player spawns at the connecting door in the new room.

---

## 8. Interior Implementation Notes

### 8.1 Architecture

Each interior is a separate R3F scene component (e.g., `HQInterior.tsx`, `ShopInterior.tsx`, `OracleInterior.tsx`, `AdminRoomInterior.tsx`).

### 8.2 Shared Components

| Component | Reuse |
|-----------|-------|
| `InteriorFloor` | Wood plank floor, configurable color |
| `InteriorWalls` | 4 walls with wainscoting, configurable color, window cutouts |
| `InteriorDoor` | Exit door with proximity prompt |
| `InteriorStation` | Interactive object with proximity detection + prompt |
| `InteriorLamp` | Point light + lamp mesh |

### 8.3 Player in Interiors

Same `PlayerAvatar.tsx` — 2D billboard sprite. Same WASD movement. Boundary clamped to room dimensions. Same nameplate.

### 8.4 Camera in Interiors

| Property | Value |
|----------|-------|
| FOV | `50°` (same as exterior) |
| Distance | `10` (closer — room is smaller) |
| Polar angle | `~65°` (steeper for better top-down room view) |
| Azimuth | Locked |
| Follow | Same smooth damp |

---

## 9. Phase Priority

| Priority | Interior | Reason |
|----------|----------|--------|
| 1 | HQ Main Room | Central hub, most visited |
| 2 | Oracle Temple | MBTI quiz lives here |
| 3 | Shop | Real e-commerce browsing |
| 4 | HQ Admin Room | Admin-only, fewer users |
