/**
 * Distance LOD for the instanced nature (components/game/InstancedNature.tsx): a model with a far version draws each
 * placement near or far by its distance from the camera. Our trees have one (art/trees/build_broadleaf.py writes
 * `<name>.glb` and `<name>.lod1.glb`): a village holds sixteen, every one drawn every frame (the curved world turns
 * frustum culling off), and only the few round the player need the near detail. (First built for the round-1 bushes,
 * game/remodel-nature, and kept for the trees.)
 */
import { SEASON_TREES } from "./seasonalLook";

/** Camera distance (world units) past which a placement draws its far model: about 11 u beyond the player at the follow camera's 13 u. */
export const LOD1_DISTANCE = 24;
/** Hysteresis: a near placement goes far only past LOD1_DISTANCE + LOD_BAND, a far one near only inside LOD1_DISTANCE - LOD_BAND. */
export const LOD_BAND = 2;

/** Our models (under /assets/game/plants/) that ship a far version beside them. */
const FAR: Record<string, string> = Object.fromEntries(Object.values(SEASON_TREES).flat()
  .filter(url => url.startsWith("/assets/game/plants/")).map(url => [url, url.replace(/\.glb$/, ".lod1.glb")]));

/** The far model of a model that has one. */
export const lodOf = (url: string): string | null => FAR[url] ?? null;

/**
 * Which placements draw near (1) or far (0), in place: `xyz` holds each placement's position, three floats apiece;
 * (cx, cy, cz) is the camera. Returns whether any changed.
 */
export function updateNear(near: Uint8Array, xyz: Float32Array, cx: number, cy: number, cz: number, distance = LOD1_DISTANCE, band = LOD_BAND): boolean {
  const inner = (distance - band) ** 2, outer = (distance + band) ** 2;
  let changed = false;
  for (let i = 0; i < near.length; i++) {
    const dx = xyz[i * 3] - cx, dy = xyz[i * 3 + 1] - cy, dz = xyz[i * 3 + 2] - cz, d2 = dx * dx + dy * dy + dz * dz;
    const now = near[i] ? d2 < outer : d2 < inner;
    if (now !== (near[i] === 1)) { near[i] = now ? 1 : 0; changed = true; }
  }
  return changed;
}
