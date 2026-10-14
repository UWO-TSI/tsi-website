import { describe, expect, it } from "vitest";
import { ARRIVAL_TIMES, CLARITY, CROSSING_SHOTS, CROSSING_S, clarityAt, crossingShot, skipArrival, startArrival, stepArrival, underwaterBeat } from "./sequence";

const s = (n: number) => n * 1000;

describe("the arrival's sequence", () => {
  it("runs underwater, then aboard, then waits in the creator for Yes", () => {
    const a = startArrival(0);
    expect(a.phase).toBe("underwater");
    expect(ARRIVAL_TIMES.underwater).toBeGreaterThanOrEqual(4);
    expect(ARRIVAL_TIMES.underwater).toBeLessThanOrEqual(6);
    expect(stepArrival(a, s(ARRIVAL_TIMES.underwater - 0.1), {})).toBe(false);
    expect(stepArrival(a, s(ARRIVAL_TIMES.underwater), {})).toBe(true);
    expect(a.phase).toBe("aboard");
    stepArrival(a, s(ARRIVAL_TIMES.underwater + ARRIVAL_TIMES.aboard), {});
    expect(a.phase).toBe("creator");
    // The creator never times out: only Yes moves it on.
    expect(stepArrival(a, s(600), {})).toBe(false);
    expect(a.phase).toBe("creator");
    stepArrival(a, s(601), { yes: true });
    expect(a.phase).toBe("clearing");
    expect(a.at).toBe(s(601));
    stepArrival(a, s(601 + ARRIVAL_TIMES.clearing), {});
    expect(a.phase).toBe("crossing");
  });

  it("crosses until the boat lands, then tours until the tutorial is done", () => {
    const a = startArrival(0);
    stepArrival(a, s(30), {});
    stepArrival(a, s(31), { yes: true });
    stepArrival(a, s(40), {});
    expect(a.phase).toBe("crossing");
    expect(stepArrival(a, s(90), {})).toBe(false);
    stepArrival(a, s(91), { landed: true });
    expect(a.phase).toBe("landing");
    stepArrival(a, s(93), { ashore: true });
    expect(a.phase).toBe("tutorial");
    stepArrival(a, s(300), { toured: true });
    expect(a.phase).toBe("done");
    expect(stepArrival(a, s(400), { yes: true, landed: true, ashore: true, toured: true })).toBe(false);
  });

  it("catches up several beats in one step after a long frame", () => {
    const a = startArrival(0);
    stepArrival(a, s(ARRIVAL_TIMES.underwater + ARRIVAL_TIMES.aboard + 5), {});
    expect(a.phase).toBe("creator");
    expect(a.at).toBe(s(ARRIVAL_TIMES.underwater + ARRIVAL_TIMES.aboard));
  });

  it("skips the timed beats one press at a time, never the choice", () => {
    const a = startArrival(0);
    expect(skipArrival(a, s(1))).toBe(true);
    expect(a.phase).toBe("aboard");
    expect(a.at).toBe(s(1));
    expect(skipArrival(a, s(2))).toBe(true);
    expect(a.phase).toBe("creator");
    expect(skipArrival(a, s(3))).toBe(false);
    expect(a.phase).toBe("creator");
    stepArrival(a, s(4), { yes: true });
    expect(skipArrival(a, s(4.5))).toBe(true);
    expect(a.phase).toBe("crossing");
    // The crossing's skip belongs to its boat (the trip): the sequence waits for the landing.
    expect(skipArrival(a, s(5))).toBe(false);
  });

  it("splits the underwater beat into the dark, the rise, the surface and the hand", () => {
    expect(underwaterBeat(0).beat).toBe("dark");
    expect(underwaterBeat(2).beat).toBe("rise");
    const surface = underwaterBeat(ARRIVAL_TIMES.underwater - 1.0);
    expect(["surface", "hand"]).toContain(surface.beat);
    expect(underwaterBeat(ARRIVAL_TIMES.underwater - 0.01).beat).toBe("hand");
    for (const t of [0, 0.5, 1.7, 3.9, 5.3]) {
      const b = underwaterBeat(t);
      expect(b.k).toBeGreaterThanOrEqual(0);
      expect(b.k).toBeLessThanOrEqual(1);
    }
  });

  it("frames the crossing in five shots over about 25 seconds, in order", () => {
    expect(CROSSING_SHOTS.map(c => c.id)).toEqual(["drone", "bow", "closeup", "wake", "wharf"]);
    expect(CROSSING_S).toBeCloseTo(CROSSING_SHOTS.reduce((n, c) => n + c.length, 0));
    expect(CROSSING_S).toBeGreaterThanOrEqual(23);
    expect(CROSSING_S).toBeLessThanOrEqual(27);
    expect(crossingShot(0)).toMatchObject({ index: 0, id: "drone", k: 0 });
    expect(crossingShot(CROSSING_SHOTS[0].length + 0.01).id).toBe("bow");
    expect(crossingShot(CROSSING_S - 0.01).id).toBe("wharf");
    // Past the end it holds the last shot's end.
    expect(crossingShot(CROSSING_S + 3)).toMatchObject({ index: 4, k: 1 });
  });

  it("sharpens a little with each choice, never fully until Yes", () => {
    const a = startArrival(0);
    expect(clarityAt(a, 0)).toBeCloseTo(CLARITY.start);
    stepArrival(a, s(20), {});
    expect(a.phase).toBe("creator");
    const seen = [0, 1, 2, 5, 40].map(n => { a.choices = n; return clarityAt(a, s(20)); });
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(seen[1]).toBeGreaterThan(seen[0]);
    expect(seen[4]).toBeLessThan(1);
    stepArrival(a, s(21), { yes: true });
    expect(clarityAt(a, s(21))).toBeCloseTo(seen[4]);
    expect(clarityAt(a, s(21 + ARRIVAL_TIMES.clearing * 0.999))).toBeGreaterThan(0.99);
    stepArrival(a, s(30), {});
    expect(clarityAt(a, s(30))).toBe(1);
  });
});
