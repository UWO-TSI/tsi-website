# Deep Research Prompt: Game Asset Discovery for Tethos Student Portal

## OBJECTIVE

Find all available pre-made 3D and 2D asset packs, individual models, sprite sheets, and tools that could be used to build a **PS1-aesthetic low-poly 3D RPG game world** rendered in a web browser using **Three.js / React Three Fiber**. The game is an Animal Crossing-inspired student portal where players walk around an isometric campus, enter buildings, interact with NPCs, and customize their avatars.

We need a **hybrid approach**: pre-made base models (especially rigged/animated characters) combined with AI-generated textures and skins applied on top.

---

## EXACT ART STYLE WE'RE TARGETING

### Visual Reference
- **Primary inspiration:** PS1-era indie games — low-poly 3D models with visible but clean polygon edges, warm point lighting, hand-painted textures, dithered shadows
- **Character style:** Chibi proportions — large head, small body, cute/expressive. Think Animal Crossing villagers but rendered in low-poly 3D (200-500 polygons per character)
- **Environment style:** Cozy RPG village/campus — small buildings with distinct personalities, pathways, grass, trees, ambient decorations
- **Lighting:** Warm, soft point lights. Candle-glow feel. NOT harsh or realistic. Slight bloom.
- **Texture resolution:** Very low (32x32 to 64x64 per texture). Hand-painted or flat color look. When rendered through PS1 shader (vertex snapping, affine texture mapping, low-res render target scaled up with nearest-neighbor filtering), everything should look cohesive.
- **Color palette:** Muted, warm earth tones as base. Accent colors for important elements (blue glow for interactive objects, warm yellow for lights). NOT neon or oversaturated.
- **Camera angle:** Fixed third-person top-down, approximately 45-60 degree angle, centered on player character

### Games That Match This Aesthetic (search for asset packs inspired by these):
- **Animal Crossing (GameCube/N64)** — the original low-poly versions, NOT the Switch version
- **Croc: Legend of the Gobbos** (PS1) — cute chibi characters, colorful low-poly environments
- **Medievil** (PS1) — atmospheric low-poly with strong lighting
- **Katamari Damacy** — simple low-poly characters with flat textures
- **A Short Hike** — modern indie that captures the low-poly charm perfectly
- **Haunted PS1 Demo Disc** — the modern indie PS1 revival scene
- **Lil Gator Game** — cute low-poly animal characters, cozy world
- **Turnip Boy Commits Tax Evasion** — if it were 3D
- Any game from the "PSX / PS1 aesthetic" indie community on itch.io

---

## SPECIFIC ASSETS NEEDED

### 1. CHARACTER BASE MODELS (HIGHEST PRIORITY)

**Requirements:**
- Low-poly (200-500 polygons)
- Chibi proportions (big head, small body, stubby limbs)
- **MUST be rigged** with a bone skeleton/armature
- **MUST include animations:** walk cycle (4-8 directional), idle, sit, wave/emote
- Format: `.glb`, `.gltf`, `.fbx`, or `.blend` (must be importable into Three.js)
- Must support **swappable parts** OR be simple enough to modify — we need to swap hair, outfits, accessories for avatar customization
- Human-like characters (not animals, not robots — university students)
- Gender-neutral or both male/female base models
- **License: Must allow commercial use and modification**

**Search locations:**
- itch.io (search: "low poly character pack", "PS1 character", "chibi 3D character", "RPG character pack")
- Sketchfab (search: "low poly chibi rigged animated", "PS1 character model")
- Kenney.nl (search their 3D character packs)
- Unity Asset Store (search: "low poly character customizable", "chibi RPG character" — check if models can be exported/used outside Unity)
- TurboSquid (search: "low poly chibi rigged")
- CGTrader (search: "low poly character animated")
- OpenGameArt.org
- Quaternius (free low-poly packs)
- KayKit (Kay Lousberg's free game assets)
- poly.pizza (free low-poly models)

**Specific packs to investigate:**
- Kenney's "Animated Characters" pack
- Quaternius' "Ultimate Animated Characters"
- KayKit "Adventurers" or "Character Pack"
- Synty Studios "POLYGON" series (may be too high-poly but check "Mini" versions)
- "Minifig" style character packs

### 2. BUILDING MODELS

**Requirements:**
- Low-poly exterior models (500-1500 polygons per building)
- RPG/fantasy village style — NOT modern/realistic
- We need these specific buildings:
  1. **HQ / Town Hall** — large central building, official looking, maybe a clock tower or flag
  2. **Shop / Market** — smaller, cozy, market stall or small store with signage area
  3. **Oracle Temple** — mystical/magical building, could have glowing elements, pillars
  4. **Bounty Board** — just a standing wooden notice board (very simple prop)
  5. **Job Board** — similar to bounty board, different shape/color
- Also need: trees, bushes, fences, lampposts, benches, paths, flowers, rocks (environmental props)
- Format: `.glb`, `.gltf`, `.fbx`, or `.blend`
- **License: Commercial use OK**

**Search locations (same as above plus):**
- itch.io: "low poly buildings", "RPG village pack", "fantasy town", "PS1 environment"
- Kenney: "Medieval" pack, "Fantasy" pack
- KayKit: "Dungeon", "Medieval Builder", "Nature"
- Quaternius: "Medieval Town", "Fantasy"
- Sketchfab: "low poly village", "RPG town"

### 3. TERRAIN / GROUND TILES

**Requirements:**
- Tileable ground textures OR pre-made terrain meshes
- Types needed: grass, dirt path, cobblestone, water edge, plaza/courtyard
- Either 3D mesh tiles that snap together OR flat textures we apply to a plane
- Low resolution (32x32 to 128x128 per tile)
- Format: `.png` textures or `.glb` mesh tiles

**Search focus:**
- Kenney terrain packs
- itch.io: "tileset 3D", "low poly terrain", "RPG ground tiles"
- Tileable texture generators (AI or pre-made)

### 4. NPC MODELS

**Requirements:**
- Variety of NPC characters for populating the world
- Could use same base character model with different textures/skins
- Need NPCs for: shopkeeper, temple oracle/guide, town guard, wandering villagers
- Rigged + animated (at minimum: idle animation)
- Same art style as player characters

**Approach:** Likely re-skin the player character base model with different textures via Nano Banana

### 5. UI / HUD ELEMENTS

**Requirements:**
- RPG-style UI frames, panels, buttons
- Inventory/menu panel backgrounds
- Health/XP bar graphics
- Item slot frames
- Dialog box frames
- PS1/retro RPG aesthetic
- Format: `.png` with transparency, SVG, or CSS-recreatable

**Search locations:**
- itch.io: "RPG UI pack", "pixel UI", "retro game UI"
- Kenney: "UI Pack RPG"
- OpenGameArt: "RPG interface"

### 6. ITEM ICONS

**Requirements:**
- Small icons for: clothing items, accessories, badges, achievement icons
- Consistent style across all icons
- 32x32 or 64x64 pixel size
- PS1/retro RPG feel

**Approach:** Likely AI-generated via Nano Banana for consistency, but search for base packs to establish the style

### 7. SOUND EFFECTS & MUSIC (BONUS — low priority)

**If available:**
- Footstep sounds (grass, stone, wood)
- Door open/close
- UI click/select sounds
- Ambient background music (cozy RPG village)
- PS1-era MIDI-style music

---

## TECHNICAL CONSTRAINTS

### Must Work With:
- **Three.js / React Three Fiber** — all 3D models must be loadable via `useGLTF` or `useFBX` from `@react-three/drei`
- **Web browser rendering** — models must be lightweight enough for 60fps on mid-range laptops
- **glTF 2.0 format preferred** (`.glb` or `.gltf`) — this is Three.js's native format
- **Embedded animations** — character animations should be baked into the `.glb` file, playable via Three.js `AnimationMixer` or Drei's `useAnimations`

### Performance Budgets:
- Player character: max 500 polygons
- NPC character: max 500 polygons
- Building exterior: max 1500 polygons
- Building interior: max 2000 polygons
- Total scene: aim for under 50,000 polygons visible at once
- Textures: 64x64 to 256x256 max per asset (PS1 style means small textures)
- Target: 60fps on integrated GPU (Intel Iris / Apple M1)

### PS1 Shader Pipeline:
All assets will be rendered through a custom PS1 post-processing pipeline:
- **Vertex snapping:** vertices snap to a low-resolution grid (creates the PS1 "wobble")
- **Affine texture mapping:** textures warp slightly on faces (PS1 didn't have perspective-correct mapping)
- **Low-res render target:** scene renders at ~480x360, then upscaled with nearest-neighbor filtering
- **Dithered transparency:** instead of smooth alpha, use ordered dithering
- **Color depth reduction:** posterize colors to simulate limited color palette

This shader pipeline means assets DON'T need to be perfect — the shader will "PS1-ify" everything and create visual cohesion even across assets from different sources.

---

## LICENSING REQUIREMENTS

- **Must allow:** Commercial use, modification, redistribution as part of a web application
- **Acceptable licenses:** CC0, CC-BY, CC-BY-SA, MIT, Apache, custom commercial licenses
- **Not acceptable:** CC-NC (non-commercial), GPL (copyleft concerns for web apps), "personal use only"
- **Note:** We will be modifying/re-texturing assets, so modification rights are essential

---

## DELIVERABLES EXPECTED FROM RESEARCH

For each asset pack or resource found, provide:

1. **Name and URL**
2. **Creator/author**
3. **License type** (with commercial use confirmation)
4. **Price** (free or cost)
5. **Format** (file types included)
6. **Polygon count** (if known)
7. **Rigged/animated?** (for characters)
8. **Customizable?** (swappable parts, texture-ready)
9. **Style match rating** (1-5) — how close to our PS1/chibi/Animal Crossing target
10. **Screenshots or preview links**

### Priority Order for Research:
1. **Rigged + animated character base models** (this is the hardest to find and most critical)
2. **Building/environment packs** (village/town themed)
3. **Terrain/tile sets**
4. **UI element packs**
5. **Props and decorations**
6. **Sound effects**

### Also Research:
- **Three.js PS1 shader implementations** — existing open-source PS1 post-processing shaders for Three.js/R3F
- **Three.js avatar customization systems** — existing libraries or examples for swappable character parts in R3F
- **Isometric/RPG camera rigs** for Three.js — existing R3F components or examples
- **Multiplayer player position sync** — existing solutions for Supabase Realtime + Three.js player movement

---

## CONTEXT ABOUT THE PROJECT

This is a **student club portal for Tethos (TSI)** at University of Western Ontario. When students log into their dashboard, instead of a boring admin panel, they enter a 3D RPG world where buildings represent different tools:

- **HQ** = member directory, announcements, events, admin panel
- **Shop** = spend in-game currency on avatar cosmetics and club merch
- **Oracle Temple** = take a personality test (MBTI) that determines your RPG class
- **Bounty Board** = claim freelance tech work from real clients
- **Job Board** = browse internship/job listings

Players have customizable avatars, earn XP and currency, level up, collect badges, and see other players walking around in real-time. It's Animal Crossing meets a university club management system.

The tech stack is:
- Next.js 16 (App Router)
- React 19
- Three.js + React Three Fiber + Drei (already in the project)
- Supabase (auth, database, realtime)
- Tailwind CSS 4
- Deployed on Vercel

We need assets that are web-optimized and work within these constraints.
