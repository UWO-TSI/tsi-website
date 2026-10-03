import { describe, expect, it } from "vitest";
import { fetchEvents, visibleRange } from "./calendar";

const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) => new Date(y, m, d, h, min, s, ms).toISOString();

describe("the calendar's range and fetch (#23)", () => {
  it("fetches the week on screen, even when it runs into another month", () => {
    // Thu Oct 1 2026: its week starts Sun Sep 27.
    expect(visibleRange("week", 2026, 9, new Date(2026, 9, 1, 15))).toEqual({ from: local(2026, 8, 27), to: local(2026, 9, 3, 23, 59, 59, 999) });
    // Next week (Oct 8): Oct 4 to Oct 10, a different range, so the page fetches again.
    expect(visibleRange("week", 2026, 9, new Date(2026, 9, 8))).toEqual({ from: local(2026, 9, 4), to: local(2026, 9, 10, 23, 59, 59, 999) });
  });
  it("fetches the whole month in the month and list views", () => {
    const october = { from: local(2026, 9, 1), to: local(2026, 9, 31, 23, 59, 59, 999) };
    expect(visibleRange("month", 2026, 9, new Date(2026, 9, 8))).toEqual(october);
    expect(visibleRange("list", 2026, 9, new Date(2026, 8, 1))).toEqual(october);
  });
  it("maps event_type, and a failed fetch throws instead of looking like an empty month", async () => {
    const ok = (async () => new Response(JSON.stringify({ events: [{ id: "e1", title: "Workshop", event_type: "workshop", start_time: "2026-10-08T22:00:00Z" }] }))) as unknown as typeof fetch;
    expect((await fetchEvents({ from: "a", to: "b" }, ok)).map((e) => [e.id, e.type])).toEqual([["e1", "workshop"]]);
    const down = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    await expect(fetchEvents({ from: "a", to: "b" }, down)).rejects.toThrow();
    const offline = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    await expect(fetchEvents({ from: "a", to: "b" }, offline)).rejects.toThrow();
  });
});
