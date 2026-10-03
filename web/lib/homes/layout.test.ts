import { describe, expect, it } from "vitest";
import { CATALOGUE, catalogueItem } from "./catalogue";
import {
  DOOR_CELLS, MAX_ROOMS, ROOM_SIZE, canPlace, cellsOf, defaultLayout, footprint, parseLayout, roomInside,
  roomWallLength, rotate, serialiseLayout, snapCell, snapToWall, withRooms, type PlacedItem,
} from "./layout";

const room = (items: PlacedItem[], mount: "floor" | "rug" | "wall" = "floor") => ({ items, inside: roomInside(mount), wallLength: roomWallLength });

describe("catalogue", () => {
  it("has about 30 dump pieces with sane footprints and unique ids", () => {
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CATALOGUE.map(i => i.id)).size).toBe(CATALOGUE.length);
    for (const item of CATALOGUE) {
      expect(item.size[0], item.id).toBeGreaterThan(0);
      expect(item.url).toMatch(/^\/assets\/acnh\/.+\.glb$/);
    }
    expect(CATALOGUE.some(i => i.mount === "wall")).toBe(true);
    expect(CATALOGUE.some(i => i.where === "outdoor")).toBe(true);
  });
});

describe("snap and rotation", () => {
  it("snaps to whole cells and turns in quarter steps", () => {
    expect([0.2, 0.99, 1, 3.7, -0.2].map(snapCell)).toEqual([0, 0, 1, 3, -1]);
    expect(rotate(3)).toBe(0);
    expect(rotate(0, -1)).toBe(3);
  });
  it("swaps the footprint on odd rotations", () => {
    expect(footprint([2, 1], 0)).toEqual([2, 1]);
    expect(footprint([2, 1], 1)).toEqual([1, 2]);
    expect(footprint([2, 1], 2)).toEqual([2, 1]);
    expect(cellsOf({ piece: "home-bed", cell: [1, 1], rot: 1 })).toEqual([[1, 1], [1, 2]]);
  });
  it("hangs wall items on the nearest wall, clamped to its length", () => {
    expect(snapToWall(2.5, 5.6, 1)).toEqual({ wall: "n", index: 2 });
    expect(snapToWall(0.2, 2.5, 1)).toEqual({ wall: "w", index: 2 });
    expect(snapToWall(5.8, 1, 2)).toEqual({ wall: "e", index: 0 });
    expect(snapToWall(5.9, 5.9, 2).index).toBeLessThanOrEqual(ROOM_SIZE[0] - 2);
  });
});

describe("collision", () => {
  const bed: PlacedItem = { uid: "a", piece: "home-bed", cell: [0, 4], rot: 0 };
  it("keeps floor items inside the room, off each other and off the entrance", () => {
    expect(canPlace({ uid: "b", piece: "barrel", cell: [3, 3], rot: 0 }, room([bed]))).toBe(true);
    expect(canPlace({ uid: "b", piece: "barrel", cell: [1, 4], rot: 0 }, room([bed]))).toBe(false);
    expect(canPlace({ uid: "b", piece: "home-bed", cell: [5, 2], rot: 0 }, room([]))).toBe(false);
    expect(canPlace({ uid: "b", piece: "home-bed", cell: [5, 2], rot: 1 }, room([]))).toBe(true);
    expect(canPlace({ uid: "b", piece: "barrel", cell: DOOR_CELLS[0], rot: 0 }, room([]))).toBe(false);
    expect(canPlace({ ...bed }, room([bed]))).toBe(true); // moving an item ignores itself
  });
  it("lets floor items stand on rugs but not rugs on rugs", () => {
    const rug: PlacedItem = { uid: "r", piece: "lounge-rug", cell: [1, 1], rot: 0 };
    expect(canPlace({ uid: "t", piece: "lounge-table", cell: [1, 2], rot: 0 }, room([rug]))).toBe(true);
    expect(canPlace({ uid: "r2", piece: "yellow-message-mat", cell: [2, 2], rot: 0 }, room([rug], "rug"))).toBe(false);
  });
  it("keeps wall items on their wall without overlapping", () => {
    const frame: PlacedItem = { uid: "f", piece: "wall-frame", cell: [2, 0], rot: 0, wall: "n" };
    expect(canPlace({ uid: "c", piece: "wall-clock", cell: [2, 0], rot: 0, wall: "n" }, room([frame]))).toBe(false);
    expect(canPlace({ uid: "c", piece: "wall-clock", cell: [2, 0], rot: 0, wall: "w" }, room([frame]))).toBe(true);
    expect(canPlace({ uid: "d", piece: "wall-driedflower", cell: [5, 0], rot: 0, wall: "n" }, room([]))).toBe(false);
    expect(canPlace({ uid: "d", piece: "wall-clock", cell: [0, 0], rot: 0 }, room([]))).toBe(false); // no wall given
  });
  it("uses the same code outdoors with the island's own predicate", () => {
    const land = (x: number, z: number) => Math.hypot(x, z) < 4;
    const ctx = { items: [], inside: land };
    expect(canPlace({ uid: "o", piece: "bench-wood", cell: [0, 0], rot: 0 }, ctx)).toBe(true);
    expect(canPlace({ uid: "o", piece: "bench-wood", cell: [3, 3], rot: 0 }, ctx)).toBe(false);
  });
});

describe("layout document", () => {
  it("round-trips through JSON", () => {
    const doc = withRooms(defaultLayout(), 2);
    doc.outdoor.push({ uid: "o1", piece: "stone-lantern", cell: [-2, 3], rot: 1 });
    doc.rooms[0].items.push({ uid: "w1", piece: "wall-clock", cell: [1, 0], rot: 0, wall: "e" });
    expect(parseLayout(JSON.parse(serialiseLayout(doc)))).toEqual(doc);
  });
  it("drops malformed items, unknown pieces and bad textures instead of failing", () => {
    const doc = parseLayout({ version: 1, rooms: [{ id: "r", wallpaper: "neon", flooring: "tatami00", items: [
      { uid: "x", piece: "not-a-piece", cell: [0, 0], rot: 0 },
      { uid: "y", piece: "barrel", cell: [0.5, 0], rot: 0 },
      { uid: "z", piece: "barrel", cell: [0, 0], rot: 7 },
      { uid: "w", piece: "wall-clock", cell: [0, 0], rot: 0 },
      { uid: "ok", piece: "barrel", cell: [1, 1], rot: 3 },
    ] }], outdoor: "nope" });
    expect(doc.rooms[0].items.map(i => i.uid)).toEqual(["ok"]);
    expect(doc.rooms[0].wallpaper).toBe("plaster00");
    expect(doc.outdoor).toEqual([]);
    expect(parseLayout(null)).toEqual(defaultLayout());
    expect(parseLayout({ version: 2 })).toEqual(defaultLayout());
  });
  it("starts with the starter room (bed, lamp, shelf, closet, the storage chest) and caps room count", () => {
    const pieces = defaultLayout().rooms[0].items.map(i => i.piece).sort();
    expect(pieces).toEqual(["bookshelf", "closet", "floor-lamp", "home-bed", "wooden-chest"]);
    for (const item of defaultLayout().rooms[0].items) expect(canPlace(item, room(defaultLayout().rooms[0].items))).toBe(true);
    expect(withRooms(defaultLayout(), 9).rooms).toHaveLength(MAX_ROOMS);
    expect(catalogueItem("home-bed")?.mount).toBe("floor");
  });
});
