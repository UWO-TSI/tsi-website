/**
 * The smooth world as the server checks it (lib/collections/rolls.ts): the server can't decode the world's PNGs, so the
 * cell view its catch checks need ships beside them as `web/data/world/cells.json`, written with every save
 * (world/disk.ts writeWorldFiles). Each cell is water `~`, built ground `#` (stone, which squares the coast), sand `s`,
 * soil `d` (where things are buried: islandNodes.ts digSpots) or other land `.`, run-length coded per row. That is all
 * the coast (grid.ts terrainOf), the water classes (fishingSpots.ts) and the node ids (islandNodes.ts) read, so the server's village gives exactly the client's casts and nodes.
 */
import { Surface, createMap, isWater, type IslandMap, type MapAnnotation } from "../grid";
import { villageOf, type MapObject, type Village } from "../villageMap";

export interface WorldCells { width: number; depth: number; originX: number; originZ: number; rows: string[] }

const BUILT = new Set<number>([Surface.Stone, Surface.Wood, Surface.Brick]);
const cellChar = (s: number) => (isWater(s) ? "~" : BUILT.has(s) ? "#" : s === Surface.Sand ? "s" : s === Surface.Soil ? "d" : ".");
const SURFACE: Record<string, number> = { "~": Surface.River, "#": Surface.Stone, s: Surface.Sand, d: Surface.Soil, ".": Surface.Grass };

/** A world's cells (its derived cell map, terrain.ts cellMapOf), coded. */
export function worldCells(map: IslandMap): WorldCells {
  const rows: string[] = [];
  for (let cz = 0; cz < map.depth; cz++) {
    let row = "";
    for (let cx = 0; cx < map.width;) {
      const c = cellChar(map.surfaces[cz * map.width + cx]);
      let n = 1;
      while (cx + n < map.width && cellChar(map.surfaces[cz * map.width + cx + n]) === c) n++;
      row += c + n;
      cx += n;
    }
    rows.push(row);
  }
  return { width: map.width, depth: map.depth, originX: map.originX, originZ: map.originZ, rows };
}

/** The file's text: one row per line, so a save diffs by row. */
export const worldCellsJson = (c: WorldCells) =>
  `{"width":${c.width},"depth":${c.depth},"originX":${c.originX},"originZ":${c.originZ},"rows":[\n${c.rows.map(r => JSON.stringify(r)).join(",\n")}\n]}\n`;

export function cellsMap(c: WorldCells): IslandMap {
  const map = createMap(c.width, c.depth, c.originX, c.originZ);
  c.rows.forEach((row, cz) => {
    let cx = 0;
    for (const [, ch, n] of row.matchAll(/([~#.sd])(\d+)/g)) for (let k = 0; k < Number(n); k++) map.surfaces[cz * c.width + cx++] = SURFACE[ch];
  });
  return map;
}

/** A world's river cells (its "River" annotation), which fish as river (lib/game/fishingSpots.ts classifyWater). */
export const riverCells = (annotations: readonly MapAnnotation[] = []) => annotations.find(a => a.name === "River")?.cells;

/**
 * The server's village of the smooth world: its cells and the world document's objects and annotations (its river).
 * Its sand and soil are read by the dig spots alone (`digSurface`, islandNodes.ts digSpots); the map takes them as plain
 * land, as it always did: the natural shoreline would double the server's coast work and change nothing it checks.
 */
export function villageOfCells(c: WorldCells, objects: readonly MapObject[], annotations?: readonly MapAnnotation[]): Village {
  const map = cellsMap(c), dig = Uint8Array.from(map.surfaces);
  for (let i = 0; i < map.surfaces.length; i++) if (map.surfaces[i] === Surface.Sand || map.surfaces[i] === Surface.Soil) map.surfaces[i] = Surface.Grass;
  const digSurface = (cx: number, cz: number) => (cx >= 0 && cz >= 0 && cx < c.width && cz < c.depth ? dig[cz * c.width + cx] : Surface.Grass);
  return { ...villageOf(map, objects), rivers: riverCells(annotations), digSurface };
}
