import { describe, expect, it } from "vitest";
import { buildReport, rangeOf, summarize, type Report, type Snapshot } from "./report";
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

  it("the funnel: every step in order, over the players the log has seen from the start; earlier ones in the history", () => {
    expect(report.funnel.map((f) => f.step)).toEqual(STEP_IDS);
    // A joined before the log's first session: the funnel is B and C, every step out of the same two.
    expect(new Set(report.funnel.map((f) => f.of))).toEqual(new Set([2]));
    expect(step("arrival_aboard")).toMatchObject({ reached: 2, pct: 100 });
    expect(step("creator")).toMatchObject({ reached: 1, pct: 50 });
    expect(step("arrived")).toMatchObject({ reached: 1 });
    expect(step("day_2")).toMatchObject({ reached: 1 });
    // Nobody logged opening the creator: that step loses everyone the step before had.
    expect(step("arrival_creator")).toMatchObject({ reached: 0, dropPct: 100 });
    // A, from the tables: made a character, arrived, sold, came back the next day.
    expect(report.history.filter((h) => h.reached).map((h) => h.step)).toEqual(["signed_in", "creator", "first_sale", "arrived", "day_2"]);
    expect(report.history.every((h) => h.of === 1)).toBe(true);
  });

  it("before any log, the funnel is the tables' steps over everyone, the log's steps empty", () => {
    const old = buildReport({ ...snap, sessions: [] }, { ...rangeOf(30, NOW), now: NOW });
    expect(old.funnel.find((f) => f.step === "arrival_aboard")).toMatchObject({ of: 0, reached: 0 });
    expect(old.funnel.find((f) => f.step === "arrived")).toMatchObject({ of: 3, reached: 2 });
    expect(old.history).toEqual([]);
  });

  it("where people quit: the last screen of each session, and of each player gone quiet", () => {
    expect(report.quitSession.map((q) => [q.label, q.n])).toEqual([["On Museum", 1], ["On Opening", 1], ["On Island", 1]]);
    // A has no logged session: the furthest step known stands in (not the day-2 return: where in the game they stopped).
    expect(report.quitGone.map((q) => q.label).sort()).toEqual(["After Arrival done", "On Opening"]);
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

  it("actives: the day, the week, the month, and the day over the month", () => {
    // B played yesterday: in the week and the month, not today. A's last days are 19 and 20 days ago: the month only.
    expect(report.perDay.at(-1)).toMatchObject({ active: 0, week: 1, month: 3 });
    expect(report.actives).toMatchObject({ wau: 1, mau: 3, dau: 0.1, stickiness: 3 });
  });

  it("retention: day 1, 7 and 30 of those old enough, the very next day, and the tutorial's share", () => {
    // A came back the next day (day 1), B on day 9 (day 1 and day 7, not the next day), C never.
    expect(report.retention.d1).toEqual({ pct: 66.7, of: 3 });
    expect(report.retention.d7).toEqual({ pct: 33.3, of: 3 });
    expect(report.retention.d30).toEqual({ pct: null, of: 0 });
    expect(report.retention.nextDay).toEqual({ pct: 33.3, of: 3 });
    expect(report.tutorial).toEqual({ pct: 66.7, of: 3 });
  });

  it("time to the firsts: from joining, only where the time is known", () => {
    expect(report.firsts.find((f) => f.step === "first_sale")).toMatchObject({ medianMin: 1440, reached: 1, of: 3 });
    expect(report.firsts.find((f) => f.step === "first_catch")).toMatchObject({ medianMin: null, reached: 0 });
  });

  it("session lengths in buckets, and every event kind the log holds (a new system's by its id)", () => {
    expect(report.sessionLengths.map((b) => b.n)).toEqual([0, 0, 2, 0, 1, 0]);
    const r = buildReport({ ...snap, kinds: [
      { kind: "heartbeat", n: 40, players: 2, first: at(10), last: at(1) },
      { kind: "market_sale", n: 3, players: 1, first: at(2), last: at(1) },
    ] }, { ...rangeOf(30, NOW), now: NOW });
    expect(r.kinds.map((k) => [k.label, k.known, k.isNew])).toEqual([["Heartbeat", true, false], ["market_sale", false, true]]);
    expect(r.summary.at(-1)!.text).toBe('A new kind of event, "market_sale", started on Nov 4: 3 so far, from 1 players.');
  });

  it("changes against the period before; none before the read window", () => {
    expect(report.changes.find((c) => c.key === "new")).toMatchObject({ now: 3, before: 0 });
    // The log began 10 days ago: sessions have nothing to compare with.
    expect(report.changes.find((c) => c.key === "sessions")!.before).toBeNull();
    expect(buildReport(snap, { ...rangeOf(180, NOW), now: NOW }).changes.every((c) => c.before === null)).toBe(true);
  });

  it("the summary reads the numbers out: moves, the worst step, retention, where people quit, a spike, a silence", () => {
    const base = { span: 30, prev: true, kinds: [], funnel: [], cohorts: [], quitGone: [], perDay: [] };
    const say = (r: Partial<Parameters<typeof summarize>[0]>) => summarize({ ...base, changes: [], ...r }).map((s) => s.text);
    expect(say({ changes: [
      { key: "new", label: "New players", now: 30, before: 20, unit: "n" },
      { key: "tutorial", label: "Finished the tutorial", now: 52, before: 60, unit: "pct" },
      { key: "length", label: "Typical session", now: 10, before: 9.5, unit: "min" },
    ] })).toEqual([
      "New players rose 50%: 30, against 20 in the 30 days before.",
      "Finished the tutorial fell 8 points: 52%, against 60% in the 30 days before.",
    ]);
    expect(say({})).toEqual(["Nothing moved much against the 30 days before."]);
    const f = (step: string, label: string, reached: number, dropPct: number) => ({ step, label, reached, of: 20, pct: reached * 5, dropPct }) as Report["funnel"][number];
    expect(say({ funnel: [f("signed_in", "Signed in", 20, 0), f("creator", "Character made", 15, 25), f("arrived", "Arrival done", 13, 13.3), f("day_2", "Came back day 2", 4, 69)] })[1])
      .toBe('The worst drop is at "Character made": 5 of the 20 who got to "Signed in" went no further (25%).');
    const w = (week: string, d7: number) => ({ week, size: 10, d1: 50, d7, d30: null });
    expect(say({ cohorts: [w("2026-10-26", 30), w("2026-10-19", 20), w("2026-10-12", 20)] })[1])
      .toBe("Day 7 retention is up: 30% of the week of Oct 26 came back a week on, against 20% for the weeks before.");
    expect(say({ quitGone: [{ key: "screen:village", label: "On Island", n: 6 }, { key: "step:creator", label: "After Character made", n: 4 }] })[1])
      .toBe("Most players who went quiet stopped on Island: 6 of 10 (60%).");
    const day = (d: string, active: number) => ({ d, new: 0, active, week: 0, month: 0 });
    expect(say({ perDay: [day("2026-11-01", 2), day("2026-11-02", 2), day("2026-11-03", 12), day("2026-11-04", 2), day("2026-11-05", 0), day("2026-11-06", 0), day("2026-11-07", 0)] }).slice(1))
      .toEqual(["Nov 3 stood out: 12 played, about 6 times a usual day.", "Nobody has played in the last 3 days."]);
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
