import { describe, expect, it } from "vitest";
import { digScuff } from "./digMark";

const radius = (g: ReturnType<typeof digScuff>) => { g.computeBoundingSphere(); return g.boundingSphere!.radius; };
const flatFinite = (g: ReturnType<typeof digScuff>) => {
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) { expect(Number.isFinite(p.getX(i)) && Number.isFinite(p.getZ(i))).toBe(true); expect(p.getY(i)).toBe(0); }
  return p.count;
};

// David 2026-10-28: "way more subtle and small", "hard to find usually"; the sand's "similar to the dirt".
describe("a dig spot's mark", () => {
  it("is a small flat scuff with two crumbs, its own per seed", () => {
    for (const seed of [3, 10, 17]) {
      const g = digScuff(seed);
      expect(flatFinite(g)).toBe((9 + 5 + 5) * 3);
      expect(radius(g)).toBeLessThan(0.35);
    }
    expect(digScuff(3).getAttribute("position").array).not.toEqual(digScuff(10).getAttribute("position").array);
  });
});
