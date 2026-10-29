# Round 3 redo: the plaza benches (new world)

David, round 3: "make sure the bench location and orientation is fitting". The four sittable benches (bench-0 to bench-3) had no yaw, so each lay along x: bench-0 and bench-1 across the plaza's paving rings, bench-2 and bench-3 out on the grass past the rim, bench-3 inside a path shrub and fence.

Now each sits on the stone just inside the plaza's edge (11 from the fountain), along the rim, its back to the grass and a flag pole behind it, its front (local +z, where benchSeat seats you from the plaza) at the fountain: either side of the way in from the jetty and of the way to HQ. `lib/game/world/generate.ts` (LAYOUT, rimBench), `data/world/world.json` regenerated (only the four bench lines changed). Test: `lib/game/world/world.test.ts`.

| Bench | Before (x, z, yaw) | After (x, z, yaw) |
|---|---|---|
| bench-0 | 21, 46, 0 | 20.29, 44.84, 1.0823 |
| bench-1 | 21, 54, 0 | 20.29, 55.16, 2.0593 |
| bench-2 | 43.5, 44, 0 | 39.71, 44.84, -1.0823 |
| bench-3 | 43.5, 56, 0 | 39.71, 55.16, -2.0593 |

Shots (`specs/evidence/remodel/tools/benches.mjs`): round 3's camera (az 200, el 22, k 1.5; bench-0 the exact one), mirrored for bench-1 and bench-3; bench-2 and bench-3 moved out of that frame, so their after is framed on the new spot.

| File | What |
|---|---|
| `bench-N-before.webp` / `bench-N-after.webp` | Each bench before and after. |
| `top-before.webp` / `top-after.webp` | The plaza from above, the four benches ringed. |
| `sit-after.webp` | The player sat on bench-0 (E beside it), facing the fountain. |
