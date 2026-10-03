import { describe, expect, it } from "vitest";
import { CLOCK, RATE_LIMITS } from "./protocol";
import { BURST_GAP_MS, NetClock } from "./clock";

/** A hand-driven world for the clock: a wall clock, a timer queue, the server's answers. */
function world(o: { offset?: number; oneWay?: number; preview?: boolean } = {}) {
  let wall = 1_791_000_000_000;
  const timers: { at: number; fn: () => void }[] = [], pings: number[] = [], applied: number[] = [];
  let answered = 0;
  const clock = new NetClock({
    wall: () => wall,
    ping: ms => pings.push(ms),
    applyWorld: ms => applied.push(ms),
    previewActive: () => !!o.preview,
    later: (fn, ms) => { const t = { at: wall + ms, fn }; timers.push(t); return () => { timers.splice(timers.indexOf(t), 1); }; },
  });
  /** Run the clock forward, answering each ping after a round trip (the server's clock `offset` ahead). */
  const run = (ms: number, offset = o.offset ?? 0, oneWay = o.oneWay ?? 30) => {
    const end = wall + ms;
    const answers: { at: number; client: number; server: number }[] = [];
    const schedule = () => { for (; answered < pings.length; answered++) answers.push({ at: pings[answered] + 2 * oneWay, client: pings[answered], server: pings[answered] + oneWay + offset }); };
    schedule();
    while (true) {
      const next = [...timers].sort((a, b) => a.at - b.at)[0], answer = answers.sort((a, b) => a.at - b.at)[0];
      const at = Math.min(next?.at ?? Infinity, answer?.at ?? Infinity);
      if (at > end) break;
      wall = at;
      if (answer && answer.at === at) { answers.shift(); clock.onPong({ client: answer.client, server: answer.server }); continue; }
      timers.splice(timers.indexOf(next!), 1);
      next!.fn();
      schedule();
    }
    wall = end;
  };
  return { clock, pings, applied, run, wall: () => wall, setWall: (w: number) => { wall = w; } };
}

describe("pings", () => {
  it("five at join, BURST_GAP_MS apart, then one every CLOCK.everyMs; stop ends them", () => {
    const w = world();
    w.clock.start();
    w.run(BURST_GAP_MS * (CLOCK.burst - 1) + CLOCK.everyMs * 2 + 1000);
    const gaps = w.pings.slice(1).map((p, i) => p - w.pings[i]);
    expect(gaps.slice(0, CLOCK.burst - 1)).toEqual(Array(CLOCK.burst - 1).fill(BURST_GAP_MS));
    expect(gaps.slice(CLOCK.burst - 1)).toEqual([CLOCK.everyMs, CLOCK.everyMs]);
    w.clock.stop();
    const n = w.pings.length;
    w.run(CLOCK.everyMs * 3);
    expect(w.pings.length).toBe(n);
  });
  it("the burst never outruns the room's ping limit (its bucket: RATE_LIMITS.ping a second, as many at once)", () => {
    expect(BURST_GAP_MS).toBe(500);
    const w = world();
    w.clock.start();
    w.run(CLOCK.everyMs * 4);
    // realtime/src/rooms/limits.ts: tokens refill continuously, the bucket holds perSecond.
    const rate = RATE_LIMITS.ping.perSecond;
    let tokens: number = rate, at = -Infinity, dropped = 0;
    for (const p of w.pings) {
      tokens = at === -Infinity ? rate : Math.min(rate, tokens + ((p - at) * rate) / 1000);
      at = p;
      if (tokens < 1) dropped++; else tokens--;
    }
    expect(dropped).toBe(0);
    expect(w.pings.length).toBeGreaterThanOrEqual(CLOCK.burst + 3);
  });
});

describe("the offset", () => {
  it("is the server's clock minus ours, taken at once, then given to the world clock once it's over CLOCK.applyOverMs", () => {
    const w = world({ offset: 1234.5, oneWay: 40 });
    expect(w.clock.synced).toBe(false);
    expect(w.clock.serverNow()).toBe(w.wall());
    w.clock.start();
    w.run(100);
    expect(w.clock.synced).toBe(true);
    expect(w.clock.estimate).toBeCloseTo(1234.5, 6);
    expect(w.clock.serverNow() - w.wall()).toBeCloseTo(1234.5, 6);
    expect(w.applied).toEqual([1234.5]);
    w.run(CLOCK.everyMs * 3);
    expect(w.applied).toEqual([1234.5]); // no re-apply while it holds
  });
  it("a small offset (an NTP-synced machine) leaves the world clock alone", () => {
    const w = world({ offset: 12 });
    w.clock.start();
    w.run(5000);
    expect(w.clock.estimate).toBeCloseTo(12, 6);
    expect(w.applied).toEqual([]);
  });
  it("never touches the world clock while a dev ?at= preview owns it, but room time still follows the server", () => {
    const w = world({ offset: 5000, preview: true });
    w.clock.start();
    w.run(3000);
    expect(w.applied).toEqual([]);
    expect(w.clock.serverNow() - w.wall()).toBeCloseTo(5000, 6);
  });
  it("later estimates slew room time at 10% of real time: never a jump, never backwards", () => {
    const w = world({ offset: 0 });
    w.clock.start();
    w.run(3000);
    const before = w.clock.serverNow();
    // The server's clock steps back 400 ms (an NTP correction there): the next pongs say so.
    w.run(CLOCK.everyMs * 20, -400);
    let last = w.clock.serverNow(), lastWall = w.wall();
    for (let i = 0; i < 400; i++) {
      w.setWall(w.wall() + 16);
      const now = w.clock.serverNow();
      expect(now - last).toBeGreaterThanOrEqual(16 * 0.9 - 1e-6);
      expect(now - last).toBeLessThanOrEqual(16 * 1.1 + 1e-6);
      last = now; lastWall = w.wall();
    }
    expect(last - lastWall).toBeCloseTo(-400, 0);
    expect(before).toBeLessThan(last);
  });
  it("ignores a pong that claims to come from the future", () => {
    const w = world();
    w.clock.onPong({ client: w.wall() + 1000, server: 5 });
    expect(w.clock.synced).toBe(false);
  });
});
