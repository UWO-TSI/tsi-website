/**
 * Distance LOD for the instanced nature (components/game/InstancedNature.tsx): a model with a far version draws each
 * placement near or far by its distance from the camera. The bushes are the ones that have it
 * (art/nature/build_bushes.py writes `<name>.glb` and `<name>.lod1.glb`): a village holds sixteen, every one drawn
 * every frame (the curved world turns frustum culling off), and only the few round the player need the near detail.
 */
import { SEASONS } from "./season";
import { BUSH_SHAPES, bushUrl } from "./natureParts";

/** Camera distance (world units) past which a placement draws its far model: about 5 u beyond the player at the follow camera's 13 u. */
export const LOD1_DISTANCE = 18;
/** Hysteresis: a near placement goes far only past LOD1_DISTANCE + LOD_BAND, a far one near only inside LOD1_DISTANCE - LOD_BAND. */
export const LOD_BAND = 1.5;

const FAR: Record<string, string> = Object.fromEntries(SEASONS.flatMap(season => BUSH_SHAPES.map(shape => [bushUrl(shape, season), bushUrl(shape, season, 1)])));

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
