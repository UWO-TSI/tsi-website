import { describe, expect, it } from "vitest";
import { CLASS_KITS } from "@/lib/combat/classes";
import { DEFAULT_RAMP, desaturate, FX, FX_BUDGET, FX_POOLS, rampColor, RampTable, recipeCost, RAMP_STEPS } from "./combat";
import { COMBAT_PACK } from "./combatPack";

describe("the combat FX registry (design sheet §1.7)", () => {
  it("keeps every recipe inside its tier's budget (particles, meshes, decals, lights, life)", () => {
    for (const [key, r] of Object.entries(FX)) {
      const c = recipeCost(r), b = FX_BUDGET[r.tier];
      expect(c.particles, key).toBeLessThanOrEqual(b.particles);
      expect(c.meshes, key).toBeLessThanOrEqual(b.meshes);
      expect(c.decals, key).toBeLessThanOrEqual(b.decals);
      expect(c.lights, key).toBeLessThanOrEqual(b.lights);
      expect(c.life, key).toBeLessThanOrEqual(b.life);
      expect(c.decalLife, key).toBeLessThanOrEqual(b.decalLife);
    }
  });
  it("has a recipe for every vfx key a kit names, and for each hit tier", () => {
    for (const k of CLASS_KITS) for (const a of [...k.keys, ...(k.combos ?? []).map(c => c.ability), k.ult])
      for (const key of Object.values(a.vfx ?? {})) expect(FX[key as string], `${a.key}: ${key}`).toBeDefined();
    for (const t of ["light", "ability", "heavy"]) expect(FX[`hit.${t}`]).toBeDefined();
  });
  it("draws only from the combat pack's rows; the pools hold 1,024 particles", () => {
    for (const r of Object.values(FX)) for (const l of r.layers) {
      if (l.kind === "particles") expect(COMBAT_PACK[l.recipe.sprite]).toBeDefined();
      if (l.kind === "decal") expect(COMBAT_PACK[l.sprite]).toBeDefined();
    }
    expect(FX_POOLS.glow + FX_POOLS.ink).toBe(1024);
  });
});

describe("ramps: heat → edge, mid, white-hot core", () => {
  it("maps heat through the three stops", () => {
    expect(rampColor(DEFAULT_RAMP, 0).map(v => Math.round(v * 255))).toEqual([0x3a, 0x24, 0x66]);
    expect(rampColor(DEFAULT_RAMP, 0.5).map(v => Math.round(v * 255))).toEqual([0xb4, 0x8c, 0xff]);
    expect(rampColor(DEFAULT_RAMP, 1).map(v => Math.round(v * 255))).toEqual([0xff, 0xf6, 0xff]);
  });
  it("keeps ground effects at half saturation (never a telegraph's full hue)", () => {
    const red: [number, number, number] = [1, 0.27, 0.22], d = desaturate(red);
    expect(Math.max(...d) - Math.min(...d)).toBeCloseTo((1 - 0.22) / 2, 5);
  });
  it("gives each ramp one row of the table, once", () => {
    const t = new RampTable(), fire = ["#fff4d6", "#ff8a3d", "#5a1a08"] as const;
    expect(t.row(DEFAULT_RAMP)).toBe(0);
    expect(t.row(fire)).toBe(1);
    expect(t.row(fire)).toBe(1);
    expect(Array.from(t.data.slice(RAMP_STEPS * 4, RAMP_STEPS * 4 + 3))).toEqual([0x5a, 0x1a, 0x08]);
  });
});
