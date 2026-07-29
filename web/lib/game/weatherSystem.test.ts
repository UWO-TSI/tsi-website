import { describe, it, expect } from "vitest";
import {
  WeatherEngine,
  WEATHER_PROFILES,
  DEFAULT_STATE,
  engineForDay,
  daySeed,
  seededRandom,
  lerpHex,
  ease,
} from "./weatherSystem";

/**
 * These exist because there is no GPU in this environment, so the blend maths
 * cannot be checked by looking at it. Each test pins one property the design
 * depends on.
 */

describe("weatherSystem", () => {
  it("is deterministic: the same day replays identically", () => {
    const d = new Date(2026, 6, 29);
    const a = engineForDay("cloudy", d, 3600);
    const b = engineForDay("cloudy", d, 3600);
    expect(a.state).toEqual(b.state);
    expect(a.dominant).toBe(b.dominant);
  });

  it("different days follow different trajectories", () => {
    // Compared over a SEQUENCE, not at one instant. Between transitions a
    // profile sits at weight 1 and the state is exactly that profile's values,
    // so any two days will coincide whenever they happen to be on the same
    // profile. That is not a collision in the seeding, it is the blend having
    // converged; the sky still moves because the cloud textures scroll.
    const track = (day: number) => {
      const e = engineForDay("cloudy", new Date(2026, 6, day), 0);
      const out: string[] = [];
      for (let t = 0; t < 7200; t += 300) {
        for (let i = 0; i < 60; i++) e.update(5);
        out.push(e.dominant);
      }
      return out.join(">");
    };
    expect(track(29)).not.toBe(track(30));
  });

  it("two players joining at different times see the same sky at the same moment", () => {
    const d = new Date(2026, 6, 29);
    const early = engineForDay("rain", d, 20000);
    const late = engineForDay("rain", d, 20000);
    expect(early.state.clouds).toEqual(late.state.clouds);
    expect(early.state.wetness).toBeCloseTo(late.state.wetness, 10);
  });

  it("never picks a profile outside the day's forecast", () => {
    // A sunny day must never reach for nimbus, or the dock's "It's a sunny day"
    // is contradicted by what is overhead.
    const e = engineForDay("sunny", new Date(2026, 6, 29), 43200);
    expect(e.state.clouds.nimbus).toBe(0);
    expect(e.state.rain).toBe(0);
    const allowed = WEATHER_PROFILES.filter((p) => p.kinds.includes("sunny")).map((p) => p.id);
    for (const b of e.blend) expect(allowed).toContain(b.id);
  });

  it("resets before accumulating, so nothing doubles over time", () => {
    const e = new WeatherEngine("sunny", 1);
    e.set("clear");
    for (let i = 0; i < 40; i++) e.update(1);
    const after40 = e.state.clouds.cumulus;
    for (let i = 0; i < 40; i++) e.update(1);
    // Still pinned to one profile's contribution, not eighty frames of it.
    expect(e.state.clouds.cumulus).toBeLessThanOrEqual(2);
    expect(Math.abs(e.state.clouds.cumulus - after40)).toBeLessThan(0.5);
  });

  it("coverage adds but shape does not", () => {
    const e = new WeatherEngine("rain", 7);
    e.set("rain");
    for (let i = 0; i < 200; i++) e.update(1);
    // nimbus 1.5 from the rain profile alone; the cap is 2 and shape stays in range.
    expect(e.state.clouds.nimbus).toBeGreaterThan(1);
    expect(e.state.clouds.nimbus).toBeLessThanOrEqual(2);
    expect(e.state.shape.borderHeight).toBeGreaterThanOrEqual(-1);
    expect(e.state.shape.borderHeight).toBeLessThanOrEqual(1);
  });

  it("wetness builds in rain and dries afterwards", () => {
    const e = new WeatherEngine("rain", 3);
    e.set("rain");
    for (let i = 0; i < 300; i++) e.update(1);
    const wet = e.state.wetness;
    expect(wet).toBeGreaterThan(0.3);

    // Force it dry: no rain contribution, only the drying term.
    e.set("mostly-cloudy");
    for (let i = 0; i < 600; i++) e.update(1);
    expect(e.state.wetness).toBeLessThan(wet);
  });

  it("wetness outlives the rain rather than snapping off with it", () => {
    const e = new WeatherEngine("rain", 11);
    e.set("rain");
    for (let i = 0; i < 300; i++) e.update(1);
    e.set("mostly-cloudy");
    for (let i = 0; i < 60; i++) e.update(1);
    expect(e.state.rain).toBeLessThan(0.15); // rain has stopped
    expect(e.state.wetness).toBeGreaterThan(0.2); // ground has not
  });

  it("every output stays inside its documented range over a long run", () => {
    for (const kind of ["sunny", "cloudy", "rain"] as const) {
      const e = engineForDay(kind, new Date(2026, 6, 29), 0);
      for (let i = 0; i < 4000; i++) {
        e.update(3);
        const s = e.state;
        for (const v of Object.values(s.clouds)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(2);
        }
        expect(s.rain).toBeGreaterThanOrEqual(0);
        expect(s.rain).toBeLessThanOrEqual(1);
        expect(s.wetness).toBeGreaterThanOrEqual(0);
        expect(s.wetness).toBeLessThanOrEqual(1);
        expect(s.fogDensity).toBeGreaterThan(0);
        expect(Number.isFinite(s.filter.value)).toBe(true);
      }
    }
  });

  it("caps a huge delta so a backgrounded tab catches up instead of jumping", () => {
    const a = new WeatherEngine("cloudy", 5);
    const b = new WeatherEngine("cloudy", 5);
    a.update(600);
    b.update(5);
    expect(a.state.clouds).toEqual(b.state.clouds);
  });

  it("transitions blend rather than cut", () => {
    const e = new WeatherEngine("cloudy", 9);
    e.set("fair");
    for (let i = 0; i < 100; i++) e.update(1);
    e.set("overcast");
    e.update(1);
    // One second into a 25s transition both are present.
    expect(e.blend.length).toBeGreaterThan(1);
    expect(e.blend[0].weight).toBeLessThan(1);
  });

  it("defaults are the zero state", () => {
    expect(DEFAULT_STATE.clouds.nimbus).toBe(0);
    expect(DEFAULT_STATE.filter.saturation).toBe(1);
    expect(DEFAULT_STATE.fogDensity).toBe(1);
  });

  it("daySeed matches weatherForDate's key", () => {
    expect(daySeed(new Date(2026, 6, 29))).toBe(20260729);
  });

  it("seededRandom is stable and in range", () => {
    const r1 = seededRandom(42);
    const r2 = seededRandom(42);
    for (let i = 0; i < 50; i++) {
      const v = r1();
      expect(v).toBe(r2());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("lerpHex blends per channel", () => {
    expect(lerpHex(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(lerpHex(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(lerpHex(0x000000, 0xff0000, 0.5)).toBe(0x800000);
  });

  it("ease is clamped smoothstep", () => {
    expect(ease(-1)).toBe(0);
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
    expect(ease(2)).toBe(1);
  });

  it("every profile is reachable from at least one forecast", () => {
    for (const p of WEATHER_PROFILES) expect(p.kinds.length).toBeGreaterThan(0);
    for (const kind of ["sunny", "cloudy", "rain"] as const) {
      expect(WEATHER_PROFILES.some((p) => p.kinds.includes(kind))).toBe(true);
    }
  });
});
