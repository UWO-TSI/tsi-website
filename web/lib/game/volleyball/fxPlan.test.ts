import { describe, expect, it } from "vitest";
import { BLINK, GRADE_LOOK, HEAT, IMPACT, contactBeat, contactPlan, heatColor, heatOf, impactOk, landScale } from "./fxPlan";
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
    // Round 5 (David: "still needs the text tag just a redesign"): every block has its tag again, whoever blocks.
    expect(contactPlan("block", "good", false, false)).toMatchObject({ shield: true, stamp: "Block" });
    expect(contactPlan("block", "perfect", true, true).stamp).toBe("Block");
    expect(contactPlan("dig", "good", false, true)).toMatchObject({ spray: true, stamp: "Saved" });
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
    expect(contactBeat("block", "good", 10).stop).toBeGreaterThan(contactBeat("spike", "good", 10).stop);
    expect(contactBeat("dig", "good", 5).slow).toBeGreaterThan(0);
  });
  it("sets a perfect spike or serve on fire, nothing else", () => {
    expect(contactPlan("spike", "perfect", true, true).fire).toBe(true);
    expect(contactPlan("serve", "perfect", false, false).fire).toBe(true);
    expect(contactPlan("spike", "good", true, true).fire).toBe(false);
    expect(contactPlan("bump", "perfect", true, true).fire).toBe(false);
  });
  it("heats the trail white to orange to hot pink, and a hot rally ends bigger", () => {
    const c = { r: 0, g: 0, b: 0 };
    expect(heatColor(0, c)).toEqual({ r: 1, g: 1, b: 1 });
    heatColor(1, c);
    expect(c.r).toBe(1); expect(c.b).toBeGreaterThan(0.5);
    expect(heatOf(HEAT.full)).toBe(1);
    expect(landScale(15, HEAT.full)).toBeGreaterThan(landScale(15, 0));
  });
  it("flashes one impact frame on your perfect spike only; your dive's dig flashes your character white instead", () => {
    expect(contactPlan("spike", "perfect", true, true).impact).toBe(true);
    expect(contactPlan("spike", "good", true, true).impact).toBe(false);
    expect(contactPlan("spike", "perfect", false, false).impact).toBe(false);
    // Round 5 (David: "no imact frame just a white flash on the charater"): the dig has no impact frame, only the blink.
    expect(contactPlan("dig", "late", true, true)).toMatchObject({ impact: false, blink: true });
    expect(contactPlan("dig", "good", false, true).blink).toBe(false);
    expect(contactPlan("spike", "perfect", true, true).blink).toBe(false);
    expect(contactPlan("block", "perfect", true, true).impact).toBe(false);
    expect(IMPACT.frames).toBe(1);
    expect(BLINK).toBeGreaterThanOrEqual(4); expect(BLINK).toBeLessThanOrEqual(12);
  });
  it("never flashes back to back, and never under reduced motion or reduced flashing", () => {
    expect(impactOk(10, -99, false)).toBe(true);
    expect(impactOk(10, 10 - IMPACT.gap / 2, false)).toBe(false);
    expect(impactOk(10, 10 - IMPACT.gap - 0.01, false)).toBe(true);
    expect(impactOk(10, -99, true)).toBe(false);
  });
  it("calls: the referee's under the score (Out, Net, Tape), the rest small at the touch; Max on your max toss; the trophy on your win", () => {
    expect(stampOf({ kind: "land", x: 0, z: 0, in: false, speed: 5, heat: 0 }, 0, 0)).toMatchObject({ text: "Out", at: "ref" });
    expect(stampOf({ kind: "toss", who: 0, power: 1, max: true }, 0, 0)).toMatchObject({ text: "Max", at: "hit" });
    expect(stampOf({ kind: "toss", who: 2, power: 1, max: true }, 0, 0)).toBeNull();
    expect(stampOf({ kind: "win", team: 0 }, 0, 0)?.kind).toBe("win");
    expect(stampOf({ kind: "win", team: 1 }, 0, 0)).toBeNull();
    expect(stampOf({ kind: "net", x: 0, y: 1.5 }, 0, 0)).toMatchObject({ kind: "net", at: "ref" });
    expect(stampOf({ kind: "tape", x: 0, y: 2.1 }, 0, 0)?.text).toBe("Tape");
    expect(stampOf({ kind: "contact", who: 0, team: 0, how: "block", timing: "perfect", quality: 1, x: 0, y: 2, z: 0, speed: 9 }, 0, 0)).toMatchObject({ text: "Block", kind: "block", at: "hit" });
    expect(stampOf({ kind: "contact", who: 2, team: 1, how: "block", timing: "good", quality: 0.7, x: 0, y: 2, z: 0, speed: 9 }, 0, 0)).toMatchObject({ kind: "block", team: 1 });
    expect(stampOf({ kind: "contact", who: 0, team: 0, how: "spike", timing: "perfect", quality: 1, x: 0, y: 2, z: 0, speed: 20 }, 0, 0)).toMatchObject({ text: "Perfect", at: "hit" });
    expect(stampOf({ kind: "whiff", who: 0 }, 0, 0)?.kind).toBe("whiff");
    expect(stampOf({ kind: "whiff", who: 2 }, 0, 0)).toBeNull();
  });
});
