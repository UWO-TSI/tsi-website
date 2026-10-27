/**
 * Character assembly (deliverable 1). Every part GLB carries the same
 * 22-bone rig as the base, so parts bind to one skeleton by bone name. All
 * untextured primitives of a look (skin, hair, clothes, accessories) are
 * merged into ONE skinned geometry whose vertex colour is COLOR_0 x the
 * palette tint, drawn with one shared material: a character costs one draw
 * for the body, one for the face, and one more only for a top with a decal.
 * Mapped hairstyles (head fit) add no draw: their shading comes from one
 * shared atlas the body material samples.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { HairShift } from "./hairColour";

/** Skinned primitives under a loaded GLB scene (GLTFLoader makes one SkinnedMesh per primitive). */
export function skinnedPrimitives(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  root.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) out.push(o as THREE.SkinnedMesh); });
  return out;
}
export const materialName = (mesh: THREE.Mesh) => (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name;

/** A mapped hairstyle's shift for each recolour channel of its texture (hairColour.ts). */
export interface HairMapUse { a: HairShift; b: HairShift }

/**
 * A primitive's geometry re-expressed for the target skeleton: joint indices
 * remapped by bone name, colour = COLOR_0 (linear) x tint, a uv channel, and
 * the hair attributes every piece carries so they all merge with one
 * attribute set: `hairMap` (1 for a mapped hairstyle, 0 for none; then each
 * channel's picked lightness l), `hairA`, `hairB` its two channels'
 * shifts (p, q, o) and `hairL` their lightness (sA, dA, sB, dB):
 * L' = s L + d, ab' = [p -q; q p] ab + o tent(L', l) in OKLab. The body material draws a mapped hairstyle's own texture
 * from the shared hair atlas, shifted (Character.tsx), and leaves a vertex
 * with u < 0 (the under-cap) to its COLOR_0 and tint alone.
 */
export function adoptPrimitive(mesh: THREE.SkinnedMesh, boneIndex: ReadonlyMap<string, number>, tint: THREE.Color | null, map: HairMapUse | null = null,
  cut: PieceCut | null = null): THREE.BufferGeometry {
  const src = mesh.geometry, n = src.getAttribute("position").count;
  const g = new THREE.BufferGeometry();
  if (src.index) g.setIndex(cutIndex(src, cut));
  g.setAttribute("position", src.getAttribute("position"));
  g.setAttribute("normal", src.getAttribute("normal"));
  const uv = src.getAttribute("uv");
  g.setAttribute("uv", uv ?? new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const mapped = !!(map && uv);
  const hm = new Float32Array(n * 3), ha = new Float32Array(n * 4), hb = new Float32Array(n * 4), hl = new Float32Array(n * 4);
  if (mapped) {
    const pa = [map!.a.m[0], map!.a.m[2], ...map!.a.o], pb = [map!.b.m[0], map!.b.m[2], ...map!.b.o], pl = [...map!.a.L, ...map!.b.L];
    for (let i = 0; i < n; i++) {
      hm[i * 3] = 1; hm[i * 3 + 1] = map!.a.l; hm[i * 3 + 2] = map!.b.l;
      for (let k = 0; k < 4; k++) { ha[i * 4 + k] = pa[k]; hb[i * 4 + k] = pb[k]; hl[i * 4 + k] = pl[k]; }
    }
  }
  g.setAttribute("hairMap", new THREE.BufferAttribute(hm, 3));
  g.setAttribute("hairA", new THREE.BufferAttribute(ha, 4));
  g.setAttribute("hairB", new THREE.BufferAttribute(hb, 4));
  g.setAttribute("hairL", new THREE.BufferAttribute(hl, 4));
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
 * What a look never shows (art/characters/hidden_cut.py; David, 2026-10-17: "find ways to not render part of hair"):
 * covering hat i hides the hair whose `_HATCUT` marks carry bit i (the sum of 2^i over the hats that hide a vertex), the
 * hood the head skin its `_HOODCUT` marks (bit 0). A triangle all three of whose vertices carry the bit is left out of
 * the merged index; nothing else changes. CUTS.on false (the avatar bench's `&cut=0`) draws everything, for the
 * before-and-after sheets.
 */
export const CUTS = { on: true };
/** A piece's cut: the GLB attribute (`_HATCUT`, `_HOODCUT`) and the bit to test. */
export interface PieceCut { name: string; bit: number }
/** Whether a mark (a float holding a sum of powers of two) carries bit. */
export const hasBit = (mark: number, bit: number) => Math.floor(Math.round(mark) / 2 ** bit) % 2 === 1;
function cutIndex(src: THREE.BufferGeometry, cut: PieceCut | null): number[] {
  const index = Array.from(src.index!.array as ArrayLike<number>);
  const mark = cut && CUTS.on ? src.getAttribute(cut.name.toLowerCase()) : undefined;
  if (!mark || !cut) return index;
  const out: number[] = [];
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    if (hasBit(mark.getX(a), cut.bit) && hasBit(mark.getX(b), cut.bit) && hasBit(mark.getX(c), cut.bit)) continue;
    out.push(a, b, c);
  }
  return out;
}

export interface PieceSource { root: THREE.Object3D; tints: Record<string, string>; keep?: (materialName: string) => boolean;
  /** A vertex mark and bit (`_HATCUT` and the worn hat's, `_HOODCUT` and 0): triangles all three of whose vertices carry it are not drawn. */
  cut?: PieceCut | null;
  /** A mapped hairstyle (head fit): its hair primitive draws its texture from the hair atlas, shifted. */
  map?: HairMapUse | null }
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
    const m = piece.map && name === "M_Hair" ? piece.map : null;
    parts.push(adoptPrimitive(mesh, boneIndex, hex ? new THREE.Color(hex) : own.color ?? null, m, piece.cut ?? null));
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
