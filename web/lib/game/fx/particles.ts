/**
 * The movement particle pool (specs/movement-feel.md deliverable 2): every
 * puff, fleck, droplet, ripple, streak and swirl the moves throw, from our own
 * painted pack (pack.ts). Plain typed arrays, fixed capacity, a ring that
 * reuses the oldest slot: nothing is allocated after construction, per spawn
 * or per frame. The renderer (components/game/movement/moveFx.ts) draws the
 * four instance arrays `a`..`d` in one call.
 *
 * Each burst is seeded (`burst(..., seed)`), so the same move event at the
 * same spot throws the same particles on every client (look spec §7.1). Wind
 * is the shared world wind; nothing here reads a clock, the camera or "the"
 * player.
 */
import { PACK, PACK_COLS, type SpriteName } from "./pack";

/** How a particle faces: the camera (centred, or standing on its bottom edge), flat on the ground, or a streak along its axis. */
export const FACE = { billboard: 0, ground: 1, streak: 2, standing: 3 } as const;
export type Face = (typeof FACE)[keyof typeof FACE];

/**
 * One kind of burst. Sizes are world units (a character stands 1.36), speeds u/s, `[min, max]` pairs are drawn
 * per particle. `dir` at the call is the main direction (zero: all round), `spread` the cone round it in radians.
 */
export interface Recipe<S extends string = SpriteName> {
  sprite: S;
  count: readonly [number, number];
  life: readonly [number, number];
  size: readonly [number, number];
  /** Size at death over size at birth (eased out). */
  grow: number;
  /** Height over width (a streak is long and thin). */
  aspect?: number;
  speed: readonly [number, number];
  spread: number;
  up: readonly [number, number];
  gravity: number;
  /** How fast it eases to the wind (1/s): dust hangs, grains fly. */
  drag: number;
  /** How much of the world wind it rides (0..1). */
  wind: number;
  /** Vertical speed it eases to (dust rises a little). */
  lift?: number;
  spin?: number;
  /** Frames per second to cycle the flipbook (a tumbling leaf); 0 plays it once over the life. */
  fps?: number;
  alpha: number;
  face: Face;
  /** Spawn scatter round the point (u). */
  jitter?: number;
  /** Height the particles start above the point, [min, max]. */
  rise?: readonly [number, number];
  /** How fast it fades in, in lives (10: over its first tenth); a footprint is there at once. */
  fadeIn?: number;
}

const FRAMES = PACK_COLS;

// Seeded randomness for bursts (mulberry32): one module-level state, reseeded per burst.
let rs = 0;
const reseed = (seed: number) => { rs = seed | 0; };
function rnd(): number {
  rs = (rs + 0x6d2b79f5) | 0;
  let t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const range = (r: readonly [number, number]) => r[0] + (r[1] - r[0]) * rnd();

/** A seed from a spot and a salt: the same event at the same place throws the same particles. */
export function seedAt(x: number, z: number, salt: number): number {
  let h = Math.imul(Math.round(x * 64) | 0, 0x9e3779b1) ^ Math.imul((Math.round(z * 64) | 0) + 0x632be5ab, 0x85ebca77) ^ Math.imul(salt | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  return (h ^ (h >>> 15)) | 0;
}

/** sRGB hex to linear 0..1 channels (the renderer's colour space). */
const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };

export class ParticlePool {
  readonly capacity: number;
  /** Instance data, back to front after `write`: (x, y, z, ground), (width, height, rotation, frame), (r, g, b, a), (axis x, y, z, face). */
  readonly a: Float32Array; readonly b: Float32Array; readonly c: Float32Array; readonly d: Float32Array;
  /** Particles written by the last `write`. */
  count = 0;
  private next = 0;
  private readonly px; private readonly py; private readonly pz; private readonly vx; private readonly vy; private readonly vz;
  private readonly age; private readonly life; private readonly size; private readonly grow; private readonly aspect;
  private readonly rot; private readonly spin; private readonly row; private readonly fps; private readonly frame0;
  private readonly cr; private readonly cg; private readonly cb; private readonly alpha;
  private readonly gravity; private readonly drag; private readonly windK; private readonly lift; private readonly ground;
  private readonly face; private readonly ax; private readonly az; private readonly fadeIn;
  private readonly order: Uint16Array; private readonly depth: Float32Array;

  /**
   * `sheet`: the atlas layout whose rows the recipes name (the movement pack by default; zone 1's mob effects pass
   * lib/game/fx/mobPack.ts MOB_PACK, same 8-frame rows).
   */
  constructor(capacity = 384, private readonly sheet: Readonly<Record<string, { row: number }>> = PACK) {
    this.capacity = capacity;
    const f = () => new Float32Array(capacity);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.age = f(); this.life = f(); this.size = f(); this.grow = f(); this.aspect = f();
    this.rot = f(); this.spin = f(); this.row = f(); this.fps = f(); this.frame0 = f();
    this.cr = f(); this.cg = f(); this.cb = f(); this.alpha = f();
    this.gravity = f(); this.drag = f(); this.windK = f(); this.lift = f(); this.ground = f();
    this.face = new Uint8Array(capacity); this.ax = f(); this.az = f(); this.fadeIn = f();
    this.order = new Uint16Array(capacity); this.depth = f();
    this.a = new Float32Array(capacity * 4); this.b = new Float32Array(capacity * 4);
    this.c = new Float32Array(capacity * 4); this.d = new Float32Array(capacity * 4);
  }

  /** Particles alive now. */
  get alive(): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.life[i] > 0) n++;
    return n;
  }

  /**
   * Throw a burst at (x, y, z) on ground `groundY`: `dirX, dirZ` the main way (0, 0 all round), `scale` on sizes,
   * speeds and count, `tint` sRGB hex, `alpha` on top of the recipe's. Returns how many it threw.
   */
  burst(r: Recipe<string>, x: number, y: number, z: number, groundY: number, dirX: number, dirZ: number, scale: number, tint: number, seed: number, alpha = 1): number {
    reseed(seed);
    const n = Math.max(0, Math.round(range(r.count) * Math.min(1.6, Math.max(0.6, scale))));
    const tr = lin((tint >> 16) & 255), tg = lin((tint >> 8) & 255), tb = lin(tint & 255);
    const dl = Math.hypot(dirX, dirZ), base = dl > 1e-6 ? Math.atan2(dirX, dirZ) : 0, round = dl <= 1e-6;
    const sprite = this.sheet[r.sprite].row;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (i + 1) % this.capacity;
      // Evenly round a ring when there is no direction (a landing ring), jittered; else a cone round `dir`.
      const ang = round ? (k / n) * Math.PI * 2 + (rnd() - 0.5) * (Math.PI * 2 / n) * 0.8 : base + (rnd() - 0.5) * 2 * r.spread;
      const sp = range(r.speed) * scale, sx = Math.sin(ang), sz = Math.cos(ang), j = (r.jitter ?? 0) * rnd();
      this.px[i] = x + sx * j; this.pz[i] = z + sz * j; this.py[i] = y + (r.rise ? range(r.rise) : 0);
      this.vx[i] = sx * sp; this.vz[i] = sz * sp; this.vy[i] = range(r.up) * Math.sqrt(scale);
      this.age[i] = 0; this.life[i] = range(r.life);
      this.size[i] = range(r.size) * scale; this.grow[i] = r.grow; this.aspect[i] = r.aspect ?? 1;
      this.rot[i] = r.face === FACE.streak ? 0 : (rnd() - 0.5) * (r.face === FACE.ground ? Math.PI * 2 : 0.6);
      this.spin[i] = (rnd() - 0.5) * 2 * (r.spin ?? 0);
      this.row[i] = sprite; this.fps[i] = r.fps ?? 0; this.frame0[i] = Math.floor(rnd() * FRAMES);
      this.cr[i] = tr; this.cg[i] = tg; this.cb[i] = tb; this.alpha[i] = r.alpha * alpha;
      this.gravity[i] = r.gravity; this.drag[i] = r.drag; this.windK[i] = r.wind; this.lift[i] = r.lift ?? 0; this.ground[i] = groundY;
      this.face[i] = r.face; this.fadeIn[i] = r.fadeIn ?? 10;
      // A streak lies along its direction (or its velocity); a ground decal turns to it.
      this.ax[i] = round ? sx : dirX / dl; this.az[i] = round ? sz : dirZ / dl;
      if (r.face === FACE.ground && !round) this.rot[i] = Math.atan2(-this.az[i], this.ax[i]);
    }
    return n;
  }

  /** Move a burst's particles on with an extra velocity (a landing at speed carries its dust along). */
  carry(n: number, vx: number, vz: number) {
    for (let k = 1; k <= n; k++) {
      const i = (this.next - k + this.capacity) % this.capacity;
      this.vx[i] += vx; this.vz[i] += vz;
    }
  }

  /** Step every particle: ease toward the wind (and its lift), fall, settle on the ground, age. */
  update(dt: number, windX: number, windZ: number) {
    if (dt <= 0) return;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      const age = this.age[i] + dt;
      if (age >= this.life[i]) { this.life[i] = 0; continue; }
      this.age[i] = age;
      const k = 1 - Math.exp(-this.drag[i] * dt), w = this.windK[i];
      this.vx[i] += (windX * w - this.vx[i]) * k;
      this.vz[i] += (windZ * w - this.vz[i]) * k;
      this.vy[i] += (this.lift[i] - this.vy[i]) * k - this.gravity[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      this.rot[i] += this.spin[i] * dt;
      // Grains, flecks and drops come to rest on the ground they were thrown from; nothing sinks into it.
      const floor = this.ground[i] + (this.face[i] === FACE.ground ? 0.02 : this.gravity[i] > 0 ? this.size[i] * 0.3 : 0);
      if (this.py[i] < floor) {
        this.py[i] = floor;
        if (this.vy[i] < 0) { this.vy[i] = 0; this.vx[i] *= 0.4; this.vz[i] *= 0.4; this.spin[i] *= 0.3; }
      }
    }
  }

  /** Fill the instance arrays, farthest from the camera first (the order the blend needs), and return the count. */
  write(camX: number, camY: number, camZ: number, fwdX: number, fwdY: number, fwdZ: number): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      const dz = (this.px[i] - camX) * fwdX + (this.py[i] - camY) * fwdY + (this.pz[i] - camZ) * fwdZ;
      // Insertion sort into `order` by depth, far first (no allocation; the list is short and mostly in order).
      let j = n++;
      while (j > 0 && this.depth[j - 1] < dz) { this.depth[j] = this.depth[j - 1]; this.order[j] = this.order[j - 1]; j--; }
      this.depth[j] = dz; this.order[j] = i;
    }
    for (let o = 0; o < n; o++) {
      const i = this.order[o], t = this.age[i] / this.life[i], q = o * 4;
      const size = this.size[i] * (1 + (this.grow[i] - 1) * (1 - (1 - t) * (1 - t)));
      const frame = this.fps[i] > 0 ? (this.frame0[i] + Math.floor(this.age[i] * this.fps[i])) % FRAMES : Math.min(FRAMES - 1, Math.floor(t * FRAMES));
      // Fade in over the first tenth (or as the recipe says), out over the last third (the flipbook also breaks up as it goes).
      const fade = Math.min(1, t * this.fadeIn[i]) * (1 - smooth(0.62, 1, t));
      this.a[q] = this.px[i]; this.a[q + 1] = this.py[i]; this.a[q + 2] = this.pz[i]; this.a[q + 3] = this.ground[i];
      this.b[q] = size; this.b[q + 1] = size * this.aspect[i]; this.b[q + 2] = this.rot[i]; this.b[q + 3] = this.row[i] * FRAMES + frame;
      this.c[q] = this.cr[i]; this.c[q + 1] = this.cg[i]; this.c[q + 2] = this.cb[i]; this.c[q + 3] = this.alpha[i] * fade;
      this.d[q] = this.ax[i]; this.d[q + 1] = 0; this.d[q + 2] = this.az[i]; this.d[q + 3] = this.face[i];
    }
    return (this.count = n);
  }

  /** Forget every particle (a scene change). */
  clear() { this.life.fill(0); this.count = 0; }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
