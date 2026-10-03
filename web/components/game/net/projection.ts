/**
 * A world point to CSS pixels through the curved world's view-space bend (lib/game/curvedWorld.ts), as
 * calculateCurvedHtmlPosition (lib/game/worldProjection.ts) does for drei's labels, without its array per call: the
 * remotes' nameplates are projected every frame.
 */
import * as THREE from "three";
import { bendViewPoint } from "@/lib/game/worldProjection";

export interface ScreenPoint {
  /** CSS pixels from the canvas's top left. */
  x: number; y: number;
  /** Distance in front of the camera (view space), for depth order. */
  depth: number;
}
const v = new THREE.Vector3();

/** Into `out`; false (out untouched) when the point is at or behind the camera's near plane. */
export function projectCurved(x: number, y: number, z: number, camera: THREE.Camera, width: number, height: number, out: ScreenPoint): boolean {
  v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  const near = (camera as THREE.PerspectiveCamera).near ?? 0;
  if (v.z > -near) return false;
  out.depth = -v.z;
  bendViewPoint(v).applyMatrix4(camera.projectionMatrix);
  out.x = ((v.x + 1) * width) / 2;
  out.y = ((1 - v.y) * height) / 2;
  return true;
}
