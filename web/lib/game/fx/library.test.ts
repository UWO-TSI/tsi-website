import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FX, fxAt, fxGrow, type FxKind } from "./library";

const KINDS = Object.keys(FX) as FxKind[];

describe("the effects library (David 2026-11-05)", () => {
  it("has the standard types, each said in plain words with how it's made and its parameters", () => {
    expect(KINDS.sort()).toEqual(["aura", "burst", "electricity", "embers", "flame", "flicker", "gather", "glow", "motion", "particles", "petals", "pulse", "sparks", "sway", "trail", "water"]);
    for (const k of KINDS) {
      expect(FX[k].what.length).toBeGreaterThan(10);
      expect(FX[k].authored.length).toBeGreaterThan(10);
      expect(Object.keys(FX[k].params).length).toBeGreaterThan(0);
    }
  });

  it("is as made at strength 1, and what grows only grows with strength", () => {
    for (const k of KINDS) for (const [name, q] of Object.entries(FX[k].params)) {
      expect(fxAt(k, name, 1)).toBe(q.value);
      expect(fxGrow(k, name, 2)).toBeGreaterThanOrEqual(1);
    }
    expect(fxGrow("pulse", "size", 2)).toBeGreaterThan(1);      // the orb grows
    expect(fxGrow("motion", "spin", 2)).toBe(2);
    // the water: more foam, reaching all of its grown water by 2.5, more drops
    expect(fxGrow("water", "foam", 2.5)).toBeGreaterThan(1);
    expect(fxAt("water", "wrap", 2.5) - 1).toBeCloseTo(1, 2);
    expect(fxAt("water", "splashes", 2.5)).toBeGreaterThan(fxAt("water", "splashes", 1));
  });

  it("makes no discs or rings of light", () => {
    expect(KINDS.some(k => /halo|ring|circle|disc/i.test(k + FX[k].name))).toBe(false);
  });

  it("has the Water type's sample (every other type is drawn by code on any holder: HolderFx)", () => {
    expect(existsSync(join(__dirname, "../../../public/assets/game/props/fxlib-water.glb"))).toBe(true);
  });
});
