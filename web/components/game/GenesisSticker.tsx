"use client";

/**
 * The GENESIS sticker (specs/merch/genesis-sticker.md; David: "these were printed holographic so its got cool effect"):
 * a thin card printed with his art (art/merch/build_genesis_sticker.py), light (navy on white) or dark (white on black),
 * its face holographic foil. The foil is a patch on the card's own material (no extra pass): a rainbow sheen whose hue
 * runs in bands across the card and shifts with the view angle and the card's tilt, and a fine diffraction grain that
 * sparkles as the angle changes, strongest where the print is bare (the white of the light one, the black of the dark
 * one) and weaker on the ink. It's added as light the card gives off, so it reads through the pixel finish.
 */
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { prepareModel } from "@/lib/game/modelMaterials";

export const STICKER_URL = "/assets/game/items/merch-genesis-sticker.glb";
export const STICKER_SLUG = "merch-genesis-sticker";
export type StickerVariant = "light" | "dark";
export const STICKER_VARIANTS: readonly { id: StickerVariant; label: string; sprite: string }[] = [
  { id: "light", label: "Light", sprite: "/assets/game/items/merch-genesis-sticker-light-sprite.webp" },
  { id: "dark", label: "Dark", sprite: "/assets/game/items/merch-genesis-sticker-dark-sprite.webp" },
];
const DARK_PRINT = "/assets/game/items/merch-genesis-sticker-dark.webp";
/** The card: 7.5 x 6 cm in model units of 10 cm. */
export const STICKER_SIZE: [number, number] = [0.75, 0.6];

const FOIL_VERT = `
varying vec2 vFoilUv;
`;
const FOIL_FRAG = `
varying vec2 vFoilUv;
uniform float uFoilBareLight;
uniform float uFoilStrength;
float foilHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 foilHue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
`;
/** The foil, in the fragment after the emissive map: `normal` is view space, vViewPosition points at the camera. */
const FOIL_MAIN = `
#include <emissivemap_fragment>
{
  vec3 fv = normalize(vViewPosition);
  float ndv = clamp(dot(normal, fv), 0.0, 1.0);
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float bare = uFoilBareLight > 0.5 ? smoothstep(0.55, 0.95, lum) : 1.0 - smoothstep(0.08, 0.45, lum);
  float mask = mix(0.25, 1.0, bare);
  float h = vFoilUv.x * 0.9 + vFoilUv.y * 0.6 + normal.x * 0.9 + normal.y * 0.7 + ndv * 1.6;
  vec3 hue = foilHue(fract(h));
  float grazing = 0.55 + 0.45 * (1.0 - ndv);
  // diffraction grain: fine cells that catch the light at their own angle
  vec2 cell = floor(vFoilUv * vec2(260.0, 208.0));
  float spark = smoothstep(0.975, 1.0, foilHash(cell + floor((normal.xy + ndv) * 7.0) * 17.0));
  if (uFoilBareLight > 0.5) {
    // on white the foil tints the paper (light added to white would only clip): pastel bands across it
    diffuseColor.rgb *= mix(vec3(1.0), hue * 0.6 + 0.4, clamp(uFoilStrength * 1.5 * mask * grazing, 0.0, 1.0));
    totalEmissiveRadiance += vec3(spark) * 0.5 * mask;
  } else {
    // on black it glows through
    totalEmissiveRadiance += (mix(vec3(1.0), hue, 0.7) * uFoilStrength * 0.4 * grazing + vec3(spark) * 0.35) * mask;
  }
}
`;
/** Make `material` holographic (chaining whatever patch it already has: the look's, the snow's). */
export function foil(material: THREE.MeshStandardMaterial, bareIsLight: boolean, strength = 0.32): THREE.MeshStandardMaterial {
  const base = material.onBeforeCompile, baseKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.uniforms.uFoilBareLight = { value: bareIsLight ? 1 : 0 };
    shader.uniforms.uFoilStrength = { value: strength };
    shader.vertexShader = FOIL_VERT + shader.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\n  vFoilUv = uv;");
    shader.fragmentShader = FOIL_FRAG + shader.fragmentShader.replace("#include <emissivemap_fragment>", FOIL_MAIN);
  };
  material.customProgramCacheKey = () => `${baseKey()}|foil${bareIsLight ? "L" : "D"}`;
  return material;
}

/** The card, prepared, with its foil and the variant's print: its own copy (each variant its own material). */
function buildCard(scene: THREE.Object3D, variant: StickerVariant, dark: THREE.Texture | null): { card: THREE.Object3D; dispose: () => void } {
  const card = prepareModel(scene, STICKER_URL).clone(true);
  const made: THREE.Material[] = [];
  card.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map(m => {
      if (!m.name.startsWith("M_Sticker")) return m;
      const face = (m as THREE.MeshStandardMaterial).clone();
      if (variant === "dark" && dark) face.map = dark;
      face.roughness = 0.45; face.metalness = 0.1;
      made.push(foil(face, variant === "light"));
      return face;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
  return { card, dispose: () => made.forEach(m => m.dispose()) };
}

/** The dark print, loaded once (it matches the GLB's texture: no flip, sRGB). */
let darkPrint: THREE.Texture | null = null;
function darkTexture(): THREE.Texture {
  if (!darkPrint) {
    darkPrint = new THREE.TextureLoader().load(DARK_PRINT);
    darkPrint.flipY = false; darkPrint.colorSpace = THREE.SRGBColorSpace; darkPrint.anisotropy = 4;
  }
  return darkPrint;
}

export default function GenesisSticker({ variant = "light", scale = 1, position, rotation }: {
  variant?: StickerVariant; scale?: number; position?: [number, number, number]; rotation?: [number, number, number];
}) {
  const { scene } = useGLTF(STICKER_URL);
  const built = useMemo(() => buildCard(scene, variant, variant === "dark" ? darkTexture() : null), [scene, variant]);
  useEffect(() => built.dispose, [built]);
  return <group position={position} rotation={rotation} scale={scale}><primitive object={built.card} /></group>;
}

useGLTF.preload(STICKER_URL);
