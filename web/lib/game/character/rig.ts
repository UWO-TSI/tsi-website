/**
 * Character assembly (deliverable 1). Every part GLB carries the same
 * 22-bone rig as the base, so parts bind to one skeleton by bone name. All
 * untextured primitives of a look (skin, hair, clothes, accessories) are
 * merged into ONE skinned geometry whose vertex colour is COLOR_0 x the
 * palette tint, drawn with one shared material: a character costs one draw
 * for the body, one for the face, and one more only for a top with a decal.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Skinned primitives under a loaded GLB scene (GLTFLoader makes one SkinnedMesh per primitive). */
export function skinnedPrimitives(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  root.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) out.push(o as THREE.SkinnedMesh); });
  return out;
}
export const materialName = (mesh: THREE.Mesh) => (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name;

/**
 * A primitive's geometry re-expressed for the target skeleton: joint indices
 * remapped by bone name, colour = COLOR_0 (linear) x tint, a uv channel and a
 * `hairSheen` and `hairTangent` channel so every piece merges with the same attribute set.
 * hairSheen = (1, lock u, lock v) on sculpted-lock hair (avatar v7: M_Hair
 * with lock UVs, u across the lock, v root to tip), 0 elsewhere; the body
 * material draws its sheen band from it (faceMaterial.ts).
 */
export function adoptPrimitive(mesh: THREE.SkinnedMesh, boneIndex: ReadonlyMap<string, number>, tint: THREE.Color | null, sheen = false): THREE.BufferGeometry {
  const src = mesh.geometry, n = src.getAttribute("position").count;
  const g = new THREE.BufferGeometry();
  if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>));
  g.setAttribute("position", src.getAttribute("position"));
  g.setAttribute("normal", src.getAttribute("normal"));
  const uv = src.getAttribute("uv");
  g.setAttribute("uv", uv ?? new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const lock = new Float32Array(n * 3);
  // glTF stores v flipped (1 - Blender's v): flip back so v = 0 is the lock's root, as authored in Blender
  if (sheen && uv) for (let i = 0; i < n; i++) { lock[i * 3] = 1; lock[i * 3 + 1] = uv.getX(i); lock[i * 3 + 2] = 1 - uv.getY(i); }
  g.setAttribute("hairSheen", new THREE.BufferAttribute(lock, 3));
  g.setAttribute("hairTangent", new THREE.BufferAttribute(sheen && uv ? lockTangents(src, lock) : new Float32Array(n * 3), 3));
  const base = src.getAttribute("color"), color = new Float32Array(n * 3), t = tint ?? new THREE.Color(1, 1, 1);
  for (let i = 0; i < n; i++) {
    color[i * 3] = (base ? base.getX(i) : 1) * t.r;
    color[i * 3 + 1] = (base ? base.getY(i) : 1) * t.g;
    color[i * 3 + 2] = (base ? base.getZ(i) : 1) * t.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(color, 3));
  const joints = src.getAttribute("skinIndex"), weights = src.getAttribute("skinWeight");
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  const bones = mesh.skeleton.bones;
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
    const w = weights.getComponent(i, k);
    skinWeight[i * 4 + k] = w;
    if (w === 0) continue;
    const name = bones[joints.getComponent(i, k)].name, to = boneIndex.get(name);
    if (to === undefined) throw new Error(`Character part ${mesh.name} uses bone ${name}, which the base rig lacks`);
    skinIndex[i * 4 + k] = to;
  }
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  return g;
}

/**
 * Per-vertex direction of each lock (root to tip, dP/dv from the lock UVs), averaged over the faces that share the
 * vertex: the glossy band follows it smoothly across the low-poly faces instead of switching per face.
 */
export function lockTangents(src: THREE.BufferGeometry, lock: Float32Array): Float32Array {
  const pos = src.getAttribute("position"), n = pos.count, out = new Float32Array(n * 3);
  const idx = src.index ? (src.index.array as ArrayLike<number>) : Array.from({ length: n }, (_, i) => i);
  const P = (i: number) => [pos.getX(i), pos.getY(i), pos.getZ(i)];
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const pa = P(a), pb = P(b), pc = P(c);
    const du1 = lock[b * 3 + 1] - lock[a * 3 + 1], dv1 = lock[b * 3 + 2] - lock[a * 3 + 2];
    const du2 = lock[c * 3 + 1] - lock[a * 3 + 1], dv2 = lock[c * 3 + 2] - lock[a * 3 + 2];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-9) continue;
    for (let k = 0; k < 3; k++) {
      const d = ((pc[k] - pa[k]) * du1 - (pb[k] - pa[k]) * du2) / det;   // dP/dv
      out[a * 3 + k] += d; out[b * 3 + k] += d; out[c * 3 + k] += d;
    }
  }
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]);
    if (l > 1e-9) { out[i * 3] /= l; out[i * 3 + 1] /= l; out[i * 3 + 2] /= l; }
  }
  return out;
}

export interface PieceSource { root: THREE.Object3D; tints: Record<string, string>; keep?: (materialName: string) => boolean }
/**
 * Merge the untextured primitives of every piece into one geometry for
 * `bones`. A primitive is tinted by its material name when the piece lists a
 * tint for it, otherwise it keeps its GLB colour. Pieces' `keep` filters
 * primitives (the base body contributes only its skin).
 */
export function mergeLook(pieces: PieceSource[], bones: readonly THREE.Bone[]): THREE.BufferGeometry {
  const boneIndex = new Map(bones.map((b, i) => [b.name, i]));
  const parts: THREE.BufferGeometry[] = [];
  for (const piece of pieces) for (const mesh of skinnedPrimitives(piece.root)) {
    const name = materialName(mesh);
    if (piece.keep && !piece.keep(name)) continue;
    const hex = piece.tints[name];
    const own = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    parts.push(adoptPrimitive(mesh, boneIndex, hex ? new THREE.Color(hex) : own.color ?? null, name === "M_Hair"));
  }
  // The intermediate pieces share attributes with the loaded GLBs and were never uploaded: no dispose, the GC takes them.
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("Character pieces could not be merged");
  return merged;
}

/** Reference-counted cache: identical looks share one geometry/texture; the last user disposes it. */
export function refCache<T extends { dispose(): void }>() {
  const entries = new Map<string, { value: T; users: number }>();
  return {
    acquire(key: string, make: () => T): T {
      let e = entries.get(key);
      if (!e) entries.set(key, e = { value: make(), users: 0 });
      e.users++;
      return e.value;
    },
    release(key: string) {
      const e = entries.get(key);
      if (!e || --e.users > 0) return;
      entries.delete(key);
      e.value.dispose();
    },
    size: () => entries.size,
  };
}
