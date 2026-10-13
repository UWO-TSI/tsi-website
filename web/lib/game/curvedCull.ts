/**
 * Frustum culling for the curved world (lib/game/curvedWorld.ts). The vertex shader sinks everything by its view
 * depth squared, so three's own test (on the unbent bounds) can drop a far block the bend brings into view at the top
 * of the screen; that is why the world's instanced meshes skip culling altogether. This tests a bounding sphere where
 * the bend puts it, grown by how much the bend can differ across the sphere, so a block is drawn whenever any of it
 * might show: never culled early, and the batched world (GridTerrain's and GridCliffs' blocks) can still skip what is
 * behind the camera, off to the sides or past the far plane.
 *
 * The frame loops that call it run before the follow camera moves for the frame (children subscribe first), so the
 * test uses last frame's camera: every sphere is also grown by a margin that covers one frame of the camera's travel
 * (MARGIN: 1.5 u, plus about 3 degrees of turn at its distance).
 */
import * as THREE from "three";
import { ACTIVE_WORLD_BEND, ACTIVE_WORLD_BEND_SIDE } from "./curvedWorld";

const MARGIN = { base: 1.5, perUnit: 0.05 };

export class CurvedCull {
  private readonly frustum = new THREE.Frustum();
  private readonly view = new THREE.Matrix4();
  private readonly c = new THREE.Vector3();
  private readonly s = new THREE.Sphere();

  constructor(private readonly bend = ACTIVE_WORLD_BEND, private readonly side = ACTIVE_WORLD_BEND_SIDE) {}

  /** The camera this frame (its matrices current: after the camera has moved, before the render). */
  update(camera: THREE.Camera): this {
    camera.updateMatrixWorld();
    this.view.copy(camera.matrixWorldInverse);
    // The frustum in view space: the bend is applied there.
    this.frustum.setFromProjectionMatrix(camera.projectionMatrix);
    return this;
  }

  /** Whether any of the world-space `sphere` can be in view once bent. */
  visible(sphere: THREE.Sphere): boolean {
    const c = this.c.copy(sphere.center).applyMatrix4(this.view), r = sphere.radius;
    // The drop is z²·bend + x²·side; across the sphere it differs from the centre's by at most (2|z|r + r²) per term.
    const spread = this.bend * (2 * Math.abs(c.z) * r + r * r) + this.side * (2 * Math.abs(c.x) * r + r * r);
    c.y -= c.z * c.z * this.bend + c.x * c.x * this.side;
    this.s.center.copy(c);
    this.s.radius = r + spread + MARGIN.base + MARGIN.perUnit * Math.hypot(c.x, c.z);
    return this.frustum.intersectsSphere(this.s);
  }
}

/** Show each mesh whose bounds `cull` sees (module scope for the frame loops: nothing allocated). */
export function cullMeshes(cull: CurvedCull, meshes: readonly (THREE.Mesh | null | undefined)[]): void {
  for (const m of meshes) {
    if (!m) continue;
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const on = cull.visible(g.boundingSphere!);
    if (m.visible !== on) m.visible = on;
  }
}
