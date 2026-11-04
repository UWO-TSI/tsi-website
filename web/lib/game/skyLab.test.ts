import { describe, expect, it } from "vitest";
import { gustAt, moonPhase, parseSkyLab, sharedWindAt, type SharedWind } from "./skyLab";

describe("skyLab", () => {
  it("parses the switches and drops unknown values", () => {
    const s = parseSkyLab("?sky=B&wind=storm&amb=motes,bogus,swirls&skytilt=12&skyface=sun");
    expect(s).toMatchObject({ sky: "B", wind: "storm", tilt: 12, face: "sun" });
    expect([...s.amb]).toEqual(["motes", "swirls"]);
    expect(parseSkyLab("?sky=D&wind=gale&skyface=up")).toMatchObject({ sky: null, wind: null, tilt: 0, face: null });
  });

  it("gusts stay in 0..1 and change slowly", () => {
    let lo = 1, hi = 0, step = 0;
    for (let t = 0; t < 600; t += 0.5) {
      const g = gustAt(t);
      lo = Math.min(lo, g); hi = Math.max(hi, g);
      step = Math.max(step, Math.abs(gustAt(t + 1 / 60) - g));
    }
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi - lo).toBeGreaterThan(0.6);
    expect(step).toBeLessThan(0.02);
  });

  it("a storm blows harder than a breeze, a breeze than a calm, at every moment", () => {
    const w: SharedWind = { dirX: 0, dirZ: 0, strength: 0, gust: 0 };
    for (let t = 0; t < 300; t += 7) {
      const calm = sharedWindAt("calm", t, w).strength, breeze = sharedWindAt("breeze", t, w).strength, storm = sharedWindAt("storm", t, w).strength;
      expect(calm).toBeLessThan(breeze);
      expect(breeze).toBeLessThan(storm);
      expect(Math.hypot(w.dirX, w.dirZ)).toBeCloseTo(1);
    }
  });

  it("the moon's phase matches known dates", () => {
    const off = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
    expect(off(moonPhase(Date.UTC(2024, 3, 8, 18, 21)), 0)).toBeLessThan(0.02); // the April 2024 eclipse: new
    expect(off(moonPhase(Date.UTC(2024, 8, 18, 2, 34)), 0.5)).toBeLessThan(0.02); // full, 2024-09-18
  });
});
