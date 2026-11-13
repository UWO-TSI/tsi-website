import { describe, expect, it } from "vitest";
import { HOME_TOKENS, drawHome, text, textWidth, type HomeInk } from "./phoneScreen";
import { SCREEN } from "./phoneMotion";

/** A 2D context that only records what's drawn (in the screen's own pixels): rects, paths' boxes, pictures and words. */
function fake() {
  const boxes: [number, number, number, number][] = [], words: string[] = [];
  const g = {
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "", textBaseline: "", imageSmoothingEnabled: false, setTransform() {},
    fillRect: (x: number, y: number, w: number, h: number) => { boxes.push([x, y, w, h]); }, beginPath() {}, fill() {}, stroke() {},
    roundRect: (x: number, y: number, w: number, h: number) => { boxes.push([x, y, w, h]); }, arc: (x: number, y: number, r: number) => { boxes.push([x - r, y - r, 2 * r, 2 * r]); },
    drawImage: (_: unknown, x: number, y: number, w: number, h: number) => { boxes.push([x, y, w, h]); },
    measureText: (s: string) => ({ width: s.length * 4 }), fillText: (s: string) => { words.push(s); },
  };
  return { g: g as unknown as CanvasRenderingContext2D, boxes, words };
}
const INK = Object.fromEntries(Object.keys(HOME_TOKENS).map(k => [k, k])) as HomeInk;
const APPS = [
  { label: "Settings" }, { label: "Quests", keyLabel: "J" }, { label: "Bag", keyLabel: "I" },
  { label: "Collection", keyLabel: "B" }, { label: "Friends", badge: 12 }, { label: "Mail", keyLabel: "L", badge: 2 },
];

describe("the phone's screen", () => {
  it("writes every glyph inside its 8 rows, a pixel apart", () => {
    const { g, boxes: rects } = fake();
    const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:!?-'/+*#()@_";
    text(g, all, 0, 0, "o");
    expect(Math.max(...rects.map(r => r[1]))).toBeLessThan(8);
    expect(Math.max(...rects.map(r => r[0]))).toBeLessThan(textWidth(all));
  });
  it("draws the home screen (round 12's, today's UI) inside the glass: every app's card, icon, name, key and count", () => {
    const { g, boxes, words } = fake();
    drawHome(g, APPS, APPS.map(() => ({}) as CanvasImageSource), { at: 4, keys: true }, "X", INK, "Nunito");
    for (const [x, y, w, h] of boxes) {
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(SCREEN.w); expect(y + h).toBeLessThanOrEqual(SCREEN.h);
    }
    expect(words).toEqual(expect.arrayContaining([...APPS.map(a => a.label), "J", "I", "B", "L", "9+", "2", "X"]));
  });
});
