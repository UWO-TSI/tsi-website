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
/** The drawn window round the view focus: the same reach every way, since the camera turns (specs/camera-orbit.md). */
export const SPLASH_WINDOW = { x: 15, back: 15, ahead: 15 };

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

/** At most this many prints for one move: a frame long enough to cover more strides (a hidden tab) drops the rest. */
export const MAX_STEP_PRINTS = 4;

/**
 * A walker moved to (x, z): calls `emit` with a print (written into `out`) at every stride walked, each where its stride
 * ended along the move, so the spacing holds at any frame rate (audit 2026-10 world item 15: at 5 FPS a frame covers
 * one to three strides). Returns how many. A jump of more than a few units (a teleport, a door) restarts the trail
 * without a print.
 */
export function stepTrail(trail: Trail, x: number, z: number, out: Print, emit: (p: Print) => void): number {
  if (!trail.ready) { trail.x = x; trail.z = z; trail.ready = true; return 0; }
  const x0 = trail.x, z0 = trail.z, dx = x - x0, dz = z - z0, d = Math.hypot(dx, dz);
  if (d > 3) { trail.x = x; trail.z = z; trail.walked = 0; return 0; }
  if (d < 1e-4) return 0;
  trail.x = x; trail.z = z;
  const ux = dx / d, uz = dz / d, yaw = Math.atan2(dx, dz);
  let along = STRIDE - trail.walked, n = 0;
  for (; along <= d; along += STRIDE) {
    if (n === MAX_STEP_PRINTS) continue;
    trail.foot ^= 1;
    const side = trail.foot ? FOOT_SIDE : -FOOT_SIDE;
    out.x = x0 + ux * along + uz * side; out.z = z0 + uz * along - ux * side; out.yaw = yaw; out.left = !trail.foot;
    emit(out);
    n++;
  }
  trail.walked = d - (along - STRIDE);
  return n;
}

/** A print's opacity `age` seconds after it was made: full, then fading out over its last PRINT_FADE seconds. */
export function printOpacity(age: number): number {
  if (age < 0 || age >= PRINT_LIFE) return 0;
  const u = (age - (PRINT_LIFE - PRINT_FADE)) / PRINT_FADE;
  return u <= 0 ? 1 : 1 - u * u * (3 - 2 * u);
}
