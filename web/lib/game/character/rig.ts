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
 * `hairUv` channel so every piece merges with the same attribute set.
 * hairUv = (1, lock u, lock v) on lock hair (M_Hair with lock UVs: u across
 * the lock, v root to tip), 0 elsewhere; the body material lays the painted
 * strand texture along each lock from it (avatar v8). `place` moves the
 * primitive first (a hair accessory onto its anchor, rest pose, rig space).
 */
export function adoptPrimitive(mesh: THREE.SkinnedMesh, boneIndex: ReadonlyMap<string, number>, tint: THREE.Color | null, hair = false, place?: THREE.Matrix4): THREE.BufferGeometry {
  const src = mesh.geometry, n = src.getAttribute("position").count;
  const g = new THREE.BufferGeometry();
  if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>));
  // the GLB's own attributes are shared with every look; a placed copy gets its own
  g.setAttribute("position", place ? src.getAttribute("position").clone().applyMatrix4(place) : src.getAttribute("position"));
  g.setAttribute("normal", place ? src.getAttribute("normal").clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(place)) : src.getAttribute("normal"));
  const uv = src.getAttribute("uv");
  g.setAttribute("uv", uv ?? new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const lock = new Float32Array(n * 3);
  // glTF stores v flipped (1 - Blender's v): flip back so v = 0 is the lock's root, as authored in Blender
  if (hair && uv) for (let i = 0; i < n; i++) { lock[i * 3] = 1; lock[i * 3 + 1] = uv.getX(i); lock[i * 3 + 2] = 1 - uv.getY(i); }
  g.setAttribute("hairUv", new THREE.BufferAttribute(lock, 3));
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
 * Where a hair accessory goes (avatar v8): one matrix per anchor placement [px, py, pz, qx, qy, qz, qw, r]. A piece
 * that wraps the gathered hair (`wrap`, its authored inner radius) is scaled to r; any other sits on the gathered
 * hair's surface, r out along the anchor's outward axis (local +y after the glTF export).
 */
export function anchorMatrices(at: readonly (readonly number[])[], wrap?: number): THREE.Matrix4[] {
  return at.map(([px, py, pz, qx, qy, qz, qw, r]) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion(qx, qy, qz, qw), new THREE.Vector3(1, 1, 1));
    return m.multiply(wrap ? new THREE.Matrix4().makeScale(r / wrap, r / wrap, r / wrap) : new THREE.Matrix4().makeTranslation(0, r, 0));
  });
}

export interface PieceSource { root: THREE.Object3D; tints: Record<string, string>; keep?: (materialName: string) => boolean; place?: THREE.Matrix4[] }
/**
 * Merge the untextured primitives of every piece into one geometry for
 * `bones`. A primitive is tinted by its material name when the piece lists a
 * tint for it, otherwise it keeps its GLB colour. Pieces' `keep` filters
 * primitives (the base body contributes only its skin); a piece with `place`
 * (a hair accessory) goes in once per matrix.
 */
export function mergeLook(pieces: PieceSource[], bones: readonly THREE.Bone[]): THREE.BufferGeometry {
  const boneIndex = new Map(bones.map((b, i) => [b.name, i]));
  const parts: THREE.BufferGeometry[] = [];
  for (const piece of pieces) for (const mesh of skinnedPrimitives(piece.root)) {
    const name = materialName(mesh);
    if (piece.keep && !piece.keep(name)) continue;
    const hex = piece.tints[name];
    const own = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const tint = hex ? new THREE.Color(hex) : own.color ?? null;
    if (piece.place) for (const m of piece.place) parts.push(adoptPrimitive(mesh, boneIndex, tint, false, m));
    else parts.push(adoptPrimitive(mesh, boneIndex, tint, name === "M_Hair"));
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
