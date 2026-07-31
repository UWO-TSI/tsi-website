/**
 * What a map costs to render, without needing a GPU.
 *
 * David asked for an island 3-4x larger than the current one. The honest way to
 * answer "does that work" is to count the things that actually scale — chunks,
 * quads, cliff instances, texture bytes — rather than to reason about it. Every
 * number here comes from the same functions the renderer uses.
 *
 *   node scripts/map-budget.mjs [path-to-island-map.json ...]
 *
 * With no argument it reports the shipped map alongside a synthetic island
 * scaled to what David described, so the two are directly comparable.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const grid = await import(path.join(WEB, "lib/game/grid.ts"));

const { CHUNK, SHORE_SDF_SCALE, TILE, LEVEL_STEP } = grid;

/** Every distinct surface a chunk contains gets its own merged geometry. */
function budget(map, label) {
  let land = 0;
  let river = 0;
  let cliffCells = 0;
  let cliffPieces = 0;
  const levels = new Map();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  for (let z = 0; z < map.depth; z++) {
    for (let x = 0; x < map.width; x++) {
      const s = grid.surfaceAt(map, x, z);
      if (grid.isVoid(s)) continue;
      land++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      if (grid.isRiver(s)) river++;
      const l = grid.levelAt(map, x, z);
      levels.set(l, (levels.get(l) ?? 0) + 1);
      if (grid.needsCliff(map, x, z)) {
        cliffCells++;
        if (grid.cliffPieceFor(map, x, z)) cliffPieces++;
      }
    }
  }

  // Draw calls: one mesh per (chunk, surface) that has any cell, which is what
  // GridTerrain emits. Chunks frustum-cull, so this is the WORST case, all of
  // it on screen at once.
  const chunkSurfaces = new Map();
  let usedChunks = 0;
  for (const c of grid.listChunks(map)) {
    const seen = new Set();
    for (let z = c.minCellZ; z <= c.maxCellZ; z++) {
      for (let x = c.minCellX; x <= c.maxCellX; x++) {
        const s = grid.surfaceAt(map, x, z);
        if (!grid.isVoid(s)) seen.add(s);
      }
    }
    if (seen.size) usedChunks++;
    // ChunkRef has no `key`; keying on one would collide every chunk onto
    // `undefined` and report a single draw call for the whole island.
    chunkSurfaces.set(`${c.chunkX},${c.chunkZ}`, seen.size);
  }
  const terrainDraws = [...chunkSurfaces.values()].reduce((a, b) => a + b, 0);

  // One quad per land cell, two triangles each. Blend cells subdivide 4x4,
  // which the renderer only does next to a half step; counted separately.
  const quads = land;
  const sdfSide = Math.max(map.width, map.depth) * SHORE_SDF_SCALE;
  const sdfBytes = sdfSide * sdfSide * 2; // half float, single channel

  const spanX = (maxX - minX + 1) * TILE;
  const spanZ = (maxZ - minZ + 1) * TILE;

  console.log(`\n=== ${label} ===`);
  console.log(`grid              ${map.width} x ${map.depth}  (${map.width * map.depth} cells)`);
  console.log(`land cells        ${land}  (${((100 * land) / (map.width * map.depth)).toFixed(1)}% of grid)`);
  console.log(`island span       ${spanX} x ${spanZ} world units`);
  console.log(`river cells       ${river}`);
  console.log(`chunks            ${usedChunks} used / ${grid.chunkCountX(map) * grid.chunkCountZ(map)} total`);
  console.log(`terrain draws     ${terrainDraws}  (worst case, all on screen)`);
  console.log(`terrain triangles ${quads * 2}`);
  console.log(`cliff instances   ${cliffPieces}${cliffCells !== cliffPieces ? `  (${cliffCells - cliffPieces} WITH NO PIECE)` : ""}`);
  console.log(`shore SDF         ${sdfSide} x ${sdfSide} = ${(sdfBytes / 1048576).toFixed(2)} MB`);
  console.log(`height field      ${(((map.width + 1) * (map.depth + 1) * 4) / 1048576).toFixed(2)} MB`);
  console.log(
    `levels            ${[...levels.keys()].sort((a, b) => a - b).map((l) => `L${l}:${levels.get(l)}`).join("  ")}`
  );
  console.log(`tallest ground    ${(Math.max(...levels.keys()) * LEVEL_STEP).toFixed(2)}u`);
  return { land, terrainDraws, triangles: quads * 2, cliffPieces, usedChunks, spanX, sdfBytes };
}

/** A round island filling `frac` of a square grid, for comparison only. */
function synthetic(size, frac) {
  const map = grid.createCenteredMap(size, size);
  map.surfaces.fill(grid.Surface.Void);
  const r = (size / 2) * Math.sqrt(frac);
  const cx = size / 2;
  const cz = size / 2;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d > r) continue;
      // Two terraces, so the cliff count is representative rather than zero.
      const lvl = d < r * 0.35 ? 2 : 0;
      grid.setCell(map, x, z, lvl, grid.Surface.Grass);
    }
  }
  return map;
}

const args = process.argv.slice(2);
const results = [];

if (args.length) {
  for (const p of args) {
    const doc = JSON.parse(fs.readFileSync(p, "utf8"));
    const { map } = grid.parseIslandMap(doc);
    results.push(budget(map, path.basename(p)));
  }
} else {
  const doc = JSON.parse(fs.readFileSync(path.join(WEB, "data/island-map.json"), "utf8"));
  const { map } = grid.parseIslandMap(doc);
  const shipped = budget(map, "shipped island-map.json");
  const landFrac = shipped.land / (map.width * map.depth);
  // Same share of a 256 grid = 4x the land, which is the top of David's range.
  const big = budget(synthetic(256, landFrac), "synthetic 256 island at the same land share");
  console.log("\n=== ratio, big / shipped ===");
  console.log(`land         ${(big.land / shipped.land).toFixed(2)}x`);
  console.log(`draws        ${(big.terrainDraws / shipped.terrainDraws).toFixed(2)}x`);
  console.log(`triangles    ${(big.triangles / shipped.triangles).toFixed(2)}x`);
  console.log(`SDF memory   ${(big.sdfBytes / shipped.sdfBytes).toFixed(2)}x`);
  console.log(`island span  ${(big.spanX / shipped.spanX).toFixed(2)}x across`);
}
