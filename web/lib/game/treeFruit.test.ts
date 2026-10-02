import { describe, expect, it } from "vitest";
import { DROP_TIME, FRUIT_MODEL, dropAt, fruitTree, hangAt, type Point } from "./treeFruit";
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

  it("drops from where it hangs to the ground, hops once, rests and shrinks away", () => {
    const from = { x: 1, y: 3, z: 2 }, out = p();
    expect(dropAt(from, 0.5, 0.14, 0, out)).toBe(1);
    expect(out).toEqual({ x: 1, y: 3, z: 2 });
    let lowest = Infinity;
    for (let t = 0; t < DROP_TIME; t += 0.02) { dropAt(from, 0.5, 0.14, t, out); lowest = Math.min(lowest, out.y); expect(out.x).toBe(1); }
    expect(lowest).toBeCloseTo(0.64, 6);
    expect(dropAt(from, 0.5, 0.14, 1.2, out)).toBe(1);
    expect(dropAt(from, 0.5, 0.14, DROP_TIME, out)).toBe(0);
  });

  it("has a model for every fruit a tree or the beach grows", () => {
    for (const s of ROSTER.filter(s => s.category === "fruit" && (s.biome === "trees" || s.biome === "beach"))) expect(FRUIT_MODEL[s.key], s.key).toBeTruthy();
  });
});
