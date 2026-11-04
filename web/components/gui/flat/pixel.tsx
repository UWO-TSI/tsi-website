"use client";

/**
 * The phone screen's pixel art (round 11, design bible UI 8d; David, 2026-11-04: "phone ui reference, change color but
 * keep the pixel-y style"). Our own tiny drawings, one character a pixel, drawn on a canvas in the theme's --ui-phone-*
 * colours and scaled up by a whole number (PX, the world's pixel finish) without smoothing, so every pixel stays a
 * square the size of the island's. The frames are 9-slices (CSS border-image); the icons and the hand are drawn as is.
 *   o outline (deep green)   w cream   m mint   d deep mint   y star yellow   a the icon's tone (the keyword library's)
 */
import { useLayoutEffect, useRef } from "react";
import { PIXEL_FINISH } from "@/lib/game/qualityTier";
import { KEYWORD_LIBRARY, type KeywordKind } from "./keyword";

/** CSS pixels per art pixel: the world's pixel finish, so the phone's pixels match the island's. */
export const PX = PIXEL_FINISH;

const INK: Record<string, string> = { o: "--ui-phone-ink", w: "--ui-phone-cream", m: "--ui-phone-mint", d: "--ui-phone-mint-deep", y: "--ui-phone-star" };

/** A whole sprite from its top-left quarter, whose last row and column are the middle (pills, the screen's frame). */
export function mirror(q: readonly string[]): string[] {
  const row = (s: string) => s + [...s.slice(0, -1)].reverse().join("");
  const top = q.map(row);
  return [...top, ...top.slice(0, -1).reverse()];
}

export const SPRITES = {
  /** The screen's frame: a dark line, a cream line inside it, a curl in each corner (9-slice, corner 8). */
  frame: mirror([
    "...ooooo",
    "..owwwww",
    ".ow.....",
    "ow..oo..",
    "ow.o..o.",
    "ow.o.oo.",
    "ow..o...",
    "ow......",
  ]),
  /** An app's tile: a pixel border, cream, a mint shade bottom right (9-slice, corner 3). */
  tile: [
    ".ooooo.",
    "owwwwwo",
    "owwwwmo",
    "owwwwmo",
    "owwwwmo",
    "ommmmmo",
    ".ooooo.",
  ],
  /** The hovered or selected app: mint, a star-yellow ring outside the border (9-slice, corner 4, drawn 1 out). */
  tileOn: [
    ".yyyyyyy.",
    "yyoooooyy",
    "yowwwwwoy",
    "yowmmmdoy",
    "yowmmmdoy",
    "yowmmmdoy",
    "yodddddoy",
    "yyoooooyy",
    ".yyyyyyy.",
  ],
  /** The title pill (9-slice, corner 4) and a key's cap (corner 2): deep green with a cream rim. */
  pill: mirror(["...ww", "..woo", ".wooo", "woooo", "woooo"]),
  key: mirror([".ww", "woo", "woo"]),
  /** The home bar's button: cream in a dark line; mint when hovered (9-slice, corner 3). */
  button: mirror(["..oo", ".oww", "owww", "owww"]),
  buttonOn: mirror(["..oo", ".omm", "ommm", "ommm"]),
  /** The pointing hand on the selected app. */
  hand: [
    "..ooo....",
    ".owwwoooo",
    "owwwwwwwo",
    "owwwwoooo",
    "owwwwwo..",
    ".owwmmo..",
    "..oooo...",
  ],
  /** The title pill's marks: a clover, a heart, a star (the phone's own motifs). */
  clover: ["mm.mm", "mmdmm", "..d..", "mmdmm", "mm.mm"],
  heart: [".w.w.", "wwwww", "wwwww", ".www.", "..w.."],
  star: ["..y..", ".yyy.", "yyyyy", ".yyy.", ".y.y."],
} as const;

/** The apps' icons, 12 by 12, by the keyword library's kind (their tone is its tone). */
export const PIXEL_ICONS = {
  settings: [
    "....oooo....",
    ".oo.oaao.oo.",
    ".oaooaaooao.",
    "..oaaaaaao..",
    "oooaaooaaooo",
    "oaaao..oaaao",
    "oaaao..oaaao",
    "oooaaooaaooo",
    "..oaaaaaao..",
    ".oaooaaooao.",
    ".oo.oaao.oo.",
    "....oooo....",
  ],
  quest: [
    ".ooooooooo..",
    "owwowwwwwwo.",
    "owwowaaaawo.",
    ".ooowwwwwwo.",
    "...owaaaawo.",
    "...owwwwwwo.",
    "...owaaawwo.",
    "...owwwwwwo.",
    "...owaaaawo.",
    ".ooooooooooo",
    "owwwwwwwwwwo",
    ".oooooooooo.",
  ],
  bag: [
    "....oooo....",
    "...oa..ao...",
    "..oooooooo..",
    ".oaaaaaaaao.",
    "oaaaaaaaaaao",
    "oaoooooooaao",
    "oaowwwwwoaao",
    "oaowwoowoaao",
    "oaoooooooaao",
    "oaaaaaaaaaao",
    "oaaaaaaaaaao",
    ".oooooooooo.",
  ],
  collection: [
    ".ooooooooo..",
    "oaaaaaoyooo.",
    "oaaaaaoyoaao",
    "oawwwaoyoaao",
    "oaaaaaoooaao",
    "oawwwaaaaaao",
    "oaaaaaaaaaao",
    "oaaaaaaaaaao",
    "oaaaaaaaaaao",
    "oooooooooooo",
    "owwwwwwwwwwo",
    ".oooooooooo.",
  ],
  friend: [
    "............",
    "..ooo.......",
    ".oaaao.ooo..",
    ".oaaaoowwwo.",
    ".oaaaoowwwo.",
    "..ooo.owwwo.",
    ".ooooo.ooo..",
    "oaaaaaooooo.",
    "oaaaaaowwwwo",
    "oaaaaaowwwwo",
    "ooooooowwwwo",
    "......oooooo",
  ],
  mail: [
    "............",
    "............",
    "oooooooooooo",
    "owowwwwwwowo",
    "owwowwwwowwo",
    "owwwowwowwwo",
    "owwwwoowwwwo",
    "owwwwwwwwaao",
    "owwwwwwwwaao",
    "oooooooooooo",
    "............",
    "............",
  ],
} as const satisfies Partial<Record<KeywordKind, readonly string[]>>;
export type PixelIconKind = keyof typeof PIXEL_ICONS;
export const ICON = 12;

/** Draws a sprite at one canvas pixel an art pixel, its colours read from `from`'s theme tokens. */
export function drawSprite(c: HTMLCanvasElement, rows: readonly string[], from: Element, tone?: string) {
  const css = getComputedStyle(from);
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext("2d");
  if (!g) return;
  const ink: Record<string, string> = {};
  for (const [ch, token] of Object.entries(INK)) ink[ch] = css.getPropertyValue(token).trim();
  if (tone) ink.a = css.getPropertyValue(tone).trim();
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ink[ch]) { g.fillStyle = ink[ch]; g.fillRect(x, y, 1, 1); } }));
}
/** A sprite as a CSS image (for a 9-slice's border-image). */
export function spriteUrl(rows: readonly string[], from: Element): string {
  const c = document.createElement("canvas");
  drawSprite(c, rows, from);
  return `url(${c.toDataURL()})`;
}

const toneOf = (kind: PixelIconKind) => `--ui-word-${KEYWORD_LIBRARY.find(k => k.kind === kind)?.tone ?? "item"}`;
/** An app's pixel icon, drawn at the pixel finish's size. */
export function PixelIcon({ kind }: { kind: PixelIconKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => { if (ref.current) drawSprite(ref.current, PIXEL_ICONS[kind], ref.current, toneOf(kind)); }, [kind]);
  return <canvas ref={ref} width={ICON} height={ICON} aria-hidden="true" data-pixel=""
    style={{ width: ICON * PX, height: ICON * PX, imageRendering: "pixelated" }} />;
}
