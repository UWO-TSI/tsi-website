import { describe, expect, it } from "vitest";
import { fallbackWeather, parseOpenMeteo, parseWeatherBlendOverride, parseWeatherOverride, torontoHourKey, weatherAt, weatherBlendAt, weatherFromCode, WEATHER_EASE_MIN } from "./islandWeather";

describe("weather code mapping", () => {
  it("maps WMO codes to island states", () => {
    for (const code of [0, 1, 2, 3]) expect(weatherFromCode(code)).toBe("clear");
    for (const code of [45, 48]) expect(weatherFromCode(code)).toBe("fog");
    for (const code of [51, 55, 56, 61, 65, 66, 67, 80, 82, 95, 96, 99]) expect(weatherFromCode(code)).toBe("rain");
    for (const code of [71, 73, 75, 77, 85, 86]) expect(weatherFromCode(code)).toBe("snow");
  });
  it("reports wind only when nothing falls from the sky", () => {
    expect(weatherFromCode(2, 35)).toBe("wind");
    expect(weatherFromCode(2, 29)).toBe("clear");
    expect(weatherFromCode(61, 50)).toBe("rain");
    expect(weatherFromCode(45, 50)).toBe("fog");
  });
});

describe("forecast parsing", () => {
  it("maps each hour and rejects malformed bodies", () => {
    const hours = parseOpenMeteo({ hourly: { time: ["2026-09-23T10:00", "2026-09-23T11:00"], weather_code: [61, 3], wind_speed_10m: [5, 40] } });
    expect(hours).toEqual([{ time: "2026-09-23T10:00", state: "rain" }, { time: "2026-09-23T11:00", state: "wind" }]);
    expect(() => parseOpenMeteo({})).toThrow();
    expect(() => parseOpenMeteo(null)).toThrow();
  });
  it("finds the current Toronto hour", () => {
    const now = new Date("2026-09-23T14:20:00Z"); // 10:20 EDT
    expect(torontoHourKey(now)).toBe("2026-09-23T10:00");
    expect(weatherAt({ source: "open-meteo", hours: [{ time: "2026-09-23T10:00", state: "fog" }] }, now)).toBe("fog");
    expect(weatherAt({ source: "open-meteo", hours: [] }, now)).toBeNull();
  });
});

describe("fallback and overrides", () => {
  it("is deterministic and turns winter rain into snow", () => {
    const day = new Date(2026, 6, 1);
    expect(fallbackWeather(day, "summer")).toBe(fallbackWeather(day, "summer"));
    for (let d = 1; d <= 60; d++) {
      const date = new Date(2026, 0, d);
      expect(fallbackWeather(date, "winter")).not.toBe("rain");
      expect(["clear", "rain"]).toContain(fallbackWeather(date, "summer"));
    }
  });
  it("reads ?weather= and the legacy ?rain flag", () => {
    expect(parseWeatherOverride("?weather=snow")).toBe("snow");
    expect(parseWeatherOverride("?rain=1")).toBe("rain");
    expect(parseWeatherOverride("?weather=hail")).toBeNull();
    expect(parseWeatherOverride("")).toBeNull();
  });
});

// Audit 2026-10 world item 10: a change of weather eases in over the first minutes of its hour, the same for everyone
// (a function of the shared forecast and the world clock).
describe("weather transitions", () => {
  const report = { source: "open-meteo" as const, hours: [{ time: "2026-09-23T10:00", state: "clear" as const }, { time: "2026-09-23T11:00", state: "rain" as const }] };
  it("eases from the last hour's weather over the first minutes of the hour", () => {
    expect(weatherBlendAt(report, new Date("2026-09-23T15:00:00Z"))).toEqual({ from: "clear", to: "rain", t: 0 });
    const mid = weatherBlendAt(report, new Date(Date.UTC(2026, 8, 23, 15, WEATHER_EASE_MIN / 2)))!;
    expect(mid.from).toBe("clear");
    expect(mid.t).toBeCloseTo(0.5, 5);
    expect(weatherBlendAt(report, new Date(Date.UTC(2026, 8, 23, 15, WEATHER_EASE_MIN)))).toEqual({ from: "rain", to: "rain", t: 1 });
    expect(weatherBlendAt(report, new Date("2026-09-23T14:30:00Z"))).toEqual({ from: "clear", to: "clear", t: 1 });
    expect(weatherBlendAt(report, new Date("2026-09-23T20:00:00Z"))).toBeNull();
  });
  it("reads ?weather=clear-rain:0.3 as a transition caught part way", () => {
    expect(parseWeatherBlendOverride("?weather=clear-rain:0.3")).toEqual({ from: "clear", to: "rain", t: 0.3 });
    expect(parseWeatherBlendOverride("?weather=clear-rain")).toEqual({ from: "clear", to: "rain", t: 0.5 });
    expect(parseWeatherBlendOverride("?weather=rain")).toEqual({ from: "rain", to: "rain", t: 1 });
    expect(parseWeatherBlendOverride("?weather=clear-hail:0.3")).toBeNull();
    expect(parseWeatherBlendOverride("")).toBeNull();
    expect(parseWeatherOverride("?weather=clear-rain:0.3")).toBe("rain");
  });
});
