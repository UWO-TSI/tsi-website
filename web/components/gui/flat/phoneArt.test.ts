// The slider phone's rendered layers (art/ui/slider_phone.py, art/ui/phone_layers.py): they fit their canvas, the screen
// sits on the top half, the top slides up, and the three files stay small (they are the phone's whole cost).
import { statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHONE_ART as A } from "./phoneArt";

describe("phone art", () => {
  const [cw, ch] = A.canvas;
  it("keeps every layer inside the canvas", () => {
    for (const [x, y, w, h] of Object.values(A.layers)) {
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(cw); expect(y + h).toBeLessThanOrEqual(ch);
    }
  });
  it("puts the screen on the top half and slides the top half up", () => {
    const [x, y, w, h] = A.layers.top;
    for (const [px, py] of [A.screen.tl, A.screen.tr, A.screen.bl]) {
      expect(px).toBeGreaterThan(x); expect(px).toBeLessThan(x + w);
      expect(py).toBeGreaterThan(y); expect(py).toBeLessThan(y + h);
    }
    expect(A.slide[1]).toBeLessThan(-h / 3);
    expect(A.slide[1] + y).toBeGreaterThanOrEqual(0); // the open top half still fits the canvas
  });
  it("ships the three layers in under 120 KB", () => {
    const bytes = (["base", "top", "charm"] as const).reduce((n, l) => n + statSync(`public/assets/ui/phone/${l}.webp`).size, 0);
    expect(bytes).toBeLessThan(120_000);
  });
});
