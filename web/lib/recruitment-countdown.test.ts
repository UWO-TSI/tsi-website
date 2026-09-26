import { describe, expect, it } from "vitest";
import { recruitmentCountdown } from "./recruitment-countdown";

const now = Date.parse("2026-09-16T23:00:00Z");
const role = { is_active: true, opens_at: null, closes_at: null };

describe("HQ application countdown", () => {
  it("does not invent a deadline for undated roles", () => {
    expect(recruitmentCountdown(role, now)).toEqual({ label: "Application dates coming soon" });
    expect(recruitmentCountdown({ ...role, closes_at: "invalid" }, now)).toEqual({ label: "Application dates coming soon" });
  });
  it("counts toward opening before a scheduled round", () => {
    expect(recruitmentCountdown({ ...role, opens_at: "2026-09-17T00:00:00Z", closes_at: "2026-09-20T00:00:00Z" }, now)).toMatchObject({ label: "Opens in", remaining: "1h 0m 0s" });
  });
  it("counts down to the actual closing instant and displays campus time", () => {
    const result = recruitmentCountdown({ ...role, closes_at: "2026-09-18T01:02:03Z" }, now);
    expect(result).toMatchObject({ label: "Closes in", remaining: "1d 2h 2m 3s" });
    expect(result.date).toContain("9:02");
    expect(recruitmentCountdown({ ...role, closes_at: new Date(now).toISOString() }, now)).toEqual({ label: "Applications closed" });
  });
  it("never advertises paused or archived roles as open", () => {
    expect(recruitmentCountdown({ ...role, is_active: false, closes_at: "2026-09-20T00:00:00Z" }, now)).toEqual({ label: "Not accepting applications yet" });
    expect(recruitmentCountdown({ ...role, archived_at: "2026-09-15" }, now)).toEqual({ label: "Applications closed" });
  });
});
