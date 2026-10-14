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
 * exist — which is what the bathymetry below is for. The seabed MESH and the
 * shader ramp have to agree, so the depth is baked from the same function the
 * mesh is built on (lib/game/seabed.ts) into the water's field, and the shader
 * reads it there (v1 water pass, 2026-10-13: sand-tinted teal over the shallows
 * to deep navy past the drop-off, references/look/2026-10-13).
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
  /** The ramp's stops by depth (v1 water item 1): the seabed's sand at the waterline, a sand-tinted teal over the shallows, teal, deep blue, navy over the open sea. */
  navyColor: number;
  deepColor: number;
  midColor: number;
  shallowColor: number;
  bedColor: number;
  foamColor: number;
  ringColor: number;
  /** World units of water for the ramp to go ~63% of the way from the sand to the navy. */
  depthFalloff: number;
  /** How deep the bed gets over the shallows, world units. */
  bedDepth: number;
  /** Cells of shore distance to reach ~63% of bedDepth. */
  bedSlope: number;
  /** The drop-off past the shallows: this much more depth (world units), from `shelfFrom` to `shelfTo` cells out. */
  shelfDepth: number;
  shelfFrom: number;
  shelfTo: number;
  /** Foam collar width, in cells. */
  foamWidth: number;
  foamStrength: number;
  /** 0 is a hard edge (one pixel of AA); higher feathers it. */
  foamSoft: number;
  /** How far the waterline runs up and back, in cells. 0 is a static edge. */
  foamWave: number;
  foamWaveSpeed: number;
  /** The shore band pulsing toward the beach (v1 water item 3): its strength (0 off), how far out it starts (cells), and how many run in a second. */
  foamPulse: number;
  foamPulseReach: number;
  foamPulseSpeed: number;
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
  /** How much of the sky the water mirrors (Schlick's fresnel: little looking down into it, most toward the horizon), 0..1. */
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
  /** The big slow swell under the waves (v1 water item 4): its height (world units, faded out over the shallows), length and phase speed (rad/s). */
  swellHeight: number;
  swellLength: number;
  swellSpeed: number;
  /** How much lighter its crests and darker its troughs (0 none). */
  swellShade: number;
  /** Horizon haze: how much the far water takes the horizon's colour, from `hazeFrom` to `hazeTo` world units off. */
  haze: number;
  hazeFrom: number;
  hazeTo: number;
  /** Optional authored sea-normal detail, used by applicant ocean. */
  rippleStrength?: number;
}

/**
 * How deep the water is, `d` cells out from the waterline: the shallows (`bedDepth`, approached over `bedSlope`
 * cells), then past them the drop-off to the open sea (`shelfDepth` more, from `shelfFrom` to `shelfTo` cells out).
 * A river is never more than a few cells from a bank, so only the sea and the big bays reach the drop-off.
 *
 * The seabed mesh is built on this (lib/game/seabed.ts seabedDip) and the same values are baked into the water's
 * field (the depth channel), which is what the colour reads: one seabed, no second copy in GLSL to drift.
 *
 * `open` (0..1) is how much of the open sea's wide shallows (SHOAL) the water takes instead: 1 on the village's open
 * sea, 0 in a river or on any other island, between at a river's mouth.
 */
export function bedDepth(d: number, p: Pick<WaterParams, "bedDepth" | "bedSlope" | "shelfDepth" | "shelfFrom" | "shelfTo">, open = 0): number {
  const dd = Math.max(d, 0);
  const banks = p.bedDepth * (1 - Math.exp(-dd / Math.max(p.bedSlope, 0.01))) + p.shelfDepth * smooth01(p.shelfFrom, p.shelfTo, dd);
  if (open <= 0) return banks;
  const shoal = SHOAL.depth * (1 - Math.exp(-dd / SHOAL.slope)) + (p.bedDepth + p.shelfDepth - SHOAL.depth) * smooth01(SHOAL.from, SHOAL.to, dd);
  return banks + (shoal - banks) * Math.min(open, 1);
}
/**
 * The open sea's wide shallows (David, playtest round 1, 2026-10-14: "make the shallow water bigger area around main
 * island"): off a beach the bed eases down over `slope` cells to `depth`, sand you can see through the water out to
 * `from` cells, then drops off to the teal and the navy and the same open-sea floor by `to`. The old profile (a river's
 * banks) was teal under a cell out. The village's sea (lib/game/seabed.ts setShoal) and the smooth world's
 * (lib/game/world/convert.ts shelf) take it; the village map's edge is 8.5 cells off its beaches and the sea past it
 * reads the edge, so the navy must be there by then.
 */
export const SHOAL = { depth: 0.42, slope: 1.6, from: 4, to: 8.5 } as const;
function smooth01(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / Math.max(b - a, 1e-6)));
  return t * t * (3 - 2 * t);
}

/**
 * The colour ramp by depth (v1 water item 1, references/look/2026-10-13/water-foam-shallows-ref.png): `t` is how far
 * along it the depth is (1 − e^(−depth / depthFalloff)), and each stop eases in over its window of `t`: the shallow
 * sand-teal, the teal, the deep blue, the navy. MIRRORED by `waterRampAt` below; the windows print the GLSL.
 */
export const DEPTH_RAMP = [[0.0, 0.22], [0.18, 0.5], [0.45, 0.8], [0.75, 0.97]] as const;
const RAMP_STOPS = ["uShallowColor", "uMidColor", "uDeepColor", "uNavyColor"] as const;
export const WATER_DEPTH_RAMP = /* glsl */ `
vec3 waterRamp(float depth) {
  float t = 1.0 - exp(-max(depth, 0.0) / max(uDepthFalloff, 0.001));
  vec3 c = uBedColor;
${DEPTH_RAMP.map(([a, b], i) => `  c = mix(c, ${RAMP_STOPS[i]}, smoothstep(${a.toFixed(2)}, ${b.toFixed(2)}, t));`).join("\n")}
  return c;
}
`;
const _rampColor = new THREE.Color();
/** The water's colour `depth` world units over the bed, linear RGB (the shader's working space): WATER_DEPTH_RAMP on the CPU. */
export function waterRampAt(depth: number, p: Pick<WaterParams, "bedColor" | "shallowColor" | "midColor" | "deepColor" | "navyColor" | "depthFalloff">): [number, number, number] {
  const t = 1 - Math.exp(-Math.max(depth, 0) / Math.max(p.depthFalloff, 0.001));
  const c = _rampColor.setHex(p.bedColor).toArray() as [number, number, number];
  const stops = [p.shallowColor, p.midColor, p.deepColor, p.navyColor];
  DEPTH_RAMP.forEach(([a, b], i) => {
    const k = smooth01(a, b, t), s = _rampColor.setHex(stops[i]);
    c[0] += (s.r - c[0]) * k; c[1] += (s.g - c[1]) * k; c[2] += (s.b - c[2]) * k;
  });
  return c;
}

/** Every WaterParams key but rippleStrength, each the shader's `u<Key>` uniform (a Color when the key ends in Color). */
const WATER_KEYS = [
  "navyColor", "deepColor", "midColor", "shallowColor", "bedColor", "foamColor", "ringColor", "depthFalloff", "bedDepth", "bedSlope",
  "shelfDepth", "shelfFrom", "shelfTo",
  "foamWidth", "foamStrength", "foamSoft", "foamWave", "foamWaveSpeed", "foamPulse", "foamPulseReach", "foamPulseSpeed", "blobScale", "blobDarken", "blobSpeed", "ringWidth",
  "ringStrength", "shoreAlpha", "opacity", "fresnel", "glare", "roughness", "sunGlint", "sunSize", "waveHeight", "waveScale", "waveSpeed",
  "swellHeight", "swellLength", "swellSpeed", "swellShade", "haze", "hazeFrom", "hazeTo",
] as const satisfies readonly (keyof WaterParams)[];
const uniformOf = (k: string) => `u${k[0].toUpperCase()}${k.slice(1)}`;

export function waterUniforms(p: WaterParams) {
  const block: Record<string, THREE.IUniform> = {};
  for (const k of WATER_KEYS) block[uniformOf(k)] = { value: k.endsWith("Color") ? new THREE.Color(p[k]) : p[k] };
  return {
    ...block,
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    /** The key light's colour, so the glint turns gold at golden hour and blue under the moon. */
    uSunColor: { value: new THREE.Color(1, 0.98, 0.92) },
    /** The sky the water mirrors: overhead and at the horizon (the scene's sky, per phase and weather). */
    uSkyZenith: { value: new THREE.Color(0x4fb6f5) },
    uSkyHorizon: { value: new THREE.Color(0xa9dcf2) },
  };
}

/** Push a params block onto live uniforms without recompiling the shader. */
export function writeWaterUniforms(u: Record<string, THREE.IUniform>, p: WaterParams): void {
  for (const k of WATER_KEYS) {
    const uniform = u[uniformOf(k)];
    if (uniform.value instanceof THREE.Color) uniform.value.setHex(p[k]);
    else uniform.value = p[k];
  }
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
 * ── THE BENT SEA'S FOLD (David, playtest round 1, 2026-10-14) ──
 * "the sparkles in the distance sometimes gets folded in and you see 2x the sparkles". The world's bend
 * (curvedWorld.ts) sinks every point by its view-space distance squared, so far enough out the sea curves over the
 * horizon and faces away from the camera, and past that it projects back DOWN the screen, over the sea in front of it.
 * The water mesh there is a back face and is culled, but a sparkle is a point with no side, so the flat-sea optics
 * lit it again: a second row of sparkles folded under the first. So a sparkle fades as the bent sea under it turns
 * edge-on to the eye and is gone past the fold.
 *
 * `bentFacing`: at view-space point `v` (already bent, as project_vertex leaves it) on water whose flat normal is `up`
 * (world up in view space), the cosine between the bent surface's normal and the direction to the eye: the bend is
 * y -= bend·z² + side·x², so its normal is up tipped by the bend's slope (2·bend·z, 2·side·x). 0 on the fold, below 0
 * past it. MIRRORED in GLSL (`WATER_FOLD`).
 */
export const FOLD_FADE = 0.05;
export function bentFacing(v: Vec3, up: Vec3, bend: number, side: number): number {
  const n = unit([up[0] + 2 * side * v[0] * up[1], up[1], up[2] + 2 * bend * v[2] * up[1]]);
  return dot(n, unit([-v[0], -v[1], -v[2]]));
}
/** A sparkle's share left at that facing: none past the fold, all of it once the sea faces the eye by FOLD_FADE. */
export const foldFade = (facing: number) => smooth01(0, FOLD_FADE, facing);
/** `foldFade(bentFacing(mv, world up, bend, side))` for a vertex shader (viewMatrix is three's), with the bend in force. */
export const WATER_FOLD = (bend: number, side: number) => /* glsl */ `
float foldFade(vec3 mv) {
  vec3 up = (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
  vec3 n = vec3(up.x + ${(2 * side).toFixed(6)} * mv.x * up.y, up.y, up.z + ${(2 * bend).toFixed(6)} * mv.z * up.y);
  return smoothstep(0.0, ${FOLD_FADE.toFixed(3)}, dot(normalize(n), normalize(-mv)));
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
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
${WATER_KEYS.map(k => `uniform ${k.endsWith("Color") ? "vec3" : "float"} ${uniformOf(k)};`).join("\n")}
`;

/** How many foam rings the water has room for (lib/game/foamRings.ts FOAM_RING_SLOTS.high; Lite fills fewer). */
export const FOAM_RING_MAX = 32;
/**
 * Foam (v1 water item 3, references/look/2026-10-13/water-foam-shallows-ref.png):
 *  - `shorePulse`: a second line of foam that starts `uFoamPulseReach` cells out and runs in to the beach, swelling
 *    in and fading as it arrives, again and again; broken along the shore and offset by where it is, so the coast
 *    never pulses as one piece. World time and world position only.
 *  - `ringFoam`: a collar where something meets the water (lib/game/foamRings.ts: posts, rocks, hulls, waders), its
 *    edge wobbling round it, and a thin ring lapping out from it and fading. The nearest FOAM_RING_MAX to the view.
 * Time is wrapped on whole cycles before fract(), as WATER_PHASE does for sin(): uTime runs to a day of seconds.
 */
const WATER_FOAM = /* glsl */ `
uniform vec4 uFoamRings[${FOAM_RING_MAX}];
uniform int uFoamRingCount;
float shorePulse(float shore, vec2 xz, float px) {
  if (uFoamPulse <= 0.0 || shore < 0.0 || shore > uFoamPulseReach + 0.4) return 0.0;
  float speed = floor(uFoamPulseSpeed * 1000.0 + 0.5) / 1000.0;
  float drift = 0.25 * sin(xz.x * 0.21 + xz.y * 0.13) + 0.2 * sin(xz.y * 0.37 - xz.x * 0.17);
  float cyc = fract(mod(uTime, 1000.0) * speed + drift);
  float at = uFoamPulseReach * (1.0 - cyc);
  float band = 1.0 - smoothstep(0.035, 0.075 + px * 1.5, abs(shore - at));
  float broken = smoothstep(-0.25, 0.35, sin(xz.x * 1.3 + sin(xz.y * 0.9) * 2.0) * sin(xz.y * 1.1 + sin(xz.x * 0.7) * 2.0) + 0.35);
  return band * broken * smoothstep(0.0, 0.3, cyc) * (1.0 - smoothstep(0.78, 1.0, cyc)) * uFoamPulse;
}
float ringFoam(vec2 p, float px) {
  float f = 0.0;
  for (int i = 0; i < ${FOAM_RING_MAX}; i++) {
    if (i >= uFoamRingCount) break;
    vec4 ring = uFoamRings[i];
    vec2 d = p - ring.xy;
    float edge = length(d) - ring.z;
    if (edge > 0.9 || edge < -0.05) continue;
    float a = atan(d.y, d.x), seed = ring.x * 1.7 + ring.y * 2.3;
    float wob = 0.022 * sin(a * 5.0 + waterPhase(uTime * 1.2) + seed) + 0.016 * sin(a * 8.0 - waterPhase(uTime * 1.9) + seed * 1.3);
    float w = 0.06 + 0.06 * min(ring.z, 1.0);
    float collar = 1.0 - smoothstep(w - px, w + px, edge + wob);
    float cyc = fract(mod(uTime, 1000.0) * 0.45 + fract(seed * 0.13));
    float out_ = w + cyc * (0.3 + 0.35 * min(ring.z, 1.0));
    float pulse = (1.0 - smoothstep(0.012, 0.03 + px * 1.5, abs(edge + wob * 0.6 - out_))) * (1.0 - cyc) * (1.0 - cyc);
    f = max(f, max(collar, pulse * 0.8) * ring.w);
  }
  return f;
}
`;

/** The shading itself; `shoreDistance` comes from the baked field (SHORE_FROM_FIELD). */
const WATER_FUNCTIONS = /* glsl */ `
${WATER_PHASE}${WATER_DEPTH_RAMP}
// Irregular patches for the multiply layer. Four sines at mutually
// incommensurate rates, so the pattern has no period and never lines up into
// the plaid that two crossed waves give.
float blobField(vec2 p, float t) {
  vec2 q = p / max(uBlobScale, 0.01);
  float a = sin(q.x * 1.00 + waterPhase(t * 0.31)) * sin(q.y * 0.87 - waterPhase(t * 0.23));
  float b = sin((q.x + q.y) * 0.61 - waterPhase(t * 0.19)) * sin((q.x - q.y) * 0.53 + waterPhase(t * 0.27));
  return a * 0.6 + b * 0.4;
}
${WATER_OPTICS}${WATER_FOAM}`;

/**
 * Swell. Two waves at different angles and incommensurate frequencies, so the
 * surface is never uniformly up or down (David: "waves that aren't uniform").
 * Driven by WORLD position so adjacent cells agree at their shared edge and the
 * sheet stays continuous even though each cell is its own four vertices.
 *
 * Under them the big slow swell (v1 water item 4): one long wave rolling in off
 * the open sea on its own clock. It dies away over the shallows (a swell lifts
 * deep water; at the beach the waves' lap is the waterline), read off the water
 * field's depth, so the foam stays on the shore it outlines.
 *
 * The analytic gradient rides out as a varying: without it the swell would move
 * the surface without changing how it catches light, which reads as a sliding
 * texture rather than as water. Exported for the glint sprites
 * (GridOcean), which ride the same crests.
 */
const SWELL = { d1: [1, 0.35], d2: [-0.42, 1], k2: 1.63, s2: 1.31, w1: 0.62, w2: 0.38, d3: [0.8, -0.6], fade: [0.15, 1.2] } as const;
const f2 = (v: number) => v.toFixed(2);
export const WATER_SWELL = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveScale;
uniform float uWaveSpeed;
uniform float uSwellHeight;
uniform float uSwellLength;
uniform float uSwellSpeed;
uniform sampler2D uShoreMap;
uniform vec4 uShoreRect;
${WATER_PHASE}
float waterSwell(vec2 xz, out vec2 grad) {
  float k = 6.2831853 / max(uWaveScale, 0.001);
  vec2 d1 = normalize(vec2(${f2(SWELL.d1[0])}, ${f2(SWELL.d1[1])}));
  vec2 d2 = normalize(vec2(${f2(SWELL.d2[0])}, ${f2(SWELL.d2[1])}));
  float a1 = dot(xz, d1) * k + waterPhase(uTime * uWaveSpeed);
  float a2 = dot(xz, d2) * k * ${f2(SWELL.k2)} + waterPhase(uTime * uWaveSpeed * ${f2(SWELL.s2)});
  vec2 d3 = normalize(vec2(${f2(SWELL.d3[0])}, ${f2(SWELL.d3[1])}));
  float k3 = 6.2831853 / max(uSwellLength, 0.001);
  float a3 = dot(xz, d3) * k3 + waterPhase(uTime * uSwellSpeed);
  float h3 = uSwellHeight * smoothstep(${f2(SWELL.fade[0])}, ${f2(SWELL.fade[1])}, texture2D(uShoreMap, (xz - uShoreRect.xy) / uShoreRect.zw).g);
  grad = d1 * (cos(a1) * ${f2(SWELL.w1)} * k * uWaveHeight)
       + d2 * (cos(a2) * ${f2(SWELL.w2)} * k * ${f2(SWELL.k2)} * uWaveHeight)
       + d3 * (cos(a3) * k3 * h3);
  return (sin(a1) * ${f2(SWELL.w1)} + sin(a2) * ${f2(SWELL.w2)}) * uWaveHeight + sin(a3) * h3;
}
`;
/** The live uniforms WATER_SWELL reads (the water's own: pass waterSurfaceUniforms()). */
export const swellUniformsOf = (u: Record<string, THREE.IUniform>) => ({
  uTime: u.uTime, uWaveHeight: u.uWaveHeight, uWaveScale: u.uWaveScale, uWaveSpeed: u.uWaveSpeed,
  uSwellHeight: u.uSwellHeight, uSwellLength: u.uSwellLength, uSwellSpeed: u.uSwellSpeed, uShoreMap: u.uShoreMap, uShoreRect: u.uShoreRect,
});

const SW1 = Math.hypot(...SWELL.d1), SW2 = Math.hypot(...SWELL.d2), SW3 = Math.hypot(...SWELL.d3);
const D1X = SWELL.d1[0] / SW1, D1Z = SWELL.d1[1] / SW1, D2X = SWELL.d2[0] / SW2, D2Z = SWELL.d2[1] / SW2, D3X = SWELL.d3[0] / SW3, D3Z = SWELL.d3[1] / SW3;
const wrapPhase = (v: number) => v - 6.2831853 * Math.floor(v / 6.2831853);
/** The share of the swell's height that reaches water `depth` deep (it dies away over the shallows). */
export const swellFade = (depth: number) => smooth01(SWELL.fade[0], SWELL.fade[1], depth);
/**
 * WATER_SWELL on the CPU, for what floats on the water (the boat, the buoys; arrival-wharf.md): the surface's rise at
 * world (x, z) at world time `t` (the shader's uTime), and its slope (∂h/∂x, ∂h/∂z) into `grad`. The same constants
 * print the shader, so the two cannot drift apart; read the live `p` from the water's uniforms
 * (components/game/grid/terrainMaterials.ts waterSurfaceUniforms) to ride the waves as drawn. `depth`: the water's
 * depth there (the swell fades over the shallows); floats ride deep water, so by default all of it.
 */
export function waterSwellAt(x: number, z: number, t: number, p: Pick<WaterParams, "waveHeight" | "waveScale" | "waveSpeed" | "swellHeight" | "swellLength" | "swellSpeed">, grad?: { x: number; z: number }, depth = Infinity): number {
  const k = 6.2831853 / Math.max(p.waveScale, 0.001), h = p.waveHeight;
  const a1 = (x * D1X + z * D1Z) * k + wrapPhase(t * p.waveSpeed);
  const a2 = (x * D2X + z * D2Z) * k * SWELL.k2 + wrapPhase(t * p.waveSpeed * SWELL.s2);
  const k3 = 6.2831853 / Math.max(p.swellLength, 0.001), h3 = p.swellHeight * swellFade(depth);
  const a3 = (x * D3X + z * D3Z) * k3 + wrapPhase(t * p.swellSpeed);
  if (grad) {
    const c1 = Math.cos(a1) * SWELL.w1 * k * h, c2 = Math.cos(a2) * SWELL.w2 * k * SWELL.k2 * h, c3 = Math.cos(a3) * k3 * h3;
    grad.x = D1X * c1 + D2X * c2 + D3X * c3;
    grad.z = D1Z * c1 + D2Z * c2 + D3Z * c3;
  }
  return (Math.sin(a1) * SWELL.w1 + Math.sin(a2) * SWELL.w2) * h + Math.sin(a3) * h3;
}

const VERTEX_DECLS = /* glsl */ `
varying vec3 vWaterWorld;
varying vec2 vWaterGrad;
varying float vWaterRise;
${WATER_SWELL}`;

const VERTEX_BODY = /* glsl */ `
{
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  float h = waterSwell(wp.xz, vWaterGrad);
  transformed.y += h;
  vWaterWorld = wp;
  vWaterWorld.y += h;
  vWaterRise = h;
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
  // How deep the water is here: the known seabed (the bake's depth channel, the same seabed the bed mesh is built
  // on) under the surface as the swell has it now. No depth pass: the bed's height is known, so the depth is too.
  float depth = max(waterDepthAt(vWaterWorld.xz) + vWaterRise, 0.0);
  float t = 1.0 - exp(-depth / max(uDepthFalloff, 0.001));

  vec3 col = waterRamp(depth);


  // MULTIPLY layer, then the two ADD layers that ring it. Straight out of the
  // tutorial in David's image 15.
  float field = blobField(vWaterWorld.xz, uTime * uBlobSpeed);
  float blob = smoothstep(-0.05, 0.25, field);
  col *= mix(1.0, uBlobDarken, blob);
  float w = max(uRingWidth, 0.001);
  float ringA = 1.0 - smoothstep(0.0, w, abs(field - 0.10));
  float ringB = 1.0 - smoothstep(0.0, w * 2.2, abs(field + 0.30));
  col += uRingColor * (ringA * uRingStrength + ringB * uRingStrength * 0.45);

  // Surface normal from the swell gradient and the ripple texture, in world
  // space. cameraPosition is a built-in, so no view-space bookkeeping.
  vec2 detailNormal = waterDetailNormal(vWaterWorld.xz);
  vec3 N = normalize(vec3(-vWaterGrad.x + detailNormal.x, 1.0, -vWaterGrad.y + detailNormal.y));
  vec3 V = normalize(cameraPosition - vWaterWorld);

  // The real sun off the ripples too small to draw (glareLobe, see WATER_OPTICS
  // in TS): a sheet around the mirror point, pushed past 1.0 so it clips to
  // white. The sharp points inside it are the sparkle sprites (GridOcean).
  float glare = glareLobe(uSunDir, cameraPosition, vWaterWorld, N, uRoughness) * sunThroughClouds(vWaterWorld.xz);

  // The big swell's crests catch a little more light than its troughs (v1 water item 4).
  col *= 1.0 + uSwellShade * clamp(vWaterRise / max(uWaveHeight + uSwellHeight, 1e-3), -1.0, 1.0);

  // The sky in the water (v1 water item 4): Schlick's fresnel, so looking down
  // into the shallows you see through them and toward the horizon the sea
  // mirrors the sky, the zenith's colour where the reflection looks up.
  float NdotV = clamp(dot(N, V), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);
  vec3 R = reflect(-V, N);
  vec3 skyCol = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.65, R.y));
  col = mix(col, skyCol, clamp(fres * uFresnel, 0.0, 1.0));

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
  // The band running in to the beach, and the collars round what stands in the water (v1 water item 3).
  float px = max(length(fwidth(vWaterWorld.xz)), 1e-4) * 0.7;
  foam = max(foam, shorePulse(shore, vWaterWorld.xz, px) * uFoamStrength);
  foam = max(foam, ringFoam(vWaterWorld.xz, px));

  col += uSunColor * glare * uGlare * (1.0 - foam);
  col = mix(col, uFoamColor, foam);

  // Horizon haze: the far sea takes the horizon's colour before the scene's fog
  // takes everything, so the sea meets the sky softly (v1 water item 4).
  float haze = uHaze * smoothstep(uHazeFrom, uHazeTo, length(cameraPosition.xz - vWaterWorld.xz));
  col = mix(col, uSkyHorizon, haze);

  diffuseColor.rgb = col;
  // Clear enough over the shallows to show the bed, opaque once the ramp has
  // done its work. This is the other half of selling absorption: a uniformly
  // translucent sheet reads as coloured glass. (The bed under it is fogged
  // toward the same ramp by its own depth, UNDERWATER, so the two agree.)
  diffuseColor.a = mix(uShoreAlpha, uOpacity, smoothstep(0.0, 0.8, t));
  diffuseColor.a = mix(diffuseColor.a, 1.0, max(foam, haze));
}
`;

/**
 * The ripple normal (xz slope) at a world point and time. Shared with the sparkle sprites, which need the same
 * waves. The scroll is `fract`ed: uTime is world seconds (up to a day), and the texture repeats, so the wrap is seamless.
 */
export const WATER_RIPPLE = /* glsl */ `
uniform sampler2D uRippleTexture;
uniform float uRippleStrength;
vec2 waterDetailNormal(vec2 xz) {
  if (uRippleStrength <= 0.0) return vec2(0.0);
  vec2 a = texture2D(uRippleTexture, xz * 0.22 + fract(uTime * vec2(0.014, 0.009))).rg * 2.0 - 1.0;
  vec2 b = texture2D(uRippleTexture, xz.yx * 0.31 - fract(uTime * vec2(0.008, 0.011))).rg * 2.0 - 1.0;
  return (a + b * 0.5) * uRippleStrength;
}
`;

/**
 * The water material: an unlit MeshBasicMaterial with the shore distance read
 * from the baked field (SHORE_FROM_FIELD) and the ripple normal. Transparent
 * over its bed, so it must not write depth: it would z-fight the bed and hide
 * it outright. `uniforms` is the shared live block the frame loop writes.
 */
export function waterMaterial(uniforms: Record<string, THREE.IUniform>): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + VERTEX_DECLS)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERTEX_BODY);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWaterWorld;\nvarying vec2 vWaterGrad;\nvarying float vWaterRise;\n" +
          UNIFORM_DECLS +
          WATER_CLOUDS +
          SHORE_FROM_FIELD +
          WATER_RIPPLE +
          WATER_FUNCTIONS
      )
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + FRAGMENT_BODY);
  };
  mat.customProgramCacheKey = () => "water";
  return mat;
}

/**
 * The baked water field (components/game/grid/terrainMaterials.ts setShoreField): red is the distance to the shore in
 * cells (positive over water), green how deep the seabed lies under the still surface there (lib/game/seabed.ts).
 */
export const SHORE_FROM_FIELD = /* glsl */ `
uniform sampler2D uShoreMap;
uniform vec4 uShoreRect;
float shoreDistance(vec2 xz) {
  return texture2D(uShoreMap, (xz - uShoreRect.xy) / uShoreRect.zw).r;
}
float waterDepthAt(vec2 xz) {
  return texture2D(uShoreMap, (xz - uShoreRect.xy) / uShoreRect.zw).g;
}
`;

/**
 * Under the water (v1 water item 1): what lies on the seabed (the bed itself, the plants and rocks, the fish) is seen
 * through the depth of water over it, so its lit colour fogs toward the water's own ramp by that depth, the way the
 * reference's sand goes teal and then blue as the land drops away. Needs SHORE_FROM_FIELD, WATER_DEPTH_RAMP and the
 * ramp's uniforms (UNDERWATER_UNIFORMS). `depth`: world units of water above the point.
 */
export const UNDERWATER = /* glsl */ `
uniform float uUnderwaterFog;
vec3 underwater(vec3 lit, float depth) {
  float t = 1.0 - exp(-max(depth, 0.0) / max(uDepthFalloff, 0.001));
  return mix(lit, waterRamp(depth), clamp(t * uUnderwaterFog, 0.0, 1.0));
}
`;
/**
 * Glass water (v1 water item 5, High only): what lies under the surface wobbles as the moving surface refracts it.
 * No copy of the frame and no extra pass: the bed shifts its own texture lookup, and the props and fish their own
 * vertices, by the surface's slope where they are (the ripple normal the water draws, plus a short refraction wave on
 * the world clock), more the deeper they lie. Needs `uniform float uTime` and WATER_RIPPLE before it. `uGlass` 0
 * turns it off (Lite, or the player's toggle) at the cost of one uniform branch.
 */
export const GLASS_WATER = /* glsl */ `
uniform float uGlass;
vec2 glassShift(vec2 xz, float depth) {
  if (uGlass <= 0.0) return vec2(0.0);
  vec2 n = waterDetailNormal(xz);
  vec2 w = vec2(sin(xz.y * 2.3 + mod(uTime * 1.7, 6.2831853)), sin(xz.x * 2.1 + 1.3 - mod(uTime * 1.3, 6.2831853))) * 0.05;
  return (n * 0.8 + w) * min(depth, 1.5) * 0.35 * uGlass;
}
`;
/** The uniforms UNDERWATER reads, declared (the live values are the water's: waterSurfaceUniforms). */
export const UNDERWATER_UNIFORMS = /* glsl */ `
uniform float uDepthFalloff;
uniform vec3 uBedColor;
uniform vec3 uShallowColor;
uniform vec3 uMidColor;
uniform vec3 uDeepColor;
uniform vec3 uNavyColor;
`;
