import { describe, expect, it } from "vitest";
import { CLOUD_MAX, CLOUD_REACH, CLOUD_SHAPES, CLOUD_TEXELS, LOBES, bakeCloudAtlas, bendElevation, cloudField, skyBend } from "./clouds";
import type { Vec3 } from "./atmosphere";

const field = (cover: number, drift = { x: 0, y: 0 }) => {
  const out = new Float32Array(CLOUD_MAX * CLOUD_TEXELS * 4), n = cloudField(cover, 0.55, drift, 0.3, out);
  return { n, out, cloud: (k: number) => out.subarray(k * CLOUD_TEXELS * 4, (k + 1) * CLOUD_TEXELS * 4) };
};

describe("clouds", () => {
  it("keeps the sky clear with no cover and fills it as the cover grows", () => {
    expect(field(0).n).toBe(0);
    const some = field(0.3).n, more = field(0.6).n;
    expect(some).toBeGreaterThan(3);
    expect(more).toBeGreaterThanOrEqual(some);
    expect(more).toBeLessThanOrEqual(CLOUD_MAX);
  });

  it("lays the clouds out nearest first, inside the reach, the same for every client", () => {
    const a = field(0.45, { x: 12.3, y: -4 }), b = field(0.45, { x: 12.3, y: -4 });
    expect(Array.from(a.out)).toEqual(Array.from(b.out));
    let last = 0;
    for (let k = 0; k < a.n; k++) {
      const c = a.cloud(k), centre = LOBES * 4, dist = c[centre + 7];
      expect(dist).toBeGreaterThanOrEqual(last);
      expect(Math.hypot(c[centre], c[centre + 2])).toBeLessThanOrEqual(CLOUD_REACH);
      last = dist;
    }
  });

  it("grows a cloud in as the cover passes it, never pops one", () => {
    // A cloud's size eases with the cover: a small change of cover changes no size by much.
    const size = (cover: number) => { const f = field(cover); let s = 0; for (let k = 0; k < f.n; k++) s += f.cloud(k)[LOBES * 4 + 3]; return s; };
    expect(Math.abs(size(0.452) - size(0.45))).toBeLessThan(0.35);
  });

  it("stands every lobe up out of its base, the middle the highest", () => {
    for (const shape of CLOUD_SHAPES) {
      expect(shape).toHaveLength(LOBES);
      for (const [, y, , r] of shape) { expect(r).toBeGreaterThan(0.1); expect(y + r).toBeGreaterThan(0.15); }
      const top = (l: readonly number[]) => l[1] + l[3];
      expect(Math.max(...shape.slice(1, LOBES - 1).map(top))).toBeLessThan(Math.max(top(shape[0]), top(shape[LOBES - 1])));
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
