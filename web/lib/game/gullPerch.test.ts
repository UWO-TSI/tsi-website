import { describe, expect, it } from "vitest";
import { PERCH_GLIDE, PERCH_RISE, PERCH_SIT, newPerchState, perchAt } from "./gullPath";

describe("gull perches", () => {
  it("visits a perch now and then, the same for everyone, gliding down, sitting folded and rising without a jump", () => {
    const a = newPerchState(), b = newPerchState();
    let visits = 0, last = -1, lastW = 0, lastFold = 0;
    for (let t = 1000; t < 1600; t += 1 / 30) {
      perchAt(t, 7, 5, a);
      expect(perchAt(t, 7, 5, b)).toEqual(a);
      expect(a.index).toBeGreaterThanOrEqual(-1);
      expect(a.index).toBeLessThan(5);
      expect(Math.abs(a.w - lastW)).toBeLessThan(0.02);
      expect(Math.abs(a.fold - lastFold)).toBeLessThan(0.1);
      if (a.u > PERCH_GLIDE + 0.5 && a.u < PERCH_GLIDE + PERCH_SIT) { expect(a.w).toBe(1); expect(a.fold).toBe(1); }
      if (a.index >= 0 && last < 0) visits++;
      last = a.index; lastW = a.w; lastFold = a.fold;
    }
    // One visit every 80-150 s.
    expect(visits).toBeGreaterThanOrEqual(3);
    expect(visits).toBeLessThanOrEqual(8);
    expect(PERCH_GLIDE + PERCH_SIT + PERCH_RISE).toBeLessThan(80);
  });
  it("keeps circling where there is nowhere to land", () => {
    for (let t = 0; t < 400; t += 0.5) expect(perchAt(t, 3, 0, newPerchState()).index).toBe(-1);
  });
});
