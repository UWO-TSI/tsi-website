import { describe, expect, it } from "vitest";
import { FLEE_TIME, WARY_HOP, fleeAt, waryHop } from "./bugFlee";

describe("bug escapes", () => {
  it("hops once as a tell and settles", () => {
    expect(waryHop(0)).toBe(0);
    expect(waryHop(WARY_HOP / 2)).toBeGreaterThan(0.05);
    expect(waryHop(WARY_HOP + 0.01)).toBe(0);
  });
  it("flees away from the avatar along a curve, climbing and fading, never popping", () => {
    const p = { x: 0, y: 0, z: 0, yaw: 0, opacity: 1 }, dir = Math.PI / 2;
    let prev = { x: 0, z: 0, y: 1 }, lastOpacity = 1;
    for (let t = 0; t <= FLEE_TIME; t += 1 / 60) {
      fleeAt(0, 1, 0, dir, 1, false, t, p);
      expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan(0.2);
      expect(p.opacity).toBeLessThanOrEqual(lastOpacity + 1e-9);
      prev = { x: p.x, z: p.z, y: p.y }; lastOpacity = p.opacity;
    }
    // Ends away (+x, the way it fled), higher, curved off its first line, and gone.
    fleeAt(0, 1, 0, dir, 1, false, FLEE_TIME, p);
    expect(p.x).toBeGreaterThan(3);
    expect(p.y).toBeGreaterThan(3);
    expect(Math.abs(p.z)).toBeGreaterThan(0.5);
    expect(p.opacity).toBe(0);
    // Visible for the first part.
    expect(fleeAt(0, 1, 0, dir, 1, false, 0.4, p).opacity).toBe(1);
    // A crawler stays low and sinks.
    fleeAt(0, 0.06, 0, dir, -1, true, FLEE_TIME, p);
    expect(p.y).toBeLessThan(0.06);
  });
});
