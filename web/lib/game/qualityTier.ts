/**
 * Quality tiers (ledger rows 145, 147). Light: contact and sun-directed shadows only (no shadow map), no wind sway,
 * fewer critters, colour grade kept but no FXAA/bloom. High: cached shadow maps, wind sway, full
 * ambient life, FXAA in smooth mode. Stored as the existing `liteMode` setting.
 */
export type QualityTier = "light" | "high";
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
