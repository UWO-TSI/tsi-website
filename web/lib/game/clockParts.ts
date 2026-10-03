/**
 * The HQ clock's moving parts (components/game/TickingClock.tsx): the dump model antique-clock.glb is one body with the
 * pendulum in it and the hands drawn on the dial's quad set. At load, the pendulum (the parts behind the lower door)
 * and the two hands are lifted out of their meshes into meshes of their own, each hung from its pivot, so the clock
 * can swing and keep time. Model units (the raw GLB's: the clock is 26.7 tall, its face toward +z).
 */
import * as THREE from "three";

export const CLOCK = {
  /** The dial's centre (the numerals ring's), where both hands turn. */
  dial: new THREE.Vector3(0, 19.26, 0),
  /** The top of the pendulum rod, where it hangs. */
  pendulumPivot: new THREE.Vector3(0, 15.68, 0.92),
  /** Parts wholly inside this box are the pendulum (rod, bob, its back and its foot). */
  pendulumBox: new THREE.Box3(new THREE.Vector3(-1.2, 6.9, 0.6), new THREE.Vector3(1.2, 15.8, 1.3)),
  /** Parts wholly inside this box are the hands. */
  handsBox: new THREE.Box3(new THREE.Vector3(-0.42, 19.0, 1.4), new THREE.Vector3(0.42, 20.9, 1.7)),
  /** The pendulum's swing (radians) and its period (s): a beat each second. */
  swing: 0.11, period: 2,
};

/** Hand angles about the dial's axis for a time of day: clockwise seen from the front (negative about +z), 0 at twelve. */
export function clockAngles(hour: number, minute: number, second: number, out = { hour: 0, minute: 0 }) {
  const m = minute + second / 60;
  out.hour = -(((hour % 12) + m / 60) / 12) * Math.PI * 2;
  out.minute = -(m / 60) * Math.PI * 2;
  return out;
}

/** The pendulum at `t` seconds of the world clock: through the middle on each whole second, at the ends between. */
export function pendulumAngle(t: number): number {
  return CLOCK.swing * Math.sin(((t % CLOCK.period) / CLOCK.period) * Math.PI * 2);
}

/** Connected parts of an indexed geometry: for each triangle, the id of the part it belongs to. */
export function triangleParts(geometry: THREE.BufferGeometry): Int32Array {
  const index = geometry.index!, n = geometry.getAttribute("position").count, parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let t = 0; t < index.count; t += 3) {
    const a = find(index.getX(t)), b = find(index.getX(t + 1)), c = find(index.getX(t + 2));
    parent[b] = a; parent[find(c)] = a;
  }
  const out = new Int32Array(index.count / 3);
  for (let t = 0; t < out.length; t++) out[t] = find(index.getX(t * 3));
  return out;
}

const v = new THREE.Vector3();
/**
 * Lift the parts of `mesh` that lie wholly inside `region` (and pass `keep`, given each part's bounds) into new meshes,
 * one per part, each with its geometry moved so `pivot` is its origin; the source keeps the rest. Geometry is copied
 * first: the cached model's is shared by every clone.
 */
export function liftParts(mesh: THREE.Mesh, region: THREE.Box3, pivot: THREE.Vector3): THREE.Mesh[] {
  const geometry = mesh.geometry.clone();
  mesh.geometry = geometry;
  const index = geometry.index!, pos = geometry.getAttribute("position"), parts = triangleParts(geometry);
  const bounds = new Map<number, THREE.Box3>();
  for (let t = 0; t < parts.length; t++) {
    const b = bounds.get(parts[t]) ?? bounds.set(parts[t], new THREE.Box3()).get(parts[t])!;
    for (let k = 0; k < 3; k++) b.expandByPoint(v.fromBufferAttribute(pos, index.getX(t * 3 + k)));
  }
  const lifted = new Set([...bounds].filter(([, b]) => region.containsBox(b)).map(([id]) => id));
  const rest: number[] = [], groups = new Map<number, number[]>();
  for (let t = 0; t < parts.length; t++) {
    const tri = [index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2)];
    if (lifted.has(parts[t])) (groups.get(parts[t]) ?? groups.set(parts[t], []).get(parts[t])!).push(...tri);
    else rest.push(...tri);
  }
  geometry.setIndex(rest);
  return [...groups.values()].map(tris => {
    const g = new THREE.BufferGeometry(), remap = new Map<number, number>();
    for (const i of tris) if (!remap.has(i)) remap.set(i, remap.size);
    for (const name of Object.keys(geometry.attributes)) {
      const src = geometry.getAttribute(name), size = src.itemSize, data = new Float32Array(remap.size * size);
      for (const [from, to] of remap) for (let c = 0; c < size; c++) data[to * size + c] = src.getComponent(from, c);
      g.setAttribute(name, new THREE.BufferAttribute(data, size, src.normalized));
    }
    g.setIndex(tris.map(i => remap.get(i)!));
    g.translate(-pivot.x, -pivot.y, -pivot.z);
    const m = new THREE.Mesh(g, mesh.material);
    m.castShadow = mesh.castShadow; m.receiveShadow = mesh.receiveShadow;
    return m;
  });
}

/** A pivot under `parent` at `at` holding `meshes`. */
function hang(parent: THREE.Object3D, at: THREE.Vector3, meshes: THREE.Mesh[]): THREE.Object3D {
  const pivot = new THREE.Group();
  pivot.position.copy(at);
  for (const m of meshes) pivot.add(m);
  parent.add(pivot);
  return pivot;
}

/** Split a clone of the clock: its pendulum and hands on pivots of their own (the hour hand is the shorter). */
export function splitClock(root: THREE.Object3D) {
  let body: THREE.Mesh | null = null, face: THREE.Mesh | null = null;
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as THREE.Material).name;
    if (/mReBody$/.test(name)) body = mesh;
    else if (/_mat1$/.test(name)) face = mesh;
  });
  if (!body || !face) throw new Error("antique-clock.glb: no body or face");
  const b = body as THREE.Mesh, f = face as THREE.Mesh;
  const pendulum = hang(b.parent!, CLOCK.pendulumPivot, liftParts(b, CLOCK.pendulumBox, CLOCK.pendulumPivot));
  const hands = liftParts(f, CLOCK.handsBox, CLOCK.dial).sort((p, q) => length(p) - length(q));
  return { pendulum, hour: hang(f.parent!, CLOCK.dial, hands.slice(0, 1)), minute: hang(f.parent!, CLOCK.dial, hands.slice(1, 2)) };
}
function length(m: THREE.Mesh) {
  m.geometry.computeBoundingBox();
  return m.geometry.boundingBox!.max.y;
}
