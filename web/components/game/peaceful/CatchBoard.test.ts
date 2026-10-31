import { describe, expect, it } from "vitest";
import { ROSTER } from "@/lib/collections/roster";
import { catchLanes, closedNow, hoursText, outNow } from "./CatchBoard";

const pond = new Set(ROSTER.filter(s => s.biome === "pond").map(s => s.key));

describe("the catch board's chalk (d-now)", () => {
  it("never shows a pond fish as catchable on an island whose pond is closed, and lists them as closed instead", () => {
    let closedSeen = 0;
    for (const month of [1, 4, 7, 10]) for (let hour = 0.5; hour < 24; hour += 3) {
      expect(outNow(["sea", "river"], hour, month, "clear").some(o => pond.has(o.fish.key))).toBe(false);
      const shut = closedNow(["sea", "river"], hour, month, "clear");
      expect(shut.every(o => pond.has(o.fish.key))).toBe(true);
      closedSeen += shut.length;
      expect(closedNow(["sea", "river", "pond"], hour, month, "clear")).toEqual([]);
    }
    expect(closedSeen).toBeGreaterThan(0);
  });
});

describe("the catch board's day strip (David, 2026-10-28: \"a time graphic with the things available\")", () => {
  it("puts every fish out today in one band per span of hours, all day first, nothing from a closed pond", () => {
    for (const month of [1, 4, 7, 10]) {
      const lanes = catchLanes(["sea", "river"], month, "clear");
      expect(lanes.map(l => l.water)).toEqual(["sea", "river"]);
      for (const l of lanes) {
        const keys = l.bands.flatMap(b => b.items.map(i => i.key));
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys.some(k => pond.has(k))).toBe(false);
        for (const b of l.bands) for (const it of b.items) expect(it.hours).toEqual(b.hours);
        if (l.bands.some(b => b.hours.every(Boolean))) expect(l.bands[0].hours.every(Boolean)).toBe(true);
        // Everything biting at noon is in a band on at noon.
        const noon = new Set(outNow([l.water], 12.5, month, "clear").map(o => o.fish.key));
        expect(new Set(l.bands.filter(b => b.hours[12]).flatMap(b => b.items.map(i => i.key)))).toEqual(noon);
      }
    }
  });
  it("says a fish's hours plainly", () => {
    expect(hoursText(Array(24).fill(true))).toBe("All day");
    expect(hoursText(Array.from({ length: 24 }, (_, h) => h >= 6 && h < 18))).toBe("6:00 to 18:00");
    expect(hoursText(Array.from({ length: 24 }, (_, h) => h >= 20 || h < 4))).toBe("20:00 to 4:00");
  });
});
