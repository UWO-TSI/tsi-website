import { describe, expect, it } from "vitest";
import { LEVEL_STEP } from "../grid";
import { objectFootprint } from "../defaultIsland";
import type { MapObject } from "../villageMap";
import { applyBrush, cellHeight, cellSet, cellSquare, falloff, layRoad, nextLevel, padUnder, ROAD } from "./brushes";
import { DEFAULT_HOTBAR, PALETTE, hotbarFrom, idFor, placeItem, type EditorItem } from "./editorTools";
import { History } from "./history";
import { rayTerrain } from "./raycast";
import { Paint, createTerrain, paintAt, sampleX, sampleZ, terrainHeight, terrainSteepness, type WorldTerrain } from "./terrain";

/** A 64 × 64 test island: a hill in the middle, the sea round it. */
function island(): WorldTerrain {
  const t = createTerrain(64, 64, 0, 0);
  for (let k = 0; k < t.rows; k++) for (let i = 0; i < t.cols; i++) {
    const x = sampleX(t, i) - 31.5, z = sampleZ(t, k) - 31.5, r = Math.hypot(x, z);
    t.heights[k * t.cols + i] = 2.5 * Math.exp(-(r * r) / 200) - 0.5 + 0.2 * Math.sin(x * 0.7) * Math.cos(z * 0.5);
  }
  return t;
}
const copy = (t: WorldTerrain) => ({ ...t, heights: t.heights.slice(), paint: t.paint.slice() });

describe("brushes", () => {
  it("fall off softly, or hold flat to near the rim with a hard edge", () => {
    expect(falloff(0, 4)).toBe(1);
    expect(falloff(4, 4)).toBe(0);
    expect(falloff(2, 4)).toBeLessThan(0.6);
    expect(falloff(3, 4, true)).toBe(1);
    expect(falloff(3.9, 4, true)).toBeLessThan(0.2);
  });

  it("raise and lower most at the middle, nothing outside the radius", () => {
    const t = island(), before = t.heights.slice();
    const r = applyBrush(t, "raise", { x: 20, z: 20, radius: 4, strength: 1, dt: 0.1 })!;
    expect(terrainHeight(t, 20, 20)).toBeGreaterThan(terrainHeight({ ...t, heights: before }, 20, 20) + 0.2);
    expect(terrainHeight(t, 26, 20)).toBeCloseTo(terrainHeight({ ...t, heights: before }, 26, 20), 6);
    expect(r.x0).toBeLessThanOrEqual(16);
    applyBrush(t, "lower", { x: 20, z: 20, radius: 4, strength: 1, dt: 0.1 });
    expect(terrainHeight(t, 20, 20)).toBeCloseTo(terrainHeight({ ...t, heights: before }, 20, 20), 4);
  });

  it("smooth evens the ground out; roughen adds detail; erode softens a steep edge", () => {
    const rough = (t: WorldTerrain) => { let s = 0; for (let k = 50; k < 70; k++) for (let i = 50; i < 70; i++) { const p = k * t.cols + i; s += Math.abs(t.heights[p] - t.heights[p + 1]); } return s; };
    const u = island(), b = rough(u);
    for (let f = 0; f < 10; f++) applyBrush(u, "roughen", { x: 30, z: 30, radius: 8, strength: 1, dt: 0.1, seed: 3 });
    const a = rough(u);
    expect(a).toBeGreaterThan(b * 1.2);
    for (let f = 0; f < 10; f++) applyBrush(u, "smooth", { x: 30, z: 30, radius: 8, strength: 1, dt: 0.1 });
    expect(rough(u)).toBeLessThan(a * 0.8);
    // A cliff a sample wide: erosion lowers its steepest grade.
    const c = createTerrain(16, 16, 0, 0);
    for (let k = 0; k < c.rows; k++) for (let i = 0; i < c.cols; i++) c.heights[k * c.cols + i] = i > 16 ? 2 : 0;
    const steep0 = terrainSteepness(c, sampleX(c, 16) + 0.25, 7.5);
    for (let f = 0; f < 30; f++) applyBrush(c, "erode", { x: sampleX(c, 16), z: 7.5, radius: 3, strength: 1, dt: 0.1 });
    expect(terrainSteepness(c, sampleX(c, 16) + 0.25, 7.5)).toBeLessThan(steep0 * 0.7);
  });

  it("flatten and level pull to a height, cutting, filling or both: a quay bank in a few strokes", () => {
    const t = island();
    // Off the hill the ground is under the sea: fill it up to a bank at 0.
    expect(terrainHeight(t, 6, 6)).toBeLessThan(0);
    for (let f = 0; f < 30; f++) applyBrush(t, "level", { x: 6, z: 6, radius: 3, strength: 1, dt: 0.1, target: 0, mode: "fill", hard: true });
    expect(terrainHeight(t, 6, 6)).toBeCloseTo(0, 2);
    expect(terrainHeight(t, 7.5, 6)).toBeCloseTo(0, 1); // the hard edge holds flat to near the rim
    const u = island(), peak = terrainHeight(u, 31.5, 31.5);
    for (let f = 0; f < 30; f++) applyBrush(u, "flatten", { x: 31.5, z: 31.5, radius: 3, strength: 1, dt: 0.1, target: 1, mode: "fill" });
    expect(terrainHeight(u, 31.5, 31.5)).toBeCloseTo(peak, 6); // fill never cuts
  });

  it("paints the surface inside the brush", () => {
    const t = island();
    applyBrush(t, "paint", { x: 10, z: 10, radius: 2, strength: 1, dt: 0.1, paint: Paint.Path });
    expect(paintAt(t, 10, 10)).toBe(Paint.Path);
    expect(paintAt(t, 13, 10)).toBe(Paint.Grass);
  });
});

describe("cell mode", () => {
  it("raises a cell a whole step onto the level grid, its samples flat, a rounded lip outside", () => {
    const t = createTerrain(16, 16, 0, 0);
    const level = nextLevel(cellHeight(t, 5, 5), LEVEL_STEP, 1);
    expect(level).toBeCloseTo(LEVEL_STEP, 9);
    cellSet(t, cellSquare(t, 5, 5, 1), level, 1);
    for (const [x, z] of [[4.5, 4.5], [5, 5], [5.5, 5.5], [4.5, 5.5]]) expect(terrainHeight(t, x, z)).toBeCloseTo(LEVEL_STEP, 6);
    // Half a unit out: part of the step (a rounded lip); a unit out: the old ground.
    const lip = terrainHeight(t, 6, 5);
    expect(lip).toBeGreaterThan(0.1);
    expect(lip).toBeLessThan(LEVEL_STEP * 0.5);
    expect(terrainHeight(t, 6.6, 5)).toBe(0);
    // Again: a second step up.
    cellSet(t, cellSquare(t, 5, 5, 1), nextLevel(cellHeight(t, 5, 5), LEVEL_STEP, 1), 1);
    expect(terrainHeight(t, 5, 5)).toBeCloseTo(2 * LEVEL_STEP, 6);
  });

  it("merges neighbouring squares at one level flat, and digs down a step", () => {
    const t = createTerrain(16, 16, 0, 0);
    for (let cx = 3; cx <= 7; cx++) cellSet(t, cellSquare(t, cx, 4, 1), LEVEL_STEP, 1);
    for (let x = 3; x <= 7; x += 0.25) expect(terrainHeight(t, x, 4)).toBeCloseTo(LEVEL_STEP, 6);
    const sq = cellSquare(t, 10, 10, 3);
    expect([sq.cx0, sq.cx1, sq.cz0, sq.cz1]).toEqual([9, 11, 9, 11]);
    cellSet(t, sq, -LEVEL_STEP, -1);
    expect(terrainHeight(t, 10, 10)).toBeCloseTo(-LEVEL_STEP, 6);
    expect(nextLevel(0.3, 0.75, 1)).toBeCloseTo(0.75, 9);
    expect(nextLevel(0.75, 0.75, -1)).toBeCloseTo(0, 9);
  });
});

describe("pads and roads", () => {
  it("a building's pad is flat under its footprint and eases back", () => {
    const t = island();
    const house: MapObject = { id: "house-0", kind: "house", x: 34, z: 30, yaw: 0.4, model: "chalet-red" }, f = objectFootprint(house)!;
    padUnder(t, house.x, house.z, f.hw, f.hd, house.yaw);
    const base = terrainHeight(t, house.x, house.z);
    for (const [a, b] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) {
      const lx = a * f.hw, lz = b * f.hd, c = Math.cos(0.4), s = Math.sin(0.4);
      expect(terrainHeight(t, house.x + lx * c + lz * s, house.z - lx * s + lz * c)).toBeCloseTo(base, 3);
    }
  });

  it("a road is painted at its width and graded smoothly: no steps, never steeper than its grade, level across", () => {
    const t = island();
    // Straight over the hill.
    layRoad(t, [[8, 31.5], [56, 31.5]]);
    let worst = 0;
    for (let x = 9; x < 55; x += 0.25) {
      const g = Math.abs(terrainHeight(t, x + 0.25, 31.5) - terrainHeight(t, x, 31.5)) / 0.25;
      worst = Math.max(worst, g);
      expect(Math.abs(terrainHeight(t, x, 31.5 + ROAD.width / 2 - 0.3) - terrainHeight(t, x, 31.5))).toBeLessThan(0.05);
    }
    expect(worst).toBeLessThanOrEqual(ROAD.maxGrade + 0.02);
    expect(paintAt(t, 30, 31.5)).toBe(Paint.Path);
    expect(paintAt(t, 30, 31.5 + ROAD.width / 2 + 0.6)).toBe(Paint.Grass);
  });
});

describe("history", () => {
  it("undoes and redoes a stroke exactly: terrain tiles and objects", () => {
    const t = island(), h = new History(), before = copy(t);
    let objects: MapObject[] = [{ id: "tree-0", kind: "tree", x: 1, z: 1, seed: 0 }];
    h.begin("raise");
    for (let f = 0; f < 5; f++) {
      const b = { x: 30, z: 30, radius: 6, strength: 1, dt: 0.1 };
      h.touch(t, { x0: b.x - b.radius, z0: b.z - b.radius, x1: b.x + b.radius, z1: b.z + b.radius });
      applyBrush(t, "raise", b);
    }
    h.objects(objects);
    objects = [...objects, { id: "tree-1", kind: "tree", x: 2, z: 2, seed: 1 }];
    h.end();
    const after = copy(t), afterObjects = objects;
    const u = h.undo(t, objects)!;
    objects = u.objects!;
    expect(Array.from(t.heights)).toEqual(Array.from(before.heights));
    expect(objects).toHaveLength(1);
    const r = h.redo(t, objects)!;
    expect(Array.from(t.heights)).toEqual(Array.from(after.heights));
    expect(r.objects).toEqual(afterObjects);
    expect(h.canRedo).toBe(false);
  });
});

describe("the crosshair", () => {
  it("lands on the ground the camera looks at", () => {
    const t = island();
    const hit = rayTerrain(t, 31.5, 20, 0, 0, -1, 1)!;
    expect(hit).not.toBeNull();
    expect(Math.abs(hit.y - terrainHeight(t, hit.x, hit.z))).toBeLessThan(0.01);
    // Straight down onto the peak.
    const down = rayTerrain(t, 31.5, 10, 31.5, 0, -1, 0)!;
    expect(down.y).toBeCloseTo(terrainHeight(t, 31.5, 31.5), 2);
    // Over the sea, `water` stops at the surface.
    const sea = rayTerrain(t, 2, 5, 2, 0, -1, 0, 100, true)!;
    expect(sea.water).toBe(true);
    expect(sea.y).toBeCloseTo(t.seaLevel, 6);
    expect(rayTerrain(t, 31.5, 20, 0, 0, 1, 0)).toBeNull();
  });
});

describe("the hotbar and palette", () => {
  it("has nine slots and every tool David asked for", () => {
    expect(DEFAULT_HOTBAR).toHaveLength(9);
    const all = PALETTE.flatMap(g => g.items);
    for (const tool of ["raise", "lower", "smooth", "flatten", "level", "roughen", "erode"]) expect(all.some(i => i.type === "brush" && i.tool === tool), tool).toBe(true);
    for (const id of ["hq", "shop", "cafe", "museum", "oracle"]) expect(all.some(i => i.type === "place" && i.building && i.object.id === id), id).toBe(true);
    expect(all.filter(i => i.type === "place" && i.object.kind === "house")).toHaveLength(3);
    expect(all.some(i => i.type === "road")).toBe(true);
    expect(all.some(i => i.type === "select")).toBe(true);
    expect(new Set(all.map(i => i.label)).size).toBe(all.length); // labels identify slots in storage
  });

  it("keeps a saved hotbar by label, falling back slot by slot", () => {
    const saved = DEFAULT_HOTBAR.map(i => i.label);
    saved[2] = "House (yellow)";
    saved[4] = "nonsense";
    const bar = hotbarFrom(saved);
    expect(bar[2].label).toBe("House (yellow)");
    expect(bar[4]).toBe(DEFAULT_HOTBAR[4]);
  });

  it("places objects with fresh ids, and moves a landmark that is already on the map", () => {
    const tree = PALETTE.flatMap(g => g.items).find(i => i.label === "Tree: Cedar") as Extract<EditorItem, { type: "place" }>;
    const hq = PALETTE.flatMap(g => g.items).find(i => i.type === "place" && i.object.id === "hq") as Extract<EditorItem, { type: "place" }>;
    let objects: MapObject[] = [{ id: "tree-0", kind: "tree", x: 0, z: 0 }, { id: "hq", kind: "landmark", x: 1, z: 1, scale: 1.15 }];
    expect(idFor(tree, objects)).toBe("tree-1");
    objects = placeItem(tree, objects, 5, 6, 0, 0.5);
    expect(objects[2]).toMatchObject({ id: "tree-1", kind: "tree", x: 5, z: 6 });
    expect((objects[2].seed ?? 0) % 4).toBe(3);
    objects = placeItem(hq, objects, 9, 9, Math.PI / 2);
    expect(objects).toHaveLength(3);
    expect(objects[1]).toMatchObject({ id: "hq", x: 9, z: 9, scale: 1.15 });
  });
});
