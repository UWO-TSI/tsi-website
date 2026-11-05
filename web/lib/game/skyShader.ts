/**
 * skyShader: the sky dome (sky-ambient round 2, specs/sky-ambient.md §R2). David, round 1: "i want you to properly
 * redesign the sky use proper sky box and design techniques", "take the sky design seriously because thats where the
 * feeling comes from and the lighting". Everything is drawn from maths, nothing from a picture, so it stays crisp at
 * any resolution:
 *
 * - **The air:** Earth's atmosphere by single scattering (lib/game/atmosphere.ts), integrated per vertex of a dome
 *   whose rings crowd the horizon, the phase functions per pixel. The real sun's height and bearing make the blue
 *   noon, the gold and rose of a low sun, the Earth's shadow and the belt of Venus at dusk, and the violet twilight.
 *   The moon scatters the same way, by its phase, so a full moon makes a blue night and a new moon a dark one.
 * - **The sun and the moon** as discs with antialiased edges a pixel wide. The moon is a lit sphere: the real sun
 *   lights it from where it really is, so its phase and the tilt of its terminator follow the calendar.
 * - **The stars:** points hashed on the celestial sphere (two layers: many faint, a few bright with a soft four-point
 *   sparkle), a pixel across at any resolution, twinkling gently, turning with the sidereal time; the Milky Way along
 *   the real galactic plane; a shooting star now and then. A bright moon washes the faint ones out.
 * - **The clouds:** a cumulus layer ray-marched as a heightfield (flat bases 1.5 km up, rounded tops), lit by the sun
 *   through the air (gold at sunset, its light from atmosphere.ts) and by the sky's own colour, shadowing themselves,
 *   silver-edged toward the sun, hazing into the distance; thin cirrus higher up that stays lit after sunset. The
 *   weather sets how many, how thick and how grey.
 *
 * The dome is drawn after everything opaque, at the far plane, so only the pixels where sky shows pay for it.
 */

import * as THREE from "three";
import { ATMOSPHERE_GLSL } from "./atmosphere";
import { CLOUD_BASE, CLOUD_MAX, CLOUD_TEXELS, LOBES, SKY_BEND_GLSL } from "./clouds";

/**
 * How the cumulus are drawn (round 3's three directions, specs/sky-ambient.md §R3; development switch `?clouds=`):
 * `painted` in the dome itself, flat shapes lit as volumes; `models`, stylised meshes lit by the sun (SkyClouds.tsx);
 * `sprites`, cards that carry each shape's baked normals and thickness, lit live (SkyClouds.tsx); `traced`, round 2's
 * ray-traced balls (for the comparison only).
 */
export type CloudStyle = "painted" | "models" | "sprites" | "traced";
export const CLOUD_STYLES: readonly CloudStyle[] = ["painted", "models", "sprites", "traced"];
/** The style the game draws (the lab's `?clouds=` overrides it in development). */
export const CLOUD_STYLE: CloudStyle = "sprites";
/** The clouds' rows (clouds.ts cloudField), written by SkyDome each frame and read by every style. */
export const cloudData = new Float32Array(CLOUD_TEXELS * CLOUD_MAX * 4);
export const cloudTexture = new THREE.DataTexture(cloudData, CLOUD_TEXELS, CLOUD_MAX, THREE.RGBAFormat, THREE.FloatType);
cloudTexture.magFilter = cloudTexture.minFilter = THREE.NearestFilter;

/**
 * Held module-side so the frame loop can write without React seeing it (the react-compiler lint rejects mutating
 * anything a hook returned). SkyDome writes them every frame; the title writes `uStarry`.
 */
export const skyUniforms = {
  uTime: { value: 0 },
  /** The real sun and moon, world directions (below the horizon too), and where the dome draws them (clouds.ts skyBend). */
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uMoonDir: { value: new THREE.Vector3(0, 0.4, 0.9).normalize() },
  uSunDraw: { value: new THREE.Vector3(0, 1, 0) },
  uMoonDraw: { value: new THREE.Vector3(0, 0.4, 0.9).normalize() },
  /** How far the sky's skyline is drawn below the true horizon (radians), to meet the curved world's sea (clouds.ts). */
  uDip: { value: 0.3 },
  /** The moon's light on the air (its lit share times its strength), and the share of its disc lit. */
  uMoonE: { value: 0 },
  uExposure: { value: 20 },
  /** 0 by day to 1 in full night: the night's own sky colour, and the stars. */
  uNight: { value: 0 },
  uNightTop: { value: new THREE.Color(0x07112c) },
  uNightHorizon: { value: new THREE.Color(0x1a2c4a) },
  /** The sun's disc colour (through the air) and the stars' visibility (less under a bright moon). */
  uSunDisc: { value: new THREE.Color(1, 1, 1) },
  uStarVis: { value: 0 },
  /** The title's starry night: 0 the game's sky, 1 its stars brighter and twinkling more, its clouds thinned. */
  uStarry: { value: 0 },
  /** The stars' size in the canvas's pixels (the lab's lighter pixel finish on the sky draws them at 1.8 of its finer ones). */
  uStarPx: { value: 1 },
  /** World to the equatorial frame (atmosphere.ts starFrame). */
  uStarRot: { value: new THREE.Matrix3() },
  /** The camera's right and up, world: the bright stars' sparkle lies along the screen. */
  uCamRight: { value: new THREE.Vector3(1, 0, 0) },
  uCamUp: { value: new THREE.Vector3(0, 1, 0) },
  /** The scene's fog colour: the skyline and below it meet the fogged sea in it. */
  uFog: { value: new THREE.Color() },
  /** Cumulus cover (the share of squares with a cloud), their size (km), how grey (0 white to 1 overcast), cirrus (0..1). */
  uCloud: { value: new THREE.Vector4(0.45, 1.1, 0, 0.5) },
  /** Haze at the skyline (fog days), 0..1. */
  uHaze: { value: 0 },
  /** How far the wind has carried the clouds, km (wrapped). */
  uDrift: { value: new THREE.Vector2() },
  /** Light on the clouds: the sun's and the moon's (through the air), the sky's from above and below, and the cirrus's. */
  uSunLight: { value: new THREE.Color(1, 1, 1) },
  uMoonLight: { value: new THREE.Color(0, 0, 0) },
  uAmbTop: { value: new THREE.Color(0.3, 0.5, 0.9) },
  uAmbBottom: { value: new THREE.Color(0.4, 0.5, 0.6) },
  uCirrusLight: { value: new THREE.Color(1, 1, 1) },
  /** The clear sky overhead and at the skyline (graded): what far clouds haze into. */
  uSkyTop: { value: new THREE.Color(0.3, 0.6, 0.9) },
  uSkyHorizon: { value: new THREE.Color(0.75, 0.85, 0.95) },
  /** The clouds (clouds.ts): their rows and how many are in view. */
  uCloudTex: { value: cloudTexture },
  uCloudN: { value: 0 },
};

/** The dome's angular sizes (radians): drawn larger than life so the pixel finish still shows them round. */
export const SUN_RADIUS = 0.02, MOON_RADIUS = 0.034;
/**
 * Round 2's traced cumulus: one cloud's square (km) and the balls in it; the drift wraps at a multiple of the squares
 * (the shader's noise for the deck and the cirrus is smooth across the wrap's rare jump).
 */
export const CLOUD_CELL = 2, PUFFS = 6, DRIFT_WRAP = 2600;

const VERT = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uMoonE;
varying vec3 vDir;
varying vec3 vDraw;
varying vec3 vRay;
varying vec3 vMie;
varying vec3 vAmb;
varying vec3 vRayM;
varying vec3 vMieM;
${ATMOSPHERE_GLSL}
${SKY_BEND_GLSL}
void main() {
  // The dome is pinned to the camera, so its object-space direction is a world direction: the true one for the air,
  // and where it is drawn (lowered toward the skyline to meet the curved world's sea, the same for every view).
  vDir = normalize(position);
  vDraw = skyBend(vDir);
  vec3 r = vec3(0.0), m = vec3(0.0), a = vec3(0.0);
  if (uSunDir.y > -0.25) atmosphere(vDir, uSunDir, r, m, a);
  vRay = r; vMie = m; vAmb = a;
  r = vec3(0.0); m = vec3(0.0);
  if (uMoonE > 0.0 && uMoonDir.y > -0.1) atmosphere(vDir, uMoonDir, r, m, a);
  vRayM = r; vMieM = m;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vDraw * length(position), 1.0);
  // At the far plane (a hair inside it, so it is never clipped): drawn last among the opaque, it only shades where
  // nothing else is.
  gl_Position.z = gl_Position.w * 0.999999;
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunDraw;
uniform vec3 uMoonDraw;
uniform float uMoonE;
uniform float uExposure;
uniform float uNight;
uniform vec3 uNightTop;
uniform vec3 uNightHorizon;
uniform vec3 uSunDisc;
uniform float uStarVis;
uniform float uStarry;
uniform float uStarPx;
uniform mat3 uStarRot;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uFog;
uniform vec4 uCloud;
uniform float uHaze;
uniform vec2 uDrift;
uniform vec3 uSunLight;
uniform vec3 uMoonLight;
uniform vec3 uAmbTop;
uniform vec3 uAmbBottom;
uniform vec3 uCirrusLight;
uniform highp sampler2D uCloudTex;
uniform int uCloudN;
varying vec3 vDir;
varying vec3 vDraw;
varying vec3 vRay;
varying vec3 vMie;
varying vec3 vAmb;
varying vec3 vRayM;
varying vec3 vMieM;
${ATMOSPHERE_GLSL}
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float SUN_R = ${SUN_RADIUS.toFixed(4)}, MOON_R = ${MOON_RADIUS.toFixed(4)};
const float CLOUD_BASE = ${CLOUD_BASE.toFixed(2)}, CELL = ${CLOUD_CELL.toFixed(1)};
const int LOBES = ${LOBES};

float hash1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
vec4 hash4(vec2 p) {
  vec4 q = vec4(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)), dot(p, vec2(419.2, 371.9)), dot(p, vec2(113.5, 271.9)));
  return fract(sin(q) * 43758.5453);
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0 + i.z * 113.0;
  return mix(mix(mix(hash1(n), hash1(n + 1.0), f.x), mix(hash1(n + 57.0), hash1(n + 58.0), f.x), f.y),
             mix(mix(hash1(n + 113.0), hash1(n + 114.0), f.x), mix(hash1(n + 170.0), hash1(n + 171.0), f.x), f.y), f.z);
}

// ─── Stars ───────────────────────────────────────────────────────────────
// A direction in the equatorial frame onto a cube face: the face's uv in -1..1, its index, and how far off its middle.
vec2 cubeFace(vec3 e, out float face, out float m) {
  vec3 a = abs(e);
  if (a.x >= a.y && a.x >= a.z) { face = e.x > 0.0 ? 0.0 : 1.0; m = a.x; return e.yz / a.x; }
  if (a.y >= a.z) { face = e.y > 0.0 ? 2.0 : 3.0; m = a.y; return e.xz / a.y; }
  face = e.z > 0.0 ? 4.0 : 5.0; m = a.z; return e.xy / a.z;
}
vec3 faceDir(float face, vec2 uv) {
  if (face < 1.5) return normalize(vec3(face < 0.5 ? 1.0 : -1.0, uv));
  if (face < 3.5) return normalize(vec3(uv.x, face < 2.5 ? 1.0 : -1.0, uv.y));
  return normalize(vec3(uv, face < 4.5 ? 1.0 : -1.0));
}
// One layer of stars: one in a share \`density\` of the cells of an n × n grid per face, a gaussian a pixel wide
// (\`px\`, radians), \`sparkle\` the bright layer's soft cross along the screen.
vec3 starLayer(vec3 d, vec3 e, float n, float density, float px, float bright, float sparkle) {
  float face, m;
  vec2 uv = cubeFace(e, face, m);
  vec2 g = (uv * 0.5 + 0.5) * n, cell = floor(g);
  vec4 h = hash4(cell + vec2(face * 131.0 + n, face * 17.0));
  if (h.x > density) return vec3(0.0);
  vec2 at = 0.25 + 0.5 * h.yz;
  float ang = length(g - cell - at) * 2.0 / n * m * m;
  float b = bright * (0.25 + pow(h.w, 5.0) * 2.4);
  // Twinkle: each star its own beat, more near the skyline, more on the title.
  float up = max(d.y, 0.0);
  b *= 1.0 + (0.22 + 0.4 * uStarry) * (1.0 - 0.5 * up) * sin(uTime * (1.6 + 2.6 * h.y) + h.z * 40.0);
  float s = px * 0.62, core = exp(-ang * ang / (s * s));
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.86, 0.68), h.z);
  vec3 c = tint * b * core;
  if (sparkle > 0.0 && h.w > 0.55) {
    vec3 w = faceDir(face, ((cell + at) / n) * 2.0 - 1.0) * uStarRot;
    vec3 off = d - w;
    float sx = dot(off, uCamRight) / px, sy = dot(off, uCamUp) / px;
    float len = (1.5 + 3.5 * (h.w - 0.55)) * (0.7 + 0.3 * sin(uTime * 1.3 + h.y * 30.0)) * (1.0 + 0.5 * uStarry);
    float cross = exp(-sy * sy * 3.0) * max(0.0, 1.0 - abs(sx) / len) + exp(-sx * sx * 3.0) * max(0.0, 1.0 - abs(sy) / len);
    c += tint * b * cross * 0.32 * sparkle;
  }
  return c;
}
// The Milky Way along the real galactic plane (pole RA 192.86°, Dec 27.13°; centre RA 266.4°, Dec -28.9°).
vec3 milkyWay(vec3 e) {
  float lat = dot(e, vec3(-0.8676, -0.1981, 0.4560));
  float band = exp(-lat * lat / 0.022);
  if (band < 0.01) return vec3(0.0);
  float core = 0.45 + 0.55 * smoothstep(-0.3, 1.0, dot(e, vec3(-0.0549, -0.8734, -0.4838)));
  float n = vnoise(e * 7.0) * 0.6 + vnoise(e * 19.0) * 0.4;
  float dust = smoothstep(0.5, 0.72, vnoise(e * 11.0 + 3.1)) * exp(-lat * lat / 0.004);
  return vec3(0.55, 0.6, 0.85) * band * core * (0.35 + 0.9 * n) * (1.0 - 0.7 * dust);
}
// A shooting star now and then on the world clock (about five a minute round the whole sky, so a view sees one or two).
float meteor(vec3 d) {
  float P = 12.0, c = floor(uTime / P), age = uTime - c * P - hash1(c + 9.1) * 9.0;
  if (hash1(c) > 0.9 || age < 0.0 || age > 1.1) return 0.0;
  float az = hash1(c + 3.1) * 6.2832, el = 0.25 + hash1(c + 7.7) * 0.45;
  vec3 a = vec3(cos(az) * cos(el), sin(el), sin(az) * cos(el));
  vec3 side = normalize(cross(a, vec3(0.0, 1.0, 0.0))) * (hash1(c + 1.3) > 0.5 ? 1.0 : -1.0);
  vec3 vel = normalize(side - vec3(0.0, 0.5, 0.0)) * 0.42;
  vec3 head = normalize(a + vel * age), tail = normalize(a + vel * max(age - 0.25, 0.0)), ab = head - tail;
  float u = clamp(dot(d - tail, ab) / max(dot(ab, ab), 1e-7), 0.0, 1.0);
  float dist = length(d - (tail + ab * u));
  return smoothstep(0.003, 0.0008, dist) * u * smoothstep(0.0, 0.12, age) * smoothstep(1.1, 0.7, age);
}

// ─── Clouds ──────────────────────────────────────────────────────────────
// Under overcast every cloud greys and darkens toward the storm's slate.
vec3 overcast(vec3 c) { return mix(c, vec3(dot(c, LUMA)) * vec3(0.92, 0.96, 1.02) * 0.62, uCloud.z); }
#if CLOUD_STYLE == 1
// The painted cumulus (round 3, direction a): each cloud a flat shape on the sky (its lobes as discs round its drawn
// centre, cut flat along its base), shaded as the volume it stands for: every disc a dome of its lobe, the sun's side
// lit and the far side in the sky's blue, a crisp painted terminator, a darker line where one lobe overlaps the next,
// a bright rim against the light. Clouds are walked far to near, each laid over the last.
vec4 cloudTexel(int k, int t) { return texelFetch(uCloudTex, ivec2(t, k), 0); }
vec4 painted(vec3 u, float px, vec3 sky) {
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int k = uCloudN - 1; k >= 0; k--) {
    vec4 dr = cloudTexel(k, LOBES + 1), c = cloudTexel(k, LOBES);
    float ang = c.w / dr.w, cd = dot(u, dr.xyz), reach = 1.7 * ang;
    if (cd < 1.0 - 0.5 * reach * reach) continue;
    // The card: right and up across the line of sight, sizes in the cloud's own size.
    vec3 right = normalize(cross(dr.xyz, vec3(0.0, 1.0, 0.0))), upv = cross(right, dr.xyz);
    vec2 q = vec2(dot(u, right), dot(u, upv)) / ang;
    float pxs = px / ang, top = -1e9, second = -1e9, sd = -1e9;
    vec3 n = vec3(0.0), nTop = vec3(0.0, 0.0, 1.0);
    vec4 lobeN[LOBES];
    for (int i = 0; i < LOBES; i++) {
      vec4 l = cloudTexel(k, i);
      vec3 o = vec3(dot(l.xyz, right), dot(l.xyz, upv), -dot(l.xyz, dr.xyz)) / c.w;
      float r = l.w / c.w;
      vec2 e = q - o.xy;
      float d2 = dot(e, e);
      sd = max(sd, r - sqrt(d2));
      lobeN[i] = vec4(0.0, 0.0, 0.0, -1e9);
      if (d2 < r * r) {
        float h = sqrt(r * r - d2), z = o.z + h;
        lobeN[i] = vec4(vec3(e, h) / r, z);
        if (z > top) { second = top; top = z; } else second = max(second, z);
      }
    }
    // The lobes that meet near the front blend into one surface, so the shading runs on across them.
    for (int i = 0; i < LOBES; i++) n += lobeN[i].xyz * exp(-(top - lobeN[i].w) / 0.07);
    n = length(n) > 0.0 ? normalize(n) : nTop;
    // A brushed outline (a little noise on it, as David's references paint them), flat along the base.
    vec4 look = cloudTexel(k, LOBES + 2);
    sd += 0.07 * (vnoise(vec3(q * 7.0, look.w * 50.0)) * 0.7 + vnoise(vec3(q * 16.0, look.w * 50.0 + 3.0)) * 0.3 - 0.5);
    sd = min(sd, q.y + 0.02);
    float a = smoothstep(-pxs, pxs, sd) * look.x;
    if (a <= 0.0) continue;
    n = normalize(mix(n, vec3(0.0, -0.8, 0.6), 1.0 - smoothstep(0.0, 0.16, q.y)));
    vec3 ls = vec3(dot(uSunDir, right), dot(uSunDir, upv), -dot(uSunDir, dr.xyz));
    vec3 lm = vec3(dot(uMoonDir, right), dot(uMoonDir, upv), -dot(uMoonDir, dr.xyz));
    float ndl = dot(n, ls), lit = smoothstep(-0.16, -0.06, ndl) * 0.75 + smoothstep(0.35, 0.5, ndl) * 0.25;
    float litM = smoothstep(-0.16, -0.06, dot(n, lm));
    vec3 amb = mix(uAmbBottom, uAmbTop, clamp(n.y * 0.5 + 0.5, 0.0, 1.0));
    float direct = 1.0 - 0.85 * uCloud.z;
    // Against the light the thin outer edge glows (only the cloud's own outline, not where lobes overlap).
    float rim = (1.0 - smoothstep(0.0, 0.05, sd)) * max(0.0, -ls.z);
    vec3 cc = amb * 1.1 + (uSunLight * (lit * 0.95 + rim * 1.1) + uMoonLight * litM) * direct;
    // The painted line where a lobe overlaps the one behind it.
    cc *= 1.0 - 0.08 * (1.0 - smoothstep(0.0, 0.03, top - second)) * step(-1e8, second);
    cc = overcast(cc);
    cc = mix(cc, sky, (1.0 - exp(-dr.w / 30.0)) * 0.75);
    col = mix(col, cc, a);
    alpha = alpha + a * (1.0 - alpha);
  }
  return vec4(alpha > 0.0 ? col / alpha : col, alpha);
}
#endif
// Distance along d from the eye to the shell h km above the sea.
float shell(vec3 d, float h) {
  float r = PLANET_R + EYE_H, b = r * d.y, R = PLANET_R + h;
  return -b + sqrt(max(0.0, b * b + R * R - r * r));
}
#if CLOUD_STYLE == 0
float cover() { return uCloud.x * (1.0 - 0.6 * uStarry); }
// The cumulus: one cloud (or none) in each CELL-km square of the layer, a cluster of PUFFS balls whose bases are cut
// flat at the layer's floor, all inside the square (so walking the squares a ray crosses finds every ball it can
// meet). Ball i of the cloud in \`cell\` (cloud space: the world plus the drift): its centre (km,
// eye-relative, the planet's curve taken off) and radius.
vec4 puff(vec2 cell, float i, float size) {
  vec4 h = hash4(cell * 1.37 + vec2(i * 7.31, i * 3.17));
  float lead = step(i, 0.5);
  vec2 off = (h.xy - 0.5) * vec2(1.4, 0.7) * size * (1.0 - lead);
  float r = size * mix(0.28 + 0.3 * h.z, 0.62, lead);
  vec2 xz = (cell + 0.5) * CELL + off - uDrift;
  float y = CLOUD_BASE - EYE_H + r * mix(0.15 + 0.45 * h.w, 0.32, lead) - dot(xz, xz) / (2.0 * PLANET_R);
  return vec4(xz.x, y, xz.y, r);
}
// Where d meets ball b (the near side), or -1; and how near it came, in pixels past its rim (for the soft edge).
float ball(vec3 d, vec4 b, float px, float floorY, inout float miss) {
  float tc = dot(b.xyz, d);
  if (tc <= 0.0) return -1.0;
  float h2 = dot(b.xyz, b.xyz) - tc * tc, r2 = b.w * b.w;
  // A near miss only counts above the floor (the cut-away part of a ball has no rim).
  if (h2 > r2) { if ((d * tc).y > floorY) miss = min(miss, (sqrt(h2) - b.w) / (tc * px)); return -1.0; }
  return tc - sqrt(r2 - h2);
}
float hg(float mu, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * SKY_PI * pow(1.0 + g2 - 2.0 * g * mu, 1.5)); }
// The cumulus along d over the clear sky \`sky\` (for the haze): colour and coverage.
vec4 cumulus(vec3 d, float px, vec3 sky) {
  float cov = cover();
  if (d.y < 0.004 || cov <= 0.0) return vec4(0.0);
  float t0 = shell(d, CLOUD_BASE), size = uCloud.y;
  if (t0 > 90.0) return vec4(0.0);
  float t1 = shell(d, CLOUD_BASE + size * 1.4);
  // Walk the cells the ray's ground track crosses between the layer's floor and its top (nearest first).
  vec2 q = d.xz * t0 + uDrift, q1 = d.xz * t1 + uDrift, dir = q1 - q;
  vec2 cell = floor(q / CELL), stepC = sign(dir), inv = 1.0 / max(abs(dir), vec2(1e-5));
  vec2 next = ((cell + max(stepC, 0.0)) * CELL - q) * stepC * inv, delta = CELL * inv;
  float hitT = 1e9, miss = 1e9, floorHit = 0.0;
  vec4 hitBall = vec4(0.0), nearBall = vec4(0.0);
  vec2 hitCell = cell;
  float floorY = CLOUD_BASE - EYE_H;
  for (int k = 0; k < 12; k++) {
    vec4 hc = hash4(cell);
    if (hc.x < cov) {
      float s = min(size * (0.65 + 0.55 * hc.y), CELL * 0.39);
      for (int i = 0; i < ${PUFFS}; i++) {
        vec4 b = puff(cell, float(i), s);
        float m0 = miss, t = ball(d, b, px, floorY - dot(b.xz, b.xz) / (2.0 * PLANET_R), miss);
        if (miss < m0) nearBall = b;
        if (t > 0.0) {
          vec3 p = d * t;
          float base = floorY - dot(p.xz, p.xz) / (2.0 * PLANET_R);
          // Entered under the floor: it meets the flat base instead, if the base is inside the ball there.
          if (p.y < base) { vec3 f = d * t0; if (length(f - b.xyz) < b.w) { t = t0; p = f; } else t = -1.0; }
          if (t > 0.0 && t < hitT) { hitT = t; hitBall = b; hitCell = cell; floorHit = p.y <= base + 1e-3 ? 1.0 : 0.0; }
        }
      }
      if (hitT < 1e8) break;
    }
    if (next.x < next.y) { if (next.x > 1.0) break; cell.x += stepC.x; next.x += delta.x; }
    else { if (next.y > 1.0) break; cell.y += stepC.y; next.y += delta.y; }
  }
  bool hit = hitT < 1e8;
  vec4 b = hit ? hitBall : nearBall;
  float t = hit ? hitT : max(dot(b.xyz, d), t0);
  if (!hit && miss > 1.0) return vec4(0.0);
  vec3 p = d * t;
  // The normal of the cloud as one soft body (the balls' normals blended where they meet), and how much the others
  // stand between the point and the sun.
  vec4 hc = hash4(hitCell);
  float s = min(size * (0.65 + 0.55 * hc.y), CELL * 0.39), sunOcc = 0.0, wsum = 0.0, wmax = 0.0;
  vec3 n = vec3(0.0);
  for (int i = 0; i < ${PUFFS}; i++) {
    vec4 o = hit ? puff(hitCell, float(i), s) : b;
    vec3 rel = p - o.xyz;
    float dist = length(rel), w = exp(-24.0 * max(dist - o.w, 0.0) / o.w);
    n += rel / max(dist, 1e-4) * w;
    wsum += w; wmax = max(wmax, w);
    float tc = dot(-rel, uSunDir), h2 = dot(rel, rel) - tc * tc;
    if (hit && tc > o.w * 0.2) sunOcc = max(sunOcc, 1.0 - smoothstep(0.55, 1.0, sqrt(h2) / o.w));
  }
  // Where two balls meet the weights split: a crease, a little darker, so each lobe reads.
  float crease = wmax / max(wsum, 1e-4);
  n = normalize(n / max(wsum, 1e-4));
  // The flat base still carries the lobes' shape, so its edge rounds into the body instead of cutting.
  if (floorHit > 0.5) n = normalize(vec3(0.0, -1.0, 0.0) + n * 0.7);
  // The silhouette soft over a pixel.
  float a = hit ? 1.0 : 1.0 - smoothstep(0.0, 1.0, miss);
  float up = clamp((p.y - (CLOUD_BASE - EYE_H)) / (s * 1.1), 0.0, 1.0);
  float lit = clamp((dot(n, uSunDir) + 0.8) / 1.8, 0.0, 1.0) * (1.0 - 0.5 * sunOcc) * (floorHit > 0.5 ? 0.3 : 1.0);
  float litM = clamp((dot(n, uMoonDir) + 0.8) / 1.8, 0.0, 1.0) * (floorHit > 0.5 ? 0.3 : 1.0);
  // The sky lights them from all round: its zenith on their tops, its skyline and the sea's bounce underneath.
  vec3 amb = mix(uAmbBottom, uAmbTop, clamp(n.y * 0.5 + 0.5, 0.0, 1.0)) * mix(0.75, 1.0, up);
  // The silver lining on the outer rim toward the light (not on the creases between lobes).
  float rim = pow(1.0 - clamp(dot(n, -d), 0.0, 1.0), 4.0) * (hit ? 1.0 : 0.0) * smoothstep(0.6, 0.95, wmax / max(wsum, 1e-4));
  // Under an overcast the deck above takes the sun's direct light.
  float direct = 1.0 - 0.85 * uCloud.z;
  vec3 col = amb + (uSunLight * lit + uMoonLight * litM
    + (uSunLight * hg(dot(d, uSunDir), 0.6) + uMoonLight * hg(dot(d, uMoonDir), 0.6)) * rim * 1.5) * direct;
  // A little cauliflower texture on the surface, and the creases.
  float bump = vnoise((p - b.xyz) / max(b.w, 0.05) * 3.2 + hc.zwx * 17.0);
  col *= (0.9 + 0.14 * bump) * mix(0.82, 1.0, smoothstep(0.35, 0.9, crease));
  col = overcast(col);
  col = mix(col, sky, (1.0 - exp(-t / 55.0)) * 0.8);
  a *= 1.0 - smoothstep(55.0, 90.0, t);
  return vec4(col, a);
}
#endif
// Overcast: a grey deck at the layer's floor, mottled, thickest overhead.
vec4 deck(vec3 d, vec3 sky) {
  if (uCloud.z <= 0.0 || d.y < 0.0) return vec4(0.0);
  float t = shell(d, CLOUD_BASE + 0.3);
  vec2 xz = d.xz * t + uDrift * 0.7;
  // Long soft rolls across the wind, broken up.
  float n = vnoise(vec3(xz.x * 0.18, xz.y * 0.5, 0.0)) * 0.55 + vnoise(vec3(xz * 0.9, 3.0)) * 0.3 + vnoise(vec3(xz * 2.6, 5.0)) * 0.15;
  vec3 col = overcast((uAmbTop + uAmbBottom) * 0.7 * (0.75 + 0.5 * n) + uSunLight * 0.1 * n);
  col = mix(col, sky, (1.0 - exp(-t / 40.0)) * 0.45);
  return vec4(col, smoothstep(0.1, 0.6, uCloud.z) * (0.85 + 0.15 * n));
}
// Cirrus 7 km up: streaks drawn out along the wind, still lit after the low clouds have gone grey.
vec4 cirrus(vec3 d, vec3 sky) {
  if (uCloud.w <= 0.0 || d.y < 0.01) return vec4(0.0);
  float t = shell(d, 7.0);
  vec2 xz = d.xz * t + uDrift * 2.0;
  float c = vnoise(vec3(xz.x * 0.06, xz.y * 0.22, 1.0)) * 0.65 + vnoise(vec3(xz.x * 0.16, xz.y * 0.5, 2.0)) * 0.35;
  float a = smoothstep(0.55, 0.85, c) * uCloud.w * 0.5 * (1.0 - smoothstep(60.0, 200.0, t));
  return vec4(mix(uCirrusLight + uAmbTop * 0.5, sky, 1.0 - exp(-t / 90.0)), a);
}

void main() {
  // d the true direction (the air, the cirrus, the skyline); u where it is drawn (the discs, the stars, the clouds).
  vec3 d = normalize(vDir), u = normalize(vDraw);
  float px = max(length(fwidth(d)), 1e-5), pxu = max(length(fwidth(u)), 1e-5), up = max(d.y, 0.0);
  float mu = dot(d, uSunDir), muM = dot(d, uMoonDir), muD = dot(u, uSunDraw), muMD = dot(u, uMoonDraw);

  // The air, lit by the sun and the moon, then the night's own blue.
  vec3 sky = gradeSky((skyPhase(vRay, vMie, mu) + vAmb + uMoonE * skyPhase(vRayM, vMieM, muM)) * uExposure);
  sky += mix(uNightHorizon, uNightTop, sqrt(up)) * uNight;
  // Overcast greys the clear sky that shows between the clouds.
  sky = mix(sky, vec3(dot(sky, LUMA)) * vec3(0.94, 0.98, 1.05), uCloud.z * 0.8);
  vec3 clear = sky;

  // The sun's disc, limb darkened, its edge a pixel wide; gone below the skyline.
  float above0 = smoothstep(-px, px, d.y);
  float ang = sqrt(max(2.0 * (1.0 - muD), 0.0));
  float disc = (1.0 - smoothstep(SUN_R - pxu * 0.7, SUN_R + pxu * 0.7, ang)) * above0;
  float limb = 1.0 - 0.4 * (1.0 - sqrt(max(0.0, 1.0 - pow(min(ang / SUN_R, 1.0), 2.0))));
  sky = mix(sky, uSunDisc * limb, disc * (1.0 - uCloud.z));

  // The moon: a sphere the real sun lights, so its phase and terminator are the calendar's; earthshine on the dark
  // side by night; a pale disc on the blue by day.
  if (muMD > 0.99) {
    vec3 mr = normalize(cross(vec3(0.0, 1.0, 0.0), uMoonDraw)), mup = cross(uMoonDraw, mr);
    vec2 q = vec2(dot(u, mr), dot(u, mup)) / MOON_R;
    float qr = length(q), edge = pxu / MOON_R;
    float inDisc = (1.0 - smoothstep(1.0 - edge * 0.7, 1.0 + edge * 0.7, qr)) * above0;
    vec3 nrm = mr * q.x + mup * q.y - uMoonDraw * sqrt(max(0.0, 1.0 - min(dot(q, q), 1.0)));
    float lit = smoothstep(-0.04, 0.1, dot(nrm, uSunDir));
    float albedo = 0.8 - 0.28 * smoothstep(0.45, 0.7, vnoise(vec3(q * 2.4, 1.7)) * 0.7 + vnoise(vec3(q * 6.0, 4.2)) * 0.3);
    vec3 face = vec3(1.0, 0.97, 0.9) * albedo * mix(0.55, 0.82, uNight);
    // The dark side hides the stars and barely shows (earthshine); by day only the lit side shows on the blue.
    vec3 dark = sky * mix(1.0, 0.86, uNight) + vec3(0.02, 0.025, 0.035) * albedo * uNight;
    vec3 moon = mix(sky + face * 0.7 * lit, mix(dark, face, lit), uNight);
    sky = mix(sky, moon, inDisc * (1.0 - uCloud.z));
  }

  // The night sky: the stars, the Milky Way and the odd shooting star, laid on the drawn sky so they keep their size
  // and spacing however low they are; the air dims them toward the skyline (the faint first), as it does.
  if (uStarVis > 0.001) {
    vec3 e = uStarRot * u;
    vec3 stars = starLayer(u, e, 160.0, 0.09, pxu * uStarPx, 0.5, 0.0) * smoothstep(0.03, 0.4, d.y)
      + starLayer(u, e, 30.0, 0.16, pxu * uStarPx, 1.3, 1.0) * smoothstep(0.0, 0.2, d.y) + milkyWay(e) * 0.09 * smoothstep(0.02, 0.3, d.y);
    float vis = uStarVis * (1.0 + 0.5 * uStarry);
    sky += stars * vis * (1.0 - uCloud.z);
    sky += vec3(1.0, 0.95, 0.85) * meteor(u) * uStarVis * 1.4 * (1.0 - uCloud.z) * smoothstep(0.0, 0.1, d.y);
  }

  // The clouds over it all: cirrus behind, the overcast deck, the cumulus in front.
  vec4 ci = cirrus(d, clear);
  sky = mix(sky, ci.rgb, ci.a);
  vec4 dk = deck(d, clear);
  sky = mix(sky, dk.rgb, dk.a);
#if CLOUD_STYLE == 0
  vec4 cu = cumulus(d, px, clear);
  sky = mix(sky, cu.rgb, cu.a);
#elif CLOUD_STYLE == 1
  vec4 cu = painted(u, pxu, clear);
  sky = mix(sky, cu.rgb, cu.a);
#endif

  // The skyline sinks into the fog the sea is drawn in; on a fog day the haze climbs the sky.
  sky = mix(sky, uFog, 1.0 - smoothstep(-0.012, 0.022 + 0.12 * uHaze, d.y));
  sky = mix(sky, uFog, uHaze * 0.55 * (1.0 - smoothstep(0.0, 0.6, d.y)));
  gl_FragColor = vec4(sky, 1.0);
}
`;

/**
 * The dome's mesh: rings close together at the skyline (where the air changes fastest with height, and the vertex
 * integral needs them) and wider overhead, few below the horizon (fog there).
 */
function domeGeometry(): THREE.BufferGeometry {
  const AZ = 96, UP = 26, elev: number[] = [-90, -40, -16, -6, -2.5];
  for (let i = 0; i <= UP; i++) elev.push(90 * Math.pow(i / UP, 1.55));
  const pos: number[] = [], index: number[] = [];
  for (const e of elev) {
    const r = Math.cos(e * Math.PI / 180), y = Math.sin(e * Math.PI / 180);
    for (let j = 0; j <= AZ; j++) { const a = (j / AZ) * Math.PI * 2; pos.push(r * Math.cos(a), y, r * Math.sin(a)); }
  }
  for (let i = 0; i < elev.length - 1; i++) for (let j = 0; j < AZ; j++) {
    const a = i * (AZ + 1) + j, b = a + AZ + 1;
    index.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}

const STYLE_DEFINE: Record<CloudStyle, number> = { traced: 0, painted: 1, models: 2, sprites: 3 };
let material: THREE.ShaderMaterial | null = null;
let geometry: THREE.BufferGeometry | null = null;
/** The dome's mesh and material, made once (both are shared by every scene that draws the sky), for a cloud style. */
export function skyDome(style: CloudStyle): { geometry: THREE.BufferGeometry; material: THREE.ShaderMaterial } {
  if (material && material.defines.CLOUD_STYLE !== STYLE_DEFINE[style]) {
    material.defines.CLOUD_STYLE = STYLE_DEFINE[style];
    material.needsUpdate = true;
  }
  if (!material) {
    material = new THREE.ShaderMaterial({
      defines: { CLOUD_STYLE: STYLE_DEFINE[style] },
      // Seen only from its centre, so which way its faces wind doesn't matter.
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms as unknown as { [k: string]: THREE.IUniform },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    material.name = "sky:atmosphere";
  }
  return { geometry: (geometry ??= domeGeometry()), material };
}
