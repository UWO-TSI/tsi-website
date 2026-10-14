/**
 * The ground drawn by block, not by chunk (v1 performance; specs/perf/budget.md): terrainChunks builds a geometry per
 * 16 × 16-cell chunk per render layer, and the v2 world's water, bed, fringe and ground drew one call each for every
 * chunk in view (about 220 of its 700). Merged into blocks of TERRAIN_BLOCK × TERRAIN_BLOCK chunks per layer, it is a
 * call per block in view, with the same geometry, materials and draw order. The water layers (the surface, its bed
 * and the grass fringe at its edge) are broad and light, a few thousand flat triangles a chunk, so they merge in
 * blocks twice as wide (WATER_BLOCK): fewer calls for a few more off-screen triangles. Pure, so tests measure what the
 * game draws.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Chunks a block spans along each side (64 × 64 cells), and for the water layers (128 × 128). */
export const TERRAIN_BLOCK = 4, WATER_BLOCK = 8;

export interface TerrainPiece { key: string; surface: number; geometry: THREE.BufferGeometry }

/** What mergeGeometries needs to match: the attributes (with their sizes) and whether it is indexed. */
const layoutOf = (g: THREE.BufferGeometry) =>
  `${Object.entries(g.attributes).map(([name, a]) => `${name}${a.itemSize}`).sort().join(",")}|${g.index ? "i" : "n"}`;

/**
 * `chunks` (keyed `chunkX:chunkZ:surface`, terrainChunks) merged per layer into blocks of `block` × `block` chunks (or
 * the layer's own size), in
 * the order each layer first appears. Each block's key is `surface:blockX:blockZ`, its bounding sphere computed.
 */
export function terrainBlocks(chunks: readonly TerrainPiece[], block: number | ((surface: number) => number) = TERRAIN_BLOCK): TerrainPiece[] {
  const groups = new Map<string, { surface: number; key: string; parts: THREE.BufferGeometry[] }>();
  for (const c of chunks) {
    const [cx, cz] = c.key.split(":").map(Number), size = typeof block === "number" ? block : block(c.surface);
    const key = `${c.surface}:${Math.floor(cx / size)}:${Math.floor(cz / size)}`, at = `${key}|${layoutOf(c.geometry)}`;
    const g = groups.get(at);
    if (g) g.parts.push(c.geometry); else groups.set(at, { surface: c.surface, key, parts: [c.geometry] });
  }
  const out: TerrainPiece[] = [];
  const keys = new Set<string>();
  for (const { surface, key, parts } of groups.values()) {
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts);
    if (!geometry) { parts.forEach((p, i) => out.push({ key: `${key}:${i}`, surface, geometry: p })); continue; }
    if (geometry !== parts[0]) parts.forEach(p => p.dispose());
    geometry.computeBoundingSphere();
    // Two layouts in one block (never seen): keep both, under distinct keys.
    const unique = keys.has(key) ? `${key}:${out.length}` : key;
    keys.add(unique);
    out.push({ key: unique, surface, geometry });
  }
  return out;
}
