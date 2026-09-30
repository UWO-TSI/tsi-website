import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2026-09-24T16:00:00Z");
const at = (min: number) => new Date(NOW.getTime() + min * 60_000);

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("server island weather", () => {
  it("caches the fallback while Open-Meteo is down, so catches don't each wait on the timeout", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("down"));
    vi.stubGlobal("fetch", fetch);
    const { weatherReport } = await import("./weather");
    expect((await weatherReport(NOW)).source).toBe("fallback");
    expect((await weatherReport(at(1))).source).toBe("fallback");
    expect((await weatherReport(at(4))).source).toBe("fallback");
    expect(fetch).toHaveBeenCalledTimes(1);
    // Retries once the short fallback window passes.
    await weatherReport(at(6));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("caches a real forecast for 30 minutes", async () => {
    const body = { hourly: { time: ["2026-09-24T12:00"], weather_code: [61], wind_speed_10m: [5] } };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
    vi.stubGlobal("fetch", fetch);
    const { islandWeatherNow } = await import("./weather");
    expect(await islandWeatherNow(NOW)).toBe("rain");
    expect(await islandWeatherNow(at(29))).toBe("rain");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
