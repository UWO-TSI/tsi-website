import {
  createCenteredMap, setCell, Surface, heightField, sampleGroundHeight,
  worldToCellX, worldToCellZ, isGroundAtWorld, surfaceAt,
} from "./grid";
import { cellsOf, type PlacedItem } from "@/lib/homes/layout";
import { standWorld, type MoveWorld } from "./movement/sim";
import { TREE_TRUNK } from "./defaultIsland";

/**
 * Personal home island (specs/homes.md §1): a fixed natural islet about a
 * quarter of the village core, same grid terrain. World +x is screen left.
 * The house faces the dock; the mailbox sits beside the front door.
 */
export const HOME_RADII = { x: 12, z: 10 } as const;
export const HOME_SPAWN: [number, number, number] = [0, 0, -6.5];
/** House footprint (world rect) and front door. */
export const HOUSE = { x: 0, z: 4, halfW: 2.5, halfD: 2.1, door: [0, 1.3] as [number, number] };
export const HOME_MAILBOX: [number, number] = [2.3, 1.3];
/** Dock sign: return to the village. */
export const HOME_DOCK: [number, number] = [0, -8.4];
export const HOME_TREES: [number, number][] = [[-7, 3], [7.5, 2], [-5, -5], [6, -5.5]];
export const HOME_BUSHES: [number, number][] = [[-3.6, 1.2], [4.2, 3.5], [-8.5, -1], [8.5, -2]];
export const HOME_FLOWERS: [number, number][] = [[-2.2, -2.5], [2.6, -2], [-6, 0], [5, 0.5]];

const inRect = (x: number, z: number, cx: number, cz: number, hw: number, hd: number) => Math.abs(x - cx) < hw && Math.abs(z - cz) < hd;

export function createHomeIsland() {
  const map = createCenteredMap(32, 32);
  for (let z = 0; z < map.depth; z++) for (let x = 0; x < map.width; x++) {
    const wx = x + map.originX, wz = z + map.originZ;
    const r = Math.hypot(wx / HOME_RADII.x, wz / HOME_RADII.z);
    let surface: number = r < 0.8 ? Surface.Grass : r < 1 ? Surface.Sand : Surface.River;
    if (r < 0.8 && Math.abs(wx) <= 0 && wz >= -8 && wz <= 1) surface = Surface.Soil;
    setCell(map, x, z, 0, surface);
  }
  const field = heightField(map);
  const ground = (x: number, z: number) => sampleGroundHeight(map, field, x, z);
  const surface = (x: number, z: number) => surfaceAt(map, worldToCellX(map, x), worldToCellZ(map, z));
  /** Fixed obstacles only: water, house, mailbox, trees, dock sign. */
  const fixedFree = (x: number, z: number) => isGroundAtWorld(map, x, z)
    && !inRect(x, z, HOUSE.x, HOUSE.z, HOUSE.halfW, HOUSE.halfD)
    && !inRect(x, z, HOME_MAILBOX[0], HOME_MAILBOX[1], 0.35, 0.35)
    && !HOME_TREES.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < TREE_TRUNK);
  /** Can a placed item cover this cell? Needs all four corners of the cell free, and keeps the door approach open. */
  const placeable = (cx: number, cz: number) =>
    [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]].every(([dx, dz]) => fixedFree(cx + dx, cz + dz))
    && !inRect(cx + 0.5, cz + 0.5, HOUSE.door[0], HOUSE.door[1] - 0.5, 1, 1)
    && !inRect(cx + 0.5, cz + 0.5, HOME_DOCK[0], HOME_DOCK[1], 1, 1.2);
  /** The islet for the movement sim with these outdoor items placed (flowers are walked over). */
  const worldWith = (items: readonly PlacedItem[]): MoveWorld => {
    const blocked = new Set(items.filter(i => !i.piece.startsWith("flower-")).flatMap(cellsOf).map(([x, z]) => `${x},${z}`));
    return standWorld(ground, (x, z) => fixedFree(x, z) && !blocked.has(`${Math.floor(x)},${Math.floor(z)}`), (x, z) => !isGroundAtWorld(map, x, z));
  };
  return { map, ground, surface, fixedFree, placeable, worldWith };
}
