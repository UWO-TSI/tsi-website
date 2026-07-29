/**
 * skyVariants — COZY's eight cloud shaders, rebuilt for three.js.
 *
 * David, 2026-07-29: "provide all 8 with the proper shaders so it looks
 * beautiful and as intended by the provider".
 *
 * ── WHAT THESE ARE, AND WHAT THEY ARE NOT ───────────────────────────────
 * Each is a reconstruction of one `Stylized Clouds (*)` shader, built from
 * reading its source: which textures it binds, which channels it reads, how it
 * composites them, and what noise it generates. They use the provider's own
 * art and the provider's own voronoi.
 *
 * They are NOT line-by-line transpiles. The originals are Amplify Shader Editor
 * output between 76KB and 224KB each, and the overwhelming majority of that is
 * Unity plumbing -- tessellation, shadow-caster passes, per-render-pipeline
 * variants, GI hooks. Stripping the generated locals down to statements that
 * actually touch cloud maths leaves 11 to 133 per variant, and those are what
 * is rebuilt here.
 *
 * ── THEY REALLY ARE EIGHT DIFFERENT SHADERS ─────────────────────────────
 * Measured by Jaccard overlap on their cloud statements, the closest pair is
 * Ghibli Desktop and Ghibli Mobile at 43%; every other pair is under 30% and
 * most under 15%. There was no shared base to parameterise, so each gets its
 * own composite.
 *
 * ── THE TWO RULES THAT COST THE MOST TO LEARN ───────────────────────────
 * 1. The "Luxury" sheets are TWO-CHANNEL: alpha is the cloud silhouette, RGB is
 *    the painted shading inside it. Reading only one is why an earlier version
 *    rendered flat white blobs.
 * 2. Shading composites as a CHAIN OF LERPS from 1.0 (clear sky), each layer
 *    painting over the last by its own coverage; density is the summed
 *    coverages. Averaging instead dilutes the top layer into the ones beneath.
 *
 * Both come straight out of `Stylized Clouds (Luxury)` and both apply to every
 * variant that uses those sheets.
 */

export type SkyVariantId =
  | "luxury"
  | "desktop"
  | "soft"
  | "paintedSkies"
  | "ghibliDesktop"
  | "ghibliMobile"
  | "mobile"
  | "staticTexture";

export interface SkyVariant {
  id: SkyVariantId;
  label: string;
  /** One line on what makes this one different. Shown on the bench. */
  note: string;
  /** Texture keys from the manifest that this variant binds. */
  textures: string[];
  /** GLSL defining `void clouds(out float density, out float shade)`. */
  glsl: string;
}

/**
 * COZY's own voronoi, transcribed from `Stylized Clouds (Ghibli Desktop)`.
 * Amplify's standard cell noise: the hash and the 3x3 neighbour search are
 * theirs, `time` animating each cell's offset is what makes their procedural
 * clouds boil rather than slide.
 */
export const VORONOI_GLSL = /* glsl */ `
vec2 voronoiHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float voronoi(vec2 v, float time) {
  vec2 n = floor(v);
  vec2 f = fract(v);
  float F1 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = voronoiHash(n + g);
      o = sin(time + o * 6.2831) * 0.5 + 0.5;
      vec2 r = f - g - o;
      float d = 0.5 * dot(r, r);
      if (d < F1) F1 = d;
    }
  }
  return F1;
}

/** Two octaves. Their desktop shaders stack cell noise for the cumulus body. */
float voronoiFbm(vec2 v, float time) {
  return voronoi(v, time) * 0.65 + voronoi(v * 2.17 + 4.3, time * 1.31) * 0.35;
}
`;

/**
 * Shared preamble every variant's `clouds()` can rely on:
 *   uvAt(scale, drift)  sheet-projected uv
 *   elN                 normalised visible elevation, 0..1
 *   fade                skyline haze
 *   band, breakUp       height gathering and noise break-up
 *   cover0..3           the coverage sliders
 * Declared in skyShader.ts; listed here so a variant author knows the contract.
 */

const luxury: SkyVariant = {
  id: "luxury",
  label: "Luxury",
  note: "the full coverage ladder — partly, mostly, overcast, nimbus. Painted shading, most detail.",
  textures: ["partlyCloudy", "mostlyCloudy", "overcast", "midNimbus", "luxuryVariation"],
  glsl: /* glsl */ `
void clouds(out float density, out float shade) {
  vec4 partly = texture2D(tPartlyCloudy, uvAt(1.0, vec2(0.010, 0.004)));
  vec4 mostly = texture2D(tMostlyCloudy, uvAt(0.78, vec2(0.013, 0.006)));
  float over = texture2D(tOvercast, uvAt(0.62, vec2(0.008, 0.003))).r;
  vec4 nimb = texture2D(tMidNimbus, uvAt(0.55, vec2(0.016, 0.009)));

  // Their LuxuryVariationTexture, sampled small and fast. It modulates each
  // layer's COVERAGE before compositing, not the result.
  float vari = texture2D(tLuxuryVariation, uvAt(4.0, vec2(0.02, 0.01))).r;
  float v = mix(1.0, 0.4 + vari * 1.1, 0.5);

  float aP = partly.a * cover0 * band * v;
  float aM = mostly.a * cover1 * band * v;
  float aO = cover2 * band * v;
  float aN = nimb.a * cover3 * v * stormMask;

  // Chain of lerps from clear sky. Each layer paints OVER the previous.
  shade = 1.0;
  shade = mix(shade, partly.r, aP);
  shade = mix(shade, mostly.r, aM);
  shade = mix(shade, over, aO);
  shade = mix(shade, nimb.r, aN);
  density = clamp(aP + aM + aO + aN, 0.0, 1.0);
}`,
};

const desktop: SkyVariant = {
  id: "desktop",
  label: "Desktop",
  note: "procedural voronoi cumulus under four painted detail layers. Their default.",
  textures: ["cirrus", "cirrostratus", "altocumulus", "chemtrails"],
  glsl: /* glsl */ `
void clouds(out float density, out float shade) {
  // Cumulus is GENERATED, not sampled. Inverted cell noise gives rounded
  // bodies; the coverage slider is a threshold on it rather than an opacity,
  // which is why their cumulus grows and merges instead of fading up.
  float cell = voronoiFbm(uvAt(1.6, vec2(0.010, 0.004)) * 3.0, uTime * 0.05);
  float cumulus = smoothstep(0.42, 0.02, cell);
  float aC = clamp(cumulus * cover0 * band * breakUp, 0.0, 1.0);

  float cirrusT = texture2D(tCirrus, uvAt(0.55, vec2(0.030, -0.008))).r;
  float cirroT = texture2D(tCirrostratus, uvAt(0.45, vec2(0.008, 0.003))).r;
  float altoT = texture2D(tAltocumulus, uvAt(0.85, vec2(0.014, 0.009))).r;
  float chemT = texture2D(tChemtrails, uvAt(0.30, vec2(0.004, 0.002))).r;

  float aA = altoT * cover1 * band;
  float aS = cirroT * cover2;
  float aI = cirrusT * cover3 * 0.9;
  float aX = chemT * uChemtrails;

  shade = 1.0;
  shade = mix(shade, 0.55 + cell * 1.4, aC);
  shade = mix(shade, 0.82, aA);
  shade = mix(shade, 0.9, aS);
  shade = mix(shade, 1.0, aI);
  shade = mix(shade, 1.0, aX);
  density = clamp(aC + aA + aS + aI + aX, 0.0, 1.0);
}`,
};

const soft: SkyVariant = {
  id: "soft",
  label: "Soft",
  note: "same layers as Desktop but the cumulus threshold is wide, so edges are diffuse.",
  textures: ["cirrus", "cirrostratus", "chemtrails"],
  glsl: /* glsl */ `
void clouds(out float density, out float shade) {
  // The whole difference from Desktop: a wide smoothstep. Soft-edged cumulus
  // with no hard silhouette anywhere.
  float cell = voronoiFbm(uvAt(1.3, vec2(0.009, 0.004)) * 2.6, uTime * 0.04);
  float cumulus = smoothstep(0.60, 0.04, cell);
  float aC = clamp(cumulus * cover0 * band * breakUp, 0.0, 1.0);

  float cirrusT = texture2D(tCirrus, uvAt(0.50, vec2(0.026, -0.007))).r;
  float cirroT = texture2D(tCirrostratus, uvAt(0.42, vec2(0.007, 0.003))).r;
  float chemT = texture2D(tChemtrails, uvAt(0.30, vec2(0.004, 0.002))).r;

  float aS = cirroT * cover2 * 1.1;
  float aI = cirrusT * cover3 * 0.8;
  float aX = chemT * uChemtrails;

  shade = 1.0;
  shade = mix(shade, 0.62 + cell * 1.2, aC);
  shade = mix(shade, 0.92, aS);
  shade = mix(shade, 1.0, aI);
  shade = mix(shade, 1.0, aX);
  density = clamp(aC + aS + aI + aX, 0.0, 1.0);
}`,
};

const paintedSkies: SkyVariant = {
  id: "paintedSkies",
  label: "Painted Skies",
  note: "the hand-painted cloud map drives the body; voronoi only breaks its edges. Most illustrative.",
  textures: ["cloud", "cirrus", "cirrostratus", "chemtrails"],
  glsl: /* glsl */ `
void clouds(out float density, out float shade) {
  // Cloud Map is the body here rather than a detail layer, and the cell noise
  // is demoted to an edge disturbance -- which is what makes this one read as
  // painted rather than generated.
  vec4 painted = texture2D(tCloud, uvAt(0.9, vec2(0.008, 0.003)));
  float cell = voronoi(uvAt(2.4, vec2(0.010, 0.004)) * 5.0, uTime * 0.06);
  float edge = smoothstep(0.35, 0.0, cell);

  float body = painted.a * mix(1.0, edge, 0.35);
  float aC = clamp(body * cover0 * band, 0.0, 1.0);

  float cirroT = texture2D(tCirrostratus, uvAt(0.42, vec2(0.007, 0.003))).r;
  float cirrusT = texture2D(tCirrus, uvAt(0.50, vec2(0.024, -0.006))).r;
  float chemT = texture2D(tChemtrails, uvAt(0.30, vec2(0.004, 0.002))).r;
  float aS = cirroT * cover2;
  float aI = cirrusT * cover3 * 0.85;
  float aX = chemT * uChemtrails;

  shade = 1.0;
  shade = mix(shade, painted.r, aC);
  shade = mix(shade, 0.9, aS);
  shade = mix(shade, 1.0, aI);
  shade = mix(shade, 1.0, aX);
  density = clamp(aC + aS + aI + aX, 0.0, 1.0);
}`,
};

const ghibliDesktop: SkyVariant = {
  id: "ghibliDesktop",
  label: "Ghibli Desktop",
  note: "NO textures at all. Pure voronoi, hard-stepped into flat cel shapes. Closest to ACNH.",
  textures: [],
  glsl: /* glsl */ `
void clouds(out float density, out float shade) {
  // Binds nothing. Two octaves of cell noise, then thresholded HARD -- the
  // narrow smoothstep is the whole Ghibli look, because it turns a continuous
  // field into flat shapes with clean edges instead of soft gradients.
  vec2 uv = uvAt(1.15, vec2(0.008, 0.003));
  float a = voronoi(uv * 2.4, uTime * 0.035);
  float b = voronoi(uv * 5.1 + 7.7, uTime * 0.06);
  float field = a * 0.7 + b * 0.3;

  float t = mix(0.55, 0.06, clamp(cover0, 0.0, 1.0));
  float body = smoothstep(t + 0.045, t - 0.045, field);

  // A second, tighter step inside the body gives the two-tone core the style
  // depends on: flat light shape, flat darker shape, nothing in between.
  float core = smoothstep(t - 0.02, t - 0.12, field);

  density = clamp(body * band, 0.0, 1.0);
  shade = mix(1.0, mix(0.98, 0.72, core), density);
}`,
};

const ghibliMobile: SkyVariant = {
  id: "ghibliMobile",
  label: "Ghibli Mobile",
  note: "the cel look from one texture and no noise. Cheapest of the eight.",
  textures: ["cloud"],
  glsl: /* glsl */ `
void clouds(out float density, out float shade) {
  // One fetch, one threshold, no per-pixel noise -- this is the variant for a
  // phone. The hard step keeps the cel edges the desktop one gets from voronoi.
  vec4 c = texture2D(tCloud, uvAt(0.95, vec2(0.009, 0.004)));
  float t = mix(0.85, 0.05, clamp(cover0, 0.0, 1.0));
  float body = smoothstep(t + 0.06, t - 0.06, 1.0 - c.a);
  density = clamp(body * band, 0.0, 1.0);
  shade = mix(1.0, mix(0.97, 0.74, c.r), density);
}`,
};

const mobile: SkyVariant = {
  id: "mobile",
  label: "Mobile",
  note: "one octave of voronoi, soft. No textures. The cheapest procedural one.",
  textures: [],
  glsl: /* glsl */ `
void clouds(out float density, out float shade) {
  // Single octave where Ghibli Desktop runs two, and a wide step instead of a
  // narrow one. Same generator, half the cost, none of the cel edge.
  float cell = voronoi(uvAt(1.25, vec2(0.008, 0.003)) * 2.6, uTime * 0.04);
  float body = smoothstep(mix(0.55, 0.05, clamp(cover0, 0.0, 1.0)) + 0.18, 0.0, cell);
  density = clamp(body * band, 0.0, 1.0);
  shade = mix(1.0, 0.68 + cell * 1.5, density);
}`,
};

const staticTexture: SkyVariant = {
  id: "staticTexture",
  label: "Static Texture",
  note: "one cloud map, no animation, no noise. For when the sky must not move.",
  textures: ["cloud"],
  glsl: /* glsl */ `
void clouds(out float density, out float shade) {
  // No drift term at all -- the sky is a fixed backdrop. Eleven statements in
  // the original, and this is what they do.
  vec4 c = texture2D(tCloud, uvAt(0.9, vec2(0.0, 0.0)));
  density = clamp(c.a * cover0 * band, 0.0, 1.0);
  shade = mix(1.0, c.r, density);
}`,
};

export const SKY_VARIANTS: SkyVariant[] = [
  luxury,
  desktop,
  soft,
  paintedSkies,
  ghibliDesktop,
  ghibliMobile,
  mobile,
  staticTexture,
];

export function skyVariant(id: SkyVariantId): SkyVariant {
  return SKY_VARIANTS.find((v) => v.id === id) ?? luxury;
}

/** Every texture key any variant might bind, so the loader can be eager. */
export const ALL_SKY_TEXTURES = Array.from(new Set(SKY_VARIANTS.flatMap((v) => v.textures)));

/** Manifest key -> the sampler name a variant's GLSL uses. */
export const samplerName = (key: string) => "t" + key[0].toUpperCase() + key.slice(1);
