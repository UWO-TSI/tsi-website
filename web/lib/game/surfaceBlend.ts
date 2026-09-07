import { type IslandMap, Surface, TILE, cellToWorldX, cellToWorldZ, easedCellOutline, surfaceAt, worldToCellX, worldToCellZ } from "./grid";

type Segment = readonly [number, number, number, number];
const HALF = TILE / 2;
const SQUARE = [[-HALF, -HALF], [-HALF, HALF], [HALF, HALF], [HALF, -HALF]];
const BLEND_WIDTH = 0.3 * TILE;

/** Feather natural overlays into their grass base, using the actual eased boundary. */
export function createSurfaceBlend(map: IslandMap, surface: number) {
  const cache = new Map<string, Segment[]>();
  const inLayer = (cx: number, cz: number) => surfaceAt(map, cx, cz) === surface;
  const isGrass = (cx: number, cz: number) => surfaceAt(map, cx, cz) === Surface.Grass;
  const segmentsAt = (cx: number, cz: number) => {
    const key = `${cx}:${cz}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const segments: Segment[] = [];
    if (inLayer(cx, cz)) {
      const outline = easedCellOutline(inLayer, cx, cz) ?? SQUARE;
      const x = cellToWorldX(map, cx), z = cellToWorldZ(map, cz);
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        // The outline winds clockwise in XZ, so (-dz, dx) points outward.
        const nx = Math.sign(-dz), nz = Math.sign(dx);
        const alongXEdge = Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(Math.abs(a[0]) - HALF) < 1e-6;
        const alongZEdge = Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(Math.abs(a[1]) - HALF) < 1e-6;
        const fades = alongXEdge ? isGrass(cx + nx, cz)
          : alongZEdge ? isGrass(cx, cz + nz)
          : isGrass(cx + nx, cz) || isGrass(cx, cz + nz);
        if (fades) segments.push([x + a[0], z + a[1], x + b[0], z + b[1]]);
      }
    }
    cache.set(key, segments);
    return segments;
  };
  const nearby = (cx: number, cz: number) => {
    const out: Segment[] = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) out.push(...segmentsAt(cx + dx, cz + dz));
    return out;
  };
  return {
    nearEdge: (cx: number, cz: number) => nearby(cx, cz).length > 0,
    sample: (x: number, z: number) => {
      let distance = BLEND_WIDTH;
      for (const [ax, az, bx, bz] of nearby(worldToCellX(map, x), worldToCellZ(map, z))) {
        const dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        distance = Math.min(distance, Math.hypot(x - ax - t * dx, z - az - t * dz));
      }
      const t = distance / BLEND_WIDTH;
      return t * t * (3 - 2 * t);
    },
  };
}
