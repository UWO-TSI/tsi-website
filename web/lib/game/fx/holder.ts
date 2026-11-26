/**
 * The VFX library's code-drawn types on any holder (David 2026-11-06, rg8-fx: "this wont only be for fishing rod but for
 * weapon, vfx clothes etc"; specs/vfx-library.md). Nothing here knows what holds it: an effect reads only the holder's
 * surface (points and normals sampled off its meshes), its long axis, its size and how fast it moves, so the same petals
 * swirl round a rod, a sword or a hat. components/game/fx/HolderFx.tsx samples the surface and draws; this file is the
 * simulation, plain numbers.
 *
 * Every type throws into one pool per holder (one draw: the library pack, lib/game/fx/fxMaterial.ts FXLIB_PACK, through
 * the combat particle shader and its ramps): sun glints, motes, comets, arcs crawling over it, sparks, flame tongues,
 * petals, light gathering in, and the lightning strike. The Water type's drops go in a second pool of their own (solid,
 * not light). Particles live in the world, so a swung holder leaves them behind, unless they are steered round its axis
 * (petals, motes, gather), which follow it. Seeded, so a test or a clip replays the same.
 */
import * as THREE from "three";
import { FXLIB_PACK, type FxlibSprite } from "./fxMaterial";
import { fxAt, fxGrow, type FxKind } from "./library";

const FRAMES = 8;
/** How a particle faces: the camera, or the camera standing on its bottom edge (a flame tongue). */
export const FACE_BILLBOARD = 0, FACE_STANDING = 3;

/** How much bigger a sprite's quad is than what it draws (its painted shape fills only part of its cell): a size is the shape's. */
const FILL: Partial<Record<FxlibSprite, number>> = { mote: 4, bolt: 3, flare: 1.4 };

/** A particle thrown: where, how it moves, how it looks. Sizes and speeds in world units. */
export interface Emit {
  sprite: FxlibSprite; x: number; y: number; z: number; vx?: number; vy?: number; vz?: number;
  life: number; size: number; grow?: number; gravity?: number; drag?: number; spin?: number; rot?: number;
  /** Flipbook frames a second (looping), or 0 to play it once over its life. */
  fps?: number; alpha?: number;
  /** A sideways flutter (a petal's), world units a second. */
  sway?: number; face?: number; ramp: number; aspect?: number; fadeIn?: number;
  /** A bolt: the far end; the sprite is laid from (x, y, z) to it, `size` its thickness. */
  to?: readonly [number, number, number];
  /** A streak: laid along its flight, as long as `streak` seconds of it, `size` its thickness. */
  streak?: number;
  /** Steered round the holder's axis (it follows the holder): how quickly it takes the steer (1/s), for what share of its life. */
  bind?: number; bindFor?: number;
  /** While steered: the distance from the axis it settles at, its turn round the axis (rad/s), its climb along it (units/s). */
  orbit?: number; swirl?: number; lift?: number;
  /** Its brightness twinkling this many times a second. */
  twinkle?: number;
  /** Seconds before it shows (it waits where it was thrown). */
  delay?: number;
  /** Its flutter's phase (two particles thrown with the same move together: a petal and its glow). */
  phase?: number;
  /** Turned, spun and on the same flipbook frame as the particle thrown just before it (a petal over its glow). */
  twin?: boolean;
}

/** mulberry32: one holder's seeded randomness. */
export function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The holder's axis in the world now, base to tip: what a steered particle turns round. */
export interface Axis { a: THREE.Vector3; b: THREE.Vector3 }

const KEYS = ["px", "py", "pz", "vx", "vy", "vz", "ex", "ey", "ez", "age", "life", "size", "fill", "grow", "rot", "spin", "row", "fps", "frame0",
  "alpha", "gravity", "drag", "sway", "face", "ramp", "aspect", "fadeIn", "bolt", "phase", "streak", "bind", "bindFor", "orbit", "swirl", "lift",
  "twinkle", "delay"] as const;
const sa = new THREE.Vector3(), sd = new THREE.Vector3(), sr = new THREE.Vector3(), st = new THREE.Vector3();

/**
 * One holder's particles: a fixed ring (nothing allocated after construction), stepped and written into the combat
 * particle shader's instance layout (lib/game/fx/fxMaterial.ts createCombatParticleMaterial): a (x, y, z, ground),
 * b (width, height, rotation, frame), c (r, g, b, a), d (axis x, ramp row, axis z, face). Additive, so unsorted.
 */
export class HolderPool {
  readonly a: Float32Array; readonly b: Float32Array; readonly c: Float32Array; readonly d: Float32Array;
  count = 0;
  private next = 0;
  private readonly f: Record<(typeof KEYS)[number], Float32Array>;
  constructor(readonly capacity: number) {
    this.f = Object.fromEntries(KEYS.map(k => [k, new Float32Array(capacity)])) as HolderPool["f"];
    this.a = new Float32Array(capacity * 4); this.b = new Float32Array(capacity * 4);
    this.c = new Float32Array(capacity * 4); this.d = new Float32Array(capacity * 4);
  }
  get alive(): number { let n = 0; for (let i = 0; i < this.capacity; i++) if (this.f.life[i] > 0) n++; return n; }

  emit(e: Emit, rnd: () => number) {
    const i = this.next, f = this.f, fill = FILL[e.sprite] ?? 1, twin = e.twin ? (i + this.capacity - 1) % this.capacity : -1;
    this.next = (i + 1) % this.capacity;
    f.px[i] = e.x; f.py[i] = e.y; f.pz[i] = e.z; f.vx[i] = e.vx ?? 0; f.vy[i] = e.vy ?? 0; f.vz[i] = e.vz ?? 0;
    f.bolt[i] = e.to ? 1 : 0;
    if (e.to) { f.ex[i] = e.to[0]; f.ey[i] = e.to[1]; f.ez[i] = e.to[2]; }
    f.age[i] = 0; f.life[i] = e.life; f.size[i] = e.size * fill; f.fill[i] = fill; f.grow[i] = e.grow ?? 1; f.rot[i] = e.rot ?? (rnd() - 0.5) * 0.8;
    f.spin[i] = e.spin ? (rnd() - 0.5) * 2 * e.spin : 0; f.row[i] = FXLIB_PACK[e.sprite].row; f.fps[i] = e.fps ?? 0;
    f.frame0[i] = Math.floor(rnd() * FRAMES); f.alpha[i] = e.alpha ?? 1; f.gravity[i] = e.gravity ?? 0; f.drag[i] = e.drag ?? 0;
    f.sway[i] = e.sway ?? 0; f.face[i] = e.face ?? FACE_BILLBOARD; f.ramp[i] = e.ramp; f.aspect[i] = e.aspect ?? 1; f.fadeIn[i] = e.fadeIn ?? 10;
    f.phase[i] = e.phase ?? rnd() * Math.PI * 2; f.streak[i] = e.streak ?? 0; f.bind[i] = e.bind ?? 0; f.bindFor[i] = e.bindFor ?? 1;
    f.orbit[i] = e.orbit ?? 0; f.swirl[i] = e.swirl ?? 0; f.lift[i] = e.lift ?? 0; f.twinkle[i] = e.twinkle ?? 0; f.delay[i] = e.delay ?? 0;
    if (twin >= 0) { f.rot[i] = f.rot[twin]; f.spin[i] = f.spin[twin]; f.frame0[i] = f.frame0[twin]; f.phase[i] = f.phase[twin]; }
  }

  /** Age, drag, fall (or rise), flutter, the steer round `axis`; a bolt stays where it struck. */
  step(dt: number, axis?: Axis) {
    if (dt <= 0) return;
    const f = this.f;
    if (axis) { sa.copy(axis.a); sd.subVectors(axis.b, axis.a); }
    const len = axis ? sd.length() : 0;
    if (len > 1e-6) sd.divideScalar(len);
    for (let i = 0; i < this.capacity; i++) {
      if (f.life[i] <= 0) continue;
      const age = f.age[i] + dt;
      if (age >= f.life[i]) { f.life[i] = 0; continue; }
      f.age[i] = age;
      if (f.bolt[i] || age < f.delay[i]) continue;
      if (f.bind[i] > 0 && len > 1e-6 && age < f.bindFor[i] * f.life[i]) {
        // steered: round the axis at its orbit, climbing; it takes the steer at its own rate, so it lags as a holder swings
        sr.set(f.px[i] - sa.x, f.py[i] - sa.y, f.pz[i] - sa.z);
        const s = Math.min(len, Math.max(0, sr.dot(sd)));
        sr.addScaledVector(sd, -s);
        let r = sr.length();
        if (r < 1e-5) { sr.set(1, 0, 0).cross(sd); if (sr.lengthSq() < 1e-6) sr.set(0, 0, 1); r = 1e-5; }
        sr.normalize();
        st.crossVectors(sd, sr);
        const turn = f.swirl[i] * Math.max(r, f.orbit[i] * 0.5), pull = (f.orbit[i] - r) * 5;
        const tx = st.x * turn + sr.x * pull + sd.x * f.lift[i], ty = st.y * turn + sr.y * pull + sd.y * f.lift[i], tz = st.z * turn + sr.z * pull + sd.z * f.lift[i];
        const w = 1 - Math.exp(-f.bind[i] * dt);
        f.vx[i] += (tx - f.vx[i]) * w; f.vy[i] += (ty - f.vy[i]) * w; f.vz[i] += (tz - f.vz[i]) * w;
      }
      const k = Math.exp(-f.drag[i] * dt);
      f.vx[i] *= k; f.vz[i] *= k; f.vy[i] = f.vy[i] * k - f.gravity[i] * dt;
      const sw = f.sway[i] * dt;
      f.px[i] += f.vx[i] * dt + Math.cos(age * 2.7 + f.phase[i]) * sw;
      f.py[i] += f.vy[i] * dt;
      f.pz[i] += f.vz[i] * dt + Math.sin(age * 2.1 + f.phase[i]) * sw;
      f.rot[i] += f.spin[i] * dt;
    }
  }

  /** Fill the instance arrays for a camera with these right and up axes (world); returns the count. */
  write(right: THREE.Vector3, up: THREE.Vector3): number {
    const f = this.f;
    let n = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (f.life[i] <= 0 || f.age[i] < f.delay[i]) continue;
      const age = f.age[i] - f.delay[i], life = f.life[i] - f.delay[i], t = age / life, q = n++ * 4;
      const frame = f.fps[i] > 0 ? (f.frame0[i] + Math.floor(age * f.fps[i])) % FRAMES : Math.min(FRAMES - 1, Math.floor(t * FRAMES));
      let fade = Math.min(1, t * f.fadeIn[i]) * (1 - smooth(0.62, 1, t));
      if (f.twinkle[i]) fade *= 0.45 + 0.55 * Math.abs(Math.sin(age * f.twinkle[i] * Math.PI + f.phase[i]));
      let x = f.px[i], y = f.py[i], z = f.pz[i], w = f.size[i] * (1 + (f.grow[i] - 1) * (1 - (1 - t) * (1 - t))), h = w * f.aspect[i], rot = f.rot[i];
      if (f.bolt[i] || f.streak[i]) {
        // laid on screen from its start to its end (a bolt's far end, or where a streak was `streak` seconds ago)
        const dx = f.bolt[i] ? f.ex[i] - x : -f.vx[i] * f.streak[i], dy = f.bolt[i] ? f.ey[i] - y : -f.vy[i] * f.streak[i], dz = f.bolt[i] ? f.ez[i] - z : -f.vz[i] * f.streak[i];
        const r = dx * right.x + dy * right.y + dz * right.z, u = dx * up.x + dy * up.y + dz * up.z;
        x += dx / 2; y += dy / 2; z += dz / 2;
        h = w; w = f.bolt[i] ? Math.hypot(r, u) : h + Math.hypot(r, u) * (1 + (f.fill[i] - 1) / 2); rot = Math.atan2(u, r);
      }
      this.a[q] = x; this.a[q + 1] = y; this.a[q + 2] = z; this.a[q + 3] = -1e6;
      this.b[q] = w; this.b[q + 1] = h; this.b[q + 2] = rot; this.b[q + 3] = f.row[i] * FRAMES + frame;
      this.c[q] = 1; this.c[q + 1] = 1; this.c[q + 2] = 1; this.c[q + 3] = f.alpha[i] * fade;
      this.d[q] = 0; this.d[q + 1] = f.ramp[i]; this.d[q + 2] = 0; this.d[q + 3] = f.face[i];
    }
    return (this.count = n);
  }
  clear() { this.f.life.fill(0); this.count = 0; }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The types this file throws into the pool (energy and pulse are drawn on the holder, the trail behind it; the water has its own pool). */
export const POOL_KINDS = ["glow", "particles", "sparks", "motion", "electricity", "embers", "flame", "petals", "gather", "burst"] as const satisfies readonly FxKind[];
export type PoolKind = (typeof POOL_KINDS)[number];
/** The outside things that act on a holder in a moment (the awakening's strike, David 2026-11-06). */
export type StrikeKind = "lightning";

/** What a frame of a holder's effect knows: its surface in the world now, its size, how it moves, the camera's right. */
export interface Holder {
  /** Surface point `i` (of `n`) and its normal, in the world now. */
  n: number;
  point(i: number, out: THREE.Vector3): THREE.Vector3;
  normal(i: number, out: THREE.Vector3): THREE.Vector3;
  /** Along its long axis (0 its base, 1 its tip), in the world now. */
  along(s: number, out: THREE.Vector3): THREE.Vector3;
  /** How fast the point `s` along its axis is moving in the world (units a second). */
  vel(s: number, out: THREE.Vector3): THREE.Vector3;
  /** Its long axis's world length. */
  size: number;
  /** The camera's right, in the world. */
  right: THREE.Vector3;
}

/** A type's ramp row and its strength, the frame's time and step, and the pool. */
export interface Ctx { pool: HolderPool; rnd: () => number; holder: Holder; ramp: number; k: number; t: number; dt: number; state: Record<string, number> }

const p = new THREE.Vector3(), q = new THREE.Vector3(), nrm = new THREE.Vector3(), o = new THREE.Vector3(), v = new THREE.Vector3();
const a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), so = new THREE.Vector3();
/** How many to throw this frame for a rate a second (the remainder carried in `state`). */
function due(c: Ctx, key: string, perSecond: number): number {
  const acc = (c.state[key] ?? 0) + perSecond * c.dt, n = Math.floor(acc);
  c.state[key] = acc - n;
  return n;
}
/** Once every `period` seconds (true on the frame it comes round). */
function every(c: Ctx, key: string, period: number): boolean {
  const k = Math.floor(c.t / period);
  if (c.state[key] === k) return false;
  c.state[key] = k;
  return true;
}
const pick = (c: Ctx) => Math.floor(c.rnd() * c.holder.n);
/** Where a world point lies along the holder's axis (0 its base, 1 its tip). */
function sOf(h: Holder, x: THREE.Vector3): number {
  h.along(0, a0); h.along(1, a1);
  const d = a1.sub(a0), l2 = d.lengthSq();
  return l2 > 0 ? so.subVectors(x, a0).dot(d) / l2 : 0;
}
/** A random unit vector. */
const anyWay = (rnd: () => number, out: THREE.Vector3) => {
  const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a));
};

/**
 * The sun glint's sweep (David 2026-11-06: "i want sun glistening off it like light fractures"): where the band of sun
 * is along the holder at time `t` (its axis share, below 0 or above 1 while it rests between sweeps), shared by the
 * shell's shader (HolderFx) and the glints thrown here.
 */
export function sweepAt(t: number, k: number): number {
  const ph = (t * fxAt("glow", "sweeps", k)) % 1;
  return -0.25 + (ph / 0.42) * 1.5;
}

/** Electricity's charge at `t`: 0 to 1 as it builds, its zap at 1 (then 0 again). */
export function chargeAt(t: number, k: number): number {
  return (t * fxAt("electricity", "charges", k)) % 1;
}
/** The share of an electricity cycle spent building before it zaps. */
export const ZAP_AT = 0.86;

/** One frame of a type on a holder. */
export function throwKind(kind: PoolKind, c: Ctx) {
  const { pool, rnd, holder: h, ramp, k } = c, L = h.size;
  switch (kind) {
    case "glow": { // star glints where the sun's band catches it
      const s0 = sweepAt(c.t, k);
      if (s0 < 0 || s0 > 1) return;
      for (let j = due(c, kind, fxAt("glow", "glints", k) / (0.42 / fxAt("glow", "sweeps", k)) * 2); j--;) {
        let best = -1;
        for (let tries = 0; tries < 10 && best < 0; tries++) { const i = pick(c); if (Math.abs(sOf(h, h.point(i, p)) - s0) < 0.06) best = i; }
        if (best < 0) continue;
        h.point(best, p); h.normal(best, nrm);
        pool.emit({ sprite: "flare", x: p.x + nrm.x * 0.01 * L, y: p.y + nrm.y * 0.01 * L, z: p.z + nrm.z * 0.01 * L, life: 0.32 + 0.15 * rnd(),
          size: (0.1 + 0.08 * rnd()) * L, grow: 1.3, rot: rnd() * 0.5, ramp, fadeIn: 14, spin: 1.5 }, rnd);
      }
      return;
    }
    case "particles": // motes drifting up off it in a slow swirl, twinkling, a few big soft ones
      for (let j = due(c, kind, fxAt("particles", "rate", k) * 16); j--;) {
        const i = pick(c), big = rnd() < 0.15; h.point(i, p); h.normal(i, nrm);
        pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: nrm.x * 0.05 * L, vy: nrm.y * 0.05 * L, vz: nrm.z * 0.05 * L,
          bind: 1.2, bindFor: 0.7, orbit: (0.1 + 0.12 * rnd()) * L, swirl: 0.9 + 0.6 * rnd(), lift: (0.12 + 0.12 * rnd()) * L, drag: 0.3,
          life: 1.6 + 0.9 * rnd(), size: (big ? 0.11 : 0.035 + 0.035 * rnd()) * L, alpha: big ? 0.45 : 1, grow: big ? 1.2 : 0.6, fps: 10,
          twinkle: big ? 0 : 2 + 3 * rnd(), ramp, fadeIn: 5 }, rnd);
      }
      return;
    case "sparks": // a one-off spray (thrown by `once` and `burst`); waiting for David's references
      return sparks(c, Math.round(fxAt("sparks", "count", k)));
    case "burst":
      return burst(c);
    case "motion": return motion(c);
    case "electricity": return electricity(c);
    case "embers": // bright yellow sparks shot off it at random, fast, streaked along their flight
      for (let j = due(c, kind, fxAt("embers", "rate", k) * (0.6 + 0.8 * rnd())); j--;) {
        const i = pick(c), hot = rnd() < 0.2; h.point(i, p); h.normal(i, nrm);
        anyWay(rnd, v).addScaledVector(nrm, 0.6).add(o.set(0, 0.35, 0)).normalize().multiplyScalar(fxAt("embers", "speed", k) * L * (0.6 + 0.9 * rnd()));
        pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, gravity: 0.9 * L, drag: 1.8, streak: 0.045,
          life: 0.18 + 0.35 * rnd(), size: (hot ? 0.03 : 0.018) * L, grow: 0.5, fps: 24, ramp, fadeIn: 40, alpha: hot ? 1 : 0.9 }, rnd);
      }
      return;
    case "flame": { // tongues licking up all along it, embers off the top (waiting for David's references)
      const tall = fxGrow("flame", "height", k);
      for (let j = due(c, kind, fxAt("flame", "rate", k) * 42); j--;) {
        const i = pick(c); h.point(i, p); h.normal(i, nrm);
        pool.emit({ sprite: "flame", x: p.x + nrm.x * 0.01 * L, y: p.y, z: p.z + nrm.z * 0.01 * L, vy: 0.14 * L * tall, life: 0.45 + 0.3 * rnd(),
          size: (0.16 + 0.08 * rnd()) * L * tall, grow: 0.55, fps: 12, face: FACE_STANDING, ramp, fadeIn: 7, rot: (rnd() - 0.5) * 0.25 }, rnd);
      }
      for (let j = due(c, `${kind}~`, 5 * k); j--;) {
        const i = pick(c); h.point(i, p);
        pool.emit({ sprite: "mote", x: p.x, y: p.y + 0.08 * L, z: p.z, vx: (rnd() - 0.5) * 0.1 * L, vy: (0.4 + 0.3 * rnd()) * L, vz: (rnd() - 0.5) * 0.1 * L,
          drag: 1, life: 0.8 + 0.5 * rnd(), size: 0.035 * L, grow: 0.3, fps: 20, ramp, sway: 0.08 * L }, rnd);
      }
      return;
    }
    case "petals": // a few glowing petals swirling round it on a wind, following it, lifted, then let go; never falling
      for (let j = due(c, kind, fxAt("petals", "rate", k) * 3); j--;) {
        const i = pick(c); h.point(i, p);
        const move = { x: p.x, y: p.y, z: p.z, bind: 2.2, bindFor: 0.6 + 0.15 * rnd(), orbit: (0.13 + 0.1 * rnd()) * L, swirl: 1.8 + 0.8 * rnd(), lift: (0.1 + 0.08 * rnd()) * L,
          gravity: -0.03 * L, drag: 0.25, sway: 0.12 * L, life: 2.6 + 1.2 * rnd(), phase: rnd() * Math.PI * 2, ramp };
        const size = (0.085 + 0.03 * rnd()) * L, fps = 7 + 4 * rnd();
        pool.emit({ ...move, sprite: "sakura", spin: 2.2, size: size * 1.9, fps, alpha: 0.32, fadeIn: 8 }, rnd);   // its glow: itself, larger and faint
        pool.emit({ ...move, sprite: "sakura", size, fps, fadeIn: 8, twin: true }, rnd);
      }
      return;
    case "gather": return gather(c);
  }
}

/** Three comets whipping up round it: bright heads, long streaked tails shedding sparkle, a flash as each leaves the tip. */
function motion(c: Ctx) {
  const { pool, rnd, holder: h, ramp, k, t } = c, L = h.size, spin = 3.4 * fxGrow("motion", "spin", k), reach = 0.11 * L * fxGrow("motion", "bob", k);
  for (let j = 0; j < 3; j++) {
    const u = (t * 0.42 + j / 3) % 1, s = u * u * (3 - 2 * u) * 1.1 - 0.05;        // slow off the base, fast up the middle, easing at the tip
    const a = t * spin * (0.7 + 0.9 * u) + (j * Math.PI * 2) / 3;
    h.along(Math.max(0, Math.min(1, s)), p); h.along(Math.min(1, Math.max(0, s) + 0.01), q);
    const ax = q.sub(p).normalize(), side = o.set(1, 0, 0).cross(ax).normalize();
    if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
    const other = nrm.copy(ax).cross(side), r = reach * (0.6 + 0.6 * Math.sin(u * Math.PI));
    p.addScaledVector(side, Math.cos(a) * r).addScaledVector(other, Math.sin(a) * r);
    const key = `m${j}`, had = c.state[`${key}x`] !== undefined;
    if (had && c.dt > 0) v.set(p.x - c.state[`${key}x`], p.y - c.state[`${key}y`], p.z - c.state[`${key}z`]).divideScalar(c.dt); else v.set(0, 0, 0);
    if (had && u < (c.state[`${key}u`] ?? 0)) { // it left the tip: a flash there
      h.along(1, q);
      pool.emit({ sprite: "flare", x: q.x, y: q.y, z: q.z, life: 0.28, size: 0.32 * L * Math.sqrt(k), grow: 1.4, ramp, fadeIn: 40 }, rnd);
    }
    c.state[`${key}x`] = p.x; c.state[`${key}y`] = p.y; c.state[`${key}z`] = p.z; c.state[`${key}u`] = u;
    if (!had || u > 0.97) continue;
    pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, life: 0.05, size: 0.09 * L * Math.sqrt(k), ramp, fadeIn: 50 }, rnd);       // its head
    pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: v.x * 0.02, vy: v.y * 0.02, vz: v.z * 0.02, life: 0.12, size: 0.035 * L, grow: 0.15,
      streak: 1.1, alpha: 0.8, ramp, fadeIn: 50 }, rnd);                                                                                 // its tail, laid back along its path
    for (let m = due(c, `${key}~`, 14 * k); m--;) {                                                                                 // sparkle shed off it
      anyWay(rnd, q).multiplyScalar(0.12 * L);
      pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: q.x, vy: q.y, vz: q.z, gravity: 0.25 * L, drag: 1.5, life: 0.4 + 0.4 * rnd(), size: 0.022 * L,
        twinkle: 6, ramp, fadeIn: 20 }, rnd);
    }
  }
}

/**
 * Electricity (David 2026-11-06: "make it move slower and more crackly not flashing mut you can see the movement of the
 * elctricity, it feels the charge up build up before zaping"): arcs crawl point to point up its surface, each piece
 * lingering so you see them travel; through the charge more of them, faster, brighter, sparks drawn in to it; at the
 * top of the charge one arc jumps the length of it with a flare, and it starts again.
 */
function electricity(c: Ctx) {
  const { pool, rnd, holder: h, ramp, k } = c, L = h.size, ch = chargeAt(c.t, k), building = ch < ZAP_AT, power = Math.min(1, ch / ZAP_AT);
  const arcs = Math.round(fxAt("electricity", "arcs", k) * (building ? 1 + 2 * power : 0.5));
  // each crawler hops on from where it is, a little faster as the charge builds
  if (every(c, "hop", 1 / (7 + 9 * power))) for (let j = 0; j < arcs; j++) {
    const key = `c${j}`, from = c.state[key] ?? pick(c), sFrom = sOf(h, h.point(from, p));
    h.normal(from, nrm);
    let to = -1;
    for (let tries = 0; tries < 12 && to < 0; tries++) {
      const m = pick(c), d = h.point(m, q).distanceTo(p), ds = sOf(h, q) - sFrom;
      if (d > 0.03 * L && d < 0.16 * L && ds > -0.04) to = m;
    }
    if (to < 0 || sFrom > 0.97) { c.state[key] = pick(c); continue; }
    h.point(to, q);
    zigzag(c, p, q, nrm, 3, p.distanceTo(q) * 0.4, (0.022 + 0.03 * power) * L, 0.22 + 0.1 * rnd(), 0.9);
    if (rnd() < 0.35) pool.emit({ sprite: "flare", x: q.x, y: q.y, z: q.z, life: 0.12, size: (0.06 + 0.08 * power) * L, ramp, fadeIn: 50 }, rnd);
    c.state[key] = to;
  }
  if (building && power > 0.45) for (let j = due(c, "draw", 30 * (power - 0.45)); j--;) { // sparks drawn in as it nears the zap
    const i = pick(c); h.point(i, q);
    anyWay(rnd, v).multiplyScalar(0.3 * L); p.copy(q).add(v);
    pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: -v.x / 0.3, vy: -v.y / 0.3, vz: -v.z / 0.3, life: 0.3, streak: 0.04, size: 0.012 * L, ramp, fadeIn: 8 }, rnd);
  }
  if (!building && !c.state.zapped) { // the zap: one arc the length of it, a flare at the tip, sparks off it
    c.state.zapped = 1;
    h.along(0.04, p);
    for (let step = 1; step <= 7; step++) {
      const want = step / 7;
      let best = 0, gap = Infinity;
      for (let tries = 0; tries < 16; tries++) { const m = pick(c), ds = Math.abs(sOf(h, h.point(m, q)) - want); if (ds < gap) { gap = ds; best = m; } }
      h.point(best, q);
      if (step === 7) h.along(1, q);
      zigzag(c, p, q, o.set(0, 0, 0), 3, p.distanceTo(q) * 0.45, 0.075 * L, 0.3, 1);
      p.copy(q);
    }
    h.along(1, q);
    pool.emit({ sprite: "flare", x: q.x, y: q.y, z: q.z, life: 0.35, size: 0.55 * L, grow: 1.3, ramp, fadeIn: 60 }, rnd);
    for (let j = 0; j < 12; j++) {
      anyWay(rnd, v).multiplyScalar((0.8 + 0.8 * rnd()) * L);
      pool.emit({ sprite: "mote", x: q.x, y: q.y, z: q.z, vx: v.x, vy: v.y, vz: v.z, drag: 3, gravity: 0.6 * L, streak: 0.04, life: 0.25 + 0.2 * rnd(), size: 0.016 * L, ramp, fadeIn: 50 }, rnd);
    }
    if (rnd() < fxAt("electricity", "arcsOut", k) * 2) { // an arc out into the air
      const i = pick(c); h.point(i, p); h.normal(i, nrm);
      q.copy(p).addScaledVector(nrm, 0.3 * L).add(anyWay(rnd, v).multiplyScalar(0.15 * L));
      zigzag(c, p, q, nrm, 4, 0.08 * L, 0.04 * L, 0.25, 1);
    }
  }
  if (building) c.state.zapped = 0;
}

/**
 * Gather, made epic (David 2026-11-06: "not epic enough and boring"): streaks spiralling in to it from all round, faster
 * as they come, beams shooting straight in to its tip, big slow orbs drifting in, and flashes on it where the light
 * lands (its glow shell builds with it: HolderFx).
 */
function gather(c: Ctx) {
  const { pool, rnd, holder: h, ramp, k } = c, L = h.size;
  h.along(0.5, o);
  for (let j = due(c, "g", fxAt("gather", "rate", k)); j--;) {
    anyWay(rnd, v); p.copy(o).addScaledVector(v, (0.65 + 0.4 * rnd()) * L);
    pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: -v.x * 0.2 * L, vy: -v.y * 0.2 * L, vz: -v.z * 0.2 * L, bind: 2.6, orbit: 0, swirl: 4 + 2 * rnd(), lift: 0,
      streak: 0.07, life: 0.75 + 0.3 * rnd(), size: (0.016 + 0.012 * rnd()) * L, ramp, fadeIn: 5 }, rnd);
  }
  for (let j = due(c, "g-beam", 3 * k); j--;) { // a beam straight in to the tip
    h.along(0.75 + 0.25 * rnd(), q); anyWay(rnd, v); p.copy(q).addScaledVector(v, 1.3 * L);
    const life = 0.28;
    pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: (q.x - p.x) / life, vy: (q.y - p.y) / life, vz: (q.z - p.z) / life, streak: 0.09, life, size: 0.03 * L, ramp, fadeIn: 8 }, rnd);
    pool.emit({ sprite: "flare", x: q.x, y: q.y, z: q.z, life: life + 0.16, delay: life - 0.02, size: 0.22 * L, rot: rnd(), ramp, fadeIn: 40 }, rnd);
  }
  for (let j = due(c, "g-orb", 4 * k); j--;) { // big soft orbs drifting in
    anyWay(rnd, v); p.copy(o).addScaledVector(v, 0.9 * L);
    pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, bind: 1.2, orbit: 0, swirl: 1.6, life: 1.1, size: 0.1 * L, alpha: 0.5, grow: 0.3, ramp, fadeIn: 3 }, rnd);
  }
  for (let j = due(c, "g-land", 7 * k); j--;) { // flashes on it where light lands
    const i = pick(c); h.point(i, p);
    pool.emit({ sprite: "flare", x: p.x, y: p.y, z: p.z, life: 0.16, size: (0.09 + 0.07 * rnd()) * L, rot: rnd(), ramp, fadeIn: 40 }, rnd);
  }
}

/** A bolt from `a` to `b` in `segs` jagged pieces, each kink thrown `jag` off the line (away from `out` and round it). */
function zigzag(c: Ctx, a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3, segs: number, jag: number, thick: number, life: number, fadeIn = 60) {
  const { pool, rnd, ramp } = c;
  let x = a.x, y = a.y, z = a.z;
  for (let s = 1; s <= segs; s++) {
    const u = s / segs, last = s === segs;
    const nx = a.x + (b.x - a.x) * u + (last ? 0 : (out.x * 0.6 + rnd() - 0.5) * jag), ny = a.y + (b.y - a.y) * u + (last ? 0 : (out.y * 0.6 + rnd() - 0.5) * jag),
      nz = a.z + (b.z - a.z) * u + (last ? 0 : (out.z * 0.6 + rnd() - 0.5) * jag);
    pool.emit({ sprite: "bolt", x, y, z, to: [nx, ny, nz], size: thick, life, fps: 30, ramp, fadeIn }, rnd);
    x = nx; y = ny; z = nz;
  }
}

/** The sparks type: a spray off it, from its tip a flare and a burst of streaks. */
function sparks(c: Ctx, n: number) {
  const { pool, rnd, holder: h, ramp } = c, L = h.size;
  h.along(1, p);
  pool.emit({ sprite: "sparkBurst", x: p.x, y: p.y, z: p.z, life: 0.35, size: 0.45 * L, ramp, fadeIn: 40 }, rnd);
  pool.emit({ sprite: "flare", x: p.x, y: p.y, z: p.z, life: 0.3, size: 0.35 * L, ramp, fadeIn: 40 }, rnd);
  const sp = fxAt("sparks", "speed", 1);
  for (let j = 0; j < n; j++) {
    const i = pick(c); h.point(i, q); h.normal(i, nrm);
    pool.emit({ sprite: "mote", x: q.x, y: q.y, z: q.z, vx: (nrm.x + (rnd() - 0.5)) * sp * L, vy: (nrm.y + rnd() * 0.8) * sp * L, vz: (nrm.z + (rnd() - 0.5)) * sp * L,
      drag: 2.2, life: 0.5 + 0.4 * rnd(), size: 0.045 * L, grow: 0.3, fps: 20, ramp, fadeIn: 30 }, rnd);
  }
}

/** The burst type: a big flare in its middle, streaks and sparks flung wide (its shell flares with it: HolderFx). */
function burst(c: Ctx) {
  const { pool, rnd, holder: h, ramp } = c, L = h.size;
  h.along(0.55, p);
  pool.emit({ sprite: "flare", x: p.x, y: p.y, z: p.z, life: 0.4, size: 0.9 * L, ramp, fadeIn: 40 }, rnd);
  pool.emit({ sprite: "sparkBurst", x: p.x, y: p.y, z: p.z, life: 0.4, size: 1.0 * L, ramp, fadeIn: 40 }, rnd);
  sparks(c, 24);
}

/** How long before the hit the lightning's charge goes quiet (the held breath). */
export const HUSH = 0.22;

/**
 * The lightning strike in a moment (David 2026-11-06: "charge with more suspense, the weapon needs a flash frame when
 * struck, more juice, freeze frame in turn white and slight shake"): `t` seconds since it began, `hit` when it lands.
 * The charge builds at the tip, crackling faster and reaching further down it, sparks drawn in; then a held breath with
 * nothing; then the bolt out of the sky onto the tip, forking, striking twice more, the holder crawling with arcs after.
 * The flash, the freeze and the shake are HolderFx's (it whitens the holder and holds its particles still).
 */
export function throwStrike(kind: StrikeKind, c: Ctx, t: number, hit: number) {
  const { pool, rnd, holder: h, ramp } = c, L = h.size;
  void kind;
  if (t < hit - HUSH) { // the charge gathering, faster and further as it builds
    const build = Math.max(0, t / Math.max(0.01, hit - HUSH));
    if (every(c, "charge", 1 / (4 + 18 * build * build))) {
      h.along(1, p);
      for (let j = 0; j < 1 + Math.round(2 * build); j++) {
        const i = pick(c); h.point(i, q);
        if (sOf(h, q) < 1 - 0.7 * build) q.copy(p).add(anyWay(rnd, v).multiplyScalar(0.12 * L)); // reaching further down it as it builds
        zigzag(c, p, q, nrm.set(0, 1, 0), 3, 0.05 * L, (0.02 + 0.03 * build) * L, 0.12 + 0.1 * build);
      }
      pool.emit({ sprite: "flare", x: p.x, y: p.y, z: p.z, life: 0.14, size: (0.1 + 0.3 * build) * L, rot: rnd(), ramp, fadeIn: 50 }, rnd);
    }
    for (let j = due(c, "draw", 40 * build); j--;) {
      h.along(1, q); anyWay(rnd, v).multiplyScalar(0.45 * L); p.copy(q).add(v);
      pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: -v.x / 0.32, vy: -v.y / 0.32, vz: -v.z / 0.32, life: 0.32, streak: 0.05, size: 0.014 * L, ramp, fadeIn: 6 }, rnd);
    }
    return;
  }
  if (t < hit) return; // the held breath
  for (const at of [0, 0.12, 0.27]) {
    if (c.state[`strike${at}`] || t < hit + at) continue;
    c.state[`strike${at}`] = 1;
    h.along(1, q);
    p.copy(q).add(o.set((rnd() - 0.5) * 0.6 * L, 3.2 * L, (rnd() - 0.5) * 0.3 * L));
    zigzag(c, p, q, o.set(1, 0, 0), 8, 0.22 * L, (at ? 0.1 : 0.17) * L, at ? 0.14 : 0.34);
    for (let f = 0; f < 3; f++) { // forks off the upper half
      const u = 0.25 + 0.4 * rnd();
      const a = o.copy(p).lerp(q, u), end = nrm.copy(a).add(new THREE.Vector3((rnd() - 0.5) * 1.0 * L, -0.4 * L, (rnd() - 0.5) * 0.3 * L));
      zigzag(c, a.clone(), end.clone(), new THREE.Vector3(0, 1, 0), 3, 0.12 * L, 0.05 * L, 0.16);
    }
    pool.emit({ sprite: "flare", x: q.x, y: q.y, z: q.z, life: 0.5, size: (at ? 0.7 : 1.1) * L, ramp, fadeIn: 60 }, rnd);
    if (!at) {
      pool.emit({ sprite: "sparkBurst", x: q.x, y: q.y, z: q.z, life: 0.4, size: 0.9 * L, ramp, fadeIn: 60 }, rnd);
      for (let j = 0; j < 26; j++) {
        anyWay(rnd, v).multiplyScalar((1 + 1.2 * rnd()) * L);
        pool.emit({ sprite: "mote", x: q.x, y: q.y, z: q.z, vx: v.x, vy: v.y, vz: v.z, drag: 2.6, gravity: 1.2 * L, streak: 0.04, life: 0.35 + 0.3 * rnd(), size: 0.02 * L, ramp, fadeIn: 50 }, rnd);
      }
    }
  }
  // the holder crawling with arcs as the charge runs off it
  if (t < hit + 0.9 && every(c, "after", 1 / 12)) {
    const i = pick(c); h.point(i, p); h.normal(i, nrm);
    const m = pick(c); h.point(m, q);
    if (p.distanceTo(q) < 0.3 * L) zigzag(c, p, q, nrm, 3, p.distanceTo(q) * 0.4, 0.03 * L, 0.18, 1);
  }
}

/**
 * The Water type's drops (David 2026-11-06: "lots of water droplets like tanjiro water breathing"; "water dripping off
 * should feel natural"), into the holder's drops pool: flung off its outer half as it swings (more the faster), thrown
 * up where the water crashes at its top, and drips gathering on its underside and falling, streaked as they speed up.
 */
export function throwWater(c: Ctx, radius: number) {
  const { pool, rnd, holder: h, ramp, k } = c, L = h.size, splash = fxAt("water", "splashes", k);
  h.vel(0.85, q);
  const swing = q.length() / Math.max(L, 1e-3);
  for (let j = due(c, "fling", (8 + 70 * Math.min(swing, 3)) * splash); j--;) { // flung off as it swings
    const s = 0.4 + 0.65 * rnd();
    h.along(Math.min(1, s), p); h.vel(Math.min(1, s), v); anyWay(rnd, nrm);
    p.addScaledVector(nrm, radius);
    pool.emit({ sprite: "droplet", x: p.x, y: p.y, z: p.z, vx: v.x * 0.75 + nrm.x * 0.5 * L, vy: v.y * 0.75 + (nrm.y * 0.5 + 0.3) * L, vz: v.z * 0.75 + nrm.z * 0.5 * L,
      gravity: 2.6 * L, drag: 0.5, streak: 0.016, life: 0.5 + 0.5 * rnd(), size: (0.01 + 0.012 * rnd()) * L, ramp, fadeIn: 30 }, rnd);
  }
  for (let j = due(c, "crash", 14 * splash); j--;) { // thrown up where it crashes at its top
    h.along(0.97 + 0.08 * rnd(), p); anyWay(rnd, nrm);
    pool.emit({ sprite: "droplet", x: p.x + nrm.x * radius, y: p.y, z: p.z + nrm.z * radius, vx: nrm.x * 0.7 * L, vy: (0.5 + 0.7 * rnd()) * L, vz: nrm.z * 0.7 * L,
      gravity: 2.6 * L, drag: 0.4, streak: 0.016, life: 0.55 + 0.35 * rnd(), size: (0.009 + 0.011 * rnd()) * L, ramp, fadeIn: 30 }, rnd);
  }
  for (let j = due(c, "drip", 3.5 * splash); j--;) { // drips: gathering on its underside, then falling
    let low = pick(c);
    for (let tries = 0; tries < 6; tries++) { const m = pick(c); if (h.point(m, p).y < h.point(low, q).y) low = m; }
    h.point(low, p);
    const hang = 0.15 + 0.25 * rnd(), size = (0.014 + 0.008 * rnd()) * L;
    pool.emit({ sprite: "droplet", x: p.x, y: p.y - 0.006 * L, z: p.z, life: hang, size, grow: 1.5, ramp, fadeIn: 3 / hang }, rnd);             // swelling where it hangs
    pool.emit({ sprite: "droplet", x: p.x, y: p.y - 0.01 * L, z: p.z, gravity: 2.4 * L, streak: 0.03, delay: hang, life: hang + 0.6, size: size * 1.4, ramp, fadeIn: 40 }, rnd); // then letting go
  }
}

/** The library's default colours for the types whose colour is their own (the sun, fire, sparks, water), as ramps (core, mid, edge). */
export const KIND_RAMP: Partial<Record<PoolKind | StrikeKind | "trail" | "water", readonly [string, string, string]>> = {
  glow: ["#ffffff", "#fff4cf", "#ffc95c"],
  embers: ["#ffffff", "#fff27a", "#ffd21a"],
  flame: ["#fff4d6", "#ff8a3d", "#5a1a08"],
  petals: ["#fff8fb", "#ffc0d8", "#ff6aa3"],
  electricity: ["#f2fdff", "#7fe0ff", "#2a5cff"],
  lightning: ["#f2fdff", "#7fe0ff", "#2a5cff"],
  trail: ["#ffffff", "#ffffff", "#ffffff"],
};
/** A ramp from one colour: its light tint at the core, itself in the middle, its shade at the edge. Never plain white. */
export function rampOf(hex: string): [string, string, string] {
  const c = new THREE.Color(hex), core = c.clone().lerp(new THREE.Color(1, 1, 1), 0.72), edge = c.clone().multiplyScalar(0.45);
  return [`#${core.getHexString()}`, `#${c.getHexString()}`, `#${edge.getHexString()}`];
}
