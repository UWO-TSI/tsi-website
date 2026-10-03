/**
 * A rope hung between two points that move (a boat's line to the pier, arrival-wharf.md): one tube whose vertices are
 * rewritten in place each frame, sagging by how much rope there is between its ends, taut once there isn't. Nothing is
 * allocated after it is made.
 */
import * as THREE from "three";

const _t = new THREE.Vector3(), _n1 = new THREE.Vector3(), _n2 = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export class RopeLine {
  readonly mesh: THREE.Mesh;
  private readonly position: THREE.BufferAttribute;
  private readonly normal: THREE.BufferAttribute;

  /** `material`: the pier's rope (u round it, v along it, one lay per `lay` units). */
  constructor(material: THREE.Material, private readonly segments = 14, private readonly sides = 7, private readonly radius = 0.018, lay = 0.13, restLength = 1) {
    const verts = (segments + 1) * sides;
    const geometry = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.normal = new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const uv = new Float32Array(verts * 2), index: number[] = [];
    for (let i = 0; i <= segments; i++) for (let j = 0; j < sides; j++) {
      uv[(i * sides + j) * 2] = j / (sides - 1);
      uv[(i * sides + j) * 2 + 1] = (i / segments) * restLength / lay;
      // The last of each ring repeats the first at u = 1 (the texture's seam), so the faces stop one short.
      if (i < segments && j < sides - 1) {
        const a = i * sides + j, b = a + 1, c = a + sides, d = b + sides;
        index.push(a, c, b, b, c, d);
      }
    }
    geometry.setAttribute("position", this.position);
    geometry.setAttribute("normal", this.normal);
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(index);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.sunCaster = "dynamic";
  }

  /** Hang it from `a` to `b` with `length` of rope between them: a parabola's sag for the slack (taut: straight), `lift` arching it up (a line being thrown). */
  update(a: THREE.Vector3, b: THREE.Vector3, length: number, lift = 0) {
    const d = a.distanceTo(b);
    const sag = d < length ? Math.sqrt((3 * d * (length - d)) / 8) : 0;
    const pos = this.position.array as Float32Array, nor = this.normal.array as Float32Array;
    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments, drop = sag * 4 * t * (1 - t) - lift * Math.sin(Math.PI * t);
      _p.lerpVectors(a, b, t);
      _p.y -= drop;
      // The tangent: the chord plus the sag's slope.
      _t.subVectors(b, a);
      _t.y -= (sag * 4 * (1 - 2 * t) - lift * Math.PI * Math.cos(Math.PI * t));
      _t.normalize();
      _n1.crossVectors(_t, _up);
      if (_n1.lengthSq() < 1e-6) _n1.set(1, 0, 0);
      _n1.normalize();
      _n2.crossVectors(_n1, _t);
      for (let j = 0; j < this.sides; j++) {
        const ang = (j / (this.sides - 1)) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang), k = (i * this.sides + j) * 3;
        const nx = _n1.x * c + _n2.x * s, ny = _n1.y * c + _n2.y * s, nz = _n1.z * c + _n2.z * s;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
        pos[k] = _p.x + nx * this.radius; pos[k + 1] = _p.y + ny * this.radius; pos[k + 2] = _p.z + nz * this.radius;
      }
    }
    this.position.needsUpdate = true;
    this.normal.needsUpdate = true;
  }

  dispose() { this.mesh.geometry.dispose(); }
}
