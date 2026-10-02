import { describe, expect, it } from "vitest";
import { addCharge, dealtCharge, healedCharge, takenCharge, ULT, ultBlock, ultReady } from "./ult";

describe("the ult meter (design sheet §1.2)", () => {
  it("charges 0.7 × raw ÷ base hit a hit, at most 6, scaled by the kit's charge", () => {
    expect(dealtCharge(10, 10)).toBeCloseTo(0.7);
    expect(dealtCharge(200, 10)).toBe(6);
    expect(dealtCharge(10, 10, 1.25)).toBeCloseTo(0.875);
    expect(dealtCharge(200, 10, 0.8)).toBeCloseTo(4.8);
    expect(dealtCharge(10, 0)).toBe(0);
  });
  it("charges 40 per max HP taken and 50 per max HP restored or absorbed", () => {
    expect(takenCharge(50, 100)).toBe(20);
    expect(healedCharge(25, 100)).toBe(12.5);
    expect(healedCharge(25, 100, 1.2)).toBe(15);
  });
  it("fills in the target window: two base hits a second fill it in about 71 s", () => {
    const perSecond = 2 * dealtCharge(10, 10);
    expect(ULT.max / perSecond).toBeGreaterThan(60);
    expect(ULT.max / perSecond).toBeLessThan(90);
  });
  it("stops at full; further charge is lost", () => {
    expect(addCharge(98, 5)).toBe(100);
    expect(ultReady(addCharge(98, 5))).toBe(true);
    expect(addCharge(0, -5)).toBe(0);
  });
  it("needs a full meter, the caster alive, out of the safe zone, not drawing, the signature weapon in hand", () => {
    const ok = { meter: 100, alive: true, safe: false, drawing: false, signature: true, active: false };
    expect(ultBlock(ok)).toBeNull();
    expect(ultBlock({ ...ok, meter: 99 })).toBe("charging");
    expect(ultBlock({ ...ok, alive: false })).toBe("down");
    expect(ultBlock({ ...ok, safe: true })).toBe("safe");
    expect(ultBlock({ ...ok, drawing: true })).toBe("drawing");
    expect(ultBlock({ ...ok, signature: false })).toBe("weapon");
    expect(ultBlock({ ...ok, active: true })).toBe("active");
  });
});
