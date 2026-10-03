import { describe, expect, it } from "vitest";
import { MARK, newMoveMark, markLook, placeMark, settleMark, stepMark } from "./moveMark";

const slope = (x: number, z: number) => 0.4 * x + 0.1 * z; // a ramp rising toward +x

describe("the move target (arrival-wharf.md deliverable 4)", () => {
  it("lies on the ground's slope where you tapped, a hair above it", () => {
    const m = newMoveMark();
    placeMark(m, 2, -1, slope);
    expect(m.y).toBeCloseTo(slope(2, -1), 6);
    const n = Math.hypot(m.nx, m.ny, m.nz);
    expect(n).toBeCloseTo(1, 6);
    // The normal of y = 0.4x + 0.1z is (-0.4, 1, -0.1), normalised.
    expect(m.nx / m.ny).toBeCloseTo(-0.4, 3);
    expect(m.nz / m.ny).toBeCloseTo(-0.1, 3);
    const flat = newMoveMark();
    placeMark(flat, 0, 0, () => 1.5);
    expect([flat.nx, flat.ny, flat.nz]).toEqual([0, 1, 0]);
  });

  it("lands soft, holds and breathes while you walk, never popping in or out", () => {
    const m = newMoveMark(), look = { scale: 0, opacity: 0 };
    expect(markLook(m, look).opacity).toBe(0); // nothing until a tap
    placeMark(m, 0, 0, () => 0);
    let prev = markLook(m, look).opacity, most = 0;
    for (let i = 0; i < 120; i++) {
      stepMark(m, 1 / 60);
      const o = markLook(m, look).opacity;
      expect(Math.abs(o - prev)).toBeLessThan(0.12);
      most = Math.max(most, look.scale);
      prev = o;
    }
    expect(m.phase).toBe("hold");
    expect(prev).toBeCloseTo(MARK.opacity, 6);
    expect(most).toBeGreaterThan(1); // a little overshoot as it lands
  });

  it("presses down and fades as you arrive; shrinks away quicker if you walk off another way", () => {
    for (const [arrived, length] of [[true, MARK.arrive], [false, MARK.cancel]] as const) {
      const m = newMoveMark(), look = { scale: 0, opacity: 0 };
      placeMark(m, 0, 0, () => 0);
      for (let i = 0; i < 60; i++) stepMark(m, 1 / 60);
      settleMark(m, arrived);
      expect(m.phase).toBe(arrived ? "arrive" : "cancel");
      let prev = markLook(m, look).opacity;
      for (let t = 0; t < length + 0.05; t += 1 / 60) {
        stepMark(m, 1 / 60);
        const o = markLook(m, look).opacity;
        expect(Math.abs(o - prev)).toBeLessThan(0.15);
        prev = o;
      }
      expect(m.phase).toBe("idle");
      expect(markLook(m, look).opacity).toBe(0);
    }
    expect(MARK.cancel).toBeLessThan(MARK.arrive);
  });

  it("starts again wherever the next tap lands", () => {
    const m = newMoveMark();
    placeMark(m, 0, 0, () => 0);
    for (let i = 0; i < 60; i++) stepMark(m, 1 / 60);
    placeMark(m, 5, 5, () => 0);
    expect([m.phase, m.t, m.x, m.z]).toEqual(["appear", 0, 5, 5]);
    // Settling an idle mark does nothing.
    const idle = newMoveMark();
    settleMark(idle, true);
    expect(idle.phase).toBe("idle");
  });
});
