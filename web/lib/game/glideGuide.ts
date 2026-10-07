/**
 * The guided first glide (specs/polish/forage-craft-museum.md 7): after the leaf glider is first crafted, the nearest
 * good place to try it (an edge you can run off, facing lower land with somewhere to come down) and a ring on the
 * landing spot; then what happened: a real glide (in the air a while, not a hop) that lands in the ring, or a near miss
 * to go again from. Read off the map the player walks (the painted island, never authored here). Pure.
 */
import { LEVEL_STEP, cellToWorldX, cellToWorldZ, inBounds, isLandCell, isRamp, levelAt, surfaceAt, worldToCellX, worldToCellZ, type IslandMap } from "./grid";

export interface GlideSpot {
  /** Where to run off: the middle of the edge (world x, z), and the way off it. */
  edge: [number, number]; dir: [number, number];
  /** Where the ring lies, out on the lower ground. */
  land: [number, number];
  /** Levels down, and the two grounds' heights (world). */
  drop: number; top: number; below: number;
}
const DIRS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Cells out from the edge the ring may lie (a glide off one level clears about seven; four or five is an easy first try). */
const RING_FROM = 4, RING_TO = 6;

/**
 * The nearest edge within `range` of (x, z) worth a first glide, bigger drops preferred; null when there's none.
 * `blocked`: where a building stands (world x, z): never an edge with one over its run-up (the camera couldn't see the
 * marker, and there's nowhere to run from) or over its ring.
 */
export function glideSpot(map: IslandMap, x: number, z: number, range = 28, blocked?: (x: number, z: number) => boolean): GlideSpot | null {
  const cx0 = worldToCellX(map, x), cz0 = worldToCellZ(map, z), r = Math.ceil(range);
  let best: GlideSpot | null = null, bestScore = Infinity;
  for (let cz = cz0 - r; cz <= cz0 + r; cz++) for (let cx = cx0 - r; cx <= cx0 + r; cx++) {
    if (!isLandCell(map, cx, cz) || isRamp(surfaceAt(map, cx, cz))) continue;
    const lv = levelAt(map, cx, cz);
    for (const [dx, dz] of DIRS) {
      const nx = cx + dx, nz = cz + dz;
      if (!inBounds(map, nx, nz) || isRamp(surfaceAt(map, nx, nz))) continue;
      const nl = levelAt(map, nx, nz), drop = lv - nl;
      if (drop < 1) continue;
      // Out from the edge: nothing back up in the way, and land at the lower level to come down on.
      let ring = -1;
      for (let k = 1; k <= RING_TO; k++) {
        const kx = cx + dx * k, kz = cz + dz * k;
        if (!inBounds(map, kx, kz) || levelAt(map, kx, kz) > nl) break;
        if (k >= RING_FROM && isLandCell(map, kx, kz) && !isRamp(surfaceAt(map, kx, kz)) && levelAt(map, kx, kz) === nl) { ring = k; break; }
      }
      if (ring < 0) continue;
      const ex = cellToWorldX(map, cx) + dx * 0.5, ez = cellToWorldZ(map, cz) + dz * 0.5;
      const lx = cellToWorldX(map, cx + dx * ring), lz = cellToWorldZ(map, cz + dz * ring);
      if (blocked && (blocked(lx, lz) || [0.5, 1.5, 2.5].some(b => blocked(ex - dx * b, ez - dz * b)))) continue;
      const score = Math.hypot(ex - x, ez - z) - 3 * Math.min(drop, 3);
      if (score >= bestScore) continue;
      bestScore = score;
      best = { edge: [ex, ez], dir: [dx, dz], land: [lx, lz], drop, top: lv * LEVEL_STEP, below: nl * LEVEL_STEP };
    }
  }
  return best;
}

// ── The try itself ─────────────────────────────────────────────────────────
export type GuidePhase = "hint" | "gliding" | "done" | "missed";
export interface Guide { spot: GlideSpot; phase: GuidePhase; aloftSince: number; since: number }
/** How long in the air makes it a glide (ms), how close to the ring's middle a landing counts, how long a near miss shows. */
export const GLIDE_MIN_MS = 700, RING_RADIUS = 2.4, MISSED_MS = 2400;

export const newGuide = (spot: GlideSpot): Guide => ({ spot, phase: "hint", aloftSince: -1, since: 0 });

/** One frame of the try (`me.aloft`: well clear of the ground under you). The same object back when nothing changed. */
export function guideStep(g: Guide, me: { x: number; z: number; aloft: boolean }, now: number): Guide {
  if (g.phase === "done") return g;
  if (g.phase === "missed") return now - g.since >= MISSED_MS ? { ...g, phase: "hint", aloftSince: -1 } : g;
  if (me.aloft) {
    const aloftSince = g.aloftSince < 0 ? now : g.aloftSince;
    const phase: GuidePhase = now - aloftSince >= GLIDE_MIN_MS ? "gliding" : g.phase;
    return phase === g.phase && aloftSince === g.aloftSince ? g : { ...g, aloftSince, phase };
  }
  if (g.phase === "gliding") {
    const d = Math.hypot(me.x - g.spot.land[0], me.z - g.spot.land[1]);
    return { ...g, phase: d <= RING_RADIUS ? "done" : "missed", since: now, aloftSince: -1 };
  }
  return g.aloftSince >= 0 ? { ...g, aloftSince: -1 } : g;
}

// ── Whether the guide is due (this device): after the first leaf glider is crafted, until a guided landing or a skip ──
const KEY = "tsi.glider.guide.v1";
type Due = "none" | "pending" | "done";
let due: Due | null = null, view: { phase: GuidePhase; spot: GlideSpot | null } = { phase: "hint", spot: null };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
function readDue(): Due {
  if (due) return due;
  try { const v = localStorage.getItem(KEY); due = v === "pending" || v === "done" ? v : "none"; } catch { due = "none"; }
  return due;
}
function writeDue(next: Due) {
  due = next;
  try { localStorage.setItem(KEY, next); } catch { /* this session only */ }
  notify();
}
/** The guide's state for the HUD: due or not, and the try's phase and spot (published by the world's GlideGuide). */
export const glideGuideDue = (): Due => readDue();
export const glideGuideView = () => view;
export function subscribeGlideGuide(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function setGlideGuideView(next: { phase: GuidePhase; spot: GlideSpot | null }) { view = next; notify(); }
/** A guided landing, or "Skip": the guide is done for good on this device. */
export const finishGlideGuide = () => writeDue("done");
if (typeof window !== "undefined") {
  // The first leaf glider made at the workbench (Workshop): the guide is due when you're next out on the island.
  window.addEventListener("tsi:crafted", e => { if ((e as CustomEvent<{ id?: string }>).detail?.id === "glider-leaf" && readDue() === "none") writeDue("pending"); });
}
