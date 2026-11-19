import { describe, expect, it } from "vitest";
import { AWAKEN_MS } from "@/components/gui/flat";
import { RODS } from "@/lib/game/rods";
import { AWAKEN_FX, BEAT, MOVES, auraAt, gatherAt, moveOf } from "./rodMotion";

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

  it("strikes the Tempest with lightning; winds the Tidewarden's water on instead (round 11: its wave strike is gone)", () => {
    expect(AWAKEN_FX.rod_tempest).toMatchObject({ strike: "lightning", sound: "aw-thunder" });
    expect(AWAKEN_FX.rod_tempest.wears).toContain("electricity");
    const tide = AWAKEN_FX.rod_tidewarden;
    expect(tide.strike).toBeUndefined();
    // a little further on each beat of the pulse, drawn off in the hush, crashing on at the hit, settling at the reveal
    expect(tide.strength!("pulse", 12)).toBeGreaterThan(tide.strength!("pulse", 0));
    expect(tide.strength!("hush", 20)).toBeLessThan(tide.strength!("pulse", 20));
    expect(tide.strength!("burst", 20)).toBeGreaterThan(tide.strength!("reveal", 20));
    expect(tide.strength!("reveal", 20)).toBe(1);
    expect(AWAKEN_FX.rod_training).toBeUndefined();
  });

  it("gathers light in small and slow, building on every beat of the pulse (round 11)", () => {
    expect(gatherAt("glow", 0)).toBeLessThan(0.5);
    expect(gatherAt("pulse", 20)).toBeGreaterThan(2 * gatherAt("pulse", 2));
    expect(gatherAt("hush", 20)).toBe(0);
  });

  it("grows the aura with each awakening", () => {
    expect(auraAt(0)).toBe(1);
    expect(auraAt(2)).toBeGreaterThan(auraAt(1));
  });
});
