import { describe, expect, it } from "vitest";
import { fireflyOffset, fireflyOffsetInto } from "./fireflyPath";

/** The path as it was written first (closures and arrays): the allocation-free one must match it exactly. */
function original(seed: number, seconds: number): [number, number, number] {
  const random = (step: number, channel: number) => {
    const n = Math.sin(seed * 127.1 + step * 311.7 + channel * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const duration = 3.5 + random(0, 4) * 3;
  const time = seconds / duration + random(0, 5) * 10;
  const step = Math.floor(time), t = time - step;
  const blend = t * t * (3 - 2 * t);
  const point = (n: number): [number, number, number] => {
    const angle = random(n, 0) * Math.PI * 2, radius = Math.sqrt(random(n, 1)) * 1.4;
    return [Math.cos(angle) * radius, 0.3 + random(n, 2) * 0.8, Math.sin(angle) * radius];
  };
  const a = point(step), b = point(step + 1);
  return a.map((v, i) => v + (b[i] - v) * blend) as [number, number, number];
}

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
  it("writes the same path into a caller's array, nothing allocated (the auras' motes, every frame)", () => {
    const out: [number, number, number] = [0, 0, 0], f32 = new Float32Array(3);
    for (let seed = 1; seed <= 60; seed++) for (let time = 0; time < 200; time += 0.37) {
      expect(fireflyOffsetInto(seed, time, out)).toBe(out);
      expect(out).toEqual(original(seed, time));
      expect(fireflyOffset(seed, time)).toEqual(original(seed, time));
    }
    fireflyOffsetInto(41, 12.5, f32);
    expect(Array.from(f32)).toEqual(original(41, 12.5).map(Math.fround));
  });
});
