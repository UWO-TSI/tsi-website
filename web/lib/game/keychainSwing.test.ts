import { describe, expect, it } from "vitest";
import { CAP_ASIDE, CAP_LIFT, CAP_MOVE_S, DRAG_FLOOR, DRAG_SPIN, KEYCHAIN_LINKS, PRESS, SPIN_MAX, UP_MAX, capOffset, dragSwing, linkDir, stepCap, newPress, newSwing, pressDepth, pressKey, spinTwist, stepSwingFor, swingSpeed, type Swing, type Vec3 } from "./keychainSwing";

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

describe("the keycap off and on", () => {
  it("lifts straight off the stem first, then goes aside to hover by the block", () => {
    expect(capOffset(0)).toEqual([0, 0, 0, 0]);
    const lifting = capOffset(0.25);
    expect(lifting[0]).toBe(0);
    expect(lifting[2]).toBeGreaterThan(0);
    expect(capOffset(0.5)).toEqual([0, 0, CAP_LIFT, 0]);
    const off = capOffset(1);
    expect(off[0]).toBeCloseTo(CAP_ASIDE[0], 6);
    expect(off[2]).toBeCloseTo(CAP_ASIDE[2], 6);
    // Clear of the block and its stem the whole way (never sideways while still on the stem).
    for (let a = 0; a <= 0.5; a += 0.05) expect(capOffset(a)[0]).toBe(0);
  });

  it("takes CAP_MOVE_S to come off and the same to go back on, and goes back the way it came", () => {
    let at = 0;
    for (let t = 0; t < CAP_MOVE_S - 1e-9; t += 1 / 60) at = stepCap(at, true, 1 / 60);
    expect(at).toBeGreaterThan(0.98);
    at = stepCap(at, true, 1);
    expect(at).toBe(1);
    const half = stepCap(1, false, CAP_MOVE_S / 2);
    expect(half).toBeCloseTo(0.5, 6);
    expect(capOffset(half)).toEqual(capOffset(0.5));
    expect(stepCap(half, false, 5)).toBe(0);
  });

});

describe("grabbing it", () => {
  // David, 2026-10-18: "when grabbing the switch it rotates like crazy". A hard, fast shake keeps the twist calm and
  // never flips the body over the hook.
  it("a sustained fast drag never takes the twist past its cap, and the body never flips", () => {
    const s = newSwing(), d: Vec3 = [0, -1, 0];
    for (let i = 0; i < 600; i++) {
      const t = i / 120, side = Math.sin(t * Math.PI * 2 * 4);                 // shaken side to side four times a second
      dragSwing(s, [side * 0.6, 0.25 + 0.3 * Math.sin(t * 9), 0.2 * side]);   // and up past the hook
      spinTwist(s, Math.sign(side) * 160 * DRAG_SPIN);                          // a 160 px sweep every move
      stepSwingFor(s, 1 / 120);
      expect(Math.abs(s.spin)).toBeLessThanOrEqual(SPIN_MAX + 1e-9);
      expect(Math.abs(s.twist)).toBeLessThanOrEqual(Math.PI + SPIN_MAX / 120);
      expect(s.p[6][1]).toBeLessThanOrEqual(-DRAG_FLOOR * total + 1e-6);       // the held body stays under the hook
      if (linkDir(s, 5, d)) expect(d[1]).toBeLessThanOrEqual(UP_MAX + 1e-9);   // and its orientation never turns over the top
    }
    dragSwing(s, null);
    run(s, 4);
    expect(Math.abs(s.twist)).toBeLessThan(0.05);                              // settled in a wobble or two
  });
});
