import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RODS, STAND_IN, STAT_KEYS, STAT_MAX, TACKLE, TRAINING, bestOwnedRod, heldRig, ownedRig, biteWindowMs, canHook, castLuck, hookCap, onShopShelf, rig, rodByKey, rodByTier, toNextLevel, trained, trainingLevel, type Stats } from "./rods";
import { TOOLS } from "./tools";
import { CATALOGUE, HOLLOW_TOOLS, onSale } from "@/lib/wallet/catalogue";
import { advanceFishingReel, createFishingReel } from "./fishingReel";
import { FISH } from "./fishing";

const total = (s: Stats) => STAT_KEYS.reduce((n, k) => n + s[k], 0);

describe("rod tiers", () => {
  it("lists the rods weakest first, and the launch five only ever get more forgiving", () => {
    expect(RODS.map(r => r.tier)).toEqual([1, 1, 2, 2, 2, 3, 4, 5]);
    for (let i = 1; i < RODS.length; i++) expect(total(RODS[i].base), RODS[i].key).toBeGreaterThan(total(RODS[i - 1].base));
    const launch = [1, 2, 3, 4, 5].map(rodByTier);
    expect(launch.map(r => r.key)).toEqual(["rod_flimsy", "rod_cedar", "rod_glass", "rod_lighthouse", "rod_tidewarden"]);
    for (let i = 1; i < launch.length; i++) {
      expect(launch[i].biteWindowMs).toBeGreaterThan(launch[i - 1].biteWindowMs);
      expect(launch[i].tensionMul).toBeLessThan(launch[i - 1].tensionMul);
      expect(launch[i].rarityBonus).toBeGreaterThan(launch[i - 1].rarityBonus);
    }
    expect(RODS.filter(r => r.source === "shop").map(r => r.key)).toEqual(["rod_precision", "rod_cedar", "rod_carrot", "rod_glass"]);
  });
  it("wears an older rod's model and icon until tool-pipeline's lands, and every rod's model exists", () => {
    for (const [key, art] of Object.entries(STAND_IN)) { expect(rodByKey(key), key).not.toBeNull(); expect(STAND_IN[art], art).toBeUndefined(); }
    for (const t of TOOLS.filter(t => t.kind === "rod")) {
      expect(existsSync(join(__dirname, "../../public", t.model)), t.model).toBe(true);
      expect(existsSync(join(__dirname, "../../public", t.icon)), t.icon).toBe(true);
    }
  });
  it("applies bite window and luck", () => {
    expect(biteWindowMs(1400, rodByTier(1))).toBe(1400);
    expect(biteWindowMs(1400, rodByTier(5))).toBe(2450);
    expect(castLuck(0.3, rodByTier(3))).toBeCloseTo(0.42);
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
    expect(createFishingReel(fish, undefined, undefined, rodByTier(3).barMul).barWidth).toBeGreaterThan(createFishingReel(fish).barWidth);
  });
});

describe("rod rarity (David 2026-10-28)", () => {
  it("climbs the ladder: Flimsy, Precision and Training common, Cedar and Carrot uncommon, Glass and Lighthouse rare, Tidewarden epic", () => {
    expect(RODS.map(r => r.rarity)).toEqual(["common", "common", "uncommon", "uncommon", "common", "rare", "rare", "epic"]);
  });
  it("hooks fish up to one rung above the rod's own rarity", () => {
    expect([hookCap("common"), hookCap("uncommon"), hookCap("rare"), hookCap("epic"), hookCap("legendary"), hookCap("divine")])
      .toEqual(["uncommon", "rare", "epic", "legendary", "divine", "divine"]);
    const flimsy = rodByTier(1), cedar = rodByTier(2), glass = rodByTier(3), tide = rodByTier(5);
    expect([canHook("common", flimsy), canHook("uncommon", flimsy), canHook("rare", flimsy)]).toEqual([true, true, false]);
    expect([canHook("rare", cedar), canHook("epic", cedar)]).toEqual([true, false]);
    expect([canHook("epic", glass), canHook("legendary", glass), canHook("epic", rodByTier(4))]).toEqual([true, false, true]);
    expect([canHook("legendary", tide), canHook("divine", tide)]).toEqual([true, false]);
    expect(canHook("divine", { rarity: "legendary" })).toBe(true);
    expect(canHook("contraband", { rarity: "legendary" })).toBe(false);
  });
  it("sells rods up to rare only: every rod on sale, and the shelf's workbench rods", () => {
    const onSale = CATALOGUE.filter(e => e.slot === "rod" && !HOLLOW_TOOLS.includes(e.slug));
    expect(onSale.length).toBeGreaterThan(0);
    for (const e of onSale) expect(onShopShelf(RODS.find(r => r.key === e.catalogue_ref)!), e.slug).toBe(true);
    expect(RODS.filter(onShopShelf).map(r => r.key)).toEqual(["rod_flimsy", "rod_precision", "rod_cedar", "rod_carrot", "rod_training", "rod_glass", "rod_lighthouse"]);
  });
});

describe("rod stats and add-ons (v1-gameplay m4, x-shop)", () => {
  it("gives every rod six stats out of 100, the starter's all 10 (no effect)", () => {
    for (const r of RODS) for (const k of STAT_KEYS) { expect(r.base[k]).toBeGreaterThanOrEqual(10); expect(r.base[k]).toBeLessThanOrEqual(STAT_MAX); }
    const s = rodByTier(1);
    expect([s.biteWindowMs, s.tensionMul, s.rarityBonus, s.fillMul, s.waitMul, s.barMul]).toEqual([0, 1, 0, 1, 1, 1]);
  });
  it("stacks an add-on's gains on the rod, one per slot, known keys only, capped", () => {
    const glass = rodByTier(3);
    const lucky = rig(glass, ["bobber_lucky"]);
    expect(lucky.stats.luck).toBe(glass.base.luck + 20);
    expect(lucky.rarityBonus).toBeGreaterThan(glass.rarityBonus);
    expect(lucky.base).toEqual(glass.base);
    const baited = rig(glass, ["bait_sweet", "bait_sweet", "nope", "bobber_lucky"]);
    expect(baited.tackle).toEqual(["bait_sweet", "bobber_lucky"]);
    expect(baited.biteWindowMs).toBeGreaterThan(glass.biteWindowMs);
    expect(baited.waitMul).toBeLessThan(glass.waitMul);
    expect(rig(rodByTier(5), TACKLE.map(t => t.key)).stats.bite).toBeLessThanOrEqual(STAT_MAX);
  });
  it("rolls a cast on the server with the held rod and only the add-ons the member owns", () => {
    expect(ownedRig("rod_cedar", ["bobber_lucky"], []).rarityBonus).toBe(rodByTier(2).rarityBonus);
    expect(ownedRig("rod_cedar", ["bobber_lucky"], ["bobber_lucky"]).rarityBonus).toBeGreaterThan(rodByTier(2).rarityBonus);
    expect(ownedRig("rod_carrot", [], []).base).toEqual(rodByKey("rod_carrot")!.base);
    expect(heldRig("nope", []).key).toBe("rod_flimsy");
  });
});

describe("the Training rod (David 2026-11-02)", () => {
  const training = rodByKey(TRAINING.key)!;
  it("is a common rod nobody sells: found only", () => {
    expect([training.rarity, training.source]).toEqual(["common", "found"]);
    const row = CATALOGUE.find(e => e.catalogue_ref === TRAINING.key)!;
    expect(onSale(row)).toBe(false);
    expect(CATALOGUE.filter(e => e.slot === "rod" && onSale(e)).map(e => e.catalogue_ref)).toEqual(["rod_cedar", "rod_glass", "rod_precision", "rod_carrot"]);
  });
  it("starts between the uncommon and rare rods, and trains past the Glass rod but not the Lighthouse", () => {
    const best = (rarity: string) => Math.max(...RODS.filter(r => r.rarity === rarity && r.key !== TRAINING.key).map(r => total(r.base)));
    expect(total(training.base)).toBeGreaterThan(best("uncommon"));
    expect(total(training.base)).toBeLessThan(total(rodByKey("rod_glass")!.base));
    const top = trained(training, TRAINING.levels.at(-1)!);
    expect(total(top.base)).toBeGreaterThan(total(rodByKey("rod_glass")!.base));
    expect(total(top.base)).toBeLessThan(total(rodByKey("rod_lighthouse")!.base));
  });
  it("levels up with the fish it lands; other rods never change", () => {
    expect([0, 24, 25, 74, 75, 149, 150, 999].map(trainingLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect([0, 25, 100, 150].map(toNextLevel)).toEqual([25, 75, 150, null]);
    const lv1 = trained(training, 25);
    for (const k of STAT_KEYS) expect(lv1.base[k]).toBe(training.base[k] + TRAINING.step);
    expect(lv1.biteWindowMs).toBeGreaterThan(training.biteWindowMs);
    expect(trained(rodByKey("rod_glass")!, 500)).toBe(rodByKey("rod_glass"));
    expect(heldRig(TRAINING.key, ["bobber_lucky"], { [TRAINING.key]: 75 }).stats.luck).toBe(training.base.luck + 2 * TRAINING.step + 20);
    expect(ownedRig(TRAINING.key, [], [], { rod_flimsy: 75 }).base).toEqual(training.base);
  });
  it("is found and counted by the migration with the same numbers", () => {
    const sql = readFileSync(join(__dirname, "../../supabase/migrations/20261102120000_rod_catches.sql"), "utf8");
    expect(sql).toContain(`r.rod_key = '${TRAINING.unlock.rod}' AND v_count >= ${TRAINING.unlock.catches}`);
    expect(sql).toContain(`s.catalogue_ref = '${TRAINING.key}'`);
  });
});
