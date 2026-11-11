import { describe, expect, it } from "vitest";
import { inNpoWindow, seasonCta } from "./season";

const round = (opens: string, closes: string) => ({ is_active: true, archived_at: null, opens_at: opens, closes_at: closes });

describe("the nav's seasonal call to action", () => {
  it("sends students to apply while a hiring round is open", () => {
    const now = new Date("2026-09-20T16:00:00Z");
    expect(seasonCta(now, [round("2026-09-17T16:00:00Z", "2026-09-28T20:00:00Z")]).kind).toBe("students");
  });

  it("puts an open hiring round ahead of the nonprofit window", () => {
    const now = new Date("2026-08-20T16:00:00Z");
    expect(seasonCta(now, [round("2026-08-15T16:00:00Z", "2026-08-25T20:00:00Z")]).kind).toBe("students");
  });

  it("asks nonprofits to apply from Aug 10 to Aug 31, Toronto time", () => {
    expect(inNpoWindow(new Date("2026-08-10T04:30:00Z"))).toBe(true); // 00:30 Aug 10 in Toronto
    expect(inNpoWindow(new Date("2026-08-10T03:30:00Z"))).toBe(false); // 23:30 Aug 9 in Toronto
    expect(inNpoWindow(new Date("2026-09-01T03:30:00Z"))).toBe(true); // 23:30 Aug 31 in Toronto
    expect(inNpoWindow(new Date("2026-09-01T04:30:00Z"))).toBe(false);
    expect(seasonCta(new Date("2026-08-15T16:00:00Z"), []).kind).toBe("nonprofits");
  });

  it("falls back to GENESIS sponsorship, ignoring closed, archived and inactive roles", () => {
    const now = new Date("2026-11-11T16:00:00Z");
    const positions = [
      round("2026-09-17T16:00:00Z", "2026-09-28T20:00:00Z"),
      { ...round("2026-11-01T16:00:00Z", "2026-11-30T20:00:00Z"), archived_at: "2026-11-02T00:00:00Z" },
      { ...round("2026-11-01T16:00:00Z", "2026-11-30T20:00:00Z"), is_active: false },
    ];
    expect(seasonCta(now, positions)).toEqual({ kind: "sponsors", label: "Sponsor GENESIS", href: "/genesis" });
  });
});
