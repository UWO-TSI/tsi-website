/**
 * The VFX library's Water type (lib/game/fx/library.ts `water`, specs/vfx-library.md; rods round 9, David 2026-11-05,
 * with specs/references/rods/fx-aquatic-water-ref.png: "turn it into a effect with that foam look and water crashing";
 * VFX round 1, 2026-11-06: "take the water texture and effect not the actual blade, and water internally should move
 * vaster and the foam too and have lots of water droplets like tanjiro water breathing demon slayer"; "make the cashing
 * of the water naturally create the foam and make it faster and crash harder"). Drawn on any holder by HolderFx (the
 * wrap `waterWrap`, the water trail, the drops `dropMaterial`) and on an effect GLB's parts by material name (RodAura):
 *   - `Water`, the body: deep teal-blue, darker diagonal crests with a pale line along each, lighter at the edges,
 *     bubbles, all running fast along the water; white foam breaking along both edges, a faint cyan edge to it, the
 *     outline ragged and always changing, and foam bursting in from an edge wherever the water crashes into itself,
 *     carried along and breaking up. uv: x across (0 to 1), y along (in widths); colour g: the grown water's gate,
 *     b: how near its end (0 the body, 1 the very end: the end turns to foam and breaks up; a trail's age).
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
  float rag = wFbm(vec2(run * 4.0, u * 3.0 + t * 1.8));
  if (e < 0.045 * rag - 0.008) discard;                           // the outline: ragged, breaking as it runs
  float tail = vData.b, bits = wFbm(vec2(run * 7.0, u * 6.0 - t * 2.0));
  if (tail > 0.72 + 0.28 * rag || (tail > 0.45 && bits < tail - 0.2)) discard;  // its end breaking up into foam and gone
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
  // crashes: every so often along its run the water slams into itself from one edge, the foam bursting in across it
  // (fast), then carried along and breaking up into flecks; harder and more often with strength
  float crow = run * 0.7, cid = floor(crow), cx = fract(crow);
  float ct = fract(t * (0.8 + 0.25 * uSplash) + wHash(vec2(cid, 1.7)));
  float side = wHash(vec2(cid, 4.1)) > 0.5 ? u : 1.0 - u;
  float slam = smoothstep(0.0, 0.1, ct) * (0.36 + 0.06 * uSplash) * sin(3.1416 * cx) * (0.7 + 0.6 * wHash(vec2(cid, 9.3)));
  float crash = slam - side + 0.12 * (rag - 0.5);
  bool crashed = crash > 0.0 && wFbm(vec2(run * 6.0, u * 5.0 + t * 1.5)) > smoothstep(0.25, 1.0, ct) * 0.85;
  // the foam along both edges, its inner edge a faint cyan
  if (e < foamW || end > 0.0) c = (foamW > 0.07 && e > foamW - 0.025 && end < 0.02) ? uEdge : uFoamC;
  else if (crashed) c = crash < 0.03 ? uEdge : uFoamC;
  if (tail > 0.38 + 0.25 * rag) c = tail > 0.42 + 0.25 * rag ? uFoamC : uEdge;
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
  p.x += sin(t * 4.6 + p.y * 31.0 + ph) * 0.005 * lift;
  p.y += cos(t * 3.8 + p.x * 27.0 + ph) * 0.004 * lift;
  vPos = position;
  vec3 transformed = p;
  #include <project_vertex>
}`;
const FOAM_FRAG = /* glsl */ `${UNIFORMS}${NOISE}
varying vec3 vData, vPos;
void main() {
  float t = mod(uTime, 1000.0), cyc = fract(t * 0.95 + vData.g), round_ = floor(t * 0.95 + vData.g);
  vec2 q = vPos.xy * 46.0 + vec2(vPos.z * 46.0, -t * 2.6) + round_ * 13.7;
  float n = wFbm(q);
  // the crown breaks into blobs late in its cycle and re-forms; more foam with strength
  float brk = vData.b * smoothstep(0.3, 0.85, cyc) * (1.0 - smoothstep(0.94, 1.0, cyc));
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
  float tau = fract(mod(uTime, 1000.0) * (0.9 + 0.5 * speed) + d.r);
  vec3 out_ = vec3(home.x, 0.0, home.z);
  out_ = length(out_) > 1e-4 ? normalize(out_) : vec3(1.0, 0.0, 0.0);
  float x = tau - 0.5;
  vec3 p = home + out_ * (0.05 + 0.12 * speed) * x + vec3(0.0, 0.09 * x - 0.3 * (tau * tau - 0.25), 0.0);
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

/**
 * The Water type on any holder: two ribbons of water spiralling up its outer part, `radius` off its axis (base to tip,
 * in the holder's own space), for the `Water` material: uv across and along (in widths), colour b its ends (foam,
 * breaking up). One draw.
 */
export function waterWrap(base: THREE.Vector3, tip: THREE.Vector3, radius: number): THREE.BufferGeometry {
  const d = tip.clone().sub(base), len = d.length(), N = 64, ACROSS = 4, from = 0.3, to = 1.03, turns = 1.35, width = 0.14 * len;
  d.normalize();
  const e1 = new THREE.Vector3(1, 0, 0).cross(d);
  if (e1.lengthSq() < 1e-6) e1.set(0, 0, 1).cross(d);
  e1.normalize();
  const e2 = d.clone().cross(e1), pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [], pt = new THREE.Vector3(), last = new THREE.Vector3();
  const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let strand = 0; strand < 2; strand++) {
    let run = 0;
    const first = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const s = from + ((to - from) * i) / N, th = strand * Math.PI + (2 * Math.PI * turns * (s - from)) / (to - from);
      const r = radius * (1 + 0.16 * Math.sin(s * 17 + strand * 2.3)) * (1 - 0.35 * ss(0.92, 1.03, s));
      const tail = Math.max(ss(0.93, 1.03, s), ss(from + 0.07, from, s));
      pt.copy(base).addScaledVector(d, s * len).addScaledVector(e1, Math.cos(th) * r).addScaledVector(e2, Math.sin(th) * r);
      if (i) run += pt.distanceTo(last) / width;
      last.copy(pt);
      for (let j = 0; j < ACROSS; j++) {
        const a = j / (ACROSS - 1), w = (a - 0.5) * width * (1 - 0.4 * ss(0.9, 1.03, s));
        pos.push(pt.x + d.x * w, pt.y + d.y * w, pt.z + d.z * w);
        uv.push(a, run);
        col.push(0, 0, tail);
      }
      if (i) for (let j = 0; j < ACROSS - 1; j++) {
        const a = first + (i - 1) * ACROSS + j, b = a + ACROSS;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/**
 * The Water type's drops on any holder (lib/game/fx/holder.ts throwWater, the holder's drops pool): each a round drop
 * stretched along its fall, flat colours with hard edges (a pale body, a darker rim, a white glint), shrinking away as it
 * fades. The pool's instance layout (iA position, iB width, height, rotation, iC alpha). One draw, solid.
 */
export function dropMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: "WaterDrops",
    uniforms: { uBody: { value: lin(P.pale) }, uRim: { value: lin(P.light) }, uGlint: { value: lin(P.foam) } },
    vertexShader: /* glsl */ `attribute vec4 iA; attribute vec4 iB; attribute vec4 iC;
varying vec2 vQ; varying vec2 vSize; varying float vA;
void main() {
  vec3 axX = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), axY = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(iB.z), s = sin(iB.z);
  vec2 lp = position.xy * iB.xy;
  vec3 transformed = iA.xyz + axX * (lp.x * c - lp.y * s) + axY * (lp.x * s + lp.y * c);
  vQ = lp; vSize = iB.xy; vA = iC.a;
  #include <project_vertex>
}`,
    fragmentShader: /* glsl */ `uniform vec3 uBody, uRim, uGlint;
varying vec2 vQ; varying vec2 vSize; varying float vA;
void main() {
  float hl = max(0.0, (vSize.x - vSize.y) * 0.5), r = vSize.y * 0.5 * clamp(vA * 1.6, 0.0, 1.0);
  float d = length(vec2(max(abs(vQ.x) - hl, 0.0), vQ.y));
  if (d > r) discard;
  vec3 c = d > r * 0.7 ? uRim : uBody;
  if (length(vQ - vec2(hl * 0.5 + r * 0.15, r * 0.3)) < r * 0.32) c = uGlint;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
    toneMapped: false, fog: false,
  });
}
