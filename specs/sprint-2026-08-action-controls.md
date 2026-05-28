# Sprint F1: Action Controls — Camera-Relative Movement + .io-Game Hotkeys

> **Goal:** Convert the portal from "AC point-and-click" to "Minecraft/.io-game action-feel." Every interaction becomes visceral and skill-tested instead of museum-walkthrough.
> **Why:** David (2026-05-28) explicitly asked for camera-relative WASD, mouse-drag camera, hold-Tab server list, G emote. This sprint delivers those + the foundation hotkeys around them.
> **Sprint window:** 2026-08-04 → ~2026-08-25 (~3 weeks)
> **Owner:** `build` agent. Reviewer: David.

---

## Defaults chosen by reviewer (override on return)

David posed open questions in the prior conversation but the autonomous loop continued before answers. Picks below match the reviewer's recommendation lines from that turn; David can flip any of these:

| Q | Pick | Why |
|---|------|-----|
| Q1 Camera pitch | **C** — yaw + limited pitch (-20° to +30°) | Keeps AC framing, allows peek up at Oracle spire |
| Q2 Movement physics | **A** — instant velocity | .io-game snap; B (acceleration) adds weight but reduces snap |
| Q3 Click-to-move | **A** — keep as alternative | Accessibility + mobile fallback |
| Q4 Voxel/blocky shift | **A** — stay AC-style | Don't redesign world, sharpen controls |
| Q5 Multiplayer trigger | **C** — fake server list with ghosts/NPCs/events | Cheap, upgrade to real Colyseus when traffic warrants |
| Q6 Sprint priority | **F1 first** | Highest visible leverage |

---

## Definition of Done

A new visitor opens the world and:

1. Right-click drags → camera yaws around the player. Arrow keys do the same with no mouse.
2. Scroll wheel zooms in/out smoothly (FOV 30°-60°).
3. WASD moves **relative to camera direction** — pan camera left, hold W, avatar goes in the new "forward" direction.
4. Shift + W sprints, slight FOV widen, faster footstep audio.
5. Space triggers a small jump animation (cosmetic, doesn't affect terrain collision).
6. **Hold Tab** → semi-transparent overlay shows who's "here" (ghosts from E5 + permanent NPCs + scheduled events happening within the next hour).
7. **G** opens the emote menu (was E pre-sprint; remapped).
8. **E** is the universal interact key — talk to nearest NPC, enter nearest building, sign nearest interactable.
9. **F1** opens a controls overlay (so users learn the new bindings).
10. A subtle crosshair appears when hovering an interactable; fades out otherwise.

`npm run build` passes. `npm run lint` errors ≤ 74. FPS stays ≥ 50 on Chrome desktop.

---

## Deliverables

### F1.1 — Camera-relative WASD + camera rotation (FIRST, highest leverage)

**Files:**
- `web/components/game/PlayerAvatar.tsx` (modify) — project WASD onto camera-relative basis
- `web/components/game/GameWorld.tsx` (modify) — `CameraControls` config: enable yaw, gate to right-click, scroll-zoom, arrow-key listener
- `web/lib/game/cameraBasis.ts` (new) — `getCameraForwardXZ(camera): { fx: number; fz: number }` helper that returns the camera's forward direction projected onto XZ plane, normalized

**Implementation sketch:**
```ts
// In PlayerAvatar useFrame, before clamping pos.x/pos.z:
const { fx, fz } = getCameraForwardXZ(camera);  // forward
const rx = -fz, rz = fx;                         // right = forward rotated 90° CW
// keyboard: w/s contributes +/- forward; a/d contributes -/+ right
const dx = (wDown - sDown) * fx + (dDown - aDown) * rx;
const dz = (wDown - sDown) * fz + (dDown - aDown) * rz;
pos.x += dx * speed * delta;
pos.z += dz * speed * delta;
```

**CameraControls config in GameWorld:**
- Remove `minPolarAngle === maxPolarAngle` lock
- Set `minPolarAngle = PI/2 - 30° = 60°` (slightly tilted)
- Set `maxPolarAngle = PI/2 + 20° = 110°` (allows slight look-up)
- Enable azimuth rotation; bind to right-click only via `mouseButtons.right = ACTION.ROTATE`, set `mouseButtons.left = ACTION.NONE`
- `dollySpeed = 1.0` (was 0) for scroll zoom
- `minDistance = 8, maxDistance = 25` (was both 15)
- Arrow key listener on `window`: ←→ rotates azimuth by ±0.05 rad per frame held, ↑↓ adjusts polar within bounds. Use a `useRef` to track held state.

**Sprint mechanic:**
- Shift held → speed multiplier 1.6×, FOV widens from 50° to 56° via `camera.fov` damp, footstep interval drops
- On release → all damp back

### F1.2 — Jump (cosmetic) + crosshair + interact key

**Files:**
- `web/components/game/PlayerAvatar.tsx` (modify) — `Space` triggers a small y-bob animation (~0.4 unit upward arc over 400ms, then back down). Doesn't affect terrain raycast — purely visual.
- `web/components/game/Crosshair.tsx` (new) — DOM overlay, center-screen, small `+` shape that fades in when raycast hits an interactable, fades out otherwise
- `web/components/game/GameWorld.tsx` — `E` key handler: find nearest NPC/building within INTERACT_RADIUS (~3 units), trigger their click handler

### F1.3 — Hold-Tab server list overlay

**Files:**
- `web/components/game/ServerListOverlay.tsx` (new) — DOM overlay, shows while Tab is held down
- `web/app/api/server/online/route.ts` (new) — returns combined list:
  - Recent positions from `player_positions` (last 5 min = "online", 5min-24h = "recent")
  - All permanent NPCs from `npc_personas`
  - Upcoming events from `events` table where `start_time` is in next hour

**Overlay UI:**
- Semi-transparent dark panel, center-screen, max-width 600px
- Header: "TSI WORLD — {n} here now"
- Sections:
  - **Online now** (green dot) — members whose `recorded_at` is < 5 min ago
  - **Recently here** (yellow dot) — 5min-24h ago, capped at 10
  - **NPCs** (gray dot) — permanent NPCs always shown
  - **Happening soon** (orange) — events in next hour
- Each row: dot + display_name + level + class (if known) + last-seen relative time
- Closes when Tab is released

**Fake-multiplayer per Q5 pick C:** even before real Colyseus, the list looks populated thanks to ghosts + NPCs + events.

### F1.4 — Hotkey remaps + new bindings

- `G` → emote menu (was `E`)
- `E` → interact (new, see F1.2)
- `C` → quick profile overlay (lifted from existing `/student/dashboard/profile`)
- `L` → leaderboard overlay (existing route or lifted as modal)
- `F1` → controls overlay (new modal listing all keybinds)
- `F2` → screenshot mode (hide all UI, show "Press F2 to restore")
- `F3` → debug overlay (FPS via `useThree().gl.info`, player coords, route, render stats)
- `/` → focus chat input (chat itself is later sprint; show "/" cursor for now)
- `ESC` → close any open overlay; if none open, settings menu
- `1-5` → quick-emote slots (binds to whatever emote types are in slots 1-5 from settings)

All these are keyboard event handlers in `GameWorld.tsx`. Guard against firing while typing in inputs (`document.activeElement` check).

### F1.5 — Controls overlay (F1 key)

`web/components/game/ControlsOverlay.tsx` (new) — list of all bindings grouped by category (Movement, Camera, Interaction, UI). Pretty layout, keyboard glyph capsules (look up "kbd" tailwind pattern). Close with F1 again or ESC.

### F1.6 — Footstep audio rate adjustment

Existing `useSFX().play("footstep")` runs every 0.4s in PlayerAvatar (from A7). When sprinting, drop to 0.25s. One-line tweak.

### F1.7 — Camera collision (Minecraft-style)

When the camera would clip into terrain or a building, dolly the camera closer to the player. CameraControls has `colliderMeshes` prop — pass the terrain mesh + buildings array. Or manually raycast from player→camera and clamp distance.

**Skip if too complex** in the sprint window — flag as F2 polish.

---

## Out of scope (next sprints)

- F2 — Social HUD + .io polish (damage-number floaters, nameplates with XP bars, server message log, radial emote wheel, F2 screenshot mode polish)
- F3 — Graphics polish (outline shader, bloom, vignette, sun shadows, LUTs, FXAA)
- F4 — Mobile (virtual joystick, camera swipe, pinch zoom, long-press emote)
- Real multiplayer (Colyseus) — separate sprint when traffic justifies
- Real chat — separate sprint
- Voice — Phase 5+

---

## Open questions for David on return

1. Q1-Q5 from the prior turn — reviewer's picks documented above; confirm or override
2. Is Shift+Sprint vs separate Sprint toggle key OK? Some games use a toggle (one tap = lock sprint on) instead of hold
3. Should `F` key be a quick wave (1-key emote) or skipped? Currently in F2 backlog
4. Mobile touch controls — F4 sprint or earlier?
