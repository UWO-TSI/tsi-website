/**
 * A hairstyle's colour, round 2 (David, 2026-10-17: "you really messed up the hair"): every hairstyle draws its own
 * source texture as Roblox does (art/characters/hair/import_hair.py natural_map: hair_colour.png), and a colour the
 * member picks is a hue and saturation shift of that texture, never a flat tint or a shade map: each texel keeps its
 * lightness (OKLab L) exactly, and its chroma is turned and scaled so the texture's median lands on the picked colour.
 * A near-grey source (a black or white hair) has no hue to turn: it takes the picked colour's chroma at its median
 * lightness, less toward black and white (tent), so its strands stay as they are and its sheen stays pale. Two-colour
 * hairs shift each colour on its own.
 *
 * The body shader applies it per texel (Character.tsx): `ab' = M ab + o tent(L)`, tent(L) = min(L / l, (1 - L) / (1 - l))
 * clamped to [0, 1], with M (a 2 x 2 rotation and scale), o and l (the source's median lightness) from hairShift.
 * Identity (M = I, o = 0) draws the texture as it is.
 */

export type Oklch = [L: number, C: number, h: number];
export interface HairShift { m: [number, number, number, number]; o: [number, number]; l: number }
export const NO_SHIFT: HairShift = { m: [1, 0, 0, 1], o: [0, 0], l: 0.5 };
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

/** The shift that moves a texture whose median is `source` onto `target` (sRGB hex), each texel keeping its lightness. */
export function hairShift(source: Oklch, target: string): HairShift {
  const [, at, bt] = hexToOklab(target);
  const [Ls, Cs, hs] = source;
  const Ct = Math.hypot(at, bt);
  const w = Math.min(1, Cs / GREY_C);                   // how coloured the source is: 0 grey, 1 fully
  const k = w * Math.min(3, Ct / Math.max(Cs, 1e-4));
  const turn = Math.atan2(bt, at) - (hs * Math.PI) / 180;
  const [c, s] = [Math.cos(turn), Math.sin(turn)];
  // o: the picked chroma a grey source takes at its median lightness l (the tent)
  return { m: [k * c, -k * s, k * s, k * c], o: [(1 - w) * at, (1 - w) * bt], l: Math.min(0.95, Math.max(0.05, Ls)) };
}

/** The grey part's weight at lightness L: 1 at the source's median, falling to 0 at black and white. */
export const tent = (L: number, l: number) => Math.min(1, Math.max(0, Math.min(L / l, (1 - L) / (1 - l))));

/** The colour a shift makes of the source's median (sRGB hex): the under-cap's, before its shade. */
export function shiftedMedian(source: Oklch, shift: HairShift): string {
  const [L, a, b] = oklchToOklab(source);
  const [m00, m01, m10, m11] = shift.m, t = tent(L, shift.l);
  return oklabToHex([L, m00 * a + m01 * b + shift.o[0] * t, m10 * a + m11 * b + shift.o[1] * t]);
}
