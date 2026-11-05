import { describe, expect, it } from "vitest";
import { SCREEN, VIEW, charmStill, hangCharm, inCorner, phoneBox, quadMatrix, restMotion, screenLayout, settled, stepCharm, stepMotion, type PhoneMotion, type V3 } from "./phoneMotion";

const run = (m: PhoneMotion, want: { open: boolean; tucked?: boolean }, s: number, each?: (m: PhoneMotion, t: number) => void) => {
  for (let t = 0; t < s; t += 1 / 60) { stepMotion(m, want, 1 / 60); each?.(m, t); }
  return m;
};

describe("the phone's two motions", () => {
  it("pulls out first, then flips open: the top half waits until it's out", () => {
    let flipAt = -1, outAt = -1;
    run(restMotion(), { open: true }, 1.5, (m, t) => {
      if (outAt < 0 && m.rise.x > 0.97) outAt = t;
      if (flipAt < 0 && m.slide.x > 0.05) flipAt = t;
    });
    expect(outAt).toBeGreaterThan(0.1);
    expect(flipAt).toBeGreaterThan(outAt);
  });
  it("isn't settled until it's where it's going (out but not yet open keeps drawing)", () => {
    const m = restMotion(); m.rise.x = 1;
    expect(settled(m, { open: true })).toBe(false);
  });
  it("overshoots a little and settles open", () => {
    let peak = 0;
    const m = run(restMotion(), { open: true }, 3, m => { peak = Math.max(peak, m.rise.x); });
    expect(peak).toBeGreaterThan(1.04); expect(peak).toBeLessThan(1.2);
    expect(m.rise.x).toBeCloseTo(1, 2); expect(m.slide.x).toBeCloseTo(1, 2);
    expect(settled(m, { open: true })).toBe(true);
  });
  it("away, it flips shut before it drops", () => {
    const m = run(restMotion(), { open: true }, 2.5);
    let shutAt = -1, dropAt = -1;
    run(m, { open: false }, 2, (m, t) => {
      if (shutAt < 0 && m.slide.x < 0.03) shutAt = t;
      if (dropAt < 0 && m.rise.x < 0.9) dropAt = t;
    });
    expect(shutAt).toBeGreaterThan(0);
    expect(dropAt).toBeGreaterThan(shutAt);
    expect(m.rise.x).toBeCloseTo(0, 2);
  });
  it("tucks down open while an app is up, and comes back open", () => {
    const m = run(restMotion(), { open: true }, 2.5);
    run(m, { open: true, tucked: true }, 2);
    expect(m.rise.x).toBeCloseTo(0, 2); expect(m.slide.x).toBeCloseTo(1, 2);
    let minSlide = 1;
    run(m, { open: true }, 2, m => { minSlide = Math.min(minSlide, m.slide.x); });
    expect(minSlide).toBeGreaterThan(0.9); expect(m.rise.x).toBeCloseTo(1, 2);
  });
  it("is where it's going at once under reduced motion", () => {
    const m = stepMotion(restMotion(), { open: true }, 1 / 60, true);
    expect([m.rise.x, m.slide.x]).toEqual([1, 1]);
    expect(stepMotion(m, { open: false }, 1 / 60, true).rise.x).toBe(0);
  });
});

describe("where the phone sits", () => {
  it("clears the wallet's slot and sits on the world's pixel grid", () => {
    for (const [vw, vh, touch] of [[1440, 900, false], [1440, 780, false], [1920, 1080, false], [390, 844, true]] as const) {
      const b = phoneBox(vw, vh, touch, 2);
      for (const n of [b.left, b.top, b.w, b.h]) expect(n % 2).toBe(0);
      const phoneTop = b.top + (VIEW.top - 9.9) * b.k;
      expect(phoneTop).toBeGreaterThanOrEqual(touch ? 288 : 390);
      expect(b.left + b.w).toBeLessThanOrEqual(vw);
    }
  });
  it("is bigger on a bigger window", () => {
    expect(phoneBox(1920, 1080, false, 2).k).toBeGreaterThan(phoneBox(1440, 900, false, 2).k);
  });
});

describe("the screen", () => {
  it("lays every app out inside the glass, two across, clear of the bar and the home button", () => {
    const L = screenLayout(6);
    for (const [x, y, w, h] of L.tiles) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x + w).toBeLessThanOrEqual(SCREEN.w);
      expect(y).toBeGreaterThan(L.bar[1] + L.bar[3]); expect(y + h).toBeLessThan(L.home[1]);
    }
    expect(new Set(L.tiles.map(t => t[0])).size).toBe(2);
  });
  it("maps its box onto the glass's corners", () => {
    const tl = [10, 20] as const, tr = [110, 24] as const, br = [104, 170] as const, bl = [12, 160] as const;
    const m = quadMatrix(100, 150, tl, tr, br, bl).match(/[-\d.e]+/g)!.slice(1).map(Number);
    const at = (u: number, v: number) => {
      const x = m[0] * u + m[4] * v + m[12], y = m[1] * u + m[5] * v + m[13], w = m[3] * u + m[7] * v + m[15];
      return [x / w, y / w];
    };
    for (const [[u, v], p] of [[[0, 0], tl], [[100, 0], tr], [[100, 150], br], [[0, 150], bl]] as const) {
      const [x, y] = at(u, v); expect(x).toBeCloseTo(p[0], 3); expect(y).toBeCloseTo(p[1], 3);
    }
  });
  it("opens from the very corner only", () => {
    expect(inCorner(1435, 895, 1440, 900)).toBe(true);
    expect(inCorner(1400, 895, 1440, 900)).toBe(false);
  });
});

describe("the charm", () => {
  const run = (mount: (t: number) => V3, secs: number, solid?: Parameters<typeof stepCharm>[3]) => {
    const s = hangCharm(mount(0), [2.9, 1]);
    let most = 0;
    for (let t = 1 / 60; t <= secs; t += 1 / 60) {
      stepCharm(s, mount(t), 1 / 60, solid);
      const [x, y] = [s.p[1][0] - mount(t)[0], s.p[1][1] - mount(t)[1]];
      most = Math.max(most, Math.abs(Math.atan2(x, -y)));
    }
    return { s, most };
  };
  it("hangs still when nothing moves", () => {
    const { s, most } = run(() => [0, 0, 0], 2);
    expect(most).toBeLessThan(1e-6);
    expect(charmStill(s)).toBe(true);
  });
  it("swings when the mount moves, then settles straight down again", () => {
    // The flip open: the mount snaps up and to the side in a quarter second.
    const { s, most } = run(t => [Math.min(t, 0.25) * 8, Math.min(t, 0.25) * 16, 0], 4);
    expect(most).toBeGreaterThan(0.15);
    expect(charmStill(s)).toBe(true);
    expect(Math.abs(s.p[1][0] - 2)).toBeLessThan(0.02);
    expect(s.p[1][1]).toBeCloseTo(4 - 3.9, 1);
  });
  it("keeps its length on the strap", () => {
    const { s } = run(t => [Math.sin(t * 9) * 2, 0, Math.cos(t * 7)], 1.5);
    const [m, a, b] = [[Math.sin(1.5 * 9) * 2, 0, Math.cos(1.5 * 7)], s.p[0], s.p[1]];
    expect(Math.hypot(a[0] - m[0], a[1] - m[1], a[2] - m[2])).toBeCloseTo(2.9, 1);
    expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])).toBeCloseTo(1, 2);
  });
  it("stays out of the phone", () => {
    const wall = (p: V3): V3 | null => (p[0] > -0.5 ? [-0.5, p[1], p[2]] : null);
    const { s } = run(t => [Math.min(t, 0.2) * -20, 0, 0], 2, wall);
    expect(Math.max(...s.p.map(p => p[0]))).toBeLessThanOrEqual(-0.5 + 1e-9);
  });
});
