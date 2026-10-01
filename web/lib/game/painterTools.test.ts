import { describe, expect, it } from "vitest";
import { SLOPE_RUN, cellsInPolygon, cliffDab, nextObjectId, organicCell, slopeDab, snapPlacement, snapshotCells, softDab, waterDistance, type OrganicOp } from "./painterTools";
import { CLIFF_LEVELS, createCenteredMap, levelAt, setCell, surfaceAt, Surface, isRiver, valueNoise, type IslandMap } from "./grid";
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

/** A sea map with a disc of grass (radius r cells) in the middle. */
function islet(size = 41, r = 8): IslandMap {
  const map = createCenteredMap(size, size), c = (size - 1) / 2;
  map.surfaces.fill(Surface.River);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) if (Math.hypot(x - c, z - c) <= r) setCell(map, x, z, 0, Surface.Grass);
  return map;
}
/** How round the land is: its widest reach along the diagonals over its widest along the axes (a disc ~1, a diamond 0.71, a square 1.41). */
function roundness(map: IslandMap): number {
  const c = (map.width - 1) / 2;
  let axis = 0, diagonal = 0;
  for (let z = 0; z < map.depth; z++) for (let x = 0; x < map.width; x++) {
    if (isRiver(surfaceAt(map, x, z))) continue;
    axis = Math.max(axis, Math.abs(x - c), Math.abs(z - c));
    diagonal = Math.max(diagonal, Math.abs(x - c + z - c) / Math.SQRT2, Math.abs(x - z) / Math.SQRT2);
  }
  return diagonal / axis;
}

describe("organic brushes (one step per stroke)", () => {
  it("grow and shrink move a straight coast one cell per stroke", () => {
    const map = createCenteredMap(30, 30);
    for (let z = 0; z < 30; z++) for (let x = 0; x < 30; x++) setCell(map, x, z, 0, x < 15 ? Surface.Sand : Surface.River);
    stroke(map, "grow");
    for (let z = 4; z < 26; z++) expect([surfaceAt(map, 15, z), surfaceAt(map, 16, z)], `${z}`).toEqual([Surface.Sand, Surface.River]);
    stroke(map, "shrink");
    stroke(map, "shrink");
    for (let z = 4; z < 26; z++) expect([surfaceAt(map, 13, z), surfaceAt(map, 14, z)], `${z}`).toEqual([Surface.Sand, Surface.River]);
  });
  it("grows round, not into a diamond, even from a single cell", () => {
    const map = islet(41, 0);
    for (let n = 0; n < 8; n++) stroke(map, "grow", n + 1);
    // A 4-neighbour dilation (the old grow) makes a diamond, 0.71.
    expect(landCount(map)).toBeGreaterThan(80);
    expect(roundness(map)).toBeGreaterThan(0.85);
    expect(roundness(map)).toBeLessThan(1.15);
  });
  it("shrinks round and a lone islet goes", () => {
    const map = islet(41, 12), was = landCount(map);
    for (let n = 0; n < 5; n++) stroke(map, "shrink", n + 1);
    expect(landCount(map)).toBeLessThan(was * 0.75);
    expect(roundness(map)).toBeGreaterThan(0.85);
    expect(roundness(map)).toBeLessThan(1.15);
    const lone = islet(9, 0);
    stroke(lone, "shrink");
    expect(landCount(lone)).toBe(0);
  });
  it("grow widens a plateau round and shrink brings it back to the ground", () => {
    const map = islet(41, 14);
    for (let z = 0; z < 41; z++) for (let x = 0; x < 41; x++) if (Math.hypot(x - 20, z - 20) <= 3) setCell(map, x, z, 2, Surface.Grass);
    stroke(map, "grow");
    expect(levelAt(map, 24, 20)).toBe(2);
    expect(levelAt(map, 26, 20)).toBe(0);
    for (let n = 0; n < 6; n++) stroke(map, "shrink");
    expect([surfaceAt(map, 20, 20), levelAt(map, 20, 20)]).toEqual([Surface.Grass, 0]);
  });
  it("smooth fills a notch and removes a stray cell, and leaves a 45-degree coast alone", () => {
    const map = square();
    setCell(map, 4, 3, 0, Surface.River); // notch in the top edge
    setCell(map, 0, 0, 0, Surface.Grass); // stray land in the sea
    stroke(map, "smooth");
    expect(surfaceAt(map, 4, 3)).toBe(Surface.Grass);
    expect(surfaceAt(map, 0, 0)).toBe(Surface.River);
    const diag = createCenteredMap(30, 30);
    for (let z = 0; z < 30; z++) for (let x = 0; x < 30; x++) setCell(diag, x, z, 0, x + z < 30 ? Surface.Grass : Surface.River);
    const was = [...diag.surfaces];
    stroke(diag, "smooth");
    // Away from the map's edge (off the map reads as sea).
    for (let z = 4; z < 26; z++) for (let x = 4; x < 26; x++) expect(diag.surfaces[z * 30 + x], `${x},${z}`).toBe(was[z * 30 + x]);
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

describe("height brushes", () => {
  it("Slope raises a round hill of one-level steps, never a cliff, down to the sea at the coast", () => {
    const map = islet(41, 16), before = snapshotCells(map), touched = new Uint8Array(41 * 41), water = waterDistance(map, before);
    // Three strokes on one spot: each lifts the brush a level and the ground follows at SLOPE_RUN.
    for (let n = 0; n < 3; n++) {
      const snap = snapshotCells(map);
      slopeDab(map, snap, 20, 20, 2, 1, new Uint8Array(41 * 41), water);
    }
    void before; void touched;
    expect(levelAt(map, 20, 20)).toBe(3);
    for (let z = 0; z < 41; z++) for (let x = 0; x < 41; x++) {
      for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        if (x + dx >= 41 || z + dz < 0 || z + dz >= 41) continue;
        expect(Math.abs(levelAt(map, x, z) - levelAt(map, x + dx, z + dz)), `${x},${z}`).toBeLessThan(CLIFF_LEVELS);
      }
      if (isRiver(surfaceAt(map, x, z))) continue;
      const coastal = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isRiver(surfaceAt(map, x + dx, z + dz)));
      if (coastal) expect(levelAt(map, x, z), `${x},${z}`).toBe(0);
    }
    // It spreads at a level per SLOPE_RUN cells: round, as far along a diagonal as along an axis.
    const along = (dx: number, dz: number) => { let n = 0; while (levelAt(map, 20 + dx * (n + 1), 20 + dz * (n + 1)) > 0) n++; return n * Math.hypot(dx, dz); };
    expect(along(1, 0)).toBeGreaterThanOrEqual(2 + 2 * SLOPE_RUN - 1);
    expect(Math.abs(along(1, 1) - along(1, 0))).toBeLessThanOrEqual(1.5);
  });
  it("Cliff stands the brush one kit cliff above where the stroke began, and lowers it again", () => {
    const map = islet(41, 16);
    cliffDab(map, snapshotCells(map), 20, 20, 3, 0, 1);
    expect(levelAt(map, 20, 20)).toBe(CLIFF_LEVELS);
    expect(levelAt(map, 20, 25)).toBe(0);
    cliffDab(map, snapshotCells(map), 20, 20, 1, CLIFF_LEVELS, -1);
    expect(levelAt(map, 20, 20)).toBe(0);
    expect(levelAt(map, 23, 20)).toBe(CLIFF_LEVELS);
  });
  it("soft land melts into a nearby coast; an isolated dab is a round islet", () => {
    const map = createCenteredMap(40, 40);
    for (let z = 0; z < 40; z++) for (let x = 0; x < 40; x++) setCell(map, x, z, 0, x < 10 ? Surface.Grass : Surface.River);
    softDab(map, snapshotCells(map), 14, 20, 3, true, new Uint8Array(1600));
    // The gap between the dab and the coast fills.
    expect(surfaceAt(map, 10, 20)).toBe(Surface.Grass);
    softDab(map, snapshotCells(map), 30, 20, 3, true, new Uint8Array(1600));
    expect(surfaceAt(map, 30, 20)).toBe(Surface.Grass);
    expect(surfaceAt(map, 30, 24)).toBe(Surface.River);
    expect(surfaceAt(map, 26, 20)).toBe(Surface.River);
    softDab(map, snapshotCells(map), 30, 20, 4, false, new Uint8Array(1600));
    expect(surfaceAt(map, 30, 20)).toBe(Surface.River);
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
