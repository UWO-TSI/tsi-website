/**
 * Frustum culling for the curved world (lib/game/curvedWorld.ts). The vertex shader lowers everything by its view
 * depth squared (z²·bend + x²·side, in view space), so three's own test on the unbent bounds can drop a far block the
 * bend brings down into view at the top of the screen; that is why the world's instanced meshes skip culling
 * altogether. The bend only ever moves a point down, so it can only matter for the top of the view: the sides, the
 * near and far planes have no up in them, and the bottom plane only sees a point pushed further out. Each plane is
 * tested on the box's corners as three would, and the top plane allows for the most the bend can lower any of it:
 * never culled early, and the batched world (GridTerrain's and GridCliffs' blocks) still skips what is behind the
 * camera, off to the sides, below the view or past the far plane.
 *
 * The frame loops that call it run before the follow camera moves for the frame (children subscribe first), so the
 * test uses last frame's camera: every test also keeps a margin that covers one frame of the camera's travel (MARGIN:
 * 1.5 u, plus about 3 degrees of turn at the block's distance).
 */
import * as THREE from "three";
import { ACTIVE_WORLD_BEND, ACTIVE_WORLD_BEND_SIDE } from "./curvedWorld";

const MARGIN = { base: 1.5, perUnit: 0.05 };

export class CurvedCull {
  private readonly frustum = new THREE.Frustum();
  private readonly view = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();
  private readonly corners = new Float32Array(24);

  constructor(private readonly bend = ACTIVE_WORLD_BEND, private readonly side = ACTIVE_WORLD_BEND_SIDE) {}

  /** The camera this frame (its matrices current: after the camera has moved, before the render). */
  update(camera: THREE.Camera): this {
    camera.updateMatrixWorld();
    this.view.copy(camera.matrixWorldInverse);
    // The frustum in view space, where the bend is applied; three's planes face inward.
    this.frustum.setFromProjectionMatrix(camera.projectionMatrix);
    return this;
  }

  /** Whether any of the world-space `box` can be in view once bent. */
  visibleBox(box: THREE.Box3): boolean {
    const k = this.corners, v = this.v;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(this.view);
      k[i * 3] = v.x; k[i * 3 + 1] = v.y; k[i * 3 + 2] = v.z;
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
    // The most the bend lowers any point of the box, and the margin at its distance.
    const drop = this.bend * Math.max(z0 * z0, z1 * z1) + this.side * Math.max(x0 * x0, x1 * x1);
    const margin = MARGIN.base + MARGIN.perUnit * Math.hypot((x0 + x1) / 2, (z0 + z1) / 2);
    for (const p of this.frustum.planes) {
      let most = -Infinity;
      for (let i = 0; i < 8; i++) most = Math.max(most, p.normal.x * k[i * 3] + p.normal.y * k[i * 3 + 1] + p.normal.z * k[i * 3 + 2] + p.constant);
      // Lowered by up to `drop`: further in past a plane facing down (the top), never in past one facing up.
      if (p.normal.y < 0) most -= p.normal.y * drop;
      if (most < -margin) return false;
    }
    return true;
  }

  /** The same for a world-space sphere. */
  visible(sphere: THREE.Sphere): boolean {
    const c = this.v.copy(sphere.center).applyMatrix4(this.view), r = sphere.radius;
    const drop = this.bend * (Math.abs(c.z) + r) ** 2 + this.side * (Math.abs(c.x) + r) ** 2;
    const margin = MARGIN.base + MARGIN.perUnit * Math.hypot(c.x, c.z);
    for (const p of this.frustum.planes) {
      let most = p.distanceToPoint(c) + r;
      if (p.normal.y < 0) most -= p.normal.y * drop;
      if (most < -margin) return false;
    }
    return true;
  }
}

/** Materials a culled mesh has been drawn with: their shader program is compiled. */
const compiled = new WeakSet<THREE.Material>();

/**
 * Show each mesh whose bounds `cull` sees (module scope for the frame loops: nothing allocated). A mesh whose material
 * nothing culled here has drawn yet is shown once, wherever it is, so its program compiles while the scene loads and
 * never on the frame a block first comes into view.
 */
export function cullMeshes(cull: CurvedCull, meshes: readonly (THREE.Mesh | null | undefined)[]): void {
  for (const m of meshes) {
    if (!m) continue;
    const g = m.geometry, material = m.material as THREE.Material;
    if (!g.boundingBox) g.computeBoundingBox();
    let on = cull.visibleBox(g.boundingBox!);
    if (!compiled.has(material)) { compiled.add(material); on = true; }
    if (m.visible !== on) m.visible = on;
  }
}
