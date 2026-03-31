# Research: Animal Crossing-Style Three.js / R3F Implementations

> Backend agent research — reference for Frontend game world implementation.

---

## Top Repos by Feature

| Feature | Repo | Stars | URL |
|---------|------|-------|-----|
| Tile-based world + R3F | coldi/r3f-game-demo | 655 | https://github.com/coldi/r3f-game-demo |
| AC curved world shader | mjurczyk CodePen | — | https://codepen.io/mjurczyk/pen/LYNqzxa |
| Grid + multiplayer | wass08/r3f-sims-online-final | 43 | https://github.com/wass08/r3f-sims-online-final |
| Character controller | pmndrs/ecctrl | 695 | https://github.com/pmndrs/ecctrl |
| Physics-free controller | pmndrs/BVHEcctrl | — | https://github.com/pmndrs/BVHEcctrl |
| Day/night cycle | Complete Sky System | — | https://codepen.io/the-red-reddington/full/MYKRZNN |
| Isometric map lib | nicolas-jaussaud/discore | 7 | https://github.com/nicolas-jaussaud/discore |
| NPC AI / proximity | ssethsara/react-three-npc | 12 | https://github.com/ssethsara/react-three-npc |
| City builder | dgreenheck/simcity-threejs-clone | 242 | https://github.com/dgreenheck/simcity-threejs-clone |
| Toon shading | manbust/three-js-toon-shader | — | https://github.com/manbust/three-js-toon-shader |
| Blender→browser world | Codrops tutorial | — | https://tympanus.net/codrops/2025/04/08/3d-world-in-the-browser-with-blender-and-three-js/ |

---

## 1. Terrain / World Building

### coldi/r3f-game-demo (655 stars, MIT)
The gold-standard R3F tile-based game. String-based map system (`#` = wall, `.` = floor). `TileMap` converts strings to 2D grids. `GameObject` component (Unity-inspired) with composable `Script` components (Moveable, Collider, Interactable). A* pathfinding for click-to-move. No physics engine — collision is pure tile-position logic.

**Walkthrough:** https://dev.to/flagrede/making-a-2d-rpg-game-with-react-tree-fiber-4af1

### Curved World Effect (AC Signature)
The defining AC visual. Vertex shader displaces Y based on Z-distance squared:
```glsl
vec3 vShift = vec3(0.0, pow2(vWorld.z) * -0.15, pow2(vWorld.z) * -0.3);
```
**Analysis:** https://alastaira.wordpress.com/2013/10/25/animal-crossing-curved-world-shader/

`_Curvature` uniform defaults to 0.001. For spherical (both axes): `((vv.z * vv.z) + (vv.x * vv.x)) * -_Curvature`.

### wass08/r3f-sims-online-final (Wawa Sensei)
Full Sims/AC-like multiplayer. Grid-based object placement, PathFinding.js, room builder, Socket.io. **7-part tutorial series:** https://wawasensei.dev/tuto/build-a-multiplayer-game-with-react-three-fiber-and-socket-io

### Baked Lighting Approach (Codrops)
Bake all lighting in Blender at 4096x4096, convert to `MeshBasicMaterial` (zero runtime lighting cost). Compress with KTX. Highest performance for static scenes.

---

## 2. Camera Systems

### Isometric Camera in R3F
- **Drei `OrthographicCamera`** — standard approach with `zoom`, `position` props
- **Drei `CameraControls`** — auto-adapts for orthographic, supports min/max zoom
- For semi-isometric AC feel: **PerspectiveCamera at fixed 45-60° elevation, narrow FOV, + curved world shader**

### Character Follow Cameras
- **ecctrl** — dynamic follow with collision detection, `FixedCamera` mode, `PointToMove`
- **BVHEcctrl** — physics-free, uses `CameraControls` from drei for collision
- **Codrops approach** — waypoints on `CatmullRomCurve3`, quaternion `slerp` for rotation

---

## 3. Lighting

### Drei Shadow Components
- `<AccumulativeShadows>` — jittered multi-frame, best for static scenes, `temporal` option
- `<ContactShadows>` — beautiful ground-contact, expensive
- `<SoftShadows>` — quick setup, edits shadow `radius` + `blurSamples`
- Shadow map type: `PCFSoftShadowMap` is the balanced choice

### Warm/Cozy Atmosphere
- `<Environment preset="sunset">` — ready-made HDRI
- `<Sky>` — sun at `[100, -5, 100]` (dawn) or `[-100, -5, 100]` (dusk) with high turbidity
- `MeshToonMaterial` for stylized look

### Day/Night Cycle
**jeromeetienne/threex.daynight** (32 stars) — 4 modular components driven by single `sunAngle`:
- SunSphere, SunLight, Skydom (shader-based color transitions), StarField
- Time loop: `sunAngle += delta/dayDuration * Math.PI * 2`

**Complete Sky System** — sun/moon, smooth transitions, procedural clouds, starfield, lensflare, auto-synced DirectionalLight.

---

## 4. Character Movement

### WASD / Keyboard
- **ecctrl** (695 stars) — WASD + arrows, space jump, shift sprint. Rapier physics. Spring-damping float. Animation integration: idle/walk/run/jump/fall + 4 custom.
- **BVHEcctrl** — no physics, BVH collision. Walk 3u/s, run 5u/s. Handles stairs/slopes.
- **Framerate-independent pattern:** `useFrame((state, delta) => {...})`, multiply direction × delta

### Click-to-Move / Pathfinding
- **coldi/r3f-game-demo** — A* on tile grid, sequential events (attempt-move → moving → moved)
- **Wawa Sensei** — PathFinding.js on grid, smooth interpolation between points
- **Yuka pathfinding** — https://codesandbox.io/s/react-three-fiber-yuka-pathfinding-ic4fg

---

## 5. Building / Object Interaction

### Proximity Detection
- **coldi/r3f-game-demo** — `Interactable` component: `interact()`, `onInteract()`, `canInteract()`. `ScenePortal` for scene transitions.
- **R3F built-in** — `onPointerOver`/`onPointerOut` for hover. Distance checks in `useFrame()`.
- **react-three-npc** — Yuka.js for waypoint roaming, target following, navmesh generation

---

## 6. Key Resources

### Tutorials
- **Wawa Sensei R3F Sims (7 parts):** https://wawasensei.dev/tuto/build-a-multiplayer-game-with-react-three-fiber-and-socket-io
- **Codrops 3D World:** https://tympanus.net/codrops/2025/04/08/3d-world-in-the-browser-with-blender-and-three-js/
- **Bruno Simon Three.js Journey:** https://threejs-journey.com/
- **ECS pattern with R3F:** https://douges.dev/blog/simplifying-r3f-with-ecs

### pmndrs Ecosystem
- react-three-fiber, drei, ecctrl, BVHEcctrl, react-three-rapier, react-three-next

---

## Recommendations for TSI Game World

1. **Curved world shader** — add the AC-style vertex displacement. Simple `onBeforeCompile` patch, high visual impact.
2. **coldi/r3f-game-demo patterns** — `GameObject` + `Script` composition is clean and fits R3F well.
3. **BVHEcctrl > ecctrl** for our use case — we don't need full physics, just collision with terrain/buildings.
4. **Baked lighting** — consider baking in Blender for the static campus. Runtime lights only for dynamic elements (player glow, building lamps).
5. **PathFinding.js** for click-to-move — proven approach from Wawa Sensei's series.
6. **Day/night cycle** — low-hanging fruit for atmosphere. `threex.daynight` or the Complete Sky System.
