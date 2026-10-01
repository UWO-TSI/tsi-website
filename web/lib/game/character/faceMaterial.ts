/**
 * Character shaders (avatar v7): the animated painted face and the hair sheen band.
 *
 * Face: a MeshStandardMaterial (lit exactly like the body) whose albedo is the skin colour with the seven layer
 * slots of face.ts drawn over it from the shared face atlas. Every character owns one material; they share one
 * program (a module-level onBeforeCompile and a fixed program key), and a blink or a talking mouth is a uniform
 * write. Mipmapped atlas with bled gutters: sharp at 1024 px per face canvas in the creator, 512 in the world.
 *
 * Hair: the merged body geometry carries a `hairSheen` attribute (rig.ts: 1 and the lock UVs on sculpted-lock hair,
 * 0 elsewhere). The body material draws a glossy band down each lock that follows the key light (Kajiya-Kay on the
 * lock's tangent, taken from the lock UVs, thresholded into crisp near-white bands like David's hair-3d-set sheet),
 * strongest on the lock's ridge and fading at its root and tip, plus a soft view band in the albedo for the shade.
 */
import * as THREE from "three";
import { FACE_SLOT_COUNT, type FaceSlot } from "./face";

const N = FACE_SLOT_COUNT;

const FACE_PARS = /* glsl */ `
uniform sampler2D uFaceAtlas;
uniform vec4 uFaceSrc[${N}];
uniform vec4 uFaceDst[${N}];
uniform vec4 uFacePose[${N}];
uniform vec4 uFaceTint[${N}];
uniform float uFaceMode[${N}];
varying vec2 vFaceUv;
vec4 faceLayer(vec2 p, vec4 src, vec4 dst, vec4 pz, vec4 tint, float mode) {
  // mode: -1 off, 0 as placed, 1 also mirrored to the other side, 2 only the mirrored copy
  float flip = mode > 1.5 ? 1.0 : (mode > 0.5 ? step(0.5, p.x) : 0.0);
  vec2 q = vec2(mix(p.x, 1.0 - p.x, flip), p.y);
  vec2 d = q - vec2(pz.x, pz.y + pz.z);
  float c = cos(pz.w), s = sin(pz.w);
  q = pz.xy + vec2(d.x * c - d.y * s, d.x * s + d.y * c);
  vec2 l = (q - dst.xy) / max(dst.zw - dst.xy, vec2(1e-5));
  float inside = step(0.0, l.x) * step(l.x, 1.0) * step(0.0, l.y) * step(l.y, 1.0) * step(-0.5, mode);
  vec4 t = texture2D(uFaceAtlas, src.xy + clamp(l, 0.0, 1.0) * src.zw);
  t.rgb = mix(t.rgb, t.rgb * tint.rgb, tint.a);
  t.a *= inside;
  return t;
}
`;

const FACE_DRAW = /* glsl */ `
{
  vec3 faceCol = diffuseColor.rgb;
  for (int i = 0; i < ${N}; i++) {
    vec4 t = faceLayer(vFaceUv, uFaceSrc[i], uFaceDst[i], uFacePose[i], uFaceTint[i], uFaceMode[i]);
    faceCol = mix(faceCol, t.rgb, t.a);
  }
  diffuseColor.rgb = faceCol;
}
`;

interface FaceUniforms {
  uFaceAtlas: { value: THREE.Texture };
  uFaceSrc: { value: THREE.Vector4[] }; uFaceDst: { value: THREE.Vector4[] }; uFacePose: { value: THREE.Vector4[] };
  uFaceTint: { value: THREE.Vector4[] }; uFaceMode: { value: number[] };
}

/** Shared by every face material (one program): the material's own uniforms ride on userData. */
function faceCompile(this: THREE.Material, shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, this.userData.face as FaceUniforms);
  shader.vertexShader = shader.vertexShader
    .replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nvarying vec2 vFaceUv;")
    .replace("#include <uv_vertex>", "#include <uv_vertex>\nvFaceUv = uv;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <uv_pars_fragment>", `#include <uv_pars_fragment>\n${FACE_PARS}`)
    .replace("#include <map_fragment>", FACE_DRAW);
}

export interface FaceMaterial { material: THREE.MeshStandardMaterial; set(skin: string, slots: FaceSlot[]): void; setAtlas(atlas: THREE.Texture): void; dispose(): void }

export function createFaceMaterial(atlas: THREE.Texture): FaceMaterial {
  const u: FaceUniforms = {
    uFaceAtlas: { value: atlas },
    uFaceSrc: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uFaceDst: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uFacePose: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uFaceTint: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uFaceMode: { value: new Array(N).fill(-1) },
  };
  const material = new THREE.MeshStandardMaterial({ name: "CharacterFace", roughness: 0.85, metalness: 0 });
  material.userData.face = u;
  material.onBeforeCompile = faceCompile;
  material.customProgramCacheKey = () => "character-face-v7";
  const tint = new THREE.Color();
  return {
    material,
    set(skin, slots) {
      material.color.set(skin);
      slots.forEach((s, i) => {
        if (!s.src) { u.uFaceMode.value[i] = -1; return; }
        u.uFaceSrc.value[i].set(...s.src);
        u.uFaceDst.value[i].set(...s.dst);
        u.uFacePose.value[i].set(...s.pose);
        if (s.tint) tint.set(s.tint);
        u.uFaceTint.value[i].set(s.tint ? tint.r : 1, s.tint ? tint.g : 1, s.tint ? tint.b : 1, s.tint ? 1 : 0);
        u.uFaceMode.value[i] = s.mirror;
      });
    },
    setAtlas(next) { u.uFaceAtlas.value = next; },
    dispose() { material.dispose(); },
  };
}

/** Face atlas texture settings: glTF-style UV origin (the atlas rects are top-left), sRGB, mipmapped. */
export function prepareFaceAtlas(tex: THREE.Texture) {
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ── hair sheen ────────────────────────────────────────────────────────────────
const SHEEN_VERT = /* glsl */ `
attribute vec3 hairSheen;
varying vec3 vSheen;
`;
const SHEEN_FRAG_PARS = /* glsl */ `
varying vec3 vSheen;
`;
/**
 * After the normal is known, before lighting: the lock's direction (its tangent along v, from screen-space
 * derivatives of the lock UVs), the ridge/length mask, and a soft view band baked into the albedo so hair keeps a
 * little gloss in the shade.
 */
const SHEEN_FRAG = /* glsl */ `
vec3 hairT = vec3(0.0, 1.0, 0.0);
float hairMask = 0.0;
if (vSheen.x > 0.5) {
  vec3 dp1 = dFdx(-vViewPosition), dp2 = dFdy(-vViewPosition);
  vec2 duv1 = dFdx(vSheen.yz), duv2 = dFdy(vSheen.yz);
  vec3 alongV = cross(dp2, normal) * duv1.y + cross(normal, dp1) * duv2.y;
  float lenV = length(alongV);
  if (lenV > 1e-9) hairT = alongV / lenV;
  float ridge = smoothstep(0.3, 0.75, 1.0 - abs(vSheen.y - 0.5) * 2.0);      // strongest down the lock's ridge
  float along = smoothstep(0.0, 0.05, vSheen.z) * (1.0 - smoothstep(0.85, 1.0, vSheen.z));
  hairMask = ridge * along;
  float ring = smoothstep(0.12, 0.3, normal.y) * (1.0 - smoothstep(0.5, 0.72, normal.y)) * smoothstep(0.1, 0.4, normal.z);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.5 + vec3(0.06), clamp(ring * hairMask, 0.0, 1.0) * 0.35);
}
`;
/**
 * After the lights: a glossy band per directional light (Kajiya-Kay on the lock tangent, shifted along the normal):
 * a sharp near-white primary lobe and a softer hair-tinted secondary one, on the lit side only. Stylized: the
 * lobes are thresholded into bands, as on David's hair-3d-set sheet, and they follow the sun.
 */
const SHEEN_SPEC = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
if (hairMask > 0.0) {
  vec3 V = normalize(vViewPosition);
  vec3 gloss = vec3(0.0);
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
    vec3 L = directionalLights[i].direction;
    vec3 H = normalize(L + V);
    vec3 T1 = normalize(hairT + normal * 0.18);
    vec3 T2 = normalize(hairT - normal * 0.12);
    float d1 = dot(T1, H), d2 = dot(T2, H);
    float s1 = smoothstep(0.955, 0.985, sqrt(max(0.0, 1.0 - d1 * d1)));
    float s2 = smoothstep(0.86, 0.96, sqrt(max(0.0, 1.0 - d2 * d2)));
    float lit = smoothstep(-0.05, 0.35, dot(normal, L));
    gloss += directionalLights[i].color * lit * (s1 * 0.75 + s2 * 0.3 * (0.35 + diffuseColor.rgb));
  }
  reflectedLight.directSpecular += gloss * hairMask;
}
#endif
`;

/** Add the sheen band and the glossy highlight to the shared body material (once). */
export function patchHairSheen(material: THREE.MeshStandardMaterial) {
  const base = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${SHEEN_VERT}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSheen = hairSheen;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${SHEEN_FRAG_PARS}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${SHEEN_FRAG}`)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>\n${SHEEN_SPEC}`);
  };
  material.customProgramCacheKey = () => "character-body-sheen-v7b";
  return material;
}
