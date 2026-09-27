import { Color, ShaderChunk } from "three";
import type { Grade } from "./grading";
import { DEFAULT_SHADOW, ISLAND_LIGHTING, type IslandLight, type IslandWater } from "./islandLighting";

/**
 * Look presets (ledger row 235, specs/look-development.md §2). One plain JSON
 * object carries every value that shapes the day look: key/fill light,
 * shadows, AO, per-class materials, grade, post and sky. `lookToLight` maps it
 * onto the game's own `IslandLight` (so season and weather still layer on
 * top), `lookFx` onto PostFX, and the lab's LookRig onto scene materials.
 *
 * "current" is the shipped day profile exactly. The three directions are
 * starting points from general rendering practice, not from any image.
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
  grade: Grade;
  post: {
    toneMapping: ToneMap;
    bloom: { enabled: boolean; threshold: number; intensity: number };
    /** Blur 0-1 at the frame edges; taper = share of the frame the blur ramps over; offset moves the sharp line (+ = up). */
    tiltShift: { enabled: boolean; blur: number; taper: number; offset: number };
  };
  /** Gradient off = flat horizon-coloured background, as shipped. */
  sky: { top: string; horizon: string; fog: string; fogNear: number; fogFar: number; gradient: boolean };
}

/** Rim/back light comes from the far side of the scene (the camera looks +z). */
export const RIM_POSITION: [number, number, number] = [0, 10, 24];
const GLOSS_ROUGHNESS = 0.3;
const SAME: ClassLook = { saturation: 1, value: 1, roughness: 1, gloss: 0 };
const day = ISLAND_LIGHTING.day;
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export const CURRENT: LookPreset = {
  id: "current", name: "Current",
  light: {
    sunColor: day.sun, sunIntensity: day.sunIntensity, sunPosition: day.sunPosition,
    fillSky: day.fill, fillGround: day.bounce, hemisphere: day.hemisphere, ambient: day.ambient, envIntensity: day.environment.intensity,
    rimColor: "#ffffff", rimIntensity: 0,
  },
  shadows: { ...DEFAULT_SHADOW, tint: "#000000" },
  ao: { enabled: false, radius: 1.2, intensity: 1.5 },
  materials: { terrain: SAME, props: SAME, foliage: SAME, water: SAME, characters: SAME },
  grade: day.grade,
  post: {
    toneMapping: "neutral",
    bloom: { enabled: false, threshold: 1, intensity: 0.22 },
    tiltShift: { enabled: false, blur: 0.15, taper: 0.25, offset: 0 },
  },
  sky: { top: day.environment.skyTop, horizon: day.sky, fog: day.sky, fogNear: day.fogNear, fogFar: day.fogFar, gradient: false },
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
  grade: { exposure: 1, contrast: 1.06, vibrance: 0.12, desat: -0.04, warmth: 0.22, lift: 0.1, vignette: 0.28 },
  post: {
    toneMapping: "neutral",
    bloom: { enabled: true, threshold: 0.9, intensity: 0.3 },
    tiltShift: { enabled: true, blur: 0.08, taper: 0.3, offset: 0 },
  },
  sky: { top: "#6fb6ec", horizon: "#cfe8f4", fog: "#cfe8f4", fogNear: 26, fogFar: 80, gradient: true },
};

/** Hard midday sun: warm 3/4 key from screen-left, blue sky fill, crisp cool shadows, AO, bloom on highlights. */
const OPEN_AIR: LookPreset = {
  id: "open-air", name: "Open-air sun",
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
  grade: { exposure: 1, contrast: 0.97, vibrance: 0.25, desat: -0.05, warmth: 0.3, lift: 0.25, vignette: 0.08 },
  post: {
    toneMapping: "neutral",
    bloom: { enabled: true, threshold: 0.7, intensity: 0.25 },
    tiltShift: { enabled: false, blur: 0.15, taper: 0.25, offset: 0 },
  },
  sky: { top: "#8ec3ea", horizon: "#e6ecef", fog: "#dfe8ee", fogNear: 12, fogFar: 55, gradient: true },
};

export const LOOK_PRESETS: readonly LookPreset[] = [CURRENT, TOY, OPEN_AIR, PAINTERLY];

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

/** Preset onto a phase profile. Current on the day profile reproduces it exactly. */
export function lookToLight(p: LookPreset, base: IslandLight): IslandLight {
  const { light, sky } = p;
  return {
    ...base,
    sky: sky.horizon, sun: light.sunColor, sunIntensity: light.sunIntensity, sunPosition: light.sunPosition,
    fill: light.fillSky, bounce: light.fillGround, ambient: light.ambient, hemisphere: light.hemisphere,
    fogNear: sky.fogNear, fogFar: sky.fogFar, fogColor: sky.fog,
    environment: { ...base.environment, skyTop: sky.top, skyBottom: sky.horizon, sun: light.sunColor, ground: light.fillGround, intensity: light.envIntensity },
    grade: p.grade,
    water: waterLook(base.water, p.materials.water),
    shadow: { radius: p.shadows.radius, intensity: p.shadows.intensity },
    ...(light.rimIntensity > 0 ? { rim: { color: light.rimColor, intensity: light.rimIntensity } } : {}),
    ...(sky.gradient ? { skyTop: sky.top } : {}),
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

/** three's lights chunk with the key light's shadow multiply lerping toward `uLookShadowTint` (LookRig). */
export const LOOK_LIGHTS_CHUNK = ShaderChunk.lights_fragment_begin.replace(
  /directLight\.color \*= (\( directLight\.visible && receiveShadow \) \? getShadow\( directionalShadowMap[^;]*);/,
  "directLight.color *= mix( uLookShadowTint, vec3( 1.0 ), $1 );",
);

/** Roughness the lab writes onto a material of this class (base = its authored roughness). */
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

/** Colour temperature to sRGB hex (Tanner Helland's blackbody fit, 1000-40000 K). */
export function kelvinHex(kelvin: number): string {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100, clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return hex((clamp(r) << 16) | (clamp(g) << 8) | clamp(b));
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
