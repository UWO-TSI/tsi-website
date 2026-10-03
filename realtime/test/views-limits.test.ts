// Interest management (§4.4) and rate limits (§4.6) as pure functions.
import { describe, expect, it } from "vitest";
import { limiter, limiters } from "../src/rooms/limits";
import { planViews, sees, type Seen, type ViewRules } from "../src/rooms/views";

const VILLAGE = 0, CAFE = 1, RUINS = 5;
const rules: ViewRules = { hidden: (a) => a === RUINS, ranged: (a) => a === VILLAGE, radiusIn: 50, radiusOut: 60 };
const P = (key: string, area: number, x = 0, z = 0): Seen => ({ key, area, x, z });

describe("views", () => {
  it("same area sees each other; other areas and yourself don't", () => {
    expect(sees(P("a", VILLAGE), P("b", VILLAGE, 3, 4), false, rules)).toBe(true);
    expect(sees(P("a", VILLAGE), P("b", CAFE), false, rules)).toBe(false);
    expect(sees(P("a", VILLAGE), P("a", VILLAGE), false, rules)).toBe(false);
  });

  it("private areas are hidden and blind", () => {
    expect(sees(P("a", RUINS), P("b", RUINS), false, rules)).toBe(false);
    expect(sees(P("a", VILLAGE), P("b", RUINS), false, rules)).toBe(false);
  });

  it("the village uses 50 u in, 60 u out; interiors see everyone", () => {
    expect(sees(P("a", VILLAGE), P("b", VILLAGE, 55, 0), false, rules)).toBe(false);
    expect(sees(P("a", VILLAGE), P("b", VILLAGE, 55, 0), true, rules)).toBe(true);
    expect(sees(P("a", VILLAGE), P("b", VILLAGE, 61, 0), true, rules)).toBe(false);
    expect(sees(P("a", CAFE), P("b", CAFE, 200, 200), false, rules)).toBe(true);
  });

  it("plans the adds and removes, including players who left", () => {
    const players = [P("a", VILLAGE), P("b", VILLAGE, 10, 0), P("c", CAFE)];
    const current = new Map([["a", new Set(["c", "gone"])], ["c", new Set<string>()]]);
    const plan = planViews(players, current, rules);
    expect(plan).toEqual([
      { viewer: "a", add: ["b"], remove: ["c", "gone"] },
      { viewer: "b", add: ["a"], remove: [] },
    ]);
  });
});

describe("rate limits", () => {
  it("a bucket allows its burst, then its rate", () => {
    const l = limiter({ perSecond: 20, burst: 30 });
    let ok = 0;
    for (let i = 0; i < 40; i++) if (l.take(1000)) ok++;
    expect(ok).toBe(30);
    expect(l.take(1049)).toBe(false); // 20/s: one token per 50 ms
    expect(l.take(1050)).toBe(true);
    expect(l.take(1051)).toBe(false);
  });

  it("a per-minute cap holds on top of the bucket", () => {
    const l = limiter({ perSecond: 1, perMinute: 20 });
    let ok = 0;
    for (let s = 0; s < 60; s++) if (l.take(s * 1000)) ok++;
    expect(ok).toBe(20);
    expect(l.take(60_000)).toBe(true); // the first one slid out of the window
  });

  it("one in ten seconds", () => {
    const l = limiter({ perSecond: 0.1, burst: 1 });
    expect(l.take(0)).toBe(true);
    expect(l.take(9_999)).toBe(false);
    expect(l.take(10_000)).toBe(true);
  });

  it("builds a table of independent limiters", () => {
    const t = limiters({ ping: { perSecond: 2 }, s: { perSecond: 5 } });
    expect([t.ping.take(0), t.ping.take(0), t.ping.take(0)]).toEqual([true, true, false]);
    expect(t.s.take(0)).toBe(true);
  });
});
