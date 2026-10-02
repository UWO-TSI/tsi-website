import { describe, expect, it } from "vitest";
import { FLEE_LIFT, FLEE_REACH, FLEE_TIME, WARY_HOP, carryBugs, fleeAt, waryHop } from "./bugFlee";

describe("bug escapes", () => {
  it("hops once as a tell and settles", () => {
    expect(waryHop(0)).toBe(0);
    expect(waryHop(WARY_HOP / 2)).toBeGreaterThan(0.05);
    expect(waryHop(WARY_HOP + 0.01)).toBe(0);
  });
  it("flees away from the avatar along a curve, lifting and fading, never popping", () => {
    const p = { x: 0, y: 0, z: 0, yaw: 0, opacity: 1 }, dir = Math.PI / 2;
    let prev = { x: 0, z: 0, y: 1 }, lastOpacity = 1;
    for (let t = 0; t <= FLEE_TIME; t += 1 / 60) {
      fleeAt(0, 1, 0, dir, 1, false, t, p);
      expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan(0.2);
      expect(p.opacity).toBeLessThanOrEqual(lastOpacity + 1e-9);
      prev = { x: p.x, z: p.z, y: p.y }; lastOpacity = p.opacity;
    }
    // Ends away (+x, the way it fled), a little higher, curved off its first line, and gone.
    fleeAt(0, 1, 0, dir, 1, false, FLEE_TIME, p);
    expect(p.x).toBeGreaterThan(1.5);
    expect(p.y).toBeGreaterThan(1.6);
    expect(Math.abs(p.z)).toBeGreaterThan(0.5);
    expect(p.opacity).toBe(0);
    // Visible for the first part.
    expect(fleeAt(0, 1, 0, dir, 1, false, 0.4, p).opacity).toBe(1);
    // A crawler stays low and sinks.
    fleeAt(0, 0.06, 0, dir, -1, true, FLEE_TIME, p);
    expect(p.y).toBeLessThan(0.06);
  });
  it("stays near and low: a hop away, never a climb out of view", () => {
    const p = { x: 0, y: 0, z: 0, yaw: 0, opacity: 1 };
    for (const side of [1, -1]) for (let t = 0; t <= FLEE_TIME + 0.2; t += 1 / 60) {
      fleeAt(2, 0.8, -3, 1.1, side, false, t, p);
      expect(Math.hypot(p.x - 2, p.z + 3)).toBeLessThanOrEqual(FLEE_REACH + 1e-9);
      expect(p.y).toBeLessThanOrEqual(0.8 + FLEE_LIFT + 0.07);
      expect(p.y).toBeGreaterThanOrEqual(0.8 - 0.07);
      // Still visible only while it is within a body length or two of where it was.
      if (p.opacity > 0.9) expect(Math.hypot(p.x - 2, p.z + 3)).toBeLessThan(1.7);
    }
  });
});

describe("bugs out this hour", () => {
  const bug = (id: string, key: string, fled = false) => ({ id, sp: { key }, fled });
  it("keeps a fled bug fled when another node is harvested (no pop back)", () => {
    let state = carryBugs(new Map(), [bug("a", "bug_ladybug"), bug("b", "bug_mantis")]);
    state.get("a")!.fled = true;
    // A harvest re-derives the list: fresh objects for the same slots, minus the harvested one.
    state = carryBugs(state, [bug("a", "bug_ladybug")]);
    expect(state.get("a")!.fled).toBe(true);
    expect(state.has("b")).toBe(false);
  });
  it("starts a slot fresh when the hour brings a new species", () => {
    let state = carryBugs(new Map(), [bug("a", "bug_ladybug")]);
    state.get("a")!.fled = true;
    state = carryBugs(state, [bug("a", "bug_mantis"), bug("c", "bug_ladybug")]);
    expect(state.get("a")!.fled).toBe(false);
    expect(state.get("c")!.fled).toBe(false);
  });
});
