/**
 * Everything a player can reach from the spawn on a smooth world (the v1 seal, sealed.test.ts; the zone plan's review
 * map, scripts/generate-world.ts). The reach is generous on purpose, so a leak it misses is one a player can't find
 * either. On a half-unit lattice:
 * - **walk** to a free neighbour (the walker's `standable`: dry or a deck, no building, barrier, trunk or prop), never up
 *   onto ground too steep to climb (the walker's slope rule) nor up faster than that slope allows between two samples;
 * - **jump** from ground that isn't steep, to the jump's full height straight up;
 * - **glide** (the leaf, assumed owned) from there in any direction, sinking at its glide ratio, over water too, above
 *   whatever is below, and land anywhere free under it, or catch a ledge up to the grab reach above and mantle onto it.
 */
import { islandOf } from "../defaultIsland";
import { MOVE_TUNING } from "../movement/sim";
import { villageSpawnPoint, type Village } from "../villageMap";
import { MAX_CLIMB, type WorldTerrain } from "./terrain";

export const STEP = 0.5;
/** The sim's air step (movement/sim.ts AIR_STEP): a rise this small is stepped onto in the air. */
const AIR_STEP = 0.2;
const SINK = MOVE_TUNING.glideSink / MOVE_TUNING.glideSpeed;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** Every lattice point a player can reach from the spawn, as a mask over the world's grid at STEP. */
export function reach(v: Village & { terrain: WorldTerrain }): { mask: Uint8Array; order: number[]; nx: number; x0: number; z0: number } {
  const t = v.terrain, island = islandOf(v), nx = t.width / STEP, nz = t.depth / STEP, n = nx * nz;
  const px = (i: number) => t.x0 + (i + 0.5) * STEP, pz = (k: number) => t.z0 + (k + 0.5) * STEP;
  const top = new Float32Array(n), free = new Uint8Array(n), steep = new Uint8Array(n);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = px(i), z = pz(k), j = k * nx + i, wet = island.wet(x, z);
    top[j] = wet ? Math.max(island.top(x, z), t.seaLevel) : island.top(x, z);
    free[j] = island.standable(x, z) ? 1 : 0;
    steep[j] = island.steep?.(x, z) ? 1 : 0;
  }
  const mask = new Uint8Array(n), alt = new Float32Array(n).fill(-Infinity), queued = new Uint8Array(n), order: number[] = [];
  const ground: number[] = [], air: number[] = [];
  const [sx, sz] = villageSpawnPoint(v), start = Math.floor((sz - t.z0) / STEP) * nx + Math.floor((sx - t.x0) / STEP);
  /** A ledge to mantle onto: ground that isn't steep, or the lip of a flat top (the sim checks the top it pulls onto is level). */
  const ledge = (b: number, di: number, dk: number) => {
    const bi = b % nx, bk = (b - bi) / nx, c = (bk + dk) * nx + bi + di;
    return !steep[b] || (bi + di >= 0 && bk + dk >= 0 && bi + di < nx && bk + dk < nz && free[c] === 1 && Math.abs(top[c] - top[b]) <= 0.1);
  };
  const land = (j: number) => { if (!mask[j]) { mask[j] = 1; order.push(j); ground.push(j); } };
  land(start);
  while (ground.length || air.length) {
    for (let g = 0; g < ground.length; g++) {
      const a = ground[g], ai = a % nx, ak = (a - ai) / nx;
      for (const [di, dk] of NEIGHBOURS) {
        const bi = ai + di, bk = ak + dk, b = bk * nx + bi;
        if (bi < 0 || bk < 0 || bi >= nx || bk >= nz || mask[b] || !free[b]) continue;
        if (di && dk && !(free[ak * nx + bi] && free[bk * nx + ai])) continue; // no squeezing past a corner
        const rise = top[b] - top[a];
        if (rise > 1e-4 && (steep[b] || rise > Math.hypot(di, dk) * STEP * MAX_CLIMB)) continue;
        land(b);
      }
      // A jump: never from steep ground (stepping off its edge is a walk down).
      const lift = top[a] + MOVE_TUNING.jumpHeight;
      if (!steep[a] && lift > alt[a]) { alt[a] = lift; if (!queued[a]) { queued[a] = 1; air.push(a); } }
    }
    ground.length = 0;
    for (let h = 0; h < air.length; h++) {
      const a = air[h], ai = a % nx, ak = (a - ai) / nx;
      queued[a] = 0;
      for (const [di, dk] of NEIGHBOURS) {
        const bi = ai + di, bk = ak + dk, b = bk * nx + bi;
        if (bi < 0 || bk < 0 || bi >= nx || bk >= nz || top[b] === Infinity) continue;
        const y = alt[a] - Math.hypot(di, dk) * STEP * SINK;
        if (y >= top[b] - AIR_STEP) {
          if (free[b]) land(b);
          if (y > alt[b] + 1e-4) { alt[b] = y; if (!queued[b]) { queued[b] = 1; air.push(b); } }
        } else if (free[b] && y >= top[b] - MOVE_TUNING.grabReach && ledge(b, di, dk)) land(b);
      }
    }
    air.length = 0;
  }
  return { mask, order, nx, x0: t.x0, z0: t.z0 };
}
