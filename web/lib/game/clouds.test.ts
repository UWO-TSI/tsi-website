import { describe, expect, it } from "vitest";
import { CLOUD_KINDS, CLOUD_MAX, CLOUD_TEXELS, SHAPES, bakeCloudAtlas, bendElevation, cloudField, cloudLife, cloudShape, skyBend } from "./clouds";
import type { Vec3 } from "./atmosphere";

const T = 45_000;
// A camera looking out along +x with a wide view (the game's is narrower).
const VIEW = { x: 1, y: 0, z: 0, cos: Math.cos(0.9) };
const field = (cover: number, t = T, drift = { x: 0, y: 0 }, grey = 0, view: typeof VIEW | null = VIEW) => {
  const out = new Float32Array(CLOUD_MAX * CLOUD_TEXELS * 4), n = cloudField(cover, 0.55, grey, t, drift, 0.3, out, view);
  return { n, out, cloud: (k: number) => out.subarray(k * CLOUD_TEXELS * 4, (k + 1) * CLOUD_TEXELS * 4) };
};
/** Every cloud's presence, by its seed (a cloud's own until its square grows the next). */
const presences = (f: ReturnType<typeof field>) => {
  const m = new Map<number, number>();
  for (let k = 0; k < f.n; k++) m.set(Math.round(f.cloud(k)[7] % 1 * 1e4), f.cloud(k)[4]);
  return m;
};

describe("clouds", () => {
  it("keeps the sky clear with no cover and fills it as the cover grows", () => {
    expect(field(0).n).toBe(0);
    const some = field(0.3).n, more = field(0.6).n;
    expect(some).toBeGreaterThan(3);
    expect(more).toBeGreaterThanOrEqual(some);
    expect(more).toBeLessThanOrEqual(CLOUD_MAX);
  });

  it("lays the clouds out nearest first, the same for every client", () => {
    const a = field(0.45, T, { x: 12.3, y: -4 }), b = field(0.45, T, { x: 12.3, y: -4 });
    expect(Array.from(a.out)).toEqual(Array.from(b.out));
    let last = 0;
    for (let k = 0; k < a.n; k++) {
      const c = a.cloud(k);
      expect(c[3]).toBeGreaterThanOrEqual(last);
      expect(Math.hypot(c[0], c[1], c[2])).toBeCloseTo(1);
      expect(c[4]).toBeGreaterThan(0);
      expect(c[4]).toBeLessThanOrEqual(1);
      expect(c[5]).toBeLessThan(SHAPES);
      last = c[3];
    }
  });

  it("lives each square's cloud out: forms from nothing, breaks up, gone, then a new one", () => {
    let seen = 0, last = cloudLife(3, -2, 0).presence, rose = false, fell = false;
    for (let t = 0; t < 2000; t += 1) {
      const l = cloudLife(3, -2, t);
      expect(Math.abs(l.presence - last)).toBeLessThan(0.02);
      if (l.presence > last) rose = true;
      if (l.presence < last && l.breaking) fell = true;
      if (l.presence === 1) seen++;
      last = l.presence;
    }
    expect(rose && fell).toBe(true);
    expect(seen).toBeGreaterThan(0);
  });

  it("never pops a cloud: from one moment to the next, or as the cover changes a little", () => {
    // A cloud that comes into the list or leaves it does so with next to no presence (the whole sky, under the cap).
    const all = (cover: number, t = T, dx = 0) => { const f = field(cover, t, { x: dx, y: 0 }, 0, null); expect(f.n).toBeLessThan(CLOUD_MAX); return presences(f); };
    const step = (a: Map<number, number>, b: Map<number, number>) => {
      for (const [k, p] of a) expect(Math.abs(p - (b.get(k) ?? 0))).toBeLessThan(0.08);
      for (const [k, p] of b) if (!a.has(k)) expect(p).toBeLessThan(0.08);
    };
    for (let t = T; t < T + 60; t += 2) step(all(0.25, t), all(0.25, t + 2, 0.01));
    step(all(0.25), all(0.252));
  });

  it("picks the flat and broken kinds more under an overcast", () => {
    const flatShare = (grey: number) => {
      let flat = 0, all = 0;
      for (let t = 0; t < 30_000; t += 3000) {
        const f = field(0.8, t, { x: 0, y: 0 }, grey);
        for (let k = 0; k < f.n; k++) { all++; if (["flat", "broken", "wisp"].includes(CLOUD_KINDS[f.cloud(k)[5]])) flat++; }
      }
      return flat / all;
    };
    expect(flatShare(1)).toBeGreaterThan(flatShare(0) + 0.2);
  });

  it("builds every shape inside its card, on its base", () => {
    expect(CLOUD_KINDS).toHaveLength(SHAPES);
    for (let k = 0; k < SHAPES; k++) for (const [x, y, , r, sx] of cloudShape(k)) {
      expect(Math.abs(x) + r * sx).toBeLessThan(2.2);
      expect(y + r).toBeLessThan(1.2);
      expect(y).toBeGreaterThan(-0.4);
    }
  });

  it("bakes each shape's card: covered inside, clear at its edges, normals facing the viewer", () => {
    const w = 64, a = bakeCloudAtlas(w), W = w * 2, h = w / 2;
    // Shape 0's tile: its middle a little above the base is cloud, its corners are sky.
    const px = (i: number, j: number) => a.subarray((j * W + i) * 4, (j * W + i) * 4 + 4);
    expect(px(w / 2, Math.round(h * 0.4))[3]).toBe(255);
    expect(px(0, h - 1)[3]).toBe(0);
    expect(px(w - 1, 0)[3]).toBe(0);
    expect(px(w / 2, Math.round(h * 0.4))[2]).toBeGreaterThan(0);
  });

  it("bends the skyline down by the dip, overhead not at all, keeping the order", () => {
    expect(bendElevation(0, 0.3)).toBeCloseTo(-0.3);
    expect(bendElevation(Math.PI / 2, 0.3)).toBeCloseTo(Math.PI / 2);
    let last = -Infinity;
    for (let e = -0.5; e <= Math.PI / 2; e += 0.05) { const b = bendElevation(e, 0.3); expect(b).toBeGreaterThan(last); last = b; }
    const out: Vec3 = [0, 0, 0];
    skyBend([0.6, 0.0, 0.8], 0.2, out);
    expect(Math.hypot(...out)).toBeCloseTo(1);
    expect(out[0] / out[2]).toBeCloseTo(0.75);
    expect(out[1]).toBeCloseTo(Math.sin(-0.2));
  });
});
