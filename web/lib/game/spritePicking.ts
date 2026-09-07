import { type Intersection, Mesh, Raycaster, Vector3 } from "three";
import { bendViewPoint } from "./worldProjection";

const point = new Vector3();
const centre = new Vector3();
const corners = Array.from({ length: 4 }, () => new Vector3());

/** Raycast a billboard against its drawn, curved quad rather than its unbent mesh. */
export function curvedSpriteRaycast(this: Mesh, raycaster: Raycaster, hits: Intersection[]) {
  const camera = raycaster.camera;
  if (!camera) return;
  if (!this.geometry.boundingBox) this.geometry.computeBoundingBox();
  const box = this.geometry.boundingBox;
  if (!box) return;
  raycaster.ray.at(1, point).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  corners[0].set(box.min.x, box.min.y, 0);
  corners[1].set(box.max.x, box.min.y, 0);
  corners[2].set(box.max.x, box.max.y, 0);
  corners[3].set(box.min.x, box.max.y, 0);
  let behind = 0;
  for (const corner of corners) {
    corner.applyMatrix4(this.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    if (corner.z >= 0) behind++;
    bendViewPoint(corner).applyMatrix4(camera.projectionMatrix);
  }
  if (behind) return;
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const a = corners[i], b = corners[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  if (!inside) return;
  this.getWorldPosition(centre);
  const distance = raycaster.ray.origin.distanceTo(centre);
  if (distance < raycaster.near || distance > raycaster.far) return;
  hits.push({ distance, point: centre.clone(), object: this });
}
