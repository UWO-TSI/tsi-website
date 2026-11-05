/**
 * The sky's physics (sky-ambient round 2; specs/sky-ambient.md §R2): Earth's atmosphere by single scattering, with the
 * real sun, the real moon and the real stars over London, Ontario.
 *
 * - **Light through air.** Rayleigh scattering (the blue), Mie scattering (the haze and the glow round the sun) and
 *   ozone absorption (the violet zenith at twilight), each with its density falling off with height, integrated along
 *   the view ray, with the light reaching each sample through the air above it and blocked by the planet below (the
 *   Earth's shadow rising opposite a set sun, the belt of Venus above it). The constants are Bruneton's and
 *   Hillaire's (Bruneton 2017, "Precomputed Atmospheric Scattering: a New Implementation"; Hillaire 2020, "A Scalable
 *   and Production Ready Sky and Atmosphere Rendering Technique"), in kilometres.
 * - The dome runs the same integral per vertex (`ATMOSPHERE_GLSL`, skyShader.ts) and adds the phase functions per
 *   pixel; this file's TypeScript copy gives the light its sky colours (lookPreset), the clouds their light and the
 *   tests something to hold.
 * - **The moon** (`moonPosition`): Meeus's low-precision lunar theory (chapter 47's largest terms, about 0.3° in
 *   longitude) with the topocentric parallax, so its place, its rising and its phase follow the real month.
 * - **The stars** (`starFrame`): the celestial sphere turned by the local sidereal time, so the night sky wheels
 *   round the pole star as it really does.
 *
 * World axes as the island has them (lookPreset sunFromAngles: lab azimuth = compass − 180): north −x, east −z,
 * south +x, west +z, up +y.
 */

export type Vec3 = [number, number, number];

/** Planet and atmosphere radii, km. */
export const PLANET_R = 6360, ATMOSPHERE_R = 6460;
/** The viewer's height above the sea, km. */
const EYE = 0.2;
/** Rayleigh scattering per km at sea level, and its scale height. */
export const RAYLEIGH: Vec3 = [5.802e-3, 13.558e-3, 33.1e-3];
export const RAYLEIGH_H = 8;
/** Mie scattering and extinction per km at sea level (Hillaire's clean day), its scale height and its forward lean. */
export const MIE = 4e-3, MIE_EXT = 4.44e-3, MIE_H = 1.2, MIE_G = 0.78;
/** Ozone absorption per km at its peak, a tent 25 ± 15 km up: twice the measured, for the storybook's violet twilight (sky C). */
export const OZONE: Vec3 = [1.3e-3, 3.762e-3, 0.17e-3];
/** Steps along the view ray and toward the light: few, spaced closer near the eye where the air is thickest. */
export const VIEW_STEPS = 12, LIGHT_STEPS = 5;
/**
 * Light scattered more than once, which single scattering leaves out (it keeps twilight and the Earth's shadow blue
 * rather than black): a share of each sample's lit scattering added back without direction, and a skylight on every
 * sample, shadowed or not, fading as the sun goes down (`skylight`).
 */
export const MULTI = 0.16, SKYLIGHT = 0.12;
export const skylight = (sunY: number) => SKYLIGHT * smooth(-0.21, 0.35, sunY);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Distance from `o` along unit `d` to where it leaves a sphere of radius `r` round the planet's centre (o inside). */
function exitSphere(o: Vec3, d: Vec3, r: number): number {
  const b = dot(o, d), c = dot(o, o) - r * r;
  return -b + Math.sqrt(Math.max(0, b * b - c));
}

/** How much of the light from `d` reaches `p`: 0 in the planet's shadow, a soft edge over the last twenty kilometres under it. */
function sunlit(p: Vec3, d: Vec3): number {
  const b = dot(p, d);
  if (b >= 0) return 1;
  const miss = Math.sqrt(Math.max(0, dot(p, p) - b * b));
  const t = Math.min(1, Math.max(0, (miss - PLANET_R + 20) / 20));
  return t * t * (3 - 2 * t);
}

/** Air densities at a height (km): Rayleigh, Mie, ozone, each 1 at its reference. */
function densities(h: number): Vec3 {
  return [Math.exp(-h / RAYLEIGH_H), Math.exp(-h / MIE_H), Math.max(0, 1 - Math.abs(h - 25) / 15)];
}

/** Optical depth from `p` toward `d` to the top of the air, per channel (Rayleigh + Mie + ozone extinction). */
function depthToTop(p: Vec3, d: Vec3, out: Vec3): Vec3 {
  const len = exitSphere(p, d, ATMOSPHERE_R);
  let r = 0, m = 0, o = 0, prev = 0;
  for (let i = 0; i < LIGHT_STEPS; i++) {
    const s = (i + 1) / LIGHT_STEPS, t = len * s * s, mid = (prev + t) / 2, dt = t - prev;
    prev = t;
    const x = p[0] + d[0] * mid, y = p[1] + d[1] * mid, z = p[2] + d[2] * mid;
    const [dr, dm, dz] = densities(Math.hypot(x, y, z) - PLANET_R);
    r += dr * dt; m += dm * dt; o += dz * dt;
  }
  for (let c = 0; c < 3; c++) out[c] = RAYLEIGH[c] * r + MIE_EXT * m + OZONE[c] * o;
  return out;
}

export interface Scatter { rayleigh: Vec3; mie: Vec3; ambient: Vec3 }

/**
 * The light scattered toward the eye along `view` from a light at `light` (both unit world directions), before the
 * phase functions: `rayleigh` and `mie` (per unit of the light's irradiance). Below the horizon the view is held at it.
 */
export function scatter(view: Vec3, light: Vec3, out: Scatter = { rayleigh: [0, 0, 0], mie: [0, 0, 0], ambient: [0, 0, 0] }): Scatter {
  const vy = Math.max(view[1], 0), n = Math.hypot(view[0], vy, view[2]) || 1, d: Vec3 = [view[0] / n, vy / n, view[2] / n];
  const eye: Vec3 = [0, PLANET_R + EYE, 0], len = exitSphere(eye, d, ATMOSPHERE_R);
  const tv: Vec3 = [0, 0, 0], tl: Vec3 = [0, 0, 0], p: Vec3 = [0, 0, 0];
  out.rayleigh.fill(0); out.mie.fill(0); out.ambient.fill(0);
  let prev = 0;
  for (let i = 0; i < VIEW_STEPS; i++) {
    const s = (i + 1) / VIEW_STEPS, t = len * s * s, mid = (prev + t) / 2, dt = t - prev;
    prev = t;
    p[0] = eye[0] + d[0] * mid; p[1] = eye[1] + d[1] * mid; p[2] = eye[2] + d[2] * mid;
    const [dr, dm, dz] = densities(Math.hypot(...p) - PLANET_R);
    // The view ray's own depth so far, half this step's.
    for (let c = 0; c < 3; c++) {
      tv[c] += (RAYLEIGH[c] * dr + MIE_EXT * dm + OZONE[c] * dz) * dt * 0.5;
      out.ambient[c] += (RAYLEIGH[c] * dr + MIE * dm) * Math.exp(-tv[c]) * dt;
    }
    const lit = sunlit(p, light);
    if (lit > 0) {
      depthToTop(p, light, tl);
      for (let c = 0; c < 3; c++) {
        const k = Math.exp(-(tv[c] + tl[c])) * lit * dt;
        out.rayleigh[c] += RAYLEIGH[c] * dr * k;
        out.mie[c] += MIE * dm * k;
      }
    }
    for (let c = 0; c < 3; c++) tv[c] += (RAYLEIGH[c] * dr + MIE_EXT * dm + OZONE[c] * dz) * dt * 0.5;
  }
  const sky = skylight(light[1]) / (4 * Math.PI);
  for (let c = 0; c < 3; c++) out.ambient[c] *= sky;
  return out;
}

/** Rayleigh's phase function, μ the cosine between the view and the light. */
export const rayleighPhase = (mu: number) => (3 / (16 * Math.PI)) * (1 + mu * mu);
/** Cornette-Shanks' Mie phase function (Henyey-Greenstein with Rayleigh's limb), forward lean `g`. */
export function miePhase(mu: number, g = MIE_G): number {
  const g2 = g * g;
  return (3 / (8 * Math.PI)) * ((1 - g2) * (1 + mu * mu)) / ((2 + g2) * Math.pow(1 + g2 - 2 * g * mu, 1.5));
}

/** The sky's radiance toward `view` lit by a light at `light` of irradiance 1 (the dome scales it). */
export function skyRadiance(view: Vec3, light: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  const s = scatter(view, light), n = Math.hypot(...view) || 1, mu = dot(view, light) / n;
  const pr = rayleighPhase(mu), pm = miePhase(mu), iso = MULTI / (4 * Math.PI);
  for (let c = 0; c < 3; c++) out[c] = s.rayleigh[c] * (pr + iso) + s.mie[c] * (pm + iso) + s.ambient[c];
  return out;
}

/** How much of a light from `light` reaches the eye through the air (its colour at the island), per channel. */
export function transmittance(light: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  const eye: Vec3 = [0, PLANET_R + EYE, 0];
  depthToTop(eye, light, out);
  const lit = sunlit(eye, light);
  for (let c = 0; c < 3; c++) out[c] = Math.exp(-out[c]) * lit;
  return out;
}

// ─── From radiance to the game's sky ─────────────────────────────────────

/**
 * The look on top of the physics (the dome's `gradeSky` runs the same): an exposure that half adapts as the sky
 * darkens (as eyes do, so twilight reads deep blue rather than black), a white balance and a saturation lift fitted so
 * noon lands on the look's picked sky (lookPreset CURRENT: #4a9de0 at the top of the view, #bfe0f2 at the skyline),
 * and a soft clip that keeps every colour under white (round 1: a low sun clipped to cream through the tone map).
 */
export const SKY_GRADE = { exposure: 20, adapt: 0.6, adaptRef: 0.0096, adaptMax: 40, balance: [0.8, 1, 1.16] as Vec3, saturation: 1.4, clip: 0.45 };

const luma = (c: Vec3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** The exposure for a sky lit from `sun`: by how dark its zenith is against noon's. */
export function skyExposure(sun: Vec3): number {
  const g = SKY_GRADE, z = luma(skyRadiance([0, 1, 0], sun));
  return g.exposure * Math.min(g.adaptMax, Math.pow(g.adaptRef / Math.max(z, 1e-7), g.adapt));
}

/** Radiance (already times the exposure) to the colour the dome draws, linear. */
export function gradeSky(x: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  const g = SKY_GRADE, l = luma(x);
  let m = 1e-6;
  for (let c = 0; c < 3; c++) m = Math.max(m, (out[c] = Math.max(0, (l + (x[c] - l) * g.saturation) * g.balance[c])));
  const k = 1 / (1 + g.clip * m);
  for (let c = 0; c < 3; c++) out[c] *= k;
  return out;
}

/**
 * The sky's colours for the light (lookPreset): its light at the top of the follow view (24° up) and at the skyline,
 * each summed round the compass before the grade, so the bright side leads as it does in the light the island gets
 * (a low sun's glow, not the Earth's shadow opposite), linear.
 */
export function skyColours(sun: Vec3): { top: Vec3; horizon: Vec3 } {
  const e = skyExposure(sun), top: Vec3 = [0, 0, 0], horizon: Vec3 = [0, 0, 0], r: Vec3 = [0, 0, 0], AZ = 12;
  for (let i = 0; i < AZ; i++) {
    for (const [el, acc] of [[24, top], [1, horizon]] as const) {
      skyRadiance(compassDir(el, (i / AZ) * 360), sun, r);
      for (let c = 0; c < 3; c++) acc[c] += (r[c] * e) / AZ;
    }
  }
  return { top: gradeSky(top, top), horizon: gradeSky(horizon, horizon) };
}

/**
 * The same integral for the dome, per vertex (skyShader.ts): `atmosphere(view, light, rayleigh, mie, ambient)`, then
 * `skyPhase` and `gradeSky` per pixel. Built from the constants above, so the two copies can't drift.
 */
const f = (v: number) => v.toExponential(6), v3 = (v: Vec3) => `vec3(${v.map(f).join(", ")})`;
export const ATMOSPHERE_GLSL = /* glsl */ `
const float SKY_PI = 3.14159265;
const float PLANET_R = ${f(PLANET_R)}, ATMOSPHERE_R = ${f(ATMOSPHERE_R)}, EYE_H = ${f(EYE)};
const vec3 RAYLEIGH = ${v3(RAYLEIGH)}, OZONE = ${v3(OZONE)};
const float RAYLEIGH_H = ${f(RAYLEIGH_H)}, MIE = ${f(MIE)}, MIE_EXT = ${f(MIE_EXT)}, MIE_H = ${f(MIE_H)}, MIE_G = ${f(MIE_G)};
const float MULTI = ${f(MULTI)}, SKYLIGHT = ${f(SKYLIGHT)};
float exitSphere(vec3 o, vec3 d, float r) { float b = dot(o, d), c = dot(o, o) - r * r; return -b + sqrt(max(0.0, b * b - c)); }
float sunlit(vec3 p, vec3 d) {
  float b = dot(p, d);
  if (b >= 0.0) return 1.0;
  float miss = sqrt(max(0.0, dot(p, p) - b * b));
  return smoothstep(0.0, 1.0, clamp((miss - PLANET_R + 20.0) / 20.0, 0.0, 1.0));
}
vec3 densities(float h) { return vec3(exp(-h / RAYLEIGH_H), exp(-h / MIE_H), max(0.0, 1.0 - abs(h - 25.0) / 15.0)); }
vec3 depthToTop(vec3 p, vec3 d) {
  float len = exitSphere(p, d, ATMOSPHERE_R), prev = 0.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${LIGHT_STEPS}; i++) {
    float s = float(i + 1) / ${LIGHT_STEPS}.0, t = len * s * s, dt = t - prev;
    vec3 q = p + d * ((prev + t) * 0.5);
    prev = t;
    acc += densities(length(q) - PLANET_R) * dt;
  }
  return RAYLEIGH * acc.x + MIE_EXT * acc.y + OZONE * acc.z;
}
void atmosphere(vec3 view, vec3 light, out vec3 rayleigh, out vec3 mie, out vec3 ambient) {
  vec3 d = normalize(vec3(view.x, max(view.y, 0.0), view.z));
  vec3 eye = vec3(0.0, PLANET_R + EYE_H, 0.0), tv = vec3(0.0);
  float len = exitSphere(eye, d, ATMOSPHERE_R), prev = 0.0;
  rayleigh = vec3(0.0); mie = vec3(0.0); ambient = vec3(0.0);
  for (int i = 0; i < ${VIEW_STEPS}; i++) {
    float s = float(i + 1) / ${VIEW_STEPS}.0, t = len * s * s, dt = t - prev;
    vec3 p = eye + d * ((prev + t) * 0.5);
    prev = t;
    vec3 rho = densities(length(p) - PLANET_R), ext = (RAYLEIGH * rho.x + MIE_EXT * rho.y + OZONE * rho.z) * dt * 0.5;
    tv += ext;
    ambient += (RAYLEIGH * rho.x + MIE * rho.y) * exp(-tv) * dt;
    float lit = sunlit(p, light);
    if (lit > 0.0) {
      vec3 k = exp(-(tv + depthToTop(p, light))) * lit * dt;
      rayleigh += RAYLEIGH * rho.x * k;
      mie += MIE * rho.y * k;
    }
    tv += ext;
  }
  ambient *= SKYLIGHT * smoothstep(-0.21, 0.35, light.y) / (4.0 * SKY_PI);
}
vec3 skyPhase(vec3 rayleigh, vec3 mie, float mu) {
  float g2 = MIE_G * MIE_G, iso = MULTI / (4.0 * SKY_PI);
  float pr = 3.0 / (16.0 * SKY_PI) * (1.0 + mu * mu);
  float pm = 3.0 / (8.0 * SKY_PI) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * MIE_G * mu, 1.5));
  return rayleigh * (pr + iso) + mie * (pm + iso);
}
vec3 gradeSky(vec3 x) {
  float l = dot(x, vec3(0.2126, 0.7152, 0.0722));
  vec3 y = max(vec3(0.0), (vec3(l) + (x - l) * ${f(SKY_GRADE.saturation)}) * ${v3(SKY_GRADE.balance)});
  return y / (1.0 + ${f(SKY_GRADE.clip)} * max(max(y.r, y.g), max(y.b, 1e-6)));
}
`;

// ─── The sun, the moon and the stars ─────────────────────────────────────

const RAD = Math.PI / 180;
const sinD = (deg: number) => Math.sin(deg * RAD), cosD = (deg: number) => Math.cos(deg * RAD);

/** Compass angles (degrees: elevation, azimuth from north clockwise) to a world direction. */
export function compassDir(elevation: number, azimuth: number): Vec3 {
  const e = elevation * RAD, a = (azimuth - 180) * RAD;
  return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
}

/** Days from J2000.0 (2000-01-01 12:00 TT, near enough UTC). */
const daysJ2000 = (ms: number) => ms / 86_400_000 - 10_957.5;
/** Greenwich mean sidereal time, degrees. */
const gmst = (d: number) => ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;

/** Right ascension and declination (degrees) to compass elevation and azimuth for a place at local sidereal time `lst`. */
function horizontal(ra: number, dec: number, lst: number, latitude: number): { elevation: number; azimuth: number } {
  const h = lst - ra;
  const elevation = Math.asin(sinD(latitude) * sinD(dec) + cosD(latitude) * cosD(dec) * cosD(h)) / RAD;
  const azimuth = Math.atan2(sinD(h), cosD(h) * sinD(latitude) - Math.tan(dec * RAD) * cosD(latitude)) / RAD + 180;
  return { elevation, azimuth: ((azimuth % 360) + 360) % 360 };
}

export interface MoonSky {
  /** Degrees above the horizon (topocentric) and compass azimuth. */
  elevation: number; azimuth: number;
  /** The lit share of its disc, 0 new to 1 full. */
  illumination: number;
  /** Its age through the synodic month, 0 new, 0.5 full (waxing below a half). */
  age: number;
}

/** The moon over a place at an instant (Meeus ch. 47, the largest terms; ~0.3° and ~1 minute of rising). */
export function moonPosition(ms: number, { latitude, longitude }: { latitude: number; longitude: number }): MoonSky {
  const d = daysJ2000(ms);
  const L = 218.316 + 13.176396 * d, Mm = 134.963 + 13.064993 * d, F = 93.272 + 13.22935 * d;
  const D = 297.850 + 12.190749 * d, M = 357.529 + 0.98560028 * d;
  const lon = L + 6.289 * sinD(Mm) + 1.274 * sinD(2 * D - Mm) + 0.658 * sinD(2 * D) + 0.214 * sinD(2 * Mm)
    - 0.186 * sinD(M) - 0.114 * sinD(2 * F) - 0.059 * sinD(2 * D - 2 * Mm) - 0.057 * sinD(2 * D - M - Mm);
  const lat = 5.128 * sinD(F) + 0.280 * sinD(Mm + F) + 0.278 * sinD(Mm - F) + 0.173 * sinD(2 * D - F);
  const dist = 385001 - 20905 * cosD(Mm) - 3699 * cosD(2 * D - Mm) - 2956 * cosD(2 * D);
  const eps = 23.439 - 0.0000004 * d;
  const x = cosD(lat) * cosD(lon), y = cosD(eps) * cosD(lat) * sinD(lon) - sinD(eps) * sinD(lat), z = sinD(eps) * cosD(lat) * sinD(lon) + cosD(eps) * sinD(lat);
  const ra = Math.atan2(y, x) / RAD, dec = Math.asin(z) / RAD;
  const h = horizontal(ra, dec, gmst(d) + longitude, latitude);
  // Seen from the ground, not the Earth's centre: the moon sits up to a degree lower.
  const elevation = h.elevation - Math.asin(6378 / dist) / RAD * cosD(h.elevation);
  // Its age by elongation from the sun (the sun's ecliptic longitude, Meeus ch. 25 low precision).
  const sunLon = 280.46646 + 0.98564736 * d + 1.915 * sinD(M) + 0.02 * sinD(2 * M);
  const age = ((((lon - sunLon) % 360) + 360) % 360) / 360;
  const elong = Math.acos(cosD(lat) * cosD(lon - sunLon));
  return { elevation, azimuth: h.azimuth, illumination: (1 - Math.cos(elong)) / 2, age };
}

/**
 * The celestial sphere at an instant over a place: the 3 × 3 matrix (column-major, as three.js's Matrix3.fromArray
 * reads) taking a world direction to the equatorial frame (x toward RA 0h on the equator, y toward 6h, z the north
 * celestial pole), so stars hashed in that frame keep their places as the night turns.
 */
export function starFrame(ms: number, { latitude, longitude }: { latitude: number; longitude: number }): number[] {
  const lst = gmst(daysJ2000(ms)) + longitude;
  const axis = (ra: number, dec: number) => { const h = horizontal(ra, dec, lst, latitude); return compassDir(h.elevation, h.azimuth); };
  // The images of the equatorial axes are the rows of world → equatorial (the transform is a rotation).
  const ex = axis(0, 0), ey = axis(90, 0), ez = axis(0, 90);
  return [ex[0], ey[0], ez[0], ex[1], ey[1], ez[1], ex[2], ey[2], ez[2]];
}
