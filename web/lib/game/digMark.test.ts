import { describe, expect, it } from "vitest";
import { crackStar, soilScuff } from "./digMark";

const radius = (g: ReturnType<typeof crackStar>) => { g.computeBoundingSphere(); return g.boundingSphere!.radius; };
const flatFinite = (g: ReturnType<typeof crackStar>) => {
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) { expect(Number.isFinite(p.getX(i)) && Number.isFinite(p.getZ(i))).toBe(true); expect(p.getY(i)).toBe(0); }
  return p.count;
};

// David 2026-10-28: "way more subtle and small", "hard to find usually".
describe("a dig spot's mark", () => {
  it("on sand is a flat star of five thin arms, about a hand across", () => {
    const g = crackStar(3);
    expect(flatFinite(g)).toBe(5 * 9);
    expect(radius(g)).toBeGreaterThan(0.1);
    expect(radius(g)).toBeLessThan(0.25);
  });
  it("on dirt is a small flat scuff with crumbs, no bigger than the star", () => {
    for (const seed of [3, 10, 17]) {
      const g = soilScuff(seed);
      expect(flatFinite(g)).toBe((9 + 5 + 5) * 3);
      expect(radius(g)).toBeLessThan(0.35);
    }
  });
});
