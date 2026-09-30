import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CHAPTERS, DEFAULT_GOALS, SEASONAL_GOALS } from "./defaults";
import { goalCycle, monumentStage, normalizeGoal, planContribution, validateGoalDraft } from "./goals";
import { seasonalGoalsSql } from "./seed";

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
  it("repeats on the Toronto date across New Year, whatever UTC says", () => {
    const lights = SEASONAL_GOALS.find((g) => g.slug === "winter-lights")!; // Dec 1 → Jan 8, midnight Toronto (through Jan 7)
    // 23:30 on Dec 31 in Toronto is already Jan 1 in UTC; the 2027 festival runs on through New Year's week.
    expect(goalCycle(lights, new Date("2028-01-01T04:30:00Z"))).toMatchObject({ cycle: 2027, open: true });
    expect(goalCycle(lights, new Date("2028-01-01T05:30:00Z"))).toMatchObject({ cycle: 2027, open: true });
    // It ends at midnight Toronto starting Jan 8 (05:00Z), not midnight UTC.
    expect(goalCycle(lights, new Date("2028-01-08T04:30:00Z"))).toMatchObject({ cycle: 2027, open: true });
    expect(goalCycle(lights, new Date("2028-01-08T05:30:00Z"))).toMatchObject({ cycle: 2027, open: false });
    // Opens at midnight Toronto on Dec 1 (05:00Z), not midnight UTC.
    expect(goalCycle(lights, new Date("2027-12-01T04:30:00Z"))).toMatchObject({ cycle: 2026, open: false });
    expect(goalCycle(lights, new Date("2027-12-01T05:00:00Z"))).toMatchObject({ cycle: 2027, open: true });
    expect(goalCycle(lights, new Date("2027-12-01T05:00:00Z")).end?.toISOString()).toBe("2028-01-08T05:00:00.000Z");
  });
  it("keeps the Toronto wall-clock time when DST falls on a different date", () => {
    // Mar 10 2026 is already EDT (DST began Mar 8); Mar 10 2027 is still EST (DST begins Mar 14).
    const genesis = { ...SEASONAL_GOALS.find((g) => g.slug === "genesis-week")!, window_start: "2026-03-10T04:00:00Z", window_end: "2026-03-17T04:00:00Z" };
    const c = goalCycle(genesis, new Date("2027-03-12T12:00:00Z"));
    expect([c.cycle, c.start?.toISOString(), c.end?.toISOString(), c.open]).toEqual([2027, "2027-03-10T05:00:00.000Z", "2027-03-17T04:00:00.000Z", true]);
    expect(goalCycle(genesis, new Date("2027-03-10T04:30:00Z")).open).toBe(false); // 23:30 EST on Mar 9: not yet
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

describe("seed content", () => {
  it("defaults.ts mirrors the goals and chapters seeded by 20260926150200_progression.sql (chapter 4's copy: 20260929100200)", () => {
    const sql = ["20260926150200_progression", "20260929100200_chapter4_subclass_copy"].map((f) => readFileSync(join(__dirname, `../../supabase/migrations/${f}.sql`), "utf8")).join("\n");
    const story = DEFAULT_GOALS.filter((g) => g.goal_type === "story");
    const texts = [...story.flatMap((g) => [g.slug, g.title, g.summary, g.completion_letter_subject, g.completion_letter_body]), ...DEFAULT_CHAPTERS.flatMap((c) => [c.slug, c.title, c.summary])];
    for (const t of texts) if (t) expect(sql).toContain(t.replace(/'/g, "''"));
  });
  it("seeds the four seasonal goals verbatim in 20260929120000_seasonal_events.sql, each a valid draft", () => {
    expect(readFileSync(join(__dirname, "../../supabase/migrations/20260929120000_seasonal_events.sql"), "utf8")).toContain(seasonalGoalsSql());
    expect(SEASONAL_GOALS.map((g) => g.event.decor)).toEqual(["fall-tourney", "winter-lights", "genesis", "spring-picnic"]);
    for (const g of SEASONAL_GOALS) expect(validateGoalDraft({ ...g }), g.slug).toEqual([]);
  });
});
