/**
 * skyShader — the sky as a gradient plus weighted cloud layers.
 *
 * REPLACES eight painted equirectangular panoramas. Those cost 89MB of video
 * memory to display flat gradients — 2048x1024 each, and a texture costs 4
 * bytes per texel on the GPU however small the file is. Measured: the sky was
 * 97MB of the game's 104MB of texture memory. NINETY-THREE PERCENT, for the
 * one thing in the frame that is furthest away and least detailed.
 *
 * A gradient is three lines of maths. The clouds are six greyscale masks packed
 * into two 512 textures, 2.7MB. The sky now costs 3% of what it did.
 *
 * ── WHY THIS SHAPE, AND NOT A PANORAMA ──────────────────────────────────
 * Studied from COZY 3 (see weatherSystem.ts). The panorama approach failed for
 * a reason no amount of better art would have fixed: a panorama is ONE image,
 * so "partly cloudy" and "overcast" are two pictures with no way to be 30% of
 * the way between them. Crossfading them morphs one cloud into another, which
 * reads as a dissolve, not as weather.
 *
 * Independent layers do not have that problem. Coverage is a NUMBER per layer,
 * so any weather is a point in a six-dimensional space and every transition is
 * continuous by construction. `weatherSystem.ts` produces those numbers.
 *
 * ── THE PROJECTION ──────────────────────────────────────────────────────
 * Clouds are projected as an INFINITE PLANE overhead, not wrapped on the dome:
 *
 *     uv = dir.xz / (dir.y + k)
 *
 * which is the intersection of the view ray with a horizontal sheet. That is
 * what makes clouds bunch up and shrink toward the horizon the way real ones
 * do, and it is why the source textures are square and tiling rather than
 * equirectangular — there is no spherical unwrap here, so none of the equirect
 * problems (pole pinch, wrap seam, horizon pinned to the vertical centre)
 * exist. `k` keeps the horizon from dividing by zero, and the fade below hides
 * the compression where it would go singular anyway.
 */

import * as THREE from "three";

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
 * Uniforms, held module-side so the frame loop can write them without React
 * seeing it. Same pattern as the water block in terrainMaterials.ts.
 */
export const skyUniforms = {
  uPackA: { value: null as THREE.Texture | null },
  uPackB: { value: null as THREE.Texture | null },
  uTime: { value: 0 },
  /** Straight up. */
  uZenith: { value: new THREE.Color(0x4fb6f5) },
  /** At the skyline. */
  uHorizon: { value: new THREE.Color(0xa9dcf2) },
  /** Lit face of a cloud. */
  uCloudLit: { value: new THREE.Color(0xfff7e4) },
  /** Shadowed underside. */
  uCloudDark: { value: new THREE.Color(0xb9cbdc) },
  /** Coverage: puffy, chunky, overcast, (spare). */
  uCoverA: { value: new THREE.Vector4(0.6, 0, 0, 0) },
  /** storm, stormReach, bandHeight, bandEffect. */
  uCoverB: { value: new THREE.Vector4(0, 1, 0.5, 1) },
  /** How many times the cloud sheet repeats. Higher is smaller clouds. */
  uCloudScale: { value: 0.85 },
  /** Drift speed, world units per second. */
  uWind: { value: 0.15 },
  /** 0 by day, 1 at night. Gates the star layer. */
  uNight: { value: 0 },
  /** Overall weather brightness, from the filter. */
  uValue: { value: 1 },
};

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  // Object space direction on the dome. The dome is pinned to the camera, so
  // this is a world direction without needing the camera matrix.
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uPackA;
uniform sampler2D uPackB;
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uCloudLit;
uniform vec3 uCloudDark;
uniform vec4 uCoverA;
uniform vec4 uCoverB;
uniform float uCloudScale;
uniform float uWind;
uniform float uNight;
uniform float uValue;
varying vec3 vDir;

/**
 * Ray-to-overhead-sheet: where this view ray crosses a horizontal plane above
 * the world. That is what makes clouds shrink and crowd toward the horizon the
 * way real ones do, and it is why the source art is square and tiling rather
 * than equirectangular -- there is no spherical unwrap, so none of the equirect
 * problems exist.
 */
vec2 sheetUv(float scale, vec2 drift) {
  return vDir.xz / (max(vDir.y, 0.0) + 0.28) * scale + drift;
}

void main() {
  float el = max(vDir.y, 0.0);

  /**
   * NORMALISED ELEVATION, and this is not cosmetic.
   *
   * CameraControls clamps maxPolarAngle to PI/2 and the FOV is 48 vertical, so
   * the top of frame is 24 degrees up and el never exceeds about 0.42. Every
   * height-shaped term below (the gradient, the haze, the cloud band, how far
   * a storm ceiling reaches down) was first written against a full dome where
   * el runs 0..1 -- and the whole of that range sits above the visible band, so
   * the first preview came out as bare gradient with the clouds erased.
   *
   * Dividing through means a parameter of 0.5 lands halfway up the sky the
   * player can actually SEE, which is what anyone setting it would expect.
   */
  float elN = clamp(el / 0.42, 0.0, 1.0);

  vec3 sky = mix(uHorizon, uZenith, pow(elN, 0.7));

  // Haze along the skyline. Also hides the sheet projection where it goes
  // singular at el = 0.
  float fade = smoothstep(0.0, 0.16, elN);

  float t = uTime * uWind;
  float s = uCloudScale;

  // THE COVERAGE LADDER. Not cloud types -- increasing amounts of sky covered.
  // Each is driven at its own scale and drift so they never move as one sheet.
  float puffy = texture2D(uPackA, sheetUv(s, vec2(t * 0.010, t * 0.004))).r;
  float chunky = texture2D(uPackA, sheetUv(s * 0.78, vec2(t * 0.013, t * 0.006))).g;
  float overcast = texture2D(uPackA, sheetUv(s * 0.62, vec2(t * 0.008, t * 0.003))).b;
  float storm = texture2D(uPackB, sheetUv(s * 0.55, vec2(t * 0.016, t * 0.009))).r;
  // Soft fractal noise, sampled larger and slower. Multiplied in rather than
  // added so it thins and thickens the ladder instead of adding cloud of its
  // own -- without it, four fixed sheets read as decals sliding past.
  float noise = texture2D(uPackB, sheetUv(s * 1.9, vec2(t * 0.006, t * 0.002))).g;
  float breakUp = mix(1.0, 0.35 + noise * 0.9, 0.55);

  // BAND: clouds gather overhead and thin toward the skyline, or the reverse
  // for a ceiling. borderEffect at 0 leaves coverage flat at every height.
  // Wide and low. Clouds do sit higher than the skyline, but the visible band
  // is only 24 degrees tall, so a band centred halfway up leaves the bottom
  // two thirds of every frame as bare gradient.
  float band = smoothstep(uCoverB.z - 0.75, uCoverB.z + 0.75, elN);
  float border = mix(1.0, band, clamp(uCoverB.w, 0.0, 1.0));

  float density = 0.0;
  density += puffy * uCoverA.x * border * breakUp;
  density += chunky * uCoverA.y * border * breakUp;
  // The ceiling layers get the noise too. Without it their masks saturate to
  // 1 across the whole sky and overcast renders as flat grey paint -- correct
  // in coverage, dead on screen.
  density += overcast * uCoverA.z * breakUp;
  // A storm ceiling reaches DOWN, which is what makes it feel like a lid
  // rather than another layer.
  density += storm * uCoverB.x * breakUp * smoothstep(0.0, mix(0.9, 0.15, uCoverB.y), elN);

  density = clamp(density, 0.0, 1.0) * fade;

  // Thick cloud reads dark, wisps read bright. Driving that off density itself
  // costs nothing and needs no second fetch.
  vec3 cloud = mix(uCloudLit, uCloudDark, smoothstep(0.35, 1.0, density));

  if (uNight > 0.001) {
    float stars = texture2D(uPackB, sheetUv(s * 0.9, vec2(0.0))).b;
    sky += vec3(0.85, 0.9, 1.0) * pow(stars, 2.2) * uNight * fade * 2.2;
  }

  vec3 col = mix(sky, cloud, density) * uValue;
  gl_FragColor = vec4(col, 1.0);
}
`;

let cached: THREE.ShaderMaterial | null = null;

/** Load the two packed masks and build the dome material. Cached; call freely. */
export function skyMaterial(): THREE.ShaderMaterial {
  if (cached) return cached;

  const loader = new THREE.TextureLoader();
  const load = (file: string) => {
    const t = loader.load(TEX_DIR + file);
    // The masks are DATA, not colour. Tagging them sRGB would gamma-decode
    // coverage values and thin every cloud.
    t.colorSpace = THREE.NoColorSpace;
    // MIRRORED, because the source sheets do not tile and the projection is an
    // infinite overhead plane. Clamping would put cloud in one direction only.
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  skyUniforms.uPackA.value = load("sky-a.webp");
  skyUniforms.uPackB.value = load("sky-b.webp");

  cached = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  return cached;
}

/** Push a frame's worth of state at the sky. Called from GameWorld's loop. */
export function advanceSky(
  elapsed: number,
  clouds: SkyLayerWeights,
  shape: SkyShape,
  colors: { zenith: THREE.Color; horizon: THREE.Color; lit: THREE.Color; dark: THREE.Color },
  night: number,
  value: number,
  wind: number,
  cloudScale: number
): void {
  const u = skyUniforms;
  u.uTime.value = elapsed;
  u.uZenith.value.copy(colors.zenith);
  u.uHorizon.value.copy(colors.horizon);
  u.uCloudLit.value.copy(colors.lit);
  u.uCloudDark.value.copy(colors.dark);
  // The engine speaks in meteorological names; the ART is a coverage ladder.
  // Mapped here rather than renaming the engine, because "cumulus" and
  // "nimbus" read better in a weather profile than "puffy" and "storm".
  u.uCoverA.value.set(clouds.cumulus, clouds.altocumulus, clouds.cirrostratus, 0);
  u.uCoverB.value.set(clouds.nimbus, shape.nimbusHeight, shape.borderHeight, shape.borderEffect);
  u.uNight.value = night;
  u.uValue.value = value;
  u.uWind.value = 0.06 + wind * 0.34;
  u.uCloudScale.value = cloudScale;
}
