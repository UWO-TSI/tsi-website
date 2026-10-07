import { describe, expect, it } from "vitest";
import { FOOT_SIDE, PRINT_FADE, PRINT_LIFE, STRIDE, SPLASH_WINDOW, inPuddle, newTrail, printOpacity, rainLandings, stepTrail, type Print } from "./weatherGround";

const collect = (t0: number, t1: number, fx: number, fz: number) => {
  const out: [number, number, number][] = [];
  rainLandings(t0, t1, fx, fz, (x, z, s) => out.push([x, z, s]));
  return out;
};

describe("weather on the ground", () => {
  it("lands rain at seeded spots and moments, the same for everyone, at a steady rate", () => {
    const a = collect(1000, 1001, 0, 0), b = collect(1000, 1001, 0, 0);
    expect(a).toEqual(b);
    // Splitting the second into frames lands exactly the same drops.
    const frames: [number, number, number][] = [];
    for (let t = 1000; t < 1001 - 1e-9; t += 1 / 60) rainLandings(t, Math.min(1001, t + 1 / 60), 0, 0, (x, z, s) => frames.push([x, z, s]));
    expect(frames.sort()).toEqual([...a].sort());
    // About 0.4 drops per square unit a second over the window.
    let total = 0;
    for (let t = 0; t < 60; t += 0.5) total += collect(t, t + 0.5, 0, 0).length;
    const area = 2 * SPLASH_WINDOW.x * (SPLASH_WINDOW.back + SPLASH_WINDOW.ahead), n = total / 60;
    expect(n / area).toBeGreaterThan(0.33);
    expect(n / area).toBeLessThan(0.47);
    // Where the viewer looks only picks the squares: an overlapping window lands the same drops where they overlap.
    const inA = (x: number, z: number) => Math.abs(x) < 5 && Math.abs(z) < 5;
    expect(collect(500, 503, 0, 0).filter(([x, z]) => inA(x, z)).sort()).toEqual(collect(500, 503, 3, 2).filter(([x, z]) => inA(x, z)).sort());
  });

  it("rings the puddles", () => {
    expect(inPuddle(0.2, 0.1, [{ x: 0, z: 0, rx: 0.5, rz: 0.3 }])).toBe(true);
    expect(inPuddle(0.6, 0, [{ x: 0, z: 0, rx: 0.5, rz: 0.3 }])).toBe(false);
  });

  it("leaves a print every stride, feet alternating either side of the way walked, none across a teleport", () => {
    const trail = newTrail(), out: Print = { x: 0, z: 0, yaw: 0, left: false }, prints: Print[] = [];
    for (let z = 0; z <= 5; z += 0.05) { const p = stepTrail(trail, 0, z, out); if (p) prints.push({ ...p }); }
    expect(prints.length).toBe(Math.floor(5 / STRIDE));
    for (let i = 1; i < prints.length; i++) {
      expect(prints[i].left).toBe(!prints[i - 1].left);
      expect(Math.abs(prints[i].x)).toBeCloseTo(FOOT_SIDE, 6);
      expect(prints[i].yaw).toBeCloseTo(0, 6);
    }
    expect(stepTrail(trail, 40, 40, out)).toBeNull();
  });

  // Audit 2026-10 world item 15: at 5 FPS a run covers more than a stride a frame. The backlog of unwalked strides
  // grew without bound, so once the frame rate recovered every frame left a print: a smear, not a trail.
  it("keeps a stride apart after a slow-frame stretch", () => {
    const trail = newTrail(), out: Print = { x: 0, z: 0, yaw: 0, left: false };
    let slow = 0, fast = 0;
    for (let i = 0; i <= 8; i++) if (stepTrail(trail, 0, i * 1.2, out)) slow++;
    expect(slow).toBe(8);
    for (let i = 1; i <= 40; i++) if (stepTrail(trail, 0, 9.6 + i * 0.05, out)) fast++;
    expect(fast).toBeLessThanOrEqual(Math.ceil(2 / STRIDE));
  });

  it("keeps a print, then fades it out", () => {
    expect(printOpacity(1)).toBe(1);
    expect(printOpacity(PRINT_LIFE - PRINT_FADE - 0.01)).toBe(1);
    expect(printOpacity(PRINT_LIFE - PRINT_FADE / 2)).toBeCloseTo(0.5, 6);
    expect(printOpacity(PRINT_LIFE)).toBe(0);
  });
});
