import { describe, expect, it } from "vitest";
import { islandPhase, parseClockOverride, parseTimeOverride, torontoHour } from "./islandTime";
import { phaseForSun, sunFor } from "./sunTimes";
import { torontoInstant } from "@/lib/time";

const phaseForHour = (hour: number, date: Date, days: typeof DAYS) => phaseForSun(hour, sunFor(date, days));

const SEPT = new Date("2026-09-24T16:00:00Z");
const DAYS = [{ date: "2026-09-24", sunrise: 7.23, sunset: 19.3 }];

describe("island clock", () => {
  it("reads Toronto wall time, including daylight saving", () => {
    expect(torontoHour(new Date("2026-07-01T16:30:00Z"))).toBeCloseTo(12.5);
    expect(torontoHour(new Date("2026-01-15T17:00:00Z"))).toBeCloseTo(12);
  });
  it("uses the forecast's sunrise and sunset for the day", () => {
    expect(phaseForHour(6.1, SEPT, DAYS)).toBe("night");
    expect(phaseForHour(6.5, SEPT, DAYS)).toBe("dawn");
    expect(phaseForHour(7.3, SEPT, DAYS)).toBe("day");
    expect(phaseForHour(18.2, SEPT, DAYS)).toBe("day");
    expect(phaseForHour(18.4, SEPT, DAYS)).toBe("evening");
    expect(phaseForHour(20.2, SEPT, DAYS)).toBe("evening");
    expect(phaseForHour(20.4, SEPT, DAYS)).toBe("night");
  });
  it("follows the season: a June 21:00 is still evening, a December 18:00 is night", () => {
    expect(islandPhase(new Date("2026-06-16T01:00:00Z"))).toBe("evening"); // 21:00 EDT
    expect(islandPhase(new Date("2026-12-15T22:30:00Z"))).toBe("evening"); // 17:30 EST, sunset ~16:51
    expect(islandPhase(new Date("2026-12-15T23:00:00Z"))).toBe("night"); // 18:00 EST
    expect(islandPhase(new Date("2026-12-15T12:00:00Z"))).toBe("dawn"); // 07:00 EST, sunrise ~07:49
    expect(islandPhase(new Date("2026-06-15T10:00:00Z"))).toBe("day"); // 06:00 EDT, sunrise ~05:45
  });
  it("accepts phase names as a forced time", () => {
    expect(parseTimeOverride("dawn")).toBe("dawn");
    expect(parseTimeOverride("noon")).toBeNull();
    expect(parseTimeOverride("25")).toBeNull();
    expect(parseTimeOverride(null)).toBeNull();
  });
  it("turns a Toronto wall clock into the instant, in daylight and standard time", () => {
    expect(torontoInstant("2026-09-27", 11.75).toISOString()).toBe("2026-09-27T15:45:00.000Z");
    expect(torontoInstant("2026-12-21", 17).toISOString()).toBe("2026-12-21T22:00:00.000Z");
  });
  it("reads ?at=HH:MM with an optional date, beside the ?at=x,z spawn point", () => {
    const q = (s: string) => parseClockOverride(new URLSearchParams(s), SEPT)?.toISOString() ?? null;
    expect(q("at=17:00")).toBe("2026-09-24T21:00:00.000Z");
    expect(q("at=0,-1&at=17:00&date=2026-06-21")).toBe("2026-06-21T21:00:00.000Z");
    expect(q("at=17:00&date=2026-12-21")).toBe("2026-12-21T22:00:00.000Z");
    expect(q("at=0,-1")).toBeNull();
    expect(q("at=25:00")).toBeNull();
    expect(q("")).toBeNull();
  });
});
