# Known foundational defects (measured 2026-07-26)

> Moved out of `CLAUDE.md` on 2026-10-22, unchanged. Several rows name the deleted `GameWorld.tsx`; re-measure on `DefaultIslandWorld` before acting on any of them.

## Known foundational defects (measured 2026-07-26, not yet fixed)

> D2, D3, D6 and the `GameWorld.tsx` half of D8 went with the legacy world (deleted 2026-09-27); re-measure them on `DefaultIslandWorld` before acting.

Do not "fix" the symptoms of these by adding another layer. Each has a documented
root cause in the file that owns it. Full detail:
`specs/investigation-2026-07-26-foundations.md`.

| # | Defect | Owner file | Evidence |
|---|---|---|---|
| D1 | Curved-world patch corrupts the shadow map — caster bent in light space, receiver looks up unbent, error grows with distance and changes as the player walks | `lib/game/curvedWorld.ts` | header note; three r182 `depth.glsl.js:37` |
| D2 | Road tiles overlap 11% — `CELL = 0.89` on a 1.0u tile, coplanar at 0.0005u thick, z-fights | `components/game/RoadTiles.tsx` | header note |
| D3 | Key:fill is 1.08:1 → a 2.2:1 contrast ratio, ~1.1 stops. Form cannot read. Key 1.40 vs ambient 0.35 + hemi 0.40 + 2nd directional 0.15 + env IBL 0.40 | `GameWorld.tsx` `TOD_KEYS` + lights | target ≈ 4:1, cut fill to ~0.50 |
| D4 | Grade compensates in the WRONG direction — `uDesat 0.14` and `uBlackLift` on an already-flat render | `components/game/PostFX.tsx` | retune after D3, not before |
| D5 | 12 shipped GLBs are missing meshes, including all 4 river banks (lost their ground plane) and the trees' baked `mShadow` layers | `scripts/organize-dump.mjs` | header note |
| D6 | Camera FOV 48 is a wide lens; the diorama read needs ~28-32° and more distance. Wide FOV also amplifies the view-space bend at screen edges | `GameWorld.tsx:2668` | pairs with D1 fix (a) |
| D7 | React setState on the per-frame path — `onMove(pos.clone())` inside useFrame re-renders 7 Buildings with `<Html>` pills at 60fps. `playerPosRef` already exists next to it | `components/game/PlayerAvatar.tsx:600` | read the ref; throttle the setState |
| D8 | M1 budget: `dpr={[1,2]}` = 4x fragments on Retina; realtime shadow map still on despite the ~7 FPS note; bloom auto-enables because `navigator.deviceMemory` is absent in Safari and capped at 8 in Chrome | `GameWorld.tsx:2668`, `lib/game/useGraphicsSettings.ts` | gate on a real FPS probe |

Live-scene budget for context: 108 GLB URLs carrying 220 primitives, **209 distinct
materials**, 134,817 vertices. Vertices are free on an M1; the ~400-500 draw calls with
a material change on each are the wall. `THREE.BatchedMesh` and `THREE.LOD` both ship
in the installed three r182 and are unused; there is no texture atlas.
