import { describe, expect, it } from "vitest";
import { hairShift, hexToOklab, NO_SHIFT, oklabToHex, oklchToOklab, shiftedMedian, tent, type HairShift, type Oklch } from "./hairColour";

/** A texel through a shift, as the body shader does it (Character.tsx shiftHair). */
function shifted([L, a, b]: [number, number, number], s: HairShift): [number, number, number] {
  const [m00, m01, m10, m11] = s.m, t = tent(L, s.l);
  return [L, m00 * a + m01 * b + s.o[0] * t, m10 * a + m11 * b + s.o[1] * t];
}
const hue = ([, a, b]: [number, number, number]) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
const chroma = ([, a, b]: [number, number, number]) => Math.hypot(a, b);

describe("a hair colour as a hue and saturation shift of the hair's own texture (round 2, David)", () => {
  it("round-trips sRGB through OKLab", () => {
    for (const hex of ["#000000", "#FFFFFF", "#C25B3A", "#6F8FC9", "#2B211C", "#F0A3B5"]) expect(oklabToHex(hexToOklab(hex))).toBe(hex);
  });
  it("leaves the texture as drawn with no colour picked", () => {
    expect(NO_SHIFT).toEqual({ m: [1, 0, 0, 1], o: [0, 0], l: 0.5 });
    const texel: [number, number, number] = [0.42, 0.03, -0.05];
    expect(shifted(texel, NO_SHIFT)).toEqual(texel);
  });
  it("turns a coloured texture's median onto the picked colour's hue and chroma, every texel keeping its lightness", () => {
    const blue: Oklch = [0.62, 0.09, 250];                       // a blue hair's median
    const s = hairShift(blue, "#C25B3A");
    const target = hexToOklab("#C25B3A"), median = shifted(oklchToOklab(blue), s);
    expect(median[0]).toBe(0.62);                                // lightness kept
    expect(hue(median)).toBeCloseTo(hue(target), 4);
    expect(chroma(median)).toBeCloseTo(chroma(target), 4);
    // a darker strand of the same hair: the same turn, its own lightness
    const strand = shifted(oklchToOklab([0.3, 0.06, 245]), s);
    expect(strand[0]).toBe(0.3);
    expect(hue(strand)).toBeCloseTo(hue(target) - 5, 3);
  });
  it("gives a grey (black or white) texture the picked chroma at its median, less toward black and white", () => {
    const black: Oklch = [0.2, 0, 90];
    const s = hairShift(black, "#C25B3A"), target = hexToOklab("#C25B3A");
    expect(s.m.every(x => x === 0)).toBe(true);                   // no hue to turn
    const median = shifted([0.2, 0, 0], s);
    expect(chroma(median)).toBeCloseTo(chroma(target), 6);
    expect(hue(median)).toBeCloseTo(hue(target), 4);
    expect(chroma(shifted([0.05, 0, 0], s))).toBeCloseTo(chroma(target) * 0.25, 6);    // the deepest shadow: a quarter
    expect(chroma(shifted([0.6, 0, 0], s))).toBeCloseTo(chroma(target) * 0.5, 6);      // a sheen: half
    expect(shifted([1, 0, 0], s)[1]).toBe(0);                                          // white stays white
  });
  it("names the under-cap's colour: the median shifted, the median itself with no colour picked", () => {
    const m: Oklch = [0.3369, 0.0126, 41.61];
    expect(shiftedMedian(m, NO_SHIFT)).toBe(oklabToHex(oklchToOklab(m)));
    expect(hexToOklab(shiftedMedian(m, hairShift(m, "#6F8FC9")))[0]).toBeCloseTo(0.3369, 2);
  });
});
