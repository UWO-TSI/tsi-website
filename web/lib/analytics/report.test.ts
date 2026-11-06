import { describe, expect, it } from "vitest";
import { buildReport, rangeOf, type Snapshot } from "./report";
import { demoSnapshot } from "./demo";
import { STEP_IDS } from "./steps";

const NOW = new Date("2026-11-06T18:00:00Z");
const at = (daysAgo: number, min = 0) => new Date(NOW.getTime() - daysAgo * 86_400_000 + min * 60_000).toISOString();

// Three players: A joined before the log (history from the tables), B and C after it.
const snap: Snapshot = {
  players: [
    { id: "a", name: "Pebble", joined: at(20), last: at(19) },
    { id: "b", name: "Moss", joined: at(10), last: at(1) },
    { id: "c", name: null, joined: at(9), last: at(9) },
  ],
  steps: [
    { m: "a", s: "creator", at: null }, { m: "a", s: "arrived", at: at(20, 30) }, { m: "a", s: "first_sale", at: at(19) },
    { m: "b", s: "arrival_aboard", at: at(10, 1) }, { m: "b", s: "creator", at: at(10, 4) }, { m: "b", s: "arrived", at: at(10, 20) },
    { m: "c", s: "arrival_aboard", at: at(9, 1) },
  ],
  sessions: [
    { m: "b", start: at(10), end: at(10, 30), last_step: "arrived", screen: "village" },
    { m: "b", start: at(1), end: at(1, 10), last_step: null, screen: "museum" },
    { m: "c", start: at(9), end: at(9, 6), last_step: "arrival_aboard", screen: "opening" },
  ],
  uses: [{ m: "a", f: "selling", d: at(19).slice(0, 10) }, { m: "b", f: "fishing", d: at(10).slice(0, 10) }, { m: "b", f: "fishing", d: at(1).slice(0, 10) }],
  days: [{ m: "a", d: at(20).slice(0, 10) }, { m: "a", d: at(19).slice(0, 10) }, { m: "b", d: at(1).slice(0, 10) }],
};
const report = buildReport(snap, { ...rangeOf(30, NOW), now: NOW });
const step = (id: string) => report.funnel.find((f) => f.step === id)!;

describe("the admin page's numbers", () => {
  it("counts players, new ones in range, and those quiet a week or more", () => {
    expect(report.totals).toMatchObject({ players: 3, newInRange: 3, activeWeek: 1, gone: 2 });
  });

  it("the funnel: every step in order, tables' steps over everyone, the log's only over players who joined after it began", () => {
    expect(report.funnel.map((f) => f.step)).toEqual(STEP_IDS);
    expect(step("signed_in")).toMatchObject({ reached: 3, of: 3, pct: 100 });
    expect(step("creator")).toMatchObject({ reached: 2, of: 3 });
    // A joined before the log's first session: the opening's beats are out of B and C only.
    expect(step("arrival_aboard")).toMatchObject({ reached: 2, of: 2, pct: 100 });
    expect(step("arrived")).toMatchObject({ reached: 2, of: 3 });
    expect(step("first_sale")).toMatchObject({ reached: 1, of: 3 });
    // Day 2: A (played the day after joining) and B (came back nine days later).
    expect(step("day_2")).toMatchObject({ reached: 2 });
    // Nobody logged opening the creator: that step loses everyone the step before had.
    expect(step("arrival_creator")).toMatchObject({ reached: 0, dropPct: 100 });
  });

  it("where people quit: the last screen of each session, and of each player gone quiet", () => {
    expect(report.quitSession.map((q) => [q.label, q.n])).toEqual([["On museum", 1], ["On opening", 1], ["On village", 1]]);
    // A has no logged session: the furthest step known stands in (A came back on day 2, then stopped).
    expect(report.quitGone.map((q) => q.label).sort()).toEqual(["After Came back day 2", "On opening"]);
  });

  it("engagement: session length, sessions a player, time between steps", () => {
    expect(report.engagement).toMatchObject({ sessions: 3, medianMin: 10, perPlayer: 1.5 });
    expect(report.engagement.stepMinutes.find((s) => s.label === "Opening started to Creator opened")).toBeUndefined();
  });

  it("features: players, and who came back to one on another day", () => {
    expect(report.features).toEqual([{ label: "Fishing", players: 1, returning: 1 }, { label: "Selling", players: 1, returning: 0 }]);
  });

  it("cohorts by signup week; a day's share only once the whole week is that old", () => {
    const c = report.cohorts;
    expect(c.reduce((n, w) => n + w.size, 0)).toBe(3);
    expect(c.every((w) => w.d30 === null)).toBe(true);
  });

  it("the list: world names only, never an account id", () => {
    expect(report.list.map((p) => p.name)).toEqual(["Moss", "Unnamed islander", "Pebble"]);
    expect(JSON.stringify(report)).not.toMatch(/"(a|b|c)"/);
  });

  it("ranges: a known one or 30 days; the snapshot always reads 200 days back", () => {
    expect(rangeOf(7, NOW)).toMatchObject({ from: "2026-10-31", to: "2026-11-06" });
    expect(rangeOf(12345, NOW).from).toBe("2026-10-08");
    expect(rangeOf(30, NOW).since.slice(0, 10)).toBe("2026-04-20");
  });

  it("a club's worth of players adds up quickly", () => {
    const big = demoSnapshot(NOW, 600);
    const t = performance.now();
    const r = buildReport(big, { ...rangeOf(180, NOW), now: NOW });
    expect(performance.now() - t).toBeLessThan(1500);
    expect(r.totals.players).toBe(600);
    expect(r.funnel[0].reached).toBeGreaterThan(r.funnel.at(-1)!.reached);
  });
});
