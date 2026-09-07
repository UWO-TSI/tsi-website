import { describe, expect, it } from "vitest";
import { moonlightWeight } from "./moonlight";

describe("moonlight transition", () => {
  it("leaves daytime light unchanged and stays full across midnight", () => {
    for (const h of [6, 9, 12, 15, 18]) expect(moonlightWeight(h)).toBe(0);
    for (const h of [20, 21, 23, 24, 0, 2, 4]) expect(moonlightWeight(h)).toBe(1);
  });
  it("has continuous bounded dawn and dusk fades", () => {
    expect(moonlightWeight(5)).toBe(0.5);
    expect(moonlightWeight(19)).toBe(0.5);
    for (let h = 0; h < 24; h += 0.01) {
      expect(moonlightWeight(h)).toBeGreaterThanOrEqual(0);
      expect(moonlightWeight(h)).toBeLessThanOrEqual(1);
      expect(Math.abs(moonlightWeight(h + 0.01) - moonlightWeight(h))).toBeLessThan(0.008);
    }
  });
});
