import { describe, expect, it } from "vitest";
import { easeFacing } from "./locomotion";

describe("interior facing", () => {
  it("turns across the angle seam without spinning through the opposite direction", () => {
    const next = easeFacing(Math.PI - 0.05, -Math.PI + 0.05, 10, 0.1);
    expect(next).toBeGreaterThan(Math.PI - 0.05);
    expect(next).toBeLessThan(Math.PI + 0.05);
    expect(easeFacing(0, 1, 10, 0)).toBe(0);
  });
});
