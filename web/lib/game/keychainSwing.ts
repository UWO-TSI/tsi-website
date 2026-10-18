/**
 * The keycap keychain's swing (specs/merch/tsi-keycap-keychain.md): a small verlet chain, no physics library. Points
 * from the hook down: the keyring's foot, the chain's joints, the body's top (the lobster clasp) and the body's middle
 * (its weight); each consecutive pair held at its length. Gravity pulls it down, a little damping settles it. A drag
 * holds the body's middle at the pointer; let go and it swings back to rest. The body also twists about its own axis,
 * a damped spring the drag winds up. And a press on the keycap pushes it in and lets it back, in step with the click.
 * All in the model's own units (art/merch/build_keycap_keychain.py: the keychain hangs straight down from 0).
 */

export type Vec3 = [number, number, number];
export interface Swing {
  /** Each point now and a step ago (verlet). */
  p: Vec3[]; prev: Vec3[];
  /** Each link's rest length (p[i] to p[i + 1]). */
  len: number[];
  /** Where the body's middle is held while dragged, else null. */
  drag: Vec3 | null;
  /** The body's twist about its axis (rad) and how fast it's turning. */
  twist: number; spin: number;
}

/** The hanging layout (art/merch/build_keycap_keychain.py): the keyring, four chain links, the body's top, its middle. */
export const KEYCHAIN_LINKS = [0.30, 0.095, 0.095, 0.095, 0.095, 0.28];
export const GRAVITY = 9.8;
/** Share of velocity kept each second: settles in a few seconds, still swings for a while. */
export const DAMPING = 0.35;
const ITER = 12;

export function newSwing(links: readonly number[] = KEYCHAIN_LINKS): Swing {
  const p: Vec3[] = [[0, 0, 0]];
  for (const l of links) { const q = p[p.length - 1]; p.push([q[0], q[1] - l, q[2]]); }
  return { p, prev: p.map(v => [...v] as Vec3), len: [...links], drag: null, twist: 0, spin: 0 };
}

/** One step of `dt` seconds (call it at a fixed small step: stepSwingFor splits a frame up). */
export function stepSwing(s: Swing, dt: number): Swing {
  const keep = Math.pow(DAMPING, dt), n = s.p.length;
  for (let i = 1; i < n; i++) {
    const p = s.p[i], q = s.prev[i];
    const vx = (p[0] - q[0]) * keep, vy = (p[1] - q[1]) * keep, vz = (p[2] - q[2]) * keep;
    q[0] = p[0]; q[1] = p[1]; q[2] = p[2];
    p[0] += vx; p[1] += vy - GRAVITY * dt * dt; p[2] += vz;
  }
  const last = n - 1;
  if (s.drag) { s.p[last][0] = s.drag[0]; s.p[last][1] = s.drag[1]; s.p[last][2] = s.drag[2]; }
  for (let it = 0; it < ITER; it++) {
    s.p[0][0] = 0; s.p[0][1] = 0; s.p[0][2] = 0;
    for (let i = 0; i < n - 1; i++) {
      const a = s.p[i], b = s.p[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const d = Math.hypot(dx, dy, dz) || 1e-9, k = (d - s.len[i]) / d;
      // The hook never moves; a dragged end holds; otherwise the pair shares the correction.
      const wa = i === 0 ? 0 : 0.5, wb = i + 1 === last && s.drag ? 0 : i === 0 ? 1 : 0.5;
      const t = wa + wb || 1;
      a[0] += dx * k * (wa / t); a[1] += dy * k * (wa / t); a[2] += dz * k * (wa / t);
      b[0] -= dx * k * (wb / t); b[1] -= dy * k * (wb / t); b[2] -= dz * k * (wb / t);
    }
  }
  // The twist: a damped spring back to 0 (the drag winds it, spinTwist).
  s.spin += (-s.twist * 28 - s.spin * 3.2) * dt;
  s.twist += s.spin * dt;
  return s;
}

/** Advance by a frame's `dt`, in steps of at most 1/120 s (stable however long the frame was). */
export function stepSwingFor(s: Swing, dt: number): Swing {
  const n = Math.max(1, Math.ceil(Math.min(dt, 0.1) / (1 / 120)));
  for (let i = 0; i < n; i++) stepSwing(s, Math.min(dt, 0.1) / n);
  return s;
}

/** Hold the body's middle at `at` (model units), kept within the chain's reach of the hook. */
export function dragSwing(s: Swing, at: Vec3 | null): Swing {
  if (!at) { s.drag = null; return s; }
  const reach = s.len.reduce((a, b) => a + b, 0) * 0.98, d = Math.hypot(...at);
  const k = d > reach ? reach / d : 1;
  s.drag = [at[0] * k, at[1] * k, at[2] * k];
  return s;
}
/** A drag's sideways sweep winds the body's twist. */
export function spinTwist(s: Swing, by: number): Swing {
  s.spin = Math.max(-25, Math.min(25, s.spin + by));
  return s;
}

/** The fastest any point moves (units a step): ~0 once it has settled. */
export function swingSpeed(s: Swing): number {
  let m = 0;
  for (let i = 0; i < s.p.length; i++) m = Math.max(m, Math.hypot(s.p[i][0] - s.prev[i][0], s.p[i][1] - s.prev[i][1], s.p[i][2] - s.prev[i][2]));
  return m;
}

// ── The keycap's press ───────────────────────────────────────────────────────────────────────────────────────────
/** The press in time with the click (public/audio/sfx/keyswitch.ogg: the bottom-out at 0, the return at 0.11 s). */
export const PRESS = { down: 0.035, hold: 0.075, up: 0.06 } as const;
export interface Press { at: number | null }
export const newPress = (): Press => ({ at: null });
/** Press it now (seconds): a press while one is under way starts again. */
export function pressKey(p: Press, now: number): Press { p.at = now; return p; }
/** How far in the keycap is (0 at rest, 1 bottomed out) at `now`; the press ends itself. */
export function pressDepth(p: Press, now: number): number {
  if (p.at === null) return 0;
  const t = now - p.at;
  if (t < 0) return 0;
  if (t < PRESS.down) return t / PRESS.down;
  if (t < PRESS.down + PRESS.hold) return 1;
  const u = (t - PRESS.down - PRESS.hold) / PRESS.up;
  if (u >= 1) { p.at = null; return 0; }
  return 1 - u * u * (3 - 2 * u);
}
