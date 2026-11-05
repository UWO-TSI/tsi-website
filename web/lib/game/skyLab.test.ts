import { describe, expect, it } from "vitest";
import { gustAt, parseSkyLab, sharedWindAt, type SharedWind } from "./skyLab";

describe("skyLab", () => {
  it("parses the switches and drops unknown values", () => {
    const s = parseSkyLab("?wind=storm&amb=motes,bogus&skytilt=12&skyface=sun");
    expect(s).toMatchObject({ wind: "storm", tilt: 12, face: "sun" });
    expect([...s.amb]).toEqual(["motes"]);
    expect(parseSkyLab("?wind=gale&skyface=up")).toMatchObject({ wind: null, tilt: 0, face: null });
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
});
