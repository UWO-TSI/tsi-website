"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * PS1 Shader Pipeline
 *
 * Applies PS1-era visual effects to all meshes in the scene:
 * 1. Vertex snapping — snaps vertex positions to a low-res grid (jitter effect)
 * 2. Affine texture mapping — disables perspective-correct UV interpolation
 * 3. NearestFilter on all textures — removes bilinear filtering
 *
 * The low-res render (320x240) is achieved by setting dpr={0.25} on the Canvas,
 * combined with CSS `image-rendering: pixelated` for nearest-neighbor upscale.
 *
 * Refs:
 * - bandinopla PS1Material (GitHub Gist)
 * - Roman Liutikov blog — global shader patching
 * - Codrops PS1 Jitter Shader
 */

// Vertex snapping resolution — lower = more jitter. 160 is a good PS1-feel.
const SNAP_RESOLUTION = 160.0;

// GLSL injected into vertex shaders for vertex snapping
const PS1_VERTEX_PARS = /* glsl */ `
  uniform float uPS1SnapRes;
`;

const PS1_VERTEX_SNAP = /* glsl */ `
  // PS1 vertex snapping: quantize clip-space position to a low-res grid
  {
    float snap = uPS1SnapRes;
    gl_Position.xy = floor(gl_Position.xy * snap / gl_Position.w + 0.5)
                     * gl_Position.w / snap;
  }
`;

// GLSL for affine texture mapping — pass UVs multiplied by w to fragment,
// then divide by w in fragment. Since varying interpolation is linear (not
// perspective-correct in our modified pipeline), this produces affine mapping.
const PS1_AFFINE_PARS_VERTEX = /* glsl */ `
  varying float vPS1W;
`;

const PS1_AFFINE_ASSIGN_VERTEX = /* glsl */ `
  vPS1W = gl_Position.w;
`;

/**
 * Patches a material's shader to include PS1 vertex snapping.
 * Called via material.onBeforeCompile.
 */
function patchShader(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.uPS1SnapRes = { value: SNAP_RESOLUTION };

  // Inject vertex snapping uniforms
  shader.vertexShader = shader.vertexShader.replace(
    "#include <common>",
    "#include <common>\n" + PS1_VERTEX_PARS + PS1_AFFINE_PARS_VERTEX
  );

  // Inject vertex snapping + affine UV pass after projection
  shader.vertexShader = shader.vertexShader.replace(
    "#include <project_vertex>",
    "#include <project_vertex>\n" + PS1_VERTEX_SNAP + PS1_AFFINE_ASSIGN_VERTEX
  );
}

/**
 * Applies NearestFilter to a texture and disables mipmaps.
 */
function applyNearestFilter(texture: THREE.Texture | null) {
  if (!texture) return;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}

/**
 * Traverses a material and applies NearestFilter to all textures.
 */
function patchMaterialTextures(material: THREE.Material) {
  const mat = material as THREE.MeshStandardMaterial;
  applyNearestFilter(mat.map);
  applyNearestFilter(mat.normalMap);
  applyNearestFilter(mat.roughnessMap);
  applyNearestFilter(mat.metalnessMap);
  applyNearestFilter(mat.emissiveMap);
  applyNearestFilter(mat.aoMap);
}

/**
 * Hook that traverses the scene and patches all mesh materials
 * with PS1 vertex snapping, affine texture mapping, and NearestFilter.
 */
export function usePS1Materials() {
  const { scene } = useThree();

  useEffect(() => {
    const patched = new Set<string>();

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;

      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];

      for (const mat of materials) {
        if (!mat || patched.has(mat.uuid)) continue;

        mat.onBeforeCompile = patchShader;
        patchMaterialTextures(mat);
        mat.needsUpdate = true;
        patched.add(mat.uuid);
      }
    });
  }, [scene]);
}

/**
 * Component that applies PS1 shader pipeline to the entire scene.
 * Place this as a child of your <Canvas> to enable PS1 effects.
 *
 * Usage:
 * ```tsx
 * <Canvas dpr={0.25} gl={{ antialias: false }} style={{ imageRendering: 'pixelated' }}>
 *   <PS1Effect />
 *   <YourScene />
 * </Canvas>
 * ```
 */
export default function PS1Effect() {
  usePS1Materials();
  return null;
}
