import { describe, expect, it } from "vitest";
import { FRUIT_MODEL, fruitTree, hangAt, nearestHang, type Point } from "./treeFruit";
import { Shakes } from "./treeShake";
import { TREE_HANG } from "./treeHang";
import { treeParts } from "./natureParts";
import { ROSTER } from "@/lib/collections/roster";

const p = (): Point => ({ x: 0, y: 0, z: 0 });

describe("fruit on the trees", () => {
  it("hangs in the tree's own frame: its spot, turn and size, inside the crown", () => {
    for (const seed of [0, 1, 2, 4, 5, 6]) {
      const tree = fruitTree({ x: 5, z: -3, seed }, 1.2)!;
      const [part] = treeParts(seed);
      expect(tree.yaw).toBe(part.yaw);
      expect(tree.scale).toBe(part.scale);
      tree.hang.forEach(([hx, hy, hz], i) => {
        const at = hangAt(tree, i, 0, 0, p());
        // Turned with the tree: the same distance from the trunk and height, scaled.
        expect(Math.hypot(at.x - 5, at.z + 3)).toBeCloseTo(Math.hypot(hx, hz) * tree.scale, 6);
        expect(at.y).toBeCloseTo(1.2 + hy * tree.scale, 6);
        // Up in the leaves, within the crown (about 1.6 across at scale 1), never out in front of it.
        expect(hy).toBeGreaterThan(1.2);
        expect(Math.hypot(hx, hz)).toBeLessThan(1.1);
      });
    }
  });

  it("follows the tree's turn: the same hang point lands where the yaw puts it", () => {
    const tree = fruitTree({ x: 0, z: 0, seed: 1 }, 0)!;
    const at = hangAt({ ...tree, yaw: Math.PI / 2, scale: 1 }, 0, 0, 0, p());
    const [hx, , hz] = tree.hang[0];
    // three's rotation.y: local x goes to world -z, local z to world x.
    expect(at.x).toBeCloseTo(hz, 6);
    expect(at.z).toBeCloseTo(-hx, 6);
  });

  it("has fruit all round every fruiting crown, and none on a cedar", () => {
    for (const [name, hang] of Object.entries(TREE_HANG)) {
      const sides = new Set(hang.map(([x, , z]) => Math.round((Math.atan2(x, z) / (Math.PI / 2)) + 4) % 4));
      expect(sides.size, name).toBeGreaterThanOrEqual(3);
    }
    expect(fruitTree({ x: 0, z: 0, seed: 3 }, 0)).toBeNull();
  });

  it("sways with the canopy: no wind, no move; in wind, at most the crown's own sway there", () => {
    const tree = fruitTree({ x: 2, z: 4, seed: 0 }, 0)!;
    const still = hangAt(tree, 0, 12.3, 0, p()), moved = hangAt(tree, 0, 12.3, 0.2, p());
    const h = Math.min(1, tree.hang[0][1] / 3) ** 2;
    expect(Math.hypot(moved.x - still.x, moved.z - still.z)).toBeLessThanOrEqual(0.2 * h * tree.scale * Math.SQRT2 + 1e-9);
    expect(moved.y).toBe(still.y);
  });

  it("wobbles with its tree's shake (the shader's own formula), and only that tree's", () => {
    const tree = fruitTree({ x: 2, z: 4, seed: 0 }, 0)!, shakes = new Shakes();
    const still = hangAt(tree, 0, 5.08, 0, p(), shakes);
    shakes.start(2, 4, 5, 0.13);
    const shaken = hangAt(tree, 0, 5.08, 0, p(), shakes);
    expect(Math.hypot(shaken.x - still.x, shaken.z - still.z)).toBeGreaterThan(0.01);
    expect(shaken.y).toBe(still.y);
    const other = fruitTree({ x: 8, z: 4, seed: 0 }, 0)!;
    expect(hangAt(other, 0, 5.08, 0, p(), shakes)).toEqual(hangAt(other, 0, 5.08, 0, p(), new Shakes()));
  });

  it("lets go of the fruit hanging nearest the shaker, so it falls on their side", () => {
    const tree = fruitTree({ x: 0, z: 0, seed: 0 }, 0)!;
    for (const [sx, sz] of [[0, -1.2], [1.2, 0], [0, 1.2], [-1.2, 0]]) {
      const k = nearestHang(tree, sx, sz, 0);
      const at = hangAt(tree, k, 0, 0, p(), new Shakes());
      for (let j = 0; j < tree.hang.length; j++) {
        const o = hangAt(tree, j, 0, 0, p(), new Shakes());
        expect(Math.hypot(at.x - sx, at.z - sz)).toBeLessThanOrEqual(Math.hypot(o.x - sx, o.z - sz) + 0.9);
      }
      expect(nearestHang(tree, sx, sz, 0, k)).not.toBe(k);
    }
  });

  it("has a model for every fruit a tree or the beach grows", () => {
    for (const s of ROSTER.filter(s => s.category === "fruit" && (s.biome === "trees" || s.biome === "beach"))) expect(FRUIT_MODEL[s.key], s.key).toBeTruthy();
  });
});
