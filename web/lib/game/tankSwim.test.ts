import { describe, expect, it } from "vitest";
import { TANK, tankLength, tankSwim, type SwimPose } from "./tankSwim";

const pose = (): SwimPose => ({ x: 0, y: 0, z: 0, yaw: 0, wag: 0 });

describe("fish swim in the museum tanks (interiors deliverable 4)", () => {
  it("keeps every fish inside the tank's water, near the glass, its nose, tail and flanks inside too", () => {
    // The biggest fish; its body about a quarter as wide as it is long, a few cm off the glass all round.
    const len = tankLength([60, 120]), half = len / 2, flank = len * 0.14, glass = 0.03;
    for (const seed of [1, 2, 77, 1234]) {
      for (const speed of [0.1, 0.25, 0.45]) {
        for (let t = 0; t < 60; t += 0.13) {
          const p = tankSwim(t, seed, speed, false, pose()), sx = Math.sin(p.yaw), cz = Math.cos(p.yaw);
          for (const [x, z] of [[p.x + sx * half, p.z + cz * half], [p.x - sx * half, p.z - cz * half], [p.x + cz * flank, p.z - sx * flank], [p.x - cz * flank, p.z + sx * flank]]) {
            expect(Math.abs(x)).toBeLessThan(0.92 - glass);
            expect(Math.abs(z)).toBeLessThan(0.57 - glass);
          }
          expect(p.y).toBeGreaterThan(0.3);
          expect(p.y).toBeLessThan(1.0);
        }
      }
    }
  });

  it("faces the way it swims and moves on smoothly (no jumps between frames)", () => {
    const a = pose(), b = pose();
    for (let t = 0; t < 30; t += 0.05) {
      tankSwim(t, 5, 0.3, false, a);
      tankSwim(t + 0.016, 5, 0.3, false, b);
      const vx = b.x - a.x, vz = b.z - a.z;
      expect(Math.hypot(vx, vz)).toBeLessThan(0.02);
      const heading = Math.atan2(vx, vz);
      expect(Math.abs(Math.atan2(Math.sin(heading - a.yaw), Math.cos(heading - a.yaw)))).toBeLessThan(0.15);
    }
  });

  it("is the same for everyone at the same moment, and different fish swim differently", () => {
    expect(tankSwim(4321.5, 9, 0.3, false, pose())).toEqual(tankSwim(4321.5, 9, 0.3, false, pose()));
    expect(tankSwim(10, 9, 0.3, false, pose()).x).not.toBeCloseTo(tankSwim(10, 10, 0.3, false, pose()).x, 3);
  });

  it("keeps creatures on the floor, and sizes fish from small fry to capped giants", () => {
    const p = tankSwim(12, 3, 0.2, true, pose());
    expect(p.y).toBe(TANK.floor);
    expect(tankLength([3, 5])).toBe(0.3);
    expect(tankLength([400, 800])).toBe(0.62);
    expect(tankLength([10, 18])).toBeGreaterThan(0.3);
  });
});
