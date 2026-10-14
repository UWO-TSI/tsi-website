import { describe, expect, it } from "vitest";
import { CLIP_BY_NAME } from "@/lib/game/character/look";
import { BAR_S, BEAT_S, DANCE_CLIPS, GROUP_RADIUS, beatError, beatRate, danceGroups, isDance, loopPhase } from "./danceSync";

describe("group dance sync maths (specs/v1-drop.md §3)", () => {
  it("every dance loops on whole bars of the shared beat", () => {
    expect(BEAT_S).toBe(0.5);
    expect(BAR_S).toBe(4 * BEAT_S);
    for (const clip of DANCE_CLIPS) {
      const c = CLIP_BY_NAME.get(clip)!;
      expect(c.loop, clip).toBe(true);
      const bars = c.length / BAR_S;
      expect(Math.abs(bars - Math.round(bars)), `${clip} is ${c.length} s`).toBeLessThan(1e-6);
    }
    expect(isDance("DanceRobot")).toBe(true);
    expect(isDance("Sit")).toBe(false);
  });

  it("groups dancers within about 6 steps of each other, chains included", () => {
    const g = new Int16Array(8);
    // A and B 5 apart, C 5.5 from B (11 from A), D alone 20 away.
    const n = danceGroups([0, 5, 10.5, 40], [0, 0, 0, 0], 4, g);
    expect(n).toBe(2);
    expect(g[0]).toBe(g[1]);
    expect(g[1]).toBe(g[2]);
    expect(g[3]).not.toBe(g[0]);
    expect(GROUP_RADIUS).toBe(6);
    expect(danceGroups([0, 6.01], [0, 0], 2, g)).toBe(2);
    expect(danceGroups([0, 0], [0, 5.99], 2, g)).toBe(1);
    expect(danceGroups([], [], 0, g)).toBe(0);
  });

  it("locks a loop's phase to the world clock: the same clock gives everyone the same phase", () => {
    expect(loopPhase(10, 2)).toBeCloseTo(0);
    expect(loopPhase(10.5, 2)).toBeCloseTo(0.25);
    expect(loopPhase(11.5, 4)).toBeCloseTo(0.875);
    // A one-bar loop and a two-bar loop hit their downbeats together.
    for (const t of [0, 2, 4, 86398]) expect(loopPhase(t, 2) % 1).toBeCloseTo(0);
    expect(loopPhase(4, 4)).toBeCloseTo(0);
    // The world clock wraps at 86 400 s, a whole number of bars: no jump in phase.
    expect(86_400 % BAR_S).toBe(0);
    expect(86_400 % (2 * BAR_S)).toBe(0);
  });

  it("measures the error the short way round the loop", () => {
    expect(beatError(0.1, 0.3, 2)).toBeCloseTo(0.2);
    expect(beatError(1.9, 0.1, 2)).toBeCloseTo(0.2); // ahead across the wrap
    expect(beatError(0.1, 1.9, 2)).toBeCloseTo(-0.2);
  });

  it("eases a dancer onto the beat within a second and a half from the farthest off, never stopping or racing", () => {
    const L = 2, dt = 1 / 60;
    let time = 0.7, clock = 100; // 0.7 s behind the bar's start → error -0.7
    for (let f = 0; f < 90; f++) {
      const rate = beatRate(time, clock, L, dt);
      expect(rate).toBeGreaterThanOrEqual(0.3);
      expect(rate).toBeLessThanOrEqual(2);
      time = (time + dt * rate) % L;
      clock += dt;
    }
    expect(Math.abs(beatError(time, clock, L))).toBeLessThan(0.02);
    // On the beat already: plays at its own pace.
    expect(beatRate(1, 101, 2, dt)).toBeCloseTo(1);
  });

  it("copes with a big step (a Reduced remote's 15 Hz mixer) without overshooting", () => {
    const L = 2, dt = 1 / 15;
    let time = 0, clock = 0.3;
    for (let f = 0; f < 15; f++) {
      const before = Math.abs(beatError(time, clock, L));
      time = (time + dt * beatRate(time, clock, L, dt)) % L;
      clock += dt;
      expect(Math.abs(beatError(time, clock, L))).toBeLessThanOrEqual(before + 1e-9);
    }
  });
});
