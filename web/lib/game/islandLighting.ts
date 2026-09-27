import { DEFAULT_GRADE, type Grade } from "./grading";
import type { IslandPhase } from "./islandTime";
import type { EnvPhaseSpec } from "./envLight";
import { TUNING_DEFAULTS } from "./tuning";
import { Color } from "three";
import type { IslandWeather } from "./islandWeather";
import { leanHue, leanWater, type SeasonLook } from "./seasonalLook";

/**
 * Member island lighting profiles. Day/evening/night and the clubhouse values
 * are ported unchanged from the applicant island shipped on main
 * (`web/lib/game/applicantLighting.ts`, specs/applicant-lighting-2026-09-16.md).
 * Dawn is new (ledger row 157). Artistic calibration, not Nintendo values.
 */
export const ISLAND_TERRAIN = { grass: "#91b47f", soil: "#e6c69b", sand: "#f5e6c7" };
const grade: Grade = { ...DEFAULT_GRADE, desat: 0.035, warmth: 0.18, lift: 0.25, vignette: 0.1 };
const water = {
  ...TUNING_DEFAULTS.water,
  deepColor: 0x398d9f, midColor: 0x78bdbe, shallowColor: 0xc4ddd0, bedColor: 0xf0e2c6,
  foamWidth: 0.2, foamStrength: 0.42, foamSoft: 0.17, foamWave: 0.07, foamWaveSpeed: 0.85,
  blobScale: 1.35, blobDarken: 0.96, blobSpeed: 0.16, ringWidth: 0.12, ringStrength: 0.035,
  glare: 0.2, sunGlint: 0.7, sparkle: 0.45, rippleStrength: 0.12,
};
export type IslandWater = typeof water;
/** Cast-shadow PCF radius and opacity as shipped (IslandAtmosphere). */
export const DEFAULT_SHADOW = { radius: 3, intensity: 0.85 };

// Warm, motivated pools sit above a readable neutral/cool room fill.
const HQ_DAY = { ambient: 0.55, hemisphere: 0.55, key: 0.7, ceiling: 18, lamp: 9, desk: 4, grade: { ...grade, warmth: 0.2, vignette: 0.13 } };
export const CLUBHOUSE_LIGHTING: Record<IslandPhase, typeof HQ_DAY> = {
  dawn: { ambient: 0.48, hemisphere: 0.5, key: 0.6, ceiling: 17, lamp: 11, desk: 4.5, grade: { ...grade, warmth: 0.22, vignette: 0.15 } },
  day: HQ_DAY,
  evening: { ambient: 0.4, hemisphere: 0.45, key: 0.5, ceiling: 16, lamp: 12, desk: 5, grade: { ...grade, warmth: 0.26, vignette: 0.17 } },
  night: { ambient: 0.35, hemisphere: 0.4, key: 0.45, ceiling: 15, lamp: 13, desk: 5.5, grade: { ...grade, warmth: 0.22, vignette: 0.18 } },
};

export interface IslandLight {
  sky: string; sun: string; sunIntensity: number; sunPosition: [number, number, number];
  fill: string; bounce: string; ambient: number; hemisphere: number;
  fogNear: number; fogFar: number; environment: EnvPhaseSpec; grade: Grade;
  water: IslandWater;
  /** Porch light strength (as shipped: also dimly on by day). */
  lamp: number;
  /** Street lamps and window spill lights on. */
  lampsOn: boolean;
  /** HQ window emission. */
  windowGlow: number;
  /** Fireflies out (evening/night only). */
  fireflies: boolean;
  /** Look lab (lookPreset.ts); absent = as shipped. */
  shadow?: { radius: number; intensity: number };
  rim?: { color: string; intensity: number };
  /** Screen-space sky gradient from this colour down to `sky`; absent = flat `sky`. */
  skyTop?: string;
  fogColor?: string;
}

export const ISLAND_LIGHTING: Record<IslandPhase, IslandLight> = {
  dawn: {
    // Low sun from the east (opposite the evening key), pink-lilac sky, lamps
    // still on at a lower level while the night fades.
    sky: "#dcd3dc", sun: "#ffdcc0", sunIntensity: 2.1, sunPosition: [22, 13, -10],
    fill: "#bfc7e6", bounce: "#9aa585", ambient: 0.21, hemisphere: 0.62,
    fogNear: 20, fogFar: 64,
    environment: { skyTop: "#a9b5d8", skyBottom: "#e6d2d2", sun: "#ffdcc0", ground: "#9aa585", intensity: 0.36, sunElev: 0.2 },
    grade: { ...grade, warmth: 0.24, desat: 0.045, lift: 0.28 },
    water: { ...water, deepColor: 0x4a7d93, midColor: 0x7ea9b3, shallowColor: 0xb7c9c6, glare: 0.16, sunGlint: 0.55 },
    lamp: 2, lampsOn: true, windowGlow: 0.8, fireflies: false,
  },
  day: {
    sky: "#c7e0df", sun: "#fff5df", sunIntensity: 2.8, sunPosition: [-12, 24, -14],
    fill: "#c4deef", bounce: "#a7b68a", ambient: 0.22, hemisphere: 0.72,
    fogNear: 22, fogFar: 70,
    environment: { skyTop: "#a3d3e7", skyBottom: "#c7e0df", sun: "#fff5df", ground: "#a7b68a", intensity: 0.38, sunElev: 0.6 },
    grade, water, lamp: 0.6, lampsOn: false, windowGlow: 0.3, fireflies: false,
  },
  evening: {
    sky: "#ddd5cc", sun: "#ffddb1", sunIntensity: 2.55, sunPosition: [-22, 16, -12],
    fill: "#c0cce7", bounce: "#a7aa85", ambient: 0.22, hemisphere: 0.72,
    fogNear: 20, fogFar: 64,
    environment: { skyTop: "#aebcd6", skyBottom: "#ddd5cc", sun: "#ffddb1", ground: "#a7aa85", intensity: 0.4, sunElev: 0.25 },
    grade: { ...grade, warmth: 0.3, lift: 0.3 },
    water: { ...water, deepColor: 0x426f87, midColor: 0x649ca7, shallowColor: 0x95b7b1, glare: 0.18, sunGlint: 0.65 },
    lamp: 4, lampsOn: true, windowGlow: 1.15, fireflies: true,
  },
  night: {
    sky: "#344963", sun: "#bbcbea", sunIntensity: 0.95, sunPosition: [-12, 20, -14],
    fill: "#97b2d9", bounce: "#53684f", ambient: 0.17, hemisphere: 0.35,
    fogNear: 18, fogFar: 59,
    environment: { skyTop: "#283b5c", skyBottom: "#536d88", sun: "#bbcbea", ground: "#53684f", intensity: 0.3, sunElev: 0.4 },
    grade: { ...grade, warmth: 0, desat: 0.06, lift: 0.2 },
    water: { ...water, deepColor: 0x152943, midColor: 0x284c67, shallowColor: 0x516e81, bedColor: 0x394b59, foamColor: 0x8babc2, ringColor: 0x7493aa, glare: 0.08, sunGlint: 0.25 },
    lamp: 6, lampsOn: true, windowGlow: 1.6, fireflies: true,
  },
};

/** envLight.ts keys its built-in palettes dawn/day/dusk/night. */
export const ENV_KEY: Record<IslandPhase, "dawn" | "day" | "dusk" | "night"> = { dawn: "dawn", day: "day", evening: "dusk", night: "night" };

/**
 * Weather layered on a time-of-day profile. Only rain has its own effect so
 * far (RainFX); snow, fog and wind are stubs that change light and haze.
 * Colors are desaturated in place so night stays night.
 */
const WEATHER_MOD: Record<IslandWeather, { desat: number; dim: number; sun: number; fog: number; ambient: number; grade: number; glare: number }> = {
  clear: { desat: 0, dim: 1, sun: 1, fog: 1, ambient: 0, grade: 0, glare: 1 },
  rain: { desat: 0.6, dim: 0.9, sun: 0.45, fog: 0.75, ambient: 0.08, grade: 0.08, glare: 0.4 },
  snow: { desat: 0.7, dim: 1.08, sun: 0.6, fog: 0.7, ambient: 0.1, grade: 0.06, glare: 0.6 },
  fog: { desat: 0.55, dim: 1.02, sun: 0.6, fog: 0.4, ambient: 0.06, grade: 0.05, glare: 0.5 },
  wind: { desat: 0.1, dim: 1, sun: 0.95, fog: 0.95, ambient: 0, grade: 0.01, glare: 1.1 },
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
    ...(light.fogColor && { fogColor: soften(light.fogColor, m.desat, m.dim) }),
    sun: soften(light.sun, m.desat * 0.7, 1),
    sunIntensity: light.sunIntensity * m.sun,
    fill: soften(light.fill, m.desat * 0.5, 1),
    ambient: light.ambient + m.ambient,
    fogNear: light.fogNear * m.fog,
    fogFar: light.fogFar * Math.max(m.fog, 0.55),
    environment: { ...light.environment, skyBottom: sky, intensity: light.environment.intensity * (0.5 + m.sun / 2) },
    grade: { ...light.grade, desat: light.grade.desat + m.grade },
    water: { ...light.water, glare: light.water.glare * m.glare, sunGlint: light.water.sunGlint * m.glare },
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
    ...(light.fogColor && { fogColor: leanHue(light.fogColor, look.sky, 0.25) }),
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
