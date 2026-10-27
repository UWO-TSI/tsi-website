/**
 * A hairstyle's colour. Every hairstyle draws its own source texture as Roblox does (art/characters/hair/import_hair.py
 * natural_map: hair_colour.png), and a colour the member picks recolours that texture, never a flat tint or a shade map.
 * Round 3 (David, 2026-10-27: "when changing to blond all the hair takes that hue of blond"; reverses 2026-10-17's
 * keep-lightness rule): the picked colour sets the hair's colour fully, lightness too. The texture's median lands on
 * the picked colour exactly (OKLab L, hue and chroma), and every texel keeps its light and dark around it: its lightness
 * moves with the median (L' = s L + d, s squeezing the texture's range only as far as it must to fit, never below half),
 * its chroma is turned and scaled as the median's is. A near-grey source (a black or white hair) has no hue to turn: it
 * takes the picked colour's chroma at the new median lightness, less toward black and white (tent), so its sheen stays
 * pale. Two-colour hairs shift each colour on its own. The under-cap takes the shifted median, darkened by its COLOR_0.
 *
 * The body shader applies it per texel (Character.tsx): `L' = s L + d`, `ab' = M ab + o tent(L')`, tent(L') =
 * min(L' / l, (1 - L') / (1 - l)) clamped to [0, 1], with M (a 2 x 2 rotation and scale), o, l (the picked colour's
 * lightness) and [s, d] from hairShift. Identity (M = I, o = 0, [1, 0]) draws the texture as it is.
 */

export type Oklch = [L: number, C: number, h: number];
export interface HairShift { m: [number, number, number, number]; o: [number, number]; l: number; L: [s: number, d: number] }
export const NO_SHIFT: HairShift = { m: [1, 0, 0, 1], o: [0, 0], l: 0.5, L: [1, 0] };
/** Below this chroma a source counts as grey (its hue is noise): the picked colour's chroma is laid in instead. */
const GREY_C = 0.04;

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToOklab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

export function oklabToHex([L, a, b]: [number, number, number]): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return "#" + rgb.map(c => Math.round(Math.min(1, Math.max(0, linearToSrgb(Math.max(0, c)))) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export const oklchToOklab = ([L, C, h]: Oklch): [number, number, number] => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];

/** The shift that moves a texture whose median is `source` onto `target` (sRGB hex), each texel keeping its light and dark around it. */
export function hairShift(source: Oklch, target: string): HairShift {
  const [Lt, at, bt] = hexToOklab(target);
  const [Ls, Cs, hs] = source;
  const Ct = Math.hypot(at, bt);
  const w = Math.min(1, Cs / GREY_C);                   // how coloured the source is: 0 grey, 1 fully
  const k = (w * Ct) / Math.max(Cs, 1e-4);              // w / Cs <= 1 / GREY_C: the turned part and o sum to the picked chroma
  const turn = Math.atan2(bt, at) - (hs * Math.PI) / 180;
  const [c, s] = [Math.cos(turn), Math.sin(turn)];
  // the lightness: the median onto the picked colour's, the range squeezed only as far as it must to stay in [0, 1]
  const ls = Math.max(0.5, Math.min(1, Lt / Math.max(Ls, 1e-4), (1 - Lt) / Math.max(1 - Ls, 1e-4)));
  // o: the picked chroma a grey source takes at the picked lightness l (the tent)
  return { m: [k * c, -k * s, k * s, k * c], o: [(1 - w) * at, (1 - w) * bt], l: Math.min(0.95, Math.max(0.05, Lt)), L: [ls, Lt - ls * Ls] };
}

/** A texel (OKLab) through a shift, as the body shader does it (Character.tsx shiftHair). */
export function shiftTexel([L, a, b]: [number, number, number], s: HairShift): [number, number, number] {
  const [m00, m01, m10, m11] = s.m, L2 = Math.min(1, Math.max(0, s.L[0] * L + s.L[1])), t = tent(L2, s.l);
  return [L2, m00 * a + m01 * b + s.o[0] * t, m10 * a + m11 * b + s.o[1] * t];
}

/** The grey part's weight at lightness L: 1 at l (the picked colour's), falling to 0 at black and white. */
export const tent = (L: number, l: number) => Math.min(1, Math.max(0, Math.min(L / l, (1 - L) / (1 - l))));

/** The colour a shift makes of the source's median (sRGB hex): the under-cap's, before its shade (COLOR_0, 0.55). */
export const shiftedMedian = (source: Oklch, shift: HairShift) => oklabToHex(shiftTexel(oklchToOklab(source), shift));
