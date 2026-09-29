import { describe, expect, it } from "vitest";
import { SUN_FALLBACK, localIsoHour, parseSunDaily, phaseForSun, sunFor } from "./sunTimes";

describe("sunrise/sunset phases", () => {
  const sun = { sunrise: 7, sunset: 19 };
  it("maps the hour before sunrise to dawn and sunset ±1 h to evening", () => {
    expect(phaseForSun(5.99, sun)).toBe("night");
    expect(phaseForSun(6, sun)).toBe("dawn");
    expect(phaseForSun(7, sun)).toBe("day");
    expect(phaseForSun(17.99, sun)).toBe("day");
    expect(phaseForSun(18, sun)).toBe("evening");
    expect(phaseForSun(19.99, sun)).toBe("evening");
    expect(phaseForSun(20, sun)).toBe("night");
    expect(phaseForSun(-1, sun)).toBe("night");
  });
  it("parses Open-Meteo daily fields and rejects malformed bodies", () => {
    expect(localIsoHour("2026-09-24T07:15")).toBeCloseTo(7.25);
    expect(parseSunDaily({ daily: { time: ["2026-09-24"], sunrise: ["2026-09-24T07:14"], sunset: ["2026-09-24T19:18"] } }))
      .toEqual([{ date: "2026-09-24", sunrise: expect.closeTo(7.233, 2), sunset: 19.3 }]);
    expect(() => parseSunDaily({ daily: { time: ["x"] } })).toThrow();
    expect(() => parseSunDaily({ daily: { time: ["2026-09-24"], sunrise: ["bad"], sunset: ["bad"] } })).toThrow();
  });
  it("prefers the forecast day and falls back to the monthly table", () => {
    const at = new Date("2026-09-24T16:00:00Z");
    expect(sunFor(at, [{ date: "2026-09-24", sunrise: 7.2, sunset: 19.3 }])).toEqual({ sunrise: 7.2, sunset: 19.3, source: "open-meteo" });
    expect(sunFor(at, [{ date: "2026-09-23", sunrise: 7.2, sunset: 19.3 }])).toEqual({ ...SUN_FALLBACK[8], source: "fallback" });
    expect(sunFor(at)).toEqual({ ...SUN_FALLBACK[8], source: "fallback" });
    // Toronto date, not UTC: 02:00 UTC on Oct 1 is still Sep 30 locally.
    expect(sunFor(new Date("2026-10-01T02:00:00Z")).sunrise).toBe(SUN_FALLBACK[8].sunrise);
  });
  it("keeps the fallback table physically sensible for London, Ontario", () => {
    expect(SUN_FALLBACK).toHaveLength(12);
    for (const { sunrise, sunset } of SUN_FALLBACK) {
      expect(sunrise).toBeGreaterThan(5.5); expect(sunrise).toBeLessThan(8);
      expect(sunset).toBeGreaterThan(16.5); expect(sunset).toBeLessThan(21.2);
    }
    expect(SUN_FALLBACK[5].sunset - SUN_FALLBACK[5].sunrise).toBeGreaterThan(SUN_FALLBACK[11].sunset - SUN_FALLBACK[11].sunrise + 5);
  });
});
