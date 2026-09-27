import { describe, expect, it } from "vitest";
import { phaseInstant, solarPosition, SUN_STEP_MS } from "./sunPath";
import { islandPhase } from "./islandTime";

const at = (iso: string) => solarPosition(new Date(iso));

describe("sun over London, ON (row 239)", () => {
  it("matches NOAA-style reference positions to about a degree", () => {
    for (const [iso, azimuth, elevation] of [
      ["2026-09-27T11:00:00-04:00", 136, 36], ["2026-09-27T15:00:00-04:00", 215, 39], ["2026-09-27T18:00:00-04:00", 255, 12],
      ["2026-06-21T17:00:00-04:00", 264, 42], ["2026-12-21T12:00:00-05:00", 174, 23],
    ] as const) {
      const sun = at(iso);
      expect(Math.abs(sun.azimuth - azimuth), iso).toBeLessThan(1);
      expect(Math.abs(sun.elevation - elevation), iso).toBeLessThan(1);
    }
  });
  it("peaks due south at solar noon and is below the horizon at night", () => {
    const noon = at("2026-06-21T17:27:00Z"); // 81.25° W: solar noon about 13:27 EDT
    expect(Math.abs(noon.azimuth - 180)).toBeLessThan(1);
    expect(noon.elevation).toBeCloseTo(90 - 42.98 + 23.44, 0);
    expect(at("2026-09-27T23:00:00-04:00").elevation).toBeLessThan(-30);
  });
  it("moves about half a degree across the sky per light step", () => {
    const rad = Math.PI / 180, dir = (s: { elevation: number; azimuth: number }) =>
      [Math.cos(s.elevation * rad) * Math.sin(s.azimuth * rad), Math.sin(s.elevation * rad), Math.cos(s.elevation * rad) * Math.cos(s.azimuth * rad)];
    const t = new Date("2026-09-27T15:00:00-04:00").getTime(), a = dir(solarPosition(new Date(t))), b = dir(solarPosition(new Date(t + SUN_STEP_MS)));
    const step = Math.acos(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / rad;
    expect(step).toBeGreaterThan(0.4);
    expect(step).toBeLessThan(0.6);
  });
  it("previews each phase at a time inside it: mid-dawn, 11:45, half an hour before sunset, late night", () => {
    const day = new Date("2026-09-27T16:00:00Z"), days = [{ date: "2026-09-27", sunrise: 7.28, sunset: 19.23 }];
    for (const phase of ["dawn", "day", "evening", "night"] as const) expect(islandPhase(phaseInstant(phase, day, days), days)).toBe(phase);
    expect(phaseInstant("day", day, days).toISOString()).toBe("2026-09-27T15:45:00.000Z");
    expect(phaseInstant("evening", day, days).toISOString()).toBe("2026-09-27T22:44:00.000Z");
  });
});
