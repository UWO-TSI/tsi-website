import { describe, expect, it } from "vitest";
import { RODS, STAT_KEYS, STAT_MAX, TACKLE, bestOwnedRod, ownedRig, biteWindowMs, canHook, castLuck, rig, rodByTier } from "./rods";
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
    expect(biteWindowMs(1400, rodByTier(5))).toBe(2450);
    expect(castLuck(0.3, rodByTier(3))).toBeCloseTo(0.42);
    expect(canHook("legendary", rodByTier(3))).toBe(false);
    expect(canHook("legendary", rodByTier(4))).toBe(true);
    expect(canHook("divine", rodByTier(1))).toBe(false);
    expect(canHook("rare", rodByTier(1))).toBe(true);
    expect(rodByTier(9).tier).toBe(5);
    expect(bestOwnedRod([]).tier).toBe(1);
    expect(bestOwnedRod(["rod_glass", "rod_cedar"]).tier).toBe(3);
    expect(bestOwnedRod(["rod_lighthouse"]).tier).toBe(4); // crafted (lib/crafting); the shop never sells them
    expect(bestOwnedRod(["rod_glass", "rod_tidewarden"]).tier).toBe(5);
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
    expect(drain(1) / drain(0.7)).toBeCloseTo(1 / 0.7, 1);
  });
  it("fills faster with reel speed and widens the bar with control", () => {
    const fish = FISH.find(f => f.rarity === "rare")!;
    const fill = (mul: number) => {
      const reel = createFishingReel(fish);
      reel.fishPosition = 0.1; reel.fishTarget = 0.1; reel.position = 0; // fish in the bar: pure fill
      const start = reel.progress;
      advanceFishingReel(reel, 0.05, false, 0, () => 0.1, 1, mul);
      return reel.progress - start;
    };
    expect(fill(rodByTier(5).fillMul)).toBeGreaterThan(fill(1));
    expect(createFishingReel(fish, rodByTier(3).barMul).barWidth).toBeGreaterThan(createFishingReel(fish).barWidth);
  });
});

describe("rod stats and add-ons (v1-gameplay m4, x-shop)", () => {
  it("gives every rod six stats on the radar's scale, the starter's all 1 (no effect)", () => {
    for (const r of RODS) for (const k of STAT_KEYS) { expect(r.base[k]).toBeGreaterThanOrEqual(1); expect(r.base[k]).toBeLessThanOrEqual(STAT_MAX); }
    const s = rodByTier(1);
    expect([s.biteWindowMs, s.tensionMul, s.rarityBonus, s.fillMul, s.waitMul, s.barMul]).toEqual([0, 1, 0, 1, 1, 1]);
  });
  it("stacks an add-on's gains on the rod, one per slot, known keys only, capped", () => {
    const glass = rodByTier(3);
    const lucky = rig(glass, ["bobber_lucky"]);
    expect(lucky.stats.luck).toBe(glass.base.luck + 2);
    expect(lucky.rarityBonus).toBeGreaterThan(glass.rarityBonus);
    expect(lucky.base).toEqual(glass.base);
    const baited = rig(glass, ["bait_sweet", "bait_sweet", "nope", "bobber_lucky"]);
    expect(baited.tackle).toEqual(["bait_sweet", "bobber_lucky"]);
    expect(baited.biteWindowMs).toBeGreaterThan(glass.biteWindowMs);
    expect(baited.waitMul).toBeLessThan(glass.waitMul);
    expect(rig(rodByTier(5), TACKLE.map(t => t.key)).stats.bite).toBeLessThanOrEqual(STAT_MAX);
  });
  it("rolls a cast on the server with only the add-ons the member owns", () => {
    expect(ownedRig(2, ["bobber_lucky"], []).rarityBonus).toBe(rodByTier(2).rarityBonus);
    expect(ownedRig(2, ["bobber_lucky"], ["bobber_lucky"]).rarityBonus).toBeGreaterThan(rodByTier(2).rarityBonus);
  });
});
