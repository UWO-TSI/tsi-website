/**
 * HQ's faked light (specs/interiors/hq.md, "Lighting stays cheap"): the warm pools the lamps throw, the washes the
 * track spots put on the walls and the floor, and the aquarium's blue glow on the lounge in front of it. They're soft
 * additive patches drawn in one mesh per floor, upstairs one per part (components/game/hq/LampPools.tsx), not lights: the room has only a
 * few real ones. Everything here is from the layout's numbers (lib/game/hqLayout.ts), so the light moves with the
 * lamps.
 */
import { HQ, HQ_FLOOR_HEIGHT as F, HQ_ROOM, type HqOption, type Level } from "./hqLayout";

/** "up": lying on a floor or a table top; "-z" / "+z": on the back or the front wall, facing the room; "-x" / "+x": on a
 * side wall. */
export type PoolFace = "up" | "-z" | "+z" | "-x" | "+x";
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
/** How near a wall a spot's aim must be to wash it. */
const NEAR_WALL = 0.7;

/** Which part of the upper floor a point upstairs is on (0 when none). */
const partAt = (o: HqOption, x: number, z: number) => Math.max(0, o.upper.findIndex(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1));

export function hqPools(o: HqOption = HQ): Pool[] {
  const out: Pool[] = [];
  for (const lamp of o.lamps) {
    const base = lamp.level * F, [x, , z] = lamp.light, part = lamp.level ? lamp.part ?? partAt(o, x, z) : 0;
    // The floor round it: wide and soft.
    out.push({ id: `${lamp.id}:floor`, level: lamp.level, part, at: [x, base + LIFT, z], face: "up", half: [lamp.pool, lamp.pool], color: WARM, strength: lamp.kind === "arc" ? 0.62 : 0.52 });
    // A table lamp lights what it stands on: a small bright pool on the top.
    if (lamp.on > 0) out.push({ id: `${lamp.id}:top`, level: lamp.level, part, at: [x, base + lamp.on + 0.006, z], face: "up", half: [0.55, 0.55], color: WARM, strength: 0.55 });
  }
  // The track spots: a wash on the wall or the top each one picks out. (Not on the bare floor: seen from the walking
  // camera above, with the spot itself out of sight under the ceiling, a pool there reads as a stain.)
  const { halfW: W, halfD: D } = HQ_ROOM;
  for (const t of o.tracks) t.spots.forEach((s, i) => {
    const [ax, ay, az] = s.aim;
    const level: Level = t.from[1] < F ? 0 : ay >= F - 0.2 ? 1 : 0;
    const floorY = level * F, part = level ? partAt(o, Math.min(Math.max(ax, -W + 0.01), W - 0.01), Math.min(Math.max(az, -D + 0.01), D - 0.01)) : 0;
    const id = `track:${t.from.join(",")}:${i}`;
    const wash = { id, level, part, half: [0.75, 1.0] as [number, number], color: SPOT, strength: 0.3 };
    if (az > D - NEAR_WALL) out.push({ ...wash, at: [ax, ay, Math.min(az, D - 0.06) - 0.07], face: "-z" });
    else if (az < -D + NEAR_WALL) out.push({ ...wash, at: [ax, ay, Math.max(az, -D + 0.06) + 0.07], face: "+z" });
    else if (ax > W - NEAR_WALL) out.push({ ...wash, at: [Math.min(ax, W - 0.06) - 0.07, ay, az], face: "-x" });
    else if (ax < -W + NEAR_WALL) out.push({ ...wash, at: [Math.max(ax, -W + 0.06) + 0.07, ay, az], face: "+x" });
    else if (ay - floorY >= 0.5) out.push({ id, level, part, at: [ax, ay - 0.04, az], face: "up", half: [0.7, 0.7], color: SPOT, strength: 0.26 });
  });
  // The aquarium's blue on the lounge before it: a long soft patch along the glass, and a fainter one further out.
  const a = o.aquarium, mid = (a.x0 + a.x1) / 2, len = (a.x1 - a.x0) / 2;
  out.push({ id: "aquarium:near", level: 0, part: 0, at: [mid, LIFT, a.z0 - 1.12], face: "up", half: [len + 0.3, 1.1], color: WATER, strength: 0.4 });
  out.push({ id: "aquarium:far", level: 0, part: 0, at: [mid, LIFT, a.z0 - 2.7], face: "up", half: [len + 0.8, 2.2], color: WATER, strength: 0.16 });
  return out;
}

/** The four corners of a pool's quad (counter-clockwise seen from its lit side), for the mesh. */
export function poolCorners(p: Pool): [number, number, number][] {
  const [x, y, z] = p.at, [a, b] = p.half;
  switch (p.face) {
    case "up": return [[x - a, y, z - b], [x + a, y, z - b], [x + a, y, z + b], [x - a, y, z + b]];
    case "-z": return [[x + a, y - b, z], [x - a, y - b, z], [x - a, y + b, z], [x + a, y + b, z]];
    case "+z": return [[x - a, y - b, z], [x + a, y - b, z], [x + a, y + b, z], [x - a, y + b, z]];
    case "-x": return [[x, y - b, z - a], [x, y - b, z + a], [x, y + b, z + a], [x, y + b, z - a]];
    case "+x": return [[x, y - b, z + a], [x, y - b, z - a], [x, y + b, z - a], [x, y + b, z + a]];
  }
}
