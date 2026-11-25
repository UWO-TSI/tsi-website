import { describe, expect, it } from "vitest";
import { CRITICAL, DRAIN_MAX, HURT_FROM, VIGNETTE_MAX, hurtLook } from "./lowHealth";

describe("hurtLook", () => {
  it("is clear while health is at or over the vignette's start", () => {
    expect(hurtLook(1)).toEqual({ vignette: 0, drain: 0 });
    expect(hurtLook(HURT_FROM)).toEqual({ vignette: 0, drain: 0 });
  });
  it("grows the vignette as health falls, with no drain until critical", () => {
    const a = hurtLook(0.5), b = hurtLook(0.3);
    expect(a.vignette).toBeGreaterThan(0);
    expect(b.vignette).toBeGreaterThan(a.vignette);
    expect(a.drain).toBe(0);
    expect(b.drain).toBe(0);
  });
  it("drains the colour from critical down, both at their most when empty", () => {
    expect(hurtLook(CRITICAL).drain).toBe(0);
    expect(hurtLook(CRITICAL / 2).drain).toBeCloseTo(DRAIN_MAX / 2);
    expect(hurtLook(0)).toEqual({ vignette: VIGNETTE_MAX, drain: DRAIN_MAX });
    expect(hurtLook(-1)).toEqual(hurtLook(0));
  });
});
