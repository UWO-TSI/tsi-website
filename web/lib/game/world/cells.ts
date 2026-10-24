/**
 * The smooth world as the server checks it (lib/collections/rolls.ts): the server can't decode the world's PNGs, so the
 * cell view its catch checks need ships beside them as `web/data/world/cells.json`, written with every save
 * (world/disk.ts writeWorldFiles). Each cell is water `~`, built ground `#` (stone, which squares the coast) or land `.`,
 * run-length coded per row. That is all the coast (grid.ts terrainOf), the water classes (fishingSpots.ts) and the node
 * ids (islandNodes.ts) read, so the server's village gives exactly the client's casts and nodes.
 */
import { Surface, createMap, isWater, type IslandMap } from "../grid";
import { villageOf, type MapObject, type Village } from "../villageMap";

export interface WorldCells { width: number; depth: number; originX: number; originZ: number; rows: string[] }

const BUILT = new Set<number>([Surface.Stone, Surface.Wood, Surface.Brick]);
const cellChar = (s: number) => (isWater(s) ? "~" : BUILT.has(s) ? "#" : ".");
const SURFACE: Record<string, number> = { "~": Surface.River, "#": Surface.Stone, ".": Surface.Grass };

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
    for (const [, ch, n] of row.matchAll(/([~#.])(\d+)/g)) for (let k = 0; k < Number(n); k++) map.surfaces[cz * c.width + cx++] = SURFACE[ch];
  });
  return map;
}

/** The server's village of the smooth world: its cells and the world document's objects. */
export const villageOfCells = (c: WorldCells, objects: readonly MapObject[]): Village => villageOf(cellsMap(c), objects);
