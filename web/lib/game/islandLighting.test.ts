import { describe, expect, it } from "vitest";
import { Color } from "three";
import { ISLAND_LIGHTING, fireflyNight, weatherLight, withWeather } from "./islandLighting";
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
  // Audit 2026-10 world item 16: the water is unlit, so its foam is only as dim as its phase colour. It sits as far
  // above the lit shallows at dusk and night as it does by day, never glowing round a dark river.
  it("keeps the foam as far above the shallow water at every phase as by day", () => {
    const lumaHex = (hex: number) => luma(`#${hex.toString(16).padStart(6, "0")}`);
    const ratio = (phase: (typeof ISLAND_PHASES)[number]) => lumaHex(ISLAND_LIGHTING[phase].water.foamColor) / lumaHex(ISLAND_LIGHTING[phase].water.shallowColor);
    for (const phase of ISLAND_PHASES) expect(ratio(phase), phase).toBeLessThanOrEqual(ratio("day") * 1.08);
    expect(lumaHex(ISLAND_LIGHTING.evening.water.foamColor)).toBeLessThan(lumaHex(ISLAND_LIGHTING.day.water.foamColor));
    expect(lumaHex(ISLAND_LIGHTING.night.water.foamColor)).toBeLessThan(lumaHex(ISLAND_LIGHTING.evening.water.foamColor));
  });

  // Audit 2026-10 world item 10 (approved 2026-10-07): rain under an overcast sky, a softened sun and shadows and a
  // wet sheen, eased with the weather; snow a lighter overcast.
  describe("overcast rain and snow", () => {
    const sat = (hex: string) => { const hsl = { h: 0, s: 0, l: 0 }; new Color(hex).getHSL(hsl); return hsl.s; };
    const settled = (w: (typeof ISLAND_WEATHERS)[number]) => ({ from: w, to: w, t: 1 });
    it("settles on the new weather once eased in, and wets the ground only in rain", () => {
      for (const phase of ISLAND_PHASES) for (const w of ISLAND_WEATHERS) {
        const light = ISLAND_LIGHTING[phase], now = weatherLight(light, settled(w));
        expect(weatherLight(light, { from: "clear", to: w, t: 1 })).toEqual(now);
        expect(weatherLight(light, { from: w, to: w, t: 0.4 })).toEqual(now);
        expect(now.wet, `${phase} ${w}`).toBe(w === "rain" ? 1 : 0);
      }
    });
    it("greys the sky, softens the sun and its shadows and wets the ground in rain", () => {
      const clear = ISLAND_LIGHTING.day, fog = withWeather(clear, "fog"), rain = weatherLight(clear, settled("rain"));
      expect(sat(rain.sky)).toBeLessThan(sat(clear.sky) * 0.35);
      expect(sat(rain.sky)).toBeLessThan(sat(fog.sky));
      expect(rain.water.deepColor).not.toBe(clear.water.deepColor);
      expect(rain.sunIntensity).toBeLessThanOrEqual(clear.sunIntensity * 0.3);
      expect(rain.shadow.intensity).toBeLessThanOrEqual(clear.shadow.intensity * 0.2);
      expect(rain.wet).toBe(1);
      expect(weatherLight(clear, settled("clear")).wet).toBe(0);
    });
    it("makes snow a lighter overcast, dry", () => {
      const clear = ISLAND_LIGHTING.day, rain = weatherLight(clear, settled("rain")), snow = weatherLight(clear, settled("snow"));
      expect(snow.sunIntensity).toBeGreaterThan(rain.sunIntensity);
      expect(snow.shadow.intensity).toBeGreaterThan(rain.shadow.intensity);
      expect(snow.shadow.intensity).toBeLessThan(clear.shadow.intensity);
      expect(snow.wet).toBe(0);
    });
    it("eases across a change of weather", () => {
      const clear = ISLAND_LIGHTING.day, a = weatherLight(clear, settled("clear")), b = weatherLight(clear, settled("rain"));
      const mid = weatherLight(clear, { from: "clear", to: "rain", t: 0.5 });
      expect(mid.wet).toBeCloseTo(0.5, 5);
      expect(mid.sunIntensity).toBeCloseTo((a.sunIntensity + b.sunIntensity) / 2, 5);
      expect(mid.shadow.intensity).toBeCloseTo((a.shadow.intensity + b.shadow.intensity) / 2, 5);
      expect(luma(mid.sky)).toBeLessThan(luma(a.sky));
      expect(weatherLight(clear, { from: "clear", to: "rain", t: 0 })).toEqual(a);
    });
    it("never turns night into day", () => {
      for (const w of ISLAND_WEATHERS) expect(luma(weatherLight(ISLAND_LIGHTING.night, settled(w)).sky)).toBeLessThan(luma(ISLAND_LIGHTING.day.sky));
    });
  });
});
