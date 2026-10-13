/**
 * The cliff kit merged into static blocks per material (v1 performance; specs/perf/budget.md). GridCliffs drew one
 * InstancedMesh per kit file and sub-mesh, never culled: the v2 world's 34 files cost 270 of its 700 draw calls, every
 * piece on the island drawn every frame. The kit's four materials (rock, grass top, grass drape, proc grass) are
 * shared by every file, so each placement's sub-meshes are baked into world space and merged per material per block of
 * TERRAIN_BLOCK × TERRAIN_BLOCK chunks: a call per material per block in view.
 *
 * Nothing about the look changes: the same geometry, materials and shadow roles. The kit's grass top wore the ground's
 * world UVs through the island grass shader's instancing branch (GridTerrain useTerrainMaterials); baked, it carries
 * the same UVs as an attribute, which the shader's plain branch reads exactly as the ground does.
 */
import * as THREE from "three";
import { CHUNK, worldToCellX, worldToCellZ, type IslandMap } from "@/lib/game/grid";
import { TERRAIN_BLOCK } from "./terrainBlocks";

/** One kit piece where it stands: its cell's world centre, its floor height and its quarter turns. */
export interface CliffPlacement { x: number; z: number; y: number; rotation: number }
/** A sub-mesh's material, and whether it wears the ground's world UVs (the island grass top). */
export interface CliffMaterial { material: THREE.Material; worldUv: boolean }

/** Raw dump units are 10x world units; the kit ships raw, like buildings do. */
export const KIT_SCALE = 0.1;

/** A placement's transform, as GridCliffs' instances had it. */
export function placementMatrix(p: CliffPlacement, out = new THREE.Matrix4()): THREE.Matrix4 {
  return out.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (-p.rotation * Math.PI) / 2, 0)),
    new THREE.Vector3(KIT_SCALE, KIT_SCALE, KIT_SCALE));
}

interface Entry { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }

/**
 * Every placement's sub-meshes baked into one mesh per material per block. `scenes[i]` is `files[i]`'s GLB scene;
 * `materialFor` resolves a sub-mesh (by its own material) to the shared one it draws with. `worldUv`: uv = world xz ×
 * `uvScale`. Meshes come back named `cliff:<material>:<blockX>:<blockZ>`, unculled (the caller culls them), receiving shadows.
 */
export function cliffBlocks(map: IslandMap, files: readonly string[], scenes: readonly THREE.Object3D[], byFile: ReadonlyMap<string, readonly CliffPlacement[]>,
  materialFor: (own: THREE.Material, mesh: THREE.Mesh) => CliffMaterial, uvScale: number, block = TERRAIN_BLOCK): THREE.Mesh[] {
  const buckets = new Map<string, { cm: CliffMaterial; entries: Entry[]; bx: number; bz: number }>();
  const ids = new Map<THREE.Material, number>();
  files.forEach((file, i) => {
    const subs: { geometry: THREE.BufferGeometry; cm: CliffMaterial }[] = [];
    scenes[i].traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const own = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      subs.push({ geometry: mesh.geometry, cm: materialFor(own, mesh) });
    });
    for (const p of byFile.get(file) ?? []) {
      const matrix = placementMatrix(p);
      const bx = Math.floor(worldToCellX(map, p.x) / CHUNK / block), bz = Math.floor(worldToCellZ(map, p.z) / CHUNK / block);
      for (const s of subs) {
        if (!ids.has(s.cm.material)) ids.set(s.cm.material, ids.size);
        const key = `${ids.get(s.cm.material)}|${s.cm.worldUv ? 1 : 0}|${bx}:${bz}`;
        let b = buckets.get(key);
        if (!b) buckets.set(key, b = { cm: s.cm, entries: [], bx, bz });
        b.entries.push({ geometry: s.geometry, matrix });
      }
    }
  });
  const out: THREE.Mesh[] = [];
  for (const [key, { cm, entries, bx, bz }] of buckets) {
    const mesh = new THREE.Mesh(bake(entries, cm.worldUv, uvScale), cm.material);
    mesh.name = `cliff:${cm.material.name || key.split("|")[0]}:${bx}:${bz}`;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    out.push(mesh);
  }
  return out;
}

const v = new THREE.Vector3(), nm = new THREE.Matrix3();

/** The entries' geometry in world space, one indexed geometry: position, normal and (where any has one, or `worldUv`) uv. */
function bake(entries: readonly Entry[], worldUv: boolean, uvScale: number): THREE.BufferGeometry {
  let verts = 0, indices = 0;
  const hasUv = worldUv || entries.some(e => !!e.geometry.getAttribute("uv"));
  for (const { geometry: g } of entries) {
    verts += g.getAttribute("position").count;
    indices += g.index ? g.index.count : g.getAttribute("position").count;
  }
  const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), uv = hasUv ? new Float32Array(verts * 2) : null;
  const index = verts > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  let at = 0, ia = 0;
  for (const { geometry: g, matrix } of entries) {
    const p = g.getAttribute("position"), n = g.getAttribute("normal"), t = g.getAttribute("uv"), count = p.count;
    nm.getNormalMatrix(matrix);
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      pos[(at + i) * 3] = v.x; pos[(at + i) * 3 + 1] = v.y; pos[(at + i) * 3 + 2] = v.z;
      if (uv) {
        if (worldUv) { uv[(at + i) * 2] = v.x * uvScale; uv[(at + i) * 2 + 1] = v.z * uvScale; }
        else if (t) { uv[(at + i) * 2] = t.getX(i); uv[(at + i) * 2 + 1] = t.getY(i); }
      }
      if (n) {
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
        nor[(at + i) * 3] = v.x; nor[(at + i) * 3 + 1] = v.y; nor[(at + i) * 3 + 2] = v.z;
      }
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) index[ia++] = g.index.getX(k) + at;
    else for (let k = 0; k < count; k++) index[ia++] = k + at;
    at += count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}
