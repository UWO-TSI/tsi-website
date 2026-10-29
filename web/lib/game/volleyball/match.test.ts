import { describe, expect, it } from "vitest";
import { STEP } from "@/lib/game/movement/sim";
import { GRAVITY, predictLanding, timeToHeight } from "./ball";
import { COURT, sideOf } from "./court";
import { HAND, NO_COURT_INPUT, createMatch, serverOf, sideOfPlayer, stepMatch, type CourtInput, type Match, type MatchEvent } from "./match";
import { openSpot, pickReceivers } from "./bot";
import { serveError } from "./timing";

const run = (m: Match, inp: Partial<CourtInput>, steps = 1) => { for (let i = 0; i < steps; i++) stepMatch(m, { ...NO_COURT_INPUT, ...inp }); };
const until = (m: Match, ok: (e: MatchEvent[]) => boolean, max = 3000) => { for (let i = 0; i < max && !ok(m.events); i++) stepMatch(m); return m.events; };

/** You serve: hold the bar `held` s, release, then click `err` s off the ideal moment. */
function serve(err: number, seed = 3) {
  const m = createMatch({ seed, serving: 0 });
  expect(serverOf(m)).toBe(0);
  run(m, { left: true, leftPressed: true });
  run(m, { left: true }, Math.round(0.55 / STEP));
  run(m, { leftReleased: true });
  expect(m.phase).toBe("toss");
  const p = m.players[0].s, ideal = timeToHeight(m.ball, p.y + HAND.serve)!;
  run(m, {}, Math.max(0, Math.round((ideal + err) / STEP) - 1));
  m.events = [];
  run(m, { leftPressed: true });
  return m;
}

describe("the serve", () => {
  it("on time: a good serve that lands in the far court", () => {
    const m = serve(0);
    expect(m.events.find(e => e.kind === "serve")).toMatchObject({ judge: "perfect" });
    const land = predictLanding(m.ball)!;
    expect(land.in).toBe(true);
    expect(sideOf(land.z)).toBe(-sideOfPlayer(m, 0));
  });
  it("late: into the net, a point to the other team", () => {
    const m = serve(0.12);
    expect(m.events.find(e => e.kind === "serve")).toMatchObject({ judge: "late" });
    const ev = until(m, e => e.some(x => x.kind === "point"));
    expect(ev.some(e => e.kind === "net")).toBe(true);
    expect(ev.find(e => e.kind === "point")).toMatchObject({ team: 1, why: "net" });
  });
  it("early: long and out, a point to the other team", () => {
    const m = serve(-0.2);
    expect(m.events.find(e => e.kind === "serve")).toMatchObject({ judge: "early" });
    const ev = until(m, e => e.some(x => x.kind === "point"));
    expect(ev.find(e => e.kind === "land")).toMatchObject({ in: false });
    expect(ev.find(e => e.kind === "point")).toMatchObject({ team: 1, why: "out" });
  });
  it("the timer runs out: a fault", () => {
    const m = createMatch({ seed: 3, serving: 0 });
    const ev = until(m, e => e.some(x => x.kind === "point"), 1300);
    expect(ev.find(e => e.kind === "point")).toMatchObject({ team: 1, why: "timer" });
  });
  it("the timing error is measured on the falling ball", () => {
    expect(serveError(2, -1, 2, GRAVITY)).toBeCloseTo(0, 6);
  });
});

describe("bots", () => {
  it("take the ball their partner called, and the nearer one otherwise", () => {
    const m = createMatch({ seed: 5, serving: 1, human: false });
    m.phase = "rally";
    const side = sideOfPlayer(m, 0);
    Object.assign(m.ball, { x: 1, y: 4, z: side * 3, vx: 0, vy: 0, vz: 0 });
    m.landing = predictLanding(m.ball);
    m.players[0].s = { ...m.players[0].s, x: 1, z: side * 3 };
    m.players[1].s = { ...m.players[1].s, x: -2, z: side * 3 };
    expect(pickReceivers(m)[0]).toBe(0);
    m.players[1].call = 1;
    expect(pickReceivers(m)[0]).toBe(1);
  });
  it("aim at the open sand, away from the defenders", () => {
    const m = createMatch({ seed: 5, human: false });
    const side = sideOfPlayer(m, 2);
    m.players[2].s = { ...m.players[2].s, x: -2, z: side * 2 };
    m.players[3].s = { ...m.players[3].s, x: -2, z: side * 5 };
    expect(openSpot(m, side).x).toBeGreaterThan(1);
  });
  it("play a whole match to 21 with rallies of bump, set and spike, switching sides every 7", () => {
    const m = createMatch({ seed: 11, human: false, skill: { partner: 0.8, opponents: 0.8 } });
    const all: MatchEvent[] = [];
    for (let i = 0; i < 120 * 60 * 40 && m.phase !== "over"; i++) { m.events = []; stepMatch(m); all.push(...m.events); }
    expect(m.phase).toBe("over");
    const [a, b] = m.score.points;
    expect(Math.max(a, b)).toBeGreaterThanOrEqual(COURT.halfLength > 0 ? 21 : 0);
    expect(Math.abs(a - b)).toBeGreaterThanOrEqual(2);
    expect(all.filter(e => e.kind === "switch").length).toBeGreaterThanOrEqual(2);
    const hows = all.filter(e => e.kind === "contact").map(e => (e as { how: string }).how);
    for (const h of ["serve", "bump", "set", "spike"]) expect(hows).toContain(h);
    const why = all.filter(e => e.kind === "point").map(e => (e as { why: string }).why);
    // Most points come from the ball landing in, not from errors.
    expect(why.filter(w => w === "in").length).toBeGreaterThan(why.length * 0.4);
  });
});
