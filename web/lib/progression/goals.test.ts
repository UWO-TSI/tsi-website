import { describe, expect, it } from "vitest";
import { DEFAULT_GOALS } from "./defaults";
import { goalCycle, monumentStage, normalizeGoal, planContribution, validateGoalDraft } from "./goals";

const cafe = DEFAULT_GOALS[0];
const none = { credited_points: 0, delivery_points: 0 };

describe("planContribution weights", () => {
  it("weights real activity above in-game deliveries", () => {
    const event = planContribution({ goal: cafe, source: "event", kind: null, amount: 1, totals: none });
    const coins = planContribution({ goal: cafe, source: "delivery", kind: "coins", amount: 1, totals: none });
    expect(event).toMatchObject({ ok: true, weight: 500, creditedPoints: 500 });
    expect(coins).toMatchObject({ ok: true, weight: 1, creditedPoints: 1 });
  });
  it("uses the goal's admin-set weight, not a default", () => {
    const goal = { ...cafe, weights: { ...cafe.weights, material: 35 } };
    expect(planContribution({ goal, source: "delivery", kind: "material", amount: 4, totals: none })).toMatchObject({ ok: true, creditedPoints: 140, amountUsed: 4 });
  });
  it("rejects kinds the goal doesn't accept and zero weights", () => {
    expect(planContribution({ goal: cafe, source: "delivery", kind: "specimen", amount: 1, totals: none })).toEqual({ ok: false, reason: "kind_not_accepted" });
    const goal = { ...cafe, weights: { ...cafe.weights, bounty: 0 } };
    expect(planContribution({ goal, source: "bounty", kind: null, amount: 1, totals: none })).toEqual({ ok: false, reason: "not_weighted" });
  });
  it.each([0, -1, 1.5, 5001])("rejects invalid amounts: %s", (amount) => {
    expect(planContribution({ goal: cafe, source: "delivery", kind: "coins", amount, totals: none })).toEqual({ ok: false, reason: "invalid_amount" });
  });
});

describe("planContribution caps", () => {
  it("caps deliveries at the delivery cap and only charges the units that count", () => {
    const plan = planContribution({ goal: cafe, source: "delivery", kind: "coins", amount: 2000, totals: { credited_points: 0, delivery_points: 1000 } });
    expect(plan).toMatchObject({ ok: true, creditedPoints: 500, amountUsed: 500, capped: true, deliveryCap: 1500, memberCap: 3000 });
  });
  it("rounds consumed units up by at most one when the weight doesn't divide the room", () => {
    const plan = planContribution({ goal: cafe, source: "delivery", kind: "material", amount: 10, totals: { credited_points: 0, delivery_points: 1450 } });
    expect(plan).toMatchObject({ ok: true, creditedPoints: 50, amountUsed: 3, capped: true });
  });
  it("applies the member total cap across sources", () => {
    const plan = planContribution({ goal: cafe, source: "event", kind: null, amount: 1, totals: { credited_points: 2800, delivery_points: 0 } });
    expect(plan).toMatchObject({ ok: true, creditedPoints: 200, capped: true });
    expect(planContribution({ goal: cafe, source: "event", kind: null, amount: 1, totals: { credited_points: 3000, delivery_points: 0 } })).toEqual({ ok: false, reason: "cap_reached" });
  });
  it("lets admin-logged credit past the member cap", () => {
    expect(planContribution({ goal: cafe, source: "admin", kind: null, amount: 800, totals: { credited_points: 3000, delivery_points: 1500 } })).toMatchObject({ ok: true, creditedPoints: 800, memberCap: null, capped: false });
  });
});

describe("goal cycles and monument", () => {
  it("story goals live in cycle 0", () => {
    expect(goalCycle(cafe, new Date("2027-03-01T00:00:00Z"))).toMatchObject({ cycle: 0, open: true });
  });
  it("seasonal goals repeat yearly on the authored window", () => {
    const fest = { ...cafe, goal_type: "seasonal" as const, window_start: "2026-10-01T00:00:00Z", window_end: "2026-10-31T00:00:00Z" };
    expect(goalCycle(fest, new Date("2027-10-10T00:00:00Z"))).toMatchObject({ cycle: 2027, open: true });
    expect(goalCycle(fest, new Date("2027-12-10T00:00:00Z"))).toMatchObject({ cycle: 2027, open: false });
    const winter = { ...fest, window_start: "2026-12-15T00:00:00Z", window_end: "2027-01-15T00:00:00Z" };
    expect(goalCycle(winter, new Date("2028-01-05T00:00:00Z"))).toMatchObject({ cycle: 2027, open: true });
  });
  it("maps percent to five monument stages", () => {
    expect([0, 24, 25, 50, 74, 75, 99, 100].map(monumentStage)).toEqual([0, 0, 1, 2, 2, 3, 3, 4]);
  });
  it("normalizes untrusted JSON and validates drafts", () => {
    const g = normalizeGoal({ id: "x", slug: "a", weights: { coins: "9", event: 2 }, caps: null, accepts: ["coins", "gems"] });
    expect(g.weights.coins).toBe(1);
    expect(g.weights.event).toBe(2);
    expect(g.accepts).toEqual(["coins"]);
    expect(validateGoalDraft({ ...cafe })).toEqual([]);
    expect(validateGoalDraft({ ...cafe, goal_type: "seasonal" })).toContain("seasonal goals need a window");
  });
});
