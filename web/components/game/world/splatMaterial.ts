/**
 * The smooth world's ground material (specs/world-editor.md v0 step 3): ONE lit material for every chunk, placeholder
 * colours (grass, sand, rock), the path's dirt texture and the stone paint's brick. The paint map is
 * a texture of weights (one channel per non-grass paint), read per pixel and blended over the grass with a worn,
 * noisy edge; rock comes in by the ground's own slope (from ROCK_SLOPE.from, all rock by MAX_CLIMB, so ground you
 * cannot climb reads as rock); sand darkens where the water reaches it; the seabed fogs into the water's colour by
 * its real depth (the water lane's `addUnderwater`). Seasons, snow and rain use the uniforms the old ground reads, and
 * the see-through cut round the player is the terrain's (occluders.ts).
 *
 * Its cost: one draw per chunk in view, four reads of one small texture and a little arithmetic a pixel; no per-chunk
 * material.
 */
import * as THREE from "three";
import { addCutout } from "@/lib/game/occluders";
import { Paint, ROCK_SLOPE, type WorldTerrain } from "@/lib/game/world/terrain";
import { addUnderwater } from "../grid/terrainMaterials";
import { TERRAIN_SNOW, TERRAIN_WET } from "../grid/GridTerrain";

/**
 * The path's dirt (game/village-art's art/terrain; David, R2b: "dirt needs to be more yellow and organic, small rocks
 * pebbles imperfaction"): yellow earth with pebbles, worn untinted, a tile every PATH_TILE units. Two reads, the second
 * turned and scaled, crossfaded by broad noise, so the pebbles never repeat in a grid.
 */
const PATH_URL = "/assets/game/terrain/path-albedo.png", PATH_TILE = 4;
let pathTex: THREE.Texture | null = null;
function pathTexture(): THREE.Texture {
  if (pathTex) return pathTex;
  const t = (pathTex = new THREE.TextureLoader().load(PATH_URL));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * The brick road (game/village-art2's art/terrain; David, R2c: "have brick roads to the important shops"): drawn where
 * the stone is painted (the new world's roads; the plaza's stone lies under its tiles), a tile every BRICK_TILE units,
 * one read brightened and darkened by broad noise.
 */
const BRICK_URL = "/assets/game/terrain/road-brick-albedo.png", BRICK_TILE = 2;
let brickTex: THREE.Texture | null = null;
function brickTexture(): THREE.Texture {
  if (brickTex) return brickTex;
  const t = (brickTex = new THREE.TextureLoader().load(BRICK_URL));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** The placeholder colours (linear-ish sRGB hex; grass comes from the season's palette when the scene has one). */
export const SPLAT_COLORS = { grass: "#8FA16C", sand: "#E2CB93", rock: "#8C8577" } as const;

/** The paint map as a weight texture: R sand, G path, B rock, A stone (grass is what is left). */
export function paintTexture(t: WorldTerrain): THREE.DataTexture {
  const data = new Uint8Array(t.cols * t.rows * 4);
  writePaint(t, data, 0, t.rows - 1);
  const tex = new THREE.DataTexture(data, t.cols, t.rows, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Rows k0..k1 of the weight texture from the paint (the editor's paint brush rewrites only what it touched). */
export function writePaint(t: WorldTerrain, data: Uint8Array, k0: number, k1: number): void {
  for (let k = Math.max(0, k0); k <= Math.min(t.rows - 1, k1); k++) for (let i = 0; i < t.cols; i++) {
    const p = k * t.cols + i, s = t.paint[p], o = p * 4;
    data[o] = s === Paint.Sand ? 255 : 0;
    data[o + 1] = s === Paint.Path ? 255 : 0;
    data[o + 2] = s === Paint.Rock ? 255 : 0;
    data[o + 3] = s === Paint.Stone ? 255 : 0;
  }
}

const HEAD = /* glsl */ `
uniform sampler2D uPaintMap;
uniform vec4 uPaintXform; // x0, z0, samples per unit, unused
uniform vec2 uPaintSize;  // cols, rows
uniform vec3 uGrassC;
uniform vec3 uSandC;
uniform sampler2D uPathTex;
uniform vec3 uRockC;
uniform sampler2D uBrickTex;
uniform float uSeaY;
uniform float uSnow;
uniform float uWet;
varying vec3 vTerrainWorld;
varying vec3 vTerrainNormal;
float splatHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float splatNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(splatHash(i), splatHash(i + vec2(1.0, 0.0)), u.x), mix(splatHash(i + vec2(0.0, 1.0)), splatHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

const BODY = /* glsl */ `
  // Four bilinear reads half a sample apart: a 2 × 2 box over the bilinear weights, so a paint's outline is a smooth
  // curve rather than the sample grid's staircase.
  vec2 paintUv = ((vTerrainWorld.xz - uPaintXform.xy) * uPaintXform.z + 0.5) / uPaintSize, paintH = 0.5 / uPaintSize;
  vec4 paintW = 0.25 * (texture2D(uPaintMap, paintUv + vec2(-paintH.x, -paintH.y)) + texture2D(uPaintMap, paintUv + vec2(paintH.x, -paintH.y))
    + texture2D(uPaintMap, paintUv + vec2(-paintH.x, paintH.y)) + texture2D(uPaintMap, paintUv + vec2(paintH.x, paintH.y)));
  float edgeN = splatNoise(vTerrainWorld.xz * 1.7) * 0.65 + splatNoise(vTerrainWorld.xz * 4.3) * 0.35;
  // The brick's edge is laid, so crisper than the worn ones.
  float brickW = smoothstep(0.45, 0.55, paintW.a + (edgeN - 0.5) * 0.08);
  // A worn edge: the soft weights pushed past a noisy threshold.
  paintW = smoothstep(vec4(0.3), vec4(0.7), paintW + (edgeN - 0.5) * 0.35);
  float broad = splatNoise(vTerrainWorld.xz * 0.11);
  vec3 ground = uGrassC * (0.9 + 0.18 * broad + 0.06 * edgeN);
  ground = mix(ground, uSandC * (0.95 + 0.08 * edgeN), paintW.r);
  vec2 pathUv = vTerrainWorld.xz / ${PATH_TILE.toFixed(1)};
  vec3 pathDirt = mix(texture2D(uPathTex, pathUv).rgb, texture2D(uPathTex, mat2(0.8, -0.6, 0.6, 0.8) * pathUv * 0.77 + 0.37).rgb,
    smoothstep(0.35, 0.65, splatNoise(vTerrainWorld.xz * 0.09)));
  ground = mix(ground, pathDirt * (0.95 + 0.1 * edgeN), paintW.g);
  ground = mix(ground, texture2D(uBrickTex, vTerrainWorld.xz / ${BRICK_TILE.toFixed(1)}).rgb * (0.88 + 0.24 * broad), brickW);
  // Rock by slope (rise over run of the ground's own normal) or painted.
  vec3 tn = normalize(vTerrainNormal);
  float rise = sqrt(max(0.0, 1.0 - tn.y * tn.y)) / max(tn.y, 0.001);
  float rockW = max(paintW.b, smoothstep(${ROCK_SLOPE.from.toFixed(2)}, ${ROCK_SLOPE.to.toFixed(2)}, rise + (edgeN - 0.5) * 0.12));
  ground = mix(ground, uRockC * (0.85 + 0.3 * splatNoise(vTerrainWorld.xz * 2.1 + vTerrainWorld.y * 1.3)), rockW);
  // Wet where the water reaches (just above the sea), dark under it.
  float wetBand = 1.0 - smoothstep(uSeaY, uSeaY + 0.16, vTerrainWorld.y);
  ground *= 1.0 - 0.22 * wetBand;
  ground *= 1.0 - uWet * 0.18 * (1.0 - wetBand);
  // Snow lies on what is not steep.
  ground = mix(ground, vec3(0.9, 0.93, 0.97), uSnow * (1.0 - rockW) * (1.0 - wetBand) * 0.92);
  diffuseColor.rgb = ground;
`;

/** The ground material for a terrain. `grass`: the season palette's grass (else the placeholder's). */
export function splatMaterial(t: WorldTerrain, paint: THREE.DataTexture, grass?: string): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ name: "terrain:smooth", roughness: 0.95, metalness: 0 });
  const c = (hex: string) => new THREE.Color(hex);
  const uniforms = {
    uPaintMap: { value: paint }, uPaintXform: { value: new THREE.Vector4(t.x0, t.z0, t.res, 0) }, uPaintSize: { value: new THREE.Vector2(t.cols, t.rows) },
    uGrassC: { value: c(grass ?? SPLAT_COLORS.grass) }, uSandC: { value: c(SPLAT_COLORS.sand) }, uPathTex: { value: pathTexture() },
    uRockC: { value: c(SPLAT_COLORS.rock) }, uBrickTex: { value: brickTexture() }, uSeaY: { value: t.seaLevel }, uSnow: TERRAIN_SNOW, uWet: TERRAIN_WET,
  };
  m.userData.splat = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = "varying vec3 vTerrainWorld;\nvarying vec3 vTerrainNormal;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vTerrainNormal = normal;`);
    shader.fragmentShader = HEAD + shader.fragmentShader.replace("#include <map_fragment>", BODY);
    addUnderwater(shader, "sea");
    addCutout(shader);
  };
  m.customProgramCacheKey = () => "terrain-smooth-splat-v4";
  return m;
}
