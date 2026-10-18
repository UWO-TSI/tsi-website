import { describe, expect, it } from "vitest";
import { ATLAS, ROW, RUNS, STRAP_L, SIDE_PX, flatLay, printUv, runSamples } from "./lanyardFlat";

describe("the lanyard laid flat", () => {
  it("maps the print into its own rows of the atlas: the outside in rows 0-4, the inside in 5-9", () => {
    expect(printUv("outside", 0, 0)).toEqual([0, 0]);
    expect(printUv("inside", 0, 0)[1]).toBeCloseTo((5 * ROW) / ATLAS);
    const [, vEnd] = printUv("inside", STRAP_L, 1);
    expect(vEnd).toBeCloseTo((10 * ROW) / ATLAS, 3);
    // the second row starts at the 1024th pixel of the side
    const s = (ATLAS * STRAP_L) / SIDE_PX;
    expect(printUv("outside", s + 1e-6, 0)[0]).toBeCloseTo(0, 3);
    expect(printUv("outside", s + 1e-6, 0)[1]).toBeCloseTo(ROW / ATLAS, 3);
  });

  it("samples every row's start, so no quad stretches across two rows", () => {
    const ss = runSamples(0, STRAP_L);
    for (let r = 1; r < 5; r++) expect(ss.some(x => Math.abs(x - (r * ATLAS * STRAP_L) / SIDE_PX) < 1e-9)).toBe(true);
    const lay = flatLay();
    for (let i = 0; i < lay.index.length; i += 3) {
      const us = [0, 1, 2].map(k => lay.uv[lay.index[i + k] * 2]);
      expect(Math.max(...us) - Math.min(...us)).toBeLessThan(0.2);     // a wrap would span the atlas
    }
  });

  it("reads both prints left to right: s grows with x along each run, the top run the outside, the bottom the quote", () => {
    expect(RUNS[0].front).toBe("outside");
    expect(RUNS[0].y).toBeGreaterThan(RUNS[1].y);
    expect(RUNS[1].front).toBe("inside");
    expect(RUNS[1].s0).toBeLessThan(0.1);                                // the quote from its start
    const lay = flatLay();
    // front faces (normal +z) of the first run: u grows with x inside a row
    let checked = 0;
    for (let i = 0; i + 1 < lay.position.length / 3; i += 4) {
      if (lay.normal[i * 3 + 2] !== 1 || lay.uv[i * 2 + 1] > 0.99) continue;   // front faces of the runs (not the navy fold)
      const x0 = lay.position[i * 3], x1 = lay.position[(i + 1) * 3], u0 = lay.uv[i * 2], u1 = lay.uv[(i + 1) * 2];
      if (x1 > x0) { expect(u1).toBeGreaterThan(u0); checked++; }
    }
    expect(checked).toBeGreaterThan(50);
  });
});
