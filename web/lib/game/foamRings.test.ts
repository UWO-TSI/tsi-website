import { describe, expect, it } from "vitest";
import { FoamRings, swashFoam } from "./foamRings";

/** As the uniform array holds them (32-bit floats). */
const f32 = (v: number[]) => Array.from(new Float32Array(v));

// v1 water item 3: foam rings wherever something meets the water (posts, rocks, moored boats, wading players). One
// registry the water shader reads: the nearest few to the view each frame, as (x, z, radius, strength).
describe("the foam ring registry", () => {
  it("hands the water the nearest rings to the view first, at most as many as it has room for", () => {
    const rings = new FoamRings();
    rings.add(10, 0, 0.1);
    rings.add(1, 0, 0.2);
    rings.add(5, 0, 0.3, 0.5);
    const out = new Float32Array(2 * 4);
    expect(rings.nearest(0, 0, 2, out)).toBe(2);
    expect(Array.from(out)).toEqual(f32([1, 0, 0.2, 1, 5, 0, 0.3, 0.5]));
  });
  it("moves, retunes and forgets a ring by its handle", () => {
    const rings = new FoamRings();
    const post = rings.add(0, 0, 0.1), boat = rings.add(3, 3, 0.8);
    rings.move(boat, 0.5, 0);
    rings.set(post, { strength: 0 });
    const out = new Float32Array(4 * 4);
    // A ring at no strength is not drawn (nothing meets the water there now).
    expect(rings.nearest(0, 0, 4, out)).toBe(1);
    expect(Array.from(out.subarray(0, 4))).toEqual(f32([0.5, 0, 0.8, 1]));
    rings.remove(boat);
    rings.set(post, { strength: 1, r: 0.2 });
    expect(rings.nearest(0, 0, 4, out)).toBe(1);
    expect(Array.from(out.subarray(0, 4))).toEqual(f32([0, 0, 0.2, 1]));
    expect(rings.size).toBe(1);
  });
  it("reuses a removed ring's slot and never hands out a stale handle's ring", () => {
    const rings = new FoamRings();
    const a = rings.add(0, 0, 0.1);
    rings.remove(a);
    const b = rings.add(2, 0, 0.1);
    rings.move(a, 9, 9); // stale: ignored
    const out = new Float32Array(4);
    rings.nearest(0, 0, 1, out);
    expect(out[0]).toBe(2);
    expect(b).not.toBe(a);
  });
  it("leaves out rings beyond its reach", () => {
    const rings = new FoamRings();
    rings.add(100, 0, 0.1);
    expect(rings.nearest(0, 0, 4, new Float32Array(16), 60)).toBe(0);
  });
  it("orders the same rings the same way on every client", () => {
    const make = () => { const r = new FoamRings(); for (let i = 0; i < 40; i++) r.add(Math.sin(i * 7.1) * 20, Math.cos(i * 3.3) * 20, 0.1); return r; };
    const a = new Float32Array(12 * 4), b = new Float32Array(12 * 4);
    make().nearest(2, -3, 12, a);
    make().nearest(2, -3, 12, b);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe("a wader's foam", () => {
  it("rings someone standing in the swash, and nobody high on the sand or on the deck", () => {
    // Shore distance in cells, positive over the water: standing just above the waterline is in the swash.
    expect(swashFoam(-0.1)).toBeGreaterThan(0.6);
    expect(swashFoam(0.05)).toBeGreaterThan(0.6);
    expect(swashFoam(-0.6)).toBe(0);
    expect(swashFoam(-2)).toBe(0);
    // Over open water (a deck or a boat stands there, not a wader): their own rings say so.
    expect(swashFoam(1.2)).toBe(0);
  });
});
