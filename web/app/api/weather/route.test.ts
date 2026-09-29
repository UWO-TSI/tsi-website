import { afterEach, describe, expect, it, vi } from "vitest";
import { weatherAt } from "@/lib/game/islandWeather";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("GET /api/weather", () => {
  it("maps and caches the Open-Meteo forecast", async () => {
    const fetchMock = vi.fn(async (url: string) => url && new Response(JSON.stringify({ hourly: { time: ["2026-09-23T10:00"], weather_code: [73], wind_speed_10m: [4] }, daily: { time: ["2026-09-23"], sunrise: ["2026-09-23T07:13"], sunset: ["2026-09-23T19:20"] } })));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    expect(body).toEqual({ source: "open-meteo", hours: [{ time: "2026-09-23T10:00", state: "snow" }], sun: [{ date: "2026-09-23", sunrise: expect.closeTo(7.217, 2), sunset: expect.closeTo(19.333, 2) }] });
    await GET();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("latitude=42.9849");
    expect(String(fetchMock.mock.calls[0][0])).toContain("daily=sunrise,sunset");
  });
  it("falls back to seeded weather covering the current Toronto hour", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("fallback");
    expect(weatherAt(body)).not.toBeNull();
  });
});
