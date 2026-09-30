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
 * waterline ≈51.4) keeps working.
 */

// GEO S1 (David 2026-07-25): the island grows +18% — all coast-space
// thresholds stay in the legacy 52-basis; world positions are legacy ×
// COAST_SCALE. coastDist divides back so every consumer keeps working.
export const COAST_SCALE = 61 / 52;

// [harmonic k, amplitude] — S1 character pass: amplitudes +35% so the
// bigger island reads MORE irregular, not just larger (never oval).
const HARMONICS: [number, number][] = [
  [2, 4.6],
  [3, 3.3],
  [5, 1.9],
  [8, 0.9],
];

// [center angle, sigma, amplitude] — cove bay + framing headlands, plus
// the S1 NW INLET (a narrow deep bite with a small framing headland).
const GAUSSIANS: [number, number, number][] = [
  [1.16, 0.14, -3.2],
  [0.8, 0.1, 3.4],
  [1.54, 0.1, 3.4],
  [2.35, 0.09, -4.2],
  [2.62, 0.08, 1.6],
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

/** Distance from origin in coast-space (legacy 52-basis): the coast sits
 *  at 52 regardless of COAST_SCALE. */
export function coastDist(x: number, z: number): number {
  return Math.hypot(x, z) / COAST_SCALE - coastWobble(x, z);
}
