import { describe, expect, it } from "vitest";
import { applicantDayPhase } from "./applicantTime";

describe("campus lighting", () => {
  it("uses Toronto hours during daylight saving and winter", () => {
    expect(applicantDayPhase(new Date("2026-09-16T20:59:00Z"))).toBe("day");
    expect(applicantDayPhase(new Date("2026-09-16T21:00:00Z"))).toBe("evening");
    expect(applicantDayPhase(new Date("2026-09-17T01:00:00Z"))).toBe("night");
    expect(applicantDayPhase(new Date("2026-12-16T21:30:00Z"))).toBe("day");
    expect(applicantDayPhase(new Date("2026-12-16T22:00:00Z"))).toBe("evening");
  });
});
