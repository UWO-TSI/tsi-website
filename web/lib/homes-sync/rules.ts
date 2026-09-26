/**
 * Server rules for home persistence (20260926150300_homes.sql). The layout document and
 * placement rules are the island agent's (lib/homes/layout.ts); this module
 * only decides what the server accepts.
 */
import { catalogueItem } from "@/lib/homes/catalogue";
import {
  canPlace, FLOORINGS, MAX_ROOMS, parseLayout, ROOM_PRICE, roomInside, roomWallLength, starterRoom, WALLPAPERS,
  type HomeLayoutDoc, type PlacedItem, type RoomDoc,
} from "@/lib/homes/layout";

/** Server-authoritative room price (coins). Materials are not enforced yet. */
export const ROOM_PRICE_COINS = ROOM_PRICE.coins;
export const ROOM_CAP = MAX_ROOMS;
export const MAX_ITEMS_PER_ROOM = 80;
export const MAX_OUTDOOR_ITEMS = 200;
/** Home island map is 32×32 cells centred on the origin (lib/game/homeIsland.ts). */
export const OUTDOOR_HALF = 16;
export const MAX_LAYOUT_BYTES = 64 * 1024;

/** A room bought later starts empty (same look as withRooms() in lib/homes). */
export function boughtRoom(index: number): RoomDoc {
  return { ...starterRoom(`room-${index + 1}`), items: [], wallpaper: "stripe02", flooring: "tatami00" };
}

/** Rebuild a document from stored rows; missing rows fall back to starter/blank rooms. */
export function assembleLayout(roomsCount: number, rows: { room_index: number; room_id: string; wallpaper: string; flooring: string; items: unknown }[], outdoor: unknown): HomeLayoutDoc {
  const byIndex = new Map(rows.map((r) => [r.room_index, r]));
  const rooms = Array.from({ length: Math.max(1, Math.min(ROOM_CAP, roomsCount)) }, (_, i) => {
    const r = byIndex.get(i);
    return r ? { id: r.room_id, wallpaper: r.wallpaper, flooring: r.flooring, items: r.items } : i === 0 ? starterRoom() : boughtRoom(i);
  });
  return parseLayout({ version: 1, rooms, outdoor });
}

export type LayoutCheck = { ok: true; doc: HomeLayoutDoc } | { ok: false; error: string };

function noOverlaps(items: PlacedItem[], inside: (mount: "floor" | "rug" | "wall") => (x: number, z: number) => boolean, walls: boolean): string | null {
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (seen.has(item.uid)) return `duplicate item id ${item.uid}`;
    seen.add(item.uid);
    const mount = catalogueItem(item.piece)!.mount;
    if (mount === "wall" && !walls) return `${item.piece} can't go outdoors`;
    const ok = canPlace(item, { items: items.slice(0, i), inside: inside(mount), wallLength: walls ? roomWallLength : undefined });
    if (!ok) return `${item.piece} at ${item.cell.join(",")} doesn't fit`;
  }
  return null;
}

/**
 * Strict validation: the document must survive parseLayout unchanged (no
 * unknown pieces, bad rotations or finishes), match the rooms the member
 * owns, and every placement must be legal under the island agent's rules.
 */
export function validateLayout(raw: unknown, roomsCount: number): LayoutCheck {
  let size = 0;
  try {
    size = JSON.stringify(raw).length;
  } catch {
    return { ok: false, error: "Layout isn't valid JSON." };
  }
  if (size > MAX_LAYOUT_BYTES) return { ok: false, error: "Layout is too large." };
  const r = raw as { version?: unknown; rooms?: unknown[]; outdoor?: unknown[] } | null;
  if (!r || r.version !== 1 || !Array.isArray(r.rooms) || !Array.isArray(r.outdoor)) return { ok: false, error: "Not a v1 home layout." };
  if (r.rooms.length !== roomsCount) return { ok: false, error: `You have ${roomsCount} room${roomsCount === 1 ? "" : "s"}; the layout has ${r.rooms.length}.` };
  const doc = parseLayout(raw);
  const rawItems = r.rooms.reduce<number>((n, room) => n + (Array.isArray((room as { items?: unknown[] })?.items) ? (room as { items: unknown[] }).items.length : -1), 0);
  const parsedItems = doc.rooms.reduce((n, room) => n + room.items.length, 0);
  if (doc.rooms.length !== roomsCount || rawItems !== parsedItems || doc.outdoor.length !== r.outdoor.length) return { ok: false, error: "Layout has unknown or malformed pieces." };
  for (let i = 0; i < doc.rooms.length; i++) {
    const room = r.rooms[i] as { wallpaper?: unknown; flooring?: unknown };
    if (!(WALLPAPERS as readonly unknown[]).includes(room.wallpaper) || !(FLOORINGS as readonly unknown[]).includes(room.flooring)) return { ok: false, error: "Unknown wallpaper or flooring." };
  }
  if (new Set(doc.rooms.map((x) => x.id)).size !== doc.rooms.length) return { ok: false, error: "Duplicate room ids." };
  for (const room of doc.rooms) {
    if (room.items.length > MAX_ITEMS_PER_ROOM) return { ok: false, error: "Too many items in one room." };
    if (room.items.some((it) => catalogueItem(it.piece)!.where === "outdoor")) return { ok: false, error: "Outdoor pieces can't go inside." };
    const problem = noOverlaps(room.items, roomInside, true);
    if (problem) return { ok: false, error: problem };
  }
  if (doc.outdoor.length > MAX_OUTDOOR_ITEMS) return { ok: false, error: "Too many outdoor items." };
  if (doc.outdoor.some((it) => catalogueItem(it.piece)!.where === "indoor")) return { ok: false, error: "Indoor pieces can't go outside." };
  const outside = () => (x: number, z: number) => x >= -OUTDOOR_HALF && z >= -OUTDOOR_HALF && x < OUTDOOR_HALF && z < OUTDOOR_HALF;
  const problem = noOverlaps(doc.outdoor, outside, false);
  if (problem) return { ok: false, error: problem };
  return { ok: true, doc };
}
