import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MASTERY_EQUIP, masteryCosmetics, masteryForXp, masteryProgress, masteryTitle, masteryToNext, xpForMastery } from "./mastery";

describe("mastery curve (design sheet §1.4)", () => {
  it("costs 800 + 300·(M − 1) a level and 66,500 to reach 20", () => {
    expect([masteryToNext(1), masteryToNext(2), masteryToNext(19)]).toEqual([800, 1100, 6200]);
    expect(xpForMastery(20)).toBe(66_500);
  });
  it("hits the sheet's checkpoints", () => {
    const at = { 2: 800, 4: 3300, 6: 7000, 8: 11900, 10: 18000, 12: 25300, 15: 38500, 18: 54400, 20: 66500 };
    for (const [m, xp] of Object.entries(at)) {
      expect(xpForMastery(Number(m)), `M${m}`).toBe(xp);
      expect(masteryForXp(xp)).toBe(Number(m));
      expect(masteryForXp(xp - 1)).toBe(Number(m) - 1);
    }
    expect(masteryForXp(0)).toBe(1);
    expect(masteryForXp(10_000_000)).toBe(20);
  });
  it("reports progress into a level, and none past 20", () => {
    expect(masteryProgress(1000)).toEqual({ mastery: 2, xp: 1000, into: 200, needed: 1100 });
    expect(masteryProgress(70_000)).toMatchObject({ mastery: 20, needed: 0 });
  });
  it("matches combat_mastery_for_xp in 20261002181044_classes_v2.sql", () => {
    const sql = readFileSync(join(__dirname, "../../supabase/migrations/20261002181044_classes_v2.sql"), "utf8");
    expect(sql).toContain("need := need + 800 + 300 * (m - 1);");
    expect(sql).toContain("WHILE m < 20 LOOP");
    // the smoke asserts (799) = 1, (800) = 2, (3299) = 3, (3300) = 4, (66499) = 19, (66500) = 20
    expect([799, 800, 3299, 3300, 66499, 66500].map(masteryForXp)).toEqual([1, 2, 3, 4, 19, 20]);
    for (const [value, { at }] of Object.entries(MASTERY_EQUIP)) expect(sql).toMatch(new RegExp(`'\\w+/${value}' THEN ${at}`));
  });
});

describe("derived mastery cosmetics and titles", () => {
  it("frames at 5, 15, 20; aura tiers at 10 and 20; trim 13, colour 17, glow 19", () => {
    expect(masteryCosmetics(4)).toMatchObject({ frame: null, aura: 1, trim: false });
    expect(masteryCosmetics(5).frame).toBe("bronze");
    expect(masteryCosmetics(10)).toMatchObject({ frame: "bronze", aura: 2 });
    expect(masteryCosmetics(13)).toMatchObject({ trim: true, trimGlow: false, colour: false });
    expect(masteryCosmetics(17)).toMatchObject({ frame: "silver", colour: true });
    expect(masteryCosmetics(20)).toMatchObject({ frame: "gold", aura: 3, trimGlow: true, mastered: true });
  });
  it("titles the subclass Adept at 10 and Master at 20", () => {
    expect([1, 9, 10, 19, 20].map(m => masteryTitle("Elementalist", m))).toEqual(["Elementalist", "Elementalist", "Adept Elementalist", "Adept Elementalist", "Master Elementalist"]);
  });
});
