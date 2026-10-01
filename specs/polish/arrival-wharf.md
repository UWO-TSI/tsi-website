# Polish: arrival, wharf and home island

Audit: `audit-spaces-life.md` (home island, wharf, boat arrival, move target) and its spec C. Paths under `web/components/game/`. The standard is in `README.md`. Needs the particle pack (`specs/movement-feel.md`). The flow around it (creator → arrival → HQ greeting) is `hud-first-login.md`. Sailing yourself waits (row 267); this is the scripted trip only.

## Problems
- **Wharf:** flat-colour box planks, cylinder posts and rail (`WharfPier.tsx:31-53`). No boat, rope or buoy, though `public/assets/acnh/props/boat.glb`, `buoy.glb` and `buoy-rope.glb` exist. The end rail sits at Z1 (`:44`), which may be the land end; check it against the map.
- **Boat travel:** a 320 ms fade and teleport (DIW:617). First login has no arrival (row 211).
- **Home island:** the "dock" is a sign plus an HTML label on sand (`home/HomeIslandScene.tsx:94-95`). No pier, no boat, no life (life is `living-village.md`).
- **Move target:** two flat yellow rings and a dot (`MoveTargetIndicator.tsx:76-107`). These are the rings David rejected (row 273). The marker is unlit, so it glows at night, and it doesn't follow slopes.

## Deliverable, in order (a commit each)
1. **Wharf:** textured, weathered planks and posts modeled in Blender (matte); rope along the rail; the buoys; the boat docked and bobbing on the water with the shared wave height. Fix the rail end.
2. **Home-island pier** at `HOME_DOCK`, matching, with the boat able to dock there. Replace the sign and HTML label.
3. **The trip:**
   - Boarding: walk onto the boat at the wharf.
   - A short scripted sail across the sea toward the other island (village ↔ home): camera framing, the wake and bow spray from the particle pack, wind and water sounds.
   - Arrival at the other dock.
   - It waits for the next scene to load before docking. Skippable with a tap or key.

   The first-login arrival uses the same trip, ending at the village wharf for the HQ greeting.
4. **Move target:** a soft marker painted from the particle pack that lies on the ground's slope, is lit like the world, fades in and out, and dims at night.

## Evidence
`specs/evidence/polish-arrival/`: the wharf and home pier, day and night; the trip as a frame strip both ways; the first-login arrival; the move target on a slope at night.
