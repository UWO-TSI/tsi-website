/**
 * skyShader — the sky dome: a gradient, plus whichever of COZY's eight cloud
 * shaders is selected.
 *
 * REPLACES eight painted equirectangular panoramas that cost 89MB of video
 * memory to display flat gradients. Measured, the sky was 97MB of the game's
 * 104MB of texture memory: 93%, for the thing furthest away and least detailed.
 * A gradient is three lines of maths.
 *
 * The cloud maths lives in `skyVariants.ts`, one entry per COZY shader. This
 * file is the frame around them: the dome, the projection, the gradient, the
 * time-of-day colours, and the uniforms every variant can read.
 *
 * ── THE PROJECTION ──────────────────────────────────────────────────────
 * Clouds are an INFINITE SHEET overhead, not a wrap on the dome:
 *
 *     uv = dir.xz / (dir.y + k)
 *
 * the intersection of the view ray with a horizontal plane. That is what makes
 * clouds shrink and crowd toward the horizon the way real ones do, and it is
 * why the source art is square and tiling rather than equirectangular: there is
 * no spherical unwrap here, so none of the equirect problems (pole pinch, wrap
 * seam, horizon pinned to the vertical centre) exist.
 *
 * ── NORMALISED ELEVATION ────────────────────────────────────────────────
 * CameraControls clamps maxPolarAngle to PI/2 and the FOV is 48 vertical, so
 * the top of frame is 24 degrees up and elevation never exceeds about 0.42.
 * Every height-shaped term therefore works in elN, which divides that out.
 * Writing them against a full dome is what made the first version render as
 * bare gradient with the clouds erased: the whole of the 0..1 range they were
 * tuned for sits above the visible band.
 */

import * as THREE from "three";
import {
  VORONOI_GLSL,
  skyVariant,
  samplerName,
  type SkyVariantId,
  type SkyVariant,
} from "./skyVariants";

const TEX_DIR = "/assets/sky/layers/";

export interface SkyLayerWeights {
  cumulus: number;
  altocumulus: number;
  cirrus: number;
  cirrostratus: number;
  nimbus: number;
}

export interface SkyShape {
  nimbusHeight: number;
  nimbusVariation: number;
  borderHeight: number;
  borderEffect: number;
  borderVariation: number;
}

/**
 * Held module-side so the frame loop can write without React seeing it. Same
 * pattern as the water block in terrainMaterials.ts and the sea block in
 * Ocean.tsx, and for the same reason: a uniform block exists to be mutated, and
 * the react-compiler lint rejects mutating anything a hook returned.
 */
export const skyUniforms = {
  uTime: { value: 0 },
  uZenith: { value: new THREE.Color(0x4fb6f5) },
  uHorizon: { value: new THREE.Color(0xa9dcf2) },
  uCloudLit: { value: new THREE.Color(0xffffff) },
  uCloudDark: { value: new THREE.Color(0xb9cbdc) },
  /** The four coverage sliders. What they mean is up to the variant. */
  uCover: { value: new THREE.Vector4(0.6, 0.25, 0, 0) },
  /** bandHeight, bandEffect, stormReach, chemtrails. */
  uShape: { value: new THREE.Vector4(0.52, 1, 1, 0) },
  uCloudScale: { value: 0.5 },
  uWind: { value: 0.3 },
  uNight: { value: 0 },
  uValue: { value: 1 },
  uStars: { value: null as THREE.Texture | null },
  uNoise: { value: null as THREE.Texture | null },
};

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  // Object-space direction on the dome. The dome is pinned to the camera, so
  // this is a world direction without needing the camera matrix.
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Everything a variant's clouds() can rely on. */
const PREAMBLE = /* glsl */ `
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uCloudLit;
uniform vec3 uCloudDark;
uniform vec4 uCover;
uniform vec4 uShape;
uniform float uCloudScale;
uniform float uWind;
uniform float uNight;
uniform float uValue;
uniform sampler2D uStars;
uniform sampler2D uNoise;
varying vec3 vDir;

float elN;
float band;
float breakUp;
float stormMask;
float cover0, cover1, cover2, cover3;
float uChemtrails;

vec2 uvAt(float scale, vec2 drift) {
  float t = uTime * (0.06 + uWind * 0.34);
  return vDir.xz / (max(vDir.y, 0.0) + 0.28) * (uCloudScale * scale) + drift * t;
}
`;

const MAIN = /* glsl */ `
void main() {
  float el = max(vDir.y, 0.0);
  elN = clamp(el / 0.42, 0.0, 1.0);

  vec3 sky = mix(uHorizon, uZenith, pow(elN, 0.7));
  float fade = smoothstep(0.0, 0.16, elN);

  cover0 = uCover.x; cover1 = uCover.y; cover2 = uCover.z; cover3 = uCover.w;
  uChemtrails = uShape.w;

  // Clouds gather at a height and thin toward the skyline. Wide and low,
  // because the visible band is only 24 degrees tall and a band centred
  // halfway up would leave the bottom two thirds of every frame bare.
  float b = smoothstep(uShape.x - 0.75, uShape.x + 0.75, elN);
  band = mix(1.0, b, clamp(uShape.y, 0.0, 1.0));

  // A storm ceiling reaches DOWN, which makes it a lid rather than a layer.
  stormMask = smoothstep(0.0, mix(0.9, 0.15, uShape.z), elN);

  // Soft fractal noise, larger and slower, MULTIPLIED in so it thins and
  // thickens coverage rather than adding cloud of its own. Without it a fixed
  // sheet reads as a decal sliding past.
  float n = texture2D(uNoise, uvAt(1.9, vec2(0.006, 0.002))).r;
  breakUp = mix(1.0, 0.35 + n * 0.9, 0.55);

  float density = 0.0;
  float shade = 1.0;
  clouds(density, shade);
  density = clamp(density, 0.0, 1.0) * fade;
  shade = clamp(shade, 0.0, 1.0);

  vec3 cloud = mix(uCloudDark, uCloudLit, shade);

  if (uNight > 0.001) {
    float s = texture2D(uStars, uvAt(0.9, vec2(0.0))).r;
    sky += vec3(0.85, 0.9, 1.0) * pow(s, 2.2) * uNight * fade * 2.2;
  }

  gl_FragColor = vec4(mix(sky, cloud, density) * uValue, 1.0);
}
`;

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();

/**
 * MIRRORED repeat. Several of the source sheets do not tile (measured: 107 and
 * 41 edge error against an 87 control) and the projection is an infinite
 * overhead plane, so clamping would put cloud in one direction and empty sky
 * everywhere else. Mirroring makes any organic texture tile, and on shapes this
 * irregular the reflection is invisible.
 */
function tex(key: string): THREE.Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const t = loader.load(`${TEX_DIR}${key}.webp`);
  // Masks are DATA. Tagging them sRGB would gamma-decode coverage and thin
  // every cloud.
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  texCache.set(key, t);
  return t;
}

const matCache = new Map<SkyVariantId, THREE.ShaderMaterial>();

/** The dome material for one variant. Cached; call freely. */
export function skyMaterial(id: SkyVariantId = "luxury"): THREE.ShaderMaterial {
  const hit = matCache.get(id);
  if (hit) return hit;

  const v: SkyVariant = skyVariant(id);
  skyUniforms.uStars.value = tex("stars");
  skyUniforms.uNoise.value = tex("cumulusNoise");

  // Only this variant's own textures are declared and bound. Binding all twenty
  // would cost 134MB of VRAM for the sixteen a given shader never reads.
  const decls = v.textures.map((k) => `uniform sampler2D ${samplerName(k)};`).join("\n");
  const uniforms: Record<string, { value: unknown }> = { ...skyUniforms };
  for (const k of v.textures) uniforms[samplerName(k)] = { value: tex(k) };

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: uniforms as { [k: string]: THREE.IUniform },
    vertexShader: VERT,
    fragmentShader: PREAMBLE + decls + "\n" + VORONOI_GLSL + v.glsl + "\n" + MAIN,
  });
  mat.name = `sky:${id}`;
  matCache.set(id, mat);
  return mat;
}

/**
 * Push a frame at the sky.
 *
 * The four cloud weights mean different things per variant. For Luxury they are
 * the coverage ladder; for the procedural ones only the first is a threshold.
 * That is why they arrive as an unnamed vec4 rather than pretending to be
 * meteorology.
 */
export function advanceSky(
  elapsed: number,
  clouds: SkyLayerWeights,
  shape: SkyShape,
  colors: { zenith: THREE.Color; horizon: THREE.Color; lit: THREE.Color; dark: THREE.Color },
  night: number,
  value: number,
  wind: number,
  cloudScale: number,
  chemtrails = 0
): void {
  const u = skyUniforms;
  u.uTime.value = elapsed;
  u.uZenith.value.copy(colors.zenith);
  u.uHorizon.value.copy(colors.horizon);
  u.uCloudLit.value.copy(colors.lit);
  u.uCloudDark.value.copy(colors.dark);
  u.uCover.value.set(clouds.cumulus, clouds.altocumulus, clouds.cirrostratus, clouds.nimbus);
  u.uShape.value.set(shape.borderHeight, shape.borderEffect, shape.nimbusHeight, chemtrails);
  u.uNight.value = night;
  u.uValue.value = value;
  u.uWind.value = wind;
  u.uCloudScale.value = cloudScale;
}
