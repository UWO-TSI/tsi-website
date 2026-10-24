/**
 * HQ's faked light (specs/interiors/hq.md, "Lighting stays cheap"): the warm pools the lamps throw, the washes the
 * track spots put on the walls and the floor, and the aquarium's blue glow on the lounge in front of it. They're soft
 * additive patches drawn in one mesh per floor, upstairs one per part (components/game/hq/LampPools.tsx), not lights: the room has only a
 * few real ones. Everything here is from the layout's numbers (lib/game/hqLayout.ts), so the light moves with the
 * lamps.
 */
import { HQ, HQ_FLOOR_HEIGHT as F, HQ_ROOM, type HqOption, type Level, type WallFace } from "./hqLayout";

/** "up": lying on a floor or a table top; "-z" / "+z": on the back or the front wall, facing the room; "-x" / "+x": on a
 * side wall. */
export type PoolFace = "up" | WallFace;
export interface Pool {
  id: string;
  /** The floor it belongs to; upstairs, the part of the upper floor (cut away with it). */
  level: Level;
  part: number;
  /** Its middle, in room space (absolute height). */
  at: [number, number, number];
  face: PoolFace;
  /** Its half size across its face: along x then z (up), or across the wall then up it. */
  half: [number, number];
  color: string;
  /** Its brightness at night (by day the lamps ease down: lib/game/interiorLight.ts `lamps`). */
  strength: number;
}

const WARM = "#ffd29a", SPOT = "#ffe3bd", WATER = "#4cc4f2";
/** A pool lies a hair over the rugs (the thickest is 0.036) so it shows on them. */
const LIFT = 0.045;
/** How near a wall a spot's aim must be to wash it, and a floor lamp must stand to light the wall behind it. */
const NEAR_WALL = 0.7, LAMP_NEAR_WALL = 1.2;

/** Which part of the upper floor a point upstairs is on (0 when none). */
const partAt = (o: HqOption, x: number, z: number) => Math.max(0, o.upper.findIndex(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1));
/** The wall a point stands by (within `near`), as the way its face looks into the room; null in the open. */
function wallBy(x: number, z: number, near: number): WallFace | null {
  const { halfW: W, halfD: D } = HQ_ROOM;
  const gaps: [number, WallFace][] = [[W - x, "-x"], [x + W, "+x"], [D - z, "-z"], [z + D, "+z"]];
  const [gap, face] = gaps.reduce((a, g) => (g[0] < a[0] ? g : a));
  return gap <= near ? face : null;
}
/** A point on a wall (its face) a hair into the room, at height y, across from (x, z). */
function onWall(face: WallFace, x: number, y: number, z: number): [number, number, number] {
  const { halfW: W, halfD: D } = HQ_ROOM;
  return face === "-x" ? [W - 0.07, y, z] : face === "+x" ? [-W + 0.07, y, z] : face === "-z" ? [x, y, D - 0.07] : [x, y, -D + 0.07];
}

export function hqPools(o: HqOption = HQ): Pool[] {
  const out: Pool[] = [];
  for (const lamp of o.lamps) {
    const base = lamp.level * F, [x, y, z] = lamp.light, part = lamp.level ? lamp.part ?? partAt(o, x, z) : 0;
    // The floor round it: wide and soft (David, 2026-10-22: "lightsings should fade a little lighter").
    out.push({ id: `${lamp.id}:floor`, level: lamp.level, part, at: [x, base + LIFT, z], face: "up", half: [lamp.pool, lamp.pool], color: WARM,
      strength: lamp.kind === "arc" ? 0.62 : lamp.kind === "sconce" ? 0.3 : 0.5 });
    // A table or desk lamp lights what it stands on: a small bright pool on the top.
    if (lamp.on > 0) out.push({ id: `${lamp.id}:top`, level: lamp.level, part, at: [x, base + lamp.on + 0.006, z], face: "up", half: [0.6, 0.6], color: WARM, strength: 0.55 });
    // A sconce washes its wall up and down; a floor lamp by a wall lights the wall behind it: no dark corners at night.
    const wall = lamp.wall ?? (lamp.kind === "floor" ? wallBy(x, z, LAMP_NEAR_WALL) : null);
    if (wall) {
      const sconce = lamp.kind === "sconce";
      const at: [number, number, number] = sconce ? [x + (wall === "-x" ? -0.02 : wall === "+x" ? 0.02 : 0), base + y, z + (wall === "-z" ? -0.02 : wall === "+z" ? 0.02 : 0)] : onWall(wall, x, base + y, z);
      out.push({ id: `${lamp.id}:wall`, level: lamp.level, part, at, face: wall, half: sconce ? [0.75, 1.5] : [1.0, 1.35], color: WARM, strength: sconce ? 0.42 : 0.3 });
    }
  }
  // The track spots: a wash on the wall or the top each one picks out. (Not on the bare floor: seen from the walking
  // camera above, with the spot itself out of sight under the ceiling, a pool there reads as a stain.)
  const { halfW: W, halfD: D } = HQ_ROOM;
  for (const t of o.tracks) t.spots.forEach((s, i) => {
    const [ax, ay, az] = s.aim;
    const level: Level = t.from[1] < F ? 0 : ay >= F - 0.2 ? 1 : 0;
    const floorY = level * F, part = level ? partAt(o, Math.min(Math.max(ax, -W + 0.01), W - 0.01), Math.min(Math.max(az, -D + 0.01), D - 0.01)) : 0;
    const id = `track:${t.from.join(",")}:${i}`;
    const wash = { id, level, part, half: [0.8, 1.1] as [number, number], color: SPOT, strength: 0.3 };
    if (az > D - NEAR_WALL) out.push({ ...wash, at: [ax, ay, Math.min(az, D - 0.06) - 0.07], face: "-z" });
    else if (az < -D + NEAR_WALL) out.push({ ...wash, at: [ax, ay, Math.max(az, -D + 0.06) + 0.07], face: "+z" });
    else if (ax > W - NEAR_WALL) out.push({ ...wash, at: [Math.min(ax, W - 0.06) - 0.07, ay, az], face: "-x" });
    else if (ax < -W + NEAR_WALL) out.push({ ...wash, at: [Math.max(ax, -W + 0.06) + 0.07, ay, az], face: "+x" });
    else if (ay - floorY >= 0.5) out.push({ id, level, part, at: [ax, ay - 0.04, az], face: "up", half: [0.75, 0.75], color: SPOT, strength: 0.26 });
  });
  // The aquarium's blue on the lounge before it: a long soft patch along the glass, and a fainter one further out.
  const a = o.aquarium, mid = (a.x0 + a.x1) / 2, len = (a.x1 - a.x0) / 2;
  out.push({ id: "aquarium:near", level: 0, part: 0, at: [mid, LIFT, a.z0 - 1.12], face: "up", half: [len + 0.3, 1.1], color: WATER, strength: 0.4 });
  out.push({ id: "aquarium:far", level: 0, part: 0, at: [mid, LIFT, a.z0 - 2.9], face: "up", half: [len + 0.8, 2.4], color: WATER, strength: 0.16 });
  return out;
}

/**
 * A pool's quad, cut to the room (a lamp in a corner throws its light up to the walls, not through them): its four
 * corners (counter-clockwise seen from its lit side) and each one's place in the pool's fade (−1..1 across, −1..1 up),
 * for the mesh.
 */
export function poolQuad(p: Pool): { corners: [number, number, number][]; uvs: [number, number][] } {
  const { halfW: W, halfD: D } = HQ_ROOM;
  const [x, y, z] = p.at, [a, b] = p.half;
  // The face's two axes (u across, v along or up) and the room's extent on each.
  const [cu, cv, lu, lv] = p.face === "up" ? [x, z, W, D] : p.face === "-z" || p.face === "+z" ? [x, y, W, 2 * F] : [z, y, D, 2 * F];
  const vlo = p.face === "up" ? -lv : 0;
  const u0 = Math.max(cu - a, -lu), u1 = Math.min(cu + a, lu), v0 = Math.max(cv - b, vlo), v1 = Math.min(cv + b, lv);
  const su = p.face === "-z" || p.face === "+x" ? [1, -1, -1, 1] : [-1, 1, 1, -1], sv = [-1, -1, 1, 1];
  const corners: [number, number, number][] = [], uvs: [number, number][] = [];
  for (let k = 0; k < 4; k++) {
    const u = su[k] > 0 ? u1 : u0, v = sv[k] > 0 ? v1 : v0;
    corners.push(p.face === "up" ? [u, y, v] : p.face === "-z" || p.face === "+z" ? [u, v, z] : [x, v, u]);
    uvs.push([(u - cu) / a, (v - cv) / b]);
  }
  return { corners, uvs };
}
