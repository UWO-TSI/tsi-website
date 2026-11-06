import { describe, expect, it } from "vitest";
import { AWAKEN_MS } from "@/components/gui/flat";
import { RODS } from "@/lib/game/rods";
import { AWAKEN_FX, BEAT, MOVES, auraAt, moveOf } from "./rodMotion";

const awakening = RODS.filter(r => r.awakenings.length);
const at = (t: number, e: number, key: string) => moveOf(key)(t, e);

describe("each rod's awakening motion (David 2026-11-05)", () => {
  it("gives every rod that awakens a motion of its own", () => {
    expect(awakening.map(r => r.key).sort()).toEqual(Object.keys(MOVES).sort());
    // Different motions: their poses part ways at the cutscene's height.
    const poses = awakening.map(r => JSON.stringify(at(1.3, 1, r.key)));
    expect(new Set(poses).size).toBe(awakening.length);
  });

  it("is at rest with no energy, so the reveal holds the rod still", () => {
    for (const r of awakening) for (const t of [0, 0.7, 2.9]) {
      const p = at(t, 0, r.key);
      for (const v of [p.x, p.y, p.roll, p.tip, p.twirl, p.flash]) expect(Math.abs(v)).toBeLessThan(1e-9);
      expect(p.sheen).toBeNull();
    }
    expect(BEAT.reveal).toEqual({ energy: 0, glow: 0, aura: 0, shake: 0, gather: 0 });
  });

  it("never stands still on the Tidewarden: it rides a swell up and down and rolls with it", () => {
    const ys = Array.from({ length: 40 }, (_, i) => at(i * 0.1, 1, "rod_tidewarden"));
    expect(Math.max(...ys.map(p => p.y)) - Math.min(...ys.map(p => p.y))).toBeGreaterThan(0.1);
    expect(Math.max(...ys.map(p => Math.abs(p.roll)))).toBeGreaterThan(0.15);
  });

  it("flashes lightning on the Tempest and runs a sheen up the Titanium", () => {
    expect(Array.from({ length: 100 }, (_, i) => at(i * 0.05, 1, "rod_tempest").flash).some(f => f > 0.5)).toBe(true);
    const sheen = Array.from({ length: 30 }, (_, i) => at(i * 0.1, 1, "rod_titanium").sheen!);
    expect(Math.min(...sheen)).toBeLessThan(0.15);
    expect(Math.max(...sheen)).toBeGreaterThan(0.85);
  });

  it("shows the new form alone before the reveal, its glow gone and its motion still going", () => {
    expect(AWAKEN_MS.show).toBeGreaterThan(1000);
    expect(BEAT.show.glow).toBe(0);
    expect(BEAT.show.energy).toBeGreaterThan(0.5);
  });

  it("builds suspense: trembling harder and drawing more light in through the pulse, then still and dim in the hush before the hit", () => {
    expect(BEAT.pulse.shake).toBeGreaterThan(BEAT.glow.shake);
    expect(BEAT.pulse.gather).toBeGreaterThan(BEAT.glow.gather);
    expect(BEAT.hush.energy).toBeLessThan(0.1);
    expect(BEAT.hush.glow).toBeLessThan(BEAT.pulse.glow);
    expect(AWAKEN_MS.hush).toBeGreaterThan(300);
  });

  it("strikes the rods whose awakening brings a new look or effect from outside: the Tempest by lightning", () => {
    expect(AWAKEN_FX.rod_tempest).toMatchObject({ strike: "lightning", sound: "aw-thunder" });
    expect(AWAKEN_FX.rod_tempest.wears).toContain("electricity");
    expect(AWAKEN_FX.rod_tidewarden).toBeUndefined();          // its wave deleted (VFX round 1)
    expect(AWAKEN_FX.rod_training).toBeUndefined();
  });

  it("grows the aura with each awakening", () => {
    expect(auraAt(0)).toBe(1);
    expect(auraAt(2)).toBeGreaterThan(auraAt(1));
  });
});
