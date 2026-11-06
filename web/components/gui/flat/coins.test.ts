import { describe, expect, it } from "vitest";
import { coinCount, coinHeat, coinShares } from "./moments";

describe("a sale's coins (flyCoins)", () => {
  it("flies more coins for more money, 3 to 12, never more coins than money", () => {
    expect(coinCount(8)).toBeGreaterThanOrEqual(3);
    expect(coinCount(2)).toBe(2);
    expect(coinCount(0)).toBe(0);
    expect(coinCount(50)).toBeGreaterThan(coinCount(8));
    expect(coinCount(100_000)).toBe(12);
  });
  it("shares the money out over the coins in whole numbers that add up, the bigger shares last", () => {
    for (const amount of [1, 7, 8, 196, 1234]) {
      const shares = coinShares(amount, coinCount(amount));
      expect(shares.reduce((a, b) => a + b, 0)).toBe(amount);
      expect(shares.every(n => Number.isInteger(n) && n > 0)).toBe(true);
      expect([...shares].sort((a, b) => a - b)).toEqual(shares);
    }
  });
  it("glows a deeper yellow the more comes in", () => {
    expect(coinHeat(8)).toBeLessThan(coinHeat(200));
    expect(coinHeat(200)).toBeLessThan(coinHeat(5000));
    expect(coinHeat(1)).toBeGreaterThan(0);
    expect(coinHeat(1e9)).toBe(1);
  });
});
