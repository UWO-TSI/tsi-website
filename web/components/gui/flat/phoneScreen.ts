/**
 * The phone's own screen (round 13; design bible UI 8d; David on round 12: "the ui and app design needs to be redone to
 * fit the theme", "should have pixel wash but shouldnt be pixel wash over pixel, should be 1 and lighter"). Its own
 * design, not the game's menus: pearl and lime, drawn as pixel art on the screen's own grid (SCREEN, each pixel a
 * square TEX texture pixels wide), so it carries one pixel finish, finer than the island's, and nothing samples it
 * down again. The style only is from David's DS reference (stepped frames, a dark outer and a light inner line, a pill
 * band, square tiles, a pointing hand): the frames, the icons and the font are our own. Colours: the theme's
 * --ui-phone-* tokens (and --ui-heart for a count).
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
export const ICONS: Record<string, readonly string[]> = {
  settings: [
    ".......oo.......", "......ollo......", "......ollo......", "..oo.ollllo.oo..",
    ".ollollllllollo.", ".olllloooollllo.", "..ollo....ollo..", "...olo....olo...",
    "...olo....odo...", "..ollo....oddo..", ".ollllooooddddo.", ".ollollldddoddo.",
    "..oo.oldddo.oo..", "......oddo......", "......oddo......", ".......oo.......",
  ],
  quests: [
    "....oooooooo....", "..oooddddddooo..", ".owwoossssoowwo.", ".owwwoooooowwwo.",
    ".owwwwwwwwwwwwo.", ".owwwwlwwwwwwwo.", ".owlwlwwoooowwo.", ".owwlwwwwwwwwwo.",
    ".owwwwwwwwwwwwo.", ".owwwwlwwwwwwwo.", ".owlwlwwoooowwo.", ".owwlwwwwwwwwwo.",
    ".owwwwwwwwwwwwo.", ".owwwwwwwwwwwso.", ".oooooooooooooo.", "................",
  ],
  bag: [
    "......oooo......", ".....o....o.....", ".....o....o.....", "..oooooooooooo..",
    ".osssssssssssdo.", ".ollllllllllldo.", ".ollloooooolldo.", ".ollowwwwwwoldo.",
    ".ollowwoowwoldo.", ".ollowwwwwwoldo.", ".ollowwwwwwoldo.", ".ollloooooolldo.",
    ".ollllllllllldo.", ".oddddddddddddo.", "..oooooooooooo..", "................",
  ],
  collection: [
    "................", ".oooooooooooo...", "olllllllllllloo.", "ollwwwwwwwwllohh",
    "ollwwwwwwwwllohh", "ollwoooooowllohh", "ollwwwwwwwwllohh", "ollwoooowwwllo..",
    "ollwwwwwwwwllo..", "ollwwwwwwwwllo..", "olllllllllllloo.", "odddddddddddddo.",
    "owwwwwwwwwwwwwo.", "owwwwwwwwwwwwwo.", ".oooooooooooooo.", "................",
  ],
  friends: [
    "................", "...ooo..........", "..olllo...ooo...", ".olllllo.owwwo..",
    ".olllllo.owwwwo.", ".olllllooowwwwo.", "..olllo..owwwo..", "...ooo....ooo...",
    ".ooooooo........", "olllllllooooooo.", "ollllllloowwwwwo", "olllllllowwwwwwo",
    "olllllllowwwwwwo", "olllllllowwwwwwo", "oooooooooooooooo", "................",
  ],
  mail: [
    "................", "................", "................", "oooooooooooooooo",
    "olowwwwwwwwwwolo", "owlowwwwwwwwolwo", "owwlowwwwwwolwwo", "owwwlowwwwolwwwo",
    "owwwwloooolwwwwo", "owwwwwllllwwwwwo", "owwwwwwwwwwwwwwo", "owwwwwwwwwwwwwwo",
    "oooooooooooooooo", "................", "................", "................",
  ],
  profile: [
    "................", "oooooooooooooooo", "olllllllllllllll", "oddddddddddddddo",
    "owwwwwwwwwwwwwwo", "owoooowwwwwwwwwo", "owollowooooooowo", "owollowwwwwwwwwo",
    "owoooowoooooowwo", "owllllwwwwwwwwwo", "owllllwoooowwwwo", "owwwwwwwwwwwwwwo",
    "owwwwwwwwwwwwwwo", "oooooooooooooooo", "................", "................",
  ],
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

/** The pointing hand on the keyboard's pick (round 11's), and the home bar's house. */
const HAND = ["..ooo....", ".owwwoooo", "owwwwwwwo", "owwwwoooo", "owwwwwo..", ".owwsso..", "..oooo..."];
const HOUSE = ["...o...", "..ooo..", ".ooooo.", "ooooooo", ".o...o.", ".o.o.o.", ".ooooo."];
/** The band's marks: a clover, a heart and a star (the phone's own motifs). */
const MARKS = [
  ["ll.ll", "lldll", "..d..", "lldll", "ll.ll"], [".w.w.", "wwwww", "wwwww", ".www.", "..w.."], ["..l..", ".lll.", "lllll", ".lll.", ".l.l."],
];
const TILE = [2, 1], SCREEN_CUT = [5, 3, 2, 1, 1];

export interface ScreenApp { id: string; label: string; keyLabel?: string; badge?: number }
/**
 * The home screen, in the screen's own pixels: the frame round the glass on a pearl lattice, a band with the signal,
 * the marks and the battery, the apps as square tiles two across (each its own pixel icon over its name), and the home
 * bar with the key that puts the phone away. The pick (hovered or the keyboard's) turns lime and lifts a pixel.
 */
export function drawHome(g: G, apps: readonly ScreenApp[], pick: { at: number | null; keys: boolean }, hint: string | undefined, ink: Ink,
  fallback: readonly (CanvasImageSource | null)[] = []) {
  const L = screenLayout(apps.length), { w: W, h: H } = SCREEN;
  g.setTransform(TEX, 0, 0, TEX, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = ink.p; g.fillRect(0, 0, W, H);
  // The frame round the glass, and inside it a faint lattice of diagonals, as on the reference's back.
  frame(g, 1, 1, W - 2, H - 2, SCREEN_CUT, ink.o, ink.w, ink.p);
  g.fillStyle = ink.q;
  for (let y = 5; y < H - 5; y++) for (let x = 3 + (y % 8); x < W - 3; x += 8) { g.fillRect(x, y, 1, 1); g.fillRect(W - 1 - x, y, 1, 1); }
  // The band: the signal, the marks and the battery.
  const [bx, by, bw, bh] = L.bar;
  box(g, bx, by, bw, bh, [2, 1], ink.o);
  g.fillStyle = ink.l;
  for (let i = 0; i < 3; i++) g.fillRect(bx + 5 + i * 3, by + bh - 3 - i, 2, 1 + i);
  MARKS.forEach((m, i) => sprite(g, m, Math.round(W / 2 - 10 + i * 7), by + 3, ink));
  g.fillStyle = ink.w; g.fillRect(bx + bw - 15, by + 3, 9, 5); g.fillRect(bx + bw - 6, by + 4, 1, 3);
  g.fillStyle = ink.o; g.fillRect(bx + bw - 14, by + 4, 7, 3);
  g.fillStyle = ink.l; g.fillRect(bx + bw - 14, by + 4, 5, 3);
  // The apps.
  L.tiles.forEach(([x, y0, w, h], i) => {
    const a = apps[i], on = pick.at === i, y = y0 - (on ? 1 : 0);
    box(g, x, y0 + 1, w, h, TILE, on ? ink.d : ink.q);  // its shadow: deeper when it lifts
    if (on) box(g, x - 1, y - 1, w + 2, h + 2, [3, 1], ink.l);
    frame(g, x, y, w, h, TILE, ink.o, on ? ink.l : ink.w, on ? ink.s : ink.w);
    box(g, x + 2, y + h - 4, w - 4, 2, [], on ? ink.l : ink.s);
    const icon = ICONS[a.id], ix = Math.round(x + (w - 16) / 2), iy = y + 4;
    if (icon) sprite(g, icon, ix, iy, ink);
    else if (fallback[i]) g.drawImage(fallback[i]!, ix, iy, 16, 16);
    text(g, a.label, x + w / 2, y + 22, ink.o, true);
    if (a.keyLabel) {
      const kw = textWidth(a.keyLabel) + 4;
      box(g, x + 3, y + 3, kw, 9, [1], ink.o); text(g, a.keyLabel, x + 5, y + 4, ink.w);
    }
    if (a.badge) {
      const n = a.badge > 9 ? "9+" : String(a.badge), bw2 = Math.max(9, textWidth(n) + 5);
      box(g, x + w - bw2 - 2, y + 2, bw2, 9, [2, 1], ink.h); text(g, n, x + w - 2 - bw2 / 2, y + 3, ink.w, true);
    }
    if (on && pick.keys) sprite(g, HAND, x - 4, y + Math.round(h / 2) - 3, ink);
  });
  // The home bar: the house and the key that puts it away; lime when picked.
  const [hx, hy, hw, hh] = L.home, homeOn = pick.at === apps.length;
  frame(g, hx, hy, hw, hh, [2, 1], ink.o, homeOn ? ink.l : ink.w, homeOn ? ink.s : ink.w);
  const content = 7 + (hint ? 3 + textWidth(hint) : 0), cx = Math.round(hx + (hw - content) / 2);
  sprite(g, HOUSE, cx, hy + 2, { ...ink, o: homeOn ? ink.d : ink.o });
  if (hint) text(g, hint, cx + 10, hy + 2, ink.o);
}
