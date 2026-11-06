"use client";

/**
 * SkyClouds: the cumulus as lit painted cards (sky-ambient rounds 3 and 4, specs/sky-ambient.md §R3, §R4; David picked
 * them, "I like C the best"). They read the clouds SkyDome writes each frame (lib/game/clouds.ts), pinned to the camera
 * like the dome and shrunk toward it to sit inside the far plane, so they look as far and as big as the real ones, and
 * lit by the same sun, moon and sky.
 *
 * Every cloud is one card facing the camera, carrying its shape's normals and thickness (baked once, in code:
 * clouds.ts `bakeCloudAtlas`), lit live in the references' soft two tone: the sun's side bright, a cool shade, the
 * light through the thin edges when the sun is behind it, the base in shade. A cloud forms out of scraps and breaks
 * apart into tatters as its life runs (clouds.ts `cloudLife`); by night the moon lights it flat with a silver edge; under
 * an overcast it softens and flattens into a ragged deck. One instanced draw.
 */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SHAPES, bakeCloudAtlas } from "@/lib/game/clouds";
import { skyUniforms } from "@/lib/game/skyShader";

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

const SPRITE_VERT = /* glsl */ `
uniform highp sampler2D uCloudTex;
uniform int uCloudN;
uniform float uReach;
uniform vec4 uCloud;
varying vec2 vUv;
varying vec2 vCard;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vToward;
varying float vKm;
varying float vLife;
varying float vSeed;
varying float vOut;
void main() {
  // The field is nearest first: drawn far to near, each laid over the last.
  int k = uCloudN - 1 - gl_InstanceID;
  vec4 dr = texelFetch(uCloudTex, ivec2(0, k), 0), look = texelFetch(uCloudTex, ivec2(1, k), 0);
  vec3 right = normalize(cross(dr.xyz, vec3(0.0, 1.0, 0.0))), up = cross(right, dr.xyz);
  float size = abs(look.z), flip = look.z < 0.0 ? -1.0 : 1.0;
  // The card: 3.6 sizes across, 1.2 tall from a little under the base; under an overcast lower and wider, a ragged
  // deck rather than a heap.
  vCard = vec2(position.x * 1.8, mix(-0.1, 1.1, position.y * 0.5 + 0.5));
  vec2 at = vCard * vec2(1.0 + 0.35 * uCloud.z, 1.0 - 0.3 * uCloud.z) * size;
  vec3 rel = (dr.xyz + (right * at.x + up * at.y) / dr.w) * uReach;
  float tile = look.y;
  vUv = (vec2(mod(tile, 2.0), floor(tile / 2.0)) + vec2(position.x * flip * 0.5 + 0.5, position.y * 0.5 + 0.5)) / vec2(2.0, ${SHAPES / 2}.0);
  vRight = right * flip; vUp = up; vToward = dr.xyz;
  vKm = dr.w;
  vLife = look.x; vSeed = fract(look.w); vOut = floor(look.w);
  gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + rel, 1.0);
}`;
const SPRITE_FRAG = /* glsl */ `
${LIGHT}
uniform sampler2D uAtlas;
uniform float uNight;
varying vec2 vUv;
varying vec2 vCard;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vToward;
varying float vKm;
varying float vLife;
varying float vSeed;
varying float vOut;
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + 1.0), f.x), f.y);
}
void main() {
  // Under an overcast the card is read from a blurrier level of the atlas: soft, ragged edges.
  vec4 t = texture2D(uAtlas, vUv, 2.5 * uCloud.z);
  // Forming and breaking apart: the card is eaten by noise from its thin edges inward, so a young cloud gathers out of
  // scraps and an old one comes apart into tatters that thin away (the noise pulled downwind as it goes).
  vec2 q = vCard * vec2(2.0, 3.2) + vSeed * 61.0 - vec2(vOut * (1.0 - vLife) * 1.6, 0.0);
  float nz = noise2(q) * 0.62 + noise2(q * 2.7 + 5.3) * 0.38;
  float e = (1.0 - vLife) * 1.2 - 0.14;
  float a = t.a * smoothstep(e - 0.09, e + 0.09, t.b * 0.6 + nz * 0.58) * smoothstep(0.0, 0.25, vLife);
  if (a < 0.01) discard;
  vec2 nxy = t.rg * 2.0 - 1.0;
  vec3 n = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  vec3 ls = vec3(dot(uSunDir, vRight), dot(uSunDir, vUp), -dot(uSunDir, vToward));
  float thick = t.b * 1.6, h = clamp(vCard.y, 0.0, 1.0);
  // The references' painted two tone, over the whole cloud: a bright sunlit side, a soft cool shade, a soft
  // terminator; the flat base in its own shade; thick middles a touch darker; the light through the thin edges when
  // the sun is behind. By night the moon lights it flat (relief is what showed the model), silver at its thin edges.
  float relief = 1.0 - 0.75 * uNight;
  float wrap = mix(0.6 + 0.3 * h, clamp((dot(n, ls) + 0.55) / 1.55, 0.0, 1.0), relief);
  float tone = mix(wrap, smoothstep(0.3, 0.62, wrap), 0.7);
  float under = mix(0.6, 1.0, smoothstep(-0.05, 0.45, h));
  float dense = 1.0 - 0.25 * smoothstep(0.3, 1.2, thick);
  float thin = exp(-thick * 3.0);
  float through = thin * pow(max(0.0, -ls.z), 1.5) * 1.4;
  vec3 amb = mix(uAmbBottom, uAmbTop, mix(0.55 + 0.35 * h, clamp(n.y * 0.5 + 0.5, 0.0, 1.0), 0.5 * relief));
  float direct = 1.0 - 0.85 * uCloud.z;
  vec3 col = amb * mix(0.85, 1.0, dense) * under + uSunLight * (tone * dense * under + through) * direct;
  // By night: a body a shade darker than the sky behind it, lighter toward its top, and the moon's silver on its thin
  // edges (most near the moon): a cloud against the night, not a lit model.
  // (The night sky's own colour is its zenith's: the skyline's average is lifted by the moon's glow and the fog.)
  float silver = thin * (0.6 + 2.6 * pow(max(0.0, dot(vToward, uMoonDir)), 10.0));
  vec3 night = uSkyTop * (0.78 + 0.22 * h) * under + uMoonLight * (0.2 * h + silver) * direct;
  col = mix(col, night, uNight);
  // Under an overcast a soft grey of the deck's own tone, lighter than round 3's slate, so the banks melt into it.
  col = mix(col, vec3(dot(col, LUMA)) * 1.2, 0.55 * uCloud.z);
  gl_FragColor = vec4(hazeInto(overcast(col), vToward, vKm), a);
}`;

const shared = () => ({
  uSunDir: skyUniforms.uSunDir, uMoonDir: skyUniforms.uMoonDir, uSunLight: skyUniforms.uSunLight, uMoonLight: skyUniforms.uMoonLight,
  uAmbTop: skyUniforms.uAmbTop, uAmbBottom: skyUniforms.uAmbBottom, uSkyTop: skyUniforms.uSkyTop, uSkyHorizon: skyUniforms.uSkyHorizon,
  uCloud: skyUniforms.uCloud, uNight: skyUniforms.uNight, uCloudTex: skyUniforms.uCloudTex, uCloudN: skyUniforms.uCloudN, uReach: { value: 100 },
});

/** Module scope (the react compiler forbids writing through hook values): how many to draw and how far out. */
function stepClouds(geo: THREE.InstancedBufferGeometry, mat: THREE.ShaderMaterial, camera: THREE.Camera) {
  geo.instanceCount = skyUniforms.uCloudN.value;
  mat.uniforms.uReach.value = ((camera as THREE.PerspectiveCamera).far ?? 120) * REACH;
}

export default function SkyClouds() {
  const [geo, mat] = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(2, 2);
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    g.instanceCount = 0;
    const atlas = new THREE.DataTexture(bakeCloudAtlas(), 512, 64 * SHAPES, THREE.RGBAFormat);
    // Mipmapped: an overcast reads a blurrier level (the shader's bias).
    atlas.magFilter = THREE.LinearFilter;
    atlas.minFilter = THREE.LinearMipmapLinearFilter;
    atlas.generateMipmaps = true;
    atlas.needsUpdate = true;
    const m = new THREE.ShaderMaterial({
      vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, uniforms: { ...shared(), uAtlas: { value: atlas } },
      fog: false, transparent: true, depthWrite: false,
    });
    m.name = "sky:cloud-sprites";
    return [g, m];
  }, []);
  useEffect(() => () => { geo.dispose(); (mat.uniforms.uAtlas.value as THREE.Texture).dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ camera }) => stepClouds(geo, mat, camera));
  // Transparent, so after the dome (the last opaque): laid over the sky it drew. First of the transparent ones (a
  // negative order), so a lamp's glow or anything else see-through in front is never covered by a cloud behind it.
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={-100} />;
}

