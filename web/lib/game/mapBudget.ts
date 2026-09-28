/**
 * What a map costs to render, without a GPU (specs/island-painter.md §10).
 * Every number comes from the functions the renderer uses. Shared by
 * `scripts/map-budget.mjs` and the painter's live budget panel, so David sees
 * the cost of size while he paints. Relative imports only: the script loads
 * this file with plain Node (it resolves the extensionless import itself).
 */
import {
  SHORE_SDF_SCALE, TILE, LEVEL_STEP, chunkCountX, chunkCountZ, cliffPieceFor, isRiver, isVoid, levelAt,
  listChunks, needsCliff, surfaceAt, type IslandMap,
} from "./grid";

export interface MapBudget {
  cells: number;
  land: number;
  water: number;
  /** Land extent in world units. */
  spanX: number;
  spanZ: number;
  chunksUsed: number;
  chunksTotal: number;
  /** One mesh per (chunk, surface) with any cell: the worst case, all on screen. */
  terrainDraws: number;
  terrainTriangles: number;
  cliffPieces: number;
  cliffsWithoutPiece: number;
  shoreSdfMB: number;
  heightFieldMB: number;
  levels: Record<number, number>;
  tallest: number;
}

export function mapBudget(map: IslandMap): MapBudget {
  let land = 0, water = 0, cliffCells = 0, cliffPieces = 0;
  const levels: Record<number, number> = {};
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let z = 0; z < map.depth; z++) {
    for (let x = 0; x < map.width; x++) {
      const s = surfaceAt(map, x, z);
      if (isVoid(s)) continue;
      // Water cells draw a water quad and a bed quad.
      if (isRiver(s)) { water++; continue; }
      land++;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      const l = levelAt(map, x, z);
      levels[l] = (levels[l] ?? 0) + 1;
      if (needsCliff(map, x, z)) { cliffCells++; if (cliffPieceFor(map, x, z)) cliffPieces++; }
    }
  }
  let terrainDraws = 0, chunksUsed = 0;
  for (const c of listChunks(map)) {
    const seen = new Set<number>();
    for (let z = c.minCellZ; z <= c.maxCellZ; z++) for (let x = c.minCellX; x <= c.maxCellX; x++) {
      const s = surfaceAt(map, x, z);
      if (!isVoid(s)) seen.add(s);
    }
    if (seen.size) chunksUsed++;
    terrainDraws += seen.size;
  }
  const sdfSide = Math.max(map.width, map.depth) * SHORE_SDF_SCALE;
  const any = land > 0;
  return {
    cells: map.width * map.depth, land, water,
    spanX: any ? (maxX - minX + 1) * TILE : 0, spanZ: any ? (maxZ - minZ + 1) * TILE : 0,
    chunksUsed, chunksTotal: chunkCountX(map) * chunkCountZ(map), terrainDraws,
    terrainTriangles: (land + water * 2) * 2, cliffPieces, cliffsWithoutPiece: cliffCells - cliffPieces,
    shoreSdfMB: (sdfSide * sdfSide * 2) / 1048576,
    heightFieldMB: ((map.width + 1) * (map.depth + 1) * 4) / 1048576,
    levels, tallest: Math.max(0, ...Object.keys(levels).map(Number)) * LEVEL_STEP,
  };
}
