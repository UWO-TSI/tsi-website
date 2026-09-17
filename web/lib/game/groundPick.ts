import type { Camera, Ray } from "three";
import { sampleTerrainHeightFast } from "@/components/game/terrain";
import { pickCurvedSurface } from "./worldProjection";

/** Pick logical ground coordinates by undoing the same view-space bend as the renderer. */
export function pickCurvedGround(ray: Ray, camera: Camera, groundHeight = sampleTerrainHeightFast) {
  return pickCurvedSurface(ray, camera, groundHeight);
}
