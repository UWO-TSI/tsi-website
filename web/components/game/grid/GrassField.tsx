"use client";

/**
 * GrassField: the lawn's blades (specs/v1-drop.md §8b and §8c, ref `references/look/2026-10-13/grass-shader-ref.png`).
 * Replaces the sparse flowing tufts of the cinematic pass with a carpet of blade cards around the view:
 *
 * - **Wind** on the world clock (row 238): a gust wave travelling along the world wind, plus a flutter per clump;
 *   the gust's crest catches the light, so the wind reads as waves crossing the field.
 * - **Blade cards** (`grassBlades.ts`): four clump shapes, alpha as a distance field so they hold up mipmapped.
 * - **Colour**: a gradient from a dark root to a light, warm tip, on the island's own (seasonal) grass colour and the
 *   ground's broad hue patches, with per-clump and world-noise variation. Autumn's olive gold (row 303), winter's
 *   snow and rain's wet darkening come from the same uniforms the ground reads.
 * - **Bending** under every character (players, residents, remotes: Character registers itself), with short trails
 *   that spring back (`BendField`), and a darker tint where it is pressed.
 * - **Sun shadows** received through the standard lit material (the look's shadow tint included); blades never cast.
 * - **Perspective correction**: each card turns to face the camera and leans away from it by part of the view's
 *   elevation, so a camera looking down sees blades, not gaps between edge-on cards.
 * - **Distance fading**, dithered (4×4 Bayer), from the camera's own distance to the focus outward; on High a dense
 *   near layer hands over (dithered) to a sparser, broader far one, so the lawn thins with distance.
 * - **Lite** is one sparse layer, one card a clump, with the fade pulled in.
 *
 * THE COST. One draw call a layer (no shadow pass), a fixed number of instances whatever the island's size: the clumps
 * live on a world-anchored grid recycled around the view focus (slot i holds the world column nearest the focus with
 * index ≡ i mod n), so nothing swims as the camera moves and the v2 world costs what the village does. High: 2 draws,
 * about 40k triangles (6.2k near clumps of 2 cards, 7.7k far of 1); Lite: 1 draw, about 8k. The ground height and
 * where grass grows come from a small texture refilled a column at a time as the view moves (`GrassData`); the
 * presses from another (`BendField`).
 */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  type IslandMap, Surface, ROCK, OVERLAY_SURFACES, heightField, sampleGroundHeight, surfaceAt, needsCliff, isGroundAtWorld,
  overlayAt, worldToCellX, worldToCellZ, smoothstep,
} from "@/lib/game/grid";
import { BendField, GrassData, type GrassSampler } from "@/lib/game/grassField";
import { BLADE_SIZE, BLADE_VARIANTS, bladeTexture } from "@/lib/game/grassBlades";
import { GRASS_BENDERS } from "@/lib/game/grassBenders";
import { useTuning } from "@/lib/game/tuning";
import { worldTime } from "@/lib/game/worldClock";
import { WIND_DIR, viewFocus } from "@/lib/game/worldFx";
import { addCutout } from "@/lib/game/occluders";
import { TERRAIN_GRASS, TERRAIN_SNOW, TERRAIN_WET } from "./GridTerrain";

/**
 * A layer of the field: its grid spacing and window half size (world units), cards per clump, card width and height
 * (× the blade height), and where it hands over to the next layer (camera distance beyond the focus; null = it runs
 * to the fade). High draws a dense near layer and a sparser, broader far one: the field thins with distance, and the
 * scenes keep their triangle budgets (every slot counts, drawn or not).
 */
interface GrassLayer { spacing: number; half: number; cards: number; width: number; height: number; until: number | null }
/** The fade sits this far beyond the camera's distance to the focus; `focus` caps how far ahead the window centres. */
export const GRASS_TIERS: Record<"high" | "lite", { layers: readonly GrassLayer[]; fadeIn: number; fadeOut: number; data: number; focus: number }> = {
  high: {
    layers: [
      { spacing: 0.28, half: 11, cards: 2, width: 0.36, height: 1, until: 2 },
      { spacing: 0.5, half: 22, cards: 1, width: 0.56, height: 1.1, until: null },
    ],
    fadeIn: 6, fadeOut: 15, data: 96, focus: 13,
  },
  lite: { layers: [{ spacing: 0.44, half: 14, cards: 1, width: 0.48, height: 1, until: null }], fadeIn: 2, fadeOut: 8, data: 64, focus: 8 },
};
/** The handover between two layers is dithered across this many units of camera distance. */
const HANDOVER = 1.5;
const DATA_TEXEL = 0.5;
/** The press window: 96 texels of 0.25 u (24 u across, the near grass), RG bytes. */
const BEND_N = 96, BEND_TEXEL = 0.25;
/** A character's footprint in the grass, and how high off the ground they still press it. */
const FOOT_RADIUS = 0.42, FOOT_LIFT = 0.3;
/** The ground's world UV (GridTerrain UV, 2 cells a repeat) times the grass map's repeat, for the hue patches. */
const PATCH_UV = 0.5 * 0.85;

// ─── The blades' texture and card ───────────────────────────────────────
let blades: THREE.DataTexture | null = null;
function bladeMap(): THREE.DataTexture {
  if (blades) return blades;
  const t = new THREE.DataTexture(bladeTexture(), BLADE_SIZE * BLADE_VARIANTS, BLADE_SIZE, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return (blades = t);
}

/**
 * `cards` cards, each one quad (root and tip): position = (across −0.5..0.5, up 0..1, card). One quad, not a bent
 * strip: at the pixel finish a blade's lean reads the same, and the field stays inside the scenes' triangle budget.
 */
export function grassCard(cards: number, instances: number): THREE.InstancedBufferGeometry {
  const pos: number[] = [], index: number[] = [];
  for (let c = 0; c < cards; c++) {
    const a = c * 4;
    for (const y of [0, 1]) pos.push(-0.5, y, c, 0.5, y, c);
    index.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.instanceCount = instances;
  return g;
}

const VERTEX_HEAD = /* glsl */ `
uniform float uTime;
uniform vec4 uWind;      // sway (share of the blade), speed, gust length, blade height
uniform vec2 uWindDir;
uniform vec4 uGrid;      // n, spacing, density, card width
uniform vec4 uRing;      // this layer's span in camera distance: keep from (x→y), drop (z→w)
uniform float uLayerH;   // this layer's blade height, × the field's
uniform vec2 uFocus;
uniform vec2 uFade;      // camera distance where the fade starts and ends
uniform sampler2D uData; // (height × density, density), toroidal
uniform vec2 uDataN;     // n, texel
uniform sampler2D uBend; // the press (x, z) at 128 ± 127, toroidal
uniform vec3 uBendN;     // n, texel, strength
uniform vec3 uGrassColor;
uniform vec2 uGrassLook;
uniform float uSnow;
uniform float uWet;
uniform float uLean;
uniform float uLush;     // 1: the smooth world's lawn, one even, lush green (0: the village's, as it was)
varying vec3 vGrass;
varying float vFade;
varying vec2 vBladeUv;
uvec2 grassPcg(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}
vec4 grassRand(ivec2 c) {
  uvec2 a = grassPcg(uvec2(c + 65536)), b = grassPcg(a ^ uvec2(0x9e3779b9u, 0x85ebca6bu));
  return vec4(float(a.x & 0xffffu), float(a.y & 0xffffu), float(b.x & 0xffffu), float(b.y & 0xffffu)) / 65535.0;
}
float grassNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float a = grassRand(ivec2(i)).x, b = grassRand(ivec2(i) + ivec2(1, 0)).x, c = grassRand(ivec2(i) + ivec2(0, 1)).x, d = grassRand(ivec2(i) + ivec2(1, 1)).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 gP;
`;

/** Plants the clump, picks its shape and colour, and bends it: computed with the normal (which comes first), used by begin_vertex. */
const VERTEX_BODY = /* glsl */ `
  float gn = uGrid.x;
  int gSlot = gl_InstanceID;
  float gsi = float(gSlot % int(gn)), gsk = float(gSlot / int(gn));
  vec2 gfc = uFocus / uGrid.y;
  vec2 gCell = vec2(gsi + gn * floor((gfc.x - gsi) / gn + 0.5), gsk + gn * floor((gfc.y - gsk) / gn + 0.5));
  ivec2 gCi = ivec2(gCell);
  vec4 gr = grassRand(gCi), gr2 = grassRand(gCi + ivec2(7919, -4211));
  vec2 gRoot = (gCell + (gr.xy - 0.5) * 0.95) * uGrid.y;
  vec2 gData = texture2D(uData, (gRoot / uDataN.y + 0.5) / uDataN.x).rg;
  float gDensity = gData.y;
  float gGround = gData.x / max(gData.y, 1e-3);
  vec3 gToCam = cameraPosition - vec3(gRoot.x, gGround, gRoot.y);
  float gCamDist = length(gToCam);
  float gFade = 1.0 - smoothstep(uFade.x, uFade.y, gCamDist);
  float gKeep = smoothstep(uRing.x, uRing.y, gCamDist) * (1.0 - smoothstep(uRing.z, uRing.w, gCamDist));
  float gAlive = step(gr.z, gDensity * uGrid.z * gKeep) * step(0.002, gFade);
  // Patches: the lawn grows thicker and taller in places (world noise), thinner where it meets a path.
  float gPatch = grassNoise(gRoot * 0.21);
  float gH = uWind.w * uLayerH * (0.62 + 0.6 * gr.w) * mix(0.72, 1.22, gPatch) * mix(0.4, 1.0, smoothstep(0.05, 0.7, gDensity));
  gH *= (1.0 - 0.85 * uSnow) * mix(0.5, 1.0, gFade) * (1.0 + 0.2 * uLush);
  // Face the camera (with a twist per clump and per card) and lean away from it as the view looks down.
  float gCard = position.z;
  vec2 gToCamH = normalize(gToCam.xz + vec2(1e-4, 0.0));
  float gYaw = (gr2.x - 0.5) * 1.1 + gCard * 1.15;
  vec2 gFace = vec2(gToCamH.x * cos(gYaw) - gToCamH.y * sin(gYaw), gToCamH.x * sin(gYaw) + gToCamH.y * cos(gYaw));
  vec2 gSide = vec2(-gFace.y, gFace.x);
  float gElev = clamp(gToCam.y / max(gCamDist, 1e-3), 0.0, 1.0);
  float gUp = position.y, gBend = gUp * gUp;
  // Wind: a gust wave travelling along the world wind, and each clump's own flutter across it.
  float gGust = sin(dot(gRoot, uWindDir) / uWind.z * 6.2832 - uTime * uWind.y * 2.4) * 0.5 + 0.5;
  float gFlutter = sin(uTime * uWind.y * 3.3 + gr2.z * 6.2832 + gRoot.x * 0.7);
  vec2 gWind = (uWindDir * (0.2 + gGust) + gSide * gFlutter * 0.3) * uWind.x;
  // Characters: the press, inside the bend window only (its storage wraps beyond it).
  vec2 gBendSample = texture2D(uBend, (gRoot / uBendN.y + 0.5) / uBendN.x).rg * 255.0;
  vec2 gOff2 = abs(gRoot - uFocus);
  float gInBend = 1.0 - step(uBendN.x * uBendN.y * 0.46, max(gOff2.x, gOff2.y));
  vec2 gPush = (gBendSample - 128.0) / 127.0 * gInBend * uBendN.z;
  float gPressed = clamp(length(gPush), 0.0, 1.0);
  vec2 gOff = (gWind * (1.0 - gPressed) + gPush * 1.15) * gBend * gH;
  float gWidth = uGrid.w * (0.8 + 0.4 * gr2.y);
  gP = vec3(gRoot.x, gGround, gRoot.y) + vec3(gSide.x, 0.0, gSide.y) * (position.x * gWidth);
  gP.y += gUp * gH * (1.0 - 0.62 * gPressed) * (1.0 - 0.3 * min(1.0, length(gOff) / max(gH, 1e-3)));
  gP.xz += gOff - gFace * (uLean * gElev * gUp * gH);
  if (gAlive < 0.5) gP = vec3(gRoot.x, gGround - 60.0, gRoot.y);
  // Colour: the ground's own grass and hue patches, a dark root to a light warm tip, a little variety.
  vec2 gq = gRoot * ${PATCH_UV.toFixed(4)} * 0.9;
  float gHue = sin(gq.x * 1.3 + sin(gq.y * 1.1) * 1.6) * sin(gq.y * 1.5 + sin(gq.x * 0.9) * 1.8);
  vec3 gShift = mix(vec3(1.0), gHue > 0.0 ? vec3(1.08, 1.02, 0.82) : vec3(0.9, 1.0, 1.06), abs(gHue) * uGrassLook.y);
  vec3 gBase = uGrassColor * gShift * (0.98 + mix(0.16, 0.05, uLush) * (gr2.w - 0.5) + mix(0.14, 0.06, uLush) * (gPatch - 0.5));
  vec3 gC = mix(gBase * mix(0.52, 0.72, uLush), gBase * mix(vec3(1.14, 1.2, 0.9), vec3(1.06, 1.12, 0.96), uLush) + vec3(0.02, 0.03, 0.0) * (1.0 - uLush), smoothstep(0.0, 1.0, gUp));
  gC *= 1.0 + 0.16 * gGust * gUp * min(1.0, uWind.x / 0.3);
  gC *= 1.0 - 0.24 * gPressed;
  gC *= 1.0 - 0.14 * uWet;
  gC = mix(gC, vec3(0.9, 0.93, 0.97), uSnow * gUp * 0.85);
  vGrass = gC;
  vFade = gFade;
  vBladeUv = vec2((floor(gr2.z * ${BLADE_VARIANTS.toFixed(1)}) + position.x + 0.5) / ${BLADE_VARIANTS.toFixed(1)}, gUp);
  // Lit like the ground under it, turned a little toward the viewer.
  vec3 objectNormal = normalize(vec3(0.0, 1.0, 0.0) + vec3(gFace.x, 0.0, gFace.y) * 0.3);
`;

const FRAGMENT_HEAD = /* glsl */ `
uniform sampler2D uBlade;
varying vec3 vGrass;
varying float vFade;
varying vec2 vBladeUv;
`;
const FRAGMENT_MAP = /* glsl */ `
  vec4 gBlade = texture2D(uBlade, vBladeUv, -0.6);
  if (gBlade.a < 0.5) discard;
  if (vFade < tsiBayer(gl_FragCoord.xy)) discard;
  diffuseColor.rgb = vGrass * gBlade.rgb;
`;

/** The uniforms every layer shares (one object each, so a frame writes them once). */
function sharedUniforms(dataTex: THREE.DataTexture, bendTex: THREE.DataTexture, data: number, lush: boolean) {
  return {
    uTime: { value: 0 }, uWind: { value: new THREE.Vector4() }, uWindDir: { value: new THREE.Vector2(WIND_DIR.x, WIND_DIR.z) },
    uFocus: { value: new THREE.Vector2() }, uFade: { value: new THREE.Vector2(20, 30) },
    uData: { value: dataTex }, uDataN: { value: new THREE.Vector2(data, DATA_TEXEL) },
    uBend: { value: bendTex }, uBendN: { value: new THREE.Vector3(BEND_N, BEND_TEXEL, 1) },
    uGrassColor: { value: new THREE.Color() }, uGrassLook: TERRAIN_GRASS, uSnow: TERRAIN_SNOW, uWet: TERRAIN_WET, uLean: { value: 0.6 }, uLush: { value: lush ? 1 : 0 },
    uBlade: { value: bladeMap() },
  };
}

/** The material: three's standard lit one (shadows, fog, the curved world, the look's patches) with the field's vertex stage. */
function grassMaterial(uniforms: Record<string, THREE.IUniform>): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ name: "terrain:grass-field", roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_HEAD}`)
      .replace("#include <beginnormal_vertex>", VERTEX_BODY)
      .replace("#include <begin_vertex>", "vec3 transformed = gP;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_HEAD}`)
      .replace("#include <map_fragment>", FRAGMENT_MAP)
      // Lit like the ground from either side: a card seen from behind keeps its upward normal (three would flip it down).
      .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\n  normal = normalize( vNormal );");
    // The terrain's see-through cut round the player (occluders.ts); it also defines tsiBayer for the fade. A blade is cut
    // by its root's height, as the ground under it is: by its own, a blade cut where the ground is not left a bald disc.
    addCutout(shader);
    shader.vertexShader = shader.vertexShader.replace("vCutY = (modelMatrix * vec4(transformed, 1.0)).y;", "vCutY = gGround;");
  };
  m.customProgramCacheKey = () => "grass-field-v1";
  return m;
}

/** Where grass grows, and the ground under it: no grass on paths, sand, ramps, cliff tops, steep rock or under solids. */
export function grassSampler(map: IslandMap, field: Float32Array, clear?: (x: number, z: number) => boolean): GrassSampler {
  return (x, z) => {
    const h = sampleGroundHeight(map, field, x, z);
    if (!isGroundAtWorld(map, x, z)) return [h, 0];
    const cx = worldToCellX(map, x), cz = worldToCellZ(map, z), s = surfaceAt(map, cx, cz);
    if (s === Surface.Ramp || needsCliff(map, cx, cz)) return [h, 0];
    let cover = 0;
    for (const o of OVERLAY_SURFACES) cover = Math.max(cover, overlayAt(map, o, x, z));
    let density = 1 - smoothstep(0.15, 0.6, cover);
    if (density <= 0) return [h, 0];
    // Stony ground on steep slopes (the terrain's ROCK fade) grows none.
    const e = 0.3, gx = sampleGroundHeight(map, field, x + e, z) - sampleGroundHeight(map, field, x - e, z);
    const gz = sampleGroundHeight(map, field, x, z + e) - sampleGroundHeight(map, field, x, z - e);
    density *= 1 - smoothstep(ROCK.from * 0.8, ROCK.to, Math.hypot(gx, gz) / (2 * e));
    if (density > 0 && clear && !clear(x, z)) density = 0;
    return [h, density];
  };
}

const _dir = new THREE.Vector3(), _at = new THREE.Vector3(), _focus = { x: 0, z: 0 };

/**
 * `color`: the island's grass (the seasonal palette's). `windScale` multiplies the sway (0 holds it still). `clear`:
 * false where a solid stands (buildings, trunks, rocks), so no blades grow through it.
 */
export default function GrassField({ map, field: suppliedField, color, windScale = 1, lite = false, clear, sampler, revision = 0, lush = false }: {
  map?: IslandMap; field?: Float32Array; color: string; windScale?: number; lite?: boolean; clear?: (x: number, z: number) => boolean;
  /** Where grass grows and the ground under it, when the world is not a cell map (the smooth world: lib/game/world/terrain.ts). */
  sampler?: GrassSampler;
  /** Bump after editing the ground in place (the world editor): every texel in view is resampled. */
  revision?: number;
  /** One even, lush green instead of the speckled lawn (the smooth world; David, R2d: "i want grass for feel like fass and not feel like a mess"). */
  lush?: boolean;
}) {
  const t = useTuning();
  const tier = lite ? GRASS_TIERS.lite : GRASS_TIERS.high;
  const field = useMemo(() => (sampler || !map ? null : suppliedField ?? heightField(map)), [map, suppliedField, sampler]);
  const state = useMemo(() => {
    const data = new GrassData(tier.data, DATA_TEXEL, sampler ?? grassSampler(map!, field!, clear));
    const dataTex = new THREE.DataTexture(data.half, tier.data, tier.data, THREE.RGFormat, THREE.HalfFloatType);
    const bend = new BendField(BEND_N, BEND_TEXEL, 0.8);
    const bendTex = new THREE.DataTexture(bend.bytes, BEND_N, BEND_N, THREE.RGFormat);
    bendTex.unpackAlignment = 2;
    for (const tex of [dataTex, bendTex]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
    }
    const shared = sharedUniforms(dataTex, bendTex, tier.data, lush);
    const layers = tier.layers.map(layer => {
      const n = Math.ceil((layer.half * 2) / layer.spacing);
      const grid = { value: new THREE.Vector4(n, layer.spacing, 1, layer.width) }, ring = { value: new THREE.Vector4(-2, -1, 1e5, 1e5 + 1) };
      return { layer, grid, ring, material: grassMaterial({ ...shared, uGrid: grid, uRing: ring, uLayerH: { value: layer.height } }), geometry: grassCard(layer.cards, n * n) };
    });
    return { data, dataTex, bend, bendTex, uniforms: shared, layers };
  }, [map, field, clear, tier, sampler, lush]);
  useEffect(() => { if (revision) refill(state); }, [state, revision]);
  useEffect(() => () => {
    state.dataTex.dispose(); state.bendTex.dispose();
    for (const l of state.layers) { l.material.dispose(); l.geometry.dispose(); }
  }, [state]);
  useEffect(() => { state.uniforms.uGrassColor.value.set(color); }, [state, color]);

  useFrame(({ camera }, delta) => advance(state, camera, delta, t.grass, windScale, tier));

  if (t.grass.density <= 0) return null;
  // A fixed instance count per layer drawn wherever the view is: never culled (its bounds are the window, not the geometry).
  return <>{state.layers.map((l, i) => <mesh key={i} geometry={l.geometry} material={l.material} frustumCulled={false} receiveShadow castShadow={false} />)}</>;
}

type FieldState = {
  data: GrassData; dataTex: THREE.DataTexture; bend: BendField; bendTex: THREE.DataTexture; uniforms: ReturnType<typeof sharedUniforms>;
  layers: { layer: GrassLayer; grid: { value: THREE.Vector4 }; ring: { value: THREE.Vector4 } }[];
};
type Grass = ReturnType<typeof useTuning>["grass"];

/** The ground under the window changed: resample it all (module scope: hook values are never written in a component). */
function refill(s: FieldState) {
  if (s.data.refill()) s.dataTex.needsUpdate = true;
}

/** One frame: follow the view, take the presses, spring back, push the uniforms. Module scope: hook values are never written in a component. */
function advance(s: FieldState, camera: THREE.Camera, delta: number, g: Grass, windScale: number, tier: (typeof GRASS_TIERS)["high"]) {
  camera.getWorldDirection(_dir);
  viewFocus(camera.position, _dir, _focus);
  // A camera looking out level (the title) meets the ground far off: keep the window round what is near.
  const fx = _focus.x - camera.position.x, fz = _focus.z - camera.position.z, reach = Math.hypot(fx, fz), most = tier.focus;
  if (reach > most) { _focus.x = camera.position.x + (fx / reach) * most; _focus.z = camera.position.z + (fz / reach) * most; }
  if (s.data.update(_focus.x, _focus.z)) s.dataTex.needsUpdate = true;
  const bend = s.bend;
  bend.trail = g.trail;
  bend.recentre(_focus.x, _focus.z);
  bend.decay(Math.min(delta, 0.1));
  if (g.bend > 0) for (const o of GRASS_BENDERS) {
    // Last frame's world matrix: no walk up the parents for each character.
    _at.setFromMatrixPosition(o.matrixWorld);
    // On the ground, not mid-hop or seated up on something; a press where no grass grows is harmless.
    if (_at.y - s.data.sample(_at.x, _at.z)[0] < FOOT_LIFT) bend.press(_at.x, _at.z, FOOT_RADIUS);
  }
  if (bend.encode()) s.bendTex.needsUpdate = true;
  const u = s.uniforms;
  u.uTime.value = worldTime();
  u.uWind.value.set(g.swayAmount * windScale, g.swaySpeed, g.gustLength, g.bladeHeight);
  u.uFocus.value.set(_focus.x, _focus.z);
  u.uBendN.value.z = g.bend;
  u.uLean.value = g.lean;
  // The fade sits beyond the focus: a zoomed-out camera keeps grass under the player.
  const [focusH] = s.data.sample(_focus.x, _focus.z);
  const toFocus = camera.position.distanceTo(_at.set(_focus.x, focusH, _focus.z));
  u.uFade.value.set(toFocus + tier.fadeIn, toFocus + tier.fadeOut);
  // Each layer from where the one before hands over to where it hands over to the next.
  let from = -1e4;
  for (const l of s.layers) {
    const to = l.layer.until === null ? 1e4 : toFocus + l.layer.until;
    l.ring.value.set(from - HANDOVER, from + HANDOVER, to - HANDOVER, to + HANDOVER);
    l.grid.value.z = Math.min(1, g.density);
    from = to;
  }
}
