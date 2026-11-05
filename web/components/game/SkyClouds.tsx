"use client";

/**
 * SkyClouds: two of round 3's three ways to draw the cumulus (specs/sky-ambient.md §R3; the painted one lives in the dome,
 * lib/game/skyShader.ts). Both read the same clouds as the dome (lib/game/clouds.ts, written by SkyDome each frame),
 * pinned to the camera like the dome and shrunk toward it to sit inside the far plane, so they look as far and as big
 * as the real ones, and lit by the same sun, moon and sky.
 *
 * - **Models** (direction b): every lobe a ball, its underside pressed flat onto the cloud's base, lit as a soft
 *   stylised volume (a wrapped sun with a soft second step, the sky's light from above and the sea's from below, the
 *   lower lobes in their own shade, a bright edge toward the sun). One instanced draw.
 * - **Sprites** (direction c): every cloud one card facing the camera, carrying its shape's normals and thickness
 *   (baked once, in code, from the same lobes: `bakeCloudAtlas`), lit live: the sun's side bright, the light through
 *   the thin edges when the sun is behind it (the silver lining), the thick middle darker. One instanced draw.
 */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CLOUD_MAX, CLOUD_SHAPES, LOBES, SHAPES } from "@/lib/game/clouds";
import { skyUniforms, type CloudStyle } from "@/lib/game/skyShader";

/** Where the clouds are drawn, as a share of the camera's far plane (the dome sits at the far plane, behind them). */
const REACH = 0.9;

const LIGHT = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunLight;
uniform vec3 uMoonLight;
uniform vec3 uAmbTop;
uniform vec3 uAmbBottom;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec4 uCloud;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
vec3 overcast(vec3 c) { return mix(c, vec3(dot(c, LUMA)) * vec3(0.92, 0.96, 1.02) * 0.62, uCloud.z); }
// The clear sky behind a cloud seen toward \`v\` (drawn), for the haze that swallows the far ones.
vec3 hazeInto(vec3 c, vec3 v, float km) {
  vec3 sky = mix(uSkyHorizon, uSkyTop, sqrt(clamp(v.y, 0.0, 1.0)));
  return mix(c, sky, (1.0 - exp(-km / 30.0)) * 0.75);
}
`;

const MODEL_VERT = /* glsl */ `
attribute vec2 iLobe;
uniform highp sampler2D uCloudTex;
uniform float uReach;
varying vec3 vN;
varying vec3 vView;
varying float vH;
varying float vKm;
void main() {
  int k = int(iLobe.x), i = int(iLobe.y);
  vec4 l = texelFetch(uCloudTex, ivec2(i, k), 0), c = texelFetch(uCloudTex, ivec2(${LOBES}, k), 0), dr = texelFetch(uCloudTex, ivec2(${LOBES + 1}, k), 0);
  vec3 p = l.xyz + position * l.w;
  // The cloud as one soft body: each lobe's outward direction, weighted by how near the point is to its surface, so the
  // light runs on across the lobes instead of ringing each one.
  vec3 n = vec3(0.0);
  for (int j = 0; j < ${LOBES}; j++) {
    vec4 o = texelFetch(uCloudTex, ivec2(j, k), 0);
    vec3 rel = p - o.xyz;
    float dist = length(rel);
    n += rel / max(dist, 1e-4) * exp(-6.0 * max(dist - o.w, 0.0) / o.w);
  }
  n = normalize(n);
  // The underside pressed flat onto the base, its normal turned down as it goes.
  float under = 1.0 - smoothstep(-0.25 * l.w, 0.0, p.y);
  n = normalize(mix(n, vec3(0.0, -1.0, 0.0), under));
  p.y = max(p.y, 0.0);
  vec3 rel = dr.xyz * uReach + p * (uReach / dr.w);
  vN = n;
  vView = rel;
  vH = p.y / max(c.w, 1e-4);
  vKm = dr.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + rel, 1.0);
}`;
const MODEL_FRAG = /* glsl */ `
${LIGHT}
varying vec3 vN;
varying vec3 vView;
varying float vH;
varying float vKm;
void main() {
  vec3 n = normalize(vN), v = normalize(vView);
  float wrap = clamp((dot(n, uSunDir) + 0.45) / 1.45, 0.0, 1.0);
  float tone = smoothstep(0.3, 0.62, wrap) * 0.55 + wrap * 0.45;
  float wrapM = clamp((dot(n, uMoonDir) + 0.45) / 1.45, 0.0, 1.0);
  // The lower lobes stand in the others' shade, the base most.
  float shade = mix(0.7, 1.0, smoothstep(0.0, 0.75, vH));
  vec3 amb = mix(uAmbBottom, uAmbTop, clamp(n.y * 0.5 + 0.5, 0.0, 1.0));
  // Against the light the edges, where the cloud is thin, let it through.
  float edge = pow(1.0 - clamp(dot(n, -v), 0.0, 1.0), 2.0), rim = edge * (0.15 + 1.1 * pow(max(0.0, dot(v, uSunDir)), 1.5));
  float direct = 1.0 - 0.85 * uCloud.z;
  vec3 col = amb * shade * 1.1 + (uSunLight * (tone * shade + rim) + uMoonLight * wrapM * shade) * direct;
  gl_FragColor = vec4(hazeInto(overcast(col), v, vKm), 1.0);
}`;

const SPRITE_VERT = /* glsl */ `
uniform highp sampler2D uCloudTex;
uniform int uCloudN;
uniform float uReach;
varying vec2 vUv;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vToward;
varying float vKm;
varying float vFade;
void main() {
  // The field is nearest first: drawn far to near, each laid over the last.
  int k = uCloudN - 1 - gl_InstanceID;
  vec4 c = texelFetch(uCloudTex, ivec2(${LOBES}, k), 0), dr = texelFetch(uCloudTex, ivec2(${LOBES + 1}, k), 0), look = texelFetch(uCloudTex, ivec2(${LOBES + 2}, k), 0);
  vec3 right = normalize(cross(dr.xyz, vec3(0.0, 1.0, 0.0))), up = cross(right, dr.xyz);
  // The card: 3.6 sizes across, 1.2 tall from a little under the base.
  vec2 at = vec2(position.x * 1.8, mix(-0.1, 1.1, position.y * 0.5 + 0.5)) * c.w;
  vec3 rel = (dr.xyz + (right * at.x + up * at.y) / dr.w) * uReach;
  float tile = look.y, flip = look.z > 0.5 ? -1.0 : 1.0;
  vUv = (vec2(mod(tile, 2.0), floor(tile / 2.0)) + vec2(position.x * flip * 0.5 + 0.5, position.y * 0.5 + 0.5)) / vec2(2.0, ${SHAPES / 2}.0);
  vRight = right * flip; vUp = up; vToward = dr.xyz;
  vKm = dr.w;
  vFade = look.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + rel, 1.0);
}`;
const SPRITE_FRAG = /* glsl */ `
${LIGHT}
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vToward;
varying float vKm;
varying float vFade;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  float a = t.a * vFade;
  if (a < 0.01) discard;
  vec2 nxy = t.rg * 2.0 - 1.0;
  vec3 n = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  vec3 ls = vec3(dot(uSunDir, vRight), dot(uSunDir, vUp), -dot(uSunDir, vToward));
  vec3 lm = vec3(dot(uMoonDir, vRight), dot(uMoonDir, vUp), -dot(uMoonDir, vToward));
  float thick = t.b * 1.6;
  float wrap = clamp((dot(n, ls) + 0.5) / 1.5, 0.0, 1.0);
  float wrapM = clamp((dot(n, lm) + 0.5) / 1.5, 0.0, 1.0);
  // Thick middles darker, the base in shade; the light through the thin edges when the sun is behind.
  float dense = 1.0 - 0.32 * smoothstep(0.2, 1.2, thick);
  float through = exp(-thick * 3.0) * pow(max(0.0, -ls.z), 1.5) * 1.6;
  vec3 amb = mix(uAmbBottom, uAmbTop, clamp(n.y * 0.5 + 0.5, 0.0, 1.0));
  float direct = 1.0 - 0.85 * uCloud.z;
  vec3 col = amb * mix(0.85, 1.0, dense) + (uSunLight * (wrap * dense + through) + uMoonLight * wrapM * dense) * direct;
  gl_FragColor = vec4(hazeInto(overcast(col), vToward, vKm), a);
}`;

/**
 * The sprite atlas: each shape's card (3.6 sizes across, 1.2 tall) seen side on, 2 × SHAPES/2 tiles of `w` × `w/2`:
 * the front surface's normal (r, g), the thickness through the cloud (b, in sizes / 1.6) and the coverage (a, its edge a
 * texel wide). The same lobes as every other style, flat-based.
 */
export function bakeCloudAtlas(w = 256): Uint8Array {
  const h = w / 2, cols = 2, rows = SHAPES / 2, W = w * cols, out = new Uint8Array(W * h * rows * 4), per = w / 3.6;
  CLOUD_SHAPES.forEach((lobes, k) => {
    const ox = (k % cols) * w, oy = Math.floor(k / cols) * h;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = ((i + 0.5) / w * 2 - 1) * 1.8, y = -0.1 + ((j + 0.5) / h) * 1.2;
      let sd = -1e9, front = -1e9, back = 1e9, nx = 0, ny = 0, nz = 0, wsum = 0;
      const fronts: number[] = [];
      for (const [lx, ly, lz, r] of lobes) {
        const dx = x - lx, dy = y - ly, d2 = dx * dx + dy * dy;
        sd = Math.max(sd, r - Math.sqrt(d2));
        if (d2 < r * r) { const s = Math.sqrt(r * r - d2); fronts.push(lz + s); front = Math.max(front, lz + s); back = Math.min(back, lz - s); }
        else fronts.push(-1e9);
      }
      sd = Math.min(sd, y + 0.02);
      // The front's normal, softened across the lobes that meet near it so the creases stay soft.
      lobes.forEach(([lx, ly, , r], m) => {
        if (fronts[m] < -1e8) return;
        const wgt = Math.exp(-(front - fronts[m]) / 0.06), s = fronts[m] - lobes[m][2];
        nx += ((x - lx) / r) * wgt; ny += ((y - ly) / r) * wgt; nz += (s / r) * wgt; wsum += wgt;
      });
      const o = ((oy + j) * W + ox + i) * 4, cover = Math.min(1, Math.max(0, sd * per + 0.5));
      if (wsum > 0) {
        // Toward the base the surface turns down into it.
        const base = Math.max(0, 1 - y / 0.16);
        nx /= wsum; ny = ny / wsum - 0.8 * base; nz = nz / wsum + 0.6 * base;
        const len = Math.hypot(nx, ny, nz) || 1;
        out[o] = Math.round((nx / len * 0.5 + 0.5) * 255);
        out[o + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
        out[o + 2] = Math.round(Math.min(1, (front - back) / 1.6) * 255);
      } else { out[o] = out[o + 1] = 128; out[o + 2] = 0; }
      out[o + 3] = Math.round(cover * 255);
    }
  });
  return out;
}

const shared = () => ({
  uSunDir: skyUniforms.uSunDir, uMoonDir: skyUniforms.uMoonDir, uSunLight: skyUniforms.uSunLight, uMoonLight: skyUniforms.uMoonLight,
  uAmbTop: skyUniforms.uAmbTop, uAmbBottom: skyUniforms.uAmbBottom, uSkyTop: skyUniforms.uSkyTop, uSkyHorizon: skyUniforms.uSkyHorizon,
  uCloud: skyUniforms.uCloud, uCloudTex: skyUniforms.uCloudTex, uCloudN: skyUniforms.uCloudN, uReach: { value: 100 },
});

/** Module scope (the react compiler forbids writing through hook values): how many to draw and how far out. */
function stepClouds(geo: THREE.InstancedBufferGeometry, mat: THREE.ShaderMaterial, camera: THREE.Camera, per: number) {
  geo.instanceCount = skyUniforms.uCloudN.value * per;
  mat.uniforms.uReach.value = ((camera as THREE.PerspectiveCamera).far ?? 120) * REACH;
}

function Models() {
  const [geo, mat] = useMemo(() => {
    const ball = new THREE.IcosahedronGeometry(1, 3), g = new THREE.InstancedBufferGeometry();
    g.index = ball.index;
    g.setAttribute("position", ball.getAttribute("position"));
    g.setAttribute("normal", ball.getAttribute("normal"));
    const lobe = new Float32Array(CLOUD_MAX * LOBES * 2);
    for (let k = 0; k < CLOUD_MAX; k++) for (let i = 0; i < LOBES; i++) lobe.set([k, i], (k * LOBES + i) * 2);
    g.setAttribute("iLobe", new THREE.InstancedBufferAttribute(lobe, 2));
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({ vertexShader: MODEL_VERT, fragmentShader: MODEL_FRAG, uniforms: shared(), fog: false });
    m.name = "sky:cloud-models";
    return [g, m];
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ camera }) => stepClouds(geo, mat, camera, LOBES));
  // Before the dome (renderOrder 1000), so the dome skips what they cover.
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={999} />;
}

function Sprites() {
  const [geo, mat] = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(2, 2);
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    g.instanceCount = 0;
    const atlas = new THREE.DataTexture(bakeCloudAtlas(), 512, 64 * SHAPES, THREE.RGBAFormat);
    atlas.magFilter = atlas.minFilter = THREE.LinearFilter;
    atlas.needsUpdate = true;
    const m = new THREE.ShaderMaterial({
      vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, uniforms: { ...shared(), uAtlas: { value: atlas } },
      fog: false, transparent: true, depthWrite: false,
    });
    m.name = "sky:cloud-sprites";
    return [g, m];
  }, []);
  useEffect(() => () => { geo.dispose(); (mat.uniforms.uAtlas.value as THREE.Texture).dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ camera }) => stepClouds(geo, mat, camera, 1));
  // Transparent, so after the dome: laid over the sky it drew.
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={1001} />;
}

export default function SkyClouds({ style }: { style: CloudStyle }) {
  return style === "models" ? <Models /> : style === "sprites" ? <Sprites /> : null;
}
