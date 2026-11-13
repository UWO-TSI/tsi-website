import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RODS, STAT_KEYS, STAT_MAX, TACKLE, TRAINING, awakened, awakenedLook, bestOwnedRod, heldRig, inPlay, nextAwakening, ownedRig, ownsRod, biteWindowMs, canHook, castLuck, hookCap,
  AWAKEN_AT, onShopShelf, rig, rodByKey, rodByTier, secretAwakenings, stageAt, trainingQuest, type Stats } from "./rods";
import { TOOLS, checkHeld } from "./tools";
import { CATALOGUE, onSale } from "@/lib/wallet/catalogue";
import { advanceFishingReel, createFishingReel } from "./fishingReel";
import { FISH } from "./fishing";

const total = (s: Stats) => STAT_KEYS.reduce((n, k) => n + s[k], 0);

describe("rod tiers", () => {
  it("lists the rods weakest first, and the launch five only ever get more forgiving", () => {
    expect(RODS.map(r => r.tier)).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 5, 5, 5]);
    for (let i = 1; i < RODS.length; i++) expect(total(RODS[i].base), RODS[i].key).toBeGreaterThan(total(RODS[i - 1].base));
    const launch = ["rod_flimsy", "rod_cedar", "rod_glass", "rod_lighthouse", "rod_tidewarden"].map(k => rodByKey(k)!);
    for (let i = 1; i < launch.length; i++) {
      expect(launch[i].biteWindowMs).toBeGreaterThan(launch[i - 1].biteWindowMs);
      expect(launch[i].rarityBonus).toBeGreaterThan(launch[i - 1].rarityBonus);
    }
    // The Glass rod's line is brittle (David 2026-11-04: "glass strenght lower"); the rest only hold better.
    for (let i = 1; i < launch.length; i++) if (launch[i].key !== "rod_glass" && launch[i - 1].key !== "rod_glass") expect(launch[i].tensionMul).toBeLessThan(launch[i - 1].tensionMul);
    expect(RODS.filter(r => r.source === "shop").map(r => r.key)).toEqual(["rod_precision", "rod_cedar", "rod_carrot", "rod_glass"]);
  });
  it("every rod has its own model and icon file", () => {
    expect(new Set(TOOLS.filter(t => t.kind === "rod").map(t => t.model)).size).toBe(RODS.length);
    for (const t of TOOLS.filter(t => t.kind === "rod")) {
      expect(existsSync(join(__dirname, "../../public", t.model)), t.model).toBe(true);
      expect(existsSync(join(__dirname, "../../public", t.icon)), t.icon).toBe(true);
    }
  });
  it("applies bite window and luck", () => {
    expect(biteWindowMs(1400, rodByTier(1))).toBe(1400);
    expect(biteWindowMs(1400, rodByKey("rod_tidewarden")!)).toBe(2210);
    expect(castLuck(0.3, rodByTier(3))).toBeCloseTo(0.404);
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
    expect(drain(rodByKey("rod_tidewarden")!.tensionMul)).toBeLessThan(drain(rodByTier(1).tensionMul));
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
  it("climbs the ladder: Flimsy, Training and Precision common, Cedar and Carrot uncommon, Glass, Riptide and Lighthouse rare, Titanium, Tidewarden and Tempest epic", () => {
    expect(RODS.map(r => r.rarity)).toEqual(["common", "common", "common", "uncommon", "uncommon", "rare", "rare", "rare", "epic", "epic", "epic"]);
    expect(RODS.filter(r => r.rarity === "epic").map(r => [r.key, r.source])).toEqual([["rod_titanium", "crafted"], ["rod_tidewarden", "crafted"], ["rod_tempest", "found"]]);
  });
  it("hooks fish up to one rung above the rod's own rarity", () => {
    expect([hookCap("common"), hookCap("uncommon"), hookCap("rare"), hookCap("epic"), hookCap("legendary"), hookCap("divine")])
      .toEqual(["uncommon", "rare", "epic", "legendary", "divine", "divine"]);
    const flimsy = rodByTier(1), cedar = rodByTier(2), glass = rodByTier(3), tide = rodByKey("rod_tidewarden")!;
    expect([canHook("common", flimsy), canHook("uncommon", flimsy), canHook("rare", flimsy)]).toEqual([true, true, false]);
    expect([canHook("rare", cedar), canHook("epic", cedar)]).toEqual([true, false]);
    expect([canHook("epic", glass), canHook("legendary", glass), canHook("epic", rodByTier(4))]).toEqual([true, false, true]);
    expect([canHook("legendary", tide), canHook("divine", tide)]).toEqual([true, false]);
    expect(canHook("divine", { hooks: hookCap("legendary") })).toBe(true);
    expect(canHook("contraband", { hooks: hookCap("legendary") })).toBe(false);
  });
  it("sells rods up to rare only: every rod on sale, and the shelf's workbench rods", () => {
    const sold = CATALOGUE.filter(e => e.slot === "rod" && onSale(e));
    expect(sold.length).toBeGreaterThan(0);
    for (const e of sold) expect(onShopShelf(RODS.find(r => r.key === e.catalogue_ref)!), e.slug).toBe(true);
    expect(RODS.filter(onShopShelf).map(r => r.key)).toEqual(["rod_flimsy", "rod_training", "rod_precision", "rod_cedar", "rod_carrot", "rod_glass", "rod_riptide", "rod_lighthouse"]);
  });
});

describe("rod stats and add-ons (v1-gameplay m4, x-shop)", () => {
  it("gives every rod six stats up to STAT_MAX, the starter's all 10 (no effect)", () => {
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
    expect(rig(awakened(rodByKey(TRAINING.key)!, 1000), TACKLE.map(t => t.key)).stats.bite).toBe(STAT_MAX);
  });
  it("rolls a cast on the server with the held rod and only the add-ons the member owns", () => {
    expect(ownedRig("rod_cedar", ["bobber_lucky"], []).rarityBonus).toBe(rodByTier(2).rarityBonus);
    expect(ownedRig("rod_cedar", ["bobber_lucky"], ["bobber_lucky"]).rarityBonus).toBeGreaterThan(rodByTier(2).rarityBonus);
    expect(ownedRig("rod_carrot", [], []).base).toEqual(rodByKey("rod_carrot")!.base);
    expect(heldRig("nope", []).key).toBe("rod_flimsy");
  });
});

describe("the rescale (David 2026-11-04)", () => {
  const top = (r: (typeof RODS)[number]) => Math.max(...STAT_KEYS.map(k => r.base[k]));
  it("keeps every epic, fully awakened, under a legendary's 100, which sits about 100; Divine has room past it", () => {
    for (const r of RODS.filter(x => x.rarity === "epic")) expect(top(awakened(r, 99_999)), r.key).toBeLessThan(90);
    const legend = awakened(rodByKey(TRAINING.key)!, 1000);
    for (const k of STAT_KEYS) expect(legend.base[k]).toBeGreaterThanOrEqual(90);
    expect(STAT_MAX).toBeGreaterThanOrEqual(120);
  });
  it("fits each rod: the Glass rod's line is its weakest stat", () => {
    const glass = rodByKey("rod_glass")!;
    expect(Math.min(...STAT_KEYS.map(k => glass.base[k]))).toBe(glass.base.strength);
    expect(glass.base.strength).toBeLessThan(rodByKey("rod_cedar")!.base.strength);
  });
});

describe("passives (David 2026-11-04)", () => {
  const sunny = { water: "river" as const, hour: 14, weather: "sunny" };
  it("rare and up have one; commons and uncommons none", () => {
    for (const r of RODS) expect(!!r.passive, r.key).toBe(r.rarity === "rare" || r.rarity === "epic");
  });
  it("adds its gains only while its water, weather or hour holds", () => {
    const glass = rodByKey("rod_glass")!, lh = rodByKey("rod_lighthouse")!, rip = rodByKey("rod_riptide")!;
    expect(inPlay(glass, sunny).stats.control).toBe(glass.base.control + 10);
    expect(inPlay(glass, { ...sunny, weather: "rain" })).toBe(glass);
    expect(inPlay(lh, { ...sunny, hour: 22 }).rarityBonus).toBeGreaterThan(lh.rarityBonus);
    expect(inPlay(lh, sunny)).toBe(lh);
    expect(inPlay(rip, { ...sunny, water: "sea" }).fillMul).toBeGreaterThan(rip.fillMul);
    expect(inPlay(rip, { ...sunny, water: null })).toBe(rip);
    expect(inPlay(rodByTier(1), sunny)).toBe(rodByTier(1));
  });
});

describe("awakenings (David 2026-11-04: no levels, only awakenings)", () => {
  const training = rodByKey(TRAINING.key)!;
  it("the Training rod starts about the Flimsy's stats, hooks up to rare, and stays a surprise", () => {
    for (const k of STAT_KEYS) expect(Math.abs(training.base[k] - rodByTier(1).base[k])).toBeLessThanOrEqual(5);
    expect([training.rarity, training.source, training.hooks]).toEqual(["common", "found", "rare"]);
    expect(secretAwakenings(training)).toBe(true);
    expect(RODS.filter(secretAwakenings).map(r => r.key)).toEqual([TRAINING.key]);
  });
  it("awakens at 50, 250 and 1000 fish to a rare's, an epic's and a legendary's stats", () => {
    expect(training.awakenings.map(a => [a.at, a.looks])).toEqual([[50, "rare"], [250, "epic"], [1000, "legendary"]]);
    expect([0, 49, 50, 249, 250, 999, 1000, 5000].map(n => stageAt(training, n))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    const best = (rarity: string) => Math.max(...RODS.filter(r => r.rarity === rarity).map(r => total(r.base)));
    expect(total(awakened(training, 50).base)).toBeGreaterThanOrEqual(best("rare") - 30);
    expect(total(awakened(training, 50).base)).toBeLessThanOrEqual(best("rare"));
    expect(total(awakened(training, 250).base)).toBeGreaterThan(best("epic"));
    expect([awakened(training, 50).hooks, awakened(training, 250).hooks, awakened(training, 1000).hooks]).toEqual(["epic", "legendary", "divine"]);
    expect(awakened(training, 1000).passive?.name).toBe("Seasoned");
    expect(awakened(training, 49)).toBe(training);
    expect(heldRig(TRAINING.key, ["bobber_lucky"], { [TRAINING.key]: 50 }).stats.luck).toBe(training.awakenings[0].base.luck + 20);
    expect(ownedRig(TRAINING.key, [], [], { rod_flimsy: 75 }).base).toEqual(training.base);
  });
  it("epic and up awaken in the open; rare and below (but the Training rod) never do", () => {
    for (const r of RODS) expect(r.awakenings.length > 0, r.key).toBe(r.key === TRAINING.key || r.rarity === "epic");
    const tide = rodByKey("rod_tidewarden")!;
    expect(nextAwakening(tide, 120)?.at).toBe(AWAKEN_AT);
    expect(nextAwakening(tide, AWAKEN_AT)).toBeNull();
    expect(awakened(tide, AWAKEN_AT).passive?.text).toContain("luck");
    expect(awakened(tide, AWAKEN_AT - 1).passive).toBe(tide.passive);
    expect(awakened(rodByKey("rod_glass")!, 5000)).toBe(rodByKey("rod_glass"));
  });
  it("each epic awakens once, at about 600 fish (David 2026-11-06: \"only have 1 awakenings ... very high cap at 600 ish\")", () => {
    const epics = RODS.filter(r => r.rarity === "epic");
    for (const r of epics) expect(r.awakenings.map(a => a.at), r.key).toEqual([AWAKEN_AT]);
    // Only what the rod is for grows: Titanium's line, never its luck.
    const ti = rodByKey("rod_titanium")!, woke = awakened(ti, AWAKEN_AT);
    expect(woke.base.strength).toBeGreaterThan(ti.base.strength);
    expect(woke.base.luck).toBe(ti.base.luck);
  });
  it("wears its awakening's own model once it reaches it, and keeps the one it was bought with until then (rod-titanium round 1)", () => {
    const ti = rodByKey("rod_titanium")!;
    expect(awakenedLook(awakened(ti, AWAKEN_AT - 1))).toBeNull();
    const look = awakenedLook(awakened(ti, AWAKEN_AT))!;
    expect(look).toEqual({ model: "/assets/game/tools/rod-titanium-a1.glb", icon: "rod_titanium_a1" });
    expect(existsSync(join(__dirname, "../../public", look.model))).toBe(true);
    expect(existsSync(join(__dirname, "../../public/assets/icons", `${look.icon}.webp`))).toBe(true);
    // The Tidewarden and the Tempest awaken into their own models too (round 11).
    for (const key of ["rod_tidewarden", "rod_tempest"]) {
      const l = awakenedLook(awakened(rodByKey(key)!, AWAKEN_AT))!;
      expect(existsSync(join(__dirname, "../../public", l.model))).toBe(true);
      expect(existsSync(join(__dirname, "../../public/assets/icons", `${l.icon}.webp`))).toBe(true);
    }
    // A rod whose awakenings have no model of their own keeps its own (the cutscene's stand-in recolour stays).
    expect(awakenedLook(awakened(training, 1000))).toBeNull();
  });
  it("takes the rarity its stats now match (David 2026-11-04: \"when awakened, rarity change\")", () => {
    expect([0, 50, 250, 1000].map(n => awakened(training, n).rarity)).toEqual(["common", "rare", "epic", "legendary"]);
    expect(awakened(rodByKey("rod_tempest")!, AWAKEN_AT).rarity).toBe("epic");
  });
});

describe("the Training rod's trade (David 2026-11-04)", () => {
  it("is never sold", () => {
    const row = CATALOGUE.find(e => e.catalogue_ref === TRAINING.key)!;
    expect(onSale(row)).toBe(false);
    expect(CATALOGUE.filter(e => e.slot === "rod" && onSale(e)).map(e => e.catalogue_ref)).toEqual(["rod_cedar", "rod_glass", "rod_precision", "rod_carrot"]);
  });
  it("starts Gary's quest at the Flimsy's 35th fish, until the Training rod is yours", () => {
    expect(trainingQuest({ rod_flimsy: 34 }, [])).toBeNull();
    expect(trainingQuest({ rod_flimsy: 35 }, [])?.steps.map(s => s.done)).toEqual([true, false]);
    expect(trainingQuest({ rod_flimsy: 35 }, [])?.steps[1].label).toContain("Gary");
    expect(trainingQuest({ rod_flimsy: 80 }, [TRAINING.key])).toBeNull();
  });
  it("retires the Flimsy rod once traded: off the wheel, refused on a cast", () => {
    const flimsy = rodByTier(1);
    expect([ownsRod(flimsy, []), ownsRod(flimsy, [TRAINING.key])]).toEqual([true, false]);
    expect(bestOwnedRod([TRAINING.key]).key).toBe(TRAINING.key);
    expect(checkHeld("rod_flimsy", "rod", [TRAINING.key]).ok).toBe(false);
    expect(checkHeld(TRAINING.key, "rod", [TRAINING.key]).ok).toBe(true);
  });
  it("trades in the migration with the same numbers, and landing grants nothing", () => {
    const sql = readFileSync(join(__dirname, "../../supabase/migrations/20261102170000_rod_catches.sql"), "utf8");
    expect(sql).toContain(`k.rod_key = '${TRAINING.quest.rod}'), 0) < ${TRAINING.quest.catches}`);
    expect(sql).toContain(`s.catalogue_ref = '${TRAINING.key}'`);
    const land = sql.slice(sql.indexOf("FUNCTION public.collections_land"), sql.indexOf("FUNCTION public.rod_training_trade"));
    expect(land).not.toContain("member_inventory");
  });
});
