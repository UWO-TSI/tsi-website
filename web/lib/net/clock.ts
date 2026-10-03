/**
 * The shared clock (specs/multiplayer.md §4.7): the room's time, from pings, so every client's world clock and every
 * sample's `t` sit on one timeline.
 *
 * - At join, CLOCK.burst pings BURST_GAP_MS apart, then one every CLOCK.everyMs. The burst's spacing is
 *   CLOCK.burstGapMs widened to the room's ping limit (RATE_LIMITS.ping: at 200 ms the room would drop two of five).
 * - Each pong is a ClockSample; the offset (server minus local) is estimateClockOffset over the last CLOCK.window.
 * - The world clock gets it through setWorldClockOffset when it moves more than CLOCK.applyOverMs, unless a dev `?at=`
 *   preview owns the world clock (useIslandConditions writes the same offset and resets it on unmount).
 * - `serverNow()`: the local wall clock plus the offset. The first estimate takes effect at once; later ones slew at
 *   10% of real time, so room time never jumps or runs backwards under a sample's `t`.
 */
import { CLOCK, RATE_LIMITS, estimateClockOffset, type ClockSample, type Pong } from "./protocol";

/** The join burst's spacing (ms): never faster than the room takes pings. */
export const BURST_GAP_MS = Math.max(CLOCK.burstGapMs, 1000 / RATE_LIMITS.ping.perSecond);
/** How fast a later estimate moves room time: this share of real time. */
const SLEW = 0.1;

export interface ClockDeps {
  /** The wall clock, ms since the epoch, with sub-millisecond steps. */
  wall(): number;
  /** Send `ping [clientMs]`. */
  ping(clientMs: number): void;
  /** The world clock's offset (setWorldClockOffset). */
  applyWorld(offsetMs: number): void;
  /** A dev `?at=` preview owns the world clock. */
  previewActive(): boolean;
  /** setTimeout; returns the cancel. */
  later(fn: () => void, ms: number): () => void;
}

export class NetClock {
  private readonly samples: ClockSample[] = [];
  private target = 0;
  private offset = 0;
  private lastWall = NaN;
  private applied = 0;
  private cancel: (() => void) | null = null;
  private pings = 0;
  /** An estimate is in: room time is the server's. */
  synced = false;

  constructor(private readonly deps: ClockDeps) {}

  /** The pings: the burst, then every CLOCK.everyMs, until `stop`. */
  start(): void {
    this.stop();
    this.pings = 0;
    const next = () => {
      this.deps.ping(this.deps.wall());
      this.pings++;
      this.cancel = this.deps.later(next, this.pings < CLOCK.burst ? BURST_GAP_MS : CLOCK.everyMs);
    };
    next();
  }
  stop(): void {
    this.cancel?.();
    this.cancel = null;
  }

  /** A pong: one more sample, a new estimate, and the world clock if it moved enough. */
  onPong(pong: Pong): void {
    const received = this.deps.wall();
    if (!(pong.client <= received)) return;
    this.samples.push({ sent: pong.client, received, server: pong.server });
    if (this.samples.length > CLOCK.window) this.samples.shift();
    const est = estimateClockOffset(this.samples);
    if (est === null) return;
    this.target = est;
    if (!this.synced) {
      this.synced = true;
      this.offset = est;
      this.lastWall = received;
    }
    if (!this.deps.previewActive() && Math.abs(est - this.applied) > CLOCK.applyOverMs) {
      this.applied = est;
      this.deps.applyWorld(est);
    }
  }

  /** Server time now (ms since the epoch): the wall clock plus the offset, slewing toward the latest estimate. */
  serverNow(): number {
    const w = this.deps.wall();
    if (this.synced) {
      const dt = this.lastWall === this.lastWall ? Math.max(0, w - this.lastWall) : 0, step = dt * SLEW;
      this.offset += Math.max(-step, Math.min(step, this.target - this.offset));
      this.lastWall = w;
    }
    return w + this.offset;
  }
  /** The latest estimate (ms, server minus local), and what the world clock was given. */
  get estimate() { return this.target; }
  get worldOffset() { return this.applied; }
}
