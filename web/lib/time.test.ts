import { afterEach, describe, expect, it } from "vitest";
import { torontoParts } from "./time";

describe("torontoParts", () => {
  const tz = process.env.TZ;
  afterEach(() => { process.env.TZ = tz; });

  it("reads the Toronto wall clock whatever the machine's zone", () => {
    process.env.TZ = "Asia/Tokyo";  // already Oct 1 there
    const t = torontoParts(new Date("2026-10-01T00:30:00Z"));  // Sep 30, 20:30 EDT
    expect(t).toMatchObject({ year: 2026, month: 9, day: 30, hour: 20, minute: 30, weekday: 2, date: "2026-09-30", hourKey: "2026-09-30T20" });
    expect(new Date("2026-10-01T00:30:00Z").getMonth() + 1).toBe(10);  // the local-month bug this replaces
  });

  it("uses a 0-23 hour at midnight", () => {
    expect(torontoParts(new Date("2026-09-27T04:00:00Z")).hourKey).toBe("2026-09-27T00");
  });
});
