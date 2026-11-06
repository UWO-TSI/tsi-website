/**
 * The phone's screen (design bible UI 8d). The home screen is today's game UI on the glass (round 12's, back in round 14,
 * David: "no i like the old ui i lied, keep it old but lewss blurry"): a slim status line, white cards two across (the
 * app's icon from the icon library over its name in the kit's font), green highlights, and the home bar. Drawn smooth
 * at TEX texture pixels a screen pixel; its one light pixel finish is phone.tsx's sharp pass (a CSS pixel a pixel).
 * The pixel helpers (round 13's font, sprites and stepped frames) draw the moments on the glass, like setting it up
 * (components/game/hq/PhoneSignup.tsx). Colours: the theme's --ui-* tokens.
 */
import { SCREEN, TEX, screenLayout } from "./phoneMotion";

/** The phone's pixel font: 8 rows a glyph (capitals and digits 6 tall, lowercase from row 2, descenders to row 7). */
const GLYPHS: Record<string, string> = {
  A: ".##./#..#/#..#/####/#..#/#..#", B: "###./#..#/###./#..#/#..#/###.", C: ".###/#.../#.../#.../#.../.###",
  D: "###./#..#/#..#/#..#/#..#/###.", E: "####/#.../###./#.../#.../####", F: "####/#.../###./#.../#.../#...",
  G: ".###/#.../#.##/#..#/#..#/.###", H: "#..#/#..#/####/#..#/#..#/#..#", I: "###/.#./.#./.#./.#./###",
  J: "..##/...#/...#/...#/#..#/.##.", K: "#..#/#.#./##../#.#./#..#/#..#", L: "#.../#.../#.../#.../#.../####",
  M: "#...#/##.##/#.#.#/#...#/#...#/#...#", N: "#..#/##.#/#.##/#..#/#..#/#..#", O: ".##./#..#/#..#/#..#/#..#/.##.",
  P: "###./#..#/#..#/###./#.../#...", Q: ".##./#..#/#..#/#..#/#.#./.#.#", R: "###./#..#/#..#/###./#.#./#..#",
  S: ".###/#.../.##./...#/...#/###.", T: "###/.#./.#./.#./.#./.#.", U: "#..#/#..#/#..#/#..#/#..#/.##.",
  V: "#...#/#...#/#...#/.#.#./.#.#./..#..", W: "#...#/#...#/#...#/#.#.#/##.##/#...#",
  X: "#..#/#..#/.##./.##./#..#/#..#", Y: "#.#/#.#/#.#/.#./.#./.#.", Z: "####/...#/..#./.#../#.../####",
  a: "..../..../.###/#..#/#..#/.###", b: "#.../#.../###./#..#/#..#/###.", c: ".../.../.##/#../#../.##",
  d: "...#/...#/.###/#..#/#..#/.###", e: "..../..../.##./####/#.../.###", f: ".##/#../###/#../#../#..",
  g: "..../..../.###/#..#/#..#/.###/...#/.##.", h: "#.../#.../###./#..#/#..#/#..#", i: "#/./#/#/#/#",
  j: ".#/../.#/.#/.#/.#/.#/#.", k: "#../#../#.#/##./#.#/#.#", l: "#/#/#/#/#/#",
  m: "...../...../####./#.#.#/#.#.#/#.#.#", n: "..../..../###./#..#/#..#/#..#", o: "..../..../.##./#..#/#..#/.##.",
  p: "..../..../###./#..#/#..#/###./#.../#...", q: "..../..../.###/#..#/#..#/.###/...#/...#",
  r: ".../.../#.#/##./#../#..", s: "..../..../.###/##../..##/###.", t: ".#./.#./###/.#./.#./..#",
  u: "..../..../#..#/#..#/#..#/.###", v: ".../.../#.#/#.#/#.#/.#.", w: "...../...../#...#/#.#.#/#.#.#/.#.#.",
  x: "..../..../#..#/.##./.##./#..#", y: "..../..../#..#/#..#/#..#/.###/...#/.##.",
  z: "..../..../####/..#./.#../####", "0": ".##./#..#/#.##/##.#/#..#/.##.", "1": ".#./##./.#./.#./.#./###",
  "2": ".##./#..#/..#./.#../#.../####", "3": "###./...#/.##./...#/...#/###.", "4": "#..#/#..#/####/...#/...#/...#",
  "5": "####/#.../###./...#/...#/###.", "6": ".##./#.../###./#..#/#..#/.##.", "7": "####/...#/..#./.#../.#../.#..",
  "8": ".##./#..#/.##./#..#/#..#/.##.", "9": ".##./#..#/#..#/.###/...#/.##.", " ": "../../../../../..",
  ".": "./././././#", ",": "./././././#/#", ":": "./#/././#/.", "!": "#/#/#/#/./#",
  "?": ".##./#..#/..#./.#../..../.#..", "-": ".../.../###/.../.../...", "'": "#/#/./././.",
  "/": "...#/..#./..#./.#../.#../#...", "+": ".../.../.#./###/.#./...", "*": ".../.../#.#/.#./#.#/...",
  "#": "...../.#.#./#####/.#.#./#####/.#.#.", "(": ".#/#./#./#./#./.#", ")": "#./.#/.#/.#/.#/#.",
  "@": ".###./#...#/#.###/#.#.#/#.##./.###.", "_": "..../..../..../..../..../####",
};
/** The ink each art character stands for. */
export type Ink = Record<"o" | "w" | "p" | "q" | "l" | "d" | "s" | "h", string>;
export const INK_TOKENS: Ink = {
  o: "--ui-phone-ink", w: "--ui-phone-white", p: "--ui-phone-pearl", q: "--ui-phone-pearl-2",
  l: "--ui-phone-lime", d: "--ui-phone-lime-deep", s: "--ui-phone-lime-soft", h: "--ui-heart",
};
type G = CanvasRenderingContext2D;

/** A text's width in screen pixels (a pixel between glyphs). */
export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += (GLYPHS[ch] ?? GLYPHS["?"]).indexOf("/") + 1;
  return Math.max(0, w - 1);
}
/** Text at (x, y), its top left (or its middle with `centre`), one rect a pixel. */
export function text(g: G, s: string, x: number, y: number, ink: string, centre = false) {
  g.fillStyle = ink;
  let at = Math.round(centre ? x - textWidth(s) / 2 : x);
  for (const ch of s) {
    const rows = (GLYPHS[ch] ?? GLYPHS["?"]).split("/");
    rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === "#") g.fillRect(at + c, y + r, 1, 1); });
    at += rows[0].length + 1;
  }
}
/** A sprite (rows of art characters; "." is clear), its top left at (x, y). */
export function sprite(g: G, rows: readonly string[], x: number, y: number, ink: Ink) {
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const fill = ink[ch as keyof Ink];
    if (fill) { g.fillStyle = fill; g.fillRect(x + c, y + r, 1, 1); }
  }));
}
/** A box with stepped corners: `cut` is how far each row from the top (and the bottom) is cut in at both sides. */
export function box(g: G, x: number, y: number, w: number, h: number, cut: readonly number[], fill: string) {
  g.fillStyle = fill;
  for (let r = 0; r < h; r++) {
    const c = cut[Math.min(r, h - 1 - r)] ?? 0;
    g.fillRect(x + c, y + r, w - 2 * c, 1);
  }
}
/** The reference's frame: a dark line, a light line inside it, then the fill (the corners step in with them). */
export function frame(g: G, x: number, y: number, w: number, h: number, cut: readonly number[], line: string, inner: string, fill: string) {
  box(g, x, y, w, h, cut, line);
  box(g, x + 1, y + 1, w - 2, h - 2, cut.slice(1), inner);
  box(g, x + 2, y + 2, w - 4, h - 4, cut.slice(2), fill);
}

/** The pointing hand on the keyboard's pick (round 11's pixel hand): o its outline, w its fill. */
const HAND = ["..ooo....", ".owwwoooo", "owwwwwwwo", "owwwwoooo", "owwwwwo..", ".owwwwo..", "..oooo..."];
/** The home screen's inks (the game UI's tokens). */
export type HomeInk = Record<"screen" | "card" | "ink" | "ink2" | "line" | "glow" | "glowSoft" | "pill" | "badge" | "badgeInk" | "shade", string>;
export const HOME_TOKENS: HomeInk = {
  screen: "--ui-phone-screen", card: "--ui-card", ink: "--ui-ink", ink2: "--ui-ink-2", line: "--ui-line", glow: "--ui-phone-glow",
  glowSoft: "--ui-phone-glow-soft", pill: "--ui-pill", badge: "--ui-heart", badgeInk: "--ui-accent-ink", shade: "--ui-shade",
};
const round = (g: G, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

export interface ScreenApp { label: string; keyLabel?: string; badge?: number }
/**
 * The home screen, in the screen's own pixels (SCREEN, drawn at TEX times): the status line, the app cards (each its
 * icon, a picture of the library's drawing, over its name), and the home bar with the key that puts the phone away.
 * The pick (hovered or the keyboard's) turns green and lifts a pixel; the keyboard's gets the pixel hand.
 */
export function drawHome(g: G, apps: readonly ScreenApp[], icons: readonly (CanvasImageSource | null)[], pick: { at: number | null; keys: boolean },
  hint: string | undefined, ink: HomeInk, font: string) {
  const L = screenLayout(apps.length);
  g.setTransform(TEX, 0, 0, TEX, 0, 0);
  g.imageSmoothingEnabled = true;
  g.fillStyle = ink.screen; g.fillRect(0, 0, SCREEN.w, SCREEN.h);
  // The status line: the signal and the battery, quiet.
  g.fillStyle = ink.ink2;
  for (let i = 0; i < 3; i++) g.fillRect(8 + i * 3, 7 - i * 1.5, 2, 1.5 + i * 1.5);
  g.strokeStyle = ink.ink2; g.lineWidth = 1; round(g, SCREEN.w - 19.5, 3.5, 10, 5, 1.2); g.stroke();
  g.fillRect(SCREEN.w - 9, 5, 1.2, 2); g.fillStyle = ink.glow; g.fillRect(SCREEN.w - 18, 5, 7, 2);
  g.textAlign = "center"; g.textBaseline = "middle";
  L.tiles.forEach(([x, y, w, h], i) => {
    const a = apps[i], on = pick.at === i, lift = on ? -1 : 0;
    // A white card in a soft shadow; picked, it's green (round 12: "green highlights") and up a pixel.
    g.fillStyle = `rgb(${ink.shade} / 0.13)`; round(g, x, y + 1.5, w, h, 6); g.fill();
    g.fillStyle = on ? ink.glowSoft : ink.card; round(g, x, y + lift, w, h, 6); g.fill();
    g.lineWidth = on ? 1.6 : 0.8; g.strokeStyle = on ? ink.glow : ink.line; round(g, x + 0.4, y + lift + 0.4, w - 0.8, h - 0.8, 5.6); g.stroke();
    const icon = icons[i];
    if (icon) g.drawImage(icon, x + w / 2 - 9, y + lift + 5, 18, 18);
    let size = 8.5;
    g.font = `800 ${size}px ${font}`;
    while (size > 6 && g.measureText(a.label).width > w - 6) g.font = `800 ${(size -= 0.5)}px ${font}`;
    g.fillStyle = ink.ink; g.fillText(a.label, x + w / 2, y + lift + h - 8.5);
    if (a.keyLabel) {
      g.fillStyle = ink.pill; round(g, x + 3, y + lift + 3, 9, 9, 2.5); g.fill();
      g.fillStyle = ink.ink2; g.font = `800 6.5px ${font}`; g.fillText(a.keyLabel, x + 7.5, y + lift + 7.8);
    }
    if (a.badge) {
      g.fillStyle = ink.badge; g.beginPath(); g.arc(x + w - 5, y + lift + 5, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink.badgeInk; g.font = `800 6px ${font}`; g.fillText(a.badge > 9 ? "9+" : String(a.badge), x + w - 5, y + lift + 5.4);
    }
    if (on && pick.keys) HAND.forEach((row, r) => [...row].forEach((ch, col) => {
      if (ch === ".") return;
      g.fillStyle = ch === "o" ? ink.ink : ink.card; g.fillRect(x - 3 + col * 1.5, y + lift + h / 2 - 5 + r * 1.5, 1.5, 1.5);
    }));
  });
  // The home bar: a pill with the key that puts it away; green when picked.
  const [hx, hy, hw, hh] = L.home, homeOn = pick.at === apps.length;
  g.fillStyle = homeOn ? ink.glow : ink.pill; round(g, hx, hy, hw, hh, hh / 2); g.fill();
  if (hint) { g.fillStyle = homeOn ? ink.card : ink.ink2; g.font = `800 6.5px ${font}`; g.fillText(hint, hx + hw / 2, hy + hh / 2 + 0.4); }
}
