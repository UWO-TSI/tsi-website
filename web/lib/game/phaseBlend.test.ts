import { describe, expect, it } from "vitest";
import { PHASE_BLEND_MIN, phaseBlend, phaseForSun } from "./sunTimes";
import { islandLight, islandLightAt, windowLit } from "./islandLighting";
import { CURRENT } from "./lookPreset";
import { Color } from "three";

const SUN = { sunrise: 7.2, sunset: 19.1 };
const lum = (hex: string) => { const c = new Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };

describe("phase light blends", () => {
  it("is the phase alone away from the edges and a smooth blend across each", () => {
    expect(phaseBlend(12, SUN)).toEqual({ from: "day", to: "day", t: 0 });
    expect(phaseBlend(2, SUN)).toEqual({ from: "night", to: "night", t: 0 });
    const at = phaseBlend(SUN.sunrise, SUN);
    expect([at.from, at.to]).toEqual(["dawn", "day"]);
    expect(at.t).toBeCloseTo(0.5, 6);
    // Away from the edge, the phase is the discrete one.
    for (let h = 0; h < 24; h += 0.25) {
      const b = phaseBlend(h, SUN);
      if (b.t === 0 && b.from === b.to) expect(b.from).toBe(phaseForSun(h, SUN));
    }
    expect(phaseBlend(SUN.sunset + 1 - PHASE_BLEND_MIN / 60 + 0.01, SUN).t).toBeGreaterThan(0);
  });

  it("never steps: a minute apart through the whole day, the light moves only a little", () => {
    const light = (h: number) => { const b = phaseBlend(h, SUN); return islandLightAt(CURRENT, b, { azimuth: 200, elevation: 30 }); };
    let prev = light(0);
    for (let m = 1; m < 24 * 60; m++) {
      const next = light(m / 60);
      expect(Math.abs(next.sunIntensity - prev.sunIntensity), `sun at ${m} min`).toBeLessThan(0.15);
      expect(Math.abs(lum(next.sky) - lum(prev.sky)), `sky at ${m} min`).toBeLessThan(0.05);
      expect(Math.abs(next.grade.exposure - prev.grade.exposure)).toBeLessThan(0.02);
      expect(Math.abs(next.windowGlow - prev.windowGlow)).toBeLessThan(0.1);
      prev = next;
    }
  });

  it("matches each phase's own light at either end", () => {
    expect(islandLightAt(CURRENT, { from: "evening", to: "night", t: 0 })).toEqual(islandLight(CURRENT, "evening"));
    expect(islandLightAt(CURRENT, { from: "evening", to: "night", t: 1 })).toEqual(islandLight(CURRENT, "night"));
    const mid = islandLightAt(CURRENT, { from: "evening", to: "night", t: 0.5 });
    expect(mid.sunIntensity).toBeCloseTo((islandLight(CURRENT, "evening").sunIntensity + islandLight(CURRENT, "night").sunIntensity) / 2, 6);
    // The evening rim fades out into the night (which has none).
    expect(mid.rim!.intensity).toBeGreaterThan(0);
    expect(mid.rim!.intensity).toBeLessThan(islandLight(CURRENT, "evening").rim!.intensity);
  });

  it("lights the windows from nothing by day to full at night", () => {
    expect(windowLit(islandLight(CURRENT, "day"))).toBe(0);
    expect(windowLit(islandLight(CURRENT, "night"))).toBe(1);
    expect(windowLit(islandLight(CURRENT, "evening"))).toBeGreaterThan(0.5);
  });
});
