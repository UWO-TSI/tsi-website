import { describe, expect, it } from "vitest";
import { crackStar } from "./digMark";

describe("a dig spot's mark", () => {
  it("is a flat star of five arms, finite and about a metre across", () => {
    const g = crackStar(3), p = g.getAttribute("position");
    expect(p.count).toBe(5 * 9);
    for (let i = 0; i < p.count; i++) { expect(Number.isFinite(p.getX(i)) && Number.isFinite(p.getZ(i))).toBe(true); expect(p.getY(i)).toBe(0); }
    g.computeBoundingSphere();
    expect(g.boundingSphere!.radius).toBeGreaterThan(0.3);
    expect(g.boundingSphere!.radius).toBeLessThan(0.7);
  });
});
