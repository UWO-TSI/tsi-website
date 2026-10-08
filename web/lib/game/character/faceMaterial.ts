/**
 * Character shaders (avatar v7): the animated painted face. Characters are matte: no specular from the sun or the
 * sky on skin, hair or clothes (David, 2026-10-01: "they should not be toys ... normal matte hair").
 *
 * Face: a matte MeshPhysicalMaterial (lit exactly like the body) whose albedo is the skin colour with the layer
 * slots of face.ts drawn over it from the shared face atlas. Every character owns one material; they share one
 * program (a module-level onBeforeCompile and a fixed program key), and a blink or a talking mouth is a uniform
 * write. Mipmapped atlas with bled gutters: sharp at 1024 px per face canvas in the creator, 512 in the world.
 * The atlas has a second page (David's 19 faces) on a second sampler: a slot says which page it reads, and the page
 * is a 1x1 transparent stand-in until a look that wears one of them loads it (loadFacePage).
 */
import * as THREE from "three";
import { FACE_SLOT_COUNT, type FaceSlot } from "./face";

/** Every character material: diffuse light only, so nothing reads as vinyl or plastic. */
export const MATTE = { roughness: 1, metalness: 0, specularIntensity: 0 } as const;

const N = FACE_SLOT_COUNT;

const FACE_PARS = /* glsl */ `
uniform sampler2D uFaceAtlas;
uniform sampler2D uFaceAtlas2;
uniform vec4 uFaceSrc[${N}];
uniform vec4 uFaceDst[${N}];
uniform vec4 uFacePose[${N}];
uniform vec4 uFaceTint[${N}];
uniform float uFaceMode[${N}];
uniform float uFacePage[${N}];
varying vec2 vFaceUv;
vec4 faceLayer(vec2 p, vec4 src, vec4 dst, vec4 pz, vec4 tint, float mode, float page) {
  // mode: -1 off, 0 as placed, 1 also mirrored to the other side, 2 only the mirrored copy
  float flip = mode > 1.5 ? 1.0 : (mode > 0.5 ? step(0.5, p.x) : 0.0);
  vec2 q = vec2(mix(p.x, 1.0 - p.x, flip), p.y);
  vec2 d = q - vec2(pz.x, pz.y + pz.z);
  float c = cos(pz.w), s = sin(pz.w);
  q = pz.xy + vec2(d.x * c - d.y * s, d.x * s + d.y * c);
  vec2 l = (q - dst.xy) / max(dst.zw - dst.xy, vec2(1e-5));
  float inside = step(0.0, l.x) * step(l.x, 1.0) * step(0.0, l.y) * step(l.y, 1.0) * step(-0.5, mode);
  vec2 at = src.xy + clamp(l, 0.0, 1.0) * src.zw;
  // page is a uniform, so this branch is uniform control flow (mip selection stays defined)
  vec4 t = page > 0.5 ? texture2D(uFaceAtlas2, at) : texture2D(uFaceAtlas, at);
  t.rgb = mix(t.rgb, t.rgb * tint.rgb, tint.a);
  t.a *= inside;
  return t;
}
`;

const FACE_DRAW = /* glsl */ `
{
  vec3 faceCol = diffuseColor.rgb;
  for (int i = 0; i < ${N}; i++) {
    vec4 t = faceLayer(vFaceUv, uFaceSrc[i], uFaceDst[i], uFacePose[i], uFaceTint[i], uFaceMode[i], uFacePage[i]);
    faceCol = mix(faceCol, t.rgb, t.a);
  }
  diffuseColor.rgb = faceCol;
}
`;

interface FaceUniforms {
  uFaceAtlas: { value: THREE.Texture }; uFaceAtlas2: { value: THREE.Texture };
  uFaceSrc: { value: THREE.Vector4[] }; uFaceDst: { value: THREE.Vector4[] }; uFacePose: { value: THREE.Vector4[] };
  uFaceTint: { value: THREE.Vector4[] }; uFaceMode: { value: number[] }; uFacePage: { value: number[] };
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

export interface FaceMaterial { material: THREE.MeshPhysicalMaterial; set(skin: string, slots: FaceSlot[]): void; setAtlas(atlas: THREE.Texture): void; setAtlas2(atlas: THREE.Texture): void; dispose(): void }

/** The second page's stand-in until it loads: one transparent texel. */
let emptyPage: THREE.DataTexture | null = null;
const empty = () => {
  if (!emptyPage) { emptyPage = new THREE.DataTexture(new Uint8Array(4), 1, 1); emptyPage.needsUpdate = true; }
  return emptyPage;
};

export function createFaceMaterial(atlas: THREE.Texture): FaceMaterial {
  const u: FaceUniforms = {
    uFaceAtlas: { value: atlas }, uFaceAtlas2: { value: empty() },
    uFaceSrc: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uFaceDst: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uFacePose: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uFaceTint: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uFaceMode: { value: new Array(N).fill(-1) },
    uFacePage: { value: new Array(N).fill(0) },
  };
  const material = new THREE.MeshPhysicalMaterial({ name: "CharacterFace", ...MATTE });
  material.userData.face = u;
  material.onBeforeCompile = faceCompile;
  material.customProgramCacheKey = () => `character-face-v7-matte-${N}`;
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
        u.uFacePage.value[i] = s.page;
      });
    },
    setAtlas(next) { u.uFaceAtlas.value = next; },
    setAtlas2(next) { u.uFaceAtlas2.value = next; },
    dispose() { material.dispose(); },
  };
}

/** The atlas's second page at `url`, loaded once and shared (prepared like the first). */
const pages = new Map<string, Promise<THREE.Texture>>();
export function loadFacePage(url: string): Promise<THREE.Texture> {
  let page = pages.get(url);
  if (!page) {
    page = new THREE.TextureLoader().loadAsync(url).then(prepareFaceAtlas);
    page.catch(() => pages.delete(url));
    pages.set(url, page);
  }
  return page;
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
