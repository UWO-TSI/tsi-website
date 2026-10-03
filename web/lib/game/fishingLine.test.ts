import { describe, expect, it } from "vitest";
import { LINE_POINTS, lineCurve, lineTarget, type LineLook } from "./fishingLine";

const look = (patch: Partial<LineLook> = {}): LineLook => ({ sag: 0, sway: 0, wave: 0, hum: 0, ...patch });
const pts = () => new Float32Array(LINE_POINTS * 3);
const at = (p: Float32Array, i: number) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
const mid = (LINE_POINTS - 1) / 2;

describe("the fishing line", () => {
  // The tip up by the angler, the bobber's eye on the water 3 units out.
  const A = [0, 1.6, 0] as const, B = [0, 0.05, 3] as const;
  it("runs exactly from the rod's tip to the bobber's eye", () => {
    const p = lineCurve(...A, ...B, look({ sag: 0.1, sway: 1, wave: 0.2, hum: 0.01 }), 0.8, 0.3, 1.234, 0, pts());
    expect(at(p, 0)).toEqual([...A].map(Math.fround));
    expect(at(p, LINE_POINTS - 1)).toEqual([...B].map(Math.fround));
  });
  it("is straight when taut and still", () => {
    const p = lineCurve(...A, ...B, look(), 0.8, 0.3, 2, -1, pts());
    for (let i = 0; i < LINE_POINTS; i++) {
      const u = i / (LINE_POINTS - 1), [x, y, z] = at(p, i);
      expect(x).toBeCloseTo(0, 5); expect(y).toBeCloseTo(1.6 + (0.05 - 1.6) * u, 5); expect(z).toBeCloseTo(3 * u, 5);
    }
  });
  it("sags below the chord by its share of the length, and never under the water", () => {
    const len = Math.hypot(1.55, 3), p = lineCurve(...A, ...B, look({ sag: 0.09 }), 0, 0, 0, -1, pts());
    expect(at(p, mid)[1]).toBeCloseTo((1.6 + 0.05) / 2 - 0.09 * len, 4);
    const deep = lineCurve(...A, ...B, look({ sag: 0.6 }), 0, 0, 0, 0.02, pts());
    for (let i = 1; i < LINE_POINTS - 1; i++) expect(at(deep, i)[1]).toBeGreaterThanOrEqual(0.024 - 1e-6);
  });
  it("sways with the world's wind across it, the same way on every client", () => {
    const calm = lineCurve(...A, ...B, look({ sag: 0.09, sway: 1 }), 0, 0, 3, -1, pts());
    const windy = lineCurve(...A, ...B, look({ sag: 0.09, sway: 1 }), 3.4, 0, 3, -1, pts());
    expect(Math.abs(at(windy, mid)[0] - at(calm, mid)[0])).toBeGreaterThan(0.02);
    const again = () => lineCurve(...A, ...B, look({ sag: 0.09, sway: 1, hum: 0.01, wave: 0.1 }), 3.4, 0, 3.21, -1, pts());
    expect(again()).toEqual(again());
  });
  it("hangs slack while it floats, goes tight on the bite and tighter as the reel's tension builds, twangs when one gets away", () => {
    const o = look(), float = lineTarget("float", 0, false, false, { ...o }).sag;
    expect(lineTarget("bite", 0, false, false, { ...o }).sag).toBeLessThan(float);
    expect(lineTarget("reel", 1, false, false, { ...o }).sag).toBeLessThan(lineTarget("reel", 0, false, false, { ...o }).sag);
    expect(lineTarget("reel", 1, false, false, { ...o }).hum).toBeGreaterThan(lineTarget("reel", 0, false, false, { ...o }).hum);
    expect(lineTarget("float", 0, true, false, { ...o }).sag).toBeLessThan(float); // a nibble tugs it straight
    const snap = lineTarget("escaped", 0, false, true, { ...o });
    expect(snap.sag).toBeGreaterThan(float);
    expect(snap.wave).toBeGreaterThan(lineTarget("escaped", 0, false, false, { ...o }).wave);
  });
});
