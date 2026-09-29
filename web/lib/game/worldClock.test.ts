import { afterEach, describe, expect, it } from "vitest";
import { setWorldClockOffset, worldNow, worldTime, worldTimeAt } from "./worldClock";

describe("world clock", () => {
  afterEach(() => setWorldClockOffset(0));

  it("is seconds since 08:00 UTC (04:00 EDT / 03:00 EST)", () => {
    expect(worldTimeAt(Date.UTC(2026, 8, 27, 8, 0, 0))).toBe(0);
    expect(worldTimeAt(Date.UTC(2026, 8, 27, 8, 0, 1, 500))).toBe(1.5);
    expect(worldTimeAt(Date.UTC(2026, 8, 27, 7, 59, 59, 500))).toBe(86_399.5);
    expect(worldTimeAt(Date.UTC(2026, 0, 15, 20, 30))).toBe(12.5 * 3600);
  });

  it("wraps once a day and stays in float32-safe range", () => {
    const a = Date.UTC(2026, 8, 27, 14, 3, 7, 250);
    expect(worldTimeAt(a + 86_400_000)).toBe(worldTimeAt(a));
    for (let h = 0; h < 48; h += 0.37) {
      const t = worldTimeAt(a + h * 3_600_000);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(2 ** 17);
      expect(Math.fround(t) - t).toBeLessThan(2 ** -7);
    }
  });

  it("follows the wall clock, plus the server offset", () => {
    // Distance on the daily circle, so a run at exactly 08:00 UTC is not flaky.
    const gap = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, 86_400 - d); };
    expect(gap(worldTime(), worldTimeAt(Date.now()))).toBeLessThan(0.3);
    setWorldClockOffset(90_000);
    expect(gap(worldTime(), worldTimeAt(Date.now() + 90_000))).toBeLessThan(0.3);
  });

  it("gives the calendar instant on the same clock, offset included", () => {
    expect(Math.abs(worldNow() - Date.now())).toBeLessThan(300);
    setWorldClockOffset(-3_600_000);
    expect(Math.abs(worldNow() - (Date.now() - 3_600_000))).toBeLessThan(300);
    expect(worldTime()).toBeCloseTo(worldTimeAt(worldNow()), 0);
  });
});
