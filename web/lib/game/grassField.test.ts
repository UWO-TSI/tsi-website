import { describe, expect, it } from "vitest";
import { BendField, GrassData, ToroidalWindow, groundFrom } from "./grassField";

const mag = ([x, z]: readonly number[]) => Math.hypot(x, z);

describe("the toroidal window (specs/v1-drop.md §8c, the grass)", () => {
  it("holds each world texel at its index mod n, centred on the focus", () => {
    const w = new ToroidalWindow(8, 0.5);
    w.recentre(0, 0);
    expect(w.i0).toBe(-4);
    expect(w.k0).toBe(-4);
    expect(w.contains(-2, 1.7)).toBe(true);
    expect(w.contains(2, 0)).toBe(false);
    expect(w.index(-1, -1)).toBe(w.index(7, 7));
  });
  it("reports only the columns and rows that entered after a small move", () => {
    const w = new ToroidalWindow(8, 0.5);
    w.recentre(0, 0);
    const moved = w.recentre(1, 0);
    expect(moved.all).toBe(false);
    expect(moved.cols).toEqual([4, 5]);
    expect(moved.rows).toEqual([]);
    const back = w.recentre(0, -0.5);
    expect(back.cols).toEqual([-4, -3]);
    expect(back.rows).toEqual([-5]);
  });
  it("refills everything after a jump of a whole window", () => {
    const w = new ToroidalWindow(8, 0.5);
    w.recentre(0, 0);
    expect(w.recentre(40, 0).all).toBe(true);
  });
});

describe("the bend field: grass pressed under characters, with short trails", () => {
  it("pushes the grass outward from a character's feet, and leaves it alone past the radius", () => {
    const f = new BendField(128, 0.25, 0.9);
    f.recentre(0, 0);
    f.press(2, 3, 0.5);
    const [ex] = f.sample(2.25, 3), [wx] = f.sample(1.75, 3), [, nz] = f.sample(2, 3.25);
    expect(ex).toBeGreaterThan(0.3);
    expect(wx).toBeLessThan(-0.3);
    expect(nz).toBeGreaterThan(0.3);
    expect(mag(f.sample(2, 4))).toBe(0);
    expect(mag(f.sample(3, 3))).toBe(0);
  });
  it("springs back with the trail's time constant", () => {
    const f = new BendField(128, 0.25, 0.9);
    f.recentre(0, 0);
    f.press(0, 0, 0.5);
    const before = mag(f.sample(0.25, 0));
    f.decay(0.9);
    expect(mag(f.sample(0.25, 0)) / before).toBeCloseTo(Math.exp(-1), 2);
  });
  it("leaves a short trail behind a walking character that is gone a few seconds later", () => {
    const f = new BendField(128, 0.25, 0.6);
    f.recentre(0, 0);
    const dt = 1 / 60;
    for (let t = 0; t <= 1; t += dt) { f.decay(dt); f.press(-2 + 4 * t, 0, 0.45); }
    const start = mag(f.sample(-1.5, 0.25)), mid = mag(f.sample(0.5, 0.25)), end = mag(f.sample(1.75, 0.25));
    expect(start).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(start);
    expect(end).toBeGreaterThan(mid);
    for (let t = 0; t < 3; t += dt) f.decay(dt);
    expect(mag(f.sample(1.75, 0.25))).toBeLessThan(0.05);
  });
  it("ignores a press outside the window, so it never bleeds onto the wrapped copy in view", () => {
    const f = new BendField(128, 0.25, 0.9);
    f.recentre(0, 0);
    f.press(40, 0, 0.5);
    expect(mag(f.sample(40 - 32, 0.25))).toBe(0);
    expect(f.encode()).toBe(false);
  });
  it("clears what leaves the window when the view moves, and keeps what stays", () => {
    const f = new BendField(128, 0.25, 0.9);
    f.recentre(0, 0);
    f.press(-10, 0, 0.5);
    f.press(15, 0, 0.5);
    f.recentre(10, 0);
    expect(mag(f.sample(-10 + 32, 0.25))).toBe(0);
    expect(mag(f.sample(15.25, 0))).toBeGreaterThan(0.3);
  });
  it("encodes the push into the texture's bytes around a neutral 128", () => {
    const f = new BendField(16, 0.25, 0.9);
    f.recentre(0, 0);
    expect(f.encode()).toBe(false);
    expect(f.bytes[0]).toBe(128);
    f.press(0, 0, 0.5);
    expect(f.encode()).toBe(true);
    const i = f.window.index(Math.round(0.25 / 0.25), 0) * 4;
    expect(f.bytes[i]).toBeGreaterThan(160);
    expect(Math.abs(f.bytes[i + 1] - 128)).toBeLessThan(4);
  });
});

describe("the grass data: ground height and density around the view", () => {
  it("fills the window from the sampler and refills only what enters", () => {
    let calls = 0;
    const d = new GrassData(16, 0.5, (x, z) => { calls++; return [x * 0.5, z > 0 ? 1 : 0]; });
    expect(d.update(0, 0)).toBe(true);
    expect(calls).toBe(256);
    expect(d.sample(1, 1)).toEqual([0.5, 1]);
    expect(d.sample(1, -1)).toEqual([0.5, 0]);
    calls = 0;
    expect(d.update(0.2, 0)).toBe(false);
    expect(calls).toBe(0);
    expect(d.update(0.6, 0)).toBe(true);
    expect(calls).toBe(16);
  });
  it("stores height premultiplied by density, so filtering ignores the ground where no grass grows", () => {
    // Half a grass texel at height 1 beside a cliff top (no grass, height 6): the blend stays at the grass's height.
    expect(groundFrom(0.5 * 1 + 0.5 * 0, 0.5)).toBeCloseTo(1);
    expect(groundFrom(0, 0)).toBe(0);
  });
});
