import { describe, expect, it } from "vitest";
import { BLADE_SIZE, BLADE_VARIANTS, bladeTexture } from "./grassBlades";

const W = BLADE_SIZE * BLADE_VARIANTS;
const sum = (a: Uint8Array) => a.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 7);
/** Opaque texels (alpha past the cut) in rows y0..y1 of the texture. */
const covered = (t: Uint8Array, y0: number, y1: number) => {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) if (t[(y * W + x) * 4 + 3] >= 128) n++;
  return n;
};

describe("the grass blade cards", () => {
  it("draws the village's tufts exactly as before (its grass stays as it is)", () => {
    expect(sum(bladeTexture())).toBe(102854931);
  });

  it("draws the new world's blades long and thin, tapering to a point (grass-wind)", () => {
    const tufts = bladeTexture(), long = bladeTexture(true);
    // Fewer, thinner blades: less of the card is grass at the root.
    expect(covered(long, 0, 8)).toBeLessThan(covered(tufts, 0, 8));
    // Every clump has a blade past the card's middle (the shader stretches the card tall).
    const row = Math.floor(BLADE_SIZE * 0.6);
    for (let v = 0; v < BLADE_VARIANTS; v++) {
      let n = 0;
      for (let x = v * BLADE_SIZE; x < (v + 1) * BLADE_SIZE; x++) if (long[(row * W + x) * 4 + 3] >= 128) n++;
      expect(n).toBeGreaterThan(0);
    }
    // Tapered: much less grass near the tips than at the roots.
    expect(covered(long, BLADE_SIZE - 8, BLADE_SIZE)).toBeLessThan(covered(long, 0, 8) * 0.5);
  });
});
