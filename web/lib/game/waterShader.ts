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
  /** Peak of the glare sheet (the sun off the ripples too small to draw). Past 1 clips to white. */
  glare: number;
  /** RMS slope (tan) of those ripples about the drawn surface (Cox-Munk): the sheet's width and the sparkles' spread. */
  roughness: number;
  /** Brightness of one sparkle: a facet mirroring the sun straight into the eye. */
  sunGlint: number;
  /** The sun's apparent radius, degrees: a facet flashes while the sun's disc sits in its mirror direction. */
  sunSize: number;
  waveHeight: number;
  waveScale: number;
  waveSpeed: number;
  /** Optional authored sea-normal detail, used by applicant ocean. */
  rippleStrength?: number;
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
    /** The key light's colour, so the glint turns gold at golden hour and blue under the moon. */
    uSunColor: { value: new THREE.Color(1, 0.98, 0.92) },
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
    uRoughness: { value: p.roughness },
    uSunGlint: { value: p.sunGlint },
    uSunSize: { value: p.sunSize },
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
  u.uRoughness.value = p.roughness;
  u.uSunGlint.value = p.sunGlint;
  u.uSunSize.value = p.sunSize;
  u.uWaveHeight.value = p.waveHeight;
  u.uWaveScale.value = p.waveScale;
  u.uWaveSpeed.value = p.waveSpeed;
}

/**
 * ── SUN ON THE WATER IS OPTICS (row 238, specs/look-development.md §7.4) ──
 * Water shows the sun only where a bit of surface is tilted to mirror the real
 * key light into this eye: its normal must lie along the half vector between
 * the sun and the eye. With the sun behind the follow camera that needs 29°+
 * of tilt; the drawn surface (swell + ripple texture) gives about 9° and the
 * ripples below it at most 1.5 roughness more, so nothing lights. With the
 * sun ahead the light sits around the mirror point and slides as the eye moves.
 *
 *  - `glareLobe`: the ripples too small to draw, averaged. Their slopes spread
 *    about the drawn normal by `roughness` (a Beckmann lobe), so the sheet is
 *    the share of them aimed at the eye. Calm water is tight; wind is wide.
 *  - `facetGlint`: one of those ripples, a sparkle sprite with its own normal
 *    (drawn normal + `facetTilt` + `chopSlope`). It lights while the sun's
 *    disc sits in its mirror direction (`sunSize`, the disc's radius; the
 *    normal's tolerance is half that).
 *
 * MIRRORED IN GLSL (`WATER_OPTICS` below). Change both together.
 */
export type Vec3 = readonly [number, number, number];
const unit = ([x, y, z]: Vec3): Vec3 => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The normal a facet at `point` needs to mirror the sun (a direction) into `eye` (a position). */
export function halfVector(sun: Vec3, eye: Vec3, point: Vec3): Vec3 {
  const s = unit(sun), v = unit([eye[0] - point[0], eye[1] - point[1], eye[2] - point[2]]);
  return unit([s[0] + v[0], s[1] + v[1], s[2] + v[2]]);
}

/** Glare sheet, 0-1 at its peak: the share of sub-pixel facets about `normal` that mirror the sun into the eye. */
export function glareLobe(sun: Vec3, eye: Vec3, point: Vec3, normal: Vec3, roughness: number): number {
  const c = Math.max(dot(unit(normal), halfVector(sun, eye, point)), 1e-3), m = Math.max(roughness, 1e-3);
  return sun[1] >= 0 ? Math.exp(-(1 - c * c) / (c * c) / (m * m)) : 0;
}

/** One facet's flash, 0-1: 1 when it mirrors the sun's centre into the eye, 0 once the disc leaves its mirror direction. */
export function facetGlint(sun: Vec3, eye: Vec3, point: Vec3, normal: Vec3, sunSize: number): number {
  const edge = Math.cos(sunSize * Math.PI / 360);
  const t = Math.min(Math.max((dot(unit(normal), halfVector(sun, eye, point)) - edge) / (1 - edge), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * The fixed tilt of the unresolved ripple at world (x, z), in units of
 * `roughness`: a property of that bit of water, seeded by where it is, so
 * every client agrees. Beckmann-distributed like `glareLobe`'s facets (RMS
 * 0.6) so the sparkles fall in the sheet, cut at 0.9; with `chopSlope` (at
 * most 0.6) a facet never tilts past 1.5 roughness, so none can reach a sun
 * behind the camera, even in wind.
 */
export function facetTilt(x: number, z: number): [number, number] {
  let h = Math.imul(Math.round(x * 1024), 0x9e3779b1) ^ Math.imul(Math.round(z * 1024), 0x85ebca77);
  const next = () => {
    h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
    h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  };
  const r = 0.6 * Math.sqrt(-Math.log(1 - next() * (1 - Math.exp(-2.25)))), a = next() * 2 * Math.PI;
  return [r * Math.cos(a), r * Math.sin(a)];
}

/**
 * Short wind waves below the drawn ripples, in units of `roughness`: three
 * trains 0.43-0.61 units long on deep-water dispersion (ω = √(g k), about
 * 2 Hz), 0.2 of slope each. A function of world position and world time only.
 * They turn each facet through alignment fast, so a sparkle flashes for about
 * 0.2 s instead of drifting in and out with the drawn waves. Mirrored in
 * `WATER_CHOP`.
 */
const CHOP = ([[0.8, 0.6, 0.43], [-0.5, 0.866, 0.61], [0.96, -0.28, 0.53]] as const).map(([x, z, length]) => {
  // Rounded as the GLSL prints them, so the mirror is exact.
  const k = +(2 * Math.PI / length).toFixed(5);
  return [x, z, k, +Math.sqrt(9.8 * k).toFixed(5)] as const;
});
const CHOP_SLOPE = 0.2;
export function chopSlope(x: number, z: number, t: number): [number, number] {
  let sx = 0, sz = 0;
  for (const [dx, dz, k, w] of CHOP) { const c = Math.cos(k * (dx * x + dz * z) - w * t); sx += dx * c; sz += dz * c; }
  return [sx * CHOP_SLOPE, sz * CHOP_SLOPE];
}

/** Mirrors halfVector / glareLobe / facetGlint above. For the water fragment and the sparkle sprites. */
export const WATER_OPTICS = /* glsl */ `
vec3 halfVector(vec3 sun, vec3 eye, vec3 p) { return normalize(normalize(sun) + normalize(eye - p)); }
float glareLobe(vec3 sun, vec3 eye, vec3 p, vec3 n, float roughness) {
  float c = max(dot(normalize(n), halfVector(sun, eye, p)), 1e-3), m = max(roughness, 1e-3);
  return step(0.0, sun.y) * exp(-(1.0 - c * c) / (c * c) / (m * m));
}
float facetGlint(vec3 sun, vec3 eye, vec3 p, vec3 n, float sunSize) {
  return smoothstep(cos(radians(sunSize) * 0.5), 1.0, dot(normalize(n), halfVector(sun, eye, p)));
}
`;

/**
 * A time phase wrapped to one turn before it meets sin(). uTime is world
 * seconds (up to 86 400, lib/game/worldClock.ts), so t * speed reaches 10^5
 * rad, where GPU fast-math sin loses its accuracy; the wrap keeps it in range
 * and is seamless, because sin repeats.
 */
const WATER_PHASE = /* glsl */ `
float waterPhase(float x) { return mod(x, 6.2831853); }
`;

/** Mirrors chopSlope. Needs waterPhase (WATER_SWELL brings it). */
export const WATER_CHOP = /* glsl */ `
vec2 chopSlope(vec2 xz, float t) {
  vec2 s = vec2(0.0), d;
${CHOP.map(([x, z, k, w]) => `  d = vec2(${x}, ${z}); s += d * cos(${k.toFixed(5)} * dot(xz, d) - waterPhase(${w.toFixed(5)} * t));`).join("\n")}
  return s * ${CHOP_SLOPE.toFixed(2)};
}
`;

/**
 * Cloud shadows over the water: the sun is blocked where one passes, so its
 * glare and sparkles dim there. The same drifting texture CloudShadows draws
 * (world xz to its uv via uCloudUv), unbounded, because the clouds exist over
 * the sea too; uCloudShade is 0 while no clouds are drawn (Light tier, indoors).
 */
export const WATER_CLOUDS = /* glsl */ `
uniform sampler2D uCloudMap;
uniform vec4 uCloudUv;
uniform float uCloudShade;
float sunThroughClouds(vec2 xz) {
  return 1.0 - uCloudShade * texture2D(uCloudMap, xz * uCloudUv.xy + uCloudUv.zw).a;
}
`;

const UNIFORM_DECLS = /* glsl */ `
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uMidColor;
uniform vec3 uShallowColor;
uniform vec3 uBedColor;
uniform vec3 uFoamColor;
uniform vec3 uRingColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
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
uniform float uRoughness;
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
${WATER_PHASE}// Mirrors bedDepth() in waterShader.ts. Change both together.
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
  float a = sin(q.x * 1.00 + waterPhase(t * 0.31)) * sin(q.y * 0.87 - waterPhase(t * 0.23));
  float b = sin((q.x + q.y) * 0.61 - waterPhase(t * 0.19)) * sin((q.x - q.y) * 0.53 + waterPhase(t * 0.27));
  return a * 0.6 + b * 0.4;
}
${WATER_OPTICS}`;

/**
 * Swell. Two waves at different angles and incommensurate frequencies, so the
 * surface is never uniformly up or down (David: "waves that aren't uniform").
 * Driven by WORLD position so adjacent cells agree at their shared edge and the
 * sheet stays continuous even though each cell is its own four vertices.
 *
 * The analytic gradient rides out as a varying: without it the swell would move
 * the surface without changing how it catches light, which reads as a sliding
 * texture rather than as water. Exported for the glint sprites
 * (GridOcean), which ride the same crests.
 */
export const WATER_SWELL = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveScale;
uniform float uWaveSpeed;
${WATER_PHASE}
float waterSwell(vec2 xz, out vec2 grad) {
  float k = 6.2831853 / max(uWaveScale, 0.001);
  vec2 d1 = normalize(vec2(1.0, 0.35));
  vec2 d2 = normalize(vec2(-0.42, 1.0));
  float a1 = dot(xz, d1) * k + waterPhase(uTime * uWaveSpeed);
  float a2 = dot(xz, d2) * k * 1.63 + waterPhase(uTime * uWaveSpeed * 1.31);
  grad = d1 * (cos(a1) * 0.62 * k * uWaveHeight)
       + d2 * (cos(a2) * 0.38 * k * 1.63 * uWaveHeight);
  return (sin(a1) * 0.62 + sin(a2) * 0.38) * uWaveHeight;
}
`;

const VERTEX_DECLS = /* glsl */ `
varying vec3 vWaterWorld;
varying vec2 vWaterGrad;
${WATER_SWELL}`;

const VERTEX_BODY = /* glsl */ `
{
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  float h = waterSwell(wp.xz, vWaterGrad);
  transformed.y += h;
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
  float lap = sin(vWaterWorld.x * 0.9 + vWaterWorld.z * 0.7 + waterPhase(uTime * uFoamWaveSpeed)) * uFoamWave;

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

  // Surface normal from the swell gradient and the ripple texture, in world
  // space. cameraPosition is a built-in, so no view-space bookkeeping.
  vec2 detailNormal = waterDetailNormal(vWaterWorld.xz);
  vec3 N = normalize(vec3(-vWaterGrad.x + detailNormal.x, 1.0, -vWaterGrad.y + detailNormal.y));
  vec3 V = normalize(cameraPosition - vWaterWorld);

  // The real sun off the ripples too small to draw (glareLobe, see WATER_OPTICS
  // in TS): a sheet around the mirror point, pushed past 1.0 so it clips to
  // white. The sharp points inside it are the sparkle sprites (GridOcean).
  float glare = glareLobe(uSunDir, cameraPosition, vWaterWorld, N, uRoughness) * sunThroughClouds(vWaterWorld.xz);

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

  col += uSunColor * glare * uGlare * (1.0 - foam);
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
  /** Optional small-wave normal from existing assets. */
  normal?: string;
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
          WATER_CLOUDS +
          opts.shore +
          (opts.extra ?? WATER_EXTRA_NONE) +
          (opts.normal ?? "vec2 waterDetailNormal(vec2 xz) { return vec2(0.0); }\n") +
          WATER_FUNCTIONS
      )
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + FRAGMENT_BODY);
  };
  mat.customProgramCacheKey = () => `water:${opts.shore}:${opts.extra ?? ""}:${opts.normal ?? ""}`;
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
