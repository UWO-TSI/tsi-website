/**
 * Cast anywhere along shore, river and pond edges (decision 195): the nearest
 * water within reach decides the spot, and its water type decides the pool.
 * Water type is read from the island's own layout, not placed shadows.
 */
import * as THREE from "three";
import { getCameraForwardXZ } from "./cameraBasis";
import { objectsOf, village, type Village } from "./villageMap";
import { ORTHOGONAL, Surface, inBounds, isGroundAtWorld, isWater, surfaceAt, worldToCellX, worldToCellZ, type IslandMap } from "./grid";

export type WaterType = "river" | "pond" | "sea";
export interface FishingSpot { target: [number, number]; water: WaterType }

/** Reach from the bank to the nearest water cell centre. */
export const CAST_REACH = 2.6;

/** The nearest water point into `out`; false when none is in reach. Allocates nothing (the spot check runs every frame). */
function nearestWaterInto(map: IslandMap, x: number, z: number, reach: number, out: [number, number]): boolean {
  let found = false, bestD = reach;
  for (let dz = -Math.ceil(reach); dz <= Math.ceil(reach); dz++) for (let dx = -Math.ceil(reach); dx <= Math.ceil(reach); dx++) {
    const cx = Math.floor(x) + dx + 0.5, cz = Math.floor(z) + dz + 0.5;
    if (surfaceAt(map, worldToCellX(map, cx), worldToCellZ(map, cz)) !== Surface.River) continue;
    if (isGroundAtWorld(map, cx, cz)) continue;
    const d = Math.hypot(cx - x, cz - z);
    if (d < bestD) { bestD = d; out[0] = cx; out[1] = cz; found = true; }
  }
  return found;
}
export function nearestWater(map: IslandMap, x: number, z: number, reach = CAST_REACH): [number, number] | null {
  const out: [number, number] = [0, 0];
  return nearestWaterInto(map, x, z, reach, out) ? out : null;
}

const nearest: [number, number] = [0, 0];
/**
 * A spot for a player standing at (x, z), or null when no water is in reach.
 * The bobber lands a little past the nearest water cell, staying on water.
 * `out` (the per-frame check passes its own) is written and returned instead of a new spot.
 */
export function fishingSpot(map: IslandMap, classify: (x: number, z: number) => WaterType, x: number, z: number, out?: FishingSpot): FishingSpot | null {
  if (!nearestWaterInto(map, x, z, CAST_REACH, nearest)) return null;
  const spot = out ?? { target: [0, 0], water: "river" };
  const d = Math.hypot(nearest[0] - x, nearest[1] - z) || 1;
  const ox = nearest[0] + (nearest[0] - x) / d * 0.9, oz = nearest[1] + (nearest[1] - z) / d * 0.9;
  const past = !isGroundAtWorld(map, ox, oz);
  spot.target[0] = past ? ox : nearest[0];
  spot.target[1] = past ? oz : nearest[1];
  spot.water = classify(spot.target[0], spot.target[1]);
  return spot;
}

/** The cast's water test at a point: a water cell where the ground doesn't stand (the drawn coast). */
const waterAt = (map: IslandMap, x: number, z: number) => surfaceAt(map, worldToCellX(map, x), worldToCellZ(map, z)) === Surface.River && !isGroundAtWorld(map, x, z);
/** How far either side of the aim a cast still looks for water (radians), nearest the aim first: along a jetty it still finds the water beside it. */
const AIM_FAN = [0, 0.3, -0.3, 0.6, -0.6];
/**
 * A spot in the direction the player aims, (ax, az) a unit vector on the ground (David's playtest 2026-10-29: the cast
 * goes where the cursor points, not where the body faces): the first water along it within CAST_REACH (a little to
 * either side when the line itself misses), carried 0.9 further while that's still water. Null when there's no water
 * that way: a cast never goes onto the sand.
 */
export function aimedSpot(map: IslandMap, classify: (x: number, z: number) => WaterType, x: number, z: number, ax: number, az: number, out?: FishingSpot): FishingSpot | null {
  for (const a of AIM_FAN) {
    const c = Math.cos(a), sn = Math.sin(a), dx = ax * c - az * sn, dz = ax * sn + az * c;
    for (let d = 0.3; d <= CAST_REACH + 1e-9; d += 0.1) {
      const px = x + dx * d, pz = z + dz * d;
      if (!waterAt(map, px, pz)) continue;
      const spot = out ?? { target: [0, 0], water: "river" };
      const past = waterAt(map, px + dx * 0.9, pz + dz * 0.9);
      spot.target[0] = past ? px + dx * 0.9 : px;
      spot.target[1] = past ? pz + dz * 0.9 : pz;
      spot.water = classify(spot.target[0], spot.target[1]);
      return spot;
    }
  }
  return null;
}

const ray = new THREE.Raycaster(), level = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
/**
 * Where the player at (x, y, z) aims a cast, as a unit direction on the ground written into `out`: toward the ground
 * point under the cursor (`cursor`: free and over the world; `pointer` in device coordinates), else straight ahead of
 * the camera (mouse-look's screen centre, a touch, the prompt's button). Allocates nothing (the scene runs it per frame).
 */
export function castAim(camera: THREE.Camera, pointer: THREE.Vector2, cursor: boolean, x: number, y: number, z: number, out: [number, number]): [number, number] {
  if (cursor) {
    ray.setFromCamera(pointer, camera);
    level.constant = -y;
    const at = ray.ray.intersectPlane(level, hit);
    const dx = at ? at.x - x : ray.ray.direction.x, dz = at ? at.z - z : ray.ray.direction.z, l = Math.hypot(dx, dz);
    if (l > 0.25) { out[0] = dx / l; out[1] = dz / l; return out; }
  }
  const f = getCameraForwardXZ(camera);
  out[0] = f.fx; out[1] = f.fz;
  return out;
}

/** Water class per cell: 0 land, 1 sea, 2 river, 3 pond. */
export const WATER_CLASS = { land: 0, sea: 1, river: 2, pond: 3 } as const;

/**
 * Sea, river and pond from water connectivity, not from the island's shape
 * (specs/island-painter.md §3). Water that cannot reach the map edge is a pond.
 * Water that can is the sea where it is open, at least `open + 1` cells from
 * any land and joined to the edge through such cells, grown back `open` cells
 * toward the shore; a narrower channel (a river, even one running out to sea)
 * stays river. A pond that opens onto a river is found from its `ponds` marker
 * (the pond landmark): the open water around it (2+ cells from land), grown one
 * cell to its banks. A river the world marks (`rivers`, cells: the smooth world's River zone) stays river where it
 * opens wide to the sea. Off the map is sea.
 */
export function classifyWater(map: IslandMap, ponds: readonly (readonly [number, number])[] = [], rivers: readonly (readonly [number, number])[] = [], open = 2): Uint8Array {
  const { width: W, depth: D } = map, n = W * D;
  const water = (i: number) => isWater(map.surfaces[i]);
  const out = new Uint8Array(n);
  // Distance to land in cells (8-neighbour steps), capped at open + 1.
  const far = open + 1, dist = new Uint8Array(n).fill(far);
  let frontier: number[] = [];
  for (let i = 0; i < n; i++) if (!water(i)) { dist[i] = 0; frontier.push(i); }
  for (let d = 1; d <= open && frontier.length; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % W, z = (i / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!inBounds(map, x + dx, z + dz)) continue;
        const j = (z + dz) * W + x + dx;
        if (dist[j] > d) { dist[j] = d; next.push(j); }
      }
    }
    frontier = next;
  }
  // Every water cell starts as river; ponds are components that never touch the edge.
  const seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!water(i) || seen[i]) continue;
    const comp: number[] = [], stack = [i];
    let edge = false;
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop()!, x = k % W, z = (k / W) | 0;
      comp.push(k);
      if (x === 0 || z === 0 || x === W - 1 || z === D - 1) edge = true;
      for (const [dx, dz] of ORTHOGONAL) {
        if (!inBounds(map, x + dx, z + dz)) continue;
        const j = (z + dz) * W + x + dx;
        if (!seen[j] && water(j)) { seen[j] = 1; stack.push(j); }
      }
    }
    for (const k of comp) out[k] = edge ? WATER_CLASS.river : WATER_CLASS.pond;
  }
  /** Turn river cells `cls`, `steps` rings out from `from` (4- or 8-neighbour), where `ok`. */
  const grow = (from: number[], steps: number, diagonal: boolean, ok: (j: number) => boolean, cls: number) => {
    for (let step = 0; from.length && step < steps; step++) {
      const next: number[] = [];
      for (const i of from) {
        const x = i % W, z = (i / W) | 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          if ((!diagonal && dx && dz) || !inBounds(map, x + dx, z + dz)) continue;
          const j = (z + dz) * W + x + dx;
          if (out[j] === WATER_CLASS.river && ok(j)) { out[j] = cls; next.push(j); }
        }
      }
      from = next;
    }
  };
  // Open sea: far-from-land water joined to the edge (4-neighbour flood), then grown back to the shore.
  const edge: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = i % W, z = (i / W) | 0;
    if ((x === 0 || z === 0 || x === W - 1 || z === D - 1) && out[i] === WATER_CLASS.river && dist[i] === far) { out[i] = WATER_CLASS.sea; edge.push(i); }
  }
  grow(edge, n, false, j => dist[j] === far, WATER_CLASS.sea);
  const core: number[] = [];
  for (let i = 0; i < n; i++) if (out[i] === WATER_CLASS.sea) core.push(i);
  grow(core, open, true, () => true, WATER_CLASS.sea);
  for (const [cx, cz] of rivers) if (inBounds(map, cx, cz) && out[cz * W + cx] === WATER_CLASS.sea) out[cz * W + cx] = WATER_CLASS.river;
  // Ponds joined to a river: the open water around each marker, then its banks.
  for (const [px, pz] of ponds) {
    const cx = worldToCellX(map, px), cz = worldToCellZ(map, pz), i = cz * W + cx;
    if (!inBounds(map, cx, cz) || out[i] !== WATER_CLASS.river) continue;
    out[i] = WATER_CLASS.pond;
    const coreCells = [i];
    grow(coreCells, n, false, j => dist[j] >= 2, WATER_CLASS.pond);
    const pond: number[] = [];
    for (let k = 0; k < n; k++) if (out[k] === WATER_CLASS.pond) pond.push(k);
    grow(pond, 1, true, () => true, WATER_CLASS.pond);
  }
  return out;
}

const NAMES: WaterType[] = ["river", "sea", "river", "pond"];
/** The water type at a world point, from `classifyWater`. */
export function waterClassifier(map: IslandMap, classes: Uint8Array = classifyWater(map)) {
  return (x: number, z: number): WaterType => {
    const cx = worldToCellX(map, x), cz = worldToCellZ(map, z);
    return inBounds(map, cx, cz) ? NAMES[classes[cz * map.width + cx]] : "sea";
  };
}

const waters = new WeakMap<Village, { classes: Uint8Array; classify: (x: number, z: number) => WaterType }>();
/** The village map's water classes and classifier, built once per loaded map. */
export function villageWater(v: Village = village()) {
  let w = waters.get(v);
  if (!w) {
    const ponds = objectsOf("landmark", v).filter(o => o.id === "pond").map(o => [o.x, o.z] as const);
    const classes = classifyWater(v.map, ponds, v.rivers);
    waters.set(v, w = { classes, classify: waterClassifier(v.map, classes) });
  }
  return w;
}
