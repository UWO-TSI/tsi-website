/**
 * waterShader — one water look, shared by the sea and the river.
 *
 * David, 2026-07-28: "the water physics, color, lighting everything about it is
 * wrong", with six stylised references and a link to "[UE4] Stylized Water
 * Shader (Distance Fields)". He then ruled: one shader, split parameters; move
 * off MeshStandardMaterial; the seabed may slope.
 *
 * ── WHY IT IS NOT LIT ───────────────────────────────────────────────────
 * The river was a MeshStandardMaterial, so it ate ambient + hemi + env IBL and
 * came out grey. That is not a value to tune away; a PBR surface under a 4:1
 * key-to-fill CANNOT produce a flat saturated cyan, because the fill is added
 * after everything this file does.
 *
 * So the base is MeshBasicMaterial: unlit, and every bit of shading here is
 * explicit. Crucially it is still a BUILT-IN material, which means it keeps the
 * three things a raw ShaderMaterial would silently lose — scene fog, the
 * NeutralToneMapping pass, and curvedWorld.ts's project_vertex bend. A flat sea
 * that does not curve with the world detaches from the horizon.
 *
 * ── WHY THE RAMP IS ON DEPTH AND NOT ON A COLOUR LERP ───────────────────
 * Sampled off David's references (image 12 and 13):
 *
 *   #3098B3  deep      #5BC5CB  mid      #CADCBC  shallow      #EAE1C3  bed
 *
 * The ramp ENDS IN THE SAND COLOUR. Shallow water in those images is not a
 * lighter blue, it is the seabed seen through a thin blue film. That is
 * absorption over depth, so the driver has to be depth, and depth has to
 * exist — which is what the bathymetry below is for. `bedDepth` is mirrored in
 * TS and GLSL because the seabed MESH and the shader ramp have to agree; they
 * are three lines each and sit next to each other for that reason.
 *
 * ── THE CEL LAYERS ──────────────────────────────────────────────────────
 * David's image 15 is an art tutorial and it spells out the construction:
 * two-tone base, a MULTIPLY layer of irregular blobs ("liquid shading"), two
 * ADD layers that ring those blobs with light, then a highlight. That is what
 * `blobField` and the two rings are. It is not noise for texture's sake — the
 * rings are what makes stylised water read as water rather than as tinted
 * glass, because they imply a surface that is bending light.
 */

import * as THREE from "three";

/** Everything the bench can move. Sea and river get their own set. */
export interface WaterParams {
  deepColor: number;
  midColor: number;
  shallowColor: number;
  bedColor: number;
  foamColor: number;
  ringColor: number;
  /** World units of water the ramp spans before it is fully "deep". */
  depthFalloff: number;
  /** Deepest the bed ever gets, world units. */
  bedDepth: number;
  /** Cells of shore distance to reach ~63% of bedDepth. */
  bedSlope: number;
  /** Foam collar width, in cells. */
  foamWidth: number;
  foamStrength: number;
  /** 0 is a hard edge (one pixel of AA); higher feathers it. */
  foamSoft: number;
  /** How far the waterline runs up and back, in cells. 0 is a static edge. */
  foamWave: number;
  foamWaveSpeed: number;
  /** Size of the multiply blobs, world units per blob. */
  blobScale: number;
  /** How far the blobs darken the base. 1 is off. */
  blobDarken: number;
  blobSpeed: number;
  /** Half-width of the light ring around each blob. */
  ringWidth: number;
  ringStrength: number;
  /** Alpha over the bed at the waterline, and out in open water. */
  shoreAlpha: number;
  opacity: number;
  fresnel: number;
  glare: number;
  glareWidth: number;
  sunGlint: number;
  sunSharp: number;
  sparkle: number;
  sparkleSpeed: number;
  waveHeight: number;
  waveScale: number;
  waveSpeed: number;
}

/**
 * How deep the water is, `d` cells out from the waterline.
 *
 * MIRRORED IN GLSL BELOW. If you change one, change the other: this drives the
 * seabed geometry and the GLSL drives the colour, and a disagreement shows up
 * as sand that is the wrong shade for how deep it visibly is.
 */
export function bedDepth(d: number, p: Pick<WaterParams, "bedDepth" | "bedSlope">): number {
  return p.bedDepth * (1 - Math.exp(-Math.max(d, 0) / Math.max(p.bedSlope, 0.01)));
}

export function waterUniforms(p: WaterParams) {
  return {
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(p.deepColor) },
    uMidColor: { value: new THREE.Color(p.midColor) },
    uShallowColor: { value: new THREE.Color(p.shallowColor) },
    uBedColor: { value: new THREE.Color(p.bedColor) },
    uFoamColor: { value: new THREE.Color(p.foamColor) },
    uRingColor: { value: new THREE.Color(p.ringColor) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uDepthFalloff: { value: p.depthFalloff },
    uBedDepth: { value: p.bedDepth },
    uBedSlope: { value: p.bedSlope },
    uFoamWidth: { value: p.foamWidth },
    uFoamStrength: { value: p.foamStrength },
    uFoamSoft: { value: p.foamSoft },
    uFoamWave: { value: p.foamWave },
    uFoamWaveSpeed: { value: p.foamWaveSpeed },
    uBlobScale: { value: p.blobScale },
    uBlobDarken: { value: p.blobDarken },
    uBlobSpeed: { value: p.blobSpeed },
    uRingWidth: { value: p.ringWidth },
    uRingStrength: { value: p.ringStrength },
    uShoreAlpha: { value: p.shoreAlpha },
    uOpacity: { value: p.opacity },
    uFresnel: { value: p.fresnel },
    uGlare: { value: p.glare },
    uGlareWidth: { value: p.glareWidth },
    uSunGlint: { value: p.sunGlint },
    uSunSharp: { value: p.sunSharp },
    uSparkle: { value: p.sparkle },
    uSparkleSpeed: { value: p.sparkleSpeed },
    uWaveHeight: { value: p.waveHeight },
    uWaveScale: { value: p.waveScale },
    uWaveSpeed: { value: p.waveSpeed },
  };
}

export type WaterUniforms = ReturnType<typeof waterUniforms>;

/** Push a params block onto live uniforms without recompiling the shader. */
export function writeWaterUniforms(u: WaterUniforms, p: WaterParams): void {
  u.uDeepColor.value.setHex(p.deepColor);
  u.uMidColor.value.setHex(p.midColor);
  u.uShallowColor.value.setHex(p.shallowColor);
  u.uBedColor.value.setHex(p.bedColor);
  u.uFoamColor.value.setHex(p.foamColor);
  u.uRingColor.value.setHex(p.ringColor);
  u.uDepthFalloff.value = p.depthFalloff;
  u.uBedDepth.value = p.bedDepth;
  u.uBedSlope.value = p.bedSlope;
  u.uFoamWidth.value = p.foamWidth;
  u.uFoamStrength.value = p.foamStrength;
  u.uFoamSoft.value = p.foamSoft;
  u.uFoamWave.value = p.foamWave;
  u.uFoamWaveSpeed.value = p.foamWaveSpeed;
  u.uBlobScale.value = p.blobScale;
  u.uBlobDarken.value = p.blobDarken;
  u.uBlobSpeed.value = p.blobSpeed;
  u.uRingWidth.value = p.ringWidth;
  u.uRingStrength.value = p.ringStrength;
  u.uShoreAlpha.value = p.shoreAlpha;
  u.uOpacity.value = p.opacity;
  u.uFresnel.value = p.fresnel;
  u.uGlare.value = p.glare;
  u.uGlareWidth.value = p.glareWidth;
  u.uSunGlint.value = p.sunGlint;
  u.uSunSharp.value = p.sunSharp;
  u.uSparkle.value = p.sparkle;
  u.uSparkleSpeed.value = p.sparkleSpeed;
  u.uWaveHeight.value = p.waveHeight;
  u.uWaveScale.value = p.waveScale;
  u.uWaveSpeed.value = p.waveSpeed;
}

const UNIFORM_DECLS = /* glsl */ `
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uMidColor;
uniform vec3 uShallowColor;
uniform vec3 uBedColor;
uniform vec3 uFoamColor;
uniform vec3 uRingColor;
uniform vec3 uSunDir;
uniform float uDepthFalloff;
uniform float uBedDepth;
uniform float uBedSlope;
uniform float uFoamWidth;
uniform float uFoamStrength;
uniform float uFoamSoft;
uniform float uFoamWave;
uniform float uFoamWaveSpeed;
uniform float uBlobScale;
uniform float uBlobDarken;
uniform float uBlobSpeed;
uniform float uRingWidth;
uniform float uRingStrength;
uniform float uShoreAlpha;
uniform float uOpacity;
uniform float uFresnel;
uniform float uGlare;
uniform float uGlareWidth;
uniform float uSunGlint;
uniform float uSunSharp;
uniform float uSparkle;
uniform float uSparkleSpeed;
`;

/**
 * The shading itself, minus where the shore distance comes from.
 *
 * Callers inject a `float shoreDistance(vec2 xz)` — the grid reads the baked
 * field, the legacy sea evaluates coast.ts harmonics. Keeping that pluggable is
 * what lets one shader serve both while the old terrain path still exists; when
 * the grid becomes the default the sea switches to the field and the harmonics
 * go.
 */
const WATER_FUNCTIONS = /* glsl */ `
// Mirrors bedDepth() in waterShader.ts. Change both together.
float bedDepthAt(float d) {
  return uBedDepth * (1.0 - exp(-max(d, 0.0) / max(uBedSlope, 0.01)));
}

// Four stops, ending in the SEABED colour. See the header: shallow water in
// the reference is sand under a blue film, not a paler blue.
vec3 waterRamp(float t) {
  vec3 c = mix(uBedColor, uShallowColor, smoothstep(0.0, 0.34, t));
  c = mix(c, uMidColor, smoothstep(0.28, 0.68, t));
  c = mix(c, uDeepColor, smoothstep(0.62, 1.0, t));
  return c;
}

// Irregular patches for the multiply layer. Four sines at mutually
// incommensurate rates, so the pattern has no period and never lines up into
// the plaid that two crossed waves give.
float blobField(vec2 p, float t) {
  vec2 q = p / max(uBlobScale, 0.01);
  float a = sin(q.x * 1.00 + t * 0.31) * sin(q.y * 0.87 - t * 0.23);
  float b = sin((q.x + q.y) * 0.61 - t * 0.19) * sin((q.x - q.y) * 0.53 + t * 0.27);
  return a * 0.6 + b * 0.4;
}
`;

const VERTEX_DECLS = /* glsl */ `
varying vec3 vWaterWorld;
varying vec2 vWaterGrad;
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveScale;
uniform float uWaveSpeed;
`;

/**
 * Swell. Two waves at different angles and incommensurate frequencies, so the
 * surface is never uniformly up or down (David: "waves that aren't uniform").
 * Driven by WORLD position so adjacent cells agree at their shared edge and the
 * sheet stays continuous even though each cell is its own four vertices.
 *
 * The analytic gradient rides out as a varying: without it the swell would move
 * the surface without changing how it catches light, which reads as a sliding
 * texture rather than as water.
 */
const VERTEX_BODY = /* glsl */ `
{
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  float k = 6.2831853 / max(uWaveScale, 0.001);
  vec2 d1 = normalize(vec2(1.0, 0.35));
  vec2 d2 = normalize(vec2(-0.42, 1.0));
  float a1 = dot(wp.xz, d1) * k + uTime * uWaveSpeed;
  float a2 = dot(wp.xz, d2) * k * 1.63 + uTime * uWaveSpeed * 1.31;
  float h = (sin(a1) * 0.62 + sin(a2) * 0.38) * uWaveHeight;
  transformed.y += h;
  vWaterGrad = d1 * (cos(a1) * 0.62 * k * uWaveHeight)
             + d2 * (cos(a2) * 0.38 * k * 1.63 * uWaveHeight);
  vWaterWorld = wp;
  vWaterWorld.y += h;
}
`;

const FRAGMENT_BODY = /* glsl */ `
{
  float shore = shoreDistance(vWaterWorld.xz);

  // THE WATERLINE RUNS UP AND BACK. A travelling wave along the shore rather
  // than a pulse, so the beach does not breathe in and out as one piece: two
  // cells apart are at different points in the same swash. This is the sea's
  // original lapping foam, restored as a parameter and now shared with the
  // river, where it wants to be near zero.
  float lap = sin(vWaterWorld.x * 0.9 + vWaterWorld.z * 0.7 + uTime * uFoamWaveSpeed) * uFoamWave;

  float edge = max(shore - lap, 0.0);
  float depth = bedDepthAt(edge);
  float t = clamp(depth / max(uDepthFalloff, 0.001), 0.0, 1.0);

  vec3 col = waterRamp(t);


  // MULTIPLY layer, then the two ADD layers that ring it. Straight out of the
  // tutorial in David's image 15.
  float field = blobField(vWaterWorld.xz, uTime * uBlobSpeed);
  float blob = smoothstep(-0.05, 0.25, field);
  col *= mix(1.0, uBlobDarken, blob);
  float w = max(uRingWidth, 0.001);
  float ringA = 1.0 - smoothstep(0.0, w, abs(field - 0.10));
  float ringB = 1.0 - smoothstep(0.0, w * 2.2, abs(field + 0.30));
  col += uRingColor * (ringA * uRingStrength + ringB * uRingStrength * 0.45);

  col = waterExtra(col, t, vWaterWorld.xz);

  // Surface normal from the swell gradient, then the sun off it in world
  // space. cameraPosition is a built-in, so no view-space bookkeeping.
  vec3 N = normalize(vec3(-vWaterGrad.x, 1.0, -vWaterGrad.y));
  vec3 V = normalize(cameraPosition - vWaterWorld);
  vec3 S = normalize(uSunDir);

  // Two lobes plus a sparkle field. One tight lobe reads as a dull dot, which
  // is what it is; the reference has a BROAD blown-out sheet with sharp points
  // flickering inside it. Broad is deliberately pushed past 1.0 so it clips to
  // white and reads as overexposure. The sparkle term is three sines beating
  // against each other over world position and time: their product is near
  // zero most of the time and occasionally spikes, so flares come and go
  // instead of sitting there.
  float sd = max(dot(reflect(-V, N), S), 0.0);
  float broad = pow(sd, max(uGlareWidth, 0.5));
  float tight = pow(sd, max(uSunSharp, 1.0));
  float st = uTime * uSparkleSpeed;
  float n = sin(vWaterWorld.x * 2.7 + st * 1.7)
          * sin(vWaterWorld.z * 2.3 - st * 1.3)
          * sin((vWaterWorld.x + vWaterWorld.z) * 1.7 + st * 2.3);
  float spark = mix(1.0, smoothstep(0.15, 0.85, n * 0.5 + 0.5), uSparkle);

  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  col += uRingColor * rim * uFresnel;

  // FOAM. A solid collar (David, 2026-07-28), so the only blend is one pixel
  // wide unless uFoamSoft opens it up: fwidth gives how fast the distance
  // changes across this fragment, i.e. the world width of one pixel here. The
  // band therefore stays crisp up close and smooth far away instead of
  // shimmering. It sits OVER the rings and glare, which is why it is applied
  // last and why the sun is killed inside it.
  float aa = max(fwidth(edge), 1e-5) * 0.8 + uFoamSoft;
  float foam = 1.0 - smoothstep(uFoamWidth - aa, uFoamWidth + aa, edge);
  foam *= step(0.0, shore); // nothing under the land itself
  foam = clamp(foam * uFoamStrength, 0.0, 1.0);

  col += vec3(1.0, 0.98, 0.92) * (broad * uGlare + tight * uSunGlint * spark) * (1.0 - foam);
  col = mix(col, uFoamColor, foam);

  diffuseColor.rgb = col;
  // Clear enough at the waterline to show the bed, opaque once the ramp has
  // done its work. This is the other half of selling absorption: a uniformly
  // translucent sheet reads as coloured glass.
  diffuseColor.a = mix(uShoreAlpha, uOpacity, t);
  diffuseColor.a = mix(diffuseColor.a, 1.0, foam);
}
`;

/** No extra layers. The river uses this; the sea overrides it with caustics. */
export const WATER_EXTRA_NONE = /* glsl */ `
vec3 waterExtra(vec3 col, float t, vec2 xz) { return col; }
`;

export interface WaterShaderOptions {
  /** Defines `float shoreDistance(vec2 xz)`, in CELLS, negative inland. */
  shore: string;
  /** Optionally replaces `waterExtra`, which runs between the cel layers and the foam. */
  extra?: string;
  /**
   * Transparent water needs something under it. The river has a bed; the open
   * sea does not, so it stays opaque and keeps writing depth rather than
   * joining the transparent queue for nothing.
   */
  transparent?: boolean;
}

/**
 * Patch a MeshBasicMaterial into water.
 *
 * `getUniforms` is a THUNK, not the object. It is only called when the shader
 * compiles, which lets a React caller hold its uniform block in a ref: the
 * block exists to be written every frame, and the react-compiler lint rejects
 * mutating anything a hook returned. Reading the ref inside this closure is
 * not a render-phase read.
 */
export function applyWaterShader(
  mat: THREE.MeshBasicMaterial,
  getUniforms: () => Record<string, { value: unknown }>,
  opts: WaterShaderOptions
): void {
  const transparent = opts.transparent ?? true;
  mat.transparent = transparent;
  // A transparent surface viewed from above with a bed underneath must not
  // write depth: it would z-fight the bed and hide it outright.
  mat.depthWrite = !transparent;
  mat.onBeforeCompile = (shader) => {
    for (const [k, v] of Object.entries(getUniforms())) shader.uniforms[k] = v as THREE.IUniform;

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + VERTEX_DECLS)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERTEX_BODY);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWaterWorld;\nvarying vec2 vWaterGrad;\n" +
          UNIFORM_DECLS +
          opts.shore +
          (opts.extra ?? WATER_EXTRA_NONE) +
          WATER_FUNCTIONS
      )
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + FRAGMENT_BODY);
  };
  mat.needsUpdate = true;
}

/** Shore distance read from the baked field. Grid path. */
export const SHORE_FROM_FIELD = /* glsl */ `
uniform sampler2D uShoreMap;
uniform vec4 uShoreRect;
float shoreDistance(vec2 xz) {
  return texture2D(uShoreMap, (xz - uShoreRect.xy) / uShoreRect.zw).r;
}
`;
