import { describe, expect, it } from "vitest";
import { SHAKE, SHAKE_SLOTS, fallAt, restPoint, shakeOffset, Shakes } from "./treeShake";

describe("a tree's shake", () => {
  it("wobbles the crown hard at first, dies away, and is still by the end", () => {
    const out = { x: 0, z: 0 };
    const peak = Math.max(...Array.from({ length: 30 }, (_, i) => Math.hypot(...Object.values(shakeOffset(i * 0.01, 1, out)) as [number, number])));
    expect(peak).toBeGreaterThan(0.5);
    shakeOffset(SHAKE.duration * 0.8, 1, out);
    expect(Math.hypot(out.x, out.z)).toBeLessThan(0.05);
    shakeOffset(SHAKE.duration + 0.01, 1, out);
    expect(out).toEqual({ x: 0, z: 0 });
    shakeOffset(-0.1, 1, out);
    expect(out).toEqual({ x: 0, z: 0 });
  });

  it("is world state at the tree: only that tree moves, on the shared clock, for anyone who sees it", () => {
    const shakes = new Shakes(), out = { x: 0, z: 0 };
    shakes.start(4, -2, 10, 0.12);
    expect(shakes.at(4, -2, 10.05, out)).toBe(true);
    expect(Math.hypot(out.x, out.z)).toBeGreaterThan(0);
    expect(shakes.at(6, -2, 10.05, out)).toBe(false);
    expect(out).toEqual({ x: 0, z: 0 });
    expect(shakes.at(4, -2, 10 + SHAKE.duration + 0.1, out)).toBe(false);
  });

  it("restarts a tree that's shaken again, and keeps a few trees going at once without allocating", () => {
    const shakes = new Shakes();
    shakes.start(0, 0, 1, 0.1);
    shakes.start(0, 0, 1.4, 0.1);
    expect(shakes.uniforms.filter(u => u.w > 0)).toHaveLength(1);
    expect(shakes.uniforms[0].z).toBe(1.4);
    for (let i = 0; i < SHAKE_SLOTS + 2; i++) shakes.start(i * 5 + 10, 0, 2 + i * 0.01, 0.1);
    expect(shakes.uniforms).toHaveLength(SHAKE_SLOTS);
    const before = shakes.uniforms[0];
    shakes.start(99, 0, 3, 0.1);
    expect(shakes.uniforms[0]).toBe(before);
  });
});

describe("what falls from it", () => {
  const trunk = { x: 0, z: 0 };
  it("comes to rest on the shaker's side, clear of the trunk and within reach of where they stand", () => {
    const shaker = { x: 0.2, z: -1.1 };
    const rest = restPoint(trunk, { x: 0.3, z: -0.5 }, shaker, 0.5);
    expect(Math.hypot(rest.x - trunk.x, rest.z - trunk.z)).toBeGreaterThan(0.75);
    expect(Math.hypot(rest.x - trunk.x, rest.z - trunk.z)).toBeLessThan(1.9);
    expect(Math.hypot(rest.x - shaker.x, rest.z - shaker.z)).toBeLessThan(1.25);
  });

  it("falls from where it hung, bounces once, rolls to its rest and stays there (never a pop, never sinking)", () => {
    const from = { x: 0.3, y: 2.6, z: -0.5 }, rest = { x: 0.55, z: -1.2 }, out = { x: 0, y: 0, z: 0, spin: 0 };
    expect(fallAt(from, rest, 0, 0.12, 0, out)).toBe("falling");
    expect(out.y).toBeCloseTo(2.6, 6);
    let lowest = Infinity, phases = new Set<string>();
    for (let t = 0; t < 4; t += 0.01) { phases.add(fallAt(from, rest, 0, 0.12, t, out)); lowest = Math.min(lowest, out.y); }
    expect([...phases]).toEqual(["falling", "bouncing", "rolling", "resting"]);
    expect(lowest).toBeGreaterThanOrEqual(0.12 - 1e-9);
    fallAt(from, rest, 0, 0.12, 10, out);
    expect(out.x).toBeCloseTo(rest.x, 6);
    expect(out.z).toBeCloseTo(rest.z, 6);
    expect(out.y).toBeCloseTo(0.12, 6);
  });

  it("rolls continuously: no jump in position from one frame to the next", () => {
    const from = { x: 0, y: 2.2, z: 0 }, rest = { x: 0.9, z: -0.4 }, a = { x: 0, y: 0, z: 0, spin: 0 }, b = { x: 0, y: 0, z: 0, spin: 0 };
    for (let t = 0; t < 3; t += 1 / 60) {
      fallAt(from, rest, 0.2, 0.1, t, a); fallAt(from, rest, 0.2, 0.1, t + 1 / 60, b);
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.25);
    }
  });
});
