/**
 * Cast anywhere along shore, river and pond edges (decision 195): the nearest
 * water within reach decides the spot, and its water type decides the pool.
 * Water type is read from the island's own layout, not placed shadows.
 */
import { objectsOf, village, type Village } from "./villageMap";
import { ORTHOGONAL, Surface, inBounds, isGroundAtWorld, isWater, surfaceAt, worldToCellX, worldToCellZ, type IslandMap } from "./grid";

export type WaterType = "river" | "pond" | "sea";
export interface FishingSpot { target: [number, number]; water: WaterType }

/** Reach from the bank to the nearest water cell centre. */
export const CAST_REACH = 2.6;

export function nearestWater(map: IslandMap, x: number, z: number, reach = CAST_REACH): [number, number] | null {
  let best: [number, number] | null = null, bestD = reach;
  for (let dz = -Math.ceil(reach); dz <= Math.ceil(reach); dz++) for (let dx = -Math.ceil(reach); dx <= Math.ceil(reach); dx++) {
    const cx = Math.floor(x) + dx + 0.5, cz = Math.floor(z) + dz + 0.5;
    if (surfaceAt(map, worldToCellX(map, cx), worldToCellZ(map, cz)) !== Surface.River) continue;
    if (isGroundAtWorld(map, cx, cz)) continue;
    const d = Math.hypot(cx - x, cz - z);
    if (d < bestD) { bestD = d; best = [cx, cz]; }
  }
  return best;
}

/**
 * A spot for a player standing at (x, z), or null when no water is in reach.
 * The bobber lands a little past the nearest water cell, staying on water.
 */
export function fishingSpot(map: IslandMap, classify: (x: number, z: number) => WaterType, x: number, z: number): FishingSpot | null {
  const water = nearestWater(map, x, z);
  if (!water) return null;
  const d = Math.hypot(water[0] - x, water[1] - z) || 1;
  const out: [number, number] = [water[0] + (water[0] - x) / d * 0.9, water[1] + (water[1] - z) / d * 0.9];
  const target = isGroundAtWorld(map, ...out) ? water : out;
  return { target, water: classify(target[0], target[1]) };
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
 * cell to its banks. Off the map is sea.
 */
export function classifyWater(map: IslandMap, ponds: readonly (readonly [number, number])[] = [], open = 2): Uint8Array {
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
  // Open sea: far-from-land water joined to the edge (4-neighbour flood), then grown back to the shore.
  const spread = (from: number[], steps: number, diagonal: boolean, open_: (j: number) => boolean) => {
    for (let step = 0; from.length && step < steps; step++) {
      const next: number[] = [];
      for (const i of from) {
        const x = i % W, z = (i / W) | 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          if ((!diagonal && dx && dz) || !inBounds(map, x + dx, z + dz)) continue;
          const j = (z + dz) * W + x + dx;
          if (out[j] === WATER_CLASS.river && open_(j)) { out[j] = WATER_CLASS.sea; next.push(j); }
        }
      }
      from = next;
    }
  };
  const edge: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = i % W, z = (i / W) | 0;
    if ((x === 0 || z === 0 || x === W - 1 || z === D - 1) && out[i] === WATER_CLASS.river && dist[i] === far) { out[i] = WATER_CLASS.sea; edge.push(i); }
  }
  spread(edge, n, false, j => dist[j] === far);
  const core: number[] = [];
  for (let i = 0; i < n; i++) if (out[i] === WATER_CLASS.sea) core.push(i);
  spread(core, open, true, () => true);
  // Ponds joined to a river: the open water around each marker, then its banks.
  for (const [px, pz] of ponds) {
    const cx = worldToCellX(map, px), cz = worldToCellZ(map, pz), i = cz * W + cx;
    if (!inBounds(map, cx, cz) || out[i] !== WATER_CLASS.river) continue;
    const mark = (from: number[], steps: number, diagonal: boolean, ok: (j: number) => boolean) => {
      for (let step = 0; from.length && step < steps; step++) {
        const next: number[] = [];
        for (const k of from) {
          const x = k % W, z = (k / W) | 0;
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
            if ((!diagonal && dx && dz) || !inBounds(map, x + dx, z + dz)) continue;
            const j = (z + dz) * W + x + dx;
            if (out[j] === WATER_CLASS.river && ok(j)) { out[j] = WATER_CLASS.pond; next.push(j); }
          }
        }
        from = next;
      }
    };
    out[i] = WATER_CLASS.pond;
    const coreCells = [i];
    mark(coreCells, n, false, j => dist[j] >= 2);
    const pond: number[] = [];
    for (let k = 0; k < n; k++) if (out[k] === WATER_CLASS.pond) pond.push(k);
    mark(pond, 1, true, () => true);
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
    const classes = classifyWater(v.map, ponds);
    waters.set(v, w = { classes, classify: waterClassifier(v.map, classes) });
  }
  return w;
}
