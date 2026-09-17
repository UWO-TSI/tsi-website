import { describe, expect, it } from "vitest";
import { FISH, type FishDef } from "./fishing";
import { advanceFishingReel, createFishingReel } from "./fishingReel";

function seededRandom() {
  let seed = 92381;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function fight(fish: FishDef, fps: number) {
  const state = createFishingReel(fish);
  const random = seededRandom();
  for (let frame = 0; frame < fps * 12; frame++) {
    advanceFishingReel(state, 1 / fps, Math.floor(frame / fps) % 2 === 0, 0.8, random);
  }
  return state;
}

describe("fishing reel simulation", () => {
  it.each(["fish_dace", "fish_black_bass", "fish_golden_koi"])("matches %s fights across 15–120 FPS", (key) => {
    const fish = FISH.find(f => f.key === key)!;
    const baseline = fight(fish, 60);
    for (const fps of [15, 30, 120]) {
      const state = fight(fish, fps);
      for (const field of ["position", "velocity", "fishPosition", "fishVelocity", "progress", "elapsed", "tension"] as const) {
        expect(state[field]).toBeCloseTo(baseline[field], 10);
      }
      expect(state.result).toBe(baseline.result);
    }
  });

  it("bounds both actors and finishes exactly once at caught or escaped", () => {
    const fish = FISH[0];
    for (const holding of [true, false]) {
      const state = createFishingReel(fish);
      const random = seededRandom();
      for (let i = 0; i < 3600 && state.result === null; i++) {
        advanceFishingReel(state, 1 / 60, holding, 1, random);
        expect(state.position).toBeGreaterThanOrEqual(0);
        expect(state.position + state.barWidth).toBeLessThanOrEqual(1);
        expect(state.fishPosition).toBeGreaterThanOrEqual(0);
        expect(state.fishPosition).toBeLessThanOrEqual(1);
      }
      expect(state.result).not.toBeNull();
      expect([0, 1]).toContain(state.progress);
      const completed = { ...state };
      advanceFishingReel(state, 10, !holding, 1, random);
      expect(state).toEqual(completed);
    }
  });

  it("limits a suspended frame to 100 ms of catch-up", () => {
    const state = createFishingReel(FISH[0]);
    advanceFishingReel(state, 30, false, 1, seededRandom());
    expect(state.elapsed).toBeCloseTo(0.1);
    expect(state.result).toBeNull();
    const before = { ...state };
    advanceFishingReel(state, -1, false, 1);
    expect(state).toEqual(before);
  });

  it("lands a fish held inside the bar and leaves the completed result stable", () => {
    const fish = { ...FISH[0], move: { ...FISH[0].move, speed: 0, accel: 0, jitter: 0 } };
    const state = createFishingReel(fish);
    for (let i = 0; i < 300; i++) advanceFishingReel(state, 1 / 60, false, 1, seededRandom());
    expect(state.result).toBe(true);
    expect(state.progress).toBe(1);
    const completed = { ...state };
    advanceFishingReel(state, 0.1, true, 1);
    expect(state).toEqual(completed);
  });
});
