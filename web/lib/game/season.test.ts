import { describe, expect, it } from "vitest";
import { parseSeasonOverride, seasonBlend } from "./season";

// Noon Toronto time on a calendar date.
const on = (iso: string) => new Date(`${iso}T16:00:00Z`);
const sum = (weights: Record<string, number>) => Object.values(weights).reduce((a, b) => a + b, 0);

describe("season blend", () => {
  it("is fully one season mid-season", () => {
    expect(seasonBlend(on("2026-07-20"))).toEqual({ season: "summer", weights: { spring: 0, summer: 1, autumn: 0, winter: 0 } });
    expect(seasonBlend(on("2026-01-20")).weights.winter).toBe(1);
    expect(seasonBlend(on("2026-11-05")).weights.autumn).toBe(1);
    expect(seasonBlend(on("2026-04-25")).weights.spring).toBe(1);
  });
  it("crossfades evenly on the boundary day", () => {
    const blend = seasonBlend(on("2026-09-22"));
    expect(blend.weights.summer).toBeCloseTo(0.5, 1);
    expect(blend.weights.autumn).toBeCloseTo(0.5, 1);
  });
  it("spreads each transition over about two weeks", () => {
    expect(seasonBlend(on("2026-09-14")).weights.summer).toBe(1);
    expect(seasonBlend(on("2026-09-17")).weights.autumn).toBeGreaterThan(0);
    expect(seasonBlend(on("2026-09-17")).season).toBe("summer");
    expect(seasonBlend(on("2026-09-27")).season).toBe("autumn");
    expect(seasonBlend(on("2026-09-30")).weights.autumn).toBe(1);
  });
  it("moves monotonically through a transition and always sums to 1", () => {
    let previous = -1;
    for (let d = 10; d <= 30; d++) {
      const blend = seasonBlend(on(`2026-12-${String(d).padStart(2, "0")}`));
      expect(sum(blend.weights)).toBeCloseTo(1, 6);
      expect(blend.weights.winter).toBeGreaterThanOrEqual(previous);
      previous = blend.weights.winter;
    }
  });
  it("wraps winter across the new year and into spring", () => {
    expect(seasonBlend(on("2027-01-01")).weights.winter).toBe(1);
    const march = seasonBlend(on("2027-03-20"));
    expect(march.weights.winter + march.weights.spring).toBeCloseTo(1, 6);
    expect(march.weights.spring).toBeCloseTo(0.5, 1);
  });
  it("uses the Toronto calendar date, not UTC", () => {
    // 01:00 UTC on Sep 30 is still Sep 29 in Toronto.
    expect(seasonBlend(new Date("2026-09-30T01:00:00Z"))).toEqual(seasonBlend(on("2026-09-29")));
  });
  it("accepts a ?season= override for QA", () => {
    expect(parseSeasonOverride("?season=winter")).toEqual({ season: "winter", weights: { spring: 0, summer: 0, autumn: 0, winter: 1 } });
    expect(parseSeasonOverride("?season=fall")?.season).toBe("autumn");
    expect(parseSeasonOverride("?season=monsoon")).toBeNull();
    expect(parseSeasonOverride("")).toBeNull();
    expect(parseSeasonOverride("?season=autumn-winter")).toEqual({ season: "winter", weights: { spring: 0, summer: 0, autumn: 0.5, winter: 0.5 } });
    expect(parseSeasonOverride("?season=autumn-winter:0.25")).toEqual({ season: "autumn", weights: { spring: 0, summer: 0, autumn: 0.75, winter: 0.25 } });
    expect(parseSeasonOverride("?season=autumn-monsoon")).toBeNull();
  });
});
