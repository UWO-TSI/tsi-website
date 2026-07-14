/**
 * Organic coastline (David 2026-07-14: "island should not be just a
 * circle"). The island silhouette is a radial harmonic wobble:
 *
 *   R(θ) = 52 + Σ aₖ·sin(kθ)
 *
 * Zero-phase INTEGER harmonics on purpose: sin(k·0) = sin(k·π) = 0, so
 * the wobble vanishes exactly at due east and due west — the river
 * mouths + waterfalls at x = ±52.4 keep their coastline.
 *
 * Everything that used radial distance against the old circle now uses
 * coastDist(x, z) = |xz| − wobble(θ): an "effective distance" in a space
 * where the coast is a 52-circle again, so every existing threshold
 * (sand 48.5, sink 49.5, waterline ≈51.4) keeps working unchanged.
 *
 * The Ocean shader carries the same harmonics in GLSL (COAST_GLSL) —
 * keep the constants in sync by editing HARMONICS only.
 */

export const COAST_BASE = 52;

// [harmonic k, amplitude]
const HARMONICS: [number, number][] = [
  [2, 2.4],
  [3, 1.7],
  [5, 1.1],
  [8, 0.6],
];

/** Radial offset of the coastline at the angle of (x, z). Range ≈ ±4. */
export function coastWobble(x: number, z: number): number {
  const a = Math.atan2(z, x);
  let w = 0;
  for (let i = 0; i < HARMONICS.length; i++) {
    w += HARMONICS[i][1] * Math.sin(HARMONICS[i][0] * a);
  }
  return w;
}

/** Distance from origin in coast-space: the coast sits at COAST_BASE. */
export function coastDist(x: number, z: number): number {
  return Math.hypot(x, z) - coastWobble(x, z);
}

/**
 * Clamp a point so coastDist(point) ≤ limit, preserving its angle.
 * Radial scaling keeps θ (and therefore the wobble) unchanged, so one
 * pass is exact. Returns [x, z].
 */
export function clampToCoast(x: number, z: number, limit: number): [number, number] {
  const d = Math.hypot(x, z);
  if (d < 1e-6) return [x, z];
  const max = limit + coastWobble(x, z);
  if (d <= max) return [x, z];
  const f = max / d;
  return [x * f, z * f];
}

/**
 * Beach WIDTH variation (iteration 2): shifts where the sand color
 * begins, per angle — wide sandy sweeps on some stretches, grassy banks
 * that run nearly to the water on others. Purely cosmetic (color bands
 * in the ground mesh); the waterline itself stays rimSink-defined.
 */
export function beachWidthShift(x: number, z: number): number {
  const a = Math.atan2(z, x);
  return 1.1 * Math.sin(4 * a + 0.9) + 0.7 * Math.sin(6 * a + 2.6);
}

// Rim-sink profile (mirrors the ground mesh in GameWorld's Terrain —
// keep in sync): past SINK_START the beach dives below the ocean.
const SINK_START = 49.5;
const SINK_END = 56;
const SINK_DEPTH = 2.4;

/** How far the beach has sunk at coast-distance e (≥ 0). */
export function rimSink(e: number): number {
  if (e <= SINK_START) return 0;
  const t = Math.min((e - SINK_START) / (SINK_END - SINK_START), 1);
  return t * t * (3 - 2 * t) * SINK_DEPTH;
}

/** The same wobble as a GLSL function (vec2 p in world XZ). */
export const COAST_GLSL = `
float coastWobble(vec2 p) {
  float a = atan(p.y, p.x);
  return ${HARMONICS.map(([k, amp]) => `${amp.toFixed(2)} * sin(${k.toFixed(1)} * a)`).join(" + ")};
}
`;
