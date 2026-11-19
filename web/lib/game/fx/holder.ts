/**
 * The effects library's code-drawn types on any holder (David 2026-11-06, rg8-fx: "have a pedals animation liek sakura
 * flower pedals, electricity, puslign fire sparks, flame, water allat. this wont only be for fishing rod but for weapon,
 * vfx clothes etc"; specs/fx-library.md). Nothing here knows what holds it: an effect reads only the holder's surface
 * (points and normals sampled off its meshes), its long axis and its size, so the same petals fall off a rod, a sword
 * or a hat. components/game/fx/HolderFx.tsx samples the surface and draws; this file is the simulation, plain numbers.
 *
 * Every type throws into one pool per holder (one draw: the library pack, lib/game/fx/fxMaterial.ts FXLIB_PACK, through
 * the combat particle shader and its ramps): motes, sparks, orbiting comets, bolts crawling between surface points,
 * pulsing embers, flame tongues, sakura petals, light gathering in, and the strikes from outside (lightning, a wave).
 * Particles live in the world, so a swung holder leaves its petals and flames behind it. Seeded, so a test or a clip
 * replays the same.
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

/**
 * One holder's particles: a fixed ring (nothing allocated after construction), stepped and written into the combat
 * particle shader's instance layout (lib/game/fx/fxMaterial.ts createCombatParticleMaterial): a (x, y, z, ground),
 * b (width, height, rotation, frame), c (r, g, b, a), d (axis x, ramp row, axis z, face). Additive, so unsorted.
 */
export class HolderPool {
  readonly a: Float32Array; readonly b: Float32Array; readonly c: Float32Array; readonly d: Float32Array;
  count = 0;
  private next = 0;
  private readonly f: Record<"px" | "py" | "pz" | "vx" | "vy" | "vz" | "ex" | "ey" | "ez" | "age" | "life" | "size" | "grow" | "rot" | "spin" | "row" | "fps" | "frame0"
    | "alpha" | "gravity" | "drag" | "sway" | "face" | "ramp" | "aspect" | "fadeIn" | "bolt" | "phase", Float32Array>;
  constructor(readonly capacity: number) {
    const keys = ["px", "py", "pz", "vx", "vy", "vz", "ex", "ey", "ez", "age", "life", "size", "grow", "rot", "spin", "row", "fps", "frame0",
      "alpha", "gravity", "drag", "sway", "face", "ramp", "aspect", "fadeIn", "bolt", "phase"] as const;
    this.f = Object.fromEntries(keys.map(k => [k, new Float32Array(capacity)])) as HolderPool["f"];
    this.a = new Float32Array(capacity * 4); this.b = new Float32Array(capacity * 4);
    this.c = new Float32Array(capacity * 4); this.d = new Float32Array(capacity * 4);
  }
  get alive(): number { let n = 0; for (let i = 0; i < this.capacity; i++) if (this.f.life[i] > 0) n++; return n; }

  emit(e: Emit, rnd: () => number) {
    const i = this.next, f = this.f;
    this.next = (i + 1) % this.capacity;
    f.px[i] = e.x; f.py[i] = e.y; f.pz[i] = e.z; f.vx[i] = e.vx ?? 0; f.vy[i] = e.vy ?? 0; f.vz[i] = e.vz ?? 0;
    f.bolt[i] = e.to ? 1 : 0;
    if (e.to) { f.ex[i] = e.to[0]; f.ey[i] = e.to[1]; f.ez[i] = e.to[2]; }
    f.age[i] = 0; f.life[i] = e.life; f.size[i] = e.size * (FILL[e.sprite] ?? 1); f.grow[i] = e.grow ?? 1; f.rot[i] = e.rot ?? (rnd() - 0.5) * 0.8;
    f.spin[i] = e.spin ? (rnd() - 0.5) * 2 * e.spin : 0; f.row[i] = FXLIB_PACK[e.sprite].row; f.fps[i] = e.fps ?? 0;
    f.frame0[i] = Math.floor(rnd() * FRAMES); f.alpha[i] = e.alpha ?? 1; f.gravity[i] = e.gravity ?? 0; f.drag[i] = e.drag ?? 0;
    f.sway[i] = e.sway ?? 0; f.face[i] = e.face ?? FACE_BILLBOARD; f.ramp[i] = e.ramp; f.aspect[i] = e.aspect ?? 1; f.fadeIn[i] = e.fadeIn ?? 10;
    f.phase[i] = rnd() * Math.PI * 2;
  }

  /** Age, drag, fall (or rise), flutter; a bolt stays where it struck. */
  step(dt: number) {
    if (dt <= 0) return;
    const f = this.f;
    for (let i = 0; i < this.capacity; i++) {
      if (f.life[i] <= 0) continue;
      const age = f.age[i] + dt;
      if (age >= f.life[i]) { f.life[i] = 0; continue; }
      f.age[i] = age;
      if (f.bolt[i]) continue;
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
      if (f.life[i] <= 0) continue;
      const t = f.age[i] / f.life[i], q = n++ * 4;
      const frame = f.fps[i] > 0 ? (f.frame0[i] + Math.floor(f.age[i] * f.fps[i])) % FRAMES : Math.min(FRAMES - 1, Math.floor(t * FRAMES));
      const fade = Math.min(1, t * f.fadeIn[i]) * (1 - smooth(0.62, 1, t));
      let x = f.px[i], y = f.py[i], z = f.pz[i], w = f.size[i] * (1 + (f.grow[i] - 1) * (1 - (1 - t) * (1 - t))), h = w * f.aspect[i], rot = f.rot[i];
      if (f.bolt[i]) {
        // Laid from its start to its end on screen: its length the span's, its thickness its size.
        const dx = f.ex[i] - x, dy = f.ey[i] - y, dz = f.ez[i] - z, r = dx * right.x + dy * right.y + dz * right.z, u = dx * up.x + dy * up.y + dz * up.z;
        x += dx / 2; y += dy / 2; z += dz / 2;
        h = f.size[i]; w = Math.hypot(r, u); rot = Math.atan2(u, r);
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

/** The types this file throws (the rest of the library is a shell on the holder, a trail, or an authored GLB part). */
export const POOL_KINDS = ["aura", "particles", "sparks", "motion", "electricity", "embers", "flame", "petals", "gather", "burst"] as const satisfies readonly FxKind[];
export type PoolKind = (typeof POOL_KINDS)[number];
/** The outside things that act on a holder in a moment (the awakening's strike, David 2026-11-06). */
export type StrikeKind = "lightning" | "wave";

/** What a frame of a holder's effect knows: its surface in the world now, its size, the world's up, the camera's right. */
export interface Holder {
  /** Surface point `i` (of `n`) and its normal, in the world now. */
  n: number;
  point(i: number, out: THREE.Vector3): THREE.Vector3;
  normal(i: number, out: THREE.Vector3): THREE.Vector3;
  /** Along its long axis (0 its base, 1 its tip), in the world now. */
  along(s: number, out: THREE.Vector3): THREE.Vector3;
  /** Its long axis's world length. */
  size: number;
  /** The camera's right, in the world (a wave comes in from the side you see). */
  right: THREE.Vector3;
}

/** A type's ramp row and its strength, the frame's time and step, and the pool. */
export interface Ctx { pool: HolderPool; rnd: () => number; holder: Holder; ramp: number; k: number; t: number; dt: number; state: Record<string, number> }

const p = new THREE.Vector3(), q = new THREE.Vector3(), nrm = new THREE.Vector3(), o = new THREE.Vector3();
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

/** One frame of a type on a holder. */
export function throwKind(kind: PoolKind, c: Ctx) {
  const { pool, rnd, holder: h, ramp, k } = c, L = h.size;
  switch (kind) {
    case "particles": // motes drifting up off it
      for (let j = due(c, kind, fxAt("particles", "rate", k) * 14); j--;) {
        const i = pick(c); h.point(i, p); h.normal(i, nrm);
        pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: nrm.x * 0.04 * L, vy: (0.16 + 0.14 * rnd()) * L, vz: nrm.z * 0.04 * L,
          life: 1.1 + 0.6 * rnd(), size: (0.05 + 0.03 * rnd()) * L, grow: 0.4, drag: 0.4, fps: 14, ramp, fadeIn: 6 }, rnd);
      }
      return;
    case "sparks": // a one-off spray (thrown by `strike` and `burst`, or every so often in a preview)
      return sparks(c, Math.round(fxAt("sparks", "count", k)));
    case "burst":
      return burst(c);
    case "aura": // the aura's tongues of light: its colour licking up off it (the shell is HolderFx's)
      for (let j = due(c, kind, 16 * Math.sqrt(k)); j--;) {
        const i = pick(c); h.point(i, p); h.normal(i, nrm);
        pool.emit({ sprite: "flame", x: p.x + nrm.x * 0.02 * L, y: p.y, z: p.z + nrm.z * 0.02 * L, vy: 0.22 * L, life: 0.5 + 0.3 * rnd(), size: (0.12 + 0.06 * rnd()) * L * Math.sqrt(k),
          grow: 0.5, fps: 10, face: FACE_STANDING, ramp, alpha: 0.55, fadeIn: 5 }, rnd);
      }
      return;
    case "motion": { // three comets spiralling up round it, each leaving a short tail
      const spin = 3.2 * fxGrow("motion", "spin", k);
      for (let j = 0; j < 3; j++) {
        const a = c.t * spin + (j * Math.PI * 2) / 3, s = (c.t * 0.32 + j / 3) % 1;
        h.along(s, p); h.along(Math.min(1, s + 0.01), q);
        const ax = q.sub(p).normalize(), side = o.set(1, 0, 0).cross(ax).normalize();
        if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
        const other = nrm.copy(ax).cross(side), r = 0.09 * L * fxGrow("motion", "bob", k);
        p.addScaledVector(side, Math.cos(a) * r).addScaledVector(other, Math.sin(a) * r);
        for (let m = due(c, `${kind}${j}`, 90); m--;) pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, life: 0.16 * Math.sqrt(k), size: 0.07 * L, grow: 0.2, ramp, fadeIn: 30 }, rnd);
      }
      return;
    }
    case "electricity": { // bolts crawling between points on it, re-struck sixteen times a second; now and then an arc out
      if (!every(c, kind, 1 / 16)) return;
      const bolts = Math.round(fxAt("electricity", "bolts", k)), reach = fxAt("electricity", "reach", k) * L;
      for (let j = 0; j < bolts; j++) {
        const i = pick(c); h.point(i, p); h.normal(i, nrm);
        let best = -1, gap = 0;
        for (let tries = 0; tries < 8; tries++) {
          const m = pick(c), d = h.point(m, q).distanceTo(p);
          if (d > 0.05 * L && d < reach) { best = m; gap = d; break; }
        }
        if (best < 0) continue;
        h.point(best, q);
        zigzag(c, p, q, nrm, 2, gap * 0.35, 0.06 * L, 0.09);
        pool.emit({ sprite: "flare", x: q.x, y: q.y, z: q.z, life: 0.08, size: 0.16 * L, ramp, fadeIn: 50 }, rnd);
      }
      if (rnd() < fxAt("electricity", "arcs", k)) { // an arc out into the air
        const i = pick(c); h.point(i, p); h.normal(i, nrm);
        q.copy(p).addScaledVector(nrm, 0.25 * L).add(o.set(rnd() - 0.5, rnd(), rnd() - 0.5).multiplyScalar(0.15 * L));
        zigzag(c, p, q, nrm, 3, 0.08 * L, 0.04 * L, 0.11);
      }
      return;
    }
    case "embers": { // fire sparks thrown off in pulses, a trickle between
      const pulse = every(c, kind, 1 / fxAt("embers", "pulse", k));
      const n = (pulse ? Math.round(fxAt("embers", "count", k)) : 0) + due(c, `${kind}~`, 4);
      for (let j = 0; j < n; j++) {
        const i = pick(c); h.point(i, p); h.normal(i, nrm);
        const v = pulse ? 1 : 0.4;
        pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: (nrm.x * (0.2 + 0.3 * rnd()) + (rnd() - 0.5) * 0.3) * L * v, vy: (0.35 + 0.5 * rnd()) * L * v,
          vz: (nrm.z * (0.2 + 0.3 * rnd()) + (rnd() - 0.5) * 0.3) * L * v, gravity: -0.25 * L, drag: 1.4, life: 0.7 + 0.6 * rnd(), size: (0.04 + 0.03 * rnd()) * L,
          grow: 0.35, fps: 20, ramp, fadeIn: 20, sway: 0.05 * L }, rnd);
      }
      if (pulse) { const i = pick(c); h.point(i, p); pool.emit({ sprite: "sparkBurst", x: p.x, y: p.y, z: p.z, life: 0.3, size: 0.28 * L * Math.sqrt(k), ramp, fadeIn: 40 }, rnd); }
      return;
    }
    case "flame": { // tongues licking up all along it, embers off the top
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
    case "petals": // sakura petals let go of it, tumbling, drifting with the breeze and fluttering down
      for (let j = due(c, kind, fxAt("petals", "rate", k) * 7); j--;) {
        const i = pick(c); h.point(i, p); h.normal(i, nrm);
        pool.emit({ sprite: "sakura", x: p.x, y: p.y, z: p.z, vx: (nrm.x * 0.18 + 0.12) * L, vy: (0.08 + 0.1 * rnd()) * L, vz: (nrm.z * 0.18 + 0.04) * L,
          gravity: 0.36 * L, drag: 1.6, sway: 0.3 * L, spin: 2.2, life: 2.2 + 1.2 * rnd(), size: (0.06 + 0.025 * rnd()) * L, fps: 8 + 4 * rnd(), ramp, fadeIn: 12 }, rnd);
      }
      return;
    case "gather": { // light drawn in to it from all round, arriving as it fades (the build-up of a moment)
      h.along(0.5, o);
      for (let j = due(c, kind, fxAt("gather", "rate", k)); j--;) {
        const i = pick(c); h.point(i, q);
        nrm.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(0.55 * L);
        p.copy(o).add(nrm);
        const life = 0.55 + 0.3 * rnd();
        pool.emit({ sprite: "mote", x: p.x, y: p.y, z: p.z, vx: (q.x - p.x) / life, vy: (q.y - p.y) / life, vz: (q.z - p.z) / life,
          life, size: 0.05 * L, grow: 0.5, fps: 16, ramp, fadeIn: 4 }, rnd);
      }
      return;
    }
  }
}

/** A bolt from `a` to `b` in `segs` jagged pieces, each kink thrown `jag` off the line (away from `out` and round it). */
function zigzag(c: Ctx, a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3, segs: number, jag: number, thick: number, life: number) {
  const { pool, rnd, ramp } = c;
  let x = a.x, y = a.y, z = a.z;
  for (let s = 1; s <= segs; s++) {
    const u = s / segs, last = s === segs;
    const nx = a.x + (b.x - a.x) * u + (last ? 0 : (out.x * 0.6 + rnd() - 0.5) * jag), ny = a.y + (b.y - a.y) * u + (last ? 0 : (out.y * 0.6 + rnd() - 0.5) * jag),
      nz = a.z + (b.z - a.z) * u + (last ? 0 : (out.z * 0.6 + rnd() - 0.5) * jag);
    pool.emit({ sprite: "bolt", x, y, z, to: [nx, ny, nz], size: thick, life, fps: 30, ramp, fadeIn: 60 }, rnd);
    x = nx; y = ny; z = nz;
  }
}

/** The sparks type: a spray off it, from its tip a flare and a burst of streaks. */
function sparks(c: Ctx, n: number) {
  const { pool, rnd, holder: h, ramp } = c, L = h.size;
  h.along(1, p);
  pool.emit({ sprite: "sparkBurst", x: p.x, y: p.y, z: p.z, life: 0.35, size: 0.45 * L, ramp, fadeIn: 40 }, rnd);
  pool.emit({ sprite: "flare", x: p.x, y: p.y, z: p.z, life: 0.3, size: 0.35 * L, ramp, fadeIn: 40 }, rnd);
  const v = fxAt("sparks", "speed", 1);
  for (let j = 0; j < n; j++) {
    const i = pick(c); h.point(i, q); h.normal(i, nrm);
    pool.emit({ sprite: "mote", x: q.x, y: q.y, z: q.z, vx: (nrm.x + (rnd() - 0.5)) * v * L, vy: (nrm.y + rnd() * 0.8) * v * L, vz: (nrm.z + (rnd() - 0.5)) * v * L,
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

/**
 * A strike from outside at the moment's hit (David 2026-11-06: "if its a new model or new effect external things will
 * attach like a lighting related will strike it with thunder"): `t` seconds since it began, `hit` when it lands.
 * Lightning: the tip crackles while it gathers, then a bolt comes down out of the sky onto the tip, forks, strikes
 * twice more and lingers, a flare and sparks at the tip. A wave: a crest rises beside it from the side you see, curls
 * and crashes over it at the hit, its spray flung up and falling.
 */
export function throwStrike(kind: StrikeKind, c: Ctx, t: number, hit: number) {
  const { pool, rnd, holder: h, ramp } = c, L = h.size;
  if (kind === "lightning") {
    if (t < hit) { // the charge gathering at the tip
      if (!every(c, "charge", 1 / 14)) return;
      h.along(1, p);
      for (let j = 0; j < 2; j++) zigzag(c, p, q.copy(p).add(o.set(rnd() - 0.5, rnd() * 0.6, rnd() - 0.5).multiplyScalar(0.18 * L)), nrm.set(0, 1, 0), 2, 0.04 * L, 0.03 * L, 0.07);
      return;
    }
    for (const at of [0, 0.12, 0.27]) {
      if (c.state[`strike${at}`] || t < hit + at) continue;
      c.state[`strike${at}`] = 1;
      h.along(1, q);
      p.copy(q).add(o.set((rnd() - 0.5) * 0.6 * L, 3.2 * L, (rnd() - 0.5) * 0.3 * L));
      zigzag(c, p, q, o.set(1, 0, 0), 7, 0.22 * L, (at ? 0.09 : 0.14) * L, at ? 0.12 : 0.3);
      for (let f = 0; f < 2; f++) { // forks off the upper half
        const u = 0.3 + 0.3 * rnd();
        const a = o.copy(p).lerp(q, u), end = nrm.copy(a).add(new THREE.Vector3((rnd() - 0.5) * 0.9 * L, -0.35 * L, (rnd() - 0.5) * 0.3 * L));
        zigzag(c, a.clone(), end.clone(), new THREE.Vector3(0, 1, 0), 3, 0.12 * L, 0.05 * L, 0.14);
      }
      pool.emit({ sprite: "flare", x: q.x, y: q.y, z: q.z, life: 0.45, size: 0.8 * L, ramp, fadeIn: 60 }, rnd);
      if (!at) { pool.emit({ sprite: "sparkBurst", x: q.x, y: q.y, z: q.z, life: 0.4, size: 0.9 * L, ramp, fadeIn: 60 }, rnd); sparks(c, 20); }
    }
    return;
  }
  // The wave: one crest, its flipbook played over its rise and crash, sliding in from the side you see.
  h.along(0.42, q);
  if (!c.state.wave) {
    c.state.wave = 1;
    p.copy(q).addScaledVector(h.right, -0.75 * L);
    const life = hit + 0.55;
    pool.emit({ sprite: "wave", x: p.x, y: p.y, z: p.z, vx: h.right.x * 0.7 * L / life, vz: h.right.z * 0.7 * L / life, life, size: 1.35 * L, rot: 0, ramp, fadeIn: 12 }, rnd);
  }
  if (t >= hit && !c.state.crash) {
    c.state.crash = 1;
    for (let j = 0; j < 14; j++) {
      const s = 0.2 + 0.7 * rnd();
      h.along(s, p);
      pool.emit({ sprite: "droplet", x: p.x, y: p.y, z: p.z, vx: (h.right.x * 0.5 + (rnd() - 0.5) * 0.8) * L, vy: (0.6 + 0.8 * rnd()) * L, vz: (h.right.z * 0.5 + (rnd() - 0.5) * 0.8) * L,
        gravity: 2.2 * L, drag: 0.6, life: 0.7 + 0.4 * rnd(), size: (0.22 + 0.12 * rnd()) * L, ramp, fadeIn: 30 }, rnd);
    }
    pool.emit({ sprite: "flare", x: q.x, y: q.y, z: q.z, life: 0.35, size: 0.7 * L, ramp, fadeIn: 60 }, rnd);
  }
}

/** The library's default colours for the types whose colour is their material's (fire is fire), as ramps (core, mid, edge). */
export const KIND_RAMP: Partial<Record<PoolKind | StrikeKind, readonly [string, string, string]>> = {
  embers: ["#fff4d6", "#ff8a3d", "#5a1a08"],
  flame: ["#fff4d6", "#ff8a3d", "#5a1a08"],
  petals: ["#fff3f7", "#ffb3cd", "#d9577f"],
  electricity: ["#f2fdff", "#7fe0ff", "#2a5cff"],
  lightning: ["#f2fdff", "#7fe0ff", "#2a5cff"],
  wave: ["#effdff", "#3fb6d9", "#0b4f78"],
};
/** A ramp from one colour: its light tint at the core, itself in the middle, its shade at the edge. Never plain white. */
export function rampOf(hex: string): [string, string, string] {
  const c = new THREE.Color(hex), core = c.clone().lerp(new THREE.Color(1, 1, 1), 0.72), edge = c.clone().multiplyScalar(0.45);
  return [`#${core.getHexString()}`, `#${c.getHexString()}`, `#${edge.getHexString()}`];
}
