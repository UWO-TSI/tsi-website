/**
 * The ruins zone behind the cliff gate (rows 208, 228; specs/combat-foundation.md §3):
 * a canyon cut into two-level cliffs (the grid draws the dump's cliff kit on
 * every wall), with a safe gate plaza, the outer wild area, the inner temple
 * and the boss chamber. World +x is screen-left, +z is up the screen.
 */
import { createCenteredMap, heightField, isGroundAtWorld, levelAt, sampleGroundHeight, setCell, Surface, worldToCellX, worldToCellZ } from "./grid";
import type { Rect, Vec } from "./combat/sim";

export const RUINS_SPAWN: [number, number, number] = [0, 0, -28];
/** Safe zone: the gate plaza. Hostile attacks can't land here and enemies won't follow (row 8). */
export const GATE_PLAZA: Rect = { x0: -4.6, x1: 4.6, z0: -31.5, z1: -24.6 };
export const COURTYARD: Rect = { x0: -6.5, x1: 6.5, z0: 4, z1: 12.5 };
export const TEMPLE_STEPS: Vec = { x: 0, z: 1.2 };
/** Fetch: the old lantern by the fox den (outer wild, north-west corner). */
export const LANTERN_SPOT: Vec = { x: 11.5, z: -20 };
/** Fetch items by mission `item`: the lantern at the fox den, the sealed tome in the temple library corner. */
export const FETCH_SPOTS: Record<string, Vec & { model: string; scale: number; hint: string }> = {
  "old-lantern": { ...LANTERN_SPOT, model: "/assets/acnh/props/stone-lantern.glb", scale: 0.45, hint: "Find it near the fox den" },
  "sealed-tome": { x: -9, z: 13.2, model: "/assets/game/weapons/tome-spirits.glb", scale: 2.4, hint: "It's in the temple library, far corner" },
};
/** Survive: the rune circle in the outer wild, and the sanctum circle in the temple court. */
export const RUNE_CIRCLE = { x: 6.5, z: -14, r: 2.6 };
export const SANCTUM_CIRCLE = { x: 0, z: 8.2, r: 2.6 };
export const SURVIVE_CIRCLES: Record<string, { x: number; z: number; r: number }> = { "survive-circle": RUNE_CIRCLE, "survive-sanctum": SANCTUM_CIRCLE };
/** Escort: the botanist's checkpoints from the gate to the temple steps. */
export const ESCORT_PATH: Vec[] = [{ x: 0, z: -26 }, { x: 0, z: -18 }, { x: -3, z: -11 }, { x: 0, z: -4 }, { x: 0, z: 1.2 }];
/** Escort paths by mission: the first point is where the resident waits, the last is the arrival. */
export const ESCORT_PATHS: Record<string, Vec[]> = {
  "escort-botanist": ESCORT_PATH,
  "escort-scholar": [{ x: 0, z: -2.5 }, { x: 0, z: 4 }, { x: -5, z: 8.5 }, { x: 4.5, z: 11.5 }, { x: 0, z: 13.2 }, { x: 0, z: 14.8 }],
};
export const BOSS_CENTER: Vec = { x: 0, z: 23.5 };
export const EXIT_SPOT: Vec = { x: 0, z: -30.6 };

const inEllipse = (x: number, z: number, cx: number, cz: number, rx: number, rz: number) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 <= 1;
type Zone = "plaza" | "outer" | "corridor" | "temple" | "passage" | "boss";
export function zoneAt(x: number, z: number): Zone | null {
  if (x >= -4.5 && x <= 4.5 && z >= -31.5 && z <= -24.5) return "plaza";
  if (Math.abs(x) <= 3 && z > -26 && z <= -23) return "outer";
  if (inEllipse(x, z, 0, -14, 15, 11.5)) return "outer";
  if (Math.abs(x) <= 2.5 && z > -4 && z <= 1.5) return "corridor";
  if (Math.abs(x) <= 10.5 && z > 1 && z <= 14.5) return "temple";
  if (Math.abs(x) <= 2 && z > 14 && z <= 17.2) return "passage";
  if (inEllipse(x, z, BOSS_CENTER.x, BOSS_CENTER.z, 7.5, 7)) return "boss";
  return null;
}

/** Solid props (pillars, arch legs, moai, rocks): circles the player and enemies walk around. */
export const RUINS_PILLARS: Vec[] = [-8.3, 8.3].flatMap(x => [3.2, 7.4, 11.6].map(z => ({ x, z })));
export const RUINS_ROCKS: (Vec & { model: string; yaw: number })[] = [
  { x: -12, z: -19, model: "rock-a", yaw: 0.4 }, { x: 11.5, z: -8, model: "rock-c", yaw: 1.2 }, { x: -5, z: -6, model: "rock-b", yaw: 2 },
  { x: 7, z: -24, model: "rock-d", yaw: 0.8 }, { x: -9.5, z: -4.5, model: "rock-e", yaw: 2.6 }, { x: 13, z: -16, model: "rock-b", yaw: 0.1 },
];
export const RUINS_BROKEN_ARCHES: (Vec & { yaw: number })[] = [{ x: -11, z: -11, yaw: 0.5 }, { x: 10, z: -21, yaw: -0.4 }];
export const RUINS_TORCHES: Vec[] = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; return { x: BOSS_CENTER.x + Math.cos(a) * 6.4, z: BOSS_CENTER.z + Math.sin(a) * 6 }; });
export const RUINS_MOAI: Vec[] = [{ x: -3.4, z: 15.6 }, { x: 3.4, z: 15.6 }];
const SOLID: (Vec & { r: number })[] = [
  ...RUINS_PILLARS.map(p => ({ ...p, r: 0.7 })),
  ...RUINS_ROCKS.map(p => ({ ...p, r: 0.8 })),
  ...RUINS_BROKEN_ARCHES.map(p => ({ ...p, r: 0.8 })),
  ...RUINS_TORCHES.map(p => ({ ...p, r: 0.35 })),
  { x: 1.35, z: 1.2, r: 0.45 }, { x: -1.35, z: 1.2, r: 0.45 }, // entrance arch legs
];

export function createRuins() {
  const map = createCenteredMap(40, 66);
  for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
    const x = cx + map.originX + 0.5, z = cz + map.originZ + 0.5, zone = zoneAt(x, z);
    const surface = zone === "plaza" || zone === "temple" || zone === "corridor" || zone === "passage" ? Surface.Stone
      : zone === "boss" ? Surface.Brick
      : zone === "outer" && Math.abs(x) <= 1 && z < -3 ? Surface.Soil : Surface.Grass;
    setCell(map, cx, cz, zone ? 0 : 2, surface);
  }
  const field = heightField(map);
  const ground = (x: number, z: number) => sampleGroundHeight(map, field, x, z);
  const floor = (x: number, z: number) => isGroundAtWorld(map, x, z) && levelAt(map, worldToCellX(map, x), worldToCellZ(map, z)) === 0;
  /** Walkable for a body of radius r (walls, cliff tops and solid props excluded). */
  const free = (x: number, z: number, r = 0.3) => floor(x, z) && floor(x + r, z) && floor(x - r, z) && floor(x, z + r) && floor(x, z - r)
    && !SOLID.some(s => Math.hypot(s.x - x, s.z - z) < s.r + r);
  const move = (fromX: number, fromZ: number, toX: number, toZ: number): [number, number] => {
    const n = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / 0.15));
    const dx = (toX - fromX) / n, dz = (toZ - fromZ) / n;
    let x = fromX, z = fromZ;
    for (let i = 0; i < n; i++) {
      if (free(x + dx, z + dz)) { x += dx; z += dz; } else if (free(x + dx, z)) x += dx; else if (free(x, z + dz)) z += dz; else break;
    }
    return [x, z];
  };
  return { map, ground, free, move };
}
