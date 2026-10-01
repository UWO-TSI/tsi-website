import { describe, expect, it } from "vitest";
import { settlementToast } from "./settlement";

const base = { coins_paid: 37, coins_pending: 37, minutes_completed: 27, blocks_completed: 1, settings: { focus_len: 25, break_len: 5, cycles: 4 } };

describe("settlement toast (cafe-polish §5)", () => {
  it("reads differently for a finished session, leaving early and timing out", () => {
    const done = settlementToast({ ...base, end_reason: "finished", coins_paid: 140, minutes_completed: 100, blocks_completed: 4 })!;
    const left = settlementToast({ ...base, end_reason: "left" })!;
    const away = settlementToast({ ...base, end_reason: "timeout" })!;
    expect(done.text).toBe("Session complete! +140 🪙 for 100 focus minutes across 4 blocks.");
    expect(left.text).toBe("You left early and kept 27 focus minutes. +37 🪙");
    expect(away.text).toMatch(/^Away for 5 minutes/);
    expect(new Set([done.text, left.text, away.text]).size).toBe(3);
  });
  it("says nothing banked for an early leave before a minute, and nothing at all before a timer", () => {
    expect(settlementToast({ ...base, end_reason: "left", coins_paid: 0, minutes_completed: 0, blocks_completed: 0 })).toMatchObject({ coins: 0, text: expect.stringMatching(/Nothing banked/) });
    expect(settlementToast({ ...base, end_reason: "left", coins_paid: 0, minutes_completed: 0, blocks_completed: 0, settings: null })).toBeNull();
  });
  it("never shows a money rate", () => {
    for (const end_reason of ["finished", "left", "timeout"] as const) expect(settlementToast({ ...base, end_reason })!.text).not.toMatch(/\$|CAD|💎|Gem/);
  });
});
