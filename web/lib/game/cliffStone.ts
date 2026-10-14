import type { WebGLProgramParametersWithUniforms } from "three";

/**
 * The cliff walls as stone (specs/v1-drop.md §8c item 4, ref `water-clarity-palette-ref.png`): the kit's flat painted
 * strata become stacked faceted blocks in the boulders' blue-grey, each block a flat facet turned a little its own way
 * (so the sun picks the blocks out one by one), dark crevices between them, each cliff tier darker at its foot where
 * the ground shades it, and a little of the kit's own painted grain kept for texture. World-space, so a wall reads as
 * one rock face across the kit pieces it is built from, on every cliff the kit draws.
 */
const VERTEX_HEAD = /* glsl */ `
varying vec3 vCsPos;
varying vec3 vCsN;
`;
const VERTEX_TAIL = /* glsl */ `
#ifdef USE_INSTANCING
  vCsPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  vCsN = mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal;
#else
  vCsPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vCsN = mat3(modelMatrix) * objectNormal;
#endif
`;
const FRAGMENT_HEAD = /* glsl */ `
varying vec3 vCsPos;
varying vec3 vCsN;
vec2 csHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
// Nearest and second-nearest feature distances, and the nearest cell.
void csVoronoi(vec2 x, out vec2 id, out float f1, out float f2) {
  vec2 n = floor(x), f = fract(x);
  f1 = 8.0; f2 = 8.0; id = n;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = g + 0.15 + 0.7 * csHash2(n + g) - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; id = n + g; } else if (d < f2) { f2 = d; }
  }
  f1 = sqrt(f1); f2 = sqrt(f2);
}
vec2 csId; float csEdge; vec3 csR; vec3 csAlong;
`;
/** Linear-light stone: the boulders' side grey to their lit grey (#7f8b94 → #a2adb3), a warm block now and then. */
const FRAGMENT_COLOUR = /* glsl */ `
  {
    vec3 n = normalize(vCsN);
    float facesX = step(abs(n.z), abs(n.x));
    csAlong = mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), facesX);
    vec2 p = vec2(mix(vCsPos.x, vCsPos.z, facesX), vCsPos.y);
    float f1, f2;
    // Blocks about 0.8 wide and 1.25 tall: stacked stone, a little columnar.
    csVoronoi(p * vec2(1.25, 0.8), csId, f1, f2);
    csEdge = smoothstep(0.012, 0.075, f2 - f1);
    csR = vec3(csHash2(csId), csHash2(csId + 17.31).x);
    vec3 stone = mix(vec3(0.212, 0.258, 0.296), vec3(0.37, 0.42, 0.45), csR.x);
    stone = mix(stone, stone * vec3(1.12, 1.03, 0.9), step(0.82, csR.y));
    // The crevices, and each cliff tier (1.5 u) darker at its foot.
    stone *= mix(0.62, 1.0, csEdge);
    stone *= mix(0.68, 1.04, smoothstep(0.0, 0.85, fract(vCsPos.y / 1.5 + 0.001)));
    #ifdef USE_MAP
      stone *= mix(1.0, 0.72 + 0.56 * dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.3);
    #endif
    diffuseColor.rgb = stone;
  }
`;
/** Each block a facet: its normal turned along the wall and up or down by its own amount, flattest at the crevices. */
const FRAGMENT_NORMAL = /* glsl */ `
  normal = normalize(normal + (viewMatrix * vec4((csAlong * (csR.y - 0.5) + vec3(0.0, csR.z - 0.45, 0.0)) * 0.85 * csEdge, 0.0)).xyz);
`;

export function addCliffStone(shader: WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${VERTEX_HEAD}`)
    .replace("#include <fog_vertex>", `#include <fog_vertex>\n${VERTEX_TAIL}`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${FRAGMENT_HEAD}`)
    .replace("#include <map_fragment>", `#include <map_fragment>\n${FRAGMENT_COLOUR}`)
    .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${FRAGMENT_NORMAL}`);
}
