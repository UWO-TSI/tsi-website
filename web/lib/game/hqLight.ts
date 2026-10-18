/**
 * HQ's faked light (specs/interiors/hq.md, "Lighting stays cheap"): the warm pools the lamps throw, the washes the
 * track spots put on the walls and the floor, and the aquarium's blue glow on the lounge in front of it. They're soft
 * additive patches drawn in one mesh per floor (components/game/hq/LampPools.tsx), not lights: the room has only a
 * few real ones. Everything here is from the layout's numbers (lib/game/hqLayout.ts), so the light moves with the
 * lamps.
 */
import { HQ, HQ_FLOOR_HEIGHT as F, HQ_ROOM, type HqOption, type Level } from "./hqLayout";

/** "up": lying on a floor or a table top; "-z": on the back wall, facing the room; "-x" / "+x": on a side wall. */
export type PoolFace = "up" | "-z" | "-x" | "+x";
export interface Pool {
  id: string;
  /** The floor it belongs to (the upper floor's are cut away with it). */
  level: Level;
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

export function hqPools(o: HqOption = HQ): Pool[] {
  const out: Pool[] = [];
  for (const lamp of o.lamps) {
    const base = lamp.level * F, [x, , z] = lamp.light;
    // The floor round it: wide and soft.
    out.push({ id: `${lamp.id}:floor`, level: lamp.level, at: [x, base + LIFT, z], face: "up", half: [lamp.pool, lamp.pool], color: WARM, strength: lamp.kind === "arc" ? 0.5 : 0.42 });
    // A table lamp lights what it stands on: a small bright pool on the top.
    if (lamp.on > 0) out.push({ id: `${lamp.id}:top`, level: lamp.level, at: [x, base + lamp.on + 0.006, z], face: "up", half: [0.55, 0.55], color: WARM, strength: 0.55 });
  }
  // The track spots: a wash on the wall or the top each one picks out. (Not on the bare floor: seen from the walking
  // camera above, with the spot itself out of sight under the ceiling, a pool there reads as a stain.)
  const D = HQ_ROOM.halfD;
  for (const t of o.tracks) t.spots.forEach((s, i) => {
    const [ax, ay, az] = s.aim;
    const level: Level = t.from[1] < F ? 0 : ay >= F - 0.2 ? 1 : 0;
    const floorY = level * F;
    const id = `track:${t.from.join(",")}:${i}`;
    if (az > D - 0.7) out.push({ id, level, at: [ax, ay, Math.min(az, D - 0.06) - 0.07], face: "-z", half: [0.75, 1.0], color: SPOT, strength: 0.3 });
    else if (ay - floorY >= 0.5) out.push({ id, level, at: [ax, ay - 0.04, az], face: "up", half: [0.7, 0.7], color: SPOT, strength: 0.26 });
  });
  // The aquarium's blue on the lounge before it: a long soft patch along the glass, and a fainter one further out.
  const a = o.aquarium, mid = (a.z0 + a.z1) / 2, len = (a.z1 - a.z0) / 2;
  out.push({ id: "aquarium:near", level: 0, at: [a.x0 - 1.12, LIFT, mid], face: "up", half: [1.1, len + 0.3], color: WATER, strength: 0.4 });
  out.push({ id: "aquarium:far", level: 0, at: [a.x0 - 2.7, LIFT, mid], face: "up", half: [2.2, len + 0.8], color: WATER, strength: 0.16 });
  return out;
}

/** The four corners of a pool's quad (counter-clockwise seen from its lit side), for the mesh. */
export function poolCorners(p: Pool): [number, number, number][] {
  const [x, y, z] = p.at, [a, b] = p.half;
  switch (p.face) {
    case "up": return [[x - a, y, z - b], [x + a, y, z - b], [x + a, y, z + b], [x - a, y, z + b]];
    case "-z": return [[x + a, y - b, z], [x - a, y - b, z], [x - a, y + b, z], [x + a, y + b, z]];
    case "-x": return [[x, y - b, z - a], [x, y - b, z + a], [x, y + b, z + a], [x, y + b, z - a]];
    case "+x": return [[x, y - b, z + a], [x, y - b, z - a], [x, y + b, z - a], [x, y + b, z + a]];
  }
}
