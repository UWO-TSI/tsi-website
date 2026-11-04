// The phone on the pixel grid (round 11, bible UI 8d): whole pixels everywhere, the screen on the top half, the app grid
// fitting the screen at every phone size, and the pixel art drawn on its square grid.
import { describe, expect, it } from "vitest";
import { PHONE_ART as A } from "./phoneArt";
import { phoneLayout } from "./phone";
import { ICON, PIXEL_ICONS, PX, SPRITES, mirror } from "./pixel";
import { PIXEL_FINISH } from "@/lib/game/qualityTier";

// The phone's body from the smallest (a short window) to the largest (a phone screen), in CSS px, as world pixels wide.
const BODIES = [150, 180, 196, 220, 280];
const nwOf = (body: number) => Math.round((body * A.canvas[0]) / A.body / PX);

describe("phone pixel layout", () => {
  it("draws at the world's pixel finish", () => expect(PX).toBe(PIXEL_FINISH));
  for (const body of BODIES) {
    const L = phoneLayout(nwOf(body));
    it(`puts every box on whole pixels (body ${body})`, () => {
      const all = [...Object.values(L.layers).flat(), ...L.screen, ...L.slide, ...L.pivot, L.h, L.tile];
      for (const v of all) expect(Number.isInteger(v)).toBe(true);
    });
    it(`keeps the screen on the top half and the slide up (body ${body})`, () => {
      const [x, y, w, h] = L.layers.top, [sx, sy, sw, sh] = L.screen;
      expect(sx).toBeGreaterThan(x); expect(sy).toBeGreaterThan(y);
      expect(sx + sw).toBeLessThan(x + w); expect(sy + sh).toBeLessThan(y + h);
      expect(L.slide[0]).toBe(0); expect(L.slide[1]).toBeLessThan(-h / 3);
    });
    it(`fits three tiles across and two rows down with the frame (body ${body})`, () => {
      const [, , sw, sh] = L.screen;
      expect(L.tile).toBeGreaterThanOrEqual(ICON + 4);
      expect(3 * L.tile + 2 * 2 + 8).toBeLessThanOrEqual(sw);
      expect(2 * (L.tile + 7) + 3 + 19).toBeLessThanOrEqual(sh);
    });
  }
  it("grows the tiles with the phone", () => {
    const tiles = BODIES.map(b => phoneLayout(nwOf(b)).tile);
    expect([...tiles].sort((a, b) => a - b)).toEqual(tiles);
    expect(tiles[0]).toBeLessThan(tiles[tiles.length - 1]);
  });
});

describe("phone pixel art", () => {
  const known = /^[.owmdya]+$/;
  const square = (rows: readonly string[], w: number, h = w) => {
    expect(rows).toHaveLength(h);
    for (const r of rows) { expect(r).toHaveLength(w); expect(r).toMatch(known); }
  };
  it("mirrors a quarter into a whole symmetric sprite", () => {
    const m = mirror(["ab", "cd"]);
    expect(m).toEqual(["aba", "cdc", "aba"]);
  });
  it("draws the 9-slices at their slice sizes", () => {
    square(SPRITES.frame, 15); square(SPRITES.tile, 7); square(SPRITES.tileOn, 9);
    square(SPRITES.pill, 9); square(SPRITES.key, 5); square(SPRITES.button, 7); square(SPRITES.buttonOn, 7);
  });
  it("draws the hand, the marks and every app icon on their grids", () => {
    square(SPRITES.hand, 9, 7);
    for (const m of [SPRITES.clover, SPRITES.heart, SPRITES.star]) square(m, 5);
    for (const icon of Object.values(PIXEL_ICONS)) square(icon, ICON);
  });
});
