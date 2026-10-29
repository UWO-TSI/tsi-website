/**
 * The smooth world's geometry (specs/world-editor.md v0 step 3): the heightfield in chunks of CHUNK_CELLS × CHUNK_CELLS
 * cells, each drawn at one of LODS levels of detail (every 1st, 2nd, 4th or 8th sample), and the still water over
 * whatever lies below the sea. Pure (three's BufferGeometry, no React), so the tests measure exactly what is drawn.
 *
 * NO GAPS. Chunks at the same level of detail share their edge vertices exactly (the same samples, the same normals:
 * every normal is the full-detail ground's own slope at that sample). Where two levels meet, each chunk hangs a skirt
 * from its edges: a vertical strip down by twice the most any level of detail departs from the full ground along
 * that edge, so whatever its neighbour draws, the skirt closes the gap (tested pairwise for every level). The skirt
 * wears the edge's normals, so the sliver it shows reads as the ground beside it.
 *
 * Every quad is two triangles split from its (i, k) corner to its (i + 1, k + 1) corner: the same split
 * `terrainHeight` interpolates on, so the walker stands on the drawn ground at full detail.
 */
import * as THREE from "three";
import { sampleGradient, type WorldTerrain } from "./terrain";

/** Cells along a chunk's side (32 world units: a draw call per chunk in view). */
export const CHUNK_CELLS = 32;
/** Levels of detail: the sample stride of each. */
export const LOD_STRIDES = [1, 2, 4, 8] as const;
/** Camera distance (world units, to the chunk's nearest point) where each level hands over to the next; a little hysteresis. */
export const LOD_DISTANCE = [56, 112, 224] as const;
export const LOD_HYSTERESIS = 8;
/** Water is drawn over a cell whose ground anywhere dips below this far over the sea (the swell's reach and the swash up the sand: waterShader SWASH). */
export const WATER_MARGIN = 0.45;
/** Water quads merge in blocks of this many chunks a side (64 u: each block culled on its own, perf-tris). */
export const WATER_BLOCK_CHUNKS = 2;

export interface ChunkRef {
  cx: number;
  cz: number;
  /** Sample range covered, inclusive. */
  i0: number;
  i1: number;
  k0: number;
  k1: number;
}

export const chunkCountX = (t: WorldTerrain) => Math.ceil(t.width / CHUNK_CELLS);
export const chunkCountZ = (t: WorldTerrain) => Math.ceil(t.depth / CHUNK_CELLS);

export function chunkRef(t: WorldTerrain, cx: number, cz: number): ChunkRef {
  const n = CHUNK_CELLS * t.res;
  return { cx, cz, i0: cx * n, i1: Math.min(t.cols - 1, (cx + 1) * n), k0: cz * n, k1: Math.min(t.rows - 1, (cz + 1) * n) };
}

export function listChunkRefs(t: WorldTerrain): ChunkRef[] {
  const out: ChunkRef[] = [];
  for (let cz = 0; cz < chunkCountZ(t); cz++) for (let cx = 0; cx < chunkCountX(t); cx++) out.push(chunkRef(t, cx, cz));
  return out;
}

/** The sample indices a level of detail keeps along [a, b]: every `stride`th from a, and always b. */
export function strideIndices(a: number, b: number, stride: number): number[] {
  const out: number[] = [];
  for (let i = a; i < b; i += stride) out.push(i);
  out.push(b);
  return out;
}

/** The ground a level of detail draws along one edge at full-detail sample j (linear between its kept samples). */
function lodEdgeHeight(h: (j: number) => number, kept: readonly number[], j: number): number {
  let s = 0;
  while (s + 1 < kept.length && kept[s + 1] < j) s++;
  const a = kept[s], b = kept[Math.min(s + 1, kept.length - 1)];
  if (b === a) return h(a);
  return h(a) + ((h(b) - h(a)) * (j - a)) / (b - a);
}

/**
 * How far a skirt hangs below one chunk edge: twice the most any level of detail departs from the full ground along it
 * (each side of the edge is at most that far off, so the two together at most twice), plus a little.
 */
export function skirtDepth(h: (j: number) => number, a: number, b: number): number {
  let worst = 0;
  for (const stride of LOD_STRIDES) {
    if (stride === 1) continue;
    const kept = strideIndices(a, b, stride);
    for (let j = a; j <= b; j++) worst = Math.max(worst, Math.abs(lodEdgeHeight(h, kept, j) - h(j)));
  }
  return 2 * worst + 0.05;
}

/** The four edges' skirt depths: low z, high z (along x), low x, high x (along z). */
export function chunkSkirts(t: WorldTerrain, c: ChunkRef): [number, number, number, number] {
  const H = t.heights, W = t.cols;
  return [
    skirtDepth(j => H[c.k0 * W + j], c.i0, c.i1),
    skirtDepth(j => H[c.k1 * W + j], c.i0, c.i1),
    skirtDepth(j => H[j * W + c.i0], c.k0, c.k1),
    skirtDepth(j => H[j * W + c.i1], c.k0, c.k1),
  ];
}

/** The ground's chunk at a level of detail: positions, normals and the index, skirts included. */
export function chunkGeometry(t: WorldTerrain, c: ChunkRef, lod: number, out?: THREE.BufferGeometry): THREE.BufferGeometry {
  const stride = LOD_STRIDES[Math.min(lod, LOD_STRIDES.length - 1)];
  const xs = strideIndices(c.i0, c.i1, stride), zs = strideIndices(c.k0, c.k1, stride), nx = xs.length, nz = zs.length;
  const grid = nx * nz, edge = 2 * nx + 2 * nz, total = grid + edge;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  writeGrid(t, xs, zs, pos, nor);
  // Skirts: each edge's vertices again, lowered by that edge's depth. Order: low z, high z, low x, high x.
  const depth = chunkSkirts(t, c);
  const edges: { verts: number[]; out: [number, number] }[] = [
    { verts: xs.map((_, a) => a), out: [0, -1] },
    { verts: xs.map((_, a) => (nz - 1) * nx + a), out: [0, 1] },
    { verts: zs.map((_, b) => b * nx), out: [-1, 0] },
    { verts: zs.map((_, b) => b * nx + nx - 1), out: [1, 0] },
  ];
  const index: number[] = [];
  for (let b = 0; b + 1 < nz; b++) for (let a = 0; a + 1 < nx; a++) {
    const p = b * nx + a, q = p + 1, r = p + nx, s = r + 1;
    index.push(p, s, q, p, r, s);
  }
  let at = grid;
  edges.forEach((e, ei) => {
    const base = at;
    for (const v of e.verts) {
      pos[at * 3] = pos[v * 3]; pos[at * 3 + 1] = pos[v * 3 + 1] - depth[ei]; pos[at * 3 + 2] = pos[v * 3 + 2];
      nor[at * 3] = nor[v * 3]; nor[at * 3 + 1] = nor[v * 3 + 1]; nor[at * 3 + 2] = nor[v * 3 + 2];
      at++;
    }
    for (let j = 0; j + 1 < e.verts.length; j++) {
      const top0 = e.verts[j], top1 = e.verts[j + 1], bot0 = base + j, bot1 = base + j + 1;
      // Wind so the strip faces outward from the chunk.
      const ax = pos[top1 * 3] - pos[top0 * 3], az = pos[top1 * 3 + 2] - pos[top0 * 3 + 2];
      const facing = az * e.out[0] - ax * e.out[1]; // (top1 - top0) × down, along the outward normal
      if (facing > 0) index.push(top0, top1, bot0, top1, bot1, bot0);
      else index.push(top0, bot0, top1, top1, bot0, bot1);
    }
  });
  const g = out ?? new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setIndex(grid + edge > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
  g.userData.skirts = depth;
  g.userData.counts = { nx, nz };
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** Positions and normals of the kept samples (x along, z down), row after row. */
function writeGrid(t: WorldTerrain, xs: readonly number[], zs: readonly number[], pos: Float32Array, nor: Float32Array) {
  let v = 0;
  for (const k of zs) for (const i of xs) {
    const [gx, gz] = sampleGradient(t, i, k), l = Math.hypot(gx, 1, gz);
    pos[v * 3] = t.x0 + i / t.res; pos[v * 3 + 1] = t.heights[k * t.cols + i]; pos[v * 3 + 2] = t.z0 + k / t.res;
    nor[v * 3] = -gx / l; nor[v * 3 + 1] = 1 / l; nor[v * 3 + 2] = -gz / l;
    v++;
  }
}

/** World-space bounds of a chunk's ground (its skirts included). */
export function chunkBox(t: WorldTerrain, c: ChunkRef, box = new THREE.Box3()): THREE.Box3 {
  let lo = Infinity, hi = -Infinity;
  for (let k = c.k0; k <= c.k1; k++) for (let i = c.i0; i <= c.i1; i++) { const h = t.heights[k * t.cols + i]; if (h < lo) lo = h; if (h > hi) hi = h; }
  return box.set(new THREE.Vector3(t.x0 + c.i0 / t.res, lo - 2, t.z0 + c.k0 / t.res), new THREE.Vector3(t.x0 + c.i1 / t.res, hi, t.z0 + c.k1 / t.res));
}

/** The level of detail for a chunk `d` units from the camera, given the level it has now (hysteresis). */
export function lodFor(d: number, current: number): number {
  let lod = 0;
  while (lod < LOD_DISTANCE.length && d > LOD_DISTANCE[lod]) lod++;
  if (lod === current || current < 0) return lod;
  // Only change once clear of the boundary by the hysteresis.
  const boundary = lod > current ? LOD_DISTANCE[lod - 1] : LOD_DISTANCE[lod];
  return Math.abs(d - boundary) > LOD_HYSTERESIS ? lod : current;
}

/** Whether a whole chunk lies at the open sea's floor (nothing to see through the deep water but the floor GridOcean draws). */
export function chunkIsDeepSea(t: WorldTerrain, c: ChunkRef, floor: number): boolean {
  for (let k = c.k0; k <= c.k1; k++) for (let i = c.i0; i <= c.i1; i++) if (t.heights[k * t.cols + i] > floor) return false;
  return true;
}

/**
 * The still water over one block of cells [x0, x1) × [z0, z1) (cell indices): a quad per cell (corners on cell
 * corners, as the open sea's mesh meets them along the map's edge) wherever the ground in that cell dips below
 * WATER_MARGIN over the sea. Positions only, at the sea level; null when the block is dry.
 */
export function waterGeometry(t: WorldTerrain, x0: number, z0: number, x1: number, z1: number): THREE.BufferGeometry | null {
  const r = t.res, cw = x1 - x0, cd = z1 - z0, limit = t.seaLevel + WATER_MARGIN;
  const wet = new Uint8Array(cw * cd);
  let n = 0;
  for (let cz = z0; cz < z1; cz++) for (let cx = x0; cx < x1; cx++) {
    let low = Infinity;
    for (let k = cz * r; k <= (cz + 1) * r; k++) for (let i = cx * r; i <= (cx + 1) * r; i++) low = Math.min(low, t.heights[k * t.cols + i]);
    if (low < limit) { wet[(cz - z0) * cw + cx - x0] = 1; n++; }
  }
  if (!n) return null;
  // Shared corners: a vertex per used cell corner.
  const id = new Int32Array((cw + 1) * (cd + 1)).fill(-1), pos: number[] = [], index: number[] = [];
  const corner = (a: number, b: number) => {
    const p = b * (cw + 1) + a;
    if (id[p] < 0) { id[p] = pos.length / 3; pos.push(t.x0 + x0 + a, t.seaLevel, t.z0 + z0 + b); }
    return id[p];
  };
  for (let b = 0; b < cd; b++) for (let a = 0; a < cw; a++) {
    if (!wet[b * cw + a]) continue;
    const p = corner(a, b), q = corner(a + 1, b), s = corner(a + 1, b + 1), u = corner(a, b + 1);
    index.push(p, s, q, p, u, s);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** The water blocks (cell ranges) of a terrain. */
export function waterBlocks(t: WorldTerrain): { bx: number; bz: number; x0: number; z0: number; x1: number; z1: number }[] {
  const size = CHUNK_CELLS * WATER_BLOCK_CHUNKS, out = [];
  for (let z = 0, bz = 0; z < t.depth; z += size, bz++) for (let x = 0, bx = 0; x < t.width; x += size, bx++) {
    out.push({ bx, bz, x0: x, z0: z, x1: Math.min(t.width, x + size), z1: Math.min(t.depth, z + size) });
  }
  return out;
}

/**
 * Rewrite a chunk geometry's heights and normals in place after an edit (the editor's brush), without reallocating:
 * the grid, then each skirt from its edge (its depth re-measured). `geometry` must be this chunk's at this level.
 */
export function refreshChunkGeometry(t: WorldTerrain, c: ChunkRef, lod: number, g: THREE.BufferGeometry): void {
  const stride = LOD_STRIDES[Math.min(lod, LOD_STRIDES.length - 1)];
  const xs = strideIndices(c.i0, c.i1, stride), zs = strideIndices(c.k0, c.k1, stride), nx = xs.length, nz = zs.length;
  const posAttr = g.getAttribute("position") as THREE.BufferAttribute, norAttr = g.getAttribute("normal") as THREE.BufferAttribute;
  const pos = posAttr.array as Float32Array, nor = norAttr.array as Float32Array;
  writeGrid(t, xs, zs, pos, nor);
  const depth = chunkSkirts(t, c), edgeVerts = [xs.map((_, a) => a), xs.map((_, a) => (nz - 1) * nx + a), zs.map((_, b) => b * nx), zs.map((_, b) => b * nx + nx - 1)];
  let at = nx * nz;
  edgeVerts.forEach((verts, ei) => {
    for (const v of verts) {
      pos[at * 3 + 1] = pos[v * 3 + 1] - depth[ei];
      nor[at * 3] = nor[v * 3]; nor[at * 3 + 1] = nor[v * 3 + 1]; nor[at * 3 + 2] = nor[v * 3 + 2];
      at++;
    }
  });
  g.userData.skirts = depth;
  posAttr.needsUpdate = true;
  norAttr.needsUpdate = true;
  g.computeBoundingSphere();
  g.computeBoundingBox();
}
