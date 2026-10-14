/**
 * The editor's crosshair: where a ray from the camera first meets the ground (the drawn surface, `terrainHeight`), or
 * the still sea when it meets the water first (`water`). March in steps that shrink as the ray nears the ground, then
 * bisect to a hundredth of a unit. Pure, so the tests can aim it.
 */
import { terrainHeight, type WorldTerrain } from "./terrain";

export interface RayHit { x: number; y: number; z: number; distance: number; water: boolean }

export function rayTerrain(t: WorldTerrain, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDistance = 600, water = false): RayHit | null {
  const l = Math.hypot(dx, dy, dz) || 1;
  dx /= l; dy /= l; dz /= l;
  const above = (s: number) => {
    const x = ox + dx * s, z = oz + dz * s, y = oy + dy * s;
    const g = terrainHeight(t, x, z), floor = water ? Math.max(g, t.seaLevel) : g;
    return y - floor;
  };
  let s = 0, prev = above(0);
  if (prev < 0) return null; // under the ground
  while (s < maxDistance) {
    // A step no longer than the clearance (the ground can rise at most ~3 a unit) and at least a tenth of a unit.
    const step = Math.max(0.1, Math.min(4, prev / 4));
    const next = s + step, a = above(next);
    if (a <= 0) {
      let lo = s, hi = next;
      for (let i = 0; i < 24 && hi - lo > 0.005; i++) { const m = (lo + hi) / 2; if (above(m) > 0) lo = m; else hi = m; }
      const x = ox + dx * hi, z = oz + dz * hi, g = terrainHeight(t, x, z);
      return { x, y: water ? Math.max(g, t.seaLevel) : g, z, distance: hi, water: water && g < t.seaLevel };
    }
    s = next; prev = a;
  }
  return null;
}
