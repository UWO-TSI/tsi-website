import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PRESENCE, fetchServerPresence, parseServerPresence, presenceAge, upcomingTime } from "./serverPresence";
const now = Date.parse("2026-09-07T12:00:00Z");
const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

afterEach(() => vi.useRealTimers());

describe("member presence responses", () => {
  it.each([null, {}, { ...EMPTY_PRESENCE, online: {} }])("rejects a broken payload instead of presenting an empty village: %s", (value) => {
    expect(() => parseServerPresence(value)).toThrow("Invalid presence response");
  });
  it("filters invalid rows and duplicate members across recent and active lists", () => {
    const data = parseServerPresence({ ...EMPTY_PRESENCE,
      online: [{ user_id: "a", recorded_at: at(-2), display_name: {}, level: Infinity, class: {}, tier: -3 }, { user_id: "bad", recorded_at: "broken" }],
      recent: [{ user_id: "a", recorded_at: at(-20) }, { user_id: "b", recorded_at: at(-25), display_name: "Bea", level: 3 }],
      npcs: [null, { id: "n", display_name: "Mayor", spawn_zone: {} }],
      events: [{ id: "e", title: "Meetup", start_time: at(30), location: {} }, { id: "bad", title: {}, start_time: at(10) }],
    });
    expect(data.online).toEqual([{ user_id: "a", recorded_at: at(-2), display_name: "Visitor", level: 1, class: null, tier: 5 }]);
    expect(data.recent.map(p => p.user_id)).toEqual(["b"]);
    expect(data.npcs).toEqual([{ id: "n", display_name: "Mayor", spawn_zone: "Village", is_permanent: false }]);
    expect(data.events).toEqual([{ id: "e", title: "Meetup", start_time: at(30), location: null }]);
  });
  it("accepts a legitimate empty response", () => expect(parseServerPresence(EMPTY_PRESENCE)).toEqual(EMPTY_PRESENCE));
  it.each([401, 503, 500])("exposes HTTP %s to the view", async (status) => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status });
    await expect(fetchServerPresence(fetcher)).rejects.toMatchObject({ status });
  });
  it("passes a bounded AbortSignal and parses a successful response", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => EMPTY_PRESENCE });
    await expect(fetchServerPresence(fetcher)).resolves.toEqual(EMPTY_PRESENCE);
    expect(fetcher).toHaveBeenCalledWith("/api/server/online", { signal: expect.any(AbortSignal) });
  });
  it("bounds a stalled presence request", async () => {
    vi.useFakeTimers(); const fetcher = vi.fn().mockReturnValue(new Promise(() => {}));
    const result = expect(fetchServerPresence(fetcher)).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(15_000); await result;
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

describe("presence and event time labels", () => {
  it("handles minutes, hours, old activity, future clock skew and invalid timestamps", () => {
    expect(presenceAge(at(1), now)).toBe("just now"); expect(presenceAge(at(-2), now)).toBe("2m ago");
    expect(presenceAge(at(-90), now)).toBe("1h ago"); expect(presenceAge(at(-1440), now)).toBe("1d+ ago");
    expect(presenceAge("bad", now)).toBe("Time unavailable");
  });
  it("does not describe already-started events as upcoming", () => {
    expect(upcomingTime(at(-2), now)).toBe("started"); expect(upcomingTime(at(3), now)).toBe("starting soon");
    expect(upcomingTime(at(5.1), now)).toBe("in 6m"); expect(upcomingTime("bad", now)).toBe("Time unavailable");
  });
});
