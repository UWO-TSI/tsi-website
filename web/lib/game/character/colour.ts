/**
 * The hair colour wheel's maths (head-v10, row 311; David: "hair color needs more choices like color wheel picker"):
 * sRGB hex to and from hue (degrees), saturation and value (0 to 1), and where a colour sits on the wheel's disc: hue
 * clockwise from the right (the disc's conic gradient starts at 3 o'clock), saturation from the centre out (unit disc,
 * screen axes: y down).
 */
export interface Hsv { h: number; s: number; v: number }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** sRGB "#RRGGBB" to HSV. A grey has no hue: `keepHue` is used for it (the wheel keeps its place while you drag to grey). */
export function hexToHsv(hex: string, keepHue = 0): Hsv {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = keepHue;
  if (d > 0) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = ((h * 60) + 360) % 360;
  }
  return { h, s: max > 0 ? d / max : 0, v: max };
}

/** HSV to sRGB "#RRGGBB" (upper case, as the look stores it). */
export function hsvToHex({ h, s, v }: Hsv): string {
  const c = clamp01(v) * clamp01(s), hh = (((h % 360) + 360) % 360) / 60, x = c * (1 - Math.abs((hh % 2) - 1)), m = clamp01(v) - c;
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map(k => Math.round((k + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** A hue and saturation's point on the unit disc (screen axes: x right, y down). */
export function wheelPoint(h: number, s: number): { x: number; y: number } {
  const a = (h * Math.PI) / 180;
  return { x: Math.cos(a) * s, y: Math.sin(a) * s };
}

/** The hue and saturation under a point on the unit disc (outside it: its rim). */
export function wheelPick(x: number, y: number): { h: number; s: number } {
  const s = Math.min(1, Math.hypot(x, y));
  return { h: s > 0 ? (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360 : 0, s };
}
