/**
 * Foam rings (v1 water item 3, specs/v1-drop.md §8c.2): white foam wherever something meets the water, as the
 * references draw round every post, rock and hull (references/look/2026-10-13/). Whatever stands in the water
 * registers a ring here: its centre, the radius where it meets the surface, and how much foam (0 hides it). The water
 * shader (waterShader.ts WATER_FOAM_RINGS) draws the nearest few to the view each frame, so a ring costs nothing until
 * it is near. Static things (the wharf's posts, rocks) add one once; moving ones (a moored boat on the swell, a wader)
 * move theirs. Where a ring is, is world state (the thing's own position); which ones are drawn is per view.
 */
export interface FoamRingInit { r?: number; strength?: number }

/** Room in the shader: High, Lite. */
export const FOAM_RING_SLOTS = { high: 32, lite: 12 } as const;

export class FoamRings {
  private xs: number[] = []; private zs: number[] = []; private rs: number[] = []; private ss: number[] = [];
  /** Each slot's generation: a handle is (generation << 12) | slot, so a stale one is ignored. */
  private gen: number[] = []; private live: boolean[] = [];
  private free: number[] = [];
  private order: number[] = []; private dist: number[] = [];

  /** Rings registered (whatever their strength). */
  get size(): number { return this.live.filter(Boolean).length; }

  /** A ring at (x, z) of radius `r` (where the thing meets the water) and `strength` (1 full foam). Returns its handle. */
  add(x: number, z: number, r: number, strength = 1): number {
    const i = this.free.pop() ?? this.xs.length;
    this.xs[i] = x; this.zs[i] = z; this.rs[i] = r; this.ss[i] = strength;
    this.gen[i] = (this.gen[i] ?? 0) + 1; this.live[i] = true;
    return (this.gen[i] << 12) | i;
  }
  private slot(handle: number): number {
    const i = handle & 0xfff;
    return this.live[i] && this.gen[i] === handle >>> 12 ? i : -1;
  }
  move(handle: number, x: number, z: number): void {
    const i = this.slot(handle);
    if (i >= 0) { this.xs[i] = x; this.zs[i] = z; }
  }
  set(handle: number, v: FoamRingInit): void {
    const i = this.slot(handle);
    if (i < 0) return;
    if (v.r !== undefined) this.rs[i] = v.r;
    if (v.strength !== undefined) this.ss[i] = v.strength;
  }
  remove(handle: number): void {
    const i = this.slot(handle);
    if (i < 0) return;
    this.live[i] = false;
    this.free.push(i);
  }
  /** Forget every ring (a scene change). */
  clear(): void {
    for (let i = 0; i < this.live.length; i++) if (this.live[i]) { this.live[i] = false; this.free.push(i); }
  }

  /**
   * The nearest `n` rings with any foam to (fx, fz), within `reach`, into `out` as (x, z, r, strength) each, nearest
   * first (ties by registration slot, so every client orders them alike). Returns how many it wrote.
   */
  nearest(fx: number, fz: number, n: number, out: Float32Array, reach = Infinity): number {
    const order = this.order, dist = this.dist, r2 = reach * reach;
    let k = 0;
    for (let i = 0; i < this.xs.length; i++) {
      if (!this.live[i] || this.ss[i] <= 0) continue;
      const d = (this.xs[i] - fx) ** 2 + (this.zs[i] - fz) ** 2;
      if (d > r2) continue;
      // Insertion into the first n by distance (n is small; no allocation).
      let j = Math.min(k, n);
      if (j === n && d >= dist[n - 1]) continue;
      while (j > 0 && dist[j - 1] > d) { if (j < n) { dist[j] = dist[j - 1]; order[j] = order[j - 1]; } j--; }
      dist[j] = d; order[j] = i;
      if (k < n) k++;
    }
    for (let j = 0; j < k; j++) {
      const i = order[j];
      out[j * 4] = this.xs[i]; out[j * 4 + 1] = this.zs[i]; out[j * 4 + 2] = this.rs[i]; out[j * 4 + 3] = this.ss[i];
    }
    return k;
  }
}

/** The world's rings: the island scene registers into it, the water draws from it. */
export const foamRings = new FoamRings();

/**
 * How much foam rings someone standing `shore` cells from the waterline (the shore field: positive over the water):
 * full in the swash, where the waves wash round their feet (just above the waterline to just past it), none higher up
 * the sand and none over open water (whoever stands there is on a deck or a boat, which ring themselves).
 */
export function swashFoam(shore: number): number {
  const t = (shore + 0.45) / 0.3, up = Math.min(1, Math.max(0, t)), out = Math.min(1, Math.max(0, (0.45 - shore) / 0.3));
  return up * up * (3 - 2 * up) * (out * out * (3 - 2 * out));
}
