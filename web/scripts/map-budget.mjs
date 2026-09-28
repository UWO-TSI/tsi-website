/**
 * What a map costs to render, without needing a GPU.
 *
 * David asked for an island 3-4x larger than the current one. The honest way to
 * answer "does that work" is to count the things that actually scale — chunks,
 * quads, cliff instances, texture bytes — rather than to reason about it. Every
 * number here comes from the same functions the renderer uses
 * (lib/game/mapBudget.ts, which the painter also shows live).
 *
 *   node scripts/map-budget.mjs [path-to-map.json ...]
 *
 * With no argument it reports the shipped village map alongside islands of the
 * same land share on 64, 96, 128 and 256 grids.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

// lib/game is bundler-style TypeScript (extensionless relative imports); let Node find the .ts.
register("data:text/javascript," + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }"));

const WEB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const grid = await import(path.join(WEB, "lib/game/grid.ts"));
const { mapBudget } = await import(path.join(WEB, "lib/game/mapBudget.ts"));

function report(map, label) {
  const b = mapBudget(map);
  console.log(`\n=== ${label} ===`);
  console.log(`grid              ${map.width} x ${map.depth}  (${b.cells} cells)`);
  console.log(`land cells        ${b.land}  (${((100 * b.land) / b.cells).toFixed(1)}% of grid), water ${b.water}`);
  console.log(`island span       ${b.spanX} x ${b.spanZ} world units`);
  console.log(`chunks            ${b.chunksUsed} used / ${b.chunksTotal} total`);
  console.log(`terrain draws     ${b.terrainDraws}  (worst case, all on screen)`);
  console.log(`terrain triangles ${b.terrainTriangles}`);
  console.log(`cliff instances   ${b.cliffPieces}${b.cliffsWithoutPiece ? `  (${b.cliffsWithoutPiece} WITH NO PIECE)` : ""}`);
  console.log(`shore SDF         ${b.shoreSdfMB.toFixed(2)} MB`);
  console.log(`height field      ${b.heightFieldMB.toFixed(2)} MB`);
  console.log(`levels            ${Object.entries(b.levels).map(([l, n]) => `L${l}:${n}`).join("  ")}`);
  console.log(`tallest ground    ${b.tallest.toFixed(2)}u`);
  return b;
}

/** A round island filling `frac` of a square grid, sea as River (the village convention), two terraces. */
function synthetic(size, frac) {
  const map = grid.createCenteredMap(size, size);
  map.surfaces.fill(grid.Surface.River);
  const r = size * Math.sqrt(frac / Math.PI), c = size / 2;
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, z - c);
    if (d <= r) grid.setCell(map, x, z, d < r * 0.35 ? 2 : 0, grid.Surface.Grass);
  }
  return map;
}

const args = process.argv.slice(2);
if (args.length) {
  for (const p of args) report(grid.parseIslandMap(JSON.parse(fs.readFileSync(p, "utf8"))).map, path.basename(p));
} else {
  const { map } = grid.parseIslandMap(JSON.parse(fs.readFileSync(path.join(WEB, "data/village-map.json"), "utf8")));
  const shipped = report(map, "shipped village-map.json");
  const frac = shipped.land / shipped.cells;
  for (const size of [64, 96, 128, 256]) report(synthetic(size, frac), `${size}x${size} island at the same land share`);
}
