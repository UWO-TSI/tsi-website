/**
 * Organic coastline v2 (David 2026-07-14: "more dramatic", "doesn't look
 * like a cove"). The island silhouette is a radial function of angle:
 *
 *   R(θ) = 52 + [ Σ aₖ·sin(kθ)  +  Σ gaussians ] × mouthMasks
 *
 * - Harmonics: big organic lobes/bays (±~4.5).
 * - Gaussians: a deliberate BAY bitten in at the wood deck's angle with
 *   two headland arms framing it — the cove now reads concave, palms on
 *   the arms, camp on the inner sand (coords solved in coast_solver.py).
 * - Mouth masks: multiplicative (1 − gaussian) pinned on the two river
 *   mouths so the waterfalls keep their exact coastline.
 *
 * coastDist(x,z) = |xz| − wobble: distance in a space where the coast is
 * a 52-circle again — every legacy threshold (sand 48.5 / sink 49.5 /
 * waterline ≈51.4) keeps working. The Ocean + ground shaders carry the
 * same math via COAST_GLSL — edit the tables here only.
 */

export const COAST_BASE = 52;

// [harmonic k, amplitude]
const HARMONICS: [number, number][] = [
  [2, 3.4],
  [3, 2.4],
  [5, 1.4],
  [8, 0.7],
];

// [center angle, sigma, amplitude] — cove bay + framing headlands
const GAUSSIANS: [number, number, number][] = [
  [1.16, 0.13, -2.4],
  [0.8, 0.1, 2.8],
  [1.54, 0.1, 2.8],
];

// [center angle, sigma] — river mouths (east θ≈0.055, west θ≈3.093)
const MASKS: [number, number][] = [
  [0.055, 0.16],
  [3.093, 0.16],
];

/** Radial offset of the coastline at the angle of (x, z). Range ≈ ±7. */
export function coastWobble(x: number, z: number): number {
  const a = Math.atan2(z, x);
  let w = 0;
  for (let i = 0; i < HARMONICS.length; i++) {
    w += HARMONICS[i][1] * Math.sin(HARMONICS[i][0] * a);
  }
  for (let i = 0; i < GAUSSIANS.length; i++) {
    const t = (a - GAUSSIANS[i][0]) / GAUSSIANS[i][1];
    w += GAUSSIANS[i][2] * Math.exp(-t * t);
  }
  for (let i = 0; i < MASKS.length; i++) {
    const t = (a - MASKS[i][0]) / MASKS[i][1];
    w *= 1 - Math.exp(-t * t);
  }
  return w;
}

/** Distance from origin in coast-space: the coast sits at COAST_BASE. */
export function coastDist(x: number, z: number): number {
  return Math.hypot(x, z) - coastWobble(x, z);
}

/**
 * Beach WIDTH variation: shifts where the sand color begins, per angle —
 * wide sandy sweeps on some stretches, grassy banks that run nearly to
 * the water on others. Purely cosmetic (color bands in the ground mesh);
 * the waterline itself stays rimSink-defined.
 */
export function beachWidthShift(x: number, z: number): number {
  const a = Math.atan2(z, x);
  return 1.1 * Math.sin(4 * a + 0.9) + 0.7 * Math.sin(6 * a + 2.6);
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
  float w = ${HARMONICS.map(([k, amp]) => `${amp.toFixed(2)} * sin(${k.toFixed(1)} * a)`).join(" + ")};
  ${GAUSSIANS.map(([c, s, amp], i) => `float g${i} = (a - ${c.toFixed(3)}) / ${s.toFixed(3)};
  w += ${amp.toFixed(2)} * exp(-g${i} * g${i});`).join("\n  ")}
  ${MASKS.map(([c, s], i) => `float m${i} = (a - ${c.toFixed(3)}) / ${s.toFixed(3)};
  w *= 1.0 - exp(-m${i} * m${i});`).join("\n  ")}
  return w;
}
`;
