/**
 * Low health, felt in the world (David's r4 review: "the screen should get subtle vingette and when its really low the
 * heart pulses and the screen gets less saturaed"). One rule for the HUD and the grade: under HURT_FROM the screen's
 * edges darken toward red, growing as health falls; at CRITICAL and under, the health bar flashes, its heart beats
 * (HudBars) and the colour drains a little (PostFX's grade pass, no pass of its own).
 */

/** At or under this share of health it's critical: the bar flashes, the heart beats, the colour drains. */
export const CRITICAL = 0.25;
/** The vignette starts as health falls under this share. */
export const HURT_FROM = 0.6;
/** The most the vignette and the drain ever reach (at empty): subtle, the world stays readable. */
export const VIGNETTE_MAX = 0.8, DRAIN_MAX = 0.7;

/** How hurt the screen looks at a health share (0 to 1): the vignette's strength and the colour drained, both 0 when well. */
export function hurtLook(health: number): { vignette: number; drain: number } {
  const h = Math.max(0, Math.min(1, health));
  return {
    vignette: h >= HURT_FROM ? 0 : VIGNETTE_MAX * (1 - h / HURT_FROM),
    drain: h > CRITICAL ? 0 : DRAIN_MAX * (1 - h / CRITICAL),
  };
}
