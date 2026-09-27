import { Color, ShaderChunk } from "three";
import type { Grade } from "./grading";
import type { IslandLight, IslandWater } from "./islandLighting";
import type { IslandPhase } from "./islandTime";

/**
 * Look presets (ledger rows 235-236, specs/look-development.md). One plain
 * JSON object carries every value that shapes the look: key/fill light,
 * shadows, AO, per-class materials, grass detail, grade, post and sky.
 * `lookToLight` maps it onto the game's `IslandLight` for a phase (so season
 * and weather still layer on top), `lookFx` onto PostFX, and LookMaterials
 * onto scene materials.
 *
 * `CURRENT` is the game's look: the "Open-air sun" direction David picked
 * (row 236), applied per §5. Dawn, golden hour and night are multipliers on
 * it (`PHASE_LOOK`), so editing this one object in /lab/look moves them all.
 * The other presets are the lab's starting directions, kept for comparison.
 */
export type MaterialClass = "terrain" | "props" | "foliage" | "water" | "characters";
export const MATERIAL_CLASSES: readonly MaterialClass[] = ["terrain", "props", "foliage", "water", "characters"];
export type ToneMap = "neutral" | "aces" | "agx";
/** Saturation and value scale the albedo; roughness scales roughness; gloss pulls it toward a toy-plastic 0.3 (water: sun glint). */
export interface ClassLook { saturation: number; value: number; roughness: number; gloss: number }

export interface LookPreset {
  id: string;
  name: string;
  light: {
    sunColor: string; sunIntensity: number; sunPosition: [number, number, number];
    fillSky: string; fillGround: string; hemisphere: number; ambient: number; envIntensity: number;
    rimColor: string; rimIntensity: number;
  };
  /** Radius = PCF softness; intensity = opacity; tint = colour leaked into full shadow (black = none). */
  shadows: { radius: number; intensity: number; tint: string };
  ao: { enabled: boolean; radius: number; intensity: number };
  materials: Record<MaterialClass, ClassLook>;
  /** Share of the grass texture's own contrast kept (0.38 = as shipped before row 236); hue = broad yellow/blue-green patches (0 = none). */
  grass: { detail: number; hue: number };
  grade: Grade;
  post: {
    toneMapping: ToneMap;
    bloom: { enabled: boolean; threshold: number; intensity: number };
    /** Blur 0-1 at the frame edges; taper = share of the frame the blur ramps over; offset moves the sharp line (+ = up). */
    tiltShift: { enabled: boolean; blur: number; taper: number; offset: number };
  };
  /** Gradient off = flat horizon-coloured background. */
  sky: { top: string; horizon: string; fog: string; fogNear: number; fogFar: number; gradient: boolean };
}

/** Rim/back light comes from the far side of the scene (the camera looks +z). */
export const RIM_POSITION: [number, number, number] = [0, 10, 24];
const GLOSS_ROUGHNESS = 0.3;
const SHIPPED_GRASS = { detail: 0.38, hue: 0 };

/**
 * The game's look: hard warm sun 3/4 from screen-left and a little toward the
 * camera (44° up, 61° off the camera axis, so shadows fall sideways into
 * view), blue sky fill at about 4:1, crisp cool shadows, AO, bloom on sunlit
 * whites, blue sky and air (§5 items 1-4). Neutral tone mapping at exposure
 * 1.5 instead of the picked preset's ACES 0.9: ACES could not lift bright
 * ground past L* 80 without washing the grass pale yellow
 * (specs/look-development-questions.md §10).
 */
export const CURRENT: LookPreset = {
  id: "current", name: "Current",
  light: {
    sunColor: "#ffe9c4", sunIntensity: 3.8, sunPosition: [20, 22, -11],
    fillSky: "#9cc8f0", fillGround: "#b5a77a", hemisphere: 0.58, ambient: 0.05, envIntensity: 0.13,
    rimColor: "#ffffff", rimIntensity: 0,
  },
  shadows: { radius: 1.5, intensity: 0.92, tint: "#2a4078" },
  ao: { enabled: true, radius: 1, intensity: 1.2 },
  materials: {
    terrain: { saturation: 1.05, value: 1, roughness: 1, gloss: 0 },
    props: { saturation: 1.08, value: 1, roughness: 1, gloss: 0.25 },
    foliage: { saturation: 1.1, value: 1.02, roughness: 1, gloss: 0 },
    water: { saturation: 1.25, value: 1, roughness: 1, gloss: 0.5 },
    characters: { saturation: 1.05, value: 1, roughness: 1, gloss: 0.25 },
  },
  grass: { detail: 0.8, hue: 0.5 },
  grade: { exposure: 1.5, contrast: 1, vibrance: 0, desat: -0.04, warmth: 0.15, lift: 0.2, vignette: 0.12 },
  post: {
    toneMapping: "neutral",
    bloom: { enabled: true, threshold: 0.65, intensity: 0.35 },
    tiltShift: { enabled: false, blur: 0.15, taper: 0.25, offset: 0 },
  },
  sky: { top: "#4a9de0", horizon: "#bfe0f2", fog: "#cde6f2", fogNear: 34, fogFar: 96, gradient: true },
};

/** Miniature photography: tilt-shift, glossy plastic, saturated, soft AO, a 3/4 key from screen-left. */
const TOY: LookPreset = {
  id: "toy", name: "Toy diorama",
  light: {
    sunColor: "#fff1d6", sunIntensity: 3.1, sunPosition: [18, 24, -10],
    fillSky: "#b9d8f2", fillGround: "#b8b48a", hemisphere: 0.5, ambient: 0.08, envIntensity: 0.3,
    rimColor: "#fff6e8", rimIntensity: 0.35,
  },
  shadows: { radius: 4, intensity: 0.9, tint: "#1a2440" },
  ao: { enabled: true, radius: 1.4, intensity: 2 },
  materials: {
    terrain: { saturation: 1, value: 0.97, roughness: 1, gloss: 0 },
    props: { saturation: 1.12, value: 1, roughness: 0.8, gloss: 0.5 },
    foliage: { saturation: 1.08, value: 1, roughness: 1, gloss: 0 },
    water: { saturation: 1.2, value: 1, roughness: 1, gloss: 0.3 },
    characters: { saturation: 1.1, value: 1, roughness: 1, gloss: 0.6 },
  },
  grass: SHIPPED_GRASS,
  grade: { exposure: 1, contrast: 1.06, vibrance: 0.12, desat: -0.04, warmth: 0.22, lift: 0.1, vignette: 0.28 },
  post: {
    toneMapping: "neutral",
    bloom: { enabled: true, threshold: 0.9, intensity: 0.3 },
    tiltShift: { enabled: true, blur: 0.08, taper: 0.3, offset: 0 },
  },
  sky: { top: "#6fb6ec", horizon: "#cfe8f4", fog: "#cfe8f4", fogNear: 26, fogFar: 80, gradient: true },
};

/** The direction as David picked it (row 236), before §5's tuning. */
const OPEN_AIR: LookPreset = {
  id: "open-air", name: "Open-air sun (as picked)",
  light: {
    sunColor: "#ffe9c4", sunIntensity: 3.5, sunPosition: [18, 24, -10],
    fillSky: "#9cc8f0", fillGround: "#b5a77a", hemisphere: 0.6, ambient: 0.05, envIntensity: 0.18,
    rimColor: "#ffffff", rimIntensity: 0,
  },
  shadows: { radius: 1.5, intensity: 0.92, tint: "#2a4078" },
  ao: { enabled: true, radius: 1, intensity: 1.2 },
  materials: {
    terrain: { saturation: 1.05, value: 1, roughness: 1, gloss: 0 },
    props: { saturation: 1.08, value: 1, roughness: 1, gloss: 0.15 },
    foliage: { saturation: 1.1, value: 1.02, roughness: 1, gloss: 0 },
    water: { saturation: 1.25, value: 1, roughness: 1, gloss: 0.5 },
    characters: { saturation: 1.05, value: 1, roughness: 1, gloss: 0.15 },
  },
  grass: SHIPPED_GRASS,
  grade: { exposure: 0.9, contrast: 1, vibrance: 0.12, desat: -0.04, warmth: 0.15, lift: 0.2, vignette: 0.12 },
  post: {
    toneMapping: "aces",
    bloom: { enabled: true, threshold: 0.85, intensity: 0.35 },
    tiltShift: { enabled: false, blur: 0.15, taper: 0.25, offset: 0 },
  },
  sky: { top: "#4a9de0", horizon: "#bfe0f2", fog: "#cde6f2", fogNear: 30, fogFar: 90, gradient: true },
};

/** Lower contrast but saturated: big soft coloured shadows, heavy aerial perspective, soft glow. */
const PAINTERLY: LookPreset = {
  id: "painterly", name: "Soft painterly",
  light: {
    sunColor: "#fff0d0", sunIntensity: 3, sunPosition: [16, 22, -12],
    fillSky: "#bcd6f0", fillGround: "#c8b890", hemisphere: 0.55, ambient: 0.08, envIntensity: 0.25,
    rimColor: "#ffe8c8", rimIntensity: 0.25,
  },
  shadows: { radius: 6, intensity: 0.85, tint: "#34508a" },
  ao: { enabled: true, radius: 2, intensity: 1 },
  materials: {
    terrain: { saturation: 1.05, value: 1, roughness: 1, gloss: 0 },
    props: { saturation: 1.1, value: 1.02, roughness: 1, gloss: 0 },
    foliage: { saturation: 1.1, value: 1.02, roughness: 1, gloss: 0 },
    water: { saturation: 1.15, value: 1.02, roughness: 1, gloss: 0 },
    characters: { saturation: 1.1, value: 1.02, roughness: 1, gloss: 0 },
  },
  grass: SHIPPED_GRASS,
  grade: { exposure: 1, contrast: 0.97, vibrance: 0.25, desat: -0.05, warmth: 0.3, lift: 0.25, vignette: 0.08 },
  post: {
    toneMapping: "neutral",
    bloom: { enabled: true, threshold: 0.7, intensity: 0.25 },
    tiltShift: { enabled: false, blur: 0.15, taper: 0.25, offset: 0 },
  },
  sky: { top: "#8ec3ea", horizon: "#e6ecef", fog: "#dfe8ee", fogNear: 12, fogFar: 55, gradient: true },
};

export const LOOK_PRESETS: readonly LookPreset[] = [CURRENT, TOY, OPEN_AIR, PAINTERLY];

/** Linear-light RGB multiplier: the day colour times this is the phase's colour. */
type Tint = readonly [number, number, number];
const WHITE: Tint = [1, 1, 1];

/**
 * A time of day as multipliers on the day look (§5.5). Colours multiply
 * channel-wise in linear light and numbers scale, so the day preset stays the
 * one source of truth. The real sunrise/sunset clock picks the phase
 * (rows 173, 188); the phase sets the sun's elevation, and the evening sun is
 * mirrored to screen-right (it sets in the west, opposite the dawn side).
 */
export interface PhaseLook {
  /** Sun elevation in degrees; null keeps the preset's position. */
  elevation: number | null; mirror: boolean;
  sun: Tint; sunIntensity: number;
  fill: Tint; bounce: Tint; fillIntensity: number;
  skyTop: Tint; skyHorizon: Tint; fog: number;
  shadowRadius: number; shadowIntensity: number;
  /** Rim/back light intensity added to the preset's, coloured by `sun`. */
  rim: number;
  exposure: number; warmth: number; lift: number; desat: number;
}

const DAY: PhaseLook = {
  elevation: null, mirror: false, sun: WHITE, sunIntensity: 1, fill: WHITE, bounce: WHITE, fillIntensity: 1,
  skyTop: WHITE, skyHorizon: WHITE, fog: 1, shadowRadius: 1, shadowIntensity: 1, rim: 0, exposure: 1, warmth: 0, lift: 0, desat: 0,
};

export const PHASE_LOOK: Record<IslandPhase, PhaseLook> = {
  // Cool-pink: low peach sun from the east side, lilac fill, periwinkle sky over a pink horizon, long soft shadows.
  dawn: {
    elevation: 21, mirror: false, sun: [1, 0.69, 0.71], sunIntensity: 0.62,
    fill: [1.46, 0.81, 0.93], bounce: [0.85, 0.85, 0.95], fillIntensity: 1.3,
    skyTop: [4.01, 1.07, 0.96], skyHorizon: [1.7, 0.82, 0.65], fog: 0.85,
    shadowRadius: 2.5, shadowIntensity: 0.85, rim: 0.15, exposure: 1.08, warmth: 0.05, lift: 0.05, desat: 0,
  },
  day: DAY,
  // Golden hour: warm low sun from the west (screen-right), cooler violet fill, a warm rim, long shadows.
  evening: {
    elevation: 22, mirror: true, sun: [1, 0.56, 0.28], sunIntensity: 0.85,
    fill: [1.18, 0.77, 0.87], bounce: [1, 0.85, 0.75], fillIntensity: 1.15,
    skyTop: [2.32, 0.81, 0.92], skyHorizon: [1.77, 0.77, 0.37], fog: 0.85,
    shadowRadius: 1.6, shadowIntensity: 0.95, rim: 0.6, exposure: 1.08, warmth: 0.15, lift: 0.05, desat: 0,
  },
  // Blue moonlight key, deep blue sky; the lamps and windows (islandLighting PHASE_BASE) stay warm.
  night: {
    elevation: 40, mirror: false, sun: [0.34, 0.57, 1.52], sunIntensity: 0.34,
    fill: [0.46, 0.45, 0.65], bounce: [0.4, 0.45, 0.55], fillIntensity: 1.2,
    skyTop: [0.11, 0.05, 0.09], skyHorizon: [0.07, 0.09, 0.18], fog: 0.85,
    shadowRadius: 2, shadowIntensity: 0.75, rim: 0, exposure: 1.1, warmth: -0.15, lift: 0, desat: 0.03,
  },
};

/** Distance of the key light from the island centre (the shadow camera sits there). */
const SUN_DISTANCE = 32;

function tint(hex: string, m: Tint): string {
  const c = new Color(hex);
  return `#${c.setRGB(Math.min(1, c.r * m[0]), Math.min(1, c.g * m[1]), Math.min(1, c.b * m[2])).getHexString()}`;
}

function adjust(color: number, look: ClassLook): number {
  const c = new Color(color), hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, Math.min(1, hsl.s * look.saturation), Math.min(1, hsl.l * look.value)).getHex();
}

function waterLook(water: IslandWater, look: ClassLook): IslandWater {
  if (look.saturation === 1 && look.value === 1 && look.gloss === 0) return water;
  return {
    ...water,
    deepColor: adjust(water.deepColor, look), midColor: adjust(water.midColor, look), shallowColor: adjust(water.shallowColor, look),
    glare: water.glare * (1 + look.gloss), sunGlint: water.sunGlint * (1 + look.gloss),
  };
}

/** What a phase keeps from islandLighting: the water palette and the lamps (gameplay, not look). */
export type PhaseBase = Pick<IslandLight, "water" | "lamp" | "lampsOn" | "windowGlow" | "fireflies">;

/** Preset onto a phase: the day look times the phase's multipliers. */
export function lookToLight(p: LookPreset, base: PhaseBase, phase: IslandPhase = "day"): IslandLight {
  const { light, sky } = p, m = PHASE_LOOK[phase];
  const { elevation, azimuth } = sunAngles(light.sunPosition);
  const elev = m.elevation ?? elevation;
  const sunPosition = m.elevation === null && !m.mirror ? light.sunPosition : sunFromAngles(elev, m.mirror ? 180 - azimuth : azimuth, SUN_DISTANCE);
  const sun = tint(light.sunColor, m.sun), top = tint(sky.top, m.skyTop), horizon = tint(sky.horizon, m.skyHorizon);
  const fill = tint(light.fillSky, m.fill), bounce = tint(light.fillGround, m.bounce);
  const rim = light.rimIntensity + m.rim;
  return {
    ...base,
    sky: horizon, sun, sunIntensity: light.sunIntensity * m.sunIntensity, sunPosition,
    fill, bounce, ambient: light.ambient * m.fillIntensity, hemisphere: light.hemisphere * m.fillIntensity,
    fogNear: sky.fogNear * m.fog, fogFar: sky.fogFar * m.fog, fogColor: tint(sky.fog, m.skyHorizon),
    environment: { skyTop: top, skyBottom: horizon, sun, ground: bounce, intensity: light.envIntensity * m.fillIntensity, sunElev: elev / 90 },
    grade: { ...p.grade, exposure: p.grade.exposure * m.exposure, warmth: p.grade.warmth + m.warmth, lift: p.grade.lift + m.lift, desat: p.grade.desat + m.desat },
    water: waterLook(base.water, p.materials.water),
    shadow: { radius: p.shadows.radius * m.shadowRadius, intensity: p.shadows.intensity * m.shadowIntensity, tint: p.shadows.tint },
    ...(rim > 0 ? { rim: { color: tint(light.rimColor, m.sun), intensity: rim } } : {}),
    ...(sky.gradient ? { skyTop: top } : {}),
  };
}

export interface LookFx {
  toneMapping: ToneMap;
  bloom: LookPreset["post"]["bloom"] | null;
  tiltShift: LookPreset["post"]["tiltShift"] | null;
  ao: LookPreset["ao"] | null;
}

/** Post settings; AO, depth of field and bloom are High-tier only. */
export function lookFx(p: LookPreset, highTier: boolean): LookFx {
  return {
    toneMapping: p.post.toneMapping,
    bloom: highTier && p.post.bloom.enabled ? p.post.bloom : null,
    tiltShift: highTier && p.post.tiltShift.enabled ? p.post.tiltShift : null,
    ao: highTier && p.ao.enabled ? p.ao : null,
  };
}

/** three's lights chunk with the key light's shadow multiply lerping toward `uLookShadowTint` (LookMaterials). */
export const LOOK_LIGHTS_CHUNK = ShaderChunk.lights_fragment_begin.replace(
  /directLight\.color \*= (\( directLight\.visible && receiveShadow \) \? getShadow\( directionalShadowMap[^;]*);/,
  "directLight.color *= mix( uLookShadowTint, vec3( 1.0 ), $1 );",
);

/** Roughness written onto a material of this class (base = its authored roughness). */
export function lookRoughness(base: number, look: ClassLook): number {
  const r = Math.min(1, Math.max(0.03, base * look.roughness));
  return look.gloss ? Math.min(r, r + (GLOSS_ROUGHNESS - r) * look.gloss) : r;
}

const lum = (color: string) => { const c = new Color(color); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
const elevationSin = ([x, y, z]: readonly number[]) => Math.max(0, y / Math.hypot(x, y, z));

/**
 * Irradiance on flat, up-facing ground (linear luminance, three r155+ light
 * units). Key = sun · N·L. Fill = ambient + hemisphere sky + IBL (π · sky
 * radiance · intensity) + the unshadowed rim. Lit:shadow is what a cast
 * shadow on that ground measures, counting the shadow's leak and tint.
 */
export function keyFill(p: LookPreset): { key: number; fill: number; keyFill: number; litShadow: number } {
  const { light, shadows, sky } = p;
  const key = light.sunIntensity * lum(light.sunColor) * elevationSin(light.sunPosition);
  const fill = (light.ambient + light.hemisphere) * lum(light.fillSky)
    + Math.PI * light.envIntensity * (lum(sky.top) + lum(sky.horizon)) / 2
    + light.rimIntensity * lum(light.rimColor) * elevationSin(RIM_POSITION);
  const leak = (1 - shadows.intensity) + shadows.intensity * lum(shadows.tint);
  return { key, fill, keyFill: key / fill, litShadow: (key + fill) / (fill + key * leak) };
}

/** Degrees; azimuth 0 = +x, 90 = +z. */
export function sunAngles([x, y, z]: readonly number[]): { elevation: number; azimuth: number } {
  return { elevation: Math.atan2(y, Math.hypot(x, z)) * 180 / Math.PI, azimuth: Math.atan2(z, x) * 180 / Math.PI };
}
export function sunFromAngles(elevation: number, azimuth: number, distance = 30): [number, number, number] {
  const e = elevation * Math.PI / 180, a = azimuth * Math.PI / 180, r = (v: number) => Math.round(v * 100) / 100;
  return [r(distance * Math.cos(e) * Math.cos(a)), r(distance * Math.sin(e)), r(distance * Math.cos(e) * Math.sin(a))];
}
/**
 * The sun's horizontal angle from the fixed follow camera, which sits on −z
 * looking +z (IslandAtmosphere, ApplicantWorld): 0 = straight behind the
 * camera, ±90 = pure side light, + = screen-left (+x).
 */
export function sunFromCamera([x, , z]: readonly number[]): number {
  return Math.atan2(x, -z) * 180 / Math.PI;
}

/** Colour temperature to sRGB hex (Tanner Helland's blackbody fit, 1000-40000 K). */
export function kelvinHex(kelvin: number): string {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100, clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return `#${((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, "0")}`;
}

/**
 * JSON back into a preset. Every field is taken from the input when it has
 * the same type as Current's, otherwise Current's value stands, so a partial
 * or older preset still loads and nothing unexpected gets in.
 */
export function parseLook(input: unknown): LookPreset {
  const merge = (shape: unknown, value: unknown): unknown => {
    if (Array.isArray(shape)) return Array.isArray(value) && value.length === shape.length && value.every(v => typeof v === "number" && Number.isFinite(v)) ? [...value] : shape;
    if (shape && typeof shape === "object") {
      const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
      return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, merge(v, source[k])]));
    }
    if (typeof shape === "number") return typeof value === "number" && Number.isFinite(value) ? value : shape;
    if (typeof shape === "string" && shape.startsWith("#")) return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : shape;
    if (typeof shape === "string" && ["neutral", "aces", "agx"].includes(shape)) return ["neutral", "aces", "agx"].includes(value as string) ? value : shape;
    return typeof value === typeof shape ? value : shape;
  };
  return merge(CURRENT, input) as LookPreset;
}
