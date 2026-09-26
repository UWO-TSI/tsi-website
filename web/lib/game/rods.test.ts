import { describe, expect, it } from "vitest";
import { RODS, bestOwnedRod, biteWindowMs, canHook, castLuck, rodByTier } from "./rods";
import { advanceFishingReel, createFishingReel } from "./fishingReel";
import { FISH } from "./fishing";

describe("rod tiers", () => {
  it("has five tiers that only ever get more forgiving", () => {
    expect(RODS.map(r => r.tier)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < RODS.length; i++) {
      expect(RODS[i].biteWindowMs).toBeGreaterThan(RODS[i - 1].biteWindowMs);
      expect(RODS[i].tensionMul).toBeLessThan(RODS[i - 1].tensionMul);
      expect(RODS[i].rarityBonus).toBeGreaterThan(RODS[i - 1].rarityBonus);
    }
    expect(RODS.filter(r => r.source === "shop").map(r => r.key)).toEqual(["rod_cedar", "rod_glass"]);
  });
  it("applies bite window, luck and legendary gating", () => {
    expect(biteWindowMs(1400, rodByTier(1))).toBe(1400);
    expect(biteWindowMs(1400, rodByTier(5))).toBe(2500);
    expect(castLuck(0.3, rodByTier(3))).toBeCloseTo(0.4);
    expect(canHook("legendary", rodByTier(3))).toBe(false);
    expect(canHook("legendary", rodByTier(4))).toBe(true);
    expect(canHook("seaking", rodByTier(1))).toBe(false);
    expect(canHook("rare", rodByTier(1))).toBe(true);
    expect(rodByTier(9).tier).toBe(5);
    expect(bestOwnedRod([]).tier).toBe(1);
    expect(bestOwnedRod(["rod_glass", "rod_cedar"]).tier).toBe(3);
    expect(bestOwnedRod(["rod_lighthouse", "rod_tidewarden"]).tier).toBe(1);
  });
  it("slows the reel's drain for better rods (same fight, same fish)", () => {
    const fish = FISH.find(f => f.rarity === "rare")!;
    const drain = (mul: number) => {
      const reel = createFishingReel(fish);
      reel.fishPosition = 0.95; reel.fishTarget = 0.95; // fish far from the bar: pure drain
      const start = reel.progress;
      advanceFishingReel(reel, 0.05, false, 0, () => 0.99, mul);
      return start - reel.progress;
    };
    expect(drain(rodByTier(5).tensionMul)).toBeLessThan(drain(rodByTier(1).tensionMul));
    expect(drain(1) / drain(0.68)).toBeCloseTo(1 / 0.68, 1);
  });
});
