/**
 * Ripple rings on the water (v1 water item 3, specs/v1-drop.md §8c.2), from our particle pack's ripple (pack.ts),
 * thrown into the scene's instanced particle pool. Fish jumps (AmbientFauna) and bobbers (fishingFx) already throw
 * theirs; this adds the waterfalls' and the steps in the shallows'. A waterfall is derived from the map, never placed
 * (CLAUDE.md rule 4): wherever water stands beside lower water, it falls into it, and its rings start at the foot.
 * When a ring is due is a function of the world clock and the spot (look spec §7.1): every client sees the same.
 */
import { FACE, seedAt, type ParticlePool, type Recipe } from "./fx/particles";
import { LEVEL_STEP, ORTHOGONAL, WATER_DROP, cellToWorldX, cellToWorldZ, inBounds, isWater, levelAt, surfaceAt, type IslandMap } from "./grid";

export interface WaterfallBase {
  /** Where the falling water meets the water below (world), and the lower water's surface. */
  x: number; y: number; z: number;
  /** How far it falls (world units): bigger falls throw bigger rings. */
  drop: number;
  /** Its own phase on the world clock (seconds), from where it is. */
  phase: number;
}

/** The foot of every waterfall on a map: one per pair of orthogonal water cells a level or more apart. */
export function waterfallBases(map: IslandMap): WaterfallBase[] {
  const out: WaterfallBase[] = [];
  for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
    if (!isWater(surfaceAt(map, cx, cz))) continue;
    const high = levelAt(map, cx, cz);
    for (const [dx, dz] of ORTHOGONAL) {
      const nx = cx + dx, nz = cz + dz;
      if (!inBounds(map, nx, nz) || !isWater(surfaceAt(map, nx, nz))) continue;
      const low = levelAt(map, nx, nz);
      if (low >= high) continue;
      // On the shared edge, a little out into the lower water (where the falling water lands).
      const x = (cellToWorldX(map, cx) + cellToWorldX(map, nx)) / 2 + dx * 0.2, z = (cellToWorldZ(map, cz) + cellToWorldZ(map, nz)) / 2 + dz * 0.2;
      out.push({ x, z, y: low * LEVEL_STEP - WATER_DROP, drop: (high - low) * LEVEL_STEP, phase: ((Math.abs(seedAt(x, z, 91)) % 1000) / 1000) * 2 });
    }
  }
  return out;
}

/** Whether a ring with this `period` (s) and `phase` (s) falls due between world times t0 and t1. */
export const rippleDue = (t0: number, t1: number, period: number, phase: number) => Math.floor((t1 + phase) / period) > Math.floor((t0 + phase) / period);

const FALL_RING: Recipe = { sprite: "ripple", count: [1, 1], life: [1.1, 1.4], size: [0.6, 0.8], grow: 2.4, speed: [0, 0.05], spread: Math.PI, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.6, face: FACE.ground };
const STEP_RING: Recipe = { sprite: "ripple", count: [1, 1], life: [0.7, 0.85], size: [0.32, 0.4], grow: 2.1, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.6, face: FACE.ground };
export const RING_TINT = 0xe4f4fb;

/** A waterfall's ring, as it comes due (`n`: which one, so each is its own throw). */
export function waterfallRing(pool: ParticlePool, b: WaterfallBase, n: number) {
  pool.burst(FALL_RING, b.x, b.y + 0.012, b.z, b.y, 0, 0, Math.min(1.6, 0.8 + b.drop * 0.25), RING_TINT, seedAt(b.x, b.z, 95 + (n % 64) * 7));
}
/** A step in the shallows: a small ring spreading from the foot (`y`: the water's surface there). */
export function stepRing(pool: ParticlePool, x: number, y: number, z: number, amount = 1) {
  pool.burst(STEP_RING, x, y + 0.015, z, y, 0, 0, amount, RING_TINT, seedAt(x, z, 97));
}
/** How often a waterfall throws a ring (s). */
export const FALL_PERIOD = 0.42;
