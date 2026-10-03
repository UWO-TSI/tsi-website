/**
 * Home layout document (specs/homes.md deliverable 3). This is the typed
 * contract persistence speaks: today a local store (store.ts), later the
 * systems agent's Supabase rows. Pure functions only: snap, rotation,
 * footprints, collision, (de)serialisation.
 */
import { catalogueItem, type Mount } from "./catalogue";

export type Rotation = 0 | 1 | 2 | 3;
export type Wall = "n" | "e" | "w";
export interface PlacedItem {
  uid: string;
  piece: string;
  /** Floor/rug: min-corner cell [x, z]. Wall: [index along the wall, 0]. */
  cell: [number, number];
  rot: Rotation;
  /** Wall items only. */
  wall?: Wall;
}
export interface RoomDoc {
  id: string;
  wallpaper: string;
  flooring: string;
  items: PlacedItem[];
}
export interface HomeLayoutDoc {
  version: 1;
  rooms: RoomDoc[];
  /** Island items, cells in island world units. */
  outdoor: PlacedItem[];
}

/** Room grid (cells). ACNH-style small starter room; every room is the same size for now. */
export const ROOM_SIZE: [number, number] = [6, 6];
/** Room cap (row 115, assumed 4 until balanced). */
export const MAX_ROOMS = 4;
/** Price stub shown at the room door (row 127). */
export const ROOM_PRICE = { coins: 500, materials: "10 wood, 5 stone" };
export const WALLPAPERS = ["plaster00", "stripe02", "log00", "brick00"] as const;
export const FLOORINGS = ["simpleparquet00", "tatami00", "simplecarpet01", "simple00"] as const;
/** The starter room's finishes are free; the others are bought in the shop. */
export const FREE_FINISHES: readonly string[] = [WALLPAPERS[0], FLOORINGS[0]];
/** Entrance cells kept clear so the player can always get in. */
export const DOOR_CELLS: [number, number][] = [[2, 0], [3, 0]];

export function starterRoom(id = "room-1"): RoomDoc {
  return {
    id, wallpaper: "plaster00", flooring: "simpleparquet00",
    items: [
      { uid: "starter-bed", piece: "home-bed", cell: [0, 4], rot: 0 },
      { uid: "starter-lamp", piece: "floor-lamp", cell: [2, 5], rot: 0 },
      { uid: "starter-shelf", piece: "bookshelf", cell: [4, 5], rot: 0 },
      { uid: "starter-closet", piece: "closet", cell: [0, 2], rot: 0 },
      // The home storage chest (specs/game-ui.md §6): the starter pack's wooden chest, beside the bed.
      { uid: "starter-chest", piece: "wooden-chest", cell: [2, 4], rot: 0 },
    ],
  };
}
export function defaultLayout(): HomeLayoutDoc {
  return { version: 1, rooms: [starterRoom()], outdoor: [] };
}
/** A room bought later: empty, starter finishes. */
export const emptyRoom = (id: string): RoomDoc => ({ ...starterRoom(id), items: [] });
/** Pieces placed across every room and the island, by piece id (a save may place only what the member owns). */
export function placedCounts(doc: HomeLayoutDoc): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of [...doc.rooms.flatMap(r => r.items), ...doc.outdoor]) out.set(it.piece, (out.get(it.piece) ?? 0) + 1);
  return out;
}

/** World/pointer position → nearest cell index (floor). */
export function snapCell(x: number): number {
  return Math.floor(x);
}
export function rotate(rot: Rotation, by = 1): Rotation {
  return (((rot + by) % 4) + 4) % 4 as Rotation;
}
/** Footprint size after rotation (odd quarter turns swap width and depth). */
export function footprint(size: [number, number], rot: Rotation): [number, number] {
  return rot % 2 ? [size[1], size[0]] : [size[0], size[1]];
}
export function cellsOf(item: Pick<PlacedItem, "piece" | "cell" | "rot">): [number, number][] {
  const def = catalogueItem(item.piece);
  if (!def) return [];
  const [w, d] = footprint(def.size, item.rot);
  const out: [number, number][] = [];
  for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) out.push([item.cell[0] + dx, item.cell[1] + dz]);
  return out;
}
const layerOf = (mount: Mount | undefined) => (mount === "rug" ? "rug" : mount === "wall" ? "wall" : "floor");

export interface PlaceContext {
  /** Other items already placed (the moving item is excluded by uid). */
  items: readonly PlacedItem[];
  /** Is this cell inside the placeable area and free of fixed obstacles? */
  inside: (cx: number, cz: number) => boolean;
  /** Wall length in cells, per wall (rooms only). */
  wallLength?: (wall: Wall) => number;
}

/** Can `item` go here? Same layer may not overlap; floor items may sit on rugs. */
export function canPlace(item: PlacedItem, ctx: PlaceContext): boolean {
  const def = catalogueItem(item.piece);
  if (!def) return false;
  const others = ctx.items.filter(other => other.uid !== item.uid && layerOf(catalogueItem(other.piece)?.mount) === layerOf(def.mount));
  if (def.mount === "wall") {
    if (!item.wall || !ctx.wallLength) return false;
    const start = item.cell[0], end = start + def.size[0];
    if (start < 0 || end > ctx.wallLength(item.wall)) return false;
    return !others.some(other => {
      if (other.wall !== item.wall) return false;
      const width = catalogueItem(other.piece)!.size[0];
      return other.cell[0] < end && start < other.cell[0] + width;
    });
  }
  const cells = cellsOf(item);
  if (!cells.every(([x, z]) => ctx.inside(x, z))) return false;
  const taken = new Set(others.flatMap(cellsOf).map(([x, z]) => `${x},${z}`));
  return !cells.some(([x, z]) => taken.has(`${x},${z}`));
}

/** Room interior predicate: inside the grid and off the kept-clear entrance (rugs may cover it). */
export function roomInside(mount: Mount): (cx: number, cz: number) => boolean {
  return (cx, cz) => cx >= 0 && cz >= 0 && cx < ROOM_SIZE[0] && cz < ROOM_SIZE[1]
    && (mount === "rug" || !DOOR_CELLS.some(([x, z]) => x === cx && z === cz));
}
export const roomWallLength = (wall: Wall) => (wall === "n" ? ROOM_SIZE[0] : ROOM_SIZE[1]);

/**
 * Nearest wall to a floor point (room cells), for wall items: back (n) wall
 * unless the point is closer to a side wall. Returns the wall and the index along it.
 */
export function snapToWall(x: number, z: number, width: number): { wall: Wall; index: number } {
  const [w, d] = ROOM_SIZE;
  const toN = d - z, toW = x, toE = w - x;
  const wall: Wall = toN <= toW && toN <= toE ? "n" : toW < toE ? "w" : "e";
  const along = wall === "n" ? x : z;
  const length = roomWallLength(wall);
  return { wall, index: Math.max(0, Math.min(length - width, Math.floor(along - width / 2 + 0.5))) };
}

// ── Serialisation ────────────────────────────────────────────────────────

const ROT = new Set([0, 1, 2, 3]);
function parseItem(raw: unknown): PlacedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.uid !== "string" || typeof r.piece !== "string" || !catalogueItem(r.piece)) return null;
  if (!Array.isArray(r.cell) || r.cell.length !== 2 || !r.cell.every(n => Number.isInteger(n))) return null;
  if (!ROT.has(r.rot as number)) return null;
  const wall = r.wall === "n" || r.wall === "e" || r.wall === "w" ? r.wall : undefined;
  if (catalogueItem(r.piece)!.mount === "wall" && !wall) return null;
  return { uid: r.uid, piece: r.piece, cell: [r.cell[0] as number, r.cell[1] as number], rot: r.rot as Rotation, ...(wall ? { wall } : {}) };
}

/** Parse untrusted JSON into a layout; unknown pieces and malformed items are dropped. */
export function parseLayout(raw: unknown): HomeLayoutDoc {
  if (!raw || typeof raw !== "object" || (raw as { version?: unknown }).version !== 1) return defaultLayout();
  const doc = raw as { rooms?: unknown; outdoor?: unknown };
  const rooms = (Array.isArray(doc.rooms) ? doc.rooms : []).slice(0, MAX_ROOMS).flatMap((room): RoomDoc[] => {
    if (!room || typeof room !== "object") return [];
    const r = room as Record<string, unknown>;
    if (typeof r.id !== "string") return [];
    return [{
      id: r.id,
      wallpaper: (WALLPAPERS as readonly unknown[]).includes(r.wallpaper) ? r.wallpaper as string : WALLPAPERS[0],
      flooring: (FLOORINGS as readonly unknown[]).includes(r.flooring) ? r.flooring as string : FLOORINGS[0],
      items: (Array.isArray(r.items) ? r.items : []).map(parseItem).filter((i): i is PlacedItem => !!i),
    }];
  });
  return {
    version: 1,
    rooms: rooms.length ? rooms : [starterRoom()],
    outdoor: (Array.isArray(doc.outdoor) ? doc.outdoor : []).map(parseItem).filter((i): i is PlacedItem => !!i),
  };
}
export function serialiseLayout(doc: HomeLayoutDoc): string {
  return JSON.stringify(doc);
}

/** Add connected rooms up to `count` (room expansion stub / `?rooms=`). */
export function withRooms(doc: HomeLayoutDoc, count: number): HomeLayoutDoc {
  const target = Math.min(MAX_ROOMS, Math.max(1, Math.floor(count)));
  if (doc.rooms.length >= target) return doc;
  const rooms = [...doc.rooms];
  while (rooms.length < target) rooms.push(emptyRoom(`room-${rooms.length + 1}`));
  return { ...doc, rooms };
}
