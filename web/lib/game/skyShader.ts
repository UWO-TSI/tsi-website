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
#ifdef SKY_LAB
  labSky(sky, fade);
#endif

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
#ifdef SKY_LAB
  labClouds(density, shade);
#else
  clouds(density, shade);
#endif
  density = clamp(density, 0.0, 1.0) * fade;
  shade = clamp(shade, 0.0, 1.0);

  vec3 cloud = mix(uCloudDark, uCloudLit, shade);
#ifdef SKY_LAB
  labCloud(cloud, density, shade);
#else
  if (uNight > 0.001) {
    float s = texture2D(uStars, uvAt(0.9, vec2(0.0))).r;
    sky += vec3(0.85, 0.9, 1.0) * pow(s, 2.2) * uNight * fade * 2.2;
  }
#endif

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

/**
 * Development only (lib/game/skyLab.ts, specs/sky-ambient.md): the round 1 sky directions' uniforms, written by SkyDome
 * while `?sky=` is set. The shipped dome never declares them.
 */
export const skyLabUniforms = {
  /** The real sun (below the horizon too), world direction. */
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uMoonDir: { value: new THREE.Vector3(0, 0.4, 0.9).normalize() },
  /** The moon's age, 0 new, 0.5 full. */
  uMoonPhase: { value: 0.5 },
  uGalaxy: { value: null as THREE.Texture | null },
};

/**
 * The three directions as one block behind SKY_LAB (1 A painted, 2 B toon, 3 C storybook). Each fills the same hooks in
 * MAIN: labSky (the gradient, the sun, the moon, the stars and meteors, under the clouds), labClouds (which clouds) and
 * labCloud (their colour).
 */
const LAB_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uMoonPhase;
uniform sampler2D uGalaxy;
// The view direction renormalised per pixel: vDir is interpolated across the dome's faces, which squares off a sun.
vec3 lDir;

float labHash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

// 1 while the sun is near the horizon (about -9 to 15 degrees): dawn, golden hour, sunset and dusk.
float lowSun() { return smoothstep(0.26, 0.06, uSunDir.y) * smoothstep(-0.16, -0.03, uSunDir.y); }
float sunSide() { return dot(normalize(lDir.xz + 1e-5), normalize(uSunDir.xz + 1e-5)); }

// A shooting star now and then on the world clock, in the moon's half of the sky (so the moon-facing view catches it).
float meteor() {
  float P = 11.0, c = floor(uTime / P), age = uTime - c * P;
  if (labHash(c) > 0.6 || age > 1.1) return 0.0;
  float maz = atan(uMoonDir.z, uMoonDir.x);
  float az = maz + (labHash(c + 3.1) - 0.5) * 1.6, e = 0.12 + labHash(c + 7.7) * 0.2;
  vec3 a = vec3(cos(az) * cos(e), sin(e), sin(az) * cos(e));
  vec3 side = normalize(cross(a, vec3(0.0, 1.0, 0.0))) * (labHash(c + 1.3) > 0.5 ? 1.0 : -1.0);
  vec3 vel = normalize(side - vec3(0.0, 0.5, 0.0)) * 0.42;
  vec3 head = normalize(a + vel * age), tail = normalize(a + vel * max(age - 0.25, 0.0));
  vec3 ab = head - tail;
  float u = clamp(dot(lDir - tail, ab) / max(dot(ab, ab), 1e-7), 0.0, 1.0);
  float d = length(lDir - (tail + ab * u));
  float life = smoothstep(0.0, 0.12, age) * smoothstep(1.1, 0.7, age);
  return smoothstep(0.0032, 0.0008, d) * u * life;
}

void labSky(inout vec3 sky, float fade) {
  lDir = normalize(vDir);
  float low = lowSun(), toSun = sunSide(), up = smoothstep(-0.07, 0.01, uSunDir.y), day = 1.0 - uNight;
  vec3 glow = mix(vec3(1.0, 0.5, 0.44), vec3(1.0, 0.76, 0.46), smoothstep(-0.04, 0.16, uSunDir.y));
#if SKY_LAB == 2
  // Toon: the gradient in soft steps, a flat sun with a ring, a gentle wash on the sun's side.
  float g = pow(elN, 0.7) * 4.0;
  g = (floor(g) + smoothstep(0.35, 0.65, fract(g))) / 4.0;
  sky = mix(uHorizon, uZenith, g);
  sky = mix(sky, glow, low * pow(max(toSun, 0.0), 2.0) * pow(1.0 - elN, 2.0) * 0.5);
#elif SKY_LAB == 3
  // Storybook: its own richer palette by the sun's height (a deeper blue noon; a violet zenith over an orange and rose
  // skyline at the low sun, the rose band opposite it: the belt of Venus), over today's, which keeps the night.
  float e = uSunDir.y;
  vec3 zen = mix(vec3(0.24, 0.25, 0.6), vec3(0.22, 0.5, 0.9), smoothstep(0.08, 0.4, e));
  zen = mix(vec3(0.13, 0.13, 0.36), zen, smoothstep(-0.12, 0.02, e));
  vec3 hor = mix(mix(vec3(0.8, 0.5, 0.62), vec3(0.96, 0.47, 0.2), pow(max(toSun, 0.0), 1.5)), vec3(0.64, 0.83, 0.96), smoothstep(0.12, 0.4, e));
  hor = mix(vec3(0.42, 0.28, 0.5), hor, smoothstep(-0.12, 0.0, e));
  sky = mix(sky, mix(hor, zen, pow(elN, 0.6)), 0.88 * day * (1.0 - 0.85 * clamp(uCover.z, 0.0, 1.0)));
  sky = mix(sky, vec3(1.0, 0.42, 0.16), low * pow(max(toSun, 0.0), 4.0) * pow(1.0 - elN, 3.0) * 0.6);
  float anti = max(-toSun, 0.0);
  sky = mix(sky, vec3(0.86, 0.5, 0.7), low * anti * anti * smoothstep(0.02, 0.2, elN) * smoothstep(0.75, 0.3, elN) * 0.55);
#else
  // Painted: today's gradient with a soft wash toward the low sun.
  sky = mix(sky, glow, low * pow(max(toSun, 0.0), 3.0) * pow(1.0 - elN, 2.0) * 0.55);
#endif

  // The sun: a disc and its halo, gone once it sets.
  float sd = dot(lDir, uSunDir);
  vec3 sunC = mix(vec3(1.0, 0.98, 0.9), vec3(1.0, 0.74, 0.48), low);
#if SKY_LAB == 2
  float disc = smoothstep(0.99835, 0.99850, sd) + 0.5 * smoothstep(0.99700, 0.99712, sd) * (1.0 - smoothstep(0.99722, 0.99734, sd));
  float halo = pow(max(sd, 0.0), 60.0) * 0.18;
#else
  float disc = smoothstep(0.99884, 0.99904, sd);
  float halo = pow(max(sd, 0.0), 220.0) * 0.45 + pow(max(sd, 0.0), 22.0) * (0.04 + 0.08 * low);
#endif
  sky += sunC * halo * up * day;
  sky = mix(sky, sunC * 1.12, clamp(disc, 0.0, 1.0) * up * day);

  // The moon: its phase from the calendar, a few soft craters, a halo by how full it is; from deep dusk on.
  vec3 mr = normalize(cross(vec3(0.0, 1.0, 0.0), uMoonDir)), mu = cross(uMoonDir, mr);
  float R = 0.032;
  vec2 mp = vec2(dot(lDir, mr), dot(lDir, mu)) / R;
  float md = dot(lDir, uMoonDir), mlen = length(mp);
  float mIn = md > 0.0 ? 1.0 - smoothstep(0.9, 1.0, mlen) : 0.0;
  float k = cos(6.2832 * uMoonPhase), edge = sqrt(max(0.0, 1.0 - mp.y * mp.y));
  float lit = smoothstep(-0.1, 0.1, (uMoonPhase < 0.5 ? mp.x : -mp.x) - k * edge);
  float crater = 1.0 - 0.12 * (smoothstep(0.32, 0.2, length(mp - vec2(-0.3, 0.25))) + smoothstep(0.22, 0.12, length(mp - vec2(0.35, -0.2))) + smoothstep(0.16, 0.08, length(mp - vec2(0.1, 0.5))));
  float mVis = smoothstep(0.15, 0.6, uNight);
  vec3 moonC = vec3(1.0, 0.97, 0.86) * crater;
#if SKY_LAB == 2
  moonC = vec3(1.0, 0.95, 0.72) * mix(1.0, crater, 0.6);
#endif
  sky = mix(sky, mix(sky * 1.15 + 0.02, moonC, lit), mIn * mVis);
  sky += vec3(0.62, 0.72, 1.0) * (pow(max(md, 0.0), 900.0) * 0.4 + pow(max(md, 0.0), 60.0) * 0.08) * mVis * (1.0 - k) * 0.5 * (1.0 - mIn);

  // Stars, twinkling as the title's do (each its own beat), never over the moon; the odd shooting star.
  if (uNight > 0.001) {
    vec2 starUv = uvAt(0.9, vec2(0.0));
    float s = texture2D(uStars, starUv).r;
    float ph = texture2D(uNoise, starUv * 0.37).r * 43.0;
#if SKY_LAB == 2
    float starry = 1.0;
#else
    float starry = 0.6;
#endif
    float tw = 1.0 + starry * (1.1 - 0.7 * sin(uTime * 2.1 + ph));
    sky += vec3(0.85, 0.9, 1.0) * pow(s, 2.2 + starry * 1.4) * tw * uNight * fade * 2.2 * (1.0 - mIn);
#if SKY_LAB == 3
    sky += vec3(0.5, 0.46, 0.8) * texture2D(uGalaxy, uvAt(0.32, vec2(0.0))).rgb * uNight * fade * 0.55 * (1.0 - mIn);
#endif
    sky += vec3(1.0, 0.96, 0.85) * meteor() * uNight * fade * 1.4;
  }
}

void labClouds(out float density, out float shade) {
#if SKY_LAB == 2
  // Toon clouds: soft noise cut to crisp puffs, lit on the side toward the sun, cool underneath; weather thickens them
  // (coverage), greys them (overcast) and darkens their bellies (storm).
  float cov = clamp(cover0 * 0.5 + cover1 * 0.45 + cover2 * 0.35 + cover3 * 0.3, 0.0, 1.0);
  vec2 uv = uvAt(0.42, vec2(0.011, 0.004));
  float n = (texture2D(uNoise, uv).r * 0.7 + texture2D(uNoise, uv * 2.7 + 0.37).r * 0.3) * mix(0.7, 1.0, band);
  float thr = mix(0.64, 0.3, cov);
  float d = smoothstep(thr, thr + 0.03, n);
  vec2 lift = normalize(uSunDir.xz + vec2(1e-4)) * 0.05 * (1.0 - 0.6 * uNight);
  float n2 = texture2D(uNoise, uv + lift).r * 0.7 + texture2D(uNoise, (uv + lift) * 2.7 + 0.37).r * 0.3;
  float litSide = smoothstep(-0.015, 0.02, n2 - n + 0.012);
  float core = smoothstep(thr + 0.05, thr + 0.2, n);
  shade = mix(0.62, 1.0, max(litSide, 1.0 - core));
  shade = mix(shade, 0.42 + 0.25 * litSide, cover3);
  density = max(d, cover2 * 0.7 * smoothstep(-0.3, 0.5, elN));
  shade = mix(shade, 0.7, cover2 * (1.0 - d) * 0.8);
#else
  clouds(density, shade);
#endif
}

void labCloud(inout vec3 cloud, float density, float shade) {
#if SKY_LAB == 3
  // Storybook: the low sun paints the clouds' lit side, deepest toward it, with a bright rim on thin edges.
  float low = lowSun(), toSun = max(sunSide(), 0.0);
  vec3 warm = mix(vec3(1.0, 0.5, 0.45), vec3(1.0, 0.72, 0.45), smoothstep(-0.04, 0.16, uSunDir.y));
  cloud = mix(cloud, warm * (0.6 + 0.35 * shade), low * (0.5 + 0.5 * toSun));
  cloud = mix(cloud, vec3(0.4, 0.32, 0.54), low * (1.0 - shade) * 0.8);
  cloud = mix(cloud, cloud * vec3(0.9, 0.95, 1.05), (1.0 - low) * (1.0 - uNight) * 0.5);
  cloud += warm * low * toSun * smoothstep(0.55, 0.1, density) * smoothstep(0.0, 0.08, density) * 0.35;
#elif SKY_LAB == 2
  cloud = mix(cloud, cloud * vec3(1.0, 0.86, 0.78), lowSun() * max(sunSide(), 0.0) * shade * 0.6);
#endif
}
`;

const matCache = new Map<string, THREE.ShaderMaterial>();

/** The dome material for one variant (and, in development, one round 1 direction: 1, 2 or 3). Cached; call freely. */
export function skyMaterial(id: SkyVariantId = "luxury", lab = 0): THREE.ShaderMaterial {
  const key = `${id}:${lab}`, hit = matCache.get(key);
  if (hit) return hit;

  const v: SkyVariant = skyVariant(id);
  skyUniforms.uStars.value = tex("stars");
  skyUniforms.uNoise.value = tex("cumulusNoise");

  // Only this variant's own textures are declared and bound. Binding all twenty
  // would cost 134MB of VRAM for the sixteen a given shader never reads.
  const decls = v.textures.map((k) => `uniform sampler2D ${samplerName(k)};`).join("\n");
  const uniforms: Record<string, { value: unknown }> = { ...skyUniforms };
  for (const k of v.textures) uniforms[samplerName(k)] = { value: tex(k) };
  if (lab) {
    skyLabUniforms.uGalaxy.value = tex("galaxy");
    Object.assign(uniforms, skyLabUniforms);
  }

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    defines: lab ? { SKY_LAB: lab } : {},
    uniforms: uniforms as { [k: string]: THREE.IUniform },
    vertexShader: VERT,
    fragmentShader: PREAMBLE + decls + "\n" + VORONOI_GLSL + v.glsl + "\n" + (lab ? LAB_GLSL : "") + MAIN,
  });
  mat.name = `sky:${id}${lab ? `:lab${lab}` : ""}`;
  matCache.set(key, mat);
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
