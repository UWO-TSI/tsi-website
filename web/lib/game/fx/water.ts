/**
 * The effects library's Water type (lib/game/fx/library.ts `water`, specs/fx-library.md; rods round 9, David 2026-11-05,
 * with specs/references/rods/fx-aquatic-water-ref.png: "turn it into a effect with that foam look and water crashing").
 * Three materials, one draw each, picked by an effect part's material name (RodAura):
 *   - `Water`, the body: deep teal-blue, darker diagonal crests with a pale line along each, lighter at the edges,
 *     bubbles, all running along the water; white foam breaking along both edges, a faint cyan edge to it, and the
 *     outline ragged and always changing. uv: x across (0 to 1), y along (in widths); colour g: the grown water's gate.
 *   - `Foam`, the crash: white foam with a faint cyan edge, its outline eaten and re-grown by noise, its tongues
 *     swaying; a crown (colour b) breaks into blobs and re-forms. colour r: depth into the foam (0 at its edge), g: phase.
 *   - `Spray`, the drops: each a quad that faces you, flying out from the thing's axis and falling, shrinking away,
 *     then thrown again. colour: phase, speed (over half: a drop that comes only with strength), size.
 * Flat colours with hard edges (the toon look): no light, no blending, so it sorts and merges like the world's own.
 * The palette is the reference's (picked off it, rods round 9); a water of another colour keeps its relations.
 */
import * as THREE from "three";
import { fxAt } from "./library";

/** The Aquatic sword's water (k-means over its pixels), sRGB. */
export const WATER_PALETTE = { deep: "#114A72", body: "#1F759D", light: "#2FA1C7", pale: "#71BED5", high: "#A3EFF9", foam: "#FBFEFD", foamShade: "#C6FAFA", foamEdge: "#9FE6F0" } as const;

/** Which effect parts are water, by material name. */
export const WATER_PART = /Water|Foam|Spray/;

const NOISE = /* glsl */ `
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wFbm(vec2 p) { return wNoise(p) * 0.6 + wNoise(p * 2.03 + 7.1) * 0.28 + wNoise(p * 4.1 + 3.3) * 0.12; }
`;
const UNIFORMS = /* glsl */ `
uniform float uTime, uFlow, uFoam, uGrow, uSplash;
uniform vec3 uDeep, uBody, uLight, uPale, uHigh, uFoamC, uShade, uEdge;
`;

const WATER_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vData;
void main() {
  vUv = uv; vData = vec3(color);
  vec3 transformed = position;
  #include <project_vertex>
}`;
const WATER_FRAG = /* glsl */ `${UNIFORMS}${NOISE}
varying vec2 vUv; varying vec3 vData;
void main() {
  float u = vUv.x, t = mod(uTime, 1000.0), run = vUv.y - t * uFlow;
  float left = uGrow - vData.g;                                  // the grown water: shown to the strength's share
  if (left < 0.0) discard;
  float e = min(u, 1.0 - u);                                     // 0 at an edge, 0.5 down the middle
  float rag = wFbm(vec2(run * 4.0, u * 3.0 + t * 0.9));
  if (e < 0.045 * rag - 0.008) discard;                           // the outline: ragged, breaking as it runs
  float foamW = uFoam * (0.45 + 0.9 * wFbm(vec2(run * 2.6 + 3.0, t * 0.6 + u * 2.0)));
  float end = vData.g > 0.0 ? 0.05 * (0.5 + rag) - left : -1.0;  // the grown water's end foams
  // the body: long dark streaks leaning up the water, two across it, each with a pale line along one side
  float warp = 0.25 * sin(run * 1.3 + u * 2.1) + 0.6 * wFbm(vec2(u * 1.4, run * 0.7));
  float s = fract(run * 0.55 + u * 1.3 + warp);
  float wedge = 0.5 + 0.3 * (wFbm(vec2(run * 0.7, u * 1.3 + 4.0)) - 0.5) - 0.25 * smoothstep(0.3, 0.04, e);
  float lit = wFbm(vec2(run * 0.55 + 2.0, u * 0.8));             // the pale lines catch the light only here and there
  vec3 c = uBody;
  if ((s > 0.8 && lit > 0.38) || e < 0.13) c = uLight;
  if (s < wedge && e > 0.07) c = uDeep;
  else if (s < wedge + 0.06 && lit > 0.42) c = s < wedge + 0.03 ? uHigh : uPale;
  if (e < 0.07) c = uPale;
  // thin foam lines across the water now and then, and bubbles carried along
  float lane = fract(run * 0.32 + u * 0.45 + 0.25 * wFbm(vec2(run, u * 2.0)));
  if (lane < 0.025 && wFbm(vec2(run * 1.5, u * 4.0)) > 0.48) c = uFoamC;
  vec2 cell = vec2(u * 7.0, run * 4.0), id = floor(cell), f = fract(cell) - 0.5;
  float h = wHash(id);
  if (h > 0.82 && length(f - (vec2(wHash(id + 3.1), wHash(id + 5.7)) - 0.5) * 0.5) < 0.06 + 0.08 * (h - 0.82) * 5.0) c = uHigh;
  // the foam along both edges, its inner edge a faint cyan
  if (e < foamW || end > 0.0) c = (foamW > 0.07 && e > foamW - 0.025 && end < 0.02) ? uEdge : uFoamC;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const FOAM_VERT = /* glsl */ `${UNIFORMS}
varying vec3 vData, vPos;
void main() {
  vData = vec3(color);
  vec3 p = position;
  // the tongues sway, their tips the most
  float lift = 1.0 - vData.r, ph = vData.g * 6.2832, t = mod(uTime, 1000.0);
  p.x += sin(t * 2.3 + p.y * 31.0 + ph) * 0.004 * lift;
  p.y += cos(t * 1.9 + p.x * 27.0 + ph) * 0.003 * lift;
  vPos = position;
  vec3 transformed = p;
  #include <project_vertex>
}`;
const FOAM_FRAG = /* glsl */ `${UNIFORMS}${NOISE}
varying vec3 vData, vPos;
void main() {
  float t = mod(uTime, 1000.0), cyc = fract(t * 0.42 + vData.g), round_ = floor(t * 0.42 + vData.g);
  vec2 q = vPos.xy * 46.0 + vec2(vPos.z * 46.0, -t * 1.1) + round_ * 13.7;
  float n = wFbm(q);
  // the crown breaks into blobs late in its cycle and re-forms; more foam with strength
  float brk = vData.b * smoothstep(0.45, 0.92, cyc) * (1.0 - smoothstep(0.94, 1.0, cyc));
  float bite = max(0.0, n - 0.55 - 0.08 * (uSplash - 1.0)) * 0.8 + brk * 0.9 * n;
  if (vData.r < bite) discard;
  vec3 c = uFoamC;
  if (vData.r < bite + 0.06) c = uEdge;
  else if (vData.r < 0.4 && wFbm(q * 0.5 + 9.0) > 0.47) c = uShade;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const SPRAY_VERT = /* glsl */ `${UNIFORMS}
varying vec2 vCorner; varying float vLive;
void main() {
  vec3 d = vec3(color);
  vec2 corner = uv * 2.0 - 1.0;
  float size = d.b * 0.05, grown = step(0.5, d.g), speed = fract(d.g * 2.0);
  vec3 home = position - vec3(corner * size, 0.0);
  float tau = fract(mod(uTime, 1000.0) * (0.45 + 0.3 * speed) + d.r);
  vec3 out_ = vec3(home.x, 0.0, home.z);
  out_ = length(out_) > 1e-4 ? normalize(out_) : vec3(1.0, 0.0, 0.0);
  float x = tau - 0.5;
  vec3 p = home + out_ * (0.03 + 0.09 * speed) * x + vec3(0.0, 0.07 * x - 0.22 * (tau * tau - 0.25), 0.0);
  vLive = grown > 0.5 ? step(speed, uSplash - 1.0) : 1.0;          // the drops that come with strength
  float s = size * smoothstep(0.0, 0.12, tau) * (1.0 - smoothstep(0.72, 1.0, tau)) * vLive;
  vec3 transformed = p;
  #include <project_vertex>
  mvPosition.xy += corner * s * length((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vCorner = corner;
  gl_Position = projectionMatrix * mvPosition;
}`;
const SPRAY_FRAG = /* glsl */ `${UNIFORMS}
uniform vec3 uColor;
varying vec2 vCorner; varying float vLive;
void main() {
  float r = length(vCorner);
  if (r > 1.0 || vLive < 0.5) discard;
  vec3 c = length(vCorner - vec2(-0.3, 0.35)) < 0.32 ? uFoamC : (r > 0.72 ? mix(uColor, uFoamC, 0.45) : uColor);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const lin = (hex: string) => new THREE.Color(hex);
const P = WATER_PALETTE;

/**
 * A Water type part's material, by its name's kind, in its own `colour` (the body's, the foam's, the drops'). Each
 * holder gets its own (RodAura) so its strength is its own; `waterAt` sets it.
 */
export function waterMaterial(name: string, colour: THREE.Color): THREE.ShaderMaterial {
  const kind = /Foam/.test(name) ? "foam" : /Spray/.test(name) ? "spray" : "water";
  // a body of another colour keeps the reference's relations: each tone as a share of the body, per channel
  const body = kind === "water" ? colour : lin(P.body), tone = (hex: string) => lin(hex).multiply(new THREE.Color(body.r / lin(P.body).r, body.g / lin(P.body).g, body.b / lin(P.body).b));
  const uniforms = {
    uTime: { value: 0 }, uFlow: { value: fxAt("water", "flow") }, uFoam: { value: fxAt("water", "foam") }, uGrow: { value: 0 }, uSplash: { value: 1 },
    uDeep: { value: tone(P.deep) }, uBody: { value: body.clone() }, uLight: { value: tone(P.light) }, uPale: { value: tone(P.pale) }, uHigh: { value: lin(P.high) },
    uFoamC: { value: kind === "foam" ? colour.clone() : lin(P.foam) }, uShade: { value: lin(P.foamShade) }, uEdge: { value: lin(P.foamEdge) }, uColor: { value: colour.clone() },
  };
  const [vertexShader, fragmentShader] = kind === "foam" ? [FOAM_VERT, FOAM_FRAG] : kind === "spray" ? [SPRAY_VERT, SPRAY_FRAG] : [WATER_VERT, WATER_FRAG];
  return new THREE.ShaderMaterial({ name, uniforms, vertexShader, fragmentShader, vertexColors: true, side: THREE.DoubleSide, toneMapped: false, fog: false });
}

/** One holder's water at time `t` (s) and strength `k`: it runs faster, foams more, wraps further and throws more drops. */
export function waterAt(m: THREE.ShaderMaterial, t: number, k: number) {
  const u = m.uniforms;
  u.uTime.value = t;
  u.uFlow.value = fxAt("water", "flow", k);
  u.uFoam.value = fxAt("water", "foam", k);
  u.uGrow.value = Math.min(1, fxAt("water", "wrap", k) - 1);
  u.uSplash.value = fxAt("water", "splashes", k);
}
