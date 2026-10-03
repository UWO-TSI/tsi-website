import { describe, expect, it } from "vitest";
import { Color } from "three";
import { interiorLight } from "./interiorLight";
import { ISLAND_LIGHTING, islandLightAt, withWeather } from "./islandLighting";
import { CURRENT } from "./lookPreset";

const warmth = (hex: string) => { const c = new Color(hex); return c.r - c.b; };

describe("indoor light follows the time of day (interiors deliverable 3)", () => {
  it("lets the sun in by day and only a faint cool moon at night, never a sun-coloured key in the dark", () => {
    const day = interiorLight(ISLAND_LIGHTING.day), night = interiorLight(ISLAND_LIGHTING.night);
    expect(day.day).toBe(1);
    expect(night.day).toBe(0);
    expect(day.key.intensity).toBeGreaterThan(0.8);
    expect(night.key.intensity).toBeLessThan(0.15);
    expect(warmth(night.key.color)).toBeLessThan(0);          // the moon's blue
    expect(warmth(day.key.color)).toBeGreaterThan(0);
  });

  it("brings the lamps up as the daylight goes, and warms the fill", () => {
    const [dawn, day, evening, night] = (["dawn", "day", "evening", "night"] as const).map(p => interiorLight(ISLAND_LIGHTING[p]));
    expect(day.lamps).toBeLessThan(dawn.lamps);
    expect(dawn.lamps).toBeLessThan(evening.lamps);
    expect(evening.lamps).toBeLessThan(night.lamps);
    expect(night.lamps).toBe(1);
    expect(warmth(night.ambient.color)).toBeGreaterThan(warmth(day.ambient.color));
    expect(day.day).toBeGreaterThan(dawn.day);
    expect(dawn.day).toBeGreaterThan(evening.day);
  });

  it("eases across nightfall instead of stepping (it reads the blended island light)", () => {
    const at = (t: number) => interiorLight(islandLightAt(CURRENT, { from: "evening", to: "night", t })).day;
    let last = at(0);
    for (let t = 0.1; t <= 1.0001; t += 0.1) {
      const day = at(Math.min(1, t));
      expect(day).toBeLessThanOrEqual(last + 1e-9);
      expect(last - day).toBeLessThan(0.1);
      last = day;
    }
    expect(last).toBe(0);
  });

  it("lets less sun in on a rainy day", () => {
    expect(interiorLight(withWeather(ISLAND_LIGHTING.day, "rain")).key.intensity).toBeLessThan(interiorLight(ISLAND_LIGHTING.day).key.intensity);
  });
});
