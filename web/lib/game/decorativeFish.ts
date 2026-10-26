/**
 * Decorative fish (v1 water item 6, specs/v1-drop.md §8c.6): small schools gliding in the shallows, seen through the
 * clear water as in the references. Scenery only: they cannot be caught and they mark no fishing spot (they keep away
 * from them). Each school swims a loop that lies wholly in the shallows, placed by the map (seeded by where it is);
 * where each fish is at a moment is a function of the world clock (look spec §7.1), so every client sees the same fish
 * in the same place. Drawn as one instanced mesh (components/game/water/DecorativeFish.tsx).
 */
import { LEVEL_STEP, WATER_DROP, cellToWorldX, cellToWorldZ, isGroundAtWorld, isWater, levelAt, surfaceAt, type IslandMap, type ShoreSdf } from "./grid";
import { seabedDip } from "./seabed";

/** The depths of water a school's whole loop keeps to (world units over the bed). */
export const FISH_DEPTH = [0.24, 1.7] as const;
/** Each school's colours (sRGB hex, over the white model): silver-blue, a warm orange, yellow, teal. */
export const FISH_TINTS = [0xa8c4d8, 0xf09a52, 0xf2d06a, 0x7cc9bf] as const;

export interface FishSchool {
  /** The loop: an ellipse round (cx, cz), radii a (along its turn) and b, turned by `turn` (radians). */
  cx: number; cz: number; a: number; b: number; turn: number;
  /** How many fish, how fast they glide (u/s), which way round (1 or −1), where on the loop at world time 0. */
  count: number; speed: number; dir: number; phase: number;
  /** Its colour (FISH_TINTS) and each fish's size. */
  tint: number; size: number;
}

/** A fish's place and heading (rotation about +y, the model's nose along +z), into `out`. */
export interface FishPose { x: number; y: number; z: number; yaw: number }

function random(seed: number) {
  let h = seed | 0;
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How far a fish swims out from the loop's line, and how far below the surface (each fish its own, fixed). */
function fishOffset(s: FishSchool, k: number): [number, number, number] {
  const r = random(Math.imul(k + 1, 0x9e3779b1) ^ Math.round(s.cx * 97 + s.cz * 31));
  return [(r() - 0.5) * 0.36, 0.14 + r() * 0.12, r() * Math.PI * 2];
}

/** Where fish `k` of a school is at world time `t` (s), into `out`. */
export function fishAt(s: FishSchool, k: number, t: number, out: FishPose): FishPose {
  const [lateral, under, wig] = fishOffset(s, k);
  // Along the loop by arc length (roughly: the ellipse's mean radius), the school strung out behind its leader.
  const mean = (s.a + s.b) / 2, th = s.phase + s.dir * ((s.speed * t) / mean - k * 0.32 / mean - 0.05 * Math.sin(t * 0.7 + wig));
  const c = Math.cos(th), sn = Math.sin(th), ct = Math.cos(s.turn), st = Math.sin(s.turn);
  // The point on the ellipse and the way round it (its tangent), in the loop's own frame, then turned.
  const ex = s.a * c, ez = s.b * sn, tx = -s.a * sn * s.dir, tz = s.b * c * s.dir, tl = Math.hypot(tx, tz) || 1;
  const nx = tz / tl, nz = -tx / tl, lat = lateral + 0.05 * Math.sin(t * 1.3 + wig);
  const lx = ex + nx * lat, lz = ez + nz * lat;
  out.x = s.cx + lx * ct + lz * st;
  out.z = s.cz - lx * st + lz * ct;
  out.y = -WATER_DROP - under - 0.02 * Math.sin(t * 0.9 + wig);
  const wx = tx * ct + tz * st, wz = -tx * st + tz * ct;
  out.yaw = Math.atan2(wx, wz);
  return out;
}

/** Whether a loop lies wholly in the shallows (with the school's spread either side of its line). */
function fits(map: IslandMap, shore: ShoreSdf, s: FishSchool, skip?: (x: number, z: number) => boolean) {
  const ct = Math.cos(s.turn), st = Math.sin(s.turn);
  for (let i = 0; i < 28; i++) {
    const th = (i / 28) * Math.PI * 2;
    for (const grow of [0.78, 1, 1.22]) {
      const lx = s.a * Math.cos(th) * grow, lz = s.b * Math.sin(th) * grow, x = s.cx + lx * ct + lz * st, z = s.cz - lx * st + lz * ct;
      if (isGroundAtWorld(map, x, z) || skip?.(x, z)) return false;
      const dip = seabedDip(map, shore, x, z);
      if (dip < FISH_DEPTH[0] + 0.02 || dip > FISH_DEPTH[1] - 0.02) return false;
    }
  }
  return true;
}

/**
 * The map's schools: tried at seeded spots over the sea's shallows (level-0 water), each kept if its whole loop stays
 * in the shallows, clear of `avoid` (the fishing spots, the wharf) and 6 u from the others, half of them round `near`
 * where it can. `lite`: a third as many, smaller schools.
 */
export function fishSchools(map: IslandMap, shore: ShoreSdf, { avoid, lite = false, max = 12, near = [] }: { avoid?: (x: number, z: number) => boolean; lite?: boolean; max?: number; near?: readonly (readonly [number, number])[] } = {}): FishSchool[] {
  const r = random(0x51f15e), out: FishSchool[] = [], want = lite ? Math.ceil(max / 3) : max;
  const cells: [number, number][] = [];
  for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
    if (!isWater(surfaceAt(map, cx, cz)) || levelAt(map, cx, cz) * LEVEL_STEP !== 0) continue;
    const x = cellToWorldX(map, cx), z = cellToWorldZ(map, cz), dip = seabedDip(map, shore, x, z);
    if (dip > 0.45 && dip < 1.3) cells.push([x, z]);
  }
  // Half the tries round the `near` spots (the new world's reefs), where there are cells there.
  const by = cells.filter(([x, z]) => near.some(([nx, nz]) => Math.hypot(x - nx, z - nz) < 6));
  for (let tries = 0; tries < 600 && out.length < want && cells.length; tries++) {
    const from = by.length && r() < 0.5 ? by : cells, [x, z] = from[Math.floor(r() * from.length)];
    const a = 1.1 + r() * 1.6, s: FishSchool = {
      cx: x + (r() - 0.5) * 0.8, cz: z + (r() - 0.5) * 0.8, a, b: a * (0.45 + r() * 0.35), turn: r() * Math.PI,
      count: lite ? 4 + Math.floor(r() * 2) : 6 + Math.floor(r() * 4), speed: 0.45 + r() * 0.35, dir: r() < 0.5 ? 1 : -1,
      phase: r() * Math.PI * 2, tint: FISH_TINTS[Math.floor(r() * FISH_TINTS.length)], size: 0.85 + r() * 0.4,
    };
    if (out.some(o => Math.hypot(o.cx - s.cx, o.cz - s.cz) < 6)) continue;
    if (!fits(map, shore, s, avoid)) continue;
    out.push(s);
  }
  return out;
}
