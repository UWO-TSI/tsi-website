/**
 * The island's fireflies as one swarm (specs/polish/forage-craft-museum.md 5): every firefly's position, heading and
 * glow written into the swarm's own typed arrays each frame, for one instanced draw of their bodies and one of their
 * glows (components/game/AmbientLife.tsx). Seeded per firefly and stepped on the shared world clock, so everyone sees
 * the same swarm; nothing is allocated after construction.
 */
import { fireflyOffsetInto } from "./fireflyPath";

/** Park-Miller, as the per-firefly components seeded themselves. */
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export class FireflySwarm {
  readonly count: number;
  /** x, y, z per firefly. */
  readonly positions: Float32Array;
  /** Heading (radians about +y), the way it last drifted. */
  readonly yaw: Float32Array;
  /** Glow strength (0..1), pulsing on its own phase. */
  readonly glow: Float32Array;
  private readonly home: Float32Array;
  private readonly drift: Float32Array;
  private readonly phase: Float32Array;
  private readonly offset = new Float32Array(3);
  private started = false;

  constructor(count: number, anchors: readonly (readonly [number, number])[]) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.yaw = new Float32Array(count);
    this.glow = new Float32Array(count);
    this.home = new Float32Array(count * 2);
    this.drift = new Float32Array(count);
    this.phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const rng = seeded((i + 1) * 1013 + 17), anchor = anchors.length ? anchors[i % anchors.length] : null;
      const fx = (rng() - 0.5) * 50, fz = (rng() - 0.5) * 50;
      this.home[i * 2] = anchor ? anchor[0] : fx;
      this.home[i * 2 + 1] = anchor ? anchor[1] : fz;
      this.phase[i] = rng() * Math.PI * 2;
      this.drift[i] = anchor ? 0.65 + rng() * 0.4 : 1.8 + rng() * 1.6;
    }
  }

  /** Every firefly at world second `t`, over `ground`. */
  step(t: number, ground: (x: number, z: number) => number) {
    const o = this.offset, p = this.positions;
    for (let i = 0; i < this.count; i++) {
      fireflyOffsetInto(i + 1, t, o, 0);
      const d = this.drift[i], x = this.home[i * 2] + o[0] * d, z = this.home[i * 2 + 1] + o[2] * d, y = ground(x, z) + o[1];
      const dx = x - p[i * 3], dz = z - p[i * 3 + 2];
      if (this.started && Math.abs(dx) + Math.abs(dz) > 1e-4) this.yaw[i] = Math.atan2(dx, dz);
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      this.glow[i] = Math.min(1, Math.max(0, 0.58 + Math.sin(t * (1.1 + d * 0.3) + this.phase[i]) * 0.4));
    }
    this.started = true;
  }
}
