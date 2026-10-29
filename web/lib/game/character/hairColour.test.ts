import { describe, expect, it } from "vitest";
import { hairShift, hexToOklab, NO_SHIFT, oklabToHex, oklchToOklab, shiftedMedian, shiftTexel as shifted, type Oklch } from "./hairColour";

const hue = ([, a, b]: [number, number, number]) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
const chroma = ([, a, b]: [number, number, number]) => Math.hypot(a, b);

describe("a hair colour recolours the hair's own texture, lightness too (round 3, David 2026-10-27)", () => {
  it("round-trips sRGB through OKLab", () => {
    for (const hex of ["#000000", "#FFFFFF", "#C25B3A", "#6F8FC9", "#2B211C", "#F0A3B5"]) expect(oklabToHex(hexToOklab(hex))).toBe(hex);
  });
  it("leaves the texture as drawn with no colour picked", () => {
    expect(NO_SHIFT).toEqual({ m: [1, 0, 0, 1], o: [0, 0], l: 0.5, L: [1, 0] });
    const texel: [number, number, number] = [0.42, 0.03, -0.05];
    expect(shifted(texel, NO_SHIFT)).toEqual(texel);
  });
  it("lands a coloured texture's median on the picked colour exactly, a darker strand staying darker", () => {
    const blue: Oklch = [0.62, 0.09, 250];                       // a blue hair's median
    const s = hairShift(blue, "#C25B3A");
    const target = hexToOklab("#C25B3A"), median = shifted(oklchToOklab(blue), s);
    expect(median[0]).toBeCloseTo(target[0], 6);                 // the picked lightness
    expect(hue(median)).toBeCloseTo(hue(target), 4);
    expect(chroma(median)).toBeCloseTo(chroma(target), 4);
    const strand = shifted(oklchToOklab([0.3, 0.06, 245]), s);
    expect(strand[0]).toBeLessThan(median[0] - 0.15);            // its shading kept around the colour
    expect(hue(strand)).toBeCloseTo(hue(target) - 5, 3);
  });
  it("makes a black hair blond: every texel light, the strands still telling apart", () => {
    const black: Oklch = [0.2, 0, 90], blond = hexToOklab("#E8BE48");
    const s = hairShift(black, "#E8BE48");
    expect(s.m.every(x => x === 0)).toBe(true);                   // no hue to turn
    const median = shifted([0.2, 0, 0], s), shadow = shifted([0.05, 0, 0], s), sheen = shifted([0.45, 0, 0], s);
    expect(median[0]).toBeCloseTo(blond[0], 6);
    expect(chroma(median)).toBeCloseTo(chroma(blond), 6);
    expect(hue(median)).toBeCloseTo(hue(blond), 4);
    expect(shadow[0]).toBeGreaterThan(0.65);                      // blond, not black, in the deepest shadow
    expect(sheen[0] - shadow[0]).toBeCloseTo(0.2, 6);             // the range squeezed to half, never flat
    expect(chroma(sheen)).toBeLessThan(chroma(median));           // a pale sheen
  });
  it("makes a white hair dark and stays inside black and white", () => {
    const s = hairShift([0.92, 0.01, 90], "#2B211C");
    const L = [0.5, 0.92, 1].map(x => shifted([x, 0, 0], s)[0]);
    expect(L[1]).toBeCloseTo(hexToOklab("#2B211C")[0], 6);
    expect(L[0]).toBeGreaterThanOrEqual(0);
    expect(L[0]).toBeLessThan(L[1]);
    expect(L[2]).toBeGreaterThan(L[1]);
  });
  it("names the under-cap's colour: the picked colour itself, the median with no colour picked", () => {
    const m: Oklch = [0.3369, 0.0126, 41.61];
    expect(shiftedMedian(m, NO_SHIFT)).toBe(oklabToHex(oklchToOklab(m)));
    expect(shiftedMedian(m, hairShift(m, "#E8BE48"))).toBe("#E8BE48");
    expect(shiftedMedian([0.2, 0, 90], hairShift([0.2, 0, 90], "#DA6E2A"))).toBe("#DA6E2A");
  });
});
