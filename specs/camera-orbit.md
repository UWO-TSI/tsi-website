# Orbit camera (row 277)

David, 2026-10-01:

> "I want you to add camera movement with mouse or arrow keys now, similar to roblox camera movement, just so that game movement is more intuitive so make mouse movement camera movement"

Then: "does that change anything about the game like do we need to restructure the world anyway". The answer is no: the grid, the map file, the movement sim and the server stay as they are. The fixed west-facing camera (rows 5, 154, 239) is an assumption in several systems, though, and this pass updates each of them.

## Today
- `useFollowCamera` (`web/components/game/IslandAtmosphere.tsx:119-122`) is a rigid follow at a fixed yaw (facing west), with zoom (Z) and an overview.
- The movement input is fixed to that view. The dash and glide steer camera-relative to a camera that never turns.
- The curved-world bend (`web/lib/game/curvedWorld.ts`) works in view space, so it follows a turning camera already.

## The camera
- **Rotate:** hold the right mouse button and drag to orbit around the player, Roblox style. The left button stays tap-to-walk, and the attack in the ruins. Arrow keys ← → rotate, ↑ ↓ tilt. Scroll wheel and Z zoom. Touch: drag with two fingers.
- **Tilt:** a band from a little steeper than today down to a lower, more horizontal view. Pick the band so the horizon only shows where the sky and sea are finished (see World).
- **Feel:**
  - Smoothed (a short ease, no lag behind the player); a sensitivity setting in Settings.
  - The default view is today's (facing west), and a key or a double-tap snaps back to it.
  - The camera remembers your angle per device.
- **Controls follow the camera:** W is "away from the camera". The run, dash, slide, glide and tap-to-walk all use the camera's yaw. The sim stays the same; only the input transform changes.
- **Things in the way:** a building or tree between the camera and the player fades to see-through, rather than the camera snapping in.
- **Where:**
  - On in the village, the home island and the ruins (the mouse still aims at the cursor; right-drag rotates).
  - Interiors keep today's fixed view: they are built as cutaway dioramas (the home has no front wall, the café ceiling is cut away), so a turning camera would show the missing walls.
  - The applicant island (recruitment, live in production) keeps the fixed camera unless David says otherwise.
- **Multiplayer-forward:** the camera is per player and never part of world state. World effects are already shared and don't depend on any camera (look spec §7).

## What changes because the camera turns
1. **Minimap:** turns with the camera (or shows a view cone) so up on the map matches the view; the north marker follows.
2. **The world's edge and the horizon:**
   - Looking out to sea from any side shows the map's edge.
   - The sea runs to the horizon; fog and the far plane hide the edge.
   - A sky dome shows at the lowest tilt, matched to the time of day and weather.
   - Check the shadow, fog and cloud extents (sized to the map, row 241) from every angle.
3. **Back sides:** every outdoor building, cliff piece, prop and sign is now seen from all sides. Audit each one for open backs, missing faces, hard-coded single-sided materials or labels that only read from the west, and fix them. List anything that needs new art in the questions file.
4. **Lighting:** the sun and the water sparkle are physical, so they just work. Sparkle appears when you look toward the sun. Check that nothing assumes the camera faces west: the backlit fill lift (row 253, `lookPreset.ts`), the grade, and the cloud dimming.
5. **Labels and UI:** nameplates and prompts face the camera. Prompt hints that say "west" or assume a direction get reworded.
6. **The island painter:** the "game view" orientation (row 241) stays as the default view. Add a way to turn the view in `/lab/island?draft=1` so David can check his design from every side.
7. **Performance:** looking along the island shows more at once than today's tilt. Measure FPS at the lowest tilt in the busiest directions, and use the existing LOD and culling where it's needed.

## Build order (a commit each)
1. The camera rig, input and settings.
2. Camera-relative controls everywhere.
3. Occluder fade.
4. Minimap.
5. Horizon, fog and sky.
6. The back-side audit and fixes.
7. Lighting check.
8. Painter rotate.
9. Performance.

## Evidence
`specs/evidence/camera-orbit/`:
- the village from four directions at default and lowest tilt;
- a rotate-and-walk frame strip;
- the occluder fade;
- the minimap turning;
- the horizon at each time of day;
- the back-side audit before and after;
- FPS per direction.
