import { DEFAULT_GRADE, type Grade } from "./grading";
import type { ApplicantDayPhase } from "./applicantTime";
import type { EnvPhaseSpec } from "./envLight";
import { TUNING_DEFAULTS } from "./tuning";

// Artistic calibration, not sampled Nintendo engine values. See specs/lighting-research.md.
export const APPLICANT_TERRAIN = { grass: "#91b47f", soil: "#e6c69b", sand: "#f5e6c7" };
const grade: Grade = { ...DEFAULT_GRADE, desat: 0.035, warmth: 0.18, lift: 0.25, vignette: 0.1 };
const water = {
  ...TUNING_DEFAULTS.water,
  deepColor: 0x398d9f, midColor: 0x78bdbe, shallowColor: 0xc4ddd0, bedColor: 0xf0e2c6,
  foamWidth: 0.2, foamStrength: 0.42, foamSoft: 0.17, foamWave: 0.07, foamWaveSpeed: 0.85,
  blobScale: 1.35, blobDarken: 0.96, blobSpeed: 0.16, ringWidth: 0.12, ringStrength: 0.035,
  glare: 0.2, sunGlint: 0.7, sparkle: 0.45, rippleStrength: 0.12,
};

// Warm, motivated pools sit above a readable neutral/cool room fill.
export const APPLICANT_HQ_LIGHTING = {
  day: { ambient: 0.55, hemisphere: 0.55, key: 0.7, ceiling: 18, lamp: 9, desk: 4, grade: { ...grade, warmth: 0.2, vignette: 0.13 } },
  evening: { ambient: 0.4, hemisphere: 0.45, key: 0.5, ceiling: 16, lamp: 12, desk: 5, grade: { ...grade, warmth: 0.26, vignette: 0.17 } },
  night: { ambient: 0.35, hemisphere: 0.4, key: 0.45, ceiling: 15, lamp: 13, desk: 5.5, grade: { ...grade, warmth: 0.22, vignette: 0.18 } },
};

interface IslandLight {
  sky: string; sun: string; sunIntensity: number; sunPosition: [number, number, number];
  fill: string; bounce: string; ambient: number; hemisphere: number;
  fogNear: number; fogFar: number; environment: EnvPhaseSpec; grade: Grade;
  water: typeof water; lamp: number;
}

export const APPLICANT_LIGHTING: Record<ApplicantDayPhase, IslandLight> = {
  day: {
    sky: "#c7e0df", sun: "#fff5df", sunIntensity: 2.8, sunPosition: [-12, 24, -14],
    fill: "#c4deef", bounce: "#a7b68a", ambient: 0.22, hemisphere: 0.72,
    fogNear: 22, fogFar: 70,
    environment: { skyTop: "#a3d3e7", skyBottom: "#c7e0df", sun: "#fff5df", ground: "#a7b68a", intensity: 0.38, sunElev: 0.6 },
    grade, water, lamp: 0.6,
  },
  evening: {
    sky: "#ddd5cc", sun: "#ffddb1", sunIntensity: 2.55, sunPosition: [-22, 16, -12],
    fill: "#c0cce7", bounce: "#a7aa85", ambient: 0.22, hemisphere: 0.72,
    fogNear: 20, fogFar: 64,
    environment: { skyTop: "#aebcd6", skyBottom: "#ddd5cc", sun: "#ffddb1", ground: "#a7aa85", intensity: 0.4, sunElev: 0.25 },
    grade: { ...grade, warmth: 0.3, lift: 0.3 },
    water: { ...water, deepColor: 0x426f87, midColor: 0x649ca7, shallowColor: 0x95b7b1, glare: 0.18, sunGlint: 0.65 },
    lamp: 4,
  },
  night: {
    sky: "#344963", sun: "#bbcbea", sunIntensity: 0.95, sunPosition: [-12, 20, -14],
    fill: "#97b2d9", bounce: "#53684f", ambient: 0.17, hemisphere: 0.35,
    fogNear: 18, fogFar: 59,
    environment: { skyTop: "#283b5c", skyBottom: "#536d88", sun: "#bbcbea", ground: "#53684f", intensity: 0.3, sunElev: 0.4 },
    grade: { ...grade, warmth: 0, desat: 0.06, lift: 0.2 },
    water: { ...water, deepColor: 0x152943, midColor: 0x284c67, shallowColor: 0x516e81, bedColor: 0x394b59, foamColor: 0x8babc2, ringColor: 0x7493aa, glare: 0.08, sunGlint: 0.25 },
    lamp: 6,
  },
};
