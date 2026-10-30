import { describe, expect, it } from "vitest";
import { STEP } from "@/lib/game/movement/sim";
import { predictLanding, timeToHeight } from "./ball";
import { COURT, sideOf } from "./court";
import { VB_FEEL } from "./feel";
import { meterPower } from "./timing";
import { ACTIONS, BAR, actionFor, controlOf, stanceOf } from "./actions";
import { HAND, NO_COURT_INPUT, createMatch, serverOf, sideOfPlayer, stepMatch, type CourtInput, type Match, type MatchEvent } from "./match";

const run = (m: Match, inp: Partial<CourtInput> = {}, steps = 1) => {
  const all: MatchEvent[] = [];
  for (let i = 0; i < steps; i++) { stepMatch(m, { ...NO_COURT_INPUT, ...inp }); all.push(...m.events); m.events = []; }
  return all;
};

/** A rally with you on your side and the ball dropping toward you from `above` u over the hand for `how`. */
function rallyAt(how: "bump" | "set", above: number, lead = 0) {
  const m = createMatch({ seed: 4, serving: 1 });
  m.phase = "rally";
  const side = sideOfPlayer(m, 0), p = m.players[0];
  p.s = { ...p.s, x: 0, z: side * 4 };
  m.players[1].s = { ...m.players[1].s, x: -3, z: side * 5 };
  Object.assign(m.ball, { x: 0, y: p.s.y + HAND[how] + above, z: side * 4 + lead, vx: 0, vy: 0, vz: 0, k: 1 });
  Object.assign(m, { touchTeam: 1, touches: 1, lastTouch: 2, lastTeam: 1, flight: m.flight + 1 });
  return m;
}

/** Into the air: a jump and a few steps up. */
function jumpUp(m: Match) { run(m, { jump: true, jumpPressed: true }); run(m, { jump: true }, 12); expect(m.players[0].s.mode).toBe("air"); }

describe("the controls table", () => {
  it("every bar slot has a control, and each stance's controls are unique", () => {
    for (const st of Object.keys(BAR) as (keyof typeof BAR)[]) for (const a of BAR[st]) expect(controlOf(st, a), `${st} ${a}`).not.toBeNull();
    for (const row of Object.values(ACTIONS)) expect(new Set(Object.values(row)).size).toBe(Object.values(row).length);
  });
  it("the ground's and the air's left click, E and right click are bump/set/call and spike/jump set/block", () => {
    expect([ACTIONS.ground.left, ACTIONS.ground.e, ACTIONS.ground.right, ACTIONS.ground.ctrl]).toEqual(["bump", "set", "call", "dive"]);
    expect([ACTIONS.air.left, ACTIONS.air.e, ACTIONS.air.right]).toEqual(["spike", "jumpset", "block"]);
  });
});

describe("each action fires from its control in its stance (match.ts humanStep)", () => {
  it("serve: hold left fills the bar, release tosses, a left click in the toss serves", () => {
    const m = createMatch({ seed: 3, serving: 0 });
    expect(stanceOf(m, 0)).toBe("serve");
    run(m, { left: true, leftPressed: true });
    expect(m.meter).not.toBeNull();
    run(m, { left: true }, 40);
    const tossed = run(m, { leftReleased: true });
    expect(tossed.some(e => e.kind === "toss")).toBe(true);
    expect(stanceOf(m, 0)).toBe("toss");
    const ideal = timeToHeight(m.ball, m.players[0].s.y + HAND.serve)!;
    run(m, {}, Math.round(ideal / STEP) - 1);
    const ev = run(m, { leftPressed: true });
    expect(ev.find(e => e.kind === "serve")).toMatchObject({ who: 0 });
    expect(m.phase).toBe("rally");
  });
  it("serve: the meter's top is a max-power toss", () => {
    const m = createMatch({ seed: 3, serving: 0 });
    run(m, { left: true, leftPressed: true });
    // Hold until the bar is in its top zone, then let go.
    for (let i = 0; i < 400 && meterPower(m.meter!) < VB_FEEL.serve.maxPower; i++) run(m, { left: true });
    const ev = run(m, { leftReleased: true });
    const toss = ev.find(e => e.kind === "toss") as Extract<MatchEvent, { kind: "toss" }>;
    expect(toss.max).toBe(true);
  });
  it("serve: a click on the ring's right sends it right of where you look, a curve bends it", () => {
    const land = (ring: { x: number; y: number } | null, spin: { x: number; y: number } | null) => {
      const m = createMatch({ seed: 3, serving: 0 });
      run(m, { left: true, leftPressed: true }); run(m, { left: true }, 30); run(m, { leftReleased: true });
      const ideal = timeToHeight(m.ball, m.players[0].s.y + HAND.serve)!;
      run(m, {}, Math.round(ideal / STEP) - 1);
      const opp = -sideOfPlayer(m, 0);
      run(m, { leftPressed: true, aim: { x: 0, z: opp * COURT.halfLength * 0.6 }, ring, spin });
      return { at: predictLanding(m.ball)!, right: sideOfPlayer(m, 0) };
    };
    const mid = land(null, null), r = land({ x: 0.8, y: 0 }, null), c = land(null, { x: 0.9, y: 0 });
    // Screen-right is +x for a server on side +1 and −x on side −1.
    expect((r.at.x - mid.at.x) * r.right).toBeGreaterThan(1.5);
    // Hit on its right, it bends left.
    expect((c.at.x - mid.at.x) * c.right).toBeLessThan(-0.3);
  });
  it("ground: left click bumps, E sets", () => {
    for (const [how, c] of [["bump", "leftPressed"], ["set", "ePressed"]] as const) {
      const m = rallyAt(how, 0);
      expect(stanceOf(m, 0)).toBe("ground");
      const ev = run(m, { [c]: true });
      expect(ev.find(e => e.kind === "contact"), how).toMatchObject({ who: 0, how });
    }
  });
  it("ground: an early press waits for the ball and still connects, graded by how early", () => {
    const m = rallyAt("bump", 0);
    m.ball.y += 0.35; // under a quarter second above the hands
    const t = timeToHeight(m.ball, m.players[0].s.y + HAND.bump)!;
    expect(t).toBeLessThan(VB_FEEL.timing.buffer);
    const first = run(m, { leftPressed: true });
    expect(first.some(e => e.kind === "press")).toBe(true);
    expect(first.some(e => e.kind === "whiff")).toBe(false);
    const ev = run(m, {}, 60);
    const hit = ev.find(e => e.kind === "contact") as Extract<MatchEvent, { kind: "contact" }>;
    expect(hit).toMatchObject({ who: 0, how: "bump" });
    expect(hit.quality).toBeLessThan(0.9);
  });
  it("ground: a press with nothing coming is a whiff and a short cooldown", () => {
    const m = rallyAt("bump", 0);
    m.ball.y += 5;
    const ev = run(m, { leftPressed: true });
    expect(ev.some(e => e.kind === "whiff")).toBe(true);
    expect(m.players[0].cd).toBeGreaterThan(0);
  });
  it("ground: right click calls it, Ctrl dives, Q then Ctrl slide-dives", () => {
    const m = rallyAt("bump", 3);
    expect(run(m, { rightPressed: true }).some(e => e.kind === "call" && e.who === 0)).toBe(true);
    expect(run(m, { ctrlPressed: true, x: 1 }).find(e => e.kind === "dive")).toMatchObject({ who: 0, strong: false });
    const s = rallyAt("bump", 3);
    run(s, { dashPressed: true, x: 1 });
    expect(actionFor(s, 0, "ctrl")).toBe("slide");
    expect(run(s, { ctrlPressed: true, x: 1 }).find(e => e.kind === "dive")).toMatchObject({ who: 0, strong: true });
  });
  it("air: left click spikes, E jump-sets, right click blocks (once a jump)", () => {
    for (const [how, c] of [["spike", "leftPressed"], ["jumpset", "ePressed"]] as const) {
      const m = rallyAt("set", 3);
      jumpUp(m);
      expect(stanceOf(m, 0)).toBe("air");
      const p = m.players[0], hand = how === "spike" ? HAND.spike : HAND.set;
      Object.assign(m.ball, { x: p.s.x, y: p.s.y + hand, z: p.s.z, vy: -1 });
      const ev = run(m, { [c]: true });
      expect(ev.find(e => e.kind === "contact"), how).toMatchObject({ who: 0, how });
    }
    const m = rallyAt("set", 3);
    m.players[0].s = { ...m.players[0].s, z: sideOfPlayer(m, 0) * 0.6 };
    jumpUp(m);
    expect(run(m, { rightPressed: true }).some(e => e.kind === "block" && e.who === 0)).toBe(true);
    expect(m.players[0].block).toBeGreaterThan(0);
    expect(run(m, { rightPressed: true }).some(e => e.kind === "block")).toBe(false);
  });
  it("a spike lands on the far side where you look", () => {
    const m = rallyAt("set", 3);
    m.players[0].s = { ...m.players[0].s, z: sideOfPlayer(m, 0) * 1.2 };
    jumpUp(m);
    const p = m.players[0], opp = -sideOfPlayer(m, 0);
    Object.assign(m.ball, { x: p.s.x, y: p.s.y + HAND.spike, z: p.s.z, vy: -1 });
    run(m, { leftPressed: true, aim: { x: 2, z: opp * 4 } });
    const at = predictLanding(m.ball)!;
    expect(sideOf(at.z)).toBe(opp);
  });
  it("between points nothing fires", () => {
    const m = rallyAt("bump", 0);
    m.phase = "point";
    expect(stanceOf(m, 0)).toBe("idle");
    expect(run(m, { leftPressed: true, ePressed: true, rightPressed: true, ctrlPressed: true }).some(e => e.kind === "contact" || e.kind === "call" || e.kind === "dive")).toBe(false);
  });
  it("only the server acts in the serve; the others wait", () => {
    const m = createMatch({ seed: 3, serving: 1 });
    expect(serverOf(m)).not.toBe(0);
    expect(stanceOf(m, 0)).toBe("idle");
  });
});

describe("the pace", () => {
  it("starts slow and quickens with each touch of a rally", () => {
    const m = rallyAt("bump", 0);
    m.ball.k = VB_FEEL.pace.start;
    run(m, { leftPressed: true });
    const k1 = m.ball.k!;
    expect(k1).toBeGreaterThan(VB_FEEL.pace.start);
    expect(k1).toBeLessThanOrEqual(VB_FEEL.pace.max);
  });
});

describe("timing grades", () => {
  it("every touch is perfect, good, early or late by how far off the ideal moment it was", async () => {
    const { timingOf } = await import("./match");
    expect(timingOf(0)).toBe("perfect");
    expect(timingOf(-VB_FEEL.timing.good + 0.01)).toBe("good");
    expect(timingOf(-0.25)).toBe("early");
    expect(timingOf(0.25)).toBe("late");
  });
  it("a press well before the ball is graded early, one at the ball perfect", () => {
    const early = rallyAt("bump", 0.35);
    run(early, { leftPressed: true });
    const e1 = run(early, {}, 60).find(e => e.kind === "contact") as Extract<MatchEvent, { kind: "contact" }>;
    expect(e1.timing).toBe("early");
    const on = rallyAt("bump", 0);
    const e2 = run(on, { leftPressed: true }).find(e => e.kind === "contact") as Extract<MatchEvent, { kind: "contact" }>;
    expect(e2.timing).toBe("perfect");
  });
});
