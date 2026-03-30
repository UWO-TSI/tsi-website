# Confirmed Asset Stack & Technical Architecture

> Source: Deep research completed 2026-03-29. All agents must read this.

---

## CRITICAL ARCHITECTURE CHANGE

**Supabase Realtime CANNOT be used for multiplayer position sync.**
200 players at 10Hz = ~400,000 messages/sec = ~$3,600/HOUR.

**Use Colyseus** (MIT, colyseus.io) for real-time position/animation sync.
Self-host on $10 VPS or Colyseus Cloud at $15/month. Tested to 10,000+ CCU.

**Supabase keeps:** auth, profiles, inventory, persistent data, chat history, bounties, economy.
**Colyseus handles:** player positions, animation state, room management, presence.
**Total infra:** ~$40-60/month.

---

## Characters — 2D Sprites in 3D World (Dave the Diver style)

**PIVOT: Characters are 2D sprite sheets on billboarded quads, NOT 3D models.**
The 3D world (buildings, terrain, props) stays unchanged. Only characters are 2D.

| Asset | License | Format | Use For |
|-------|---------|--------|---------|
| Nano Banana 2/Pro API | Paid | PNG | Generate character sprite sheets (body, hair, outfits, accessories) |
| ~~Quaternius Modular Characters~~ | ~~CC0~~ | ~~glTF~~ | ~~NO LONGER NEEDED~~ |
| ~~Mixamo~~ | ~~Free~~ | ~~FBX~~ | ~~NO LONGER NEEDED~~ |
| ~~Universal Animation Library~~ | ~~CC0~~ | ~~GLB~~ | ~~NO LONGER NEEDED for characters~~ |

**How 2D sprites work in R3F:**
- Each character is a `<Billboard>` (from drei) with a textured plane
- Sprite sheet contains frames: idle (1-2 frames), walk (4-8 frames per direction)
- Frame cycling in `useFrame()` based on movement state
- Multiple layers stacked at slight z-offsets: body → hair → outfit → accessories
- Nameplate via `<Html>` from drei floating above the billboard

**Avatar customization pipeline:**
1. Each customization category (hair, outfit, accessory) is a separate sprite sheet PNG
2. Layers are stacked planes on the billboard group
3. Swap which PNG is loaded per layer = different look
4. Color tinting via `material.color.set()` for palette swaps
5. Nano Banana generates all sprite variants with consistent style via careful prompting

---

## Buildings & Environment

| Asset | License | Format | Contents |
|-------|---------|--------|----------|
| Kenney Retro Medieval Kit | CC0 | GLB | 100+ models, **designed for PS1 look** |
| Quaternius Medieval Village MegaKit | CC0 | glTF | 300+ modular grid-snap pieces |
| PSX RPG Town Tiles (redvampire) | Free | GLB | 32 tileable meshes, day/night variants |
| Kenney Fantasy Town Kit | CC0 | GLTF | 160+ modular town pieces |
| Quaternius Fantasy Props MegaKit | CC0 | glTF | 200+ props (stalls, chests, furniture) |
| Kenney Nature Kit | CC0 | OBJ | 330 nature assets |

---

## UI & Icons

| Asset | License | Format | Contents |
|-------|---------|--------|----------|
| Kenney Pixel UI Pack | CC0 | PNG | 750 pixel-art UI assets |
| tiopalada Mana Soul GUI | Free | PNG | JRPG dialogs/menus (Secret of Mana style) |
| Kenney Fantasy UI Borders | CC0 | PNG | 130+ RPG window borders |
| game-icons.net | CC-BY 3.0 | SVG | 4,170+ recolorable icons |

---

## Audio

| Asset | License | Contents |
|-------|---------|----------|
| Kenney RPG Audio | CC0 | 50 RPG sounds |
| Kenney Interface Sounds | CC0 | 100 UI clicks |
| xDeviruchi 16-Bit Fantasy Music | Free commercial | Complete JRPG soundtrack |

---

## PS1 Shader Pipeline

```
Material Level                    Post-Processing              Output
─────────────                    ───────────────              ──────
bandinopla PS1Material.ts   →   @mesmotronic/three-retropass  →  Screen
(vertex snap, affine tex,       (color quantization,
 dithering, vertex lighting)     ordered dithering)
         │
   useFBO(320, 240)  →  fullscreen quad with NearestFilter upscale
```

**Key npm packages:**
- `@mesmotronic/three-retropass` — pixelation + color quantization + dithering
- `@react-three/postprocessing` — R3F wrapper, built-in Pixelation/Noise/Vignette
- `@react-three/drei` — `useFBO`, `CameraControls`, `useGLTF`, `useAnimations`

**Key code references:**
- bandinopla's PS1Material.ts (GitHub Gist, June 2025) — drop-in ShaderMaterial
- Roman Liutikov blog — global shader patching (~50 lines GLSL)
- Codrops PS1 Jitter Shader — R3F-specific, works with skinned meshes

---

## Camera & Controls

- `<CameraControls>` from drei — lock polar angle for isometric
- Perspective camera, FOV 30-45°, positioned at 45-60° angle
- `THREE.MathUtils.damp()` for smooth follow
- **BVHEcctrl** (pmndrs) for character controller — separates camera from movement

---

## Multiplayer Implementation

- **Colyseus** server: Schema-based state `Player { x, y, z, animation }`
- Client sends position at 6-10Hz with delta compression
- Client-side interpolation: buffer 2-3 updates, lerp in `useFrame()`
- Animation state as discrete events on change (not every frame)
- Client-authoritative movement (acceptable for casual RPG)
- Room-based: one Colyseus room per campus/zone
