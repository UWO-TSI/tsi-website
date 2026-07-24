/**
 * Color grading (David ask, 2026-07-23).
 *
 * One Grade = the full post-look of the game: exposure (tone mapping),
 * contrast, vibrance (BSL-style sat-weighted boost), the pastel desat/
 * warmth/black-lift trio, and vignette darkness. The game reads a grade
 * PER WEATHER from WEATHER_GRADES; /lab/world exposes every field as a
 * slider and saves drafts per weather (localStorage) — when David likes
 * one, its JSON gets baked here. DEFAULT_GRADE reproduces the shipped
 * 2026-07-14 pastel look exactly (contrast 1 / vibrance 0 are identity).
 */

import type { Weather } from "./weather";

export interface Grade {
  exposure: number; // gl.toneMappingExposure (1 = shipped)
  contrast: number; // pivot 0.5 (1 = identity)
  vibrance: number; // sat-weighted saturation boost (-0.5..0.5, 0 = identity)
  desat: number; // pastel wash toward luma (shipped 0.14)
  warmth: number; // scales the warm-cast deviation (1 = shipped)
  lift: number; // scales the black lift (1 = shipped)
  vignette: number; // vignette darkness (shipped 0.4)
}

export const DEFAULT_GRADE: Grade = {
  exposure: 1,
  contrast: 1,
  vibrance: 0,
  desat: 0.14,
  warmth: 1,
  lift: 1,
  vignette: 0.4,
};

/**
 * Per-weather grades. All three start at the shipped default — David
 * tunes in /lab/world (Save for <weather> → Export JSON) and the winning
 * values get pasted here.
 */
export const WEATHER_GRADES: Record<Weather, Grade> = {
  sunny: { ...DEFAULT_GRADE },
  cloudy: { ...DEFAULT_GRADE },
  rain: { ...DEFAULT_GRADE },
};
