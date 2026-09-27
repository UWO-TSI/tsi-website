import { describe, expect, it } from "vitest";
import { Color } from "three";
import { ISLAND_LIGHTING, fireflyNight, withWeather } from "./islandLighting";
import { ISLAND_PHASES } from "./islandTime";
import { ISLAND_WEATHERS } from "./islandWeather";

const luma = (hex: string) => { const c = new Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };

describe("island lighting profiles", () => {
  it("defines all four phases with lamps and fireflies only after dark", () => {
    expect(Object.keys(ISLAND_LIGHTING).sort()).toEqual([...ISLAND_PHASES].sort());
    expect(ISLAND_LIGHTING.day.lampsOn).toBe(false);
    expect(ISLAND_LIGHTING.night.fireflies && ISLAND_LIGHTING.evening.fireflies).toBe(true);
    expect(ISLAND_LIGHTING.dawn.fireflies || ISLAND_LIGHTING.day.fireflies).toBe(false);
  });
  it("shows fireflies on every clear night regardless of season (David, 2026-09-24)", () => {
    expect(fireflyNight(ISLAND_LIGHTING.night, "clear")).toBe(true);
    expect(fireflyNight(ISLAND_LIGHTING.night, "wind")).toBe(true);
    expect(fireflyNight(ISLAND_LIGHTING.night, "rain")).toBe(false);
    expect(fireflyNight(ISLAND_LIGHTING.night, "snow")).toBe(false);
    expect(fireflyNight(ISLAND_LIGHTING.day, "clear")).toBe(false);
  });
  it("places dawn between night and day in brightness", () => {
    expect(luma(ISLAND_LIGHTING.dawn.sky)).toBeGreaterThan(luma(ISLAND_LIGHTING.night.sky));
    expect(ISLAND_LIGHTING.dawn.sunIntensity).toBeGreaterThan(ISLAND_LIGHTING.night.sunIntensity);
    expect(ISLAND_LIGHTING.dawn.sunIntensity).toBeLessThan(ISLAND_LIGHTING.day.sunIntensity);
  });
  it("leaves clear weather untouched and never turns night into day", () => {
    for (const phase of ISLAND_PHASES) {
      expect(withWeather(ISLAND_LIGHTING[phase], "clear")).toBe(ISLAND_LIGHTING[phase]);
      for (const weather of ISLAND_WEATHERS) {
        const light = withWeather(ISLAND_LIGHTING[phase], weather);
        expect(light.sunIntensity).toBeLessThanOrEqual(ISLAND_LIGHTING[phase].sunIntensity);
        expect(light.fogFar).toBeGreaterThan(light.fogNear);
      }
    }
    expect(luma(withWeather(ISLAND_LIGHTING.night, "snow").sky)).toBeLessThan(luma(ISLAND_LIGHTING.day.sky) * 0.6);
  });
  it("hides the sun's reflection behind rain, snow and fog cloud, and spreads it wider and dimmer in wind (look spec §7.4)", () => {
    for (const phase of ISLAND_PHASES) {
      for (const weather of ["rain", "snow", "fog"] as const) {
        const { water } = withWeather(ISLAND_LIGHTING[phase], weather);
        expect([water.glare, water.sunGlint], `${phase} ${weather}`).toEqual([0, 0]);
      }
      const calm = ISLAND_LIGHTING[phase].water, windy = withWeather(ISLAND_LIGHTING[phase], "wind").water;
      expect(windy.roughness).toBeCloseTo(calm.roughness * 1.6);
      expect(windy.glare * windy.roughness ** 2).toBeCloseTo(calm.glare * calm.roughness ** 2);
      expect(windy.sunGlint).toBe(calm.sunGlint);
    }
  });
  it("thickens haze for fog more than for rain", () => {
    expect(withWeather(ISLAND_LIGHTING.day, "fog").fogNear).toBeLessThan(withWeather(ISLAND_LIGHTING.day, "rain").fogNear);
  });
});
