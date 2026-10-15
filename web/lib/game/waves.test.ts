import { describe, expect, it } from "vitest";
import { TRAINS, WAVE_FN, WAVE_LITE, WAVE_MAX, smooth, waterWaveAt, waterWaves, waveSlopeBound, waveState, waveTable, wrapPhase, type FieldAt } from "./waves";
import { WATER_WAVES } from "./waterShader";
import { TUNING_DEFAULTS } from "./tuning";
import { RIVER_CALM, BERTH_CALM, bakeWaveCalm, setShoal } from "./seabed";
import { createCenteredMap, type IslandMap, type ShoreSdf } from "./grid";
import { mirrorWaterField, sampleGrid, waterFieldAt, type FieldGrid } from "./waterField";

const SEA = TUNING_DEFAULTS.water;

/**
 * The shader's own text, run in JS: WAVE_FN's body with its GLSL types dropped (it is written in scalar maths and
 * component access only, for exactly this), its uniforms handed in as {x, y, z, w} arrays.
 */
function glslWaves() {
  const body = WAVE_FN.slice(WAVE_FN.indexOf("{") + 1, WAVE_FN.lastIndexOf("}"))
    .replace(/\b(float|int|vec2|vec3|vec4)\s+(?=[A-Za-z_])/g, "let ")
    .replace(/\bfloat\(/g, "(");
  const run = new Function("x", "z", "depth", "calm", "spacing", "disp", "grad", "uWaveA", "uWaveB", "uWaveCount", "sin", "cos", "smoothstep", "max", body);
  return (table: Float32Array, count: number, x: number, z: number, depth: number, calm: number, spacing: number) => {
    const v4 = (o: number) => ({ x: table[o], y: table[o + 1], z: table[o + 2], w: table[o + 3] });
    const a = Array.from({ length: WAVE_MAX }, (_, i) => v4(i * 8)), b = Array.from({ length: WAVE_MAX }, (_, i) => v4(i * 8 + 4));
    const disp = { x: 0, y: 0, z: 0 }, grad = { x: 0, y: 0 };
    const squeeze = run(x, z, depth, calm, spacing, disp, grad, a, b, count, Math.sin, Math.cos, smooth, Math.max) as number;
    return { disp, grad, squeeze };
  };
}

describe("the waves: one function on the GPU and the CPU", () => {
  it("runs the shader's own text and gets the CPU's numbers, anywhere, at any hour, at any depth", () => {
    const gpu = glslWaves(), disp = { x: 0, y: 0, z: 0 }, grad = { x: 0, z: 0 };
    let n = 0;
    for (const t of [0, 13.7, 4021.5, 86399.9])
      for (const count of [WAVE_MAX, WAVE_LITE, 1])
        for (const [x, z] of [[8, -22], [2.3, -12.4], [-30, 31], [100, -80], [-260, 140]])
          for (const [depth, calm, spacing] of [[4, 1, 0], [0.3, 1, 1], [1.4, 0.3, 1], [0, 1, 0], [3, 1, 6], [3, 0.25, 24]]) {
            const table = waveTable(SEA, t, count);
            const cpu = waterWaves(table, count, x, z, depth, calm, spacing, disp, grad);
            const g = gpu(table, count, x, z, depth, calm, spacing);
            for (const [a, b] of [[disp.x, g.disp.x], [disp.y, g.disp.y], [disp.z, g.disp.z], [grad.x, g.grad.x], [grad.z, g.grad.y], [cpu, g.squeeze]]) expect(a).toBeCloseTo(b, 9);
            n++;
          }
    expect(n).toBe(360);
  });

  it("prints that function, its table and the field it reads into the water's vertex shaders", () => {
    expect(WATER_WAVES).toContain(WAVE_FN.trim());
    for (const piece of [`uniform vec4 uWaveA[${WAVE_MAX}]`, `uniform vec4 uWaveB[${WAVE_MAX}]`, "uniform float uWaveCount", "uniform sampler2D uCalmMap", "uniform sampler2D uShoreMap", "float waterHeightAt(vec2 p)"])
      expect(WATER_WAVES).toContain(piece);
  });

  it("hands the shader the time phase already wrapped, from the world clock: the same table for the same second", () => {
    const a = waveTable(SEA, 86399.25), b = waveTable(SEA, 86399.25);
    expect(Array.from(a)).toEqual(Array.from(b));
    for (let i = 0; i < WAVE_MAX; i++) {
      expect(a[i * 8 + 3]).toBeGreaterThanOrEqual(0);
      expect(a[i * 8 + 3]).toBeLessThan(2 * Math.PI);
    }
    // ω·t wrapped: one second on is the phase plus ω (mod a turn).
    const w0 = SEA.swellSpeed, t = 4000;
    expect(waveTable(SEA, t + 1)[3]).toBeCloseTo(wrapPhase(waveTable(SEA, t)[3] + w0), 3);
  });

  it("is a long swell and three shorter wind waves, the shorter the slower (deep-water dispersion), Lite the first two", () => {
    const tb = waveTable(SEA, 0), k = (i: number) => tb[i * 8 + 2], omega = (i: number) => wrapPhase(waveTable(SEA, 1)[i * 8 + 3] - tb[i * 8 + 3]);
    expect(TRAINS[0].swell).toBe(true);
    expect(2 * Math.PI / k(0)).toBeCloseTo(SEA.swellLength, 4);
    expect(2 * Math.PI / k(1)).toBeCloseTo(SEA.waveScale, 4);
    expect(k(3)).toBeGreaterThan(k(2));
    expect(k(2)).toBeGreaterThan(k(1));
    // Phase speed ω/k: the longest runs fastest; within the wind sea ω ∝ √k.
    expect(omega(1) / k(1)).toBeGreaterThan(omega(2) / k(2));
    expect(omega(2) / k(2)).toBeGreaterThan(omega(3) / k(3));
    expect(omega(3) / omega(1)).toBeCloseTo(Math.sqrt(k(3) / k(1)), 4);
    expect(omega(0) / k(0)).toBeGreaterThan(omega(1) / k(1));
    // Lite: the swell and the main wind wave; the rest of the table empty.
    const lite = waveTable(SEA, 0, WAVE_LITE);
    expect(Array.from(lite.slice(0, 16))).toEqual(Array.from(tb.slice(0, 16)));
    expect(lite.slice(16).every(v => v === 0)).toBe(true);
  });

  it("sharpens the crests without ever folding the surface over, even on a wild bench setting", () => {
    const steep = (p = SEA) => { const tb = waveTable(p, 0); let s = 0; for (let i = 0; i < WAVE_MAX; i++) s += tb[i * 8 + 5] * tb[i * 8 + 2] * tb[i * 8 + 4]; return s; };
    expect(steep()).toBeGreaterThan(0.25);
    expect(steep()).toBeLessThan(0.9);
    expect(steep({ ...SEA, waveSteepness: 40, waveHeight: 0.3 })).toBeCloseTo(0.9, 6);
    // A crest is sharper than its trough: the surface's slope just off a crest (squeezed) beats the trough's.
    const one = new Float32Array(WAVE_MAX * 8);
    one.set([1, 0, 1, 0, 0.1, 5, 1, 0]);
    const d = { x: 0, y: 0, z: 0 }, g = { x: 0, z: 0 };
    const crest = waterWaves(one, 1, Math.PI / 2 - 0.3, 0, 10, 1, 0, d, g), crestSlope = Math.abs(g.x);
    const trough = waterWaves(one, 1, -Math.PI / 2 + 0.3, 0, 10, 1, 0, d, g), troughSlope = Math.abs(g.x);
    expect(crest).toBeGreaterThan(0);
    expect(trough).toBeLessThan(0);
    expect(crestSlope).toBeGreaterThan(troughSlope * 1.5);
  });

  it("bounds its slope, so the sun behind the camera stays out of the water", () => {
    const g = { x: 0, z: 0 };
    let most = 0;
    for (let i = 0; i < 3000; i++) { waterWaveAt(i * 0.37 - 300, i * 0.91 - 700, waveState(SEA, i * 1.3), g); most = Math.max(most, Math.hypot(g.x, g.z)); }
    expect(most).toBeLessThanOrEqual(waveSlopeBound(SEA) + 1e-9);
    expect(waveSlopeBound(SEA)).toBeLessThan(0.3);
  });

  it("rises and falls about as high as its trains together, no higher", () => {
    let most = 0;
    const bound = SEA.swellHeight + SEA.waveHeight * TRAINS.slice(1).reduce((s, t) => s + t.amp, 0);
    for (let i = 0; i < 4000; i++) most = Math.max(most, Math.abs(waterWaveAt(i * 0.37 - 300, i * 0.91 - 700, waveState(SEA, i * 1.3))));
    expect(most).toBeLessThanOrEqual(bound + 1e-9);
    expect(most).toBeGreaterThan(bound * 0.6);
  });
});

describe("what floats reads the surface the shader draws", () => {
  it("finds the rest point whose displaced position lands on the asked point, and its height", () => {
    const w = waveState(SEA, 777.7), rest = { x: 0, z: 0 }, d = { x: 0, y: 0, z: 0 }, g = { x: 0, z: 0 };
    for (const [x, z] of [[8, -22], [-3.2, 40.1], [55, 0.5]]) {
      const h = waterWaveAt(x, z, w, g, undefined, rest);
      waterWaves(w.table, w.count, rest.x, rest.z, 1e3, 1, 0, d, g);
      expect(rest.x + d.x).toBeCloseTo(x, 3);
      expect(rest.z + d.z).toBeCloseTo(z, 3);
      expect(h).toBeCloseTo(d.y, 5);
    }
  });
  it("gives the slope of the surface it describes (one train exactly, the full sea closely)", () => {
    const e = 1e-3, g = { x: 0, z: 0 }, g2 = { x: 0, z: 0 };
    const one = waveState(SEA, 50, 1);
    for (const [x, z] of [[8, -22], [-3, 7.5], [40, -40]]) {
      waterWaveAt(x, z, one, g);
      expect(g.x).toBeCloseTo((waterWaveAt(x + e, z, one, g2) - waterWaveAt(x - e, z, one, g2)) / (2 * e), 4);
      expect(g.z).toBeCloseTo((waterWaveAt(x, z + e, one, g2) - waterWaveAt(x, z - e, one, g2)) / (2 * e), 4);
    }
    const all = waveState(SEA, 50);
    for (const [x, z] of [[8, -22], [-3, 7.5], [40, -40]]) {
      waterWaveAt(x, z, all, g);
      expect(Math.abs(g.x - (waterWaveAt(x + e, z, all, g2) - waterWaveAt(x - e, z, all, g2)) / (2 * e))).toBeLessThan(0.02);
      expect(Math.abs(g.z - (waterWaveAt(x, z + e, all, g2) - waterWaveAt(x, z - e, all, g2)) / (2 * e))).toBeLessThan(0.02);
    }
  });
});

describe("the seabed calms and slows the waves", () => {
  /** A beach along x = 0: the bed `slope` deeper a unit out to sea (+x). */
  const beach = (slope: number): FieldAt => (x, _z, out) => { out.depth = Math.max(0, x * slope); out.calm = 1; return out; };
  /** The most the surface rises or falls at x over 40 s. */
  const at = (x: number, field = beach(0.1)) => { let m = 0; for (let t = 0; t < 40; t += 0.2) m = Math.max(m, Math.abs(waterWaveAt(x, 3, waveState(SEA, t), undefined, field))); return m; };
  it("shrinks them as the water shallows, to nothing at the waterline", () => {
    const deep = at(40), mid = at(6), shallow = at(1.5), edge = at(0);
    expect(deep).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(shallow);
    expect(edge).toBe(0);
    expect(shallow).toBeLessThan(deep * 0.35);
  });
  it("slows them: a crest runs in over the shallows slower than over the deep sea", () => {
    // One train heading straight in (−x), over a bed shelving 0.1 a unit.
    const tb = new Float32Array(WAVE_MAX * 8), field = beach(0.1);
    const crestNear = (x0: number, t: number) => {
      const w = 0.9, k = 2 * Math.PI / 8;
      tb.set([-1, 0, k, wrapPhase(w * t), 0.05, 1, 1.1, w * SEA.waveShoalLag]);
      // The crest's position: the highest point within half a wavelength of x0.
      let best = x0, hi = -Infinity;
      for (let x = x0 - 4; x <= x0 + 4; x += 0.01) { const h = waterWaveAt(x, 0, { table: tb, count: 1, t }, undefined, field); if (h > hi) { hi = h; best = x; } }
      return best;
    };
    const speed = (x0: number) => { const a = crestNear(x0, 100), b = crestNear(a, 100.4); return Math.abs(b - a) / 0.4; };
    const deep = speed(60), shallow = speed(5);
    expect(deep).toBeCloseTo(0.9 / (2 * Math.PI / 8), 1);
    expect(shallow).toBeLessThan(deep * 0.8);
  });
  it("bakes the calm: the open sea open, a river and the berth calm-ish, the map's edge open", () => {
    // A square island with a river cut through it and a wharf off its south shore; the sea all round.
    const map: IslandMap = createCenteredMap(40, 40);
    const shore = fakeShore(map, (x, z) => {
      if (Math.abs(x) < 10 && Math.abs(z) < 10) return Math.abs(z) < 1.5 ? 1.5 - Math.abs(z) : -Math.min(10 - Math.abs(x), 10 - Math.abs(z));
      return Math.max(Math.abs(x) - 10, Math.abs(z) - 10);
    });
    setShoal(map, [{ x: 0, z: -13, yaw: 0 }]);
    const calm = bakeWaveCalm(shore, map);
    const c = (x: number, z: number) => sampleGrid(calm, x, z);
    expect(c(16, 16)).toBeCloseTo(1, 2);
    expect(c(-3, 0)).toBeCloseTo(RIVER_CALM, 1);
    expect(c(0, -15.5)).toBeLessThan(1 - BERTH_CALM * 0.8);
    expect(c(-12, -15.5)).toBeGreaterThan(0.95);
    expect(sampleGrid(calm, 1e4, -1e4)).toBe(1);
  });
  it("reads the field on the CPU as the GPU samples it, deep and open with none", () => {
    const grid: FieldGrid = { data: new Float32Array([0, 1, 2, 3]), width: 2, height: 2, minX: 0, minZ: 0, sizeX: 2, sizeZ: 2 };
    mirrorWaterField(grid, null);
    const f = { depth: 0, calm: 0 };
    expect(waterFieldAt(1, 1, f)).toEqual({ depth: 1.5, calm: 1 });
    expect(waterFieldAt(-5, -5, f).depth).toBe(0);
    expect(waterFieldAt(0.75, 0.5, f).depth).toBeCloseTo(0.25, 9);
    mirrorWaterField(null, null);
    expect(waterFieldAt(1, 1, f)).toEqual({ depth: 1e3, calm: 1 });
  });
});

/** A shore field over a map's rect from a signed distance function (cells, positive over water), 4 samples a cell. */
function fakeShore(map: IslandMap, sd: (x: number, z: number) => number): ShoreSdf {
  const scale = 4, minX = map.originX - 0.5 - 4, minZ = map.originZ - 0.5 - 4, sizeX = map.width + 8, sizeZ = map.depth + 8;
  const width = sizeX * scale, height = sizeZ * scale, data = new Float32Array(width * height);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) data[j * width + i] = sd(minX + (i + 0.5) / scale, minZ + (j + 0.5) / scale);
  return { data, width, height, scale, minX, minZ, sizeX, sizeZ };
}
