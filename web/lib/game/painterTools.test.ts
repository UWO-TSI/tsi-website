import { describe, expect, it } from "vitest";
import { cellsInPolygon, nextObjectId, organicCell, snapPlacement, snapshotCells, type OrganicOp } from "./painterTools";
import { createCenteredMap, levelAt, setCell, surfaceAt, Surface, isRiver, valueNoise, type IslandMap } from "./grid";
import { LANDMARK_INFO } from "./defaultIsland";

/** 9×9 sea with a 3×3 grass square in the middle (cells 3..5). */
function square(): IslandMap {
  const map = createCenteredMap(9, 9);
  map.surfaces.fill(Surface.River);
  for (let z = 3; z <= 5; z++) for (let x = 3; x <= 5; x++) setCell(map, x, z, 0, Surface.Grass);
  return map;
}
const landCount = (map: IslandMap) => [...map.surfaces].filter(s => !isRiver(s)).length;
const stroke = (map: IslandMap, op: OrganicOp, seed = 1) => {
  const before = snapshotCells(map);
  for (let z = 0; z < map.depth; z++) for (let x = 0; x < map.width; x++) organicCell(op, map, before, x, z, seed);
};

describe("organic brushes (one step per stroke)", () => {
  it("grow spreads land one cell, shrink pulls it back", () => {
    const map = square();
    stroke(map, "grow");
    expect(landCount(map)).toBe(9 + 12);
    expect(surfaceAt(map, 2, 4)).toBe(Surface.Grass);
    stroke(map, "shrink");
    expect(landCount(map)).toBe(9);
  });
  it("grow widens a plateau and keeps the sea level for new water", () => {
    const map = square();
    setCell(map, 4, 4, 2, Surface.Grass);
    stroke(map, "grow");
    expect(levelAt(map, 3, 4)).toBe(2);
    expect(levelAt(map, 3, 3)).toBe(0);
    stroke(map, "shrink");
    stroke(map, "shrink");
    expect([surfaceAt(map, 4, 4), levelAt(map, 4, 4)]).toEqual([Surface.Grass, 0]);
    stroke(map, "shrink");
    expect([surfaceAt(map, 4, 4), levelAt(map, 4, 4)]).toEqual([Surface.River, 0]);
  });
  it("smooth fills a notch and removes a stray cell", () => {
    const map = square();
    setCell(map, 4, 3, 0, Surface.River); // notch in the top edge
    setCell(map, 0, 0, 0, Surface.Grass); // stray land in the sea
    stroke(map, "smooth");
    expect(surfaceAt(map, 4, 3)).toBe(Surface.Grass);
    expect(surfaceAt(map, 0, 0)).toBe(Surface.River);
  });
  it("jitter only touches the coastline and is seeded", () => {
    const a = createCenteredMap(40, 40), b = createCenteredMap(40, 40);
    for (const m of [a, b]) { m.surfaces.fill(Surface.River); for (let z = 0; z < 40; z++) for (let x = 0; x < 20; x++) setCell(m, x, z, 0, Surface.Grass); }
    stroke(a, "jitter", 3); stroke(b, "jitter", 3);
    expect([...a.surfaces]).toEqual([...b.surfaces]);
    let changed = 0;
    for (let z = 0; z < 40; z++) for (let x = 0; x < 40; x++) {
      const was = x < 20, now = !isRiver(surfaceAt(a, x, z));
      if (was !== now) { changed++; expect(x === 19 || x === 20, `${x},${z}`).toBe(true); }
    }
    expect(changed).toBeGreaterThan(5);
    expect(valueNoise(1.3, 2.7, 3)).toBe(valueNoise(1.3, 2.7, 3));
  });
});

describe("lasso", () => {
  it("fills the cells whose centres are inside", () => {
    const cells = cellsInPolygon([[0.5, 0.5], [4.5, 0.5], [4.5, 3.5], [0.5, 3.5]], 10, 10);
    expect(cells).toHaveLength(12);
    expect(cellsInPolygon([[0, 0], [1, 1]], 10, 10)).toEqual([]);
  });
});

describe("objects", () => {
  it("numbers new ids from the first free slot", () => {
    expect(nextObjectId("tree", [{ id: "tree-0", kind: "tree", x: 0, z: 0 }, { id: "tree-2", kind: "tree", x: 0, z: 0 }])).toBe("tree-1");
    expect(nextObjectId("rock", [{ id: "tree-0", kind: "tree", x: 0, z: 0 }])).toBe("rock-0");
  });
  it("puts a building's footprint on whole cells and snaps the rest to the step", () => {
    const [x, z] = snapPlacement(10.3, -6.4, 0.5, LANDMARK_INFO.shop.half);
    const [hw, hd] = LANDMARK_INFO.shop.half!;
    expect(Math.abs((x - hw - 0.5) % 1)).toBeCloseTo(0);
    expect(Math.abs((z - hd - 0.5) % 1)).toBeCloseTo(0);
    expect(snapPlacement(1.26, -3.74, 0.5)).toEqual([1.5, -3.5]);
    expect(snapPlacement(1.26, -3.74, 0)).toEqual([1.26, -3.74]);
  });
});
