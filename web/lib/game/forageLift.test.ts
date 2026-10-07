import { describe, expect, it } from "vitest";
import { LIFT, handOf, liftPose, type Lift } from "./forageLift";

const out = () => ({ x: 0, y: 0, z: 0, scale: 1 });
describe("taking a thing into a hand", () => {
  const lift: Lift = { t0: 1000, from: { x: 1, y: 0, z: 2 }, to: handOf({ x: 0, y: 0, z: 0 }, 0), ms: LIFT.ms };
  it("leaves from where it lay and ends in the picker's hand, shrinking into it", () => {
    const o = out();
    expect(liftPose(lift, 1000, o)).toBe(true);
    expect(o).toMatchObject({ x: 1, y: 0, z: 2 });
    expect(liftPose(lift, 1000 + LIFT.ms, o)).toBe(false);
    expect(o.x).toBeCloseTo(lift.to.x, 6); expect(o.y).toBeCloseTo(lift.to.y, 6); expect(o.z).toBeCloseTo(lift.to.z, 6);
    expect(o.scale).toBeLessThan(0.3);
  });
  it("is the picker's own hand: in front of whoever picked it, at their height", () => {
    const h = handOf({ x: 4, y: 1, z: 4 }, Math.PI / 2);
    expect(h.x).toBeGreaterThan(4); expect(h.z).toBeCloseTo(4, 6); expect(h.y).toBeGreaterThan(1.4);
  });
  it("rises out of its hole first when it was dug up, then goes to the hand", () => {
    const dug: Lift = { ...lift, rise: 250, riseBy: 0.35 }, o = out();
    liftPose(dug, 1000 + 125, o);
    expect(o.x).toBe(1); expect(o.z).toBe(2); expect(o.y).toBeGreaterThan(0.2);
    liftPose(dug, 1000 + 249, o);
    const top = o.y;
    liftPose(dug, 1000 + 251, o);
    expect(Math.abs(o.y - top)).toBeLessThan(0.05);
    expect(liftPose(dug, 1000 + 250 + LIFT.ms, o)).toBe(false);
  });
  it("moves smoothly the whole way (no jump between frames)", () => {
    const dug: Lift = { ...lift, rise: 250, riseBy: 0.35 }, a = out(), b = out();
    for (let t = 1000; t < 1000 + 250 + LIFT.ms; t += 16) {
      liftPose(dug, t, a); liftPose(dug, t + 16, b);
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.25);
    }
  });
});
