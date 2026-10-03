/**
 * Remote motion (specs/multiplayer.md §5.3): what the renderer draws other players from, and the registry it loops.
 *
 * Each remote keeps its last RING motion samples in one Float64Array, keyed by the sender's own `t` (room time on the
 * shared clock), and is drawn at `now − transit − delay`:
 * - `transit` is the smallest `arrival − t` among the samples held: the path from the sender through the server to
 *   here, so a far-away remote is not mistaken for a jittery one;
 * - `delay` is INTERP_DELAY_MS's clamp of 1.5 × the observed sample interval + 2 × the jitter (the mean of each
 *   sample's transit over that smallest), INTERP_DELAY_MS.initial until three samples are in. The render clock slews
 *   toward a new value at 10% of real time, so a change never jumps the picture, and never runs backwards. A remote
 *   that comes into view standing still arrives with an old sample; once live ones come, the clock jumps to them.
 *
 * Between two samples the position is a cubic Hermite through both ends with the velocities the sender measured, so
 * 10 Hz still draws a jump's arc; yaw takes the shorter way round (and comes out in [0, 2π)); `move` and `lift` step at
 * their sample's time, and `air` and `leaf` blend while `move` holds. A gap after a stop sample (the sender goes quiet
 * while still) holds there until the last SEG_MAX_MS before the next sample. Past the newest sample (an underrun) it
 * extrapolates with the last velocity for EXTRAPOLATE_MS, then holds; when data comes back, the difference to the
 * corrected path eases out over ERR_TAU_MS, or snaps beyond SNAP_DIST. A sample whose `tp` changed is a teleport:
 * nothing is drawn across it (the segment before extrapolates from its start) and the frame that reaches it is
 * `snapped`, as is a remote's first frame.
 *
 * Events wait in an EVENT_QUEUE ring sorted by time and fire when the render time passes them (their `t` is already
 * the server's `packet t − dtMs`), up to REMOTE_EVENTS a frame, in order; one left more than STALE_EVENT_MS behind
 * (a tab that slept) is dropped. Slow state (pose, held item, weapon, flags) is staged with the newest motion time it
 * came with and applied when the render time reaches it, so a seat's pose lands with the snap onto the seat.
 *
 * `?netsim=lat:120,jit:60,loss:0.03` (parseNetsim) delays everything a remote sends by lat + a random 0..jit ms, in
 * order like a socket, and loses that share of motion samples; the first sample lands at once.
 *
 * `sample()` and the registry's `at()` allocate nothing: typed arrays, scalar scratch, the caller's output object.
 */
import { EV_KINDS, FLAG, INTERP_DELAY_MS, MOVE_CLIPS, dequantAir, dequantLeaf, dequantLift, dequantPos, dequantVel, dequantYaw, tpChanged, type NetPlayer } from "./protocol";
import { REMOTE_EVENTS, type RemoteChange, type RemoteEntry, type RemotePlayer, type RemoteRegistry, type RemoteSample } from "./types";

/** The motion fields of a schema player, wire values (what reflection decodes and the loopback's server copies). */
export type MotionWire = Pick<NetPlayer, "t" | "x" | "y" | "z" | "vx" | "vy" | "vz" | "yaw" | "move" | "air" | "leaf" | "lift" | "tp">;

/** Samples held per remote. */
export const RING = 8;
/** Events waiting per remote. */
export const EVENT_QUEUE = 16;
/** Extrapolation past the newest sample before holding (ms). */
export const EXTRAPOLATE_MS = 250;
/** A correction larger than this (world units) snaps instead of easing. */
export const SNAP_DIST = 3;
/** How fast a correction eases out (ms, exponential). */
export const ERR_TAU_MS = 100;
/** Gaps between samples longer than this are pauses, not the sending interval (ms). */
export const PAUSE_GAP_MS = 400;
/** After a stop sample, only the last this-many ms before the next sample are interpolated (ms). */
export const SEG_MAX_MS = 250;
/** An event left this far behind the render time is dropped, not fired (ms). */
export const STALE_EVENT_MS = 500;
/** The render clock's slew: the share of real time a lag change may take or give back. */
const SLEW = 0.1;
/** A render lag this far over its target is a stale first sample, not a path: jump to the target (ms). */
const STALE_LAG_MS = 500;
/** Slow-state changes waiting per remote. */
const SLOW_QUEUE = 4;
/** In-flight samples per remote under netsim. */
const PENDING = 16;

// A sample's fields in the ring (and the netsim queue, which adds its arrival).
const T = 0, X = 1, Y = 2, Z = 3, VX = 4, VY = 5, VZ = 6, YAW = 7, MOVE = 8, AIR = 9, LEAF = 10, LIFT = 11, SNAP = 12, TRANSIT = 13;
const STRIDE = 14;
const P_ARRIVE = STRIDE, P_STRIDE = STRIDE + 1;

const TAU = 2 * Math.PI;
const wrap = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Simulated network for dev (`?netsim=lat:120,jit:60,loss:0.03`): latency and jitter in ms, loss a share of motion samples. */
export interface Netsim { lat: number; jit: number; loss: number }
/** `?netsim=…` from a location search string, or null (absent or malformed). */
export function parseNetsim(search: string): Netsim | null {
  const raw = new URLSearchParams(search).get("netsim");
  if (!raw) return null;
  const out: Netsim = { lat: 0, jit: 0, loss: 0 };
  for (const part of raw.split(",")) {
    const [k, v] = part.split(":"), n = Number(v);
    if ((k !== "lat" && k !== "jit" && k !== "loss") || v === undefined || v.trim() === "" || !Number.isFinite(n) || n < 0) return null;
    out[k] = n;
  }
  return out.loss > 1 || out.lat > 10_000 || out.jit > 10_000 ? null : out;
}

/** mulberry32: netsim's seeded draws, so a run repeats. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A RemotePlayer's presence bits back as FLAG bits (RemoteSample.flags). */
export function flagsOf(p: RemotePlayer): number {
  return (p.away ? FLAG.away : 0) | (p.afk ? FLAG.afk : 0) | (p.mobile ? FLAG.mobile : 0) | (p.showClass ? FLAG.showClass : 0)
    | (p.typing ? FLAG.typing : 0) | (p.armed ? FLAG.armed : 0);
}

/**
 * One remote player in view: its card and slow state (`player`, replaced on change), its motion ring, its events and
 * its staged slow state. netStore and the loopback feed it (`pushWire`, `pushEvent`, `setPlayer`); the renderer reads
 * it (`sample`).
 */
export class RemoteBuffer implements RemoteEntry {
  readonly sid: number;
  player: RemotePlayer;

  // ── Motion ring: `count` samples from slot `start`, oldest first ──
  private readonly ring = new Float64Array(RING * STRIDE);
  private start = 0;
  private count = 0;
  /** Samples ever landed (the delay waits for three). */
  private seen = 0;
  /** The last `tp` seen (−1 before the first sample). */
  private seenTp = -1;
  /** The newest `t` pushed, landed or still in flight. */
  private pushedT = -Infinity;
  /** Sending interval and jitter estimates (ms). */
  private interval = 100;
  private jitter = 0;

  // ── Netsim: samples in flight, in arrival order ──
  private readonly netsim: Netsim | null;
  private readonly draw: () => number;
  private readonly pend: Float64Array;
  private pStart = 0;
  private pCount = 0;
  /** The latest arrival scheduled: a socket delivers in order. */
  private lastArrive = -Infinity;

  // ── The render clock and what was drawn last frame ──
  private lag = NaN;
  private lastNow = NaN;
  private lastT = -Infinity;
  private drawn = false;
  private lastExtrap = false;
  private lastNewestT = -Infinity;
  private ox = 0; private oy = 0; private oz = 0; private oyaw = 0;
  private errX = 0; private errY = 0; private errZ = 0; private errYaw = 0;
  /** The `t` of the last teleport sample drawn. */
  private snapT = -Infinity;

  // ── eval() scratch: the path at one render time ──
  private ex = 0; private ey = 0; private ez = 0; private evx = 0; private evy = 0; private evz = 0; private eyaw = 0;
  private emove = 0; private eair = 0; private eleaf = 0; private elift = 0;
  /** Past the newest sample (an underrun). */
  private eExtrap = false;

  // ── Events: `evCount` from `evStart`, sorted by time ──
  private readonly evT = new Float64Array(EVENT_QUEUE);
  private readonly evArrive = new Float64Array(EVENT_QUEUE);
  private readonly evKind = new Uint8Array(EVENT_QUEUE);
  private readonly evValue: (number | string)[] = new Array<number | string>(EVENT_QUEUE).fill(0);
  private evStart = 0;
  private evCount = 0;

  // ── Slow state: applied, and staged with the motion time it came with ──
  private pose: string | null;
  private held: string;
  private weapon: string;
  private flags: number;
  private readonly slowTag = new Float64Array(SLOW_QUEUE);
  private readonly slowArrive = new Float64Array(SLOW_QUEUE);
  private readonly slowPose: (string | null)[] = new Array<string | null>(SLOW_QUEUE).fill(null);
  private readonly slowHeld: string[] = new Array<string>(SLOW_QUEUE).fill("");
  private readonly slowWeapon: string[] = new Array<string>(SLOW_QUEUE).fill("");
  private readonly slowFlags = new Uint8Array(SLOW_QUEUE);
  private slowStart = 0;
  private slowCount = 0;

  constructor(sid: number, player: RemotePlayer, netsim: Netsim | null = null) {
    this.sid = sid;
    this.player = player;
    this.pose = player.pose; this.held = player.held; this.weapon = player.weapon; this.flags = flagsOf(player);
    this.netsim = netsim && (netsim.lat > 0 || netsim.jit > 0 || netsim.loss > 0) ? netsim : null;
    this.draw = rng(0x9e3779b9 ^ sid);
    this.pend = new Float64Array(this.netsim ? PENDING * P_STRIDE : 0);
  }

  /** Samples held (landed), and whether any has. */
  get samples() { return this.count; }
  /** The render lag in ms (transit + delay) as of the last `sample`, NaN before. */
  get renderLag() { return this.lag; }
  /** The delay over transit that the next frames slew toward (ms). */
  get delay() {
    return this.seen < 3 ? INTERP_DELAY_MS.initial : clamp(1.5 * this.interval + 2 * this.jitter, INTERP_DELAY_MS.min, INTERP_DELAY_MS.max);
  }

  /** When something sent now lands, or null for a lost motion sample (netsim). In order, like a socket. */
  private arrival(now: number, lossy: boolean): number | null {
    const sim = this.netsim;
    if (!sim) return now;
    if (this.count === 0 && this.pCount === 0 && lossy) return (this.lastArrive = Math.max(this.lastArrive, now));
    if (lossy && sim.loss > 0 && this.draw() < sim.loss) return null;
    return (this.lastArrive = Math.max(this.lastArrive, now + sim.lat + this.draw() * sim.jit));
  }

  /**
   * A motion sample as the schema carries it (wire values), received at room time `now`. A changed `tp` makes it a
   * teleport. Samples not newer than the newest pushed are dropped (the server never sends one).
   */
  pushWire(w: MotionWire, now: number): void {
    const snap = this.seenTp >= 0 && tpChanged(this.seenTp, w.tp);
    this.seenTp = w.tp;
    this.push(w.t, dequantPos(w.x), dequantPos(w.y), dequantPos(w.z), dequantVel(w.vx), dequantVel(w.vy), dequantVel(w.vz), dequantYaw(w.yaw),
      w.move, dequantAir(w.air), dequantLeaf(w.leaf), dequantLift(w.lift), snap, now);
  }

  /** A motion sample in world units and radians (`t` room time, `move` a MOVE_CLIPS index), received at `now`. */
  push(t: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, yaw: number, move: number, air: number, leaf: number,
    lift: number, snap: boolean, now: number): void {
    if (!(t >= this.pushedT)) {
      return; // older than what we have (or NaN)
    }
    if (t === this.pushedT && this.count + this.pCount > 0) {
      // The same sample again: take its values, keep one sample (and its teleport, if either was one).
      const a = this.pCount > 0 ? this.pend : this.ring, o = this.pCount > 0 ? this.pSlot(this.pCount - 1) * P_STRIDE : this.slot(this.count - 1) * STRIDE;
      this.write(a, o, t, x, y, z, vx, vy, vz, yaw, move, air, leaf, lift, snap || a[o + SNAP] === 1);
      return;
    }
    const arrive = this.arrival(now, true);
    if (arrive === null) return;
    this.pushedT = t;
    if (this.netsim && (this.pCount > 0 || arrive > now)) {
      if (this.pCount === PENDING) this.landPending(); // never happens at sane rates: land the oldest early
      const o = this.pSlot(this.pCount++) * P_STRIDE;
      this.write(this.pend, o, t, x, y, z, vx, vy, vz, yaw, move, air, leaf, lift, snap);
      this.pend[o + P_ARRIVE] = arrive;
      return;
    }
    this.land(t, x, y, z, vx, vy, vz, yaw, move, air, leaf, lift, snap, arrive);
  }

  private write(a: Float64Array, o: number, t: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, yaw: number,
    move: number, air: number, leaf: number, lift: number, snap: boolean) {
    a[o + T] = t; a[o + X] = x; a[o + Y] = y; a[o + Z] = z; a[o + VX] = vx; a[o + VY] = vy; a[o + VZ] = vz; a[o + YAW] = yaw;
    a[o + MOVE] = move; a[o + AIR] = air; a[o + LEAF] = leaf; a[o + LIFT] = lift; a[o + SNAP] = snap ? 1 : 0;
  }

  /** Into the ring: the interval and jitter estimates follow. */
  private land(t: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, yaw: number, move: number, air: number, leaf: number,
    lift: number, snap: boolean, arrive: number) {
    if (this.count > 0) {
      const gap = t - this.ring[this.slot(this.count - 1) * STRIDE + T];
      if (gap > 0 && gap <= PAUSE_GAP_MS) this.interval += 0.1 * (gap - this.interval);
    }
    if (this.count === RING) this.start = (this.start + 1) % RING;
    else this.count++;
    const o = this.slot(this.count - 1) * STRIDE;
    this.write(this.ring, o, t, x, y, z, vx, vy, vz, yaw, move, air, leaf, lift, snap);
    this.ring[o + TRANSIT] = arrive - t;
    this.seen++;
    if (this.seen > 1) this.jitter += 0.1 * (arrive - t - this.transit() - this.jitter);
  }

  private landPending() {
    const o = this.pSlot(0) * P_STRIDE, p = this.pend;
    this.land(p[o + T], p[o + X], p[o + Y], p[o + Z], p[o + VX], p[o + VY], p[o + VZ], p[o + YAW], p[o + MOVE], p[o + AIR], p[o + LEAF], p[o + LIFT],
      p[o + SNAP] === 1, p[o + P_ARRIVE]);
    this.pStart = (this.pStart + 1) % PENDING;
    this.pCount--;
  }

  /** Netsim: land what has arrived by `now`. */
  private drain(now: number) {
    while (this.pCount > 0 && this.pend[this.pSlot(0) * P_STRIDE + P_ARRIVE] <= now) this.landPending();
  }

  private slot(i: number) { return (this.start + i) % RING; }
  private pSlot(i: number) { return (this.pStart + i) % PENDING; }

  /** The smallest transit among the samples held: the path, without its jitter. */
  private transit() {
    let m = Infinity;
    for (let i = 0; i < this.count; i++) m = Math.min(m, this.ring[this.slot(i) * STRIDE + TRANSIT]);
    return m;
  }

  /** A one-shot (`kind` an EV_KINDS index) at room time `t` (the server's packet t − dtMs), received at `now`. */
  pushEvent(t: number, kind: number, value: number | string, now: number): void {
    if (!Number.isInteger(kind) || kind < 0 || kind >= EV_KINDS.length || !Number.isFinite(t)) return;
    const arrive = this.arrival(now, false)!;
    if (this.evCount === EVENT_QUEUE) { this.evStart = (this.evStart + 1) % EVENT_QUEUE; this.evCount--; } // the oldest goes
    let i = this.evCount;
    // Sorted by time: an event older than ones already queued moves in front of them.
    while (i > 0 && this.evT[this.evSlot(i - 1)] > t) {
      const from = this.evSlot(i - 1), to = this.evSlot(i);
      this.evT[to] = this.evT[from]; this.evArrive[to] = this.evArrive[from]; this.evKind[to] = this.evKind[from]; this.evValue[to] = this.evValue[from];
      i--;
    }
    const s = this.evSlot(i);
    this.evT[s] = t; this.evArrive[s] = arrive; this.evKind[s] = kind; this.evValue[s] = value;
    this.evCount++;
  }
  private evSlot(i: number) { return (this.evStart + i) % EVENT_QUEUE; }

  /**
   * A new card or slow state (the renderer's `player` is replaced at once), received at `now`. Its pose, held item,
   * weapon and flags reach `sample` when the render time gets to the newest motion sample it came with.
   */
  setPlayer(player: RemotePlayer, now: number): void {
    this.player = player;
    const arrive = this.arrival(now, false)!;
    if (this.slowCount === SLOW_QUEUE) this.applySlow(0); // the oldest lands early
    const s = (this.slowStart + this.slowCount++) % SLOW_QUEUE;
    this.slowTag[s] = this.pushedT; this.slowArrive[s] = arrive;
    this.slowPose[s] = player.pose; this.slowHeld[s] = player.held; this.slowWeapon[s] = player.weapon; this.slowFlags[s] = flagsOf(player);
  }
  private applySlow(i: number) {
    const s = (this.slowStart + i) % SLOW_QUEUE;
    this.pose = this.slowPose[s]; this.held = this.slowHeld[s]; this.weapon = this.slowWeapon[s]; this.flags = this.slowFlags[s];
    this.slowStart = (this.slowStart + 1) % SLOW_QUEUE;
    this.slowCount--;
  }

  /**
   * The path at render time `rt`, into the e* scratch. Before the oldest sample: held there. Past the newest:
   * extrapolated (capped, then held). Before a teleport sample: extrapolated from the segment's start, never across.
   */
  evaluate(rt: number): void {
    const r = this.ring, n = this.count;
    let i = n - 1;
    while (i >= 0 && r[this.slot(i) * STRIDE + T] > rt) i--;
    if (i < 0) {
      this.hold(this.slot(0) * STRIDE, false);
      return;
    }
    const a = this.slot(i) * STRIDE;
    if (i === n - 1) {
      this.extrapolate(a, rt, true);
      return;
    }
    const b = this.slot(i + 1) * STRIDE;
    if (r[b + SNAP] === 1) {
      this.extrapolate(a, rt, false);
      return;
    }
    const ta = r[a + T], t1 = r[b + T];
    let t0 = ta;
    // A stop sample then silence: hold there until the last SEG_MAX_MS before the next sample.
    if (t1 - ta > SEG_MAX_MS && Math.abs(r[a + VX]) + Math.abs(r[a + VY]) + Math.abs(r[a + VZ]) < 0.05) {
      t0 = t1 - SEG_MAX_MS;
      if (rt < t0) {
        this.hold(a, false);
        return;
      }
    }
    const h = (t1 - t0) / 1000, s = (rt - t0) / (t1 - t0), s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = 3 * s2 - 2 * s3, h11 = s3 - s2;
    const d00 = 6 * s2 - 6 * s, d10 = 3 * s2 - 4 * s + 1, d01 = 6 * s - 6 * s2, d11 = 3 * s2 - 2 * s;
    // Before t0 (held) the start's velocity is 0.
    const k = t0 === ta ? 1 : 0;
    const vax = r[a + VX] * k, vay = r[a + VY] * k, vaz = r[a + VZ] * k;
    const vby = r[b + VY];
    this.ex = h00 * r[a + X] + h10 * h * vax + h01 * r[b + X] + h11 * h * r[b + VX];
    this.ey = h00 * r[a + Y] + h10 * h * vay + h01 * r[b + Y] + h11 * h * vby;
    this.ez = h00 * r[a + Z] + h10 * h * vaz + h01 * r[b + Z] + h11 * h * r[b + VZ];
    this.evx = (d00 * r[a + X] + d10 * h * vax + d01 * r[b + X] + d11 * h * r[b + VX]) / h;
    this.evy = (d00 * r[a + Y] + d10 * h * vay + d01 * r[b + Y] + d11 * h * vby) / h;
    this.evz = (d00 * r[a + Z] + d10 * h * vaz + d01 * r[b + Z] + d11 * h * r[b + VZ]) / h;
    this.eyaw = r[a + YAW] + wrap(r[b + YAW] - r[a + YAW]) * s;
    const same = r[a + MOVE] === r[b + MOVE];
    this.emove = r[a + MOVE];
    this.eair = same ? r[a + AIR] + (r[b + AIR] - r[a + AIR]) * s : r[a + AIR];
    this.eleaf = same ? r[a + LEAF] + (r[b + LEAF] - r[a + LEAF]) * s : r[a + LEAF];
    this.elift = r[a + LIFT];
    this.eExtrap = false;
  }

  private hold(o: number, extrap: boolean) {
    const r = this.ring;
    this.ex = r[o + X]; this.ey = r[o + Y]; this.ez = r[o + Z];
    this.evx = this.evy = this.evz = 0;
    this.eyaw = r[o + YAW]; this.emove = r[o + MOVE]; this.eair = r[o + AIR]; this.eleaf = r[o + LEAF]; this.elift = r[o + LIFT];
    this.eExtrap = extrap;
  }

  private extrapolate(o: number, rt: number, underrun: boolean) {
    const r = this.ring, dt = rt - r[o + T];
    if (dt > EXTRAPOLATE_MS) {
      this.hold(o, underrun);
      const k = EXTRAPOLATE_MS / 1000;
      this.ex += r[o + VX] * k; this.ey += r[o + VY] * k; this.ez += r[o + VZ] * k;
      return;
    }
    const k = dt / 1000;
    this.hold(o, underrun);
    this.ex += r[o + VX] * k; this.ey += r[o + VY] * k; this.ez += r[o + VZ] * k;
    this.evx = r[o + VX]; this.evy = r[o + VY]; this.evz = r[o + VZ];
  }

  /**
   * Interpolate into `out` at room time `now` minus this remote's lag, moving due one-shots into `out.events`.
   * Allocates nothing; returns `out`.
   */
  sample(now: number, out: RemoteSample): RemoteSample {
    if (this.pCount > 0) this.drain(now);
    out.eventCount = 0;
    out.snapped = false;
    if (this.count === 0) {
      while (this.slowCount > 0 && this.slowArrive[this.slowStart] <= now) this.applySlow(0);
      this.writeSlow(out);
      return out;
    }
    const target = this.transit() + this.delay;
    const frame = this.lastNow === this.lastNow ? clamp(now - this.lastNow, 0, 100) : 0;
    // A remote that came into view standing still arrives with an old sample (a long "transit"): once fresher ones
    // show the real path, the render clock jumps forward to it rather than taking minutes to slew.
    if (this.lag !== this.lag || this.lag - target > STALE_LAG_MS) this.lag = target;
    else this.lag += clamp(target - this.lag, -frame * SLEW, frame * SLEW);
    this.lastNow = now;
    let rt = now - this.lag;
    if (rt < this.lastT) rt = this.lastT; // the picture never runs backwards
    const newestT = this.ring[this.slot(this.count - 1) * STRIDE + T];

    let snapped = !this.drawn;
    // Data arrived after an underrun: what was drawn last frame, against the path it should have been on, eases out.
    if (this.drawn && this.lastExtrap && newestT > this.lastNewestT) {
      this.evaluate(this.lastT);
      this.errX = this.ox - this.ex; this.errY = this.oy - this.ey; this.errZ = this.oz - this.ez;
      this.errYaw = wrap(this.oyaw - this.eyaw);
      if (Math.hypot(this.errX, this.errY, this.errZ) > SNAP_DIST) snapped = true;
    }
    this.evaluate(rt);
    // Any teleport sample the render time has passed since last frame (even one a long frame skipped over).
    for (let i = 0; i < this.count; i++) {
      const o = this.slot(i) * STRIDE, t = this.ring[o + T];
      if (this.ring[o + SNAP] === 1 && t > this.snapT && t <= rt) { snapped = true; this.snapT = t; }
    }
    if (snapped) {
      this.errX = this.errY = this.errZ = this.errYaw = 0;
    } else if (frame > 0 && (this.errX !== 0 || this.errY !== 0 || this.errZ !== 0 || this.errYaw !== 0)) {
      const k = Math.exp(-frame / ERR_TAU_MS);
      this.errX *= k; this.errY *= k; this.errZ *= k; this.errYaw *= k;
      if (Math.abs(this.errX) + Math.abs(this.errY) + Math.abs(this.errZ) + Math.abs(this.errYaw) < 1e-4) this.errX = this.errY = this.errZ = this.errYaw = 0;
    }
    out.x = this.ox = this.ex + this.errX;
    out.y = this.oy = this.ey + this.errY;
    out.z = this.oz = this.ez + this.errZ;
    this.oyaw = this.eyaw + this.errYaw;
    out.yaw = this.oyaw - TAU * Math.floor(this.oyaw / TAU);
    out.vx = this.evx; out.vy = this.evy; out.vz = this.evz;
    out.move = MOVE_CLIPS[this.emove] ?? null;
    out.air = this.eair; out.leaf = this.eleaf; out.lift = this.elift;
    out.snapped = snapped;
    this.drawn = true;
    this.lastT = rt;
    this.lastExtrap = this.eExtrap;
    this.lastNewestT = newestT;

    // Slow state that has reached the render time, then the one-shots due.
    while (this.slowCount > 0 && this.slowTag[this.slowStart] <= rt && this.slowArrive[this.slowStart] <= now) this.applySlow(0);
    this.writeSlow(out);
    while (this.evCount > 0 && out.eventCount < REMOTE_EVENTS) {
      const s = this.evStart, t = this.evT[s];
      if (t > rt || this.evArrive[s] > now) break;
      this.evStart = (this.evStart + 1) % EVENT_QUEUE;
      this.evCount--;
      if (rt - t > STALE_EVENT_MS) continue;
      const e = out.events[out.eventCount++];
      e.kind = EV_KINDS[this.evKind[s]]; e.value = this.evValue[s]; e.t = t;
    }
    return out;
  }

  private writeSlow(out: RemoteSample) {
    out.pose = this.pose; out.held = this.held; out.weapon = this.weapon; out.flags = this.flags;
  }

  /** Tests: the path at the last `evaluate` (a new object each read; never on the frame path). */
  get evaluated(): { x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number; extrapolating: boolean } {
    return { x: this.ex, y: this.ey, z: this.ez, vx: this.evx, vy: this.evy, vz: this.evz, yaw: this.eyaw, extrapolating: this.eExtrap };
  }
}

/**
 * The remotes in view (RemoteRegistry): a dense list the renderer walks with `at(i)` and a map by sid. Removal swaps
 * the last entry into the gap, so the order may change; nothing allocates while iterating.
 */
export class Remotes implements RemoteRegistry {
  private readonly list: RemoteBuffer[] = [];
  private readonly bySid = new Map<number, RemoteBuffer>();
  private readonly listeners = new Set<(change: RemoteChange, entry: RemoteEntry) => void>();

  get size() { return this.list.length; }
  at(index: number): RemoteBuffer { return this.list[index]; }
  get(sid: number): RemoteBuffer | undefined { return this.bySid.get(sid); }
  subscribe(listener: (change: RemoteChange, entry: RemoteEntry) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Add (or replace) a remote; announce it. */
  add(entry: RemoteBuffer): void {
    const had = this.bySid.get(entry.sid);
    if (had === entry) return;
    if (had) this.remove(entry.sid);
    this.bySid.set(entry.sid, entry);
    this.list.push(entry);
    this.emit("add", entry);
  }
  /** Take a remote out of view; announce it. */
  remove(sid: number): void {
    const entry = this.bySid.get(sid);
    if (!entry) return;
    this.bySid.delete(sid);
    const i = this.list.indexOf(entry), last = this.list.pop()!;
    if (last !== entry) this.list[i] = last;
    this.emit("remove", entry);
  }
  /** A remote's card or slow state changed (its `player` was replaced). */
  changed(entry: RemoteBuffer): void {
    if (this.bySid.get(entry.sid) === entry) this.emit("change", entry);
  }
  /** Everyone leaves view (a disconnect, an area change). */
  clear(): void {
    while (this.list.length) this.remove(this.list[this.list.length - 1].sid);
  }
  private emit(change: RemoteChange, entry: RemoteEntry) {
    for (const l of this.listeners) {
      try { l(change, entry); } catch (e) { console.error(e); }
    }
  }
}
