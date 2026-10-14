import { DataUtils } from "three";

/**
 * The grass field's CPU side (specs/v1-drop.md §8b and §8c, ref `grass-shader-ref.png`): two small textures that
 * follow the view, both on WORLD-anchored grids stored toroidally (a texel's slot is its world index mod n), so a
 * moving view rewrites only the columns and rows that enter and nothing in the world swims with the camera.
 *
 * - `GrassData`: the ground height and how much grass grows there, refilled from the map as the view moves. The
 *   vertex shader plants every blade on it.
 * - `BendField`: where characters (players, residents, remotes) press the grass down. Each press pushes the blades
 *   outward from the feet; the push springs back over the trail's time constant, so a walker leaves a short trail.
 */

export interface WindowMove {
  /** World column indices that entered the window. */
  cols: number[];
  /** World row indices that entered the window. */
  rows: number[];
  /** The view jumped a whole window or more (or the window is new): refill everything. */
  all: boolean;
}

/** An n × n window of `texel`-sized cells on the world grid, centred on a focus, held at slot (index mod n). */
export class ToroidalWindow {
  /** World index of the window's first column and row (NaN before the first recentre). */
  i0 = NaN;
  k0 = NaN;
  constructor(readonly n: number, readonly texel: number) {}

  /** Centre on world (x, z); what entered is the caller's to fill. */
  recentre(x: number, z: number): WindowMove {
    const half = this.n >> 1;
    const i0 = Math.floor(x / this.texel) - half, k0 = Math.floor(z / this.texel) - half;
    const was = { i0: this.i0, k0: this.k0 };
    this.i0 = i0;
    this.k0 = k0;
    if (!Number.isFinite(was.i0) || Math.abs(i0 - was.i0) >= this.n || Math.abs(k0 - was.k0) >= this.n) return { cols: [], rows: [], all: true };
    return { cols: entered(was.i0, i0, this.n), rows: entered(was.k0, k0, this.n), all: false };
  }

  /** Whether world (x, z) is inside the window. */
  contains(x: number, z: number): boolean {
    const i = Math.floor(x / this.texel + 0.5), k = Math.floor(z / this.texel + 0.5);
    return i >= this.i0 && i < this.i0 + this.n && k >= this.k0 && k < this.k0 + this.n;
  }

  /** The slot of world texel (I, K). */
  index(I: number, K: number): number {
    const n = this.n;
    return (((K % n) + n) % n) * n + (((I % n) + n) % n);
  }
}

function entered(from: number, to: number, n: number): number[] {
  const out: number[] = [];
  if (to > from) for (let i = from + n; i < to + n; i++) out.push(i);
  else for (let i = to; i < from; i++) out.push(i);
  return out;
}

/** Visit every slot a move invalidated: whole columns and whole rows of the new window. */
function forEntered(w: ToroidalWindow, move: WindowMove, visit: (I: number, K: number) => void) {
  const { n, i0, k0 } = w;
  if (move.all) {
    for (let K = k0; K < k0 + n; K++) for (let I = i0; I < i0 + n; I++) visit(I, K);
    return;
  }
  for (const I of move.cols) for (let K = k0; K < k0 + n; K++) visit(I, K);
  for (const K of move.rows) for (let I = i0; I < i0 + n; I++) visit(I, K);
}

/** Linear-filtered, the texture holds (height × density, density): divide back for a height that ignores bare ground. */
export function groundFrom(heightTimesDensity: number, density: number): number {
  return density > 1e-4 ? heightTimesDensity / density : 0;
}

/** (height, density) at a world point: density 0 where no grass grows (paths, sand, water, cliff tops, buildings). */
export type GrassSampler = (x: number, z: number) => readonly [number, number];

export class GrassData {
  readonly window: ToroidalWindow;
  /** Height and density per slot, as sampled. */
  readonly values: Float32Array;
  /** The texture's RG half floats: height × density, density. */
  readonly half: Uint16Array;
  constructor(n: number, texel: number, readonly sampler: GrassSampler) {
    this.window = new ToroidalWindow(n, texel);
    this.values = new Float32Array(n * n * 2);
    this.half = new Uint16Array(n * n * 2);
  }

  /** Follow the view; true when texels changed (the texture needs an upload). */
  update(x: number, z: number): boolean {
    const w = this.window, move = w.recentre(x, z);
    if (!move.all && move.cols.length === 0 && move.rows.length === 0) return false;
    forEntered(w, move, (I, K) => {
      const [h, d] = this.sampler(I * w.texel, K * w.texel), i = w.index(I, K) * 2;
      this.values[i] = h;
      this.values[i + 1] = d;
      this.half[i] = DataUtils.toHalfFloat(h * d);
      this.half[i + 1] = DataUtils.toHalfFloat(d);
    });
    return true;
  }

  /** The nearest texel's (height, density); (0, 0) outside the window. */
  sample(x: number, z: number): [number, number] {
    const w = this.window;
    if (!w.contains(x, z)) return [0, 0];
    const i = w.index(Math.floor(x / w.texel + 0.5), Math.floor(z / w.texel + 0.5)) * 2;
    return [this.values[i], this.values[i + 1]];
  }
}

const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export class BendField {
  readonly window: ToroidalWindow;
  /** The push per slot (x, z), length ≤ 1. */
  readonly vec: Float32Array;
  /** The texture's RGBA bytes: the push at 128 ± 127. */
  readonly bytes: Uint8Array;
  private live = false;
  constructor(n: number, texel: number, private tau: number) {
    this.window = new ToroidalWindow(n, texel);
    this.vec = new Float32Array(n * n * 2);
    this.bytes = new Uint8Array(n * n * 4).fill(128);
    for (let i = 3; i < this.bytes.length; i += 4) this.bytes[i] = 255;
  }

  /** How fast a trail springs back (seconds to fall to 1/e). */
  set trail(seconds: number) { this.tau = Math.max(0.05, seconds); }

  /** Follow the view: slots that now hold another part of the world start upright. */
  recentre(x: number, z: number) {
    const w = this.window;
    forEntered(w, w.recentre(x, z), (I, K) => { const i = w.index(I, K) * 2; this.vec[i] = 0; this.vec[i + 1] = 0; });
  }

  /** Feet at (x, z): the grass within `radius` leans outward, fully at the middle, the stronger push kept. */
  press(x: number, z: number, radius: number, strength = 1) {
    const w = this.window, t = w.texel;
    if (!w.contains(x, z)) return;
    const r = Math.ceil(radius / t), ci = Math.round(x / t), ck = Math.round(z / t);
    for (let K = ck - r; K <= ck + r; K++) for (let I = ci - r; I <= ci + r; I++) {
      if (I < w.i0 || I >= w.i0 + w.n || K < w.k0 || K >= w.k0 + w.n) continue;
      const dx = I * t - x, dz = K * t - z, d = Math.hypot(dx, dz);
      if (d >= radius) continue;
      const m = strength * (1 - smooth(radius * 0.4, radius, d));
      const i = w.index(I, K) * 2, was = Math.hypot(this.vec[i], this.vec[i + 1]);
      if (m <= was) continue;
      // Dead centre has no outward: the blades there lie flat under the feet, leaning back the way they came.
      const ux = d > 1e-4 ? dx / d : this.vec[i] / (was || 1), uz = d > 1e-4 ? dz / d : this.vec[i + 1] / (was || 1);
      this.vec[i] = ux * m;
      this.vec[i + 1] = uz * m;
      this.live = true;
    }
  }

  /** Spring back over `dt` seconds. */
  decay(dt: number) {
    if (!this.live) return;
    const k = Math.exp(-dt / this.tau), v = this.vec;
    let any = false;
    for (let i = 0; i < v.length; i++) {
      const next = v[i] * k;
      v[i] = Math.abs(next) < 1e-3 ? 0 : next;
      if (v[i] !== 0) any = true;
    }
    this.live = any;
  }

  /** The push at the nearest slot; (0, 0) outside the window. */
  sample(x: number, z: number): [number, number] {
    const w = this.window;
    if (!w.contains(x, z)) return [0, 0];
    const i = w.index(Math.floor(x / w.texel + 0.5), Math.floor(z / w.texel + 0.5)) * 2;
    return [this.vec[i], this.vec[i + 1]];
  }

  /** Write the bytes for the texture; false when nothing is pressed (and the bytes are already neutral). */
  encode(): boolean {
    const v = this.vec, b = this.bytes, was = this.dirty;
    this.dirty = this.live;
    if (!this.live && !was) return false;
    for (let s = 0, o = 0; s < v.length; s += 2, o += 4) {
      b[o] = Math.round(128 + v[s] * 127);
      b[o + 1] = Math.round(128 + v[s + 1] * 127);
    }
    return this.live || was;
  }
  /** Bytes written last time held a press (one more write clears them). */
  private dirty = false;
}
