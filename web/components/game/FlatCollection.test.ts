import { describe, expect, it } from "vitest";
import { peekAt } from "./FlatCollection";

// The collection's hover card (specs/polish/flat-ui.md round 2), placed in the grid's own box.
describe("the hover card's place", () => {
  const box = { left: 100, top: 50, width: 900 };
  it("sits above a tile with room over it, centred on the tile", () => {
    expect(peekAt(box, { left: 400, top: 500, bottom: 630, width: 160 }, 90)).toEqual({ x: 380, y: 442, above: true });
  });
  it("goes under a tile near the top of the visible area", () => {
    expect(peekAt(box, { left: 400, top: 140, bottom: 270, width: 160 }, 90)).toEqual({ x: 380, y: 228, above: false });
  });
  it("stays inside the grid's box at either edge", () => {
    expect(peekAt(box, { left: 100, top: 500, bottom: 630, width: 100 }, 90).x).toBe(135);
    expect(peekAt(box, { left: 940, top: 500, bottom: 630, width: 60 }, 90).x).toBe(765);
  });
});
