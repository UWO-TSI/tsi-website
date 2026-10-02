import { describe, expect, it } from "vitest";
import { FlashLimiter, hitImpact, HitstopBudget, ultBeats } from "./impact";

describe("impact tiers (design sheet §1.6)", () => {
  it("light: 60 ms on melee only; ability: 70 ms melee, 40 ms on a ranged or area hit's first target; heavy: 100 ms, shake, FOV, flash, lines, a ring", () => {
    expect(hitImpact("light", true, false)).toMatchObject({ hitstop: 0.06, shake: 0.035 });
    expect(hitImpact("light", false, true)).toMatchObject({ hitstop: 0, shake: 0 });
    expect(hitImpact("ability", true, false).hitstop).toBe(0.07);
    expect(hitImpact("ability", false, true).hitstop).toBe(0.04);
    expect(hitImpact("ability", false, false).hitstop).toBe(0);
    expect(hitImpact("heavy", false, false)).toEqual({ hitstop: 0.1, shake: 0.1, fov: 1.5, enemyFlash: 1, lines: 10, ring: true });
    expect(hitImpact("heavy", false, false, true).enemyFlash).toBe(0.5); // Reduce flashing: the heavy enemy flash at 50%
  });
  it("hitstops merge (the longest wins, never adding) and stay under 200 ms in any second", () => {
    const b = new HitstopBudget();
    expect(b.take(0.07, 0, 0)).toBeCloseTo(0.07);
    expect(b.take(0.04, 0.05, 0.02)).toBeCloseTo(0.05); // shorter than what's running: nothing added
    expect(b.take(0.1, 0.05, 0.02)).toBeCloseTo(0.1); // the longest wins: +0.05
    expect(b.take(0.1, 0, 0.3)).toBeCloseTo(0.08); // 0.12 spent this second: only 0.08 left
    expect(b.take(0.1, 0, 0.5)).toBe(0);
    expect(b.take(0.1, 0, 1.4)).toBeCloseTo(0.1); // a second later the budget is back
  });
  it("lets one full-screen flash through in any 1,000 ms", () => {
    const f = new FlashLimiter();
    expect([f.allow(0), f.allow(0.5), f.allow(0.99), f.allow(1.0), f.allow(1.5)]).toEqual([true, false, false, true, false]);
  });
});

describe("the ult sequence (A = 450 ms)", () => {
  const A = 0.45;
  it("anticipation: the world dims to 75% and the camera pushes in 3°, no freeze yet", () => {
    const b = ultBeats(A / 2, A);
    expect(b.freeze).toBe(false);
    expect(b.dim).toBeGreaterThan(0);
    expect(b.dim).toBeLessThan(0.25);
    expect(b.fov).toBeLessThan(0);
    expect(ultBeats(A - 0.001, A).dim).toBeCloseTo(0.25, 2);
  });
  it("at A: the hard freeze, the flash frame for 50 ms, speed lines for 350 ms", () => {
    const b = ultBeats(A, A);
    expect(b).toMatchObject({ freeze: true, flash: "full", lines: 0, linesAlpha: 1, slow: 1 });
    expect(ultBeats(A + 0.06, A).flash).toBeNull();
    expect(ultBeats(A + 0.11, A).freeze).toBe(true);
    expect(ultBeats(A + 0.12, A).freeze).toBe(false);
    expect(ultBeats(A + 0.3, A).linesAlpha).toBeCloseTo(1 / 3);
    expect(ultBeats(A + 0.36, A).lines).toBeNull();
  });
  it("after the freeze: the heavy shake starts once, the FOV snaps 5° wider and eases back, slow motion 0.3 for 250 ms then back over 200 ms", () => {
    expect(ultBeats(A + 0.13, A, false, A + 0.1).shake).toBe(true);
    expect(ultBeats(A + 0.15, A, false, A + 0.13).shake).toBe(false);
    expect(ultBeats(A + 0.121, A).fov).toBeCloseTo(5, 0);
    expect(ultBeats(A + 0.52, A).fov).toBeCloseTo(0, 1);
    expect(ultBeats(A + 0.2, A).slow).toBe(0.3);
    expect(ultBeats(A + 0.12 + 0.35, A).slow).toBeGreaterThan(0.3);
    expect(ultBeats(A + 0.12 + 0.46, A).slow).toBe(1);
  });
  it("Reduce flashing: a darken instead of the flash, the dim to 85%, the lines at half", () => {
    expect(ultBeats(A, A, true)).toMatchObject({ flash: "reduced", linesAlpha: 0.5 });
    expect(ultBeats(A - 0.001, A, true).dim).toBeCloseTo(0.15, 2);
  });
});
