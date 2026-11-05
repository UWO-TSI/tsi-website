import { describe, expect, it } from "vitest";
import { ICONS, drawHome, text, textWidth, type Ink } from "./phoneScreen";
import { SCREEN, screenLayout } from "./phoneMotion";

/** A 2D context that only records the pixels drawn (in the screen's own pixels). */
function fake() {
  const rects: [number, number, number, number][] = [];
  const g = { fillStyle: "", imageSmoothingEnabled: true, setTransform() {}, fillRect: (x: number, y: number, w: number, h: number) => { rects.push([x, y, w, h]); }, drawImage() {} };
  return { g: g as unknown as CanvasRenderingContext2D, rects };
}
const INK: Ink = { o: "o", w: "w", p: "p", q: "q", l: "l", d: "d", s: "s", h: "h" };
const APPS = [
  { id: "settings", label: "Settings" }, { id: "quests", label: "Quests", keyLabel: "J" }, { id: "bag", label: "Bag", keyLabel: "I" },
  { id: "collection", label: "Collection", keyLabel: "B" }, { id: "friends", label: "Friends", badge: 12 }, { id: "mail", label: "Mail", keyLabel: "L", badge: 2 },
];

describe("the phone's screen", () => {
  it("has a 16 by 16 pixel icon for every app, in the phone's inks only", () => {
    for (const a of [...APPS, { id: "profile" }]) {
      const rows = ICONS[a.id];
      expect(rows, a.id).toHaveLength(16);
      for (const r of rows) { expect(r).toHaveLength(16); expect(r).toMatch(/^[.owpqldsh]+$/); }
    }
  });
  it("writes every glyph inside its 8 rows, a pixel apart", () => {
    const { g, rects } = fake();
    const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:!?-'/+*#()@_";
    text(g, all, 0, 0, "o");
    expect(Math.max(...rects.map(r => r[1]))).toBeLessThan(8);
    expect(Math.max(...rects.map(r => r[0]))).toBeLessThan(textWidth(all));
  });
  it("fits each app's name in its tile", () => {
    const [, , w] = screenLayout(6).tiles[0];
    for (const a of APPS) expect(textWidth(a.label), a.label).toBeLessThanOrEqual(w - 4);
  });
  it("draws the home screen inside the glass, on whole pixels", () => {
    const { g, rects } = fake();
    drawHome(g, APPS, { at: 4, keys: true }, "X", INK);
    for (const [x, y, w, h] of rects) {
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(SCREEN.w); expect(y + h).toBeLessThanOrEqual(SCREEN.h);
      for (const n of [x, y, w, h]) expect(Number.isInteger(n)).toBe(true);
    }
  });
});
