/**
 * World effects (look spec §7, row 238): rain, snow, shed leaves, mist and
 * cloud drift as functions of world position, world time (worldClock.ts) and
 * shared weather. Nothing here takes a player position: two players in the
 * same place at the same moment get the same streaks, leaves and banks.
 *
 * The view only chooses WHICH part of the world is drawn (a window around the
 * view focus); it never moves anything. Rain and mist are one world tile
 * repeating everywhere, so the window holds exactly one copy of each streak
 * or bank. Randomness is an integer hash of ids and cycle numbers.
 */
import type { IslandWeather } from "./islandWeather";
import type { Season } from "./season";

export interface Point3 { x: number; y: number; z: number }
type Ground = (x: number, z: number) => number;

/** Hash of two ints to [0, 1). Integer mixing, so huge cycle counts stay random (a sin-hash would not). */
export function hash01(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ─── One world wind ──────────────────────────────────────────────────────
/** Prevailing direction (unit XZ): toward +x (screen left), a little into the screen. */
export const WIND_DIR = { x: Math.cos(0.35), z: Math.sin(0.35) };
/** Ground wind by weather, world units/s: a windy day blows hardest, fog barely moves. */
const WIND_SPEED: Record<IslandWeather, number> = { clear: 0.8, fog: 0.25, rain: 2.6, snow: 1.1, wind: 3.4 };
export interface WorldWind { x: number; z: number; speed: number }
export function worldWind(weather: IslandWeather): WorldWind {
  const speed = WIND_SPEED[weather];
  return { x: WIND_DIR.x * speed, z: WIND_DIR.z * speed, speed };
}
/** Cloud layer speed along WIND_DIR. Constant, not the weather's, so a weather change never jumps the shadows. */
export const CLOUD_SPEED = 0.15;

/** Where the view ray meets the ground plane: the centre of the drawn window (the player in follow mode, the plaza in overview). */
export function viewFocus(eye: Point3, dir: Point3, out: { x: number; z: number }): { x: number; z: number } {
  const k = dir.y < -0.05 ? Math.min(-eye.y / dir.y, 80) : 80;
  out.x = eye.x + dir.x * k;
  out.z = eye.z + dir.z * k;
  return out;
}

/** The copy of a `tile`-periodic coordinate that lies in [c − tile/2, c + tile/2). */
export function wrapInto(v: number, c: number, tile: number): number {
  const lo = c - tile / 2;
  return lo + ((((v - lo) % tile) + tile) % tile);
}

/** 1 → 0 smoothly as v goes from a to b. */
function fadeOut(v: number, a: number, b: number): number {
  const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return 1 - u * u * (3 - 2 * u);
}

/** 1 inside the window, easing to 0 over its outer 40% so wrapped copies never pop in view. */
export function windowFade(dx: number, dz: number, tile: number): number {
  return fadeOut(Math.abs(dx), tile * 0.3, tile * 0.5) * fadeOut(Math.abs(dz), tile * 0.3, tile * 0.5);
}

// ─── Rain and snow ───────────────────────────────────────────────────────
export const RAIN_TILE = 36;
const RAIN_TOP = 16, RAIN_BOTTOM = -0.3;
export interface FallLook { fall: number; sway: number }

/**
 * Streak `i` at world time `t`, drawn in the window centred on (cx, cz). Each
 * fall starts at a spot fixed by (streak, fall number) and drifts with the
 * wind; a result below the ground is the caller's to hide.
 */
export function rainStreak(i: number, t: number, wind: WorldWind, look: FallLook, cx: number, cz: number, out: Point3): Point3 {
  const span = RAIN_TOP - RAIN_BOTTOM;
  const period = span / (look.fall * (0.75 + 0.5 * hash01(i, 1)));
  const phase = t / period + hash01(i, 2);
  const cycle = Math.floor(phase), s = phase - cycle, age = s * period;
  const sway = look.sway ? look.sway * Math.sin(t * 1.3 + hash01(i, 3) * 40) : 0;
  out.x = wrapInto(hash01(i, 2 * cycle + 11) * RAIN_TILE + wind.x * age + sway, cx, RAIN_TILE);
  out.z = wrapInto(hash01(i, 2 * cycle + 12) * RAIN_TILE + wind.z * age, cz, RAIN_TILE);
  out.y = RAIN_TOP - s * span;
  return out;
}

// ─── Mist banks ──────────────────────────────────────────────────────────
export const MIST_TILE = 32;
export const MIST_BANKS = 10;

/**
 * Fog bank `k`: a world position drifting with the wind, and its strength,
 * which pools it over the sea, the river and low ground and thins it over
 * rises. The window fade (windowFade) is the caller's.
 */
export function mistBank(k: number, t: number, wind: WorldWind, cx: number, cz: number, ground: Ground, out: Point3 & { strength: number }): Point3 & { strength: number } {
  out.x = wrapInto(hash01(k, 21) * MIST_TILE + wind.x * t, cx, MIST_TILE);
  out.z = wrapInto(hash01(k, 22) * MIST_TILE + wind.z * t, cz, MIST_TILE);
  const g = ground(out.x, out.z);
  out.strength = fadeOut(g, 0.3, 0.9);
  out.y = Math.max(g, 0) + 0.9 + (k % 2) * 0.5;
  return out;
}

// ─── Leaves and petals shed by the trees ─────────────────────────────────
/** Crown of each shedding tree model at scale 1, from its GLB bounds (2026-09-27): top, half-widths. */
const CANOPIES: Record<string, { season: Season; top: number; rx: number; rz: number }> = {
  "tree-blossom": { season: "spring", top: 3.2, rx: 1.4, rz: 0.8 },
  "tree-hardwood-a": { season: "autumn", top: 2.5, rx: 1.05, rz: 0.7 },
  "tree-hardwood-b": { season: "autumn", top: 3.15, rx: 1.3, rz: 0.8 },
};
export interface LeafTree { id: number; x: number; y: number; z: number; top: number; rx: number; rz: number }

/** The trees that shed this season (cherry petals in spring, hardwood leaves in autumn), seeded by position. */
export function sheddingTrees(trees: readonly { x: number; y: number; z: number; model: string; scale: number }[], season: Season): LeafTree[] {
  const out: LeafTree[] = [];
  for (const t of trees) {
    const crown = CANOPIES[t.model.replace(/^.*\/|\.glb$/g, "")];
    if (!crown || crown.season !== season) continue;
    const id = Math.imul(Math.round(t.x * 8), 73856093) ^ Math.imul(Math.round(t.z * 8), 19349663);
    out.push({ id, x: t.x, y: t.y, z: t.z, top: crown.top * t.scale, rx: crown.rx * t.scale, rz: crown.rz * t.scale });
  }
  return out;
}

export const LEAF_SLOTS = 12;
const LEAF_GROW = 0.4, LEAF_REST = 2.5, LEAF_FADE = 1;
/** Leaves ride most, not all, of the wind. */
const LEAF_DRAG = 0.8;
export interface LeafLook { fall: number; flutter: number; spin: number }
export interface LeafPose extends Point3 { rx: number; ry: number; rz: number; /** 0 = not in the air or on the ground now. */ scale: number }

/** Where a leaf released at (x0, z0) is `a` seconds later: downwind, fluttering sideways to the wind (along x in still air). */
function drift(a: number, x0: number, z0: number, wind: WorldWind, flutter: number, rate: number, spin: number, out: Point3): void {
  const f = flutter * Math.sin(a * rate + spin);
  const still = wind.speed < 1e-6;
  out.x = x0 + wind.x * LEAF_DRAG * a + (still ? f : -wind.z / wind.speed * f);
  out.z = z0 + wind.z * LEAF_DRAG * a + (still ? 0 : wind.x / wind.speed * f);
}

/**
 * Leaf `slot` of `tree` at world time `t`. Each slot repeats on its own
 * seeded period: it leaves a seeded spot in the crown, falls fluttering
 * downwind, lands on the ground (or the water) below, rests, shrinks away and
 * waits for its next fall.
 */
export function leafAt(tree: LeafTree, slot: number, t: number, wind: WorldWind, look: LeafLook, ground: Ground, out: LeafPose): LeafPose {
  const key = Math.imul(tree.id, 31) + slot;
  const period = 11 + 6 * hash01(key, 1);
  const phase = t / period + hash01(key, 2);
  const cycle = Math.floor(phase), age = (phase - cycle) * period, c = Math.imul(cycle, 8);
  const angle = hash01(key, c) * Math.PI * 2, reach = Math.sqrt(hash01(key, c + 1));
  const x0 = tree.x + Math.cos(angle) * tree.rx * reach, z0 = tree.z + Math.sin(angle) * tree.rz * reach;
  const y0 = tree.y + tree.top * (0.5 + 0.35 * hash01(key, c + 2));
  const fall = look.fall * (0.8 + 0.4 * hash01(key, c + 3));
  const spin = hash01(key, c + 4) * Math.PI * 2, rate = 1.4 + hash01(key, c + 5);
  const size = 0.7 + 0.6 * hash01(key, c + 6);
  const flutter = look.flutter;
  // Landing: two passes, so a leaf blown off a rise falls on to the ground below it.
  let land = Math.max(0, (y0 - tree.y) / fall);
  drift(land, x0, z0, wind, flutter, rate, spin, out);
  land = Math.max(0, (y0 - ground(out.x, out.z)) / fall);
  let scale = size * Math.min(1, (period - age) / LEAF_FADE);
  if (age < land) {
    drift(age, x0, z0, wind, flutter, rate, spin, out);
    out.y = y0 - fall * age;
    out.rx = Math.sin(age * 1.7 + spin) * 0.6; out.ry = spin + age * look.spin * 0.1; out.rz = age * look.spin * 0.12;
    scale *= Math.min(1, age / LEAF_GROW);
  } else {
    drift(land, x0, z0, wind, flutter, rate, spin, out);
    out.y = ground(out.x, out.z) + 0.02;
    out.rx = -Math.PI / 2; out.ry = 0; out.rz = spin;
    scale *= Math.min(1, Math.max(0, 1 - (age - land - LEAF_REST) / LEAF_FADE));
  }
  out.scale = scale;
  return out;
}
