import { describe, expect, it } from "vitest";
import { KEYCHAIN_LINKS, PRESS, dragSwing, newPress, newSwing, pressDepth, pressKey, spinTwist, stepSwingFor, swingSpeed, type Swing } from "./keychainSwing";

const lengthsOk = (s: Swing, tol: number) => s.len.every((l, i) => Math.abs(Math.hypot(s.p[i + 1][0] - s.p[i][0], s.p[i + 1][1] - s.p[i][1], s.p[i + 1][2] - s.p[i][2]) - l) < tol);
const finite = (s: Swing) => s.p.every(p => p.every(Number.isFinite)) && Number.isFinite(s.twist);
const total = KEYCHAIN_LINKS.reduce((a, b) => a + b, 0);
const run = (s: Swing, seconds: number) => { for (let t = 0; t < seconds; t += 1 / 60) stepSwingFor(s, 1 / 60); return s; };

describe("the keycap keychain's swing", () => {
  it("hangs straight down from the hook at rest, and stays there", () => {
    const s = run(newSwing(), 3);
    expect(s.p[0]).toEqual([0, 0, 0]);
    const end = s.p[s.p.length - 1];
    expect(Math.abs(end[0])).toBeLessThan(1e-6);
    expect(end[1]).toBeCloseTo(-total, 2);
    expect(swingSpeed(s)).toBeLessThan(1e-6);
  });

  it("swings back to rest after it's pulled aside and let go, and settles", () => {
    const s = newSwing();
    dragSwing(s, [0.5, -0.8, 0.1]);
    run(s, 1);
    dragSwing(s, null);
    run(s, 0.5);
    expect(swingSpeed(s)).toBeGreaterThan(1e-3);        // still swinging just after
    run(s, 14);
    const end = s.p[s.p.length - 1];
    expect(Math.abs(end[0])).toBeLessThan(0.02);
    expect(Math.abs(end[2])).toBeLessThan(0.02);
    expect(swingSpeed(s)).toBeLessThan(1e-3);
    expect(lengthsOk(s, 0.01)).toBe(true);
  });

  it("stays stable under a big, fast drag: never past its reach, no blow-up, the hook fixed", () => {
    const s = newSwing();
    for (let i = 0; i < 240; i++) {
      const a = i * 0.9;
      dragSwing(s, [Math.cos(a) * 5, Math.sin(a) * 5, Math.sin(a * 1.7) * 5]);   // far out of reach, whipping round
      spinTwist(s, 40);
      stepSwingFor(s, 1 / 30);
      expect(finite(s)).toBe(true);
      expect(Math.hypot(...s.p[s.p.length - 1])).toBeLessThanOrEqual(total + 1e-6);
      expect(s.p[0]).toEqual([0, 0, 0]);
    }
    dragSwing(s, null);
    run(s, 20);
    expect(finite(s)).toBe(true);
    expect(lengthsOk(s, 0.01)).toBe(true);
    expect(swingSpeed(s)).toBeLessThan(1e-3);
    expect(Math.abs(s.twist)).toBeLessThan(0.01);
  });

  it("is stable however long a frame takes", () => {
    const s = newSwing();
    dragSwing(s, [0.6, -0.5, 0]);
    stepSwingFor(s, 2);                 // a long stall (a hidden tab) is clamped
    dragSwing(s, null);
    for (let i = 0; i < 50; i++) stepSwingFor(s, 0.25);
    expect(finite(s)).toBe(true);
    expect(lengthsOk(s, 0.02)).toBe(true);
  });
});

describe("the keycap's press", () => {
  it("goes down, holds, comes back up in time with the click, then rests", () => {
    const p = pressKey(newPress(), 10);
    expect(pressDepth(p, 10)).toBe(0);
    expect(pressDepth(p, 10 + PRESS.down / 2)).toBeCloseTo(0.5, 5);
    expect(pressDepth(p, 10 + PRESS.down + PRESS.hold / 2)).toBe(1);
    const mid = pressDepth(p, 10 + PRESS.down + PRESS.hold + PRESS.up / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(pressDepth(p, 10 + PRESS.down + PRESS.hold + PRESS.up + 0.01)).toBe(0);
    expect(p.at).toBeNull();
    expect(pressDepth(newPress(), 3)).toBe(0);
  });

  it("starts again on a press during a press", () => {
    const p = pressKey(newPress(), 0);
    pressKey(p, PRESS.down + PRESS.hold + 0.01);
    expect(pressDepth(p, PRESS.down + PRESS.hold + 0.02)).toBeCloseTo(0.01 / PRESS.down, 5);
  });
});
