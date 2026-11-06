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
 * - **The clouds:** the cirrus 7 km up (light white streaks that stay lit after sunset, a moonlit veil by night) and an
 *   overcast's grey deck are drawn here; the cumulus are lit painted cards over the dome (components/game/SkyClouds.tsx),
 *   lit by the same light uniforms. The weather sets how many, how thick and how grey.
 *
 * The dome is drawn after everything opaque, at the far plane, so only the pixels where sky shows pay for it.
 */

import * as THREE from "three";
import { ATMOSPHERE_GLSL } from "./atmosphere";
import { CLOUD_BASE, CLOUD_MAX, CLOUD_TEXELS, SKY_BEND_GLSL } from "./clouds";

/** The clouds' rows (clouds.ts cloudField), written by SkyDome each frame and read by the sprites (SkyClouds.tsx). */
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
/** The drift wraps here (km; the shader's noise for the deck and the cirrus is smooth across the wrap's rare jump). */
export const DRIFT_WRAP = 2600;

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
const float CLOUD_BASE = ${CLOUD_BASE.toFixed(2)};

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
  // Crisp (David, round 3: "more contrast bectween actual star and the glow around"): the point a pixel wide and held
  // under the bloom's reach, so it stays a sharp point; the bright ones keep a faint tight glow of their own.
  // A hard little disc about a pixel across (full bright wherever it falls between pixels), not a gaussian smear.
  float core = smoothstep(px * 0.95, px * 0.35, ang), glow = exp(-ang * ang / (6.0 * px * px));
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.86, 0.68), h.z);
  vec3 c = tint * (min(b * 1.25, 0.95) * core + 0.05 * b * glow * sparkle);
  if (sparkle > 0.0 && h.w > 0.55) {
    vec3 w = faceDir(face, ((cell + at) / n) * 2.0 - 1.0) * uStarRot;
    vec3 off = d - w;
    float sx = dot(off, uCamRight) / px, sy = dot(off, uCamUp) / px;
    float len = (1.5 + 3.5 * (h.w - 0.55)) * (0.7 + 0.3 * sin(uTime * 1.3 + h.y * 30.0)) * (1.0 + 0.5 * uStarry);
    float cross = exp(-sy * sy * 3.0) * max(0.0, 1.0 - abs(sx) / len) + exp(-sx * sx * 3.0) * max(0.0, 1.0 - abs(sy) / len);
    c += tint * min(b, 1.2) * cross * 0.16 * sparkle;
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
// Distance along d from the eye to the shell h km above the sea.
float shell(vec3 d, float h) {
  float r = PLANET_R + EYE_H, b = r * d.y, R = PLANET_R + h;
  return -b + sqrt(max(0.0, b * b + R * R - r * r));
}
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
// Cirrus 7 km up: the light white streaks curving across the sky (David, round 3: "i want to keep that and make it
// slightly more prominent"), drawn out along the wind, still lit after the low clouds have gone grey. By night a faint
// veil lit by the moon, a little lighter than the sky behind it, never the grey bands the day's light would leave.
vec4 cirrus(vec3 d, vec3 sky) {
  if (uCloud.w <= 0.0 || d.y < 0.01) return vec4(0.0);
  float t = shell(d, 7.0);
  vec2 xz = d.xz * t + uDrift * 2.0;
  float c = vnoise(vec3(xz.x * 0.06, xz.y * 0.22, 1.0)) * 0.65 + vnoise(vec3(xz.x * 0.16, xz.y * 0.5, 2.0)) * 0.35;
  float a = smoothstep(0.5, 0.84, c) * uCloud.w * 0.64 * (1.0 - smoothstep(60.0, 200.0, t)) * (1.0 - 0.6 * uNight);
  // By night thinner and only a little lighter than the sky, brighter near the moon, so the stars keep their contrast.
  vec3 lit = mix(uCirrusLight + uAmbTop * 0.5, sky * 1.12 + uMoonLight * (0.4 + 2.0 * pow(max(0.0, dot(d, uMoonDir)), 6.0)), uNight);
  return vec4(mix(lit, sky, 1.0 - exp(-t / 90.0)), a);
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
    vec3 stars = starLayer(u, e, 160.0, 0.09, pxu, 0.5, 0.0) * smoothstep(0.03, 0.4, d.y)
      + starLayer(u, e, 30.0, 0.16, pxu, 1.3, 1.0) * smoothstep(0.0, 0.2, d.y) + milkyWay(e) * 0.09 * smoothstep(0.02, 0.3, d.y);
    float vis = uStarVis * (1.0 + 0.5 * uStarry);
    sky += stars * vis * (1.0 - uCloud.z);
    sky += vec3(1.0, 0.95, 0.85) * meteor(u) * uStarVis * 1.4 * (1.0 - uCloud.z) * smoothstep(0.0, 0.1, d.y);
  }

  // The clouds over it all: cirrus behind, the overcast deck, the cumulus in front.
  vec4 ci = cirrus(d, clear);
  sky = mix(sky, ci.rgb, ci.a);
  vec4 dk = deck(d, clear);
  sky = mix(sky, dk.rgb, dk.a);

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

let material: THREE.ShaderMaterial | null = null;
let geometry: THREE.BufferGeometry | null = null;
/** The dome's mesh and material, made once (both are shared by every scene that draws the sky). */
export function skyDome(): { geometry: THREE.BufferGeometry; material: THREE.ShaderMaterial } {
  if (!material) {
    material = new THREE.ShaderMaterial({
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
