/**
 * Quality tiers (ledger rows 145, 147). Stored as the existing `liteMode` setting; chosen for the device by the first
 * settled frames (below) or by the player.
 *
 * Lite (the weaker laptops: 30+ FPS on integrated graphics with 24 players near, specs/perf/2026-10-v1-results.md)
 * turns off, against High:
 * - the sun's shadow maps (contact and sun-directed shadows only) and the ambient occlusion;
 * - bloom, tilt-shift and FXAA (the colour grade stays);
 * - the sky dome (the flat gradient), the cloud shadows and the seasonal leaf fall;
 * - wind: the trees and the flowing grass stand still;
 * - half the water's glints, 8 fireflies (High: two a bush), lighter fog banks, fewer critters;
 * - other players: 8 at full detail and 16 drawn (High: 12 and 24);
 * - the flowing grass thins with distance (all within 30 u of the camera, a quarter past 45 u: GrassTufts THIN);
 * - without the pixel finish, the canvas at most 1 device pixel per CSS pixel (High: up to 1.5).
 * High: cached shadow maps, AO, bloom, wind sway, full ambient life, FXAA in smooth mode.
 */
export type QualityTier = "light" | "high";

/**
 * A canvas's pixel ratio for the tier: as asked on High; on Lite never past 1 device pixel per CSS pixel (a pixel
 * finish's 0.5 stays). Every game canvas reads it: the island, the creators, the arrival's reflection.
 */
export function tierDpr(liteMode: boolean, dpr: number | [number, number]): number | [number, number] {
  if (!liteMode) return dpr;
  return Array.isArray(dpr) ? [Math.min(dpr[0], 1), 1] : Math.min(dpr, 1);
}
/** Below ~40 FPS during the first settled frames, start in Light. */
export const LIGHT_FRAME_MS = 25;
export const PROBE_FRAMES = 90;
/** Frames skipped after assets settle (shader compiles, shadow bake). */
export const PROBE_WARMUP = 30;

/** Median frame time of the probe window; robust to one-off hitches. */
export function medianFrameMs(samples: readonly number[]): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function tierForFrameMs(ms: number): QualityTier {
  return ms > LIGHT_FRAME_MS ? "light" : "high";
}
