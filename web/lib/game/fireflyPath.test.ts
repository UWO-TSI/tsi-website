import { describe, expect, it } from "vitest";
import { fireflyOffset } from "./fireflyPath";

describe("firefly wandering", () => {
  it("stays low and close to its bush, with continuous paths", () => {
    let radius = 0, low = Infinity, high = -Infinity, step = 0;
    for (let seed = 1; seed <= 22; seed++) for (let time = 0; time < 90; time += 0.05) {
      const p = fireflyOffset(seed, time), next = fireflyOffset(seed, time + 0.016);
      radius = Math.max(radius, Math.hypot(p[0], p[2]));
      low = Math.min(low, p[1]); high = Math.max(high, p[1]);
      step = Math.max(step, Math.hypot(...p.map((n, i) => n - next[i])));
    }
    expect(radius).toBeLessThanOrEqual(1.4);
    expect(low).toBeGreaterThanOrEqual(0.3);
    expect(high).toBeLessThanOrEqual(1.1);
    expect(step).toBeLessThan(0.04);
  });
  it("gives different insects independent paths instead of a repeating orbit", () => {
    expect(fireflyOffset(1, 5)).not.toEqual(fireflyOffset(2, 5));
    expect(fireflyOffset(1, 0)).not.toEqual(fireflyOffset(1, 60));
    expect(fireflyOffset(1, 5)).toEqual(fireflyOffset(1, 5));
  });
});
