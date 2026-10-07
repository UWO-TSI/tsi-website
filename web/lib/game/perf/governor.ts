/**
 * Adaptive quality (specs/perf/2026-10-results.md): when the frame rate stays under its target for a few seconds, step
 * down one level, the least visible first; when there's been headroom for a while, step back up. It only ever takes
 * detail away from what the player's settings and quality tier give (their choice caps it), and never writes a setting.
 *
 * | Level | What changes (on top of the one before)                                                        |
 * |-------|-------------------------------------------------------------------------------------------------|
 * | 0     | nothing: the settings as chosen                                                                 |
 * | 1     | the moving casters' sun shadow map (characters, enemies: SunShadows) at half size               |
 * | 2     | characters past 21 u reach their lighter tiers sooner (character/lod.ts: as if drawn 2/3 tall)  |
 * | 3     | combat effects' particles at 60%                                                                |
 * | 4     | the canvas renders at 85% of its resolution                                                     |
 *
 * Pure: the world's QualityGovernor feeds it every frame's time and applies `knobs`.
 */
export interface Knobs {
  /** The moving casters' shadow map size, as a share of the key light's. */
  shadowScale: number;
  /** Characters' drawn size is divided by this before their detail tier (lod.ts). */
  lodBias: number;
  /** Particle bursts' counts, as a share. */
  particles: number;
  /** The canvas's pixel ratio, as a share of what the settings give it. */
  renderScale: number;
}
export const LEVELS: readonly Readonly<Knobs>[] = [
  { shadowScale: 1, lodBias: 1, particles: 1, renderScale: 1 },
  { shadowScale: 0.5, lodBias: 1, particles: 1, renderScale: 1 },
  { shadowScale: 0.5, lodBias: 1.5, particles: 1, renderScale: 1 },
  { shadowScale: 0.5, lodBias: 1.5, particles: 0.6, renderScale: 1 },
  { shadowScale: 0.5, lodBias: 1.5, particles: 0.6, renderScale: 0.85 },
];

export const GOVERNOR = {
  /** Under this frame rate (a median frame over this many ms) for `downAfter` seconds: one level down. */
  slowMs: 1000 / 45,
  downAfter: 3,
  /** Over this frame rate for `upAfter` seconds: one level up (the wait doubles each time that step had to be undone). */
  fastMs: 1000 / 57,
  upAfter: 8,
  maxUpAfter: 120,
  /** A step back down this soon after a step up undoes it (and doubles the wait). */
  undoWithin: 10,
  /** Frames longer than this (a hitch, a tab coming back) are left out. */
  ignoreMs: 250,
} as const;

/** Median of the first `n` values (insertion-sorted into `scratch`; no allocation). */
function median(values: Float32Array, n: number, scratch: Float32Array): number {
  for (let i = 0; i < n; i++) {
    const v = values[i];
    let j = i - 1;
    while (j >= 0 && scratch[j] > v) { scratch[j + 1] = scratch[j]; j--; }
    scratch[j + 1] = v;
  }
  return n ? scratch[n >> 1] : 0;
}

export class Governor {
  level = 0;
  /** The current level's knobs. */
  knobs: Readonly<Knobs> = LEVELS[0];
  private readonly frames = new Float32Array(512);
  private readonly scratch = new Float32Array(512);
  private n = 0;
  /** Seconds in the current one-second window, and how many windows in a row were slow / fast. */
  private window = 0;
  private slow = 0;
  private fast = 0;
  private upAfter: number = GOVERNOR.upAfter;
  /** Seconds since the last step up (Infinity: none to undo). */
  private sinceUp = Infinity;

  /** One frame of `ms`; returns whether the level changed. */
  frame(ms: number): boolean {
    if (!(ms > 0) || ms > GOVERNOR.ignoreMs) return false;
    const s = ms / 1000;
    this.sinceUp += s;
    if (this.n < this.frames.length) this.frames[this.n++] = ms;
    this.window += s;
    if (this.window < 1) return false;
    const m = median(this.frames, this.n, this.scratch);
    this.n = 0; this.window = 0;
    this.slow = m > GOVERNOR.slowMs ? this.slow + 1 : 0;
    this.fast = m < GOVERNOR.fastMs ? this.fast + 1 : 0;
    if (this.slow >= GOVERNOR.downAfter && this.level < LEVELS.length - 1) {
      if (this.sinceUp < GOVERNOR.undoWithin) this.upAfter = Math.min(GOVERNOR.maxUpAfter, this.upAfter * 2);
      this.sinceUp = Infinity;
      return this.set(this.level + 1);
    }
    if (this.fast >= this.upAfter && this.level > 0) {
      this.sinceUp = 0;
      return this.set(this.level - 1);
    }
    return false;
  }

  /** Back to the settings as chosen (a new scene: its own costs). */
  reset() { this.n = 0; this.window = 0; this.slow = 0; this.fast = 0; this.sinceUp = Infinity; return this.set(0); }

  set(level: number): boolean {
    const next = Math.max(0, Math.min(LEVELS.length - 1, level));
    this.slow = 0; this.fast = 0;
    if (next === this.level) return false;
    this.level = next;
    this.knobs = LEVELS[next];
    return true;
  }
}

/** The one the world runs (components/game/QualityGovernor.tsx); what it decides, every system reads from `quality.knobs`. */
export const quality = new Governor();
