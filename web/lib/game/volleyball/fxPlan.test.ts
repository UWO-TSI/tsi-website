import { describe, expect, it } from "vitest";
import { GRADE_LOOK, HEAT, contactBeat, contactPlan, heatColor, heatOf, landScale } from "./fxPlan";
import { stampOf } from "@/components/game/volleyball/VolleyStamps";

describe("the effects' plan", () => {
  it("makes each timing grade read differently: perfect biggest and gold, good clean, early and late soft", () => {
    expect(GRADE_LOOK.perfect.scale).toBeGreaterThan(GRADE_LOOK.good.scale);
    expect(GRADE_LOOK.good.scale).toBeGreaterThan(GRADE_LOOK.early.scale);
    expect(GRADE_LOOK.perfect.tint).not.toBe(GRADE_LOOK.good.tint);
    expect(GRADE_LOOK.early.tint).not.toBe(GRADE_LOOK.late.tint);
    expect(GRADE_LOOK.early.glow || GRADE_LOOK.late.glow).toBe(false);
  });
  it("gives each contact its pieces: speed lines on a clean spike, a shield on a block, spray on a dig", () => {
    expect(contactPlan("spike", "good", true, true).lines).toBe(true);
    expect(contactPlan("spike", "late", true, true).lines).toBe(false);
    expect(contactPlan("block", "good", false, false)).toMatchObject({ shield: true, stamp: "BLOCK!" });
    expect(contactPlan("dig", "good", false, true)).toMatchObject({ spray: true, stamp: "SAVED!" });
    expect(contactPlan("bump", "early", true, true)).toMatchObject({ pulse: true, sand: true, stamp: "Early" });
    // Timing tags are yours only.
    expect(contactPlan("bump", "perfect", false, true).stamp).toBeNull();
  });
  it("beats the camera hardest on a perfect spike, with a slow-mo beat on perfect spikes and serves only", () => {
    const p = contactBeat("spike", "perfect", 20), g = contactBeat("spike", "good", 20), l = contactBeat("spike", "late", 20);
    expect(p.punch).toBeGreaterThan(g.punch);
    expect(g.shake).toBeGreaterThan(l.shake);
    expect(p.slow).toBeGreaterThan(0);
    expect(g.slow).toBe(0);
    expect(contactBeat("serve", "perfect", 15).slow).toBeGreaterThan(0);
    expect(contactBeat("bump", "perfect", 5).slow).toBe(0);
  });
  it("heats the trail white to orange to hot pink, and a hot rally ends bigger", () => {
    const c = { r: 0, g: 0, b: 0 };
    expect(heatColor(0, c)).toEqual({ r: 1, g: 1, b: 1 });
    heatColor(1, c);
    expect(c.r).toBe(1); expect(c.b).toBeGreaterThan(0.5);
    expect(heatOf(HEAT.full)).toBe(1);
    expect(landScale(15, HEAT.full)).toBeGreaterThan(landScale(15, 0));
  });
  it("stamps: OUT on a ball out, MAX! on your max toss, the trophy on your win", () => {
    expect(stampOf({ kind: "land", x: 0, z: 0, in: false, speed: 5, heat: 0 }, 0, 0)?.text).toBe("OUT");
    expect(stampOf({ kind: "toss", who: 0, power: 1, max: true }, 0, 0)?.text).toBe("MAX!");
    expect(stampOf({ kind: "toss", who: 2, power: 1, max: true }, 0, 0)).toBeNull();
    expect(stampOf({ kind: "win", team: 0 }, 0, 0)?.kind).toBe("win");
    expect(stampOf({ kind: "win", team: 1 }, 0, 0)).toBeNull();
  });
});
