/**
 * Weather on the ground (specs/polish/living-village.md deliverable 6; row 152): raindrops landing as splashes on the
 * ground and rings on puddles and open water, and footprints pressed into snow that fade.
 *
 * The rain is world state like the streaks overhead (worldFx.rainStreak): every square of the world has its drops land
 * at seeded moments and spots, so two players see the same splashes; the view only picks which squares are drawn.
 * Footprints belong to whoever walked (an avatar or a resident), a print every stride, alternating feet.
 */
import { hash01 } from "./worldFx";

// ── Rain landing ──────────────────────────────────────────────────────
/** World squares (units) and how often a drop lands in each (seconds): 0.4 splashes per square unit a second. Frames must be shorter than the period. */
export const SPLASH_CELL = 1, SPLASH_PERIOD = 2.5;
/** The drawn window round the view focus: wider than deep, reaching further up-screen (the camera looks +z). */
export const SPLASH_WINDOW = { x: 15, back: 8, ahead: 15 };

/**
 * Every drop that lands in the window round (fx, fz) during (t0, t1]: calls `land(x, z, seed)` for each. Each square
 * lands one drop per period at its own phase and a seeded spot; nothing depends on who is looking.
 */
export function rainLandings(t0: number, t1: number, fx: number, fz: number, land: (x: number, z: number, seed: number) => void): number {
  if (t1 <= t0) return 0;
  let n = 0;
  const x0 = Math.floor((fx - SPLASH_WINDOW.x) / SPLASH_CELL), x1 = Math.floor((fx + SPLASH_WINDOW.x) / SPLASH_CELL);
  const z0 = Math.floor((fz - SPLASH_WINDOW.back) / SPLASH_CELL), z1 = Math.floor((fz + SPLASH_WINDOW.ahead) / SPLASH_CELL);
  for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
    const off = hash01(gx * 73856093, gz * 19349663) * SPLASH_PERIOD;
    const k1 = Math.floor((t1 + off) / SPLASH_PERIOD);
    if (k1 === Math.floor((t0 + off) / SPLASH_PERIOD)) continue;
    const seed = (gx * 92821 + gz * 68917 + k1 * 31) | 0;
    land((gx + hash01(seed, 1)) * SPLASH_CELL, (gz + hash01(seed, 2)) * SPLASH_CELL, seed);
    n++;
  }
  return n;
}

/** Whether a point is in one of the puddles (ellipses: centre, radii). */
export function inPuddle(x: number, z: number, puddles: readonly { x: number; z: number; rx: number; rz: number }[]): boolean {
  for (const p of puddles) { const u = (x - p.x) / p.rx, v = (z - p.z) / p.rz; if (u * u + v * v < 1) return true; }
  return false;
}

// ── Footprints ───────────────────────────────────────────────────────
/** A print every stride (world units) of ground walked, alternating feet this far either side of the line. */
export const STRIDE = 0.42, FOOT_SIDE = 0.085;
/** How long a print lasts, fading over its last FADE seconds. */
export const PRINT_LIFE = 14, PRINT_FADE = 6;

export interface Trail { x: number; z: number; walked: number; foot: number; ready: boolean }
export const newTrail = (): Trail => ({ x: 0, z: 0, walked: 0, foot: 0, ready: false });
export interface Print { x: number; z: number; yaw: number; left: boolean }

/**
 * A walker moved to (x, z): returns a print when another stride is walked (written into `out`), else null. A jump of
 * more than a few units (a teleport, a door) restarts the trail without a print.
 */
export function stepTrail(trail: Trail, x: number, z: number, out: Print): Print | null {
  if (!trail.ready) { trail.x = x; trail.z = z; trail.ready = true; return null; }
  const dx = x - trail.x, dz = z - trail.z, d = Math.hypot(dx, dz);
  if (d > 3) { trail.x = x; trail.z = z; trail.walked = 0; return null; }
  if (d < 1e-4) return null;
  trail.walked += d;
  trail.x = x; trail.z = z;
  if (trail.walked < STRIDE) return null;
  trail.walked -= STRIDE;
  trail.foot ^= 1;
  const sx = dz / d, sz = -dx / d, side = trail.foot ? FOOT_SIDE : -FOOT_SIDE;
  out.x = x + sx * side; out.z = z + sz * side; out.yaw = Math.atan2(dx, dz); out.left = !trail.foot;
  return out;
}

/** A print's opacity `age` seconds after it was made: full, then fading out over its last PRINT_FADE seconds. */
export function printOpacity(age: number): number {
  if (age < 0 || age >= PRINT_LIFE) return 0;
  const u = (age - (PRINT_LIFE - PRINT_FADE)) / PRINT_FADE;
  return u <= 0 ? 1 : 1 - u * u * (3 - 2 * u);
}
