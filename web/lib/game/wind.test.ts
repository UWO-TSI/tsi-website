import { describe, expect, it } from "vitest";
import { FRONT_SPACING, FRONT_SPEED, WIND_STRENGTH, frontAt, frontPhase, lastFront, stirs, swellAt } from "./wind";
import { WIND_DIR } from "./worldFx";

describe("wind", () => {
  it("blows hardest on a windy day and barely in fog", () => {
    expect(WIND_STRENGTH.wind).toBeGreaterThan(WIND_STRENGTH.rain);
    expect(WIND_STRENGTH.rain).toBeGreaterThan(WIND_STRENGTH.clear);
    expect(WIND_STRENGTH.fog).toBeLessThan(WIND_STRENGTH.clear);
  });

  it("swells slowly between 0.7 and 1.3", () => {
    let lo = 2, hi = 0, step = 0;
    for (let t = 0; t < 600; t += 0.5) {
      const s = swellAt(t);
      lo = Math.min(lo, s); hi = Math.max(hi, s);
      step = Math.max(step, Math.abs(swellAt(t + 1 / 60) - s));
    }
    expect(lo).toBeGreaterThanOrEqual(0.7);
    expect(hi).toBeLessThanOrEqual(1.3);
    expect(step).toBeLessThan(0.01);
  });

  it("rolls each front downwind at its speed", () => {
    // A crest found at (0, 0) is FRONT_SPEED × dt further downwind dt seconds later (the bow along it aside).
    const t0 = 1_800_000_000.25;
    const crestAt = (t: number) => {
      let best = -1, at = 0;
      for (let s = 0; s < FRONT_SPACING; s += 0.05) { const v = frontAt(WIND_DIR.x * s, WIND_DIR.z * s, frontPhase(t)); if (v > best) { best = v; at = s; } }
      return at;
    };
    const a = crestAt(t0), b = crestAt(t0 + 1);
    expect(((b - a + FRONT_SPACING) % FRONT_SPACING)).toBeCloseTo(FRONT_SPEED, 0);
  });

  it("rises quickly to a crest and eases off behind it, never above 1", () => {
    const phase = frontPhase(1_800_000_000);
    let max = 0;
    for (let s = -60; s < 60; s += 0.25) max = Math.max(max, frontAt(WIND_DIR.x * s, WIND_DIR.z * s, phase));
    expect(max).toBeGreaterThan(0.2);
    expect(max).toBeLessThanOrEqual(1);
  });

  it("agrees with itself on when the last front passed, the same for every client", () => {
    const t = 1_800_000_123.4, here = lastFront(10, -5, t), later = lastFront(10, -5, t + 0.5, { since: 0, front: 0 });
    expect(here.since).toBeGreaterThanOrEqual(0);
    expect(here.since).toBeLessThan(FRONT_SPACING / FRONT_SPEED);
    if (later.front === here.front) expect(later.since).toBeCloseTo(here.since + 0.5, 5);
    else expect(later.since).toBeLessThan(0.5);
    // At the moment its crest is over the spot the front is at its own strength (0.24 to 1).
    const crest = t - here.since;
    expect(frontAt(10, -5, frontPhase(crest + 0.01))).toBeGreaterThan(0.2);
    expect(stirs(3, here.front, 1)).toBe(true);
    expect(stirs(3, here.front, 0)).toBe(false);
  });
});
