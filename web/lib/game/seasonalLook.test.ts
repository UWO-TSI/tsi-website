import { describe, expect, it } from "vitest";
import { Color } from "three";
import { DEFAULT_PALETTES } from "@/data/content-defaults";
import { leanHue, paletteBySeason, seasonLook, SEASON_TREES, SEASON_FLOWERS, SEASON_BUSHES } from "./seasonalLook";
import { seasonBlend } from "./season";

const palettes = paletteBySeason(DEFAULT_PALETTES);
const hue = (hex: string) => { const hsl = { h: 0, s: 0, l: 0 }; new Color(hex).getHSL(hsl); return hsl.h * 360; };
const on = (iso: string) => seasonBlend(new Date(`${iso}T16:00:00Z`));

describe("seasonal look", () => {
  it("ships an island tint for every season row", () => {
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      expect(palettes[season]?.island_grass, season).toMatch(/^#[0-9A-F]{6}$/i);
      expect(palettes[season]?.leaf, season).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
  it("keeps summer on the calibrated applicant baseline and turns autumn orange", () => {
    expect(seasonLook(on("2026-07-20"), palettes).grass).toBe("#91b47f");
    const autumn = seasonLook(on("2026-10-25"), palettes);
    expect(hue(autumn.leaf)).toBeGreaterThan(10);
    expect(hue(autumn.leaf)).toBeLessThan(40);
    expect(hue(autumn.grass)).toBeLessThan(45);
    expect(autumn.snow).toBe(0);
  });
  it("blends tints through a transition and covers the ground only in winter", () => {
    const mid = seasonLook(on("2026-09-22"), palettes);
    expect(hue(mid.leaf)).toBeGreaterThan(hue(seasonLook(on("2026-10-25"), palettes).leaf));
    expect(hue(mid.leaf)).toBeLessThan(hue(seasonLook(on("2026-07-20"), palettes).leaf));
    expect(seasonLook(on("2027-01-15"), palettes).snow).toBe(1);
    expect(seasonLook(on("2026-12-21"), palettes).snow).toBeCloseTo(0.5, 1);
  });
  it("swaps to blossom oaks in spring and snow trees in winter", () => {
    expect(SEASON_TREES.spring.slice(0, 3).every(url => url.includes("tree-blossom"))).toBe(true);
    expect(SEASON_TREES.summer.some(url => url.includes("blossom"))).toBe(false);
    expect(SEASON_TREES.winter.every(url => url.includes("snow"))).toBe(true);
    expect(SEASON_FLOWERS.winter).toEqual([]);
    expect(SEASON_BUSHES.winter.every(url => url.includes("snow"))).toBe(true);
  });
  it("leans a sky hue without changing its lightness", () => {
    const night = "#344963";
    const leaned = leanHue(night, "#F5A9C4", 1);
    const a = { h: 0, s: 0, l: 0 }, b = { h: 0, s: 0, l: 0 };
    new Color(night).getHSL(a); new Color(leaned).getHSL(b);
    expect(b.l).toBeCloseTo(a.l, 2);
    expect(leanHue(night, "#F5A9C4", 0)).toBe(night);
  });
});
