/**
 * The smooth world's ground and water as three.js objects (specs/world-editor.md v0 step 3), no React: one mesh a
 * chunk at the level of detail its distance asks for (lib/game/world/mesh.ts), shown while the curved world can bring
 * it into view; the still water over whatever lies below the sea, a mesh a block; one splat material and its paint
 * texture. The game mounts it through SmoothTerrain; the editor (/lab/world) edits the terrain in place and tells it
 * what changed (`edit`), and only the touched chunks, water blocks and paint rows are rewritten.
 *
 * Builds are spread over frames (at most BUILDS_PER_FRAME a frame, nearest first): a chunk keeps drawing its old level
 * until its new one is ready, so moving the camera never stalls on geometry.
 */
import * as THREE from "three";
import { CurvedCull } from "@/lib/game/curvedCull";
import { deepestSeabed } from "@/lib/game/seabed";
import {
  CHUNK_CELLS, LOD_STRIDES, WATER_BLOCK_CHUNKS, chunkBox, chunkGeometry, chunkIsDeepSea, listChunkRefs, lodFor, refreshChunkGeometry, waterBlocks, waterGeometry,
  type ChunkRef,
} from "@/lib/game/world/mesh";
import type { WorldTerrain } from "@/lib/game/world/terrain";
import { terrainMaterial } from "../grid/terrainMaterials";
import { paintTexture, splatMaterial, writePaint } from "./splatMaterial";

/** Geometry builds a frame at most (a chunk at full detail is about a millisecond). */
const BUILDS_PER_FRAME = 6;

interface Chunk {
  ref: ChunkRef;
  mesh: THREE.Mesh;
  /** The level drawn now (-1 before the first build) and the one wanted. */
  lod: number;
  want: number;
  /** Built geometry per level; a stale one (the ground changed under it) is rebuilt before it is shown again. */
  geoms: (THREE.BufferGeometry | null)[];
  stale: boolean[];
  box: THREE.Box3;
  deep: boolean;
  dist: number;
}

interface WaterBlock { x0: number; z0: number; x1: number; z1: number; mesh: THREE.Mesh | null; dirty: boolean }

const _p = new THREE.Vector3();

export class TerrainView {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshStandardMaterial;
  readonly paint: THREE.DataTexture;
  private readonly chunks: Chunk[];
  private readonly water: WaterBlock[];
  private readonly waterMaterial: THREE.Material;
  private readonly cull = new CurvedCull();
  private readonly floor: number;
  /** Edits since the last frame, as a world rect. */
  private dirty: { x0: number; z0: number; x1: number; z1: number } | null = null;
  /** Draw every chunk at this level whatever its distance (the editor's overhead view, the tests); null: by distance. */
  forceLod: number | null = null;

  constructor(readonly terrain: WorldTerrain, opts: { grass?: string; editable?: boolean } = {}) {
    this.group.name = "smooth-terrain";
    this.paint = paintTexture(terrain);
    this.material = splatMaterial(terrain, this.paint, opts.grass);
    this.waterMaterial = terrainMaterial("mRiver")!;
    // The open sea's floor (GridOcean draws it under the whole map, a little below the deepest seabed): a chunk lying
    // all on it adds nothing through the deep water.
    this.floor = terrain.seaLevel - deepestSeabed() + 0.05;
    this.chunks = listChunkRefs(terrain).map(ref => {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
      mesh.name = `terrain:smooth:${ref.cx}:${ref.cz}`;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.group.add(mesh);
      return { ref, mesh, lod: -1, want: LOD_STRIDES.length - 1, geoms: LOD_STRIDES.map(() => null), stale: LOD_STRIDES.map(() => false), box: chunkBox(terrain, ref), deep: !opts.editable && chunkIsDeepSea(terrain, ref, this.floor), dist: Infinity };
    });
    this.water = waterBlocks(terrain).map(b => ({ ...b, mesh: null, dirty: true }));
    this.rebuildWater(true);
  }

  /** Main-thread time the last frame's work took (ms): the editor's HUD shows it while brushing. */
  lastMs = 0;

  /** Per frame: pick each chunk's level by its distance, build what is missing (nearest first), cull, flush edits. */
  frame(camera: THREE.Camera): void {
    const started = performance.now();
    this.frameWork(camera);
    this.lastMs = performance.now() - started;
  }

  private frameWork(camera: THREE.Camera): void {
    this.flush();
    this.cull.update(camera);
    camera.getWorldPosition(_p);
    const todo: Chunk[] = [];
    for (const c of this.chunks) {
      if (c.deep) { c.mesh.visible = false; continue; }
      c.dist = c.box.distanceToPoint(_p);
      c.want = this.forceLod ?? lodFor(c.dist, c.lod);
      if (c.lod !== c.want || c.stale[c.want] || !c.geoms[c.want]) todo.push(c);
    }
    todo.sort((a, b) => a.dist - b.dist);
    let built = 0;
    for (const c of todo) {
      // Over the frame's budget, a chunk already drawing keeps its level for now; one never drawn is always built.
      if (built >= BUILDS_PER_FRAME && c.lod >= 0) continue;
      const g = c.geoms[c.want];
      if (g && !c.stale[c.want]) { c.mesh.geometry = g; c.lod = c.want; continue; }
      if (g && c.stale[c.want]) refreshChunkGeometry(this.terrain, c.ref, c.want, g);
      else c.geoms[c.want] = chunkGeometry(this.terrain, c.ref, c.want);
      c.stale[c.want] = false;
      c.mesh.geometry = c.geoms[c.want]!;
      c.lod = c.want;
      built++;
    }
    for (const c of this.chunks) if (!c.deep && c.lod >= 0) c.mesh.visible = this.cull.visibleBox(c.box);
    for (const w of this.water) if (w.mesh) w.mesh.visible = this.cull.visibleBox(w.mesh.geometry.boundingBox!);
  }

  /** The editor changed the terrain inside world rect [x0, x1] × [z0, z1] (heights, paint or both). */
  edit(x0: number, z0: number, x1: number, z1: number): void {
    const d = this.dirty;
    this.dirty = d ? { x0: Math.min(d.x0, x0), z0: Math.min(d.z0, z0), x1: Math.max(d.x1, x1), z1: Math.max(d.z1, z1) } : { x0, z0, x1, z1 };
  }

  /** Apply the pending edits: touched chunks rewritten in place at their level (other levels marked stale), paint rows, water blocks. */
  flush(): void {
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    const t = this.terrain, pad = 2 / t.res; // a normal reads its neighbours
    const i0 = Math.floor((d.x0 - pad - t.x0) * t.res), i1 = Math.ceil((d.x1 + pad - t.x0) * t.res);
    const k0 = Math.floor((d.z0 - pad - t.z0) * t.res), k1 = Math.ceil((d.z1 + pad - t.z0) * t.res);
    for (const c of this.chunks) {
      const r = c.ref;
      if (r.i1 < i0 || r.i0 > i1 || r.k1 < k0 || r.k0 > k1) continue;
      c.box = chunkBox(t, r, c.box);
      c.deep = false;
      c.stale = c.stale.map(() => true);
      const g = c.lod >= 0 ? c.geoms[c.lod] : null;
      if (g) { refreshChunkGeometry(t, r, c.lod, g); c.stale[c.lod] = false; }
    }
    // Paint rows: the texture uploads only these, a row a range (three uploads each range as one row).
    const r0 = Math.max(0, k0), r1 = Math.min(t.rows - 1, k1);
    writePaint(t, this.paint.image.data as Uint8Array, r0, r1);
    for (let r = r0; r <= r1; r++) this.paint.addUpdateRange(r * t.cols * 4, t.cols * 4);
    this.paint.needsUpdate = true;
    // Water blocks the rect reaches (cells).
    const cx0 = Math.floor(d.x0 - t.x0) - 1, cx1 = Math.ceil(d.x1 - t.x0) + 1, cz0 = Math.floor(d.z0 - t.z0) - 1, cz1 = Math.ceil(d.z1 - t.z0) + 1;
    for (const w of this.water) if (!(w.x1 < cx0 || w.x0 > cx1 || w.z1 < cz0 || w.z0 > cz1)) w.dirty = true;
    this.rebuildWater(false);
  }

  private rebuildWater(all: boolean): void {
    for (const w of this.water) {
      if (!all && !w.dirty) continue;
      w.dirty = false;
      const g = waterGeometry(this.terrain, w.x0, w.z0, w.x1, w.z1);
      if (w.mesh) { w.mesh.geometry.dispose(); if (!g) { this.group.remove(w.mesh); w.mesh = null; continue; } w.mesh.geometry = g; continue; }
      if (!g) continue;
      w.mesh = new THREE.Mesh(g, this.waterMaterial);
      w.mesh.name = `terrain:smooth-water:${w.x0}:${w.z0}`;
      w.mesh.frustumCulled = false;
      this.group.add(w.mesh);
    }
  }

  /** Draw calls and triangles this view draws now (the editor's HUD and the perf notes). */
  stats(): { chunks: number; draws: number; triangles: number; lods: number[] } {
    const lods = LOD_STRIDES.map(() => 0);
    let draws = 0, triangles = 0, chunks = 0;
    for (const c of this.chunks) {
      if (c.deep || c.lod < 0) continue;
      chunks++;
      if (!c.mesh.visible) continue;
      draws++; lods[c.lod]++;
      triangles += (c.mesh.geometry.getIndex()?.count ?? 0) / 3;
    }
    for (const w of this.water) if (w.mesh?.visible) { draws++; triangles += (w.mesh.geometry.getIndex()?.count ?? 0) / 3; }
    return { chunks, draws, triangles, lods };
  }

  dispose(): void {
    for (const c of this.chunks) for (const g of c.geoms) g?.dispose();
    for (const w of this.water) w.mesh?.geometry.dispose();
    this.material.dispose();
    this.paint.dispose();
  }
}

/** Chunks a side, for the docs and the HUD. */
export const VIEW_CHUNK_CELLS = CHUNK_CELLS;
export const VIEW_WATER_BLOCK = CHUNK_CELLS * WATER_BLOCK_CHUNKS;
