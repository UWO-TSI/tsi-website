import type { Grade } from "./grading";
import { ISLAND_PHASES, type IslandPhase } from "./islandTime";
import type { EnvPhaseSpec } from "./envLight";
import { TUNING_DEFAULTS } from "./tuning";
import { Color } from "three";
import type { IslandWeather } from "./islandWeather";
import { leanHue, leanWater, type SeasonLook } from "./seasonalLook";
import { CURRENT, lookToLight, type LookPreset, type PhaseBase } from "./lookPreset";
import { phaseInstant, solarPosition, type SunAngles } from "./sunPath";

/**
 * Member and applicant island lighting. The look (sun, fill, sky, fog, grade,
 * shadows) comes from one preset, `CURRENT` in lookPreset.ts (ledger row 236,
 * specs/look-development.md §5); a phase is that preset times its
 * `PHASE_LOOK` multipliers. This file keeps what is not look: the water
 * palette per phase, the lamps, and the weather and season layers.
 */
export const ISLAND_TERRAIN = { grass: "#91b47f", soil: "#e6c69b", sand: "#f5e6c7" };
const water = {
  ...TUNING_DEFAULTS.water,
  deepColor: 0x398d9f, midColor: 0x78bdbe, shallowColor: 0xc4ddd0, bedColor: 0xf0e2c6,
  foamWidth: 0.2, foamStrength: 0.42, foamSoft: 0.17, foamWave: 0.07, foamWaveSpeed: 0.85,
  blobScale: 1.35, blobDarken: 0.96, blobSpeed: 0.16, ringWidth: 0.12, ringStrength: 0.035,
  // The real sun on the water (row 238, look spec §7.4): a glare sheet from the ripples too small to
  // draw (roughness = their RMS slope on a calm day, Cox-Munk) and the sparkle sprites (GridOcean), each
  // a facet that flashes while the sun's disc (sunSize = its radius, degrees) sits in its mirror direction.
  glare: 0.2, roughness: 0.11, sunGlint: 2, sunSize: 5, rippleStrength: 0.12,
};
export type IslandWater = typeof water;

/**
 * Interiors (HQ, café, museum, homes): the outdoor sun's warm colour as the
 * key, carrying most of the light (§5.5), over a lower neutral fill; lamp
 * pools stay warm. AO and the grade come from the look through PostFX.
 */
const HQ_DAY = { keyColor: CURRENT.light.sunColor, ambient: 0.32, hemisphere: 0.36, key: 1.5, ceiling: 16, lamp: 9, desk: 4, grade: { ...CURRENT.grade, exposure: 1.1, warmth: 0.2, vignette: 0.13 } };
export const CLUBHOUSE_LIGHTING: Record<IslandPhase, typeof HQ_DAY> = {
  dawn: { ...HQ_DAY, ambient: 0.3, hemisphere: 0.34, key: 1.2, ceiling: 16, lamp: 11, desk: 4.5, grade: { ...HQ_DAY.grade, warmth: 0.22, vignette: 0.15 } },
  day: HQ_DAY,
  evening: { ...HQ_DAY, ambient: 0.26, hemisphere: 0.3, key: 1.0, ceiling: 15, lamp: 12, desk: 5, grade: { ...HQ_DAY.grade, warmth: 0.26, vignette: 0.17 } },
  night: { ...HQ_DAY, ambient: 0.24, hemisphere: 0.28, key: 0.7, ceiling: 15, lamp: 13, desk: 5.5, grade: { ...HQ_DAY.grade, warmth: 0.22, vignette: 0.18 } },
};

export interface IslandLight {
  sky: string; sun: string; sunIntensity: number; sunPosition: [number, number, number];
  fill: string; bounce: string; ambient: number; hemisphere: number;
  fogNear: number; fogFar: number; fogColor: string; environment: EnvPhaseSpec; grade: Grade;
  water: IslandWater;
  /** Porch light strength (also dimly on by day). */
  lamp: number;
  /** Street lamps and window spill lights on. */
  lampsOn: boolean;
  /** HQ window emission. */
  windowGlow: number;
  /** Fireflies out (evening/night only). */
  fireflies: boolean;
  /** Cast-shadow PCF radius, opacity and tint (the contact shadows take the tint). */
  shadow: { radius: number; intensity: number; tint: string };
  rim?: { color: string; intensity: number };
  /** Screen-space sky gradient from this colour down to `sky`; absent = flat `sky`. */
  skyTop?: string;
}

/** Per phase: the water palette and the lamps (look values come from the preset). */
const PHASE_BASE: Record<IslandPhase, PhaseBase> = {
  dawn: {
    water: { ...water, deepColor: 0x4a7d93, midColor: 0x7ea9b3, shallowColor: 0xb7c9c6, glare: 0.18, sunGlint: 1.8 },
    lamp: 2, lampsOn: true, windowGlow: 0.8, fireflies: false,
  },
  day: { water, lamp: 0.6, lampsOn: false, windowGlow: 0.3, fireflies: false },
  evening: {
    water: { ...water, deepColor: 0x426f87, midColor: 0x649ca7, shallowColor: 0x95b7b1, glare: 0.25, sunGlint: 2.2 },
    lamp: 4, lampsOn: true, windowGlow: 1.15, fireflies: true,
  },
  night: {
    water: { ...water, deepColor: 0x152943, midColor: 0x284c67, shallowColor: 0x516e81, bedColor: 0x394b59, foamColor: 0x8babc2, ringColor: 0x7493aa, glare: 0.06, sunGlint: 0.4 },
    lamp: 6, lampsOn: true, windowGlow: 1.6, fireflies: true,
  },
};

/** A look preset at a phase of the day, lit by the real sun (compass angles; null keeps the preset's key). */
export function islandLight(look: LookPreset, phase: IslandPhase, sun: SunAngles | null = null): IslandLight {
  return lookToLight(look, PHASE_BASE[phase], phase, sun);
}

/** The day David picked the look (row 236). Its 11:45 sun is the picked key light, within 3.5° (row 239). */
const LOOK_DAY = new Date("2026-09-27T16:00:00Z");
/** Each phase under the real sun at its preview time on LOOK_DAY (the applicant island's grade and the tests). */
export const ISLAND_LIGHTING = Object.fromEntries(ISLAND_PHASES.map(phase =>
  [phase, islandLight(CURRENT, phase, solarPosition(phaseInstant(phase, LOOK_DAY)))])) as Record<IslandPhase, IslandLight>;

/**
 * Weather layered on a time-of-day profile (§5.5): less sun and more fill (a
 * lower key:fill), softer and lighter shadows, thicker haze. Sky colours keep
 * part of their saturation so a wet day is soft, never grey-flat. Colours
 * are desaturated in place so night stays night.
 *
 * The water mirrors the sun's disc (look spec §7.4): gone behind rain, snow
 * and fog cloud (`glare` 0 takes the sheet and the sparkles), and wind
 * roughens the ripples (Cox-Munk: RMS slope about 1.6× a calm day's at the
 * 30 km/h windy line), spreading the same light wider, so the sheet's peak
 * falls by the square.
 */
const WEATHER_MOD: Record<IslandWeather, { desat: number; dim: number; sun: number; fill: number; fog: number; shadowRadius: number; shadowIntensity: number; grade: number; glare: number; roughness: number }> = {
  clear: { desat: 0, dim: 1, sun: 1, fill: 1, fog: 1, shadowRadius: 1, shadowIntensity: 1, grade: 0, glare: 1, roughness: 1 },
  rain: { desat: 0.45, dim: 0.9, sun: 0.45, fill: 1.3, fog: 0.75, shadowRadius: 3, shadowIntensity: 0.5, grade: 0.08, glare: 0, roughness: 1 },
  snow: { desat: 0.45, dim: 1.08, sun: 0.6, fill: 1.3, fog: 0.7, shadowRadius: 2.5, shadowIntensity: 0.65, grade: 0.05, glare: 0, roughness: 1 },
  fog: { desat: 0.45, dim: 1.02, sun: 0.6, fill: 1.25, fog: 0.4, shadowRadius: 2.5, shadowIntensity: 0.6, grade: 0.06, glare: 0, roughness: 1 },
  wind: { desat: 0.05, dim: 1, sun: 0.95, fill: 1, fog: 0.95, shadowRadius: 1, shadowIntensity: 1, grade: 0, glare: 1, roughness: 1.6 },
};

function soften(hex: string, desat: number, dim: number): string {
  const color = new Color(hex), hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  return `#${color.setHSL(hsl.h, hsl.s * (1 - desat), Math.min(1, hsl.l * dim)).getHexString()}`;
}

export function withWeather(light: IslandLight, weather: IslandWeather): IslandLight {
  if (weather === "clear") return light;
  const m = WEATHER_MOD[weather];
  const sky = soften(light.sky, m.desat, m.dim);
  return {
    ...light,
    sky,
    ...(light.skyTop && { skyTop: soften(light.skyTop, m.desat, m.dim) }),
    fogColor: soften(light.fogColor, m.desat, m.dim),
    sun: soften(light.sun, m.desat * 0.7, 1),
    sunIntensity: light.sunIntensity * m.sun,
    fill: soften(light.fill, m.desat * 0.5, 1),
    ambient: light.ambient * m.fill,
    hemisphere: light.hemisphere * m.fill,
    fogNear: light.fogNear * m.fog,
    fogFar: light.fogFar * Math.max(m.fog, 0.55),
    environment: { ...light.environment, skyBottom: sky, intensity: light.environment.intensity * m.fill },
    grade: { ...light.grade, desat: light.grade.desat + m.grade },
    water: { ...light.water, glare: light.water.glare * m.glare / m.roughness ** 2, sunGlint: light.water.sunGlint * m.glare, roughness: light.water.roughness * m.roughness },
    shadow: { ...light.shadow, radius: light.shadow.radius * m.shadowRadius, intensity: light.shadow.intensity * m.shadowIntensity },
  };
}

/**
 * Season layered on a time-of-day profile: sky and fog lean toward the
 * season's hue (lightness kept, so night stays night), water toward its tint.
 */
export function withSeason(light: IslandLight, look: SeasonLook): IslandLight {
  const sky = leanHue(light.sky, look.sky, 0.25);
  return {
    ...light,
    sky,
    fogColor: leanHue(light.fogColor, look.sky, 0.25),
    environment: { ...light.environment, skyBottom: leanHue(light.environment.skyBottom, look.sky, 0.25) },
    water: {
      ...light.water,
      deepColor: leanWater(light.water.deepColor, look.water, 0.2),
      midColor: leanWater(light.water.midColor, look.water, 0.15),
    },
  };
}

/** Fireflies every clear night, all year; off only in rain and snow (David, 2026-09-24). */
export function fireflyNight(light: IslandLight, weather: IslandWeather): boolean {
  return light.fireflies && weather !== "rain" && weather !== "snow";
}
