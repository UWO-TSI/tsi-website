import { describe, expect, it } from "vitest";
import { CRACK, SECTION_GAP, SECTION_PUSH, SECTION_TILT, openSections, sectionAt, spinOf, spinningAt, unlockOf } from "./sections";

describe("an awakened rod's floating sections (rod-titanium round 3)", () => {
  it("stands open at rest, and opens one section at a time from the bottom in the awakening", () => {
    expect(sectionAt(3, 7, null)).toEqual({ open: 1, shake: false, cracked: true });
    // halfway through the unlocks: the bottom three cracked, the fourth shaking, the rest shut
    const at = Array.from({ length: 7 }, (_, i) => sectionAt(i, 7, { seq: 3.25 / 7, float: 0 }));
    expect(at.map(a => a.open)).toEqual([CRACK, CRACK, CRACK, 0, 0, 0, 0]);
    expect(at.map(a => a.shake)).toEqual([false, false, false, true, false, false, false]);
    // the burst floats them all
    expect(sectionAt(6, 7, { seq: 1, float: 1 }).open).toBe(1);
  });

  it("turns each section the other way from the one below, and only once it floats", () => {
    for (let i = 0; i < 6; i++) expect(Math.sign(spinOf(i))).toBe(-Math.sign(spinOf(i + 1)));
    expect(spinningAt(0)).toBe(0);
    expect(spinningAt(CRACK)).toBe(0);
    expect(spinningAt(1)).toBe(1);
  });

  it("finds the unlock on the nearest ancestor", () => {
    const top = { parent: null, userData: { unlock: { seq: 0.5, float: 0 } } }, mid = { parent: top, userData: {} }, rod = { parent: mid, userData: {} };
    expect(unlockOf(rod)).toEqual({ seq: 0.5, float: 0 });
    expect(unlockOf({ parent: null, userData: {} })).toBeNull();
  });

  it("opens a still picture the way the shader does: each plate out from its foot, leaning outwards", () => {
    // one plate of section 0 facing +x: a point at its foot's pivot and one straight above it
    const pos = new Float32Array([0.02, 0.1, 0, 0.02, 0.2, 0]), uv = [0, 0, 0, 0];
    openSections(pos, null, uv, [0.1, 0.02], () => 0);
    expect(pos[0]).toBeCloseTo(0.02 * (1 + SECTION_PUSH) + SECTION_GAP);
    expect(pos[1]).toBeCloseTo(0.1);
    expect(pos[3] - pos[0]).toBeCloseTo(0.1 * Math.sin(SECTION_TILT));
    expect(pos[4]).toBeCloseTo(0.1 + 0.1 * Math.cos(SECTION_TILT));
  });
});
