import { Camera, Object3D, Ray, Vector3 } from "three";
import { ACTIVE_WORLD_BEND, ACTIVE_WORLD_BEND_SIDE } from "./curvedWorld";

/** Mirror the material's view-space bend for DOM labels and pointer picking. */
export function bendViewPoint(point: Vector3, inverse = false, forward = ACTIVE_WORLD_BEND, side = ACTIVE_WORLD_BEND_SIDE) {
  const offset = point.z * point.z * forward + point.x * point.x * side;
  point.y += inverse ? offset : -offset;
  return point;
}

const labelPoint = new Vector3();
export function calculateCurvedHtmlPosition(object: Object3D, camera: Camera, size: { width: number; height: number }): number[] {
  object.getWorldPosition(labelPoint).applyMatrix4(camera.matrixWorldInverse);
  bendViewPoint(labelPoint).applyMatrix4(camera.projectionMatrix);
  return [(labelPoint.x + 1) * size.width / 2, (1 - labelPoint.y) * size.height / 2];
}

const _p = new Vector3();

export function pickCurvedSurface(ray: Ray, camera: Camera, groundHeight: (x: number, z: number) => number): Vector3 | null {
  const logicalPoint = (t: number) => {
    _p.copy(ray.origin).addScaledVector(ray.direction, t).applyMatrix4(camera.matrixWorldInverse);
    bendViewPoint(_p, true).applyMatrix4(camera.matrixWorld);
    return _p;
  };
  const heightAbove = (t: number): number => {
    const p = logicalPoint(t);
    return p.y - groundHeight(p.x, p.z);
  };

  let tPrev = 1;
  if (heightAbove(tPrev) <= 0) return null; // ray starts under the ground

  for (let t = 3; t <= 140; t += 2) {
    if (heightAbove(t) <= 0) {
      let lo = tPrev;
      let hi = t;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (heightAbove(mid) > 0) lo = mid;
        else hi = mid;
      }
      return logicalPoint((lo + hi) / 2).clone();
    }
    tPrev = t;
  }
  return null;
}
